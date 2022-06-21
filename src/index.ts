import pino from "pino";
import type Pulsar from "pulsar-client";
import { getConfig } from "./config";
import createHealthCheckServer from "./healthCheck";
import keepProcessingMessages from "./messageProcessing";
import {
  createPulsarClient,
  createPulsarProducer,
  createPulsarConsumer,
} from "./pulsar";
import transformUnknownToError from "./util";

/**
 * Exit gracefully.
 */
const exitGracefully = async (
  logger: pino.Logger,
  exitCode: number,
  exitError?: Error,
  setHealthOk?: (isOk: boolean) => void,
  closeHealthCheckServer?: () => Promise<void>,
  client?: Pulsar.Client,
  producer?: Pulsar.Producer,
  hfpConsumer?: Pulsar.Consumer,
  partialApcConsumer?: Pulsar.Consumer
) => {
  if (exitError) {
    logger.fatal(exitError);
  }
  logger.info("Start exiting gracefully");
  process.exitCode = exitCode;
  try {
    if (setHealthOk) {
      logger.info("Set health checks to fail");
      setHealthOk(false);
    }
  } catch (err) {
    logger.error(
      { err },
      "Something went wrong when setting health checks to fail"
    );
  }
  try {
    if (partialApcConsumer) {
      logger.info("Close partial APC Pulsar consumer");
      await partialApcConsumer.close();
    }
  } catch (err) {
    logger.error(
      { err },
      "Something went wrong when closing partial APC Pulsar consumer"
    );
  }
  try {
    if (hfpConsumer) {
      logger.info("Close HFP Pulsar consumer");
      await hfpConsumer.close();
    }
  } catch (err) {
    logger.error(
      { err },
      "Something went wrong when closing HFP Pulsar consumer"
    );
  }
  try {
    if (producer) {
      logger.info("Flush Pulsar producer");
      await producer.flush();
    }
  } catch (err) {
    logger.error({ err }, "Something went wrong when flushing Pulsar producer");
  }
  try {
    if (producer) {
      logger.info("Close Pulsar producer");
      await producer.close();
    }
  } catch (err) {
    logger.error({ err }, "Something went wrong when closing Pulsar producer");
  }
  try {
    if (client) {
      logger.info("Close Pulsar client");
      await client.close();
    }
  } catch (err) {
    logger.error({ err }, "Something went wrong when closing Pulsar client");
  }
  try {
    if (closeHealthCheckServer) {
      logger.info("Close health check server");
      await closeHealthCheckServer();
    }
  } catch (err) {
    logger.error(
      { err },
      "Something went wrong when closing health check server"
    );
  }
  logger.info("Exit process");
  process.exit(); // eslint-disable-line no-process-exit
};

/**
 * Main function.
 */
/* eslint-disable @typescript-eslint/no-floating-promises */
(async () => {
  /* eslint-enable @typescript-eslint/no-floating-promises */
  try {
    const logger = pino({
      name: "transitdata-partial-apc-expander-combiner",
      timestamp: pino.stdTimeFunctions.isoTime,
      sync: true,
    });

    let setHealthOk: (isOk: boolean) => void;
    let closeHealthCheckServer: () => Promise<void>;
    let client: Pulsar.Client;
    let producer: Pulsar.Producer;
    let hfpConsumer: Pulsar.Consumer;
    let partialApcConsumer: Pulsar.Consumer;

    const exitHandler = (exitCode: number, exitError?: Error) => {
      // Exit next.
      /* eslint-disable @typescript-eslint/no-floating-promises */
      exitGracefully(
        logger,
        exitCode,
        exitError,
        setHealthOk,
        closeHealthCheckServer,
        client,
        producer,
        hfpConsumer,
        partialApcConsumer
      );
      /* eslint-enable @typescript-eslint/no-floating-promises */
    };

    try {
      // Handle different kinds of exits.
      process.on("beforeExit", () => exitHandler(1, new Error("beforeExit")));
      process.on("unhandledRejection", (reason) =>
        exitHandler(1, transformUnknownToError(reason))
      );
      process.on("uncaughtException", (err) => exitHandler(1, err));
      process.on("SIGINT", (signal) => exitHandler(130, new Error(signal)));
      process.on("SIGQUIT", (signal) => exitHandler(131, new Error(signal)));
      process.on("SIGTERM", (signal) => exitHandler(143, new Error(signal)));

      logger.info("Read configuration");
      const config = getConfig(logger);
      logger.info("Create health check server");
      ({ closeHealthCheckServer, setHealthOk } = createHealthCheckServer(
        config.healthCheck
      ));
      logger.info("Create Pulsar client");
      client = createPulsarClient(config.pulsar);
      logger.info("Create Pulsar producer");
      producer = await createPulsarProducer(client, config.pulsar);
      logger.info("Create HFP Pulsar consumer");
      hfpConsumer = await createPulsarConsumer(
        client,
        config.pulsar.hfpConsumerConfig
      );
      logger.info("Create partial APC Pulsar consumer");
      partialApcConsumer = await createPulsarConsumer(
        client,
        config.pulsar.partialApcConsumerConfig
      );
      logger.info("Set health check status to OK");
      setHealthOk(true);
      logger.info("Keep processing messages");
      await keepProcessingMessages(
        logger,
        producer,
        hfpConsumer,
        partialApcConsumer,
        config.processing
      );
    } catch (err) {
      exitHandler(1, transformUnknownToError(err));
    }
  } catch (loggerErr) {
    // eslint-disable-next-line no-console
    console.error("Failed to start logging:", loggerErr);
    process.exit(1); // eslint-disable-line no-process-exit
  }
})();
