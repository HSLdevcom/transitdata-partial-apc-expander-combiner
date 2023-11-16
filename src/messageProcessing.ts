import { setTimeout } from "node:timers/promises";
import type pino from "pino";
import type Pulsar from "pulsar-client";
import type {
  MessageCollection,
  ProcessingConfig,
  QueueMessage,
} from "./types";
import { PriorityQueue, createPriorityQueue } from "./priorityQueue";
import {
  parseHfpPulsarMessage,
  parsePartialApcPulsarMessage,
} from "./messageParsing";
import { Queue, createQueue } from "./queue";
import { compareMessages } from "./priorityQueueUtil";
import initializeStateHandling from "./state";

const keepFeedingHfpMessages = async (
  logger: pino.Logger,
  inboxQueue: PriorityQueue<QueueMessage>,
  hfpConsumer: Pulsar.Consumer,
): Promise<void> => {
  // Errors are handled in the calling function.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const hfpPulsarMessage = await hfpConsumer.receive();
    const hfpMessage = parseHfpPulsarMessage(logger, hfpPulsarMessage);
    if (hfpMessage != null) {
      inboxQueue.push(hfpMessage);
    } else {
      // Acknowledge only unusable messages here.
      await hfpConsumer.acknowledge(hfpPulsarMessage);
    }
  }
  /* eslint-enable no-await-in-loop */
};

const keepFeedingPartialApcMessages = async (
  logger: pino.Logger,
  inboxQueue: PriorityQueue<QueueMessage>,
  partialApcConsumer: Pulsar.Consumer,
): Promise<void> => {
  // Errors are handled in the calling function.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const partialApcPulsarMessage = await partialApcConsumer.receive();
    const partialApcMessage = parsePartialApcPulsarMessage(
      logger,
      partialApcPulsarMessage,
    );
    if (partialApcMessage != null) {
      inboxQueue.push(partialApcMessage);
    } else {
      // Acknowledge only unusable messages here.
      await partialApcConsumer.acknowledge(partialApcPulsarMessage);
    }
  }
  /* eslint-enable no-await-in-loop */
};

const keepAdvancingState = async (
  { backlogDrainingWaitInSeconds }: ProcessingConfig,
  inboxQueue: PriorityQueue<QueueMessage>,
  advanceState: (message: QueueMessage) => void,
) => {
  // FIXME: sleep here for n seconds allowing the priority queue to fill up.
  // Perhaps in n seconds we have reached the end of the topic.
  // Proper way is to wait for this issue to be solved:
  // https://github.com/apache/pulsar-client-node/issues/349
  // A workaround is to use temporary Readers to keep track of backlog.
  const backlogDrainingWaitInMilliseconds =
    1_000 * backlogDrainingWaitInSeconds;
  await setTimeout(backlogDrainingWaitInMilliseconds);
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const message = await inboxQueue.pop();
    advanceState(message);
  }
  /* eslint-enable no-await-in-loop */
};

const createSendAndAck = (
  producer: Pulsar.Producer,
  hfpConsumer: Pulsar.Consumer,
  partialApcConsumer: Pulsar.Consumer,
): ((collection: MessageCollection) => Promise<void>) => {
  const sendAndAck = async (collection: MessageCollection): Promise<void> => {
    // FIXME:
    //
    // If some but not all of the sends fail, we end up crashing and resending
    // the successful sends after restarting this instance. If the downstream
    // interpretation is to add the counts in the repeated APC messages together
    // for the same vehicle journey and stop, that would lead to incorrect
    // results.
    //
    // If some but not all of the acks fail, we will reuse some but not all of
    // the passenger counts in forming the messages to send. That would lead to
    // incorrect results.
    //
    // One future possibility to fix this problem is to use Apache Pulsar
    // transactions once they are implemented for the TypeScript client.
    //
    // A workaround that can be implemented today is to check the sends and acks
    // from the recent messages in the producer topic at instance startup. To
    // enable that, each produced message should include which source topic
    // messages they originated from and which other producer messages belong to
    // that transaction. That information could be stored in a JSON structure in
    // a Pulsar message property.

    const sendPromises = collection.toSend.map((producerMessage) =>
      producer.send(producerMessage),
    );
    await Promise.all(sendPromises);
    const partialApcAckPromises = collection.toAckPartialApc.map((messageId) =>
      partialApcConsumer.acknowledgeId(messageId),
    );
    const hfpAckPromises = collection.toAckHfp.map((messageId) =>
      hfpConsumer.acknowledgeId(messageId),
    );
    await Promise.all([...partialApcAckPromises, ...hfpAckPromises]);
  };
  return sendAndAck;
};

const keepSendingAndAcking = async (
  outboxQueue: Queue<MessageCollection>,
  sendAndAck: (collection: MessageCollection) => Promise<void>,
) => {
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const collection = await outboxQueue.pop();
    // Promises are resolved in order, so we do not need to await this. Awaiting
    // would decrease throughput.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sendAndAck(collection);
  }
  /* eslint-enable no-await-in-loop */
};

const keepProcessingMessages = async (
  logger: pino.Logger,
  producer: Pulsar.Producer,
  hfpConsumer: Pulsar.Consumer,
  partialApcConsumer: Pulsar.Consumer,
  config: ProcessingConfig,
): Promise<void> => {
  const inboxQueue = createPriorityQueue<QueueMessage>({
    comparable: compareMessages,
  });
  const outboxQueue = createQueue<MessageCollection>();
  const { advanceState } = initializeStateHandling(logger, config, outboxQueue);
  const sendAndAck = createSendAndAck(
    producer,
    hfpConsumer,
    partialApcConsumer,
  );
  const promises = [
    keepFeedingHfpMessages(logger, inboxQueue, hfpConsumer),
    keepFeedingPartialApcMessages(logger, inboxQueue, partialApcConsumer),
    keepAdvancingState(config, inboxQueue, advanceState),
    keepSendingAndAcking(outboxQueue, sendAndAck),
  ];
  // We expect both of the promises to stay pending.
  await Promise.any(promises);
};

export default keepProcessingMessages;
