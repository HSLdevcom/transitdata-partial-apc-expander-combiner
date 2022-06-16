import type pino from "pino";
import Pulsar from "pulsar-client";

export interface PulsarConfig {
  clientConfig: Pulsar.ClientConfig;
  producerConfig: Pulsar.ProducerConfig;
  hfpConsumerConfig: Pulsar.ConsumerConfig;
  partialApcConsumerConfig: Pulsar.ConsumerConfig;
}

export interface HealthCheckConfig {
  port: number;
}

export interface Config {
  pulsar: PulsarConfig;
  healthCheck: HealthCheckConfig;
}

const getRequired = (envVariable: string) => {
  const variable = process.env[envVariable];
  if (variable === undefined) {
    throw new Error(`${envVariable} must be defined`);
  }
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

export const getConfig = (logger: pino.Logger): Config => ({
  pulsar: getPulsarConfig(logger),
  healthCheck: getHealthCheckConfig(),
});
