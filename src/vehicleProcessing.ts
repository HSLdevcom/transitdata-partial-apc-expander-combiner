import { Mutex, MutexInterface } from "async-mutex";
import type pino from "pino";
import {
  PriorityQueue,
  createPriorityQueue,
} from "./dataStructures/priorityQueue";
import { Queue } from "./dataStructures/queue";
import createMessageCollectionFormer from "./messageCollectionForming";
import { hfp } from "./protobuf/hfp";
import transition from "./transitions";
import type {
  HfpDeadrunInboxQueueMessage,
  HfpInboxQueueMessage,
  HfpVehicleQueueMessage,
  InboxQueueMessage,
  InboxQueueMessageOrPoisonPill,
  InitiallyUnknownState,
  MessageCollection,
  PartialApcInboxQueueMessage,
  ProcessingConfig,
  SharedContext,
  UniqueVehicleId,
  VehicleContext,
  VehicleQueueMessage,
} from "./types";
import transformUnknownToError from "./util/error";
import {
  compareMessagesOrPoisonPill,
  compareVehicleQueueMessages,
} from "./util/priorityQueueUtil";
import { createSleep } from "./util/sleep";

/**
 * Throw a valid HFP message away. Sometimes we have no use for them.
 */
const queueSingleHfpForAcking = (
  outboxQueue: Queue<MessageCollection>,
  message: HfpInboxQueueMessage,
): void => {
  const { messageId } = message;
  const collection: MessageCollection = {
    toSend: [],
    toAckPartialApc: [],
    toAckHfp: [messageId],
  };
  outboxQueue.push(collection);
};

const initializeVehicleContext = (): VehicleContext => {
  const inboxQueue = createPriorityQueue<InboxQueueMessageOrPoisonPill>({
    comparable: compareMessagesOrPoisonPill,
  });
  const midQueue = createPriorityQueue<VehicleQueueMessage>({
    comparable: compareVehicleQueueMessages,
  });
  const mutex = new Mutex();
  const vehicleState: InitiallyUnknownState = { type: "initiallyUnknown" };
  const nextSendOnJourneyAllowedAfterTimestamp = 0;
  const abortDeadrunTrigger = undefined;
  const deadrunTriggerTimestamp = undefined;
  return {
    vehicleState,
    abortDeadrunTrigger,
    deadrunTriggerTimestamp,
    nextSendOnJourneyAllowedAfterTimestamp,
    inboxQueue,
    midQueue,
    messageFormingMutex: mutex,
  };
};

/**
 * createEnder is useful only during testing. It returns the tools to end
 * the vehicle-specific processing loops. reportSent is used to report the
 * amount of sent messages. waitUntilDone is used to wait until all the
 * vehicle-specific processing loops are finished.
 */
const createEnder = (
  vehicles: Map<UniqueVehicleId, VehicleContext>,
  processors: Map<UniqueVehicleId, Promise<void>>,
  nSentMessagesExpected: number | undefined,
): {
  reportSent: ((toAdd: number) => void) | undefined;
  waitUntilDone: Promise<void>;
} => {
  if (nSentMessagesExpected === undefined) {
    const neverSettlingPromise = new Promise<void>(() => {});
    return {
      reportSent: undefined,
      waitUntilDone: neverSettlingPromise,
    };
  }

  let nSentMessages = 0;
  let resolve: () => void;

  const reportSent = (toAdd: number): void => {
    nSentMessages += toAdd;
    if (nSentMessages >= nSentMessagesExpected) {
      resolve();
    }
  };

  const waitUntilDoneFunction = async (): Promise<void> => {
    const done = new Promise<void>((res) => {
      resolve = res;
    });
    await done;
    vehicles.forEach((vehicleContext: VehicleContext) => {
      vehicleContext.inboxQueue.push("STOP");
    });
    await Promise.all(processors.values());
  };

  return { reportSent, waitUntilDone: waitUntilDoneFunction() };
};

/* eslint-disable no-param-reassign */
const isDeadrunLongInTheFuture = async (
  logger: pino.Logger,
  vehicleContext: VehicleContext,
  hfpVehicleQueueMessage: HfpVehicleQueueMessage,
  delayInMilliseconds: number,
): Promise<boolean> => {
  let isDeadrunLong = true;
  const { sleep, abort } = createSleep();
  vehicleContext.abortDeadrunTrigger = abort;
  try {
    await sleep(delayInMilliseconds);
  } catch (error) {
    const err = transformUnknownToError(error);
    if (err.name === "AbortError") {
      logger.debug(
        { err, vehicleContext, deadrunStartingMessage: hfpVehicleQueueMessage },
        "The deadrun timeout was aborted, presumably due to returning to a vehicle journey quickly enough.",
      );
    } else {
      logger.fatal(
        {
          err,
          vehicleContext,
          hfpVehicleQueueMessage,
        },
        "Failed waiting for triggering forming a MessageCollection for the APC counts of the previous stop after a deadrun started. Very likely a programming error.",
      );
      throw err;
    }
    isDeadrunLong = false;
  }
  return isDeadrunLong;
};
/* eslint-enable no-param-reassign */

/**
 * When we look in the past, we must iterate through inboxQueue before
 * potentially pushing hfpVehicleQueueMessage into midQueue in the calling
 * function. That is why we cannot rely on aborting a timer here.
 *
 * We are replicating a simplified part of the functions createProcessor and
 * transition here. We have side effects here.
 */
/* eslint-disable no-param-reassign */
const isDeadrunLongInThePast = async (
  vehicleContext: VehicleContext,
  hfpVehicleQueueMessage: HfpVehicleQueueMessage,
  outboxQueue: Queue<MessageCollection>,
): Promise<boolean> => {
  let isDeadrunLong = true;
  let isInboxQueueInspectionDone = false;
  const { effectTimestamp } = hfpVehicleQueueMessage;
  const { inboxQueue, midQueue, vehicleState } = vehicleContext;
  if (vehicleState.type !== "shortDeadrun") {
    // The upper inboxQueue reading loop was faster to change the state.
    isDeadrunLong = false;
    isInboxQueueInspectionDone = true;
  }
  while (!isInboxQueueInspectionDone) {
    const peeked = inboxQueue.peek();
    if (
      peeked === undefined ||
      peeked === "STOP" ||
      peeked.eventTimestamp > effectTimestamp
    ) {
      isInboxQueueInspectionDone = true;
    } else if (
      peeked.type === "hfp" &&
      peeked.journeyType === hfp.Topic.JourneyType.journey
    ) {
      isDeadrunLong = false;
      isInboxQueueInspectionDone = true;
    } else {
      // eslint-disable-next-line no-await-in-loop
      const nextMessage = (await inboxQueue.pop()) as
        | PartialApcInboxQueueMessage
        | HfpDeadrunInboxQueueMessage;
      if (nextMessage.type === "partialApc") {
        midQueue.push(nextMessage);
      } else {
        queueSingleHfpForAcking(outboxQueue, nextMessage);
      }
    }
  }
  return isDeadrunLong;
};
/* eslint-enable no-param-reassign */

/* eslint-disable no-param-reassign */
const sendIfDeadrunBecomesLong = async (
  logger: pino.Logger,
  outboxQueue: Queue<MessageCollection>,
  formMessageCollection: (
    mutex: MutexInterface,
    vehicleQueue: PriorityQueue<VehicleQueueMessage>,
  ) => Promise<void>,
  sendWaitAfterDeadrunStartInMilliseconds: number,
  vehicleContext: VehicleContext,
  hfpVehicleQueueMessage: HfpVehicleQueueMessage,
) => {
  hfpVehicleQueueMessage.effectTimestamp +=
    sendWaitAfterDeadrunStartInMilliseconds;
  vehicleContext.deadrunTriggerTimestamp =
    hfpVehicleQueueMessage.effectTimestamp;
  let isDeadrunLong = true;
  const { effectTimestamp } = hfpVehicleQueueMessage;
  const currentTime = Date.now();
  const delay = effectTimestamp - currentTime;
  if (delay > 0) {
    isDeadrunLong = await isDeadrunLongInTheFuture(
      logger,
      vehicleContext,
      hfpVehicleQueueMessage,
      delay,
    );
  } else {
    isDeadrunLong = await isDeadrunLongInThePast(
      vehicleContext,
      hfpVehicleQueueMessage,
      outboxQueue,
    );
  }
  if (isDeadrunLong) {
    logger.debug(
      "Trigger a send due to a short deadrun turning into a long deadrun",
    );
    vehicleContext.midQueue.push(hfpVehicleQueueMessage);
    vehicleContext.abortDeadrunTrigger = undefined;
    vehicleContext.deadrunTriggerTimestamp = undefined;
    vehicleContext.vehicleState = { type: "longDeadrun" };
    await formMessageCollection(
      vehicleContext.messageFormingMutex,
      vehicleContext.midQueue,
    );
  } else {
    // Just ack the deadrun starting message. The next HFP message in inboxQueue
    // will take care of modifying vehicleContext.
    queueSingleHfpForAcking(outboxQueue, hfpVehicleQueueMessage.wrapped);
  }
};
/* eslint-enable no-param-reassign */

const drainInboxQueueAheadOfSending = async (
  vehicleContext: VehicleContext,
  effectTimestamp: number,
): Promise<void> => {
  const { inboxQueue, midQueue } = vehicleContext;
  let isInboxQueueInspectionDone = false;
  while (!isInboxQueueInspectionDone) {
    const peeked = inboxQueue.peek();
    if (
      peeked === undefined ||
      peeked === "STOP" ||
      (peeked.type === "partialApc" &&
        peeked.eventTimestamp > effectTimestamp) ||
      (peeked.type === "hfp" && peeked.eventTimestamp >= effectTimestamp)
    ) {
      isInboxQueueInspectionDone = true;
    } else {
      // eslint-disable-next-line no-await-in-loop
      const nextMessage = (await inboxQueue.pop()) as InboxQueueMessage;
      if (nextMessage.type === "partialApc") {
        midQueue.push(nextMessage);
      } else {
        // Push other messages forwards in time. Repeats logic in the upper
        // inboxQueue reading loop.
        nextMessage.eventTimestamp = effectTimestamp;
        inboxQueue.push(nextMessage);
      }
    }
  }
};

/* eslint-disable no-param-reassign */
const sendEventually = async (
  formMessageCollection: (
    mutex: MutexInterface,
    vehicleQueue: PriorityQueue<VehicleQueueMessage>,
  ) => Promise<void>,
  sendWaitAfterStopChangeInMilliseconds: number,
  vehicleContext: VehicleContext,
  hfpVehicleQueueMessage: HfpVehicleQueueMessage,
) => {
  hfpVehicleQueueMessage.effectTimestamp +=
    sendWaitAfterStopChangeInMilliseconds;
  vehicleContext.nextSendOnJourneyAllowedAfterTimestamp =
    hfpVehicleQueueMessage.effectTimestamp;
  const currentTime = Date.now();
  const { effectTimestamp } = hfpVehicleQueueMessage;
  if (currentTime < effectTimestamp) {
    const delay = effectTimestamp - currentTime;
    const { sleep } = createSleep();
    await sleep(delay);
  } else {
    await drainInboxQueueAheadOfSending(vehicleContext, effectTimestamp);
  }
  vehicleContext.midQueue.push(hfpVehicleQueueMessage);
  await formMessageCollection(
    vehicleContext.messageFormingMutex,
    vehicleContext.midQueue,
  );
};
/* eslint-enable no-param-reassign */

/* eslint-disable no-param-reassign */
const createGeneralProcessor = (
  logger: pino.Logger,
  {
    sendWaitAfterStopChangeInSeconds,
    sendWaitAfterDeadrunStartInSeconds,
  }: ProcessingConfig,
  outboxQueue: Queue<MessageCollection>,
  formMessageCollection: (
    mutex: MutexInterface,
    vehicleQueue: PriorityQueue<VehicleQueueMessage>,
  ) => Promise<void>,
  sharedContext: SharedContext,
): ((vehicleContext: VehicleContext) => Promise<void>) => {
  const sendWaitAfterStopChangeInMilliseconds =
    1_000 * sendWaitAfterStopChangeInSeconds;
  const sendWaitAfterDeadrunStartInMilliseconds =
    1_000 * sendWaitAfterDeadrunStartInSeconds;

  const handleHfpInboxQueueMessage = (
    vehicleContext: VehicleContext,
    message: HfpInboxQueueMessage,
  ) => {
    const { preCommand, postCommands } = transition(vehicleContext, message);
    const hfpVehicleQueueMessage: HfpVehicleQueueMessage = {
      type: "hfp",
      commands: postCommands,
      effectTimestamp: message.eventTimestamp,
      wrapped: message,
    };
    switch (preCommand) {
      case "ignoreAndAck":
        queueSingleHfpForAcking(outboxQueue, message);
        break;
      case "potentiallySendOnDeadrun":
        // We must not block processing here as sendIfDeadrunBecomesLong
        // contains a sleep that might be interrupted by the next messages
        // from inboxQueue. Also partialApc messages must be handled.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendIfDeadrunBecomesLong(
          logger,
          outboxQueue,
          formMessageCollection,
          sendWaitAfterDeadrunStartInMilliseconds,
          vehicleContext,
          hfpVehicleQueueMessage,
        );
        break;
      case "sendOnJourney":
        // We must not block processing here as sendEventually contains a sleep
        // and partialApc messages must be handled.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendEventually(
          formMessageCollection,
          sendWaitAfterStopChangeInMilliseconds,
          vehicleContext,
          hfpVehicleQueueMessage,
        );
        break;
      case "onlyCollect":
        hfpVehicleQueueMessage.effectTimestamp = Math.max(
          hfpVehicleQueueMessage.effectTimestamp,
          vehicleContext.nextSendOnJourneyAllowedAfterTimestamp,
        );
        vehicleContext.midQueue.push(hfpVehicleQueueMessage);
        break;
      default: {
        const exhaustiveCheck: never = preCommand;
        throw new Error(String(exhaustiveCheck));
      }
    }
  };

  const createProcessor = async (
    vehicleContext: VehicleContext,
  ): Promise<void> => {
    // FIXME: Sleep here for n seconds allowing the priority queue to fill up.
    // Perhaps in n seconds we have reached the end of the topic.
    // Proper way is to wait for this issue to be solved:
    // https://github.com/apache/pulsar-client-node/issues/349
    // A workaround is to use temporary Readers to keep track of backlog.
    // FIXME: Another approach: While the n seconds have not passed, peek if the
    // next message is at least sendWaitAfterDeadrunStartInSeconds seconds in
    // the past. If so, then that message can be popped and handled. Continue
    // that approach until n seconds have passed.
    await sharedContext.backlogDrainingWait;
    const { inboxQueue, midQueue } = vehicleContext;
    let isPoisonPillReceived = false;
    while (!isPoisonPillReceived) {
      // eslint-disable-next-line no-await-in-loop
      const message = await inboxQueue.pop();
      if (message === "STOP") {
        isPoisonPillReceived = true;
      } else if (message.type === "partialApc") {
        midQueue.push(message);
      } else {
        handleHfpInboxQueueMessage(vehicleContext, message);
      }
    }
  };

  return createProcessor;
};
/* eslint-enable no-param-reassign */

const initializeVehicleProcessing = (
  logger: pino.Logger,
  config: ProcessingConfig,
  outboxQueue: Queue<MessageCollection>,
  nSentMessagesExpected?: number,
) => {
  const {
    keepApcFromDeadrunEndInSeconds,
    backlogDrainingWaitInSeconds,
    vehicleCapacities,
    defaultVehicleCapacity,
  } = config;
  const backlogDrainingWaitInMilliseconds =
    1_000 * backlogDrainingWaitInSeconds;
  const getVehicleCapacity = (uniqueVehicleId: UniqueVehicleId): number =>
    vehicleCapacities.get(uniqueVehicleId) ?? defaultVehicleCapacity;
  const vehicles = new Map<UniqueVehicleId, VehicleContext>();
  const processors = new Map<UniqueVehicleId, Promise<void>>();
  const { reportSent, waitUntilDone } = createEnder(
    vehicles,
    processors,
    nSentMessagesExpected,
  );
  const formMessageCollection = createMessageCollectionFormer(
    getVehicleCapacity,
    keepApcFromDeadrunEndInSeconds,
    outboxQueue,
    reportSent,
  );
  let sharedContext: SharedContext;
  let isFirstPush = true;
  let createProcessor: (vehicleContext: VehicleContext) => Promise<void>;

  const pushIntoVehicleQueue = (message: InboxQueueMessage): void => {
    if (isFirstPush) {
      const { sleep } = createSleep();
      // Start waiting here instead of in the outer scope to let the Pulsar
      // client connect first.
      const backlogDrainingWait = sleep(backlogDrainingWaitInMilliseconds);
      sharedContext = { backlogDrainingWait, reportSent };
      createProcessor = createGeneralProcessor(
        logger,
        config,
        outboxQueue,
        formMessageCollection,
        sharedContext,
      );
      isFirstPush = false;
    }
    const { uniqueVehicleId } = message;
    let vehicleContext = vehicles.get(uniqueVehicleId);
    if (vehicleContext === undefined) {
      vehicleContext = initializeVehicleContext();
      vehicles.set(uniqueVehicleId, vehicleContext);
      const processor = createProcessor(vehicleContext);
      processors.set(uniqueVehicleId, processor);
    }
    vehicleContext.inboxQueue.push(message);
  };

  return { pushIntoVehicleQueue, keepCombining: waitUntilDone };
};

export default initializeVehicleProcessing;
