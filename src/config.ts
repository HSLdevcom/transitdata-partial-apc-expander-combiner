import type pino from "pino";
import Pulsar from "pulsar-client";
import { secrets } from "docker-secret";
import dotenv = require("dotenv");
import capabilities, {
  VehicleCapacityMap,
} from "./generateVehicleCapabilities";

dotenv.config();

export type UniqueVehicleId = string;

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

export interface VehicleTypeConfig {
  vehicleTypes: string;
}

export interface Config {
  processing: ProcessingConfig;
  pulsar: PulsarConfig;
  healthCheck: HealthCheckConfig;
  database: DatabaseConfig;
  vehicleTypes: VehicleTypeConfig;
}

const getRequired = (envVariable: string) => {
  const variable = process.env[envVariable];
  if (variable) {
    return variable;
  }
  throw new Error(`${envVariable} must be defined`);
};

const getOptional = (envVariable: string) => {
  const variable = process.env[envVariable];
  if (variable) {
    return variable;
  }
  return undefined;
};

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

const getDatabaseConfig = (): DatabaseConfig => {
  let connectionString: string | undefined = getOptional(
    "DATABASE_CONNECTION_URI"
  );

  if (!connectionString) {
    connectionString = secrets.DATABASE_CONNECTION_URI;
    if (!connectionString) {
      connectionString = "";
    }
  }

  return { connectionString };
};

const getVehicleTypeConfig = () => {
  const vehicleTypes = getRequired("CAPACITIES_BY_VEHICLE_TYPE");
  return { vehicleTypes };
};

const defaultVehicleCapacity = getOptionalFiniteFloatWithDefault(
  "DEFAULT_VEHICLE_CAPACITY",
  78
);

const getVehicleCapacities = async (): Promise<VehicleCapacityMap> => {
  const capabilitiesMap: Map<string, number | undefined> = await capabilities(
    getDatabaseConfig(),
    getVehicleTypeConfig()
  );
  // Check the contents below. Crashing here is fine, too.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (capabilitiesMap.size < 1) {
    throw new Error(
      `Capacities map must have at least one entries() pair in the form of a stringified JSON array of arrays.`
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
        capacity <= 0
    )
  ) {
    throw new Error(
      `Capacities map must contain only pairs of [string, number] in the form of a stringified JSON array of arrays. The numbers must be finite and positive.`
    );
  }
  return capabilitiesMap;
};

const getProcessingConfig = async (): Promise<ProcessingConfig> => {
  const apcWaitInSeconds = getOptionalFiniteFloatWithDefault(
    "APC_WAIT_IN_SECONDS",
    6
  );
  const vehicleCapacities = await getVehicleCapacities();
  return {
    apcWaitInSeconds,
    vehicleCapacities,
    defaultVehicleCapacity,
  };
};

export const getConfig = async (logger: pino.Logger): Promise<Config> => ({
  database: getDatabaseConfig(),
  vehicleTypes: getVehicleTypeConfig(),
  processing: await getProcessingConfig(),
  pulsar: getPulsarConfig(logger),
  healthCheck: getHealthCheckConfig(),
});

// To run locally:

// 1. set environment variable DATABASE_CONNECTION_URI

// 2. uncomment the code block below
/*
(async () => {
  const capacities = await getVehicleCapacities();
  console.log("CAPACITIES SIZE:", capacities.size);
  console.log("FOR EXAMPLE:");
  console.log("0022/00979", capacities.get("0022/00979"));
  console.log("0018/00887", capacities.get("0018/00887"));
  console.log("0022/00945", capacities.get("0022/00945"));
})();
*/

// 3. save this file (be careful not to commit the update of step 2)

// 4. run using this command: npx ts-node src/config.ts
