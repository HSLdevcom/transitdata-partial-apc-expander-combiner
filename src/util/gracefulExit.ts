import type pino from "pino";
import type { RuntimeResources } from "../types";

/**
 * Exit gracefully.
 */
const createExitGracefully = (): ((
  logger: pino.Logger,
  resources: Partial<RuntimeResources>,
  exitCode: number,
  exitError?: Error,
  doExitHere?: boolean,
) => Promise<void>) => {
  let isExiting = false;

  const exitGracefully = async (
    logger: pino.Logger,
    resources: Partial<RuntimeResources>,
    exitCode: number,
    exitError?: Error,
    doExitHere = false,
  ): Promise<void> => {
    if (isExiting) {
      return;
    }
    isExiting = true;
    if (exitError !== undefined) {
      logger.fatal(exitError);
    }
    logger.info("Start exiting gracefully");
    process.exitCode = exitCode;
    try {
      if (resources.healthCheckServer?.setHealth !== undefined) {
        logger.info("Set health checks to fail");
        resources.healthCheckServer.setHealth("failing");
      }
    } catch (err) {
      logger.error(
        { err },
        "Something went wrong when setting health checks to fail",
      );
    }
    try {
      if (resources.partialApcConsumer !== undefined) {
        logger.info("Close partial APC Pulsar consumer");
        await resources.partialApcConsumer.close();
      }
    } catch (err) {
      logger.error(
        { err },
        "Something went wrong when closing partial APC Pulsar consumer",
      );
    }
    try {
      if (resources.hfpConsumer !== undefined) {
        logger.info("Close HFP Pulsar consumer");
        await resources.hfpConsumer.close();
      }
    } catch (err) {
      logger.error(
        { err },
        "Something went wrong when closing HFP Pulsar consumer",
      );
    }
    try {
      if (resources.producer !== undefined) {
        logger.info("Flush Pulsar producer");
        await resources.producer.flush();
      }
    } catch (err) {
      logger.error(
        { err },
        "Something went wrong when flushing Pulsar producer",
      );
    }
    try {
      if (resources.producer !== undefined) {
        logger.info("Close Pulsar producer");
        await resources.producer.close();
      }
    } catch (err) {
      logger.error(
        { err },
        "Something went wrong when closing Pulsar producer",
      );
    }
    try {
      if (resources.client !== undefined) {
        logger.info("Close Pulsar client");
        await resources.client.close();
      }
    } catch (err) {
      logger.error({ err }, "Something went wrong when closing Pulsar client");
    }
    try {
      if (resources.healthCheckServer?.close !== undefined) {
        logger.info("Close health check server");
        await resources.healthCheckServer.close();
      }
    } catch (err) {
      logger.error(
        { err },
        "Something went wrong when closing health check server",
      );
    }
    if (doExitHere) {
      logger.info("Exit process");
      // eslint-disable-next-line no-process-exit
      process.exit();
    }
  };
  return exitGracefully;
};

export default createExitGracefully;
