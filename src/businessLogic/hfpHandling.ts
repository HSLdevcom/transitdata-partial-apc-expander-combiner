import type { Actor, AnyActorLogic } from "xstate";
import type { Queue } from "../dataStructures/queue";
import type { HfpInboxQueueMessage, ProcessingConfig } from "../types";

const createHfpHandler = (
  config: ProcessingConfig,
  queue: Queue<HfpInboxQueueMessage>,
  prepareHfpForAcknowledging: (message: HfpInboxQueueMessage) => void,
  hfpEndConditionFuncs?: {
    reportHfpRead: (n: number) => void;
    isMoreHfpExpected: () => boolean;
  },
): {
  setDeadRunTimer: (momentInMilliseconds: number) => void;
  removeDeadRunTimer: () => void;
  feedVehicleActor: (
    vehicleActor: Actor<AnyActorLogic>,
    backlogDrainingWaitPromise: Promise<void>,
  ) => Promise<void>;
} => {
  const { reportHfpRead, isMoreHfpExpected } = hfpEndConditionFuncs ?? {};

  const { sendWaitAfterDeadRunStartInSeconds } = config;
  const sendWaitAfterDeadRunStartInMilliseconds =
    1_000 * sendWaitAfterDeadRunStartInSeconds;

  let deadRunTimerMomentInMilliseconds: number | undefined;
  let deadRunTimerTimeout: NodeJS.Timeout | undefined;

  const setDeadRunTimer = (momentInMilliseconds: number): void => {
    // The actual setting of a timer happens elsewhere if it is needed.
    deadRunTimerMomentInMilliseconds =
      momentInMilliseconds + sendWaitAfterDeadRunStartInMilliseconds;
  };

  const removeDeadRunTimer = (): void => {
    clearTimeout(deadRunTimerTimeout);
    deadRunTimerTimeout = undefined;
    deadRunTimerMomentInMilliseconds = undefined;
  };

  const feedVehicleActor = async (
    vehicleActor: Actor<AnyActorLogic>,
    backlogDrainingWaitPromise: Promise<void>,
  ): Promise<void> => {
    const triggerDeadRunTimer = () => {
      vehicleActor.send({ type: "timer" });
      removeDeadRunTimer();
    };

    const popAndSend = async () => {
      const message = await queue.pop();
      vehicleActor.send({ type: "message", message });
      prepareHfpForAcknowledging(message);
    };

    await backlogDrainingWaitPromise;

    vehicleActor.start();

    while (isMoreHfpExpected === undefined || isMoreHfpExpected()) {
      if (deadRunTimerMomentInMilliseconds === undefined) {
        reportHfpRead?.(1);
        // eslint-disable-next-line no-await-in-loop
        await popAndSend();
      } else {
        const peekedMessage = queue.peek();
        if (peekedMessage === undefined) {
          const nowInMilliseconds = Date.now();
          const diffInMilliseconds =
            deadRunTimerMomentInMilliseconds - nowInMilliseconds;
          if (diffInMilliseconds > 0) {
            deadRunTimerTimeout = setTimeout(
              triggerDeadRunTimer,
              diffInMilliseconds,
            );
          } else {
            triggerDeadRunTimer();
          }
        } else if (
          peekedMessage.eventTimestamp < deadRunTimerMomentInMilliseconds
        ) {
          reportHfpRead?.(1);
          // eslint-disable-next-line no-await-in-loop
          await popAndSend();
        } else {
          triggerDeadRunTimer();
        }
      }
    }

    vehicleActor.stop();
  };

  return {
    setDeadRunTimer,
    removeDeadRunTimer,
    feedVehicleActor,
  };
};

export default createHfpHandler;
