import { MarkedQueueMessage, QueueMessage } from "./types";

export const compareMessages = (a: QueueMessage, b: QueueMessage): number => {
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

export const compareMarkedMessages = (
  a: MarkedQueueMessage,
  b: MarkedQueueMessage,
): number => {
  const aTimestamp =
    a.type === "marker" ? a.wrapped.eventTimestamp : a.eventTimestamp;
  const bTimestamp =
    b.type === "marker" ? b.wrapped.eventTimestamp : b.eventTimestamp;
  const timestampDiff = aTimestamp - bTimestamp;
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  const aType = a.type;
  const bType = b.type;
  if (aType === "partialApc" && bType === "marker") {
    return -1;
  }
  if (aType === "marker" && bType === "partialApc") {
    return 1;
  }

  const aMessageId =
    a.type === "marker"
      ? a.wrapped.messageId.toString()
      : a.messageId.toString();
  const bMessageId =
    b.type === "marker"
      ? b.wrapped.messageId.toString()
      : b.messageId.toString();
  return aMessageId.localeCompare(bMessageId, "en");
};
