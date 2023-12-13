import assert from "node:assert";
import { hfp } from "./protobuf/hfp";
import type {
  FirstStopOnNewVehicleJourneyState,
  HfpInboxQueueMessage,
  HfpVehicleJourneyInboxQueueMessage,
  MidVehicleJourneyState,
  PostVehicleQueueCommand,
  PreVehicleQueueCommand,
  ShortDeadrunState,
  TransitionOutput,
  VehicleContext,
} from "./types";

const isDeepStrictEqual = <T>(a: T, b: T): boolean => {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Whether the message can trigger forming a MessageCollection.
 */
const isSendTriggeringEvent = (message: HfpInboxQueueMessage): boolean =>
  message.journeyType === hfp.Topic.JourneyType.journey &&
  [hfp.Topic.EventType.PDE, hfp.Topic.EventType.DEP].includes(
    message.eventType,
  );

/* eslint-disable no-param-reassign */
const handleFromInitiallyUnknown = (
  vehicleContext: VehicleContext,
  message: HfpInboxQueueMessage,
): TransitionOutput => {
  const { journeyType } = message;
  switch (journeyType) {
    case hfp.Topic.JourneyType.deadrun:
      vehicleContext.vehicleState = { type: "longDeadrun" };
      return { preCommand: "ignoreAndAck", postCommands: [] };
    case hfp.Topic.JourneyType.journey:
      vehicleContext.vehicleState = {
        type: "midVehicleJourney",
        currentVehicleJourneyState: message.currentVehicleJourneyState,
      };
      if (isSendTriggeringEvent(message)) {
        return {
          preCommand: "sendOnJourney",
          postCommands: [{ type: "send", value: "sendWithThisStopMetadata" }],
        };
      }
      return {
        preCommand: "onlyCollect",
        postCommands: [{ type: "cache", value: "cacheMostRecent" }],
      };
    default: {
      const exhaustiveCheck: never = journeyType;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const handleFromMidVehicleJourneyToDeadrun = (
  vehicleContext: VehicleContext,
): TransitionOutput => {
  const oldState = vehicleContext.vehicleState as MidVehicleJourneyState;
  vehicleContext.vehicleState = {
    type: "shortDeadrun",
    previousVehicleJourneyState: oldState.currentVehicleJourneyState,
  };
  return {
    preCommand: "potentiallySendOnDeadrun",
    postCommands: [{ type: "send", value: "sendWithCachedStopMetadata" }],
  };
};

const handleFromVehicleJourneyToSameBothStops = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  // vehicleContext.vehicleState stays identical.
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  if (isSendOnJourneyAlreadyAllowed && isMessageEventTypeSendTriggering) {
    return {
      preCommand: "sendOnJourney",
      postCommands: [{ type: "send", value: "sendWithThisStopMetadata" }],
    };
  }
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromVehicleJourneyToDifferentCurrentStopAndSameNextStop = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromVehicleJourneyToDifferentBothStops = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  if (isSendOnJourneyAlreadyAllowed) {
    return {
      preCommand: "sendOnJourney",
      postCommands: [{ type: "send", value: "sendWithCachedStopMetadata" }],
    };
  }
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromVehicleJourneyToSameCurrentStopAndDifferentNextStop = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  if (isSendOnJourneyAlreadyAllowed) {
    if (isMessageEventTypeSendTriggering) {
      return {
        preCommand: "sendOnJourney",
        postCommands: [{ type: "send", value: "sendWithThisStopMetadata" }],
      };
    }
    return {
      preCommand: "sendOnJourney",
      postCommands: [{ type: "send", value: "sendWithCachedStopMetadata" }],
    };
  }
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromMidVehicleJourneyToDifferentVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "firstStopOnNewVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  let preCommand: PreVehicleQueueCommand = "onlyCollect";
  const postCommands: PostVehicleQueueCommand[] = [
    { type: "cache", value: "cacheAlsoPrevious" },
  ];
  if (isSendOnJourneyAlreadyAllowed && isMessageEventTypeSendTriggering) {
    preCommand = "sendOnJourney";
    postCommands.push({ type: "send", value: "sendWithCachedStopMetadata" });
  }
  return { preCommand, postCommands };
};

const handleFromMidVehicleJourneyToVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  const messageState = message.currentVehicleJourneyState;
  const messageVehicleJourney = messageState.vehicleJourney;
  const messageCurrentStop = messageState.stopState.currentStop;
  const messageNextStop = messageState.stopState.nextStop;
  const state = vehicleContext.vehicleState as MidVehicleJourneyState;
  const storedState = state.currentVehicleJourneyState;
  const storedVehicleJourney = storedState.vehicleJourney;
  const storedCurrentStop = storedState.stopState.currentStop;
  const storedNextStop = storedState.stopState.nextStop;
  const isSameVehicleJourney = isDeepStrictEqual(
    messageVehicleJourney,
    storedVehicleJourney,
  );
  const isSameCurrentStop = messageCurrentStop === storedCurrentStop;
  const isSameNextStop = messageNextStop === storedNextStop;
  if (isSameVehicleJourney) {
    if (isSameCurrentStop && isSameNextStop) {
      return handleFromVehicleJourneyToSameBothStops(vehicleContext, message);
    }
    if (isSameCurrentStop && !isSameNextStop) {
      return handleFromVehicleJourneyToSameCurrentStopAndDifferentNextStop(
        vehicleContext,
        message,
      );
    }
    if (!isSameCurrentStop && isSameNextStop) {
      return handleFromVehicleJourneyToDifferentCurrentStopAndSameNextStop(
        vehicleContext,
        message,
      );
    }
    return handleFromVehicleJourneyToDifferentBothStops(
      vehicleContext,
      message,
    );
  }
  return handleFromMidVehicleJourneyToDifferentVehicleJourney(
    vehicleContext,
    message,
  );
};

const handleFromMidVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpInboxQueueMessage,
): TransitionOutput => {
  const { journeyType } = message;
  switch (journeyType) {
    case hfp.Topic.JourneyType.deadrun:
      return handleFromMidVehicleJourneyToDeadrun(vehicleContext);
    case hfp.Topic.JourneyType.journey:
      return handleFromMidVehicleJourneyToVehicleJourney(
        vehicleContext,
        message,
      );
    default: {
      const exhaustiveCheck: never = journeyType;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const handleFromFirstStopOnNewVehicleJourneyToDeadrun = (
  vehicleContext: VehicleContext,
): TransitionOutput => {
  const oldState =
    vehicleContext.vehicleState as FirstStopOnNewVehicleJourneyState;
  vehicleContext.vehicleState = {
    type: "shortDeadrun",
    previousVehicleJourneyState: oldState.currentVehicleJourneyState,
  };
  return {
    preCommand: "potentiallySendOnDeadrun",
    postCommands: [{ type: "send", value: "sendWithCachedStopMetadata" }],
  };
};

const handleFromFirstStopOnNewVehicleJourneyToDifferentVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "firstStopOnNewVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  let preCommand: PreVehicleQueueCommand = "onlyCollect";
  const postCommands: PostVehicleQueueCommand[] = [
    // This is the only difference to how from MidVehicleJourneyState is
    // handled. If we essentially throw away the new vehicle journey in the
    // middle, hopefully we can salvage some situations where drivers first
    // select the wrong vehicle journey.
    { type: "cache", value: "cacheMostRecent" },
  ];
  if (isSendOnJourneyAlreadyAllowed && isMessageEventTypeSendTriggering) {
    preCommand = "sendOnJourney";
    postCommands.push({ type: "send", value: "sendWithCachedStopMetadata" });
  }
  return { preCommand, postCommands };
};

const handleFromFirstStopOnNewVehicleJourneyToVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  const messageState = message.currentVehicleJourneyState;
  const messageVehicleJourney = messageState.vehicleJourney;
  const messageCurrentStop = messageState.stopState.currentStop;
  const messageNextStop = messageState.stopState.nextStop;
  const state =
    vehicleContext.vehicleState as FirstStopOnNewVehicleJourneyState;
  const storedState = state.currentVehicleJourneyState;
  const storedVehicleJourney = storedState.vehicleJourney;
  const storedCurrentStop = storedState.stopState.currentStop;
  const storedNextStop = storedState.stopState.nextStop;
  const isSameVehicleJourney = isDeepStrictEqual(
    messageVehicleJourney,
    storedVehicleJourney,
  );
  const isSameCurrentStop = messageCurrentStop === storedCurrentStop;
  const isSameNextStop = messageNextStop === storedNextStop;
  if (isSameVehicleJourney) {
    if (isSameCurrentStop && isSameNextStop) {
      return handleFromVehicleJourneyToSameBothStops(vehicleContext, message);
    }
    if (isSameCurrentStop && !isSameNextStop) {
      return handleFromVehicleJourneyToSameCurrentStopAndDifferentNextStop(
        vehicleContext,
        message,
      );
    }
    if (!isSameCurrentStop && isSameNextStop) {
      return handleFromVehicleJourneyToSameBothStops(vehicleContext, message);
    }
    return handleFromVehicleJourneyToDifferentBothStops(
      vehicleContext,
      message,
    );
  }
  return handleFromFirstStopOnNewVehicleJourneyToDifferentVehicleJourney(
    vehicleContext,
    message,
  );
};

const handleFromFirstStopOnNewVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpInboxQueueMessage,
): TransitionOutput => {
  const { journeyType } = message;
  switch (journeyType) {
    case hfp.Topic.JourneyType.deadrun:
      return handleFromFirstStopOnNewVehicleJourneyToDeadrun(vehicleContext);
    case hfp.Topic.JourneyType.journey:
      return handleFromFirstStopOnNewVehicleJourneyToVehicleJourney(
        vehicleContext,
        message,
      );
    default: {
      const exhaustiveCheck: never = journeyType;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const handleFromShortDeadrunToDeadrun = (
  vehicleContext: VehicleContext,
): TransitionOutput => {
  const { deadrunTriggerTimestamp } = vehicleContext;
  if (deadrunTriggerTimestamp === undefined) {
    throw Error(
      `deadrunTriggerTimestamp cannot be undefined when on a short deadrun. VehicleContext: ${JSON.stringify(
        vehicleContext,
      )}`,
    );
  }
  if (deadrunTriggerTimestamp < Date.now()) {
    vehicleContext.deadrunTriggerTimestamp = undefined;
    vehicleContext.vehicleState = { type: "longDeadrun" };
  }
  return {
    preCommand: "ignoreAndAck",
    postCommands: [],
  };
};

const handleFromShortDeadrunToSameBothStops = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  const oldState = vehicleContext.vehicleState as ShortDeadrunState;
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: oldState.previousVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  if (isSendOnJourneyAlreadyAllowed && isMessageEventTypeSendTriggering) {
    return {
      preCommand: "sendOnJourney",
      postCommands: [{ type: "send", value: "sendWithThisStopMetadata" }],
    };
  }
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromShortDeadrunToDifferentCurrentStop = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  const oldState = vehicleContext.vehicleState as ShortDeadrunState;
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: oldState.previousVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  if (isSendOnJourneyAlreadyAllowed) {
    return {
      preCommand: "sendOnJourney",
      postCommands: [{ type: "send", value: "sendWithCachedStopMetadata" }],
    };
  }
  // This does not seem like the optimal solution but we are handling data loss
  // here. This code path should be rarely taken.
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromShortDeadrunToDifferentNextStop = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  const oldState = vehicleContext.vehicleState as ShortDeadrunState;
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: oldState.previousVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  if (isSendOnJourneyAlreadyAllowed) {
    if (isMessageEventTypeSendTriggering) {
      return {
        preCommand: "sendOnJourney",
        postCommands: [{ type: "send", value: "sendWithThisStopMetadata" }],
      };
    }
    return {
      preCommand: "sendOnJourney",
      postCommands: [{ type: "send", value: "sendWithCachedStopMetadata" }],
    };
  }
  // This does not seem like the optimal solution but we are handling data loss
  // here. This code path should be rarely taken.
  return {
    preCommand: "onlyCollect",
    postCommands: [{ type: "cache", value: "cacheMostRecent" }],
  };
};

const handleFromShortDeadrunToDifferentVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "firstStopOnNewVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  let preCommand: PreVehicleQueueCommand = "onlyCollect";
  const postCommands: PostVehicleQueueCommand[] = [
    { type: "cache", value: "cacheAlsoPrevious" },
  ];
  if (isSendOnJourneyAlreadyAllowed && isMessageEventTypeSendTriggering) {
    preCommand = "sendOnJourney";
    postCommands.push({ type: "send", value: "sendWithCachedStopMetadata" });
  }
  return { preCommand, postCommands };
};

const handleFromShortDeadrunToVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  // Cancel the trigger from deadrun start and cause that deadrun message to be
  // acked away.
  vehicleContext.abortDeadrunTrigger?.();
  vehicleContext.abortDeadrunTrigger = undefined;
  vehicleContext.deadrunTriggerTimestamp = undefined;
  const messageState = message.currentVehicleJourneyState;
  const messageVehicleJourney = messageState.vehicleJourney;
  const messageCurrentStop = messageState.stopState.currentStop;
  const messageNextStop = messageState.stopState.nextStop;
  const state = vehicleContext.vehicleState as ShortDeadrunState;
  const storedState = state.previousVehicleJourneyState;
  const storedVehicleJourney = storedState.vehicleJourney;
  const storedCurrentStop = storedState.stopState.currentStop;
  const storedNextStop = storedState.stopState.nextStop;
  const isSameVehicleJourney = isDeepStrictEqual(
    messageVehicleJourney,
    storedVehicleJourney,
  );
  const isSameCurrentStop = isDeepStrictEqual(
    messageCurrentStop,
    storedCurrentStop,
  );
  const isSameNextStop = isDeepStrictEqual(messageNextStop, storedNextStop);
  if (isSameVehicleJourney) {
    if (isSameCurrentStop && isSameNextStop) {
      return handleFromShortDeadrunToSameBothStops(vehicleContext, message);
    }
    if (!isSameCurrentStop) {
      return handleFromShortDeadrunToDifferentCurrentStop(
        vehicleContext,
        message,
      );
    }
    return handleFromShortDeadrunToDifferentNextStop(vehicleContext, message);
  }
  return handleFromShortDeadrunToDifferentVehicleJourney(
    vehicleContext,
    message,
  );
};

const handleFromShortDeadrun = (
  vehicleContext: VehicleContext,
  message: HfpInboxQueueMessage,
): TransitionOutput => {
  const { journeyType } = message;
  switch (journeyType) {
    case hfp.Topic.JourneyType.deadrun:
      return handleFromShortDeadrunToDeadrun(vehicleContext);
    case hfp.Topic.JourneyType.journey:
      return handleFromShortDeadrunToVehicleJourney(vehicleContext, message);
    default: {
      const exhaustiveCheck: never = journeyType;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const handleFromLongDeadrunToDeadrun = (): TransitionOutput => {
  return {
    preCommand: "ignoreAndAck",
    postCommands: [],
  };
};

const handleFromLongDeadrunToVehicleJourney = (
  vehicleContext: VehicleContext,
  message: HfpVehicleJourneyInboxQueueMessage,
): TransitionOutput => {
  vehicleContext.vehicleState = {
    type: "midVehicleJourney",
    currentVehicleJourneyState: message.currentVehicleJourneyState,
  };
  const isSendOnJourneyAlreadyAllowed =
    message.eventTimestamp >=
    vehicleContext.nextSendOnJourneyAllowedAfterTimestamp;
  const isMessageEventTypeSendTriggering = isSendTriggeringEvent(message);
  let preCommand: PreVehicleQueueCommand = "onlyCollect";
  const postCommands: PostVehicleQueueCommand[] = [
    { type: "crop", value: "cropToRecentApcMessages" },
  ];
  if (isSendOnJourneyAlreadyAllowed && isMessageEventTypeSendTriggering) {
    preCommand = "sendOnJourney";
    postCommands.push({
      type: "send",
      // There is nothing else to use as metadata.
      value: "sendWithThisStopMetadata",
    });
  } else {
    postCommands.push({ type: "cache", value: "cacheMostRecent" });
  }
  return { preCommand, postCommands };
};

const handleFromLongDeadrun = (
  vehicleContext: VehicleContext,
  message: HfpInboxQueueMessage,
): TransitionOutput => {
  const { journeyType } = message;
  switch (journeyType) {
    case hfp.Topic.JourneyType.deadrun:
      return handleFromLongDeadrunToDeadrun();
    case hfp.Topic.JourneyType.journey:
      return handleFromLongDeadrunToVehicleJourney(vehicleContext, message);
    default: {
      const exhaustiveCheck: never = journeyType;
      throw new Error(String(exhaustiveCheck));
    }
  }
};
/* eslint-enable no-param-reassign */

const transition = (
  vehicleContext: VehicleContext,
  message: HfpInboxQueueMessage,
): TransitionOutput => {
  const stateType = vehicleContext.vehicleState.type;
  switch (stateType) {
    case "initiallyUnknown":
      return handleFromInitiallyUnknown(vehicleContext, message);
    case "midVehicleJourney":
      return handleFromMidVehicleJourney(vehicleContext, message);
    case "firstStopOnNewVehicleJourney":
      return handleFromFirstStopOnNewVehicleJourney(vehicleContext, message);
    case "shortDeadrun":
      return handleFromShortDeadrun(vehicleContext, message);
    case "longDeadrun":
      return handleFromLongDeadrun(vehicleContext, message);
    default: {
      const exhaustiveCheck: never = stateType;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

export default transition;
