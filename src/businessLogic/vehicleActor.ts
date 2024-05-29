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

export const setCurrent = ({
  context,
  event,
}: VehicleMachineCustomArgs): Partial<VehicleMachineContext> => {
  assert(isVehicleMachineMessageEvent(event));
  assert(!isDeadRunInternal(event.message));

  let { previousServiceJourneyState } = context;
  if (
    previousServiceJourneyState == null &&
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

const isCurrent = ({ context, event }: VehicleMachineCustomArgs): boolean => {
  assert(isVehicleMachineMessageEvent(event));
  return deepEqual(
    event.message.vehicleJourneyId,
    context.currentServiceJourneyState?.serviceJourneyId,
  );
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
        isCurrentAndIsDeparture: xstate.and([isCurrent, isDeparture]),

        isCurrentAndNotIsDeparture: xstate.and([
          isCurrent,
          xstate.not(isDeparture),
        ]),

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

        notIsCurrentAndIsDeparture: xstate.and([
          xstate.not(isCurrent),
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
      /** @xstate-layout N4IgpgJg5mDOIC5QDUwAsCWBjANmAdAPIB2AMgPbFQAiYAhhAEoCuxAxALZyx0wDaABgC6iUAAdysDABcMlUSAAeiAKwAmAOz4BAZl0AOHQE4BGlRoAsARgA0IAJ6ILRtfhX6rR-QMMqLANh0zAF9gu1RMXAISCipaBhZ2LlgefisRJBAJKVl5TOUEDSt-fCs1HX81UyMa-y87RwR-C1cNfQsdHU0dXysNUPD0bDwiMkoaeiZWTm5eMD41DPFJGTliBQK2rR0WoxUBK0Mdo38Gpw0jUs0rAI7djwGQCOHo4gBlMAAnADdsMAApcjMT7EMD2GYpOaCJZZFa5db5RDFKxWfCVPZBKwqKwCASnByIPZadpqPxVSwmAQWR7PKKjD4-P6A4Gg8HJVLzdIKbKrPKgApYoJoow9crFNQWNpnBA4-QqbQ3FT+fwCFTYlr9MJPIZ0kgM35YAFAkFgiEchYwnnwjZItU6NGqyUBNR1Kw6aVlFH4fR1Zo3CwqEUBGk6kZ6r4Go0s03sqE6S1wtY2mV+e36IoqHairpGCwe4wWfBqNReEwaKmBfz6EORMPvCNM42ss1QiwJnJJxEy-xu0rVSUabr7NQewKo5wCXPYwwdE41l74ABCYAAZuRPmAAGIYT6waS0MR0T7SYFgACCK+kX1iEwS01j-GE3MTfKUSMOl0l7SCLuVVbzBIINYAhotYHhUmoPqHCo850sua4btuu77mAh7HqeF5Xp8N7xFMSSzGk7a8gi-LvuW+BBMqZiqoOljSti9p6MWGhVkUHhVrBIzweuW47nuB5HieG6Yde4y4YkLb8Isz4dq+ApUoWOhKiWFgDhK7TSlW+huLRHR1BY7H+JxrxvGg64oXe7CyFwnzQjJxHJlUIE9oObqeJ4RwqPRSmlD2+w6GUzgBEZWq0nWpnmeJ94EfMT6ZFanakd2hbKtOxTNKpHTuoBNSuBYk4+no-jloGRjGfSZnHlF+GQoR9nWl2OL2uWjotB4FxqgBjSytpGhtEY5YsRUg3lXqlUWXhknzNJ8UviRb4ICKRYaHoRQGSKZhuh6JYlHihzNF0AZmDoo3vON1VTXw8b1YlC1LQNJY7JmXiHLoHqqSU5ZlPsSqmKYp0RVVkwSQ+8xtjdclIsqpQdIGxb5W0PojoBxTOPgRiHC0PgnGYmjldxiF8ShaFCeel5fIDE0gzFdmzbJ80FOYlxeBKBkumYyrI918MUcYBxVl4AXpvjq48Uh-GoYJGHk58lMXaDfBcnTDldl4IGZqYPZeB0pJeSjfTaS4xg7CiBV9CLCG8chAnocJMty8D0W1dNRENUlNQgS6kpMaYNyDvmKpuN4OIHD4AUnaFoYEATVsSyT0tYQ7lmXddytuwtOJmPgWOqi6GNKv7KNKtpSnpvoUFPS4oRasQ5AQHAChhWAEMM4g9o9ri5bGFiErlFzSI7PgLFFDiIp+LikqnThjvzQlkMINiaIh+Xpgm6t0qQfK1gBJtK1KoLAMNoazImo0yz08mubEj2bqGJ4liF40uYgemOIeZBaieGoFti0TNukyJbCYkZ4t0vpKb0PZixlCqC4DSgFN7ZxuH+ToLpSTUkjrWEy50QFp1uozVEHc-rd3UC0bKjQWKonVJ0EqQQehWB-oTa2ktbZk0TtgyyoCuyziLEEHOgQAzKg9B4XqNxcQ9EzM0Sc1dghAA */
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
                actions: [{ type: "ackLater" }, xstate.assign(setCurrent)],
                guard: "isCurrentAndNotIsDeparture",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(setCurrent),
                  { type: "sendApcForCurrent" },
                  xstate.assign(advanceCurrentStop),
                ],
                guard: "isCurrentAndIsDeparture",
              },
              {
                target: "OnServiceJourney",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(switchCurrentToPrevious),
                  xstate.assign(setCurrent),
                  { type: "sendApcSplitBetweenServiceJourneys" },
                  xstate.assign(advanceCurrentStop),
                  xstate.assign(removePrevious),
                ],
                guard: "notIsCurrentAndIsDeparture",
              },
              {
                target: "BeforeFirstDepartureAfterShortDeadRun",
                actions: [
                  { type: "ackLater" },
                  xstate.assign(switchCurrentToPrevious),
                  xstate.assign(setCurrent),
                ],
              },
            ],
          },

          description:
            "The vehicle is signed onto a service journey. We trust it is the right service journey as the first departure has already happened. In this state any previous service journey has been removed from the context.",
        },

        BeforeFirstDepartureAfterLongDeadRun: {
          on: {
            message: [
              {
                target: "OnLongDeadRun",
                actions: [{ type: "ackLater" }],
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
                actions: [{ type: "ackLater" }],
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
