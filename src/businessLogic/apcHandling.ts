/**
 * This module is called by the XState actor of each vehicle to send APC
 * messages and to acknowledge the corresponding source data messages. If no
 * partial APC data is available when sending functions are called, only
 * acknowledgments will be done.
 */

import type Pulsar from "pulsar-client";
import { Queue } from "../dataStructures/queue";
import * as partialApc from "../quicktype/partialApc";
import {
  HfpInboxQueueMessage,
  HfpMessageAndStop,
  HfpMessageAndStopPair,
  MessageCollection,
  NonNullableFields,
  PartialApcInboxQueueMessage,
  PartialApcItem,
  ProcessingConfig,
  UniqueVehicleId,
} from "../types";
import { createSleep } from "../util/sleep";
import { sumApcValues } from "./partialApcSumming";
import formProducerMessage from "./producerMessageForming";

const calculateWatermarks = ({
  eventTimestamp,
  backwardsWatermarkIntervalInMilliseconds,
  forwardsWatermarkIntervalInMilliseconds,
}: {
  eventTimestamp: number;
  backwardsWatermarkIntervalInMilliseconds: number | undefined;
  forwardsWatermarkIntervalInMilliseconds: number;
}): {
  backwardsWatermark: number;
  forwardsWatermark: number;
} => {
  const startOfUnixTime = 0;
  const backwardsWatermark =
    backwardsWatermarkIntervalInMilliseconds === undefined
      ? startOfUnixTime
      : eventTimestamp - backwardsWatermarkIntervalInMilliseconds;
  const forwardsWatermark =
    eventTimestamp + forwardsWatermarkIntervalInMilliseconds;
  return { backwardsWatermark, forwardsWatermark };
};

const waitIfInFuture = async (forwardsWatermark: number): Promise<void> => {
  const nowInMilliseconds = Date.now();
  const waitInMilliseconds = forwardsWatermark - nowInMilliseconds;
  if (waitInMilliseconds > 0) {
    const { sleep } = createSleep();
    await sleep(waitInMilliseconds);
  }
};

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

  const readFromPartialApcQueue = ({
    backwardsWatermark,
    forwardsWatermark,
  }: {
    backwardsWatermark: number;
    forwardsWatermark: number;
  }): {
    partialApcSummed: PartialApcItem | undefined;
    toAckPartialApc: Pulsar.MessageId[];
  } => {
    const toBeAggregated: PartialApcInboxQueueMessage[] = [];
    const toAckPartialApc: Pulsar.MessageId[] = [];
    let isBeforeForwardsWatermark = true;
    while (isBeforeForwardsWatermark) {
      const peekedPartialApc = partialApcQueue.peekSync();
      if (
        peekedPartialApc != null &&
        peekedPartialApc.eventTimestamp < forwardsWatermark
      ) {
        // As the peeked value is defined, the popped value cannot be undefined.
        //
        // Use popSync instead of pop to collect all suitable partial APC
        // messages at once. The idea is to avoid race conditions and
        // interleaved queue consumption.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const partialApcMessage = partialApcQueue.popSync()!;
        if (partialApcMessage.eventTimestamp >= backwardsWatermark) {
          toBeAggregated.push(partialApcMessage);
        }
        toAckPartialApc.push(partialApcMessage.messageId);
      } else {
        isBeforeForwardsWatermark = false;
      }
    }
    const partialApcSummed = aggregatePartialApc(toBeAggregated);
    return { partialApcSummed, toAckPartialApc };
  };

  const formWhatToSend = ({
    partialApcSummed,
    previous,
    current,
  }: {
    partialApcSummed: PartialApcItem | undefined;
    previous: HfpMessageAndStop | undefined;
    current: HfpMessageAndStop;
  }): Pulsar.ProducerMessage[] => {
    const toSend: Pulsar.ProducerMessage[] = [];
    if (partialApcSummed != null) {
      const vehicleCapacity = getVehicleCapacity(
        current.hfpMessage.uniqueVehicleId,
      );
      const shouldSplit = previous != null;
      if (shouldSplit) {
        const { alighting, boarding } =
          splitAlightingFromBoarding(partialApcSummed);
        const alightingMessage = formProducerMessage(
          vehicleCapacity,
          previous.hfpMessage.data,
          alighting,
          previous.serviceJourneyStop,
        );
        const boardingMessage = formProducerMessage(
          vehicleCapacity,
          current.hfpMessage.data,
          boarding,
          current.serviceJourneyStop,
        );
        toSend.push(alightingMessage);
        toSend.push(boardingMessage);
      } else {
        const pulsarProducerMessage = formProducerMessage(
          vehicleCapacity,
          current.hfpMessage.data,
          partialApcSummed,
          current.serviceJourneyStop,
        );
        toSend.push(pulsarProducerMessage);
      }
    }
    return toSend;
  };

  const sendApc = async ({
    backwardsWatermarkIntervalInMilliseconds,
    forwardsWatermarkIntervalInMilliseconds,
    hfpMessagesAndStops,
  }: {
    backwardsWatermarkIntervalInMilliseconds: number | undefined;
    forwardsWatermarkIntervalInMilliseconds: number;
    hfpMessagesAndStops: HfpMessageAndStopPair;
  }): Promise<void> => {
    // Decide HFP MessageIds to ack before any awaits to avoid race conditions.
    const toAckHfp = hfpMessageIdsToAcknowledge;
    hfpMessageIdsToAcknowledge = [];

    const { previous, current } = hfpMessagesAndStops;
    const { backwardsWatermark, forwardsWatermark } = calculateWatermarks({
      eventTimestamp: current.hfpMessage.eventTimestamp,
      backwardsWatermarkIntervalInMilliseconds,
      forwardsWatermarkIntervalInMilliseconds,
    });
    await waitIfInFuture(forwardsWatermark);
    const { partialApcSummed, toAckPartialApc } = readFromPartialApcQueue({
      backwardsWatermark,
      forwardsWatermark,
    });
    const toSend = formWhatToSend({ partialApcSummed, previous, current });
    const messageCollection: MessageCollection = {
      toSend,
      toAckPartialApc,
      toAckHfp,
    };
    outboxQueue.push(messageCollection);
  };

  const sendApcMidServiceJourney = async (
    hfpMessageAndStop: HfpMessageAndStop,
  ): Promise<void> => {
    await sendApc({
      backwardsWatermarkIntervalInMilliseconds: undefined,
      forwardsWatermarkIntervalInMilliseconds:
        sendWaitAfterStopChangeInMilliseconds,
      hfpMessagesAndStops: {
        previous: undefined,
        current: hfpMessageAndStop,
      },
    });
  };

  const sendApcFromBeginningOfLongDeadRun = async (
    hfpMessageAndStop: HfpMessageAndStop,
  ): Promise<void> => {
    await sendApc({
      backwardsWatermarkIntervalInMilliseconds: undefined,
      forwardsWatermarkIntervalInMilliseconds:
        sendWaitAfterDeadRunStartInMilliseconds,
      hfpMessagesAndStops: {
        previous: undefined,
        current: hfpMessageAndStop,
      },
    });
  };

  const sendApcSplitBetweenServiceJourneys = async (
    hfpMessagesAndStops: NonNullableFields<HfpMessageAndStopPair>,
  ): Promise<void> => {
    await sendApc({
      backwardsWatermarkIntervalInMilliseconds: undefined,
      forwardsWatermarkIntervalInMilliseconds:
        sendWaitAfterStopChangeInMilliseconds,
      hfpMessagesAndStops,
    });
  };

  const sendApcAfterLongDeadRun = async (
    hfpMessageAndStop: HfpMessageAndStop,
  ): Promise<void> => {
    await sendApc({
      backwardsWatermarkIntervalInMilliseconds:
        keepApcFromDeadRunEndInMilliseconds,
      forwardsWatermarkIntervalInMilliseconds:
        sendWaitAfterStopChangeInMilliseconds,
      hfpMessagesAndStops: {
        previous: undefined,
        current: hfpMessageAndStop,
      },
    });
  };

  return {
    prepareHfpForAcknowledging,
    sendApcMidServiceJourney,
    sendApcFromBeginningOfLongDeadRun,
    sendApcSplitBetweenServiceJourneys,
    sendApcAfterLongDeadRun,
  };
};

export default createApcHandler;
