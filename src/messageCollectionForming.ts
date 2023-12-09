import { MutexInterface } from "async-mutex";
import { PriorityQueue } from "./dataStructures/priorityQueue";
import { Queue } from "./dataStructures/queue";
import formProducerMessage from "./hfpPartialApcCombining";
import { sumApcValues } from "./partialApcSumming";
import * as partialApc from "./quicktype/partialApc";
import {
  CacheCommand,
  CropCommand,
  HfpVehicleQueueMessage,
  MessageCollection,
  MessageCollectionState,
  PartialApcInboxQueueMessage,
  PartialApcItem,
  PartialApcVehicleQueueMessage,
  SendCommand,
  UniqueVehicleId,
  VehicleQueueMessage,
} from "./types";

const addUpApc = (
  partialApcSummed: PartialApcItem | undefined,
  message: PartialApcInboxQueueMessage,
): PartialApcItem => {
  if (partialApcSummed === undefined) {
    return {
      apc: message.data,
      mqttTopic: message.mqttTopic,
      eventTimestamp: message.eventTimestamp,
    };
  }
  return {
    apc: sumApcValues(partialApcSummed.apc, message.data),
    mqttTopic: message.mqttTopic,
    eventTimestamp: message.eventTimestamp,
  };
};

const splitAlightingFromBoarding = (partialApcItem: PartialApcItem) => {
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

const handlePartialApcMessage = (
  state: MessageCollectionState,
  message: PartialApcVehicleQueueMessage,
): void => {
  state.partialApcs.push(message);
  state.collection.toAckPartialApc.push(message.messageId);
};

/* eslint-disable no-param-reassign */
const handleCacheCommand = (
  state: MessageCollectionState,
  message: HfpVehicleQueueMessage,
  command: CacheCommand,
): void => {
  const commandValue = command.value;
  switch (commandValue) {
    case "cacheMostRecent":
      state.latestHfp = message.wrapped;
      break;
    case "cacheAlsoPrevious":
      state.previousVehicleJourney = state.latestHfp;
      state.latestHfp = message.wrapped;
      break;
    default: {
      const exhaustiveCheck: never = commandValue;
      throw new Error(String(exhaustiveCheck));
    }
  }
};
/* eslint-enable no-param-reassign */

const handleCropCommand = (
  keepApcFromDeadrunEndInMilliseconds: number,
  state: MessageCollectionState,
  message: HfpVehicleQueueMessage,
  command: CropCommand,
): void => {
  const dropBeforeInMilliseconds =
    message.wrapped.eventTimestamp - keepApcFromDeadrunEndInMilliseconds;
  const commandValue = command.value;
  switch (commandValue) {
    case "cropToRecentApcMessages":
      // eslint-disable-next-line no-param-reassign
      state.partialApcs = state.partialApcs.filter(
        (pApc) => pApc.eventTimestamp >= dropBeforeInMilliseconds,
      );
      break;
    default: {
      const exhaustiveCheck: never = commandValue;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const handleSendCommandSameVehicleJourney = (
  state: MessageCollectionState,
  message: HfpVehicleQueueMessage,
  command: SendCommand,
  vehicleCapacity: number,
  partialApcSummed: PartialApcItem,
): void => {
  let producerMessage;
  const mergingMessage = state.latestHfp ?? message.wrapped;
  const commandValue = command.value;
  switch (commandValue) {
    case "sendWithThisStopMetadata":
      producerMessage = formProducerMessage(
        vehicleCapacity,
        message.wrapped.data,
        partialApcSummed,
        false,
      );
      break;
    case "sendWithCachedStopMetadata":
      producerMessage = formProducerMessage(
        vehicleCapacity,
        mergingMessage.data,
        partialApcSummed,
        // It is preferable to use the topic stop in most cases.
        true,
      );
      break;
    default: {
      const exhaustiveCheck: never = commandValue;
      throw new Error(String(exhaustiveCheck));
    }
  }
  state.collection.toSend.push(producerMessage);
};

const handleSendCommandTwoVehicleJourneys = (
  state: MessageCollectionState,
  message: HfpVehicleQueueMessage,
  command: SendCommand,
  vehicleCapacity: number,
  partialApcSummed: PartialApcItem,
): void => {
  if (state.previousVehicleJourney === undefined) {
    throw Error(
      "In handleSendCommandTwoVehicleJourneys state.previousVehicleJourney must never be undefined.",
    );
  }
  const mergingMessage = state.latestHfp ?? message.wrapped;
  const { alighting, boarding } = splitAlightingFromBoarding(partialApcSummed);
  const alightingMessage = formProducerMessage(
    vehicleCapacity,
    state.previousVehicleJourney.data,
    alighting,
    true,
  );
  let boardingMessage;
  const commandValue = command.value;
  switch (commandValue) {
    case "sendWithThisStopMetadata":
      boardingMessage = formProducerMessage(
        vehicleCapacity,
        message.wrapped.data,
        boarding,
        false,
      );
      break;
    case "sendWithCachedStopMetadata":
      boardingMessage = formProducerMessage(
        vehicleCapacity,
        mergingMessage.data,
        boarding,
        // It is preferable to use the topic stop in most cases.
        true,
      );
      break;
    default: {
      const exhaustiveCheck: never = commandValue;
      throw new Error(String(exhaustiveCheck));
    }
  }
  state.collection.toSend.push(alightingMessage);
  state.collection.toSend.push(boardingMessage);
};

const handleSendCommand = (
  getVehicleCapacity: (uniqueVehicleId: UniqueVehicleId) => number,
  state: MessageCollectionState,
  message: HfpVehicleQueueMessage,
  command: SendCommand,
): void => {
  if (state.partialApcs.length > 0) {
    // We have something to send.

    const vehicleCapacity = getVehicleCapacity(message.wrapped.uniqueVehicleId);
    // TypeScript type checker does not understand that if .length > 0, then
    // there must be a first item.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstPartialApc = state.partialApcs.shift()!;
    const initialValue: PartialApcItem = {
      apc: firstPartialApc.data,
      mqttTopic: firstPartialApc.mqttTopic,
      eventTimestamp: firstPartialApc.eventTimestamp,
    };
    const partialApcSummed = state.partialApcs.reduce(addUpApc, initialValue);
    if (state.previousVehicleJourney === undefined) {
      handleSendCommandSameVehicleJourney(
        state,
        message,
        command,
        vehicleCapacity,
        partialApcSummed,
      );
    } else {
      handleSendCommandTwoVehicleJourneys(
        state,
        message,
        command,
        vehicleCapacity,
        partialApcSummed,
      );
    }
  }
  // eslint-disable-next-line no-param-reassign
  state.isMessageCollectionFormed = true;
};

const handleHfpMessage = (
  keepApcFromDeadrunEndInMilliseconds: number,
  getVehicleCapacity: (uniqueVehicleId: UniqueVehicleId) => number,
  state: MessageCollectionState,
  message: HfpVehicleQueueMessage,
): void => {
  // eslint-disable-next-line no-restricted-syntax
  for (const command of message.commands) {
    const commandType = command.type;
    switch (commandType) {
      case "cache":
        handleCacheCommand(state, message, command);
        break;
      case "crop":
        handleCropCommand(
          keepApcFromDeadrunEndInMilliseconds,
          state,
          message,
          command,
        );
        break;
      case "send":
        handleSendCommand(getVehicleCapacity, state, message, command);
        break;
      default: {
        const exhaustiveCheck: never = commandType;
        throw new Error(String(exhaustiveCheck));
      }
    }
  }
  state.collection.toAckHfp.push(message.wrapped.messageId);
};

const createMessageCollectionFormer = (
  getVehicleCapacity: (uniqueVehicleId: UniqueVehicleId) => number,
  keepApcFromDeadrunEndInSeconds: number,
  outboxQueue: Queue<MessageCollection>,
  reportSent?: (toAdd: number) => void,
) => {
  const keepApcFromDeadrunEndInMilliseconds =
    1_000 * keepApcFromDeadrunEndInSeconds;

  const formMessageCollection = async (
    mutex: MutexInterface,
    vehicleQueue: PriorityQueue<VehicleQueueMessage>,
  ): Promise<void> => {
    // As this function is called from timers, there might be other calls running
    // before this one has resolved. Use a mutex to force order.
    await mutex.runExclusive(async () => {
      const state: MessageCollectionState = {
        collection: {
          toSend: [],
          toAckPartialApc: [],
          toAckHfp: [],
        },
        isMessageCollectionFormed: false,
        previousVehicleJourney: undefined,
        latestHfp: undefined,
        partialApcs: [],
      };
      while (!state.isMessageCollectionFormed) {
        // eslint-disable-next-line no-await-in-loop
        const message = await vehicleQueue.pop();
        const messageType = message.type;
        switch (messageType) {
          case "partialApc":
            handlePartialApcMessage(state, message);
            break;
          case "hfp":
            handleHfpMessage(
              keepApcFromDeadrunEndInMilliseconds,
              getVehicleCapacity,
              state,
              message,
            );
            break;
          default: {
            const exhaustiveCheck: never = messageType;
            throw new Error(String(exhaustiveCheck));
          }
        }
      }
      outboxQueue.push(state.collection);
      reportSent?.(state.collection.toSend.length);
    });
  };
  return formMessageCollection;
};

export default createMessageCollectionFormer;
