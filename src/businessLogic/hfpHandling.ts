/**
 * This module reads HFP messages for a particular vehicle, manipulates its
 * XState actor and handles short dead run timer logic.
 */

import type { Actor, AnyActorLogic } from "xstate";
import type { Queue } from "../dataStructures/queue";
import type {
  HfpEndConditionFunctions,
  HfpHandlingFunctions,
  HfpInboxQueueMessage,
  ProcessingConfig,
} from "../types";

const createHfpHandler = (
  config: ProcessingConfig,
  hfpQueue: Queue<HfpInboxQueueMessage>,
  hfpEndConditionFuncs?: HfpEndConditionFunctions | undefined,
): HfpHandlingFunctions => {
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
      removeDeadRunTimer();
      vehicleActor.send({ type: "timer" });
    };

    const popAndSend = async () => {
      reportHfpRead?.(1);
      const message = await hfpQueue.pop();
      vehicleActor.send({ type: "message", message });
    };

    await backlogDrainingWaitPromise;

    vehicleActor.start();

    const isTestRun = isMoreHfpExpected !== undefined;
    // The following code is a bit tricky. We need to handle receiving HFP
    // messages and feeding them onwards. We also must take care of the
    // cancellable timers that start when the vehicle starts a dead run. Here
    // we create the timer but vehicleActor decides when that happens.
    while (!isTestRun || isMoreHfpExpected()) {
      if (deadRunTimerMomentInMilliseconds === undefined) {
        // In this branch we are not on a short dead run.
        // eslint-disable-next-line no-await-in-loop
        await popAndSend();
      } else if (deadRunTimerTimeout === undefined) {
        // In this branch we have just arrived to a short dead run and need to
        // either process the next message, trigger the timer or set the timer.
        const peekedMessage = hfpQueue.peekSync();
        if (peekedMessage === undefined) {
          // No message to receive so we either set a current timer or trigger a
          // historical timer.
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
          // vehicleActor shall decide how the next message affects the timer.
          // eslint-disable-next-line no-await-in-loop
          await popAndSend();
        } else {
          // The next message occurs after the timer.
          triggerDeadRunTimer();
        }
      } else {
        // In this branch the timer to leave the short dead run has already been
        // set above. Here the point is to stop a busy loop and wait for either
        // the next message or the timer.
        // eslint-disable-next-line no-await-in-loop
        const peekedMessage = await hfpQueue.peek();
        // Due to time passing, now either triggerDeadRunTimer() has already
        // been called by setTimeout or peekedMessage has arrived before that.
        //
        // ESLint does not recognize time passing.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (deadRunTimerTimeout != null) {
          // In this branch triggerDeadRunTimer() has not been called yet so it
          // makes sense to compare the timestamps.
          if (peekedMessage.eventTimestamp < deadRunTimerMomentInMilliseconds) {
            // vehicleActor shall decide how the next message affects the timer.
            // eslint-disable-next-line no-await-in-loop
            await popAndSend();
          } else {
            // The next message occurs after the timer.
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
