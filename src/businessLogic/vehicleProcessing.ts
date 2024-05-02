/**
 * This module collects together closures from different modules for handling a
 * single vehicle. This module ties the HFP and partial APC message handling and
 * the XState actor together. This module also handles testing logic to inform
 * the higher-level loops when all test data has been handled.
 */

import { Queue, createQueue } from "../dataStructures/queue";
import type {
  EndCondition,
  HfpInboxQueueMessage,
  InboxQueueMessage,
  MessageCollection,
  PartialApcInboxQueueMessage,
  ProcessingConfig,
  UniqueVehicleId,
  VehicleContext,
} from "../types";
import { createSleep } from "../util/sleep";
import createApcHandler from "./apcHandling";
import createHfpHandler from "./hfpHandling";
import { createActor } from "./vehicleActor";

const initializeVehicleContext = async (
  config: ProcessingConfig,
  outboxQueue: Queue<MessageCollection>,
  backlogDrainingWaitPromise: Promise<void>,
  hfpEndConditionFuncs?: {
    reportHfpRead: (n: number) => void;
    isMoreHfpExpected: () => boolean;
  },
): Promise<VehicleContext> => {
  const partialApcQueue = createQueue<PartialApcInboxQueueMessage>();
  const hfpQueue = createQueue<HfpInboxQueueMessage>();
  const apcFuncs = createApcHandler(config, partialApcQueue, outboxQueue);
  const hfpFuncs = createHfpHandler(
    config,
    hfpQueue,
    apcFuncs.prepareHfpForAcknowledging,
    hfpEndConditionFuncs,
  );
  const vehicleActor = createActor(outboxQueue, apcFuncs, hfpFuncs);
  const hfpFeedPromise = hfpFuncs.feedVehicleActor(
    vehicleActor,
    backlogDrainingWaitPromise,
  );
  return {
    partialApcQueue,
    hfpQueue,
    hfpFeedPromise,
  };
};

const createHfpEndConditionCounter = (endCondition: EndCondition) => {
  const { nHfpMessages } = endCondition;
  let nHfpRead = 0;

  const reportHfpRead = (n: number): void => {
    nHfpRead += n;
  };

  const isMoreHfpExpected = (): boolean => nHfpRead < nHfpMessages;

  return {
    reportHfpRead,
    isMoreHfpExpected,
  };
};

const initializeVehicleProcessing = (
  config: ProcessingConfig,
  outboxQueue: Queue<MessageCollection>,
  endCondition?: EndCondition,
) => {
  const vehicles = new Map<UniqueVehicleId, VehicleContext>();
  let hfpEndConditionFuncs:
    | { reportHfpRead: (n: number) => void; isMoreHfpExpected: () => boolean }
    | undefined;
  if (endCondition != null) {
    hfpEndConditionFuncs = createHfpEndConditionCounter(endCondition);
  }

  const { backlogDrainingWaitInSeconds } = config;
  const backlogDrainingWaitInMilliseconds =
    1_000 * backlogDrainingWaitInSeconds;
  const { sleep } = createSleep();
  // One sleep for all vehicles. It is likely fulfilled when many of the
  // vehicles get their first message. That is fine.
  const backlogDrainingWaitPromise = sleep(backlogDrainingWaitInMilliseconds);

  const pushIntoVehicleQueue = async (
    message: InboxQueueMessage,
  ): Promise<void> => {
    const { uniqueVehicleId } = message;
    let vehicleContext = vehicles.get(uniqueVehicleId);
    if (vehicleContext == null) {
      vehicleContext = await initializeVehicleContext(
        config,
        outboxQueue,
        backlogDrainingWaitPromise,
        hfpEndConditionFuncs,
      );
      vehicles.set(uniqueVehicleId, vehicleContext);
    }
    if (message.type === "partialApc") {
      vehicleContext.partialApcQueue.push(message);
    } else {
      vehicleContext.hfpQueue.push(message);
    }
  };

  /**
   * waitForHfpFeeding is only useful during testing.
   */
  const waitForHfpFeeding = async (): Promise<void> => {
    await Promise.all(
      [...vehicles.values()].map((context) => context.hfpFeedPromise),
    );
  };

  return { pushIntoVehicleQueue, waitForHfpFeeding };
};

export default initializeVehicleProcessing;
