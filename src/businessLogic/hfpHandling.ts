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
        // In this branch we are not on short dead run.
        reportHfpRead?.(1);
        // eslint-disable-next-line no-await-in-loop
        await popAndSend();
      } else if (deadRunTimerTimeout === undefined) {
        // In this branch we have just arrived to a short dead run and need to
        // either process the next message, trigger the timer or set the timer.
        const peekedMessage = queue.peekSync();
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
      } else {
        // In this branch the timer to leave the short dead run has already been
        // set above. Here the point is to stop a busy loop and wait for either
        // the next message or the timer.
        // eslint-disable-next-line no-await-in-loop
        const peekedMessage = await queue.peek();
        // Due to time passing, now either triggerDeadRunTimer() has already
        // been called by setTimeout or peekedMessage arrived before that.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (deadRunTimerTimeout != null) {
          if (peekedMessage.eventTimestamp < deadRunTimerMomentInMilliseconds) {
            reportHfpRead?.(1);
            // eslint-disable-next-line no-await-in-loop
            await popAndSend();
          } else {
            triggerDeadRunTimer();
          }
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
