/**
 * This module consumes from and produces to Pulsar. The module is also
 * responsible for running the deserialization and parsing of messages, for
 * acknowledging messages with the Pulsar client and for ordering the reading
 * and writing of messages during testing. This is the highest level business
 * logic.
 */

import type pino from "pino";
import type Pulsar from "pulsar-client";
import { Queue, createQueue } from "../dataStructures/queue";
import type {
  EndCondition,
  InboxQueueMessage,
  MessageCollection,
  ProcessingConfig,
  RuntimeResources,
} from "../types";
import {
  parseHfpPulsarMessage,
  parsePartialApcPulsarMessage,
} from "./messageParsing";
import initializeVehicleProsessing from "./vehicleProcessing";

const keepFeedingInboxQueueMessages = async (
  parse: (msg: Pulsar.Message) => InboxQueueMessage | undefined,
  pushIntoVehicleQueue: (msg: InboxQueueMessage) => Promise<void>,
  consumer: Pulsar.Consumer,
  nMessagesExpected?: number,
): Promise<number> => {
  let messageCount = 0;
  let nQueuePushes = 0;
  /* eslint-disable no-await-in-loop */
  while (nMessagesExpected === undefined || messageCount < nMessagesExpected) {
    const pulsarMessage = await consumer.receive();
    const message = parse(pulsarMessage);
    if (message != null) {
      await pushIntoVehicleQueue(message);
      nQueuePushes += 1;
    } else {
      // Acknowledge only unusable messages here.
      //
      // As we are not sure if awaiting would do a round-trip for every message,
      // let's not await here. Any errors will cause crashing and on restart we
      // might handle the same unusable message again. That is fine.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      consumer.acknowledge(pulsarMessage);
    }
    if (nMessagesExpected !== undefined) {
      messageCount += 1;
    }
  }
  /* eslint-enable no-await-in-loop */
  return nQueuePushes;
};

const createSendAndAck = (
  producer: Pulsar.Producer,
  hfpConsumer: Pulsar.Consumer,
  partialApcConsumer: Pulsar.Consumer,
): ((collection: MessageCollection) => Promise<number>) => {
  const sendAndAck = async (collection: MessageCollection): Promise<number> => {
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
    return collection.toSend.length;
  };
  return sendAndAck;
};

const keepSendingAndAcking = async (
  outboxQueue: Queue<MessageCollection>,
  sendAndAck: (collection: MessageCollection) => Promise<number>,
  nMessagesExpected?: number,
) => {
  let nMessagesSent = 0;
  const increaseCount = (nSent: number): void => {
    nMessagesSent += nSent;
  };
  /* eslint-disable no-await-in-loop */
  while (nMessagesExpected === undefined || nMessagesSent < nMessagesExpected) {
    const collection = await outboxQueue.pop();
    // Promises are resolved in order, so we do not need to await this. Awaiting
    // would decrease throughput.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const promise = sendAndAck(collection);
    if (nMessagesExpected !== undefined) {
      // While testing, we must await so the loop does not start again after
      // last message.
      await promise.then(increaseCount);
    }
  }
  /* eslint-enable no-await-in-loop */
};

const keepProcessingMessages = async (
  logger: pino.Logger,
  resources: Required<RuntimeResources>,
  config: ProcessingConfig,
  endCondition?: EndCondition,
): Promise<void> => {
  const outboxQueue = createQueue<MessageCollection>();
  const { pushIntoVehicleQueue, waitForHfpFeeding } =
    initializeVehicleProsessing(config, outboxQueue, endCondition);
  const parsePartialApc = (message: Pulsar.Message) =>
    parsePartialApcPulsarMessage(logger, message);
  const partialApcPromise = keepFeedingInboxQueueMessages(
    parsePartialApc,
    pushIntoVehicleQueue,
    resources.partialApcConsumer,
    endCondition?.nPartialApcMessages,
  );
  const parseHfp = (message: Pulsar.Message) =>
    parseHfpPulsarMessage(logger, message);
  const hfpPromise = keepFeedingInboxQueueMessages(
    parseHfp,
    pushIntoVehicleQueue,
    resources.hfpConsumer,
    endCondition?.nHfpMessages,
  );
  const sendAndAck = createSendAndAck(
    resources.producer,
    resources.hfpConsumer,
    resources.partialApcConsumer,
  );
  const sendAndAckPromise = keepSendingAndAcking(
    outboxQueue,
    sendAndAck,
    endCondition?.nApcMessages,
  );
  if (endCondition === undefined) {
    // Production branch without synchronization

    const promises = [partialApcPromise, hfpPromise, sendAndAckPromise];
    // We expect the promises to stay pending.
    await Promise.race(promises);
    throw new Error("The message processing promises should not get settled");
  } else {
    // Testing branch with synchronization

    await partialApcPromise;
    await hfpPromise;
    await Promise.all([waitForHfpFeeding(), sendAndAckPromise]);
  }
};

export default keepProcessingMessages;
