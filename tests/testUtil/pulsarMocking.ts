import Pulsar from "pulsar-client";
import { hfp } from "../../src/protobuf/hfp";
import { mqtt } from "../../src/protobuf/mqtt";
import * as partialApc from "../../src/quicktype/partialApc";

export const mockMessageId = (serialMessageId: number): Pulsar.MessageId => {
  return Object.defineProperties(new Pulsar.MessageId(), {
    earliest: {
      value: () => -1,
      writable: true,
    },
    latest: {
      value: () => Number.MAX_SAFE_INTEGER,
      writable: true,
    },
    deserialize: {
      value: (data: Buffer) => data.toString(),
      writable: true,
    },
    serialize: {
      value: () => Buffer.from(serialMessageId.toString(), "utf8"),
      writable: true,
    },
    toString: {
      value: () => serialMessageId.toString(),
      writable: true,
    },
  });
};

const mockPulsarMessage = ({
  buffer,
  eventTimestamp,
  properties,
  messageId,
}: {
  buffer: Buffer;
  eventTimestamp: number;
  properties?: Record<string, string> | undefined;
  messageId?: number | undefined;
}): Pulsar.Message => {
  const message = Object.defineProperties(new Pulsar.Message(), {
    getData: {
      value: () => buffer,
      writable: true,
    },
    getEventTimestamp: {
      value: () => eventTimestamp,
      writable: true,
    },
    getProperties: {
      value: () => properties ?? {},
      writable: true,
    },
    ...(messageId !== undefined
      ? {
          getMessageId: {
            value: () => mockMessageId(messageId),
            writable: true,
          },
        }
      : {}),
  });
  return message;
};

export const mockPartialApcMessage = ({
  contentJson,
  mqttTopic,
  eventTimestamp,
  properties,
  messageId,
}: {
  contentJson: string;
  mqttTopic: string;
  eventTimestamp: number;
  properties?: Record<string, string>;
  messageId?: number;
}): Pulsar.Message => {
  // Throw if not correct.
  partialApc.Convert.toPartialApc(contentJson);
  const mqttMessage = {
    SchemaVersion: 1,
    topic: mqttTopic,
    payload: Buffer.from(contentJson, "utf8"),
  };
  const verificationErrorMessage = mqtt.RawMessage.verify(mqttMessage);
  if (verificationErrorMessage) {
    throw Error(verificationErrorMessage);
  }
  const buffer = Buffer.from(
    mqtt.RawMessage.encode(mqtt.RawMessage.create(mqttMessage)).finish(),
  );
  return mockPulsarMessage({ buffer, eventTimestamp, properties, messageId });
};

export const mockPartialApcProducerMessage = ({
  content,
  mqttTopic,
  eventTimestamp,
}: {
  content: partialApc.PartialApc;
  mqttTopic: string;
  eventTimestamp: number;
}): Pulsar.ProducerMessage => {
  const mqttMessage = {
    SchemaVersion: 1,
    topic: mqttTopic,
    payload: Buffer.from(JSON.stringify(content), "utf8"),
  };
  const verificationErrorMessage = mqtt.RawMessage.verify(mqttMessage);
  if (verificationErrorMessage) {
    throw Error(verificationErrorMessage);
  }
  const data = Buffer.from(
    mqtt.RawMessage.encode(mqtt.RawMessage.create(mqttMessage)).finish(),
  );
  return { data, eventTimestamp };
};

export const mockHfpMessage = ({
  hfpData,
  eventTimestamp,
  properties,
  messageId,
}: {
  hfpData: hfp.IData;
  eventTimestamp: number;
  properties?: Record<string, string>;
  messageId?: number;
}): Pulsar.Message => {
  const verificationErrorMessage = hfp.Data.verify(hfpData);
  if (verificationErrorMessage) {
    throw Error(verificationErrorMessage);
  }
  const buffer = Buffer.from(
    hfp.Data.encode(hfp.Data.create(hfpData)).finish(),
  );
  return mockPulsarMessage({ buffer, eventTimestamp, properties, messageId });
};

export const mockHfpProducerMessage = ({
  hfpData,
  eventTimestamp,
}: {
  hfpData: hfp.IData;
  eventTimestamp: number;
}): Pulsar.ProducerMessage => {
  const verificationErrorMessage = hfp.Data.verify(hfpData);
  if (verificationErrorMessage) {
    throw Error(`${verificationErrorMessage}: ${JSON.stringify(hfpData)}`);
  }
  const data = Buffer.from(hfp.Data.encode(hfp.Data.create(hfpData)).finish());
  return { data, eventTimestamp };
};
