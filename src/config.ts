import type pino from "pino";
import Pulsar from "pulsar-client";
import capabilities from "./db/generateVehicleCapabilities";
import type {
  Config,
  DatabaseConfig,
  HealthCheckConfig,
  ProcessingConfig,
  PulsarConfig,
  VehicleCapacityMap,
  VehicleTypeConfig,
} from "./types";
import { getSecrets } from "./util/dockerSecret";

const getRequired = (envVariable: string): string => {
  const variable = process.env[envVariable];
  if (variable != null) {
    return variable;
  }
  throw new Error(`${envVariable} must be defined`);
};

const getOptional = (envVariable: string): string | undefined =>
  process.env[envVariable];

const getOptionalBooleanWithDefault = (
  envVariable: string,
  defaultValue: boolean,
): boolean => {
  let result = defaultValue;
  const str = getOptional(envVariable);
  if (str !== undefined) {
    if (!["false", "true"].includes(str)) {
      throw new Error(`${envVariable} must be either "false" or "true"`);
    }
    result = str === "true";
  }
  return result;
};

const getOptionalFiniteFloatWithDefault = (
  envVariable: string,
  defaultValue: number,
): number => {
  let result = defaultValue;
  const str = getOptional(envVariable);
  if (str !== undefined) {
    result = Number.parseFloat(str);
    if (!Number.isFinite(result)) {
      throw new Error(`${envVariable} must be a finite float`);
    }
  }
  return result;
};

const getOptionalFiniteNonNegativeFloatWithDefault = (
  envVariable: string,
  defaultValue: number,
): number => {
  const result = getOptionalFiniteFloatWithDefault(envVariable, defaultValue);
  if (result < 0) {
    throw new Error(`${envVariable} must be a non-negative, finite float`);
  }
  return result;
};

const createPulsarLog =
  (logger: pino.Logger) =>
  (
    level: Pulsar.LogLevel,
    file: string,
    line: number,
    message: string,
  ): void => {
    switch (level) {
      case Pulsar.LogLevel.DEBUG:
        logger.debug({ file, line }, message);
        break;
      case Pulsar.LogLevel.INFO:
        logger.info({ file, line }, message);
        break;
      case Pulsar.LogLevel.WARN:
        logger.warn({ file, line }, message);
        break;
      case Pulsar.LogLevel.ERROR:
        logger.error({ file, line }, message);
        break;
      default: {
        const exhaustiveCheck: never = level;
        throw new Error(String(exhaustiveCheck));
      }
    }
  };

const getPulsarCompressionType = (): Pulsar.CompressionType => {
  const compressionType = getOptional("PULSAR_COMPRESSION_TYPE") ?? "LZ4";
  // tsc does not understand:
  // if (!["Zlib", "LZ4", "ZSTD", "SNAPPY"].includes(compressionType)) {
  if (
    compressionType !== "Zlib" &&
    compressionType !== "LZ4" &&
    compressionType !== "ZSTD" &&
    compressionType !== "SNAPPY"
  ) {
    throw new Error(
      "If defined, PULSAR_COMPRESSION_TYPE must be one of 'Zlib', 'LZ4', " +
        "'ZSTD' or 'SNAPPY'. Default is 'LZ4'.",
    );
  }
  return compressionType;
};

const getPulsarConfig = (logger: pino.Logger): PulsarConfig => {
  const serviceUrl = getRequired("PULSAR_SERVICE_URL");
  const log = createPulsarLog(logger);
  const producerTopic = getRequired("PULSAR_PRODUCER_TOPIC");
  const blockIfQueueFull = getOptionalBooleanWithDefault(
    "PULSAR_BLOCK_IF_QUEUE_FULL",
    true,
  );
  const compressionType = getPulsarCompressionType();
  const hfpConsumerTopic = getRequired("PULSAR_HFP_CONSUMER_TOPIC");
  const hfpSubscription = getRequired("PULSAR_HFP_SUBSCRIPTION");
  const hfpSubscriptionType = "Exclusive";
  const hfpSubscriptionInitialPosition = "Earliest";
  const partialApcConsumerTopic = getRequired(
    "PULSAR_PARTIAL_APC_CONSUMER_TOPIC",
  );
  const partialApcSubscription = getRequired("PULSAR_PARTIAL_APC_SUBSCRIPTION");
  const partialApcSubscriptionType = "Exclusive";
  const partialApcSubscriptionInitialPosition = "Earliest";
  return {
    clientConfig: {
      serviceUrl,
      log,
    },
    producerConfig: {
      topic: producerTopic,
      blockIfQueueFull,
      compressionType,
    },
    hfpConsumerConfig: {
      topic: hfpConsumerTopic,
      subscription: hfpSubscription,
      subscriptionType: hfpSubscriptionType,
      subscriptionInitialPosition: hfpSubscriptionInitialPosition,
    },
    partialApcConsumerConfig: {
      topic: partialApcConsumerTopic,
      subscription: partialApcSubscription,
      subscriptionType: partialApcSubscriptionType,
      subscriptionInitialPosition: partialApcSubscriptionInitialPosition,
    },
  };
};

const getHealthCheckConfig = (): HealthCheckConfig => {
  const port = parseInt(getOptional("HEALTH_CHECK_PORT") ?? "8080", 10);
  return { port };
};

const getDatabaseConfig = (): DatabaseConfig => {
  const connectionString =
    getOptional("DATABASE_CONNECTION_URI") ??
    getSecrets()["DATABASE_CONNECTION_URI"] ??
    "";
  return { connectionString };
};

const getVehicleTypeConfig = (): VehicleTypeConfig => {
  const vehicleTypes = getRequired("CAPACITIES_BY_VEHICLE_TYPE");
  return { vehicleTypes };
};

const defaultVehicleCapacity = getOptionalFiniteNonNegativeFloatWithDefault(
  "DEFAULT_VEHICLE_CAPACITY",
  78,
);

const getVehicleCapacities = async (): Promise<VehicleCapacityMap> => {
  const capabilitiesMap: Map<string, number | undefined> = await capabilities(
    getDatabaseConfig(),
    getVehicleTypeConfig(),
  );
  // Check the contents below. Crashing here is fine, too.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (capabilitiesMap.size < 1) {
    throw new Error(
      `Capacities map must have at least one entries() pair in the form of a stringified JSON array of arrays.`,
    );
  }

  Array.from(capabilitiesMap.keys()).forEach((uniqueVehicleId) => {
    if (!capabilitiesMap.get(uniqueVehicleId)) {
      capabilitiesMap.set(uniqueVehicleId, defaultVehicleCapacity);
    }
  });

  if (
    Array.from(capabilitiesMap.entries()).some(
      ([vehicle, capacity]) =>
        typeof vehicle !== "string" ||
        typeof capacity !== "number" ||
        !Number.isFinite(capacity) ||
        capacity <= 0,
    )
  ) {
    throw new Error(
      `Capacities map must contain only pairs of [string, number] in the form of a stringified JSON array of arrays. The numbers must be finite and positive.`,
    );
  }
  return capabilitiesMap;
};

const getProcessingConfig = async (): Promise<ProcessingConfig> => {
  const sendWaitAfterStopChangeInSeconds =
    getOptionalFiniteNonNegativeFloatWithDefault(
      "SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS",
      10,
    );
  const sendWaitAfterDeadRunStartInSeconds =
    getOptionalFiniteNonNegativeFloatWithDefault(
      "SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS",
      600,
    );
  const keepApcFromDeadRunEndInSeconds =
    getOptionalFiniteNonNegativeFloatWithDefault(
      "KEEP_APC_FROM_DEADRUN_END_IN_SECONDS",
      1200,
    );
  const backlogDrainingWaitInSeconds =
    getOptionalFiniteNonNegativeFloatWithDefault(
      "BACKLOG_DRAINING_WAIT_IN_SECONDS",
      60,
    );
  const forcedAckIntervalInSeconds =
    getOptionalFiniteNonNegativeFloatWithDefault(
      "FORCED_ACK_INTERVAL_IN_SECONDS",
      7200,
    );
  const forcedAckCheckIntervalInSeconds =
    getOptionalFiniteNonNegativeFloatWithDefault(
      "FORCED_ACK_CHECK_INTERVAL_IN_SECONDS",
      1800,
    );
  if (forcedAckIntervalInSeconds <= sendWaitAfterStopChangeInSeconds) {
    throw new Error(
      `FORCED_ACK_INTERVAL_IN_SECONDS must be larger than SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS`,
    );
  }
  if (forcedAckIntervalInSeconds <= sendWaitAfterDeadRunStartInSeconds) {
    throw new Error(
      `FORCED_ACK_INTERVAL_IN_SECONDS must be larger than SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS`,
    );
  }
  if (forcedAckIntervalInSeconds <= keepApcFromDeadRunEndInSeconds) {
    throw new Error(
      `FORCED_ACK_INTERVAL_IN_SECONDS must be larger than KEEP_APC_FROM_DEADRUN_END_IN_SECONDS`,
    );
  }
  const vehicleCapacities = await getVehicleCapacities();
  return {
    sendWaitAfterStopChangeInSeconds,
    sendWaitAfterDeadRunStartInSeconds,
    keepApcFromDeadRunEndInSeconds,
    backlogDrainingWaitInSeconds,
    forcedAckIntervalInSeconds,
    forcedAckCheckIntervalInSeconds,
    vehicleCapacities,
    defaultVehicleCapacity,
  };
};

const getConfig = async (logger: pino.Logger): Promise<Config> => ({
  database: getDatabaseConfig(),
  vehicleTypes: getVehicleTypeConfig(),
  processing: await getProcessingConfig(),
  pulsar: getPulsarConfig(logger),
  healthCheck: getHealthCheckConfig(),
});

export default getConfig;
