/**
 * This module contains the XState actor that models the different states a
 * vehicle can be in. The actor decides when APC messages are sent and what HFP
 * message data is used for enhancing the partial APC messages.
 */

import assert from "node:assert";
import * as xstate from "xstate";
import { Queue } from "../dataStructures/queue";
import { hfp } from "../protobuf/hfp";
import {
  HfpDeadRunInboxQueueMessage,
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
  apcFuncs: {
    sendApcForStop: (
      hfpMessage: HfpInboxQueueMessage,
      serviceJourneyStop: ServiceJourneyStop,
      isFromDeadRunStart: boolean,
    ) => Promise<void>;
    sendApcSplitBetweenServiceJourneys: (
      previousHfpMessage: HfpInboxQueueMessage,
      currentHfpMessage: HfpInboxQueueMessage,
      previousStop: ServiceJourneyStop,
      currentStop: ServiceJourneyStop,
    ) => Promise<void>;
    sendApcAfterLongDeadRun: (
      hfpMessage: HfpInboxQueueMessage,
      serviceJourneyStop: ServiceJourneyStop,
    ) => Promise<void>;
  },
  hfpFuncs: {
    removeDeadRunTimer: () => void;
    setDeadRunTimer: (momentInMilliseconds: number) => void;
  },
): xstate.Actor<xstate.AnyActorLogic> => {
  const {
    sendApcForStop,
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
            await sendApcAfterLongDeadRun(event.message, serviceJourneyStop);
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
            await sendApcForStop(event.message, serviceJourneyStop, false);
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
            await sendApcForStop(
              context.previousServiceJourneyState.latestHfp,
              serviceJourneyStop,
              true,
            );
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
            await sendApcSplitBetweenServiceJourneys(
              context.previousServiceJourneyState.latestHfp,
              event.message,
              previousServiceJourneyStop,
              currentServiceJourneyStop,
            );
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
    .createMachine({
      /** @xstate-layout N4IgpgJg5mDOIC5QDUwAsCWBjANmAdAPIB2AMgPbFQAiYAhhAEoCuxAxALZyx0wDaABgC6iUAAdysDABcMlUSAAeiAOwBmAIz41ANgAsalQCYAnAFY1agBzWANCACeiDVaP4DAgRrM6jVjQI6JmoAviH2qJi4BCQUVLQMLOxcsDz8GiJIIBJSsvJZyggqGm5GOsXqZnoaKipmKvZOCGpmZvhWKiZGKnpBViYDJmER6Nh4RGSUNPRMrJzcvGB8RpnikjJyxAqFVmZu1l0aLWpGrWp6jYh7AvhVnQJm-v5VVsMgkWMxxADKYABOADdsGAAFLkZh-YhgBzzVKLQSrbLrPJbArOHQBdrlPQvLwmAwNRyIEw6HT4DTeF7+apWXZvD7RCa-QHAsEQqEwlJpJYZBQ5Db5UCFDQmHraQz4lq1bpGC5EhDmNzmXTqEwacqPHT00aMkjMoFYUHgyHQ2Hc5aI-ko7bOExWPT4AQqAR256GHo6S4IAJq-D6HRqTwuDoqV7hd468Z6-4Go3s01c+FqS3IzY2hBGQImfBGIw1AYlHStT3ykp1cknWqBgRlWVa8MM8YAITAADNyH8wAAxDB-WDSWhiOh-aQQsBm+HCPmpwVKZy1LRVIy6cxBAS9NRe05uAx6fzOvqGPR6bVRZttjvd3v9wfD0edifpFO5NNo73lbPmep1fStYIlpoDGzfpzlaZ0SU6MMRjPAgW3bTsez7AcwCHEcx0fJYVmnF9Z2FPc2h0F06msc51AAxBCLJARdApVp7RsNQhgbSMvm+NAO2QxI5lkLg-gRbCBVRIVnBaP1AwxR5GLVPQ7S9Cw2l0AxGIeSsRVPT4mXYkcElmZIFn4KcsitV9hIQOjySCHF9GdEUui9AIrDJWUak0I5aT2etoI0vUtM43SML4XkjJnIS5zMsxsyLB5fFzUV3XslwtGqSwqg0Y8cTKdTdR+XydKSAKsOCnDQsKP8-TMaLc1MdRansk4rG0WzTECei6iyqMco4vK5kTfhkwE603zKqKfCquLatLY8GpMGt7RrUicSgiMYM0rqZny3qlj0Z9BPTYaKtG2KasJJpvHMdoXWqMxvA6fwNDCcNiHICA4AURswAGkywoAWhuQZRUzHwcV0eo5SaTRbhUXxaTzGwDD8dqvjiaYuNC4zcMQPQVEdTwa06AwqgDMHEBOG4MX9VUjkWxGmRjVljQ5T6Me9LG3Ecmk13h3QvShtonV8RbrDOE9mJWuDL0Qm8ULvMcmZK5wShuGsHnqSxZWSrd+nwZV8WeWldCMGmfLW1G5b2rQMU8Z1GO8WVlx5jFbjSyxnQsdR-AekIgA */
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
                actions: {
                  type: "ackDeadRunMessage",
                },
                guard: {
                  type: "isDeadRun",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  xstate.assign(setCurrent),
                  {
                    type: "sendApcAfterLongDeadRun",
                  },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: {
                  type: "isDeparture",
                },
              },
              {
                target: "BeforeFirstDeparture",
                actions: xstate.assign(setCurrent),
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
                actions: xstate.assign(switchCurrentToPrevious),
                guard: {
                  type: "isDeadRun",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
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
                target: "OnServiceJourney",
                actions: xstate.assign(setCurrent),
              },
            ],
          },

          description:
            "The vehicle is signed onto a service journey. We trust it is the right service journey.",
        },

        BeforeFirstDeparture: {
          on: {
            message: [
              {
                target: "OnLongDeadRun",
                guard: {
                  type: "isDeadRun",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  xstate.assign(setCurrent),
                  {
                    type: "sendApcAfterLongDeadRun",
                  },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: {
                  type: "isDeparture",
                },
              },
              {
                target: "BeforeFirstDeparture",
                actions: xstate.assign(setCurrent),
              },
            ],
          },
          description:
            "Before the first departure of the first service journey after a long dead run. Ultimately this state exists because if we receive a dead run message in this state, that dead run message should not be acknowledged immediately.",
        },

        OnShortDeadRun: {
          on: {
            timer: {
              target: "OnLongDeadRun",
              actions: [
                {
                  type: "sendApcForPrevious",
                },
                xstate.assign(removePrevious),
              ],
            },
            message: [
              {
                target: "OnShortDeadRun",
                actions: {
                  type: "ackDeadRunMessage",
                },
                guard: {
                  type: "isDeadRun",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  xstate.assign(switchPreviousToCurrent),
                  xstate.assign(setCurrent),
                  {
                    type: "sendApcForCurrent",
                  },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: {
                  type: "isPreviousAndIsDeparture",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  xstate.assign(switchPreviousToCurrent),
                  xstate.assign(setCurrent),
                ],
                guard: {
                  type: "isPreviousAndNotIsDeparture",
                },
              },
              {
                target: "OnServiceJourney",
                actions: [
                  xstate.assign(setCurrent),
                  {
                    type: "sendApcSplitBetweenServiceJourneys",
                  },
                  xstate.assign(advanceCurrentStop),
                  xstate.assign(removePrevious),
                ],
                guard: {
                  type: "notIsPreviousAndIsDeparture",
                },
              },
              {
                target: "OnServiceJourney",
                actions: xstate.assign(setCurrent),
              },
            ],
          },
          entry: {
            type: "startDeadRunTimer",
          },
          exit: {
            type: "removeDeadRunTimer",
          },
          description:
            "The vehicle has not been on this dead run for long. It might be a mistake in the HFP implementation. It might be a break between two service journeys. It might be the start of a long dead run.",
        },
      },
    });

  const vehicleActor = xstate.createActor(vehicleMachine);

  return vehicleActor;
};
