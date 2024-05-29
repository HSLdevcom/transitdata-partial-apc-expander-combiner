/**
 * This module contains the XState actor that models the different states a
 * vehicle can be in. The actor decides when APC messages are sent and what HFP
 * message data is used for enhancing the partial APC messages. The actor also
 * chooses when HFP messages will be acknowledged.
 */

import assert from "node:assert";
import * as xstate from "xstate";
import { Queue } from "../dataStructures/queue";
import { hfp } from "../protobuf/hfp";
import {
  ApcHandlingFunctions,
  HfpDeadRunInboxQueueMessage,
  HfpHandlingFunctions,
  HfpInboxQueueMessage,
  MessageCollection,
  ServiceJourneyState,
  ServiceJourneyStop,
  StopId,
  StopIdNumber,
  VehicleMachineContext,
  VehicleMachineCustomArgs,
  VehicleMachineEvent,
  VehicleMachineMessageEvent,
} from "../types";
import deepEqual from "../util/deepEqual";

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

const transformStopIdToStopIdNumber = (
  stopId?: StopId,
): StopIdNumber | undefined => {
  if (stopId != null && stopId !== "EOL") {
    const stopIdNumber = parseInt(stopId, 10);
    if (Number.isFinite(stopIdNumber)) {
      return stopIdNumber;
    }
  }
  return undefined;
};

const transformStateToStop = (
  state?: ServiceJourneyState,
): ServiceJourneyStop | undefined => {
  const { serviceJourneyId, currentStop } = state ?? {};
  const stopIdNumber = transformStopIdToStopIdNumber(currentStop);
  if (serviceJourneyId != null && stopIdNumber != null) {
    return {
      serviceJourneyId,
      currentStop: stopIdNumber,
    };
  }
  return undefined;
};

const isVehicleMachineMessageEvent = (
  event: VehicleMachineEvent,
): event is VehicleMachineMessageEvent => "message" in event;

export const isDeadRunInternal = (
  message: HfpInboxQueueMessage,
): message is HfpDeadRunInboxQueueMessage =>
  message.vehicleJourneyId === hfp.Topic.JourneyType.deadrun;

const advanceCurrentStop = ({
  context,
  event,
}: VehicleMachineCustomArgs): Partial<VehicleMachineContext> => {
  assert(isVehicleMachineMessageEvent(event));
  assert(!isDeadRunInternal(event.message));
  assert(context.currentServiceJourneyState != null);
  let currentServiceJourneyPreviousStop: StopId | undefined;
  if (context.currentServiceJourneyState.currentStop != null) {
    currentServiceJourneyPreviousStop =
      context.currentServiceJourneyState.currentStop;
  }
  const { nextStop } = event.message.stops;
  const isEol = nextStop === "EOL";
  let currentServiceJourneyCurrentStop: StopId | undefined =
    context.currentServiceJourneyState.currentStop;
  if (!isEol) {
    if (nextStop !== context.currentServiceJourneyState.currentStop) {
      if (nextStop != null) {
        currentServiceJourneyCurrentStop = nextStop;
      } else {
        currentServiceJourneyCurrentStop = undefined;
      }
    } else {
      currentServiceJourneyCurrentStop = undefined;
    }
  }
  const result = {
    currentServiceJourneyState: {
      serviceJourneyId: context.currentServiceJourneyState.serviceJourneyId,
      latestHfp: context.currentServiceJourneyState.latestHfp,
      previousStop: currentServiceJourneyPreviousStop,
      currentStop: currentServiceJourneyCurrentStop,
    },
  };
  return result;
};

const removePrevious = (): Partial<VehicleMachineContext> => {
  return {
    previousServiceJourneyState: undefined,
  };
};

const removeCurrent = (): Partial<VehicleMachineContext> => {
  return {
    currentServiceJourneyState: undefined,
  };
};

export const setCurrent = ({
  context,
  event,
}: VehicleMachineCustomArgs): Partial<VehicleMachineContext> => {
  assert(isVehicleMachineMessageEvent(event));
  assert(!isDeadRunInternal(event.message));

  let { previousServiceJourneyState } = context;
  if (
    context.currentServiceJourneyState != null &&
    !deepEqual(
      context.currentServiceJourneyState.serviceJourneyId,
      event.message.vehicleJourneyId,
    )
  ) {
    previousServiceJourneyState = context.currentServiceJourneyState;
  }

  const { currentStop, nextStop } = event.message.stops;
  const { currentStop: contextCurrentStop, previousStop: contextPreviousStop } =
    context.currentServiceJourneyState ?? {};
  const isPde = event.message.data.topic.eventType === hfp.Topic.EventType.PDE;
  const isDep = event.message.data.topic.eventType === hfp.Topic.EventType.DEP;
  const isEol = nextStop === "EOL";
  const isCurrentStopDefined = currentStop != null;
  const isNextStopDefined = nextStop != null;
  const isContextCurrentStopDefined = contextCurrentStop != null;
  const isCurrentStopSameAsContextCurrentStop =
    currentStop === contextCurrentStop;
  const isCurrentStopSameAsContextPreviousStop =
    currentStop === contextPreviousStop;
  const isNextStopSameAsContextPreviousStop = nextStop === contextPreviousStop;

  let currentServiceJourneyCurrentStop = contextCurrentStop;

  if (isPde) {
    if (isCurrentStopDefined) {
      if (!isCurrentStopSameAsContextPreviousStop) {
        currentServiceJourneyCurrentStop = currentStop;
      }
    }
  } else if (isDep) {
    if (isContextCurrentStopDefined) {
      if (!isCurrentStopSameAsContextPreviousStop) {
        if (isCurrentStopDefined) {
          currentServiceJourneyCurrentStop = currentStop;
        }
      }
    } else if (isCurrentStopSameAsContextPreviousStop) {
      if (isEol) {
        currentServiceJourneyCurrentStop = currentStop;
      } else if (isNextStopDefined && !isNextStopSameAsContextPreviousStop) {
        currentServiceJourneyCurrentStop = nextStop;
      }
    } else if (isCurrentStopDefined) {
      currentServiceJourneyCurrentStop = currentStop;
    }
  } else if (!isContextCurrentStopDefined) {
    if (isCurrentStopDefined) {
      currentServiceJourneyCurrentStop = currentStop;
    } else if (isNextStopDefined && !isEol) {
      currentServiceJourneyCurrentStop = nextStop;
    }
  } else if (isCurrentStopDefined && !isCurrentStopSameAsContextCurrentStop) {
    currentServiceJourneyCurrentStop = currentStop;
  }

  return {
    previousServiceJourneyState,
    currentServiceJourneyState: {
      serviceJourneyId: event.message.vehicleJourneyId,
      latestHfp: event.message,
      previousStop: context.currentServiceJourneyState?.previousStop,
      currentStop: currentServiceJourneyCurrentStop,
    },
  };
};

const switchCurrentToPrevious = ({
  context,
}: VehicleMachineCustomArgs): Partial<VehicleMachineContext> => {
  assert(context.currentServiceJourneyState != null);
  return {
    previousServiceJourneyState: context.currentServiceJourneyState,
    currentServiceJourneyState: undefined,
  };
};

const switchPreviousToCurrent = ({
  context,
}: VehicleMachineCustomArgs): Partial<VehicleMachineContext> => {
  assert(context.previousServiceJourneyState != null);
  return {
    previousServiceJourneyState: undefined,
    currentServiceJourneyState: context.previousServiceJourneyState,
  };
};

const isDeadRun = ({ event }: VehicleMachineCustomArgs): boolean => {
  assert(isVehicleMachineMessageEvent(event));
  return isDeadRunInternal(event.message);
};

export const isDeparture = ({
  context,
  event,
}: VehicleMachineCustomArgs): boolean => {
  assert(isVehicleMachineMessageEvent(event));
  assert(!isDeadRunInternal(event.message));

  const { message } = event;
  const { eventType } = message.data.topic;

  const isPde = eventType === hfp.Topic.EventType.PDE;
  const isDep = eventType === hfp.Topic.EventType.DEP;
  const isEol = message.data.topic.nextStop === "EOL";
  const isContextCurrentDefined = context.currentServiceJourneyState != null;
  const isJourneySameAsContextCurrent = deepEqual(
    message.vehicleJourneyId,
    context.currentServiceJourneyState?.serviceJourneyId,
  );

  const hasPdeModifiedContextCurrentBeforeDep =
    context.currentServiceJourneyState != null &&
    context.currentServiceJourneyState.previousStop ===
      message.stops.currentStop;

  let result = false;
  if (!isEol) {
    if (isPde) {
      result = true;
    } else if (isDep) {
      if (isContextCurrentDefined) {
        if (isJourneySameAsContextCurrent) {
          if (hasPdeModifiedContextCurrentBeforeDep) {
            result = false;
          } else {
            result = true;
          }
        } else {
          result = true;
        }
      } else {
        result = true;
      }
    } else {
      result = false;
    }
  }
  return result;
};

const isPrevious = ({ context, event }: VehicleMachineCustomArgs): boolean => {
  assert(isVehicleMachineMessageEvent(event));
  return deepEqual(
    event.message.vehicleJourneyId,
    context.previousServiceJourneyState?.serviceJourneyId,
  );
};

const isPreviousDefined = ({ context }: VehicleMachineCustomArgs): boolean => {
  return context.previousServiceJourneyState != null;
};

export const createActor = (
  outboxQueue: Queue<MessageCollection>,
  apcFuncs: ApcHandlingFunctions,
  hfpFuncs: HfpHandlingFunctions,
  // Omitting the return type enables TypeScript to deduce the crazy type in
  // full.
) => {
  const {
    prepareHfpForAcknowledging,
    sendApcMidServiceJourney,
    sendApcFromBeginningOfLongDeadRun,
    sendApcSplitBetweenServiceJourneys,
    sendApcAfterLongDeadRun,
  } = apcFuncs;
  const { removeDeadRunTimer, setDeadRunTimer } = hfpFuncs;

  const vehicleMachine = xstate
    .setup({
      types: {
        context: {} as VehicleMachineContext,
        events: {} as VehicleMachineEvent,
      },
      actions: {
        ackDeadRunMessage({ event }) {
          assert(isVehicleMachineMessageEvent(event));
          assert(isDeadRunInternal(event.message));
          queueSingleHfpForAcking(outboxQueue, event.message);
        },

        ackLater({ event }) {
          assert(isVehicleMachineMessageEvent(event));
          prepareHfpForAcknowledging(event.message);
        },

        removeDeadRunTimer() {
          removeDeadRunTimer();
        },

        // It is okay that the await call in the end fulfills after the next
        // action.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async sendApcAfterLongDeadRun({ context, event }) {
          assert(isVehicleMachineMessageEvent(event));
          const serviceJourneyStop = transformStateToStop(
            context.currentServiceJourneyState,
          );
          if (serviceJourneyStop != null) {
            await sendApcAfterLongDeadRun({
              hfpMessage: event.message,
              serviceJourneyStop,
            });
          }
        },

        // It is okay that the await call in the end fulfills after the next
        // action.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async sendApcForCurrent({ context, event }) {
          assert(isVehicleMachineMessageEvent(event));
          const serviceJourneyStop = transformStateToStop(
            context.currentServiceJourneyState,
          );
          if (serviceJourneyStop != null) {
            await sendApcMidServiceJourney({
              hfpMessage: event.message,
              serviceJourneyStop,
            });
          }
        },

        // It is okay that the await call in the end fulfills after the next
        // action.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async sendApcForPrevious({ context }) {
          const serviceJourneyStop = transformStateToStop(
            context.previousServiceJourneyState,
          );
          if (
            serviceJourneyStop != null &&
            context.previousServiceJourneyState != null
          ) {
            // We do not need to advanceCurrentStop as the next action will be
            // removePrevious.
            await sendApcFromBeginningOfLongDeadRun({
              hfpMessage: context.previousServiceJourneyState.latestHfp,
              serviceJourneyStop,
            });
          }
        },

        // It is okay that the await call in the end fulfills after the next
        // action.
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        async sendApcSplitBetweenServiceJourneys({ context, event }) {
          assert(isVehicleMachineMessageEvent(event));
          assert(context.previousServiceJourneyState != null);
          const previousServiceJourneyStop = transformStateToStop(
            context.previousServiceJourneyState,
          );
          const currentServiceJourneyStop = transformStateToStop(
            context.currentServiceJourneyState,
          );
          if (
            previousServiceJourneyStop != null &&
            currentServiceJourneyStop != null
          ) {
            await sendApcSplitBetweenServiceJourneys({
              previous: {
                hfpMessage: context.previousServiceJourneyState.latestHfp,
                serviceJourneyStop: previousServiceJourneyStop,
              },
              current: {
                hfpMessage: event.message,
                serviceJourneyStop: currentServiceJourneyStop,
              },
            });
          }
        },

        startDeadRunTimer({ event }) {
          assert(isVehicleMachineMessageEvent(event));
          assert(isDeadRunInternal(event.message));
          setDeadRunTimer(event.message.eventTimestamp);
        },
      },
      guards: {
        isDeadRun,

        isDeparture,

        isPrevious,

        isPreviousDefined,

        isPreviousAndIsDeparture: xstate.and([isPrevious, isDeparture]),

        isPreviousAndNotIsDeparture: xstate.and([
          isPrevious,
          xstate.not(isDeparture),
        ]),

        isPreviousDefinedAndIsDeparture: xstate.and([
          isPreviousDefined,
          isDeparture,
        ]),

        notIsPreviousAndIsDeparture: xstate.and([
          xstate.not(isPrevious),
          isDeparture,
        ]),

        notIsPreviousDefinedAndIsDeparture: xstate.and([
          xstate.not(isPreviousDefined),
          isDeparture,
        ]),
      },
      schemas: {
        events: {
          timer: {
            type: "object",
            properties: {},
          },
          message: {
            type: "object",
            properties: {},
          },
        },
        context: {
          previousServiceJourneyState: {
            type: "object",
            properties: {},
            description: "",
          },
          currentServiceJourneyState: {
            type: "object",
            properties: {},
            description: "",
          },
        },
      },
    })
    /**
     * In XState, guards determine both the target state and the list of actions
     * to take. That is why we have several transitions into the same target.
     */
    .createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QDUwAsCWBjANmAdAPIB2AMgPbFQAiYAhhAEoCuxAxALZyx0wDaABgC6iUAAdysDABcMlUSAAeiAGwB2AIz4ATGu0qAnAIAcK4wFZtAFg0AaEAE9EVgwGZ8BleYFvzVywbmAL5B9qiYuAQkFFS0DCzsXLA8-BoiSCASUrLyGcoIXtr4Gmp+asauBlZWAubG9k4IdcbFbhoqrgICrq7G2q4hYejYeERklDT0TKyc3LxgfNrp4pIycsQK+Wqexf3qXZ57ag2Iaipariq1Na7mt3UGgyDhI1HEAMpgAE4AbthgAClyMwvsQwA5Zsl5oJlplVjkNnlEO0NFoVNpAq5NOYNF0VCcEIE1PhLH0BNoMXUKVYni9ImNPr9-kCQWCIUkUgs0gosmtcqB8hocS0KSpDF5cdpjGorATccYrPh-OY9BVRcYFbThvSSIy-lhAcDQeDIZzFrDeQjNsjLMTAgYKjUZcYjPVHMj9EUBGKNPcrBq-DTQs9taNdd99YbWSaOdDXBb4etrQgUe5UQI1AIXPpPCY5VYOrtPDjvJ0TGotRFRgAhMAAM3IXzAADEMF9YNJaGI6F9pCCwABBOvSb4xSbxGax-jCHmJ-lKZEaF1K8o1fxYiwagk2Az4LOkvRWKWuAsqSuvfC1htN1vtztgbu9-tDkdfMdxaaJOapBPZJNIlMSgEfBelRAxtG9LEanxd0misdx-XOPx2msJdjHPekr0bFs2w7Lsez7JsX1HCYPwSU1oSWWc-3nQUsyKYsMXabZ1FlWC9BUJUNCsVd+j0bjgmDOkww+NBG3vCd2FkLgvhhai+URAVkWlEljDQswzGqaoDAJPxOMCIVtCFb0UIGITQzed4xN7MjJ2-BYZwyS1-yUlMVEVMVhXadytJ6AkDHApUfFMTp9nMAKMJEqzxNsr8oR-eSrQA3F3Eza4jzU7ZzD8OUTBaNRygMTMzkuYrIss6yJM-Cj+Copy50UhdCXcXROk0f03FKX05QxTiTNMeDrBVO5yoZSrYpqhZ40SlymrcDw9DcdcHSXbp8wLfBMw0bRvHMK4yvMqsKpiqZyKnBYrF-BTk284oC06XFwPTcw5Xc8wQJCmxtOMWpRqwm9cPvR9CMHYdvmimzTrs+KHKupLXL296vA1fwIJ8VwhVerodBlCkUR4+U-vrbDbzwh8COfMGvghqqzvsvhuXqmjGvye0STUW5LgMdpsu2uUVXcQIsx8dRAn6QShiOy9iYBu98KfIiqZpibzvNGbaMQTxd1C8LPFRoyYMaEpvHwMwNE8E9-A1E8ievHC5fJhXQdfZWobis1pqZ67kuuJUVSPbwUs8uVAne71spPbZrhxEJg2IcgIDgBRhLAdWWcQABaYCAoCvRajey5-blE8SSuKpttuXQUtG6JSLdtPkx4vcunJbZ4L0k8CVcCDTfaAsOe5k86hrj4I2ZI02QbgCqmJUxUV6DGip47R-JqfBpVxc2+j6c3tFtknAflkHiLfOvJKn1yZ-X848YpHwpTYxopXer6xQ6bv0T8EfXfPr34aanEvcuiZkqIZI8rgCRnC0DieCWJahYlAvvWWZNgaUxduNeuf9Zr5HgruPiR48RDzFHKNS+VuJdF6HcdyPhY5BCAA */
      context: {
        previousServiceJourneyState: undefined,
        currentServiceJourneyState: undefined,
      },
      id: "Vehicle",
      initial: "OnLongDeadRun",
      description:
        "A machine depicting a single vehicle for the purpose of triggering the right APC publishing at the right time.",
      states: {
        OnLongDeadRun: {
          on: {
            message: [
              {
                target: "OnLongDeadRun",
                actions: { type: "ackDeadRunMessage" },
                guard: "isDeadRun",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  { type: "sendApcAfterLongDeadRun" },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: "isDeparture",
              },
              {
                target: "BeforeFirstDepartureAfterLongDeadRun",
                actions: [{ type: "ackLater" }, xstate.assign(setCurrent)],
              },
            ],
          },
          description:
            "The vehicle has been on this dead run for long. Maybe it has even been to the depot.",
        },

        OnServiceJourney: {
          on: {
            message: [
              {
                target: "OnShortDeadRun",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(switchCurrentToPrevious),
                ],
                guard: "isDeadRun",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  { type: "sendApcForCurrent" },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: {
                  type: "notIsPreviousDefinedAndIsDeparture",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  { type: "sendApcSplitBetweenServiceJourneys" },
                  xstate.assign(advanceCurrentStop),
                  xstate.assign(removePrevious),
                ],
                guard: {
                  type: "isPreviousDefinedAndIsDeparture",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [{ type: "ackLater" }, xstate.assign(setCurrent)],
              },
            ],
          },

          description:
            "The vehicle is signed onto a service journey. We trust it is the right service journey.",
        },

        BeforeFirstDepartureAfterLongDeadRun: {
          on: {
            message: [
              {
                target: "OnLongDeadRun",
                actions: [{ type: "ackLater" }, xstate.assign(removeCurrent)],
                guard: "isDeadRun",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  { type: "sendApcAfterLongDeadRun" },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: "isDeparture",
              },
              {
                target: "BeforeFirstDepartureAfterLongDeadRun",
                actions: [{ type: "ackLater" }, xstate.assign(setCurrent)],
              },
            ],
          },
          description:
            "Before the first departure of the first service journey after a long dead run. At this point the driver might have selected a wrong service journey.",
        },

        OnShortDeadRun: {
          on: {
            timer: {
              target: "OnLongDeadRun",
              actions: [
                { type: "sendApcForPrevious" },
                xstate.assign(removePrevious),
              ],
            },
            message: [
              {
                target: "OnShortDeadRun",
                actions: { type: "ackDeadRunMessage" },
                guard: "isDeadRun",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(switchPreviousToCurrent),
                  xstate.assign(setCurrent),
                  { type: "sendApcForCurrent" },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: "isPreviousAndIsDeparture",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(switchPreviousToCurrent),
                  xstate.assign(setCurrent),
                ],
                guard: "isPreviousAndNotIsDeparture",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  { type: "sendApcSplitBetweenServiceJourneys" },
                  xstate.assign(advanceCurrentStop),
                  xstate.assign(removePrevious),
                ],
                guard: "notIsPreviousAndIsDeparture",
              },
              {
                target: "BeforeFirstDepartureAfterShortDeadRun",
                actions: [{ type: "ackLater" }, xstate.assign(setCurrent)],
              },
            ],
          },
          entry: "startDeadRunTimer",
          exit: "removeDeadRunTimer",
          description:
            "The vehicle has not been on this dead run for long. It might be a mistake in the HFP implementation. It might be a break between two service journeys. It might be the start of a long dead run.",
        },

        BeforeFirstDepartureAfterShortDeadRun: {
          description:
            "Before the first departure of a new service journey after a short dead run. At this point the driver might have selected a wrong service journey.",

          on: {
            message: [
              {
                target: "OnShortDeadRun",
                actions: [{ type: "ackLater" }, xstate.assign(removeCurrent)],
                guard: "isDeadRun",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  {
                    type: "sendApcForCurrent",
                  },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: {
                  type: "notIsPreviousDefinedAndIsDeparture",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  {
                    type: "sendApcSplitBetweenServiceJourneys",
                  },
                  xstate.assign(advanceCurrentStop),
                  xstate.assign(removePrevious),
                ],
                guard: {
                  type: "isPreviousDefinedAndIsDeparture",
                },
              },
              {
                target: "BeforeFirstDepartureAfterShortDeadRun",
                actions: [{ type: "ackLater" }, xstate.assign(setCurrent)],
              },
            ],
          },
        },
      },
    });

  const vehicleActor = xstate.createActor(vehicleMachine);

  return vehicleActor;
};
