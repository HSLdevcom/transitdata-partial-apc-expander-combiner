import dotenv from "dotenv";
import assert from "node:assert";
import pino from "pino";
import getConfig from "./config";
import keepProcessingMessages from "./messageProcessing";
import {
  createPulsarClient,
  createPulsarConsumer,
  createPulsarProducer,
} from "./pulsar";
import { Config, EndCondition, RuntimeResources } from "./types";
import transformUnknownToError from "./util/error";
import createExitGracefully from "./util/gracefulExit";
import createHealthCheckServer from "./util/healthCheck";

const initializeResources = async (
  logger: pino.Logger,
  resources: Partial<RuntimeResources>,
  config: Config,
): Promise<void> => {
  // We mutate resources to keep a reference to runtime resources for exiting
  // higher up.
  /* eslint-disable no-param-reassign */
  logger.info("Create Pulsar client");
  resources.client = createPulsarClient(config.pulsar);
  logger.info("Create Pulsar producer");
  resources.producer = await createPulsarProducer(
    resources.client,
    config.pulsar.producerConfig,
  );
  logger.info("Create HFP Pulsar consumer");
  resources.hfpConsumer = await createPulsarConsumer(
    resources.client,
    config.pulsar.hfpConsumerConfig,
  );
  logger.info("Create partial APC Pulsar consumer");
  resources.partialApcConsumer = await createPulsarConsumer(
    resources.client,
    config.pulsar.partialApcConsumerConfig,
  );
  logger.info("Create health check server");
  resources.healthCheckServer = createHealthCheckServer(
    logger,
    config.healthCheck,
    resources,
  );
  /* eslint-enable no-param-reassign */
};

const isResourcesInitialized = (
  resources: Partial<RuntimeResources>,
): resources is Required<RuntimeResources> =>
  resources.healthCheckServer !== undefined &&
  resources.client !== undefined &&
  resources.producer !== undefined &&
  resources.hfpConsumer !== undefined &&
  resources.partialApcConsumer !== undefined;

const runBusinessLogic = async (
  logger: pino.Logger,
  resources: Partial<RuntimeResources>,
  endCondition?: EndCondition,
) => {
  logger.info("Read configuration");
  const config = await getConfig(logger);
  logger.info("Initialize runtime resources");
  await initializeResources(logger, resources, config);
  assert(
    isResourcesInitialized(resources),
    "All runtime resources must be initialized by now",
  );
  logger.info("Set health check status to OK");
  resources.healthCheckServer.setHealth("ok");
  logger.info("Keep processing messages");
  await keepProcessingMessages(
    logger,
    resources,
    config.processing,
    endCondition,
  );
};

const runMainWithLogger = async (
  logger: pino.Logger,
  endCondition?: EndCondition,
) => {
  const resources: Partial<RuntimeResources> = {};
  const exitGracefully = createExitGracefully();
  const exitHandler = async (
    exitCode: number,
    exitError?: Error,
    doExitHere = false,
  ): Promise<void> => {
    await exitGracefully(logger, resources, exitCode, exitError, doExitHere);
  };

  try {
    // Handle different kinds of exits.
    //
    // As these event handlers represent unexpected error conditions and are
    // set up this early, let them call process.exit instead of complicating
    // the main function further to let these lead to an exit.
    /* eslint-disable @typescript-eslint/no-floating-promises */
    process.on("beforeExit", () => {
      exitHandler(1, new Error("beforeExit"), true);
    });
    process.on("unhandledRejection", (reason) => {
      exitHandler(1, transformUnknownToError(reason), true);
    });
    process.on("uncaughtException", (err) => {
      exitHandler(1, err, true);
    });
    process.on("SIGINT", (signal) => {
      exitHandler(130, new Error(signal), true);
    });
    process.on("SIGQUIT", (signal) => {
      exitHandler(131, new Error(signal), true);
    });
    process.on("SIGTERM", (signal) => {
      exitHandler(143, new Error(signal), true);
    });
    /* eslint-enable @typescript-eslint/no-floating-promises */
    await runBusinessLogic(logger, resources, endCondition);
    await exitHandler(0, undefined, false);
  } catch (err) {
    await exitHandler(1, transformUnknownToError(err), true);
  }
};

const createLogger = (name: string) =>
  pino(
    {
      name,
      timestamp: pino.stdTimeFunctions.isoTime,
      // As logger is started before config is created, read the level from
      // env.
      level: process.env["PINO_LOG_LEVEL"] ?? "info",
    },
    pino.destination({ sync: true }),
  );

/**
 * Main function.
 *
 * endCondition enables testing the main function. In production it is
 * undefined.
 */
const main = async (endCondition?: EndCondition): Promise<void> => {
  try {
    dotenv.config();
    try {
      const logger = createLogger("transitdata-partial-apc-expander-combiner");
      await runMainWithLogger(logger, endCondition);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to start logging:", err);
      process.exitCode = 1;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to read the dotenv file if it exists:", err);
    process.exitCode = 1;
  }
};

export default main;
