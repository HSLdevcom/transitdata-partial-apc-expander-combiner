import type Pulsar from "pulsar-client";
import { Queue } from "../dataStructures/queue";
import * as partialApc from "../quicktype/partialApc";
import {
  HfpInboxQueueMessage,
  MessageCollection,
  PartialApcInboxQueueMessage,
  PartialApcItem,
  ProcessingConfig,
  ServiceJourneyStop,
  UniqueVehicleId,
} from "../types";
import { createSleep } from "../util/sleep";
import { sumApcValues } from "./partialApcSumming";
import formProducerMessage from "./producerMessageForming";

const aggregatePartialApc = (
  toBeAggregated: PartialApcInboxQueueMessage[],
): PartialApcItem | undefined => {
  if (toBeAggregated.length > 0) {
    // TypeScript type checker does not understand that if .length > 0, then
    // there must be at least one item.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const lastElement = toBeAggregated[toBeAggregated.length - 1]!;
    const { mqttTopic, eventTimestamp } = lastElement;
    // As there must be at least one item, reduce does not need initialValue.
    const summed = toBeAggregated
      .map((message) => message.data)
      .reduce(sumApcValues);
    return {
      apc: summed,
      mqttTopic,
      eventTimestamp,
    };
  }
  return undefined;
};

const splitAlightingFromBoarding = (
  partialApcItem: PartialApcItem,
): { alighting: PartialApcItem; boarding: PartialApcItem } => {
  const alightingApc = partialApc.Convert.toApc(
    partialApc.Convert.apcToJson(partialApcItem.apc),
  );
  const boardingApc = partialApc.Convert.toApc(
    partialApc.Convert.apcToJson(partialApcItem.apc),
  );
  alightingApc.vehiclecounts.doorcounts =
    alightingApc.vehiclecounts.doorcounts.map((doorCount) => ({
      ...doorCount,
      count: doorCount.count.map((c) => ({ ...c, in: 0 })),
    }));
  boardingApc.vehiclecounts.doorcounts =
    boardingApc.vehiclecounts.doorcounts.map((doorCount) => ({
      ...doorCount,
      count: doorCount.count.map((c) => ({ ...c, out: 0 })),
    }));
  const nBoarded = boardingApc.vehiclecounts.doorcounts.reduce(
    (outerAccumulator, doorCount) =>
      outerAccumulator +
      doorCount.count.reduce(
        (innerAccumulator, c) => innerAccumulator + c.in,
        0,
      ),
    0,
  );
  alightingApc.vehiclecounts.vehicleload -= nBoarded;
  return {
    alighting: {
      apc: alightingApc,
      mqttTopic: partialApcItem.mqttTopic,
      eventTimestamp: partialApcItem.eventTimestamp,
    },
    boarding: {
      apc: boardingApc,
      mqttTopic: partialApcItem.mqttTopic,
      eventTimestamp: partialApcItem.eventTimestamp,
    },
  };
};

const createApcHandler = (
  config: ProcessingConfig,
  partialApcQueue: Queue<PartialApcInboxQueueMessage>,
  outboxQueue: Queue<MessageCollection>,
) => {
  const {
    sendWaitAfterStopChangeInSeconds,
    sendWaitAfterDeadRunStartInSeconds,
    vehicleCapacities,
    keepApcFromDeadRunEndInSeconds,
    defaultVehicleCapacity,
  } = config;
  const sendWaitAfterStopChangeInMilliseconds =
    1_000 * sendWaitAfterStopChangeInSeconds;
  const sendWaitAfterDeadRunStartInMilliseconds =
    1_000 * sendWaitAfterDeadRunStartInSeconds;
  const keepApcFromDeadRunEndInMilliseconds =
    1_000 * keepApcFromDeadRunEndInSeconds;

  let hfpMessageIdsToAcknowledge: Pulsar.MessageId[] = [];

  const getVehicleCapacity = (uniqueVehicleId: UniqueVehicleId): number =>
    vehicleCapacities.get(uniqueVehicleId) ?? defaultVehicleCapacity;

  const prepareHfpForAcknowledging = (
    hfpMessage: HfpInboxQueueMessage,
  ): void => {
    hfpMessageIdsToAcknowledge.push(hfpMessage.messageId);
  };

  const sendApcForStop = async (
    hfpMessage: HfpInboxQueueMessage,
    serviceJourneyStop: ServiceJourneyStop,
    isFromDeadRunStart: boolean,
  ): Promise<void> => {
    const toAckHfp = hfpMessageIdsToAcknowledge;
    toAckHfp.push(hfpMessage.messageId);
    hfpMessageIdsToAcknowledge = [];

    const messageCollection: MessageCollection = {
      toSend: [],
      toAckPartialApc: [],
      toAckHfp,
    };

    const delay = isFromDeadRunStart
      ? sendWaitAfterDeadRunStartInMilliseconds
      : sendWaitAfterStopChangeInMilliseconds;
    const partialApcWatermark = hfpMessage.eventTimestamp + delay;
    const nowInMilliseconds = Date.now();
    const diffInMilliseconds = partialApcWatermark - nowInMilliseconds;
    if (diffInMilliseconds > 0) {
      const { sleep } = createSleep();
      await sleep(diffInMilliseconds);
    }

    const toBeAggregated: PartialApcInboxQueueMessage[] = [];
    let isBeforeWatermark = true;
    while (isBeforeWatermark) {
      const peekedPartialApc = partialApcQueue.peek();
      if (
        peekedPartialApc != null &&
        peekedPartialApc.eventTimestamp < partialApcWatermark
      ) {
        // As the peeked value is defined, the popped value cannot be undefined.
        //
        // Use popSync instead of pop to collect all suitable partial APC
        // messages at once. The idea is to avoid race conditions and
        // interleaved queue consumption.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const partialApcMessage = partialApcQueue.popSync()!;
        toBeAggregated.push(partialApcMessage);
        messageCollection.toAckPartialApc.push(partialApcMessage.messageId);
      } else {
        isBeforeWatermark = false;
      }
    }
    const partialApcSummed = aggregatePartialApc(toBeAggregated);
    if (partialApcSummed != null) {
      const vehicleCapacity = getVehicleCapacity(hfpMessage.uniqueVehicleId);
      const pulsarProducerMessage = formProducerMessage(
        vehicleCapacity,
        hfpMessage.data,
        partialApcSummed,
        serviceJourneyStop,
      );
      messageCollection.toSend.push(pulsarProducerMessage);
    }
    outboxQueue.push(messageCollection);
  };

  const sendApcSplitBetweenServiceJourneys = async (
    previousHfpMessage: HfpInboxQueueMessage,
    currentHfpMessage: HfpInboxQueueMessage,
    previousStop: ServiceJourneyStop,
    currentStop: ServiceJourneyStop,
  ): Promise<void> => {
    const toAckHfp = hfpMessageIdsToAcknowledge;
    toAckHfp.push(currentHfpMessage.messageId);
    hfpMessageIdsToAcknowledge = [];

    const messageCollection: MessageCollection = {
      toSend: [],
      toAckPartialApc: [],
      toAckHfp,
    };

    const partialApcWatermark =
      currentHfpMessage.eventTimestamp + sendWaitAfterStopChangeInMilliseconds;
    const nowInMilliseconds = Date.now();
    const diffInMilliseconds = partialApcWatermark - nowInMilliseconds;
    if (diffInMilliseconds > 0) {
      const { sleep } = createSleep();
      await sleep(diffInMilliseconds);
    }

    const toBeAggregated: PartialApcInboxQueueMessage[] = [];
    let isBeforeWatermark = true;
    while (isBeforeWatermark) {
      const peekedPartialApc = partialApcQueue.peek();
      if (
        peekedPartialApc != null &&
        peekedPartialApc.eventTimestamp < partialApcWatermark
      ) {
        // As the peeked value is defined, the popped value cannot be undefined.
        //
        // Use popSync instead of pop to collect all suitable partial APC
        // messages at once. The idea is to avoid race conditions and
        // interleaved queue consumption.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const partialApcMessage = partialApcQueue.popSync()!;
        toBeAggregated.push(partialApcMessage);
        messageCollection.toAckPartialApc.push(partialApcMessage.messageId);
      } else {
        isBeforeWatermark = false;
      }
    }
    const partialApcSummed = aggregatePartialApc(toBeAggregated);
    if (partialApcSummed != null) {
      const vehicleCapacity = getVehicleCapacity(
        currentHfpMessage.uniqueVehicleId,
      );
      const { alighting, boarding } =
        splitAlightingFromBoarding(partialApcSummed);
      const alightingMessage = formProducerMessage(
        vehicleCapacity,
        previousHfpMessage.data,
        alighting,
        previousStop,
      );
      const boardingMessage = formProducerMessage(
        vehicleCapacity,
        currentHfpMessage.data,
        boarding,
        currentStop,
      );
      messageCollection.toSend.push(alightingMessage);
      messageCollection.toSend.push(boardingMessage);
    }
    outboxQueue.push(messageCollection);
  };

  const sendApcAfterLongDeadRun = async (
    hfpMessage: HfpInboxQueueMessage,
    serviceJourneyStop: ServiceJourneyStop,
  ): Promise<void> => {
    const toAckHfp = hfpMessageIdsToAcknowledge;
    toAckHfp.push(hfpMessage.messageId);
    hfpMessageIdsToAcknowledge = [];

    const messageCollection: MessageCollection = {
      toSend: [],
      toAckPartialApc: [],
      toAckHfp,
    };

    const partialApcBackwardsWatermark =
      hfpMessage.eventTimestamp - keepApcFromDeadRunEndInMilliseconds;
    const partialApcForwardsWatermark =
      hfpMessage.eventTimestamp + sendWaitAfterStopChangeInMilliseconds;
    const nowInMilliseconds = Date.now();
    const diffInMilliseconds = partialApcForwardsWatermark - nowInMilliseconds;
    if (diffInMilliseconds > 0) {
      const { sleep } = createSleep();
      await sleep(diffInMilliseconds);
    }

    const toBeAggregated: PartialApcInboxQueueMessage[] = [];
    let isBeforeWatermark = true;
    while (isBeforeWatermark) {
      const peekedPartialApc = partialApcQueue.peek();
      if (
        peekedPartialApc != null &&
        peekedPartialApc.eventTimestamp < partialApcForwardsWatermark
      ) {
        // As the peeked value is defined, the popped value cannot be undefined.
        //
        // Use popSync instead of pop to collect all suitable partial APC
        // messages at once. The idea is to avoid race conditions and
        // interleaved queue consumption.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const partialApcMessage = partialApcQueue.popSync()!;
        if (partialApcMessage.eventTimestamp >= partialApcBackwardsWatermark) {
          toBeAggregated.push(partialApcMessage);
        }
        messageCollection.toAckPartialApc.push(partialApcMessage.messageId);
      } else {
        isBeforeWatermark = false;
      }
    }
    const partialApcSummed = aggregatePartialApc(toBeAggregated);
    if (partialApcSummed != null) {
      const vehicleCapacity = getVehicleCapacity(hfpMessage.uniqueVehicleId);
      const pulsarProducerMessage = formProducerMessage(
        vehicleCapacity,
        hfpMessage.data,
        partialApcSummed,
        serviceJourneyStop,
      );
      messageCollection.toSend.push(pulsarProducerMessage);
    }
    outboxQueue.push(messageCollection);
  };

  return {
    prepareHfpForAcknowledging,
    sendApcForStop,
    sendApcSplitBetweenServiceJourneys,
    sendApcAfterLongDeadRun,
  };
};

export default createApcHandler;
