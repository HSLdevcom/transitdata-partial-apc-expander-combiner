import {
  InboxQueueMessage,
  InboxQueueMessageOrPoisonPill,
  VehicleQueueMessage,
} from "../types";

export const compareMessages = (
  a: InboxQueueMessage,
  b: InboxQueueMessage,
): number => {
  const diff = a.eventTimestamp - b.eventTimestamp;
  if (diff !== 0) {
    return diff;
  }

  const aType = a.type;
  const bType = b.type;
  if (aType === "partialApc" && bType === "hfp") {
    return -1;
  }
  if (aType === "hfp" && bType === "partialApc") {
    return 1;
  }

  return a.messageId.toString().localeCompare(b.messageId.toString(), "en");
};

export const compareMessagesOrPoisonPill = (
  a: InboxQueueMessageOrPoisonPill,
  b: InboxQueueMessageOrPoisonPill,
): number => {
  if (b === "STOP") {
    return -1;
  }
  if (a === "STOP") {
    return 1;
  }

  const diff = a.eventTimestamp - b.eventTimestamp;
  if (diff !== 0) {
    return diff;
  }

  const aType = a.type;
  const bType = b.type;
  if (aType === "partialApc" && bType === "hfp") {
    return -1;
  }
  if (aType === "hfp" && bType === "partialApc") {
    return 1;
  }

  return a.messageId.toString().localeCompare(b.messageId.toString(), "en");
};

export const compareVehicleQueueMessages = (
  a: VehicleQueueMessage,
  b: VehicleQueueMessage,
): number => {
  const aTimestamp = a.type === "hfp" ? a.effectTimestamp : a.eventTimestamp;
  const bTimestamp = b.type === "hfp" ? b.effectTimestamp : b.eventTimestamp;
  const timestampDiff = aTimestamp - bTimestamp;
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  const aType = a.type;
  const bType = b.type;
  if (aType === "partialApc" && bType === "hfp") {
    return -1;
  }
  if (aType === "hfp" && bType === "partialApc") {
    return 1;
  }

  const aMessageId =
    a.type === "hfp" ? a.wrapped.messageId.toString() : a.messageId.toString();
  const bMessageId =
    b.type === "hfp" ? b.wrapped.messageId.toString() : b.messageId.toString();
  return aMessageId.localeCompare(bMessageId, "en");
};
