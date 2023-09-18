import type pino from "pino";
import Pulsar from "pulsar-client";
import capabilities from "./generateVehicleCapabilities";
require('dotenv').config()

export type UniqueVehicleId = string;

export type VehicleCapacityMap = Map<UniqueVehicleId, number>;

export interface ProcessingConfig {
  apcWaitInSeconds: number;
  vehicleCapacities: VehicleCapacityMap;
  defaultVehicleCapacity: number;
}

export interface PulsarConfig {
  clientConfig: Pulsar.ClientConfig;
  producerConfig: Pulsar.ProducerConfig;
  hfpConsumerConfig: Pulsar.ConsumerConfig;
  partialApcConsumerConfig: Pulsar.ConsumerConfig;
}

export interface HealthCheckConfig {
  port: number;
}

export interface DatabaseConfig {
  connectionString: string;
}

export interface Config {
  processing: ProcessingConfig;
  pulsar: PulsarConfig;
  healthCheck: HealthCheckConfig;
  database: DatabaseConfig;
}

const getRequired = (envVariable: string) => {
  const variable = process.env[envVariable];
  console.log("VARIABLE", variable);
  if (variable === undefined) {
    throw new Error(`${envVariable} must be defined`);
  }
  return variable;
};

const getCapacities = async () => {
  const envVariable = "VEHICLE_CAPACITIES";
  const variable = process.env[envVariable];
  console.log("VARIABLE:", variable);

  if (variable === undefined) {
    throw new Error(`${envVariable} must be defined`);
  }

  const test = await capabilities();
  console.log("CAPABILITIES:", test)

  return variable;
};

const getOptional = (envVariable: string) => process.env[envVariable];

const getOptionalBooleanWithDefault = (
  envVariable: string,
  defaultValue: boolean
) => {
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
  defaultValue: number
) => {
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

const getVehicleCapacities = async (): Promise<VehicleCapacityMap> => {
  const envVariable = "VEHICLE_CAPACITIES";
  // Check the contents below. Crashing here is fine, too.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const parsed = JSON.parse(await getCapacities()) as [string, number][];
  // Check the contents below. Crashing here is fine, too.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const map: VehicleCapacityMap = new Map(parsed);
  if (map.size !== parsed.length) {
    throw new Error(
      `${envVariable} has ${parsed.length - map.size} repeated vehicles.`
    );
  }
  if (map.size < 1) {
    throw new Error(
      `${envVariable} must have at least one entries() pair in the form of a stringified JSON array of arrays.`
    );
  }
  if (
    Array.from(map.entries()).some(
      ([vehicle, capacity]) =>
        typeof vehicle !== "string" ||
        typeof capacity !== "number" ||
        !Number.isFinite(capacity) ||
        capacity <= 0
    )
  ) {
    throw new Error(
      `${envVariable} must contain only pairs of [string, number] in the form of a stringified JSON array of arrays. The numbers must be finite and positive.`
    );
  }
  return map;
};
/*
const getCreeting = () => {
  return "Foo bar";
}
*/
(async () => {
  const test = await getVehicleCapacities()
  console.log("TEST", test)
})()


const getProcessingConfig = async (): Promise<ProcessingConfig> => {
  const apcWaitInSeconds = getOptionalFiniteFloatWithDefault(
    "APC_WAIT_IN_SECONDS",
    6
  );
  const vehicleCapacities = await getVehicleCapacities();
  const defaultVehicleCapacity = getOptionalFiniteFloatWithDefault(
    "DEFAULT_VEHICLE_CAPACITY",
    78
  );
  return {
    apcWaitInSeconds,
    vehicleCapacities,
    defaultVehicleCapacity,
  };
};

const createPulsarLog =
  (logger: pino.Logger) =>
  (
    level: Pulsar.LogLevel,
    file: string,
    line: number,
    message: string
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
        "'ZSTD' or 'SNAPPY'. Default is 'LZ4'."
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
    true
  );
  const compressionType = getPulsarCompressionType();
  const hfpConsumerTopic = getRequired("PULSAR_HFP_CONSUMER_TOPIC");
  const hfpSubscription = getRequired("PULSAR_HFP_SUBSCRIPTION");
  const hfpSubscriptionType = "Exclusive";
  const hfpSubscriptionInitialPosition = "Earliest";
  const partialApcConsumerTopic = getRequired(
    "PULSAR_PARTIAL_APC_CONSUMER_TOPIC"
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

const getHealthCheckConfig = () => {
  const port = parseInt(getOptional("HEALTH_CHECK_PORT") ?? "8080", 10);
  return { port };
};

const getDatabaseConfig = () => {
  const connectionString = getRequired("DATABASE_CONNECTION_URI")
  return { connectionString }
}

export const getConfig = async (logger: pino.Logger): Promise<Config> => ({
  processing: await getProcessingConfig(),
  pulsar: getPulsarConfig(logger),
  healthCheck: getHealthCheckConfig(),
  database: getDatabaseConfig()
});
