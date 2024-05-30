/**
 * This module collects together closures from different modules for handling a
 * single vehicle. This module ties the HFP and partial APC message handling and
 * the XState actor together. This module also handles testing logic to inform
 * the higher-level loops when all test data has been handled.
 */

import type { pino } from "pino";
import { Queue, createQueue } from "../dataStructures/queue";
import type {
  HfpEndConditionFunctions,
  HfpInboxQueueMessage,
  InboxQueueMessage,
  MessageCollection,
  PartialApcInboxQueueMessage,
  ProcessingConfig,
  UniqueVehicleId,
  VehicleContext,
} from "../types";
import { createSleep } from "../util/sleep";
import createApcHandler from "./apcHandling";
import createHfpHandler from "./hfpHandling";
import { createActor } from "./vehicleActor";

const initializeVehicleContext = async (
  logger: pino.Logger,
  config: ProcessingConfig,
  uniqueVehicleId: UniqueVehicleId,
  outboxQueue: Queue<MessageCollection>,
  backlogDrainingWaitPromise: Promise<void>,
  isTestRun: boolean,
  hfpEndConditionFuncs?: HfpEndConditionFunctions | undefined,
): Promise<VehicleContext> => {
  const partialApcQueue = createQueue<PartialApcInboxQueueMessage>();
  const hfpQueue = createQueue<HfpInboxQueueMessage>();
  const apcFuncs = createApcHandler(
    logger,
    config,
    uniqueVehicleId,
    partialApcQueue,
    outboxQueue,
    isTestRun,
  );
  const hfpFuncs = createHfpHandler(
    config,
    hfpQueue,
    hfpEndConditionFuncs,
    apcFuncs,
  );
  const vehicleActor = createActor(outboxQueue, apcFuncs, hfpFuncs);
  const hfpFeedPromise = hfpFuncs.feedVehicleActor(
    vehicleActor,
    backlogDrainingWaitPromise,
  );
  return {
    partialApcQueue,
    hfpQueue,
    hfpFeedPromise,
  };
};

const createHfpEndConditionCounter = (): HfpEndConditionFunctions => {
  let nHfpQueued = 0;
  let nHfpRead = 0;

  const reportHfpQueued = (n: number): void => {
    nHfpQueued += n;
  };

  const reportHfpRead = (n: number): void => {
    nHfpRead += n;
  };

  const isMoreHfpExpected = (): boolean => nHfpRead < nHfpQueued;

  return {
    reportHfpQueued,
    reportHfpRead,
    isMoreHfpExpected,
  };
};

const initializeVehicleProcessing = (
  logger: pino.Logger,
  config: ProcessingConfig,
  outboxQueue: Queue<MessageCollection>,
  isTestRun: boolean,
) => {
  const vehicles = new Map<UniqueVehicleId, VehicleContext>();
  const hfpEndConditionFuncs = isTestRun
    ? createHfpEndConditionCounter()
    : undefined;

  const { backlogDrainingWaitInSeconds } = config;
  const backlogDrainingWaitInMilliseconds =
    1_000 * backlogDrainingWaitInSeconds;
  const { sleep } = createSleep();
  // One sleep for all vehicles. It is likely fulfilled when many of the
  // vehicles get their first message. That is fine.
  const backlogDrainingWaitPromise = sleep(backlogDrainingWaitInMilliseconds);

  const pushIntoVehicleQueue = async (
    message: InboxQueueMessage,
  ): Promise<void> => {
    const { uniqueVehicleId } = message;
    let vehicleContext = vehicles.get(uniqueVehicleId);
    if (vehicleContext == null) {
      vehicleContext = await initializeVehicleContext(
        logger,
        config,
        uniqueVehicleId,
        outboxQueue,
        backlogDrainingWaitPromise,
        isTestRun,
        hfpEndConditionFuncs,
      );
      vehicles.set(uniqueVehicleId, vehicleContext);
    }
    if (message.type === "partialApc") {
      vehicleContext.partialApcQueue.push(message);
    } else {
      hfpEndConditionFuncs?.reportHfpQueued(1);
      vehicleContext.hfpQueue.push(message);
    }
  };

  /**
   * waitForHfpFeeding is only useful during testing.
   */
  const waitForHfpFeeding = async (): Promise<void> => {
    await Promise.all(
      [...vehicles.values()].map((context) => context.hfpFeedPromise),
    );
  };

  return { pushIntoVehicleQueue, waitForHfpFeeding };
};

export default initializeVehicleProcessing;
