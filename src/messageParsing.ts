import type pino from "pino";
import type Pulsar from "pulsar-client";
import { hfp } from "./protobuf/hfp";
import { mqtt } from "./protobuf/mqtt";
import * as partialApc from "./quicktype/partialApc";
import type { QueueMessage, UniqueVehicleId, VehicleState } from "./types";

export const getUniqueVehicleIdFromHfpTopic = (
  topic: hfp.ITopic,
): UniqueVehicleId | undefined => {
  const parts = topic.uniqueVehicleId.split("/");
  if (parts.length === 2 && parts[0] != null && parts[1] != null) {
    return `${parts[0].padStart(4, "0")}/${parts[1].padStart(5, "0")}`;
  }
  return undefined;
};

export const getUniqueVehicleIdFromMqttTopic = (
  topic: string,
): UniqueVehicleId | undefined => {
  const parts = topic.split("/");
  if (parts.length >= 9) {
    return parts.slice(7, 9).join("/");
  }
  return undefined;
};

const transformHfpToVehicleState = (
  logger: pino.Logger,
  hfpData: hfp.Data,
): VehicleState | undefined => {
  let result;
  if (hfpData.topic?.temporalType !== hfp.Topic.TemporalType.ongoing) {
    logger.debug(
      { hfpData },
      "HFP message temporal type is upcoming. Dropping the message.",
    );
    return result;
  }
  // Treat signoff as deadrun.
  if (hfpData.topic.journeyType !== hfp.Topic.JourneyType.journey) {
    return "deadrun";
  }
  const { startTime, routeId, directionId, nextStop } = hfpData.topic;
  const { oday, start, route, dir, stop } = hfpData.payload;
  const resultOperatingDay = oday;
  if (resultOperatingDay == null) {
    logger.warn(
      { hfpData },
      "HFP message payload is missing oday. Dropping the message.",
    );
    return result;
  }
  const resultStartTime = startTime ?? start;
  if (resultStartTime == null) {
    logger.warn(
      { hfpData },
      "HFP message topic and payload are missing start time",
    );
    return result;
  }
  const resultRoute = routeId ?? route;
  if (resultRoute == null) {
    logger.warn(
      { hfpData },
      "HFP message topic and payload are missing route. Dropping the message.",
    );
    return result;
  }
  let resultDirection = directionId;
  const payloadDirection = dir != null ? parseInt(dir, 10) : null;
  if (directionId != null) {
    resultDirection = directionId;
  } else if (Number.isFinite(payloadDirection)) {
    resultDirection = payloadDirection;
  }
  if (resultDirection == null) {
    logger.warn(
      { hfpData },
      "HFP message topic and payload are missing direction. Dropping the message.",
    );
    return result;
  }
  // currentStop is regularly missing so do not warn about it.
  const currentStop = stop?.toString();
  if (currentStop == null) {
    logger.debug(
      { hfpData },
      "HFP message payload is missing current stop. Dropping the message.",
    );
    return result;
  }
  if (nextStop == null) {
    logger.warn(
      { hfpData },
      "HFP message topic is missing next stop. Dropping the message.",
    );
    return result;
  }
  result = {
    vehicleJourney: {
      operatingDay: resultOperatingDay,
      startTime: resultStartTime,
      route: resultRoute,
      direction: resultDirection,
    },
    stopState: {
      currentStop,
      nextStop,
    },
  };
  return result;
};

export const parseHfpPulsarMessage = (
  logger: pino.Logger,
  message: Pulsar.Message,
): QueueMessage | undefined => {
  let result;
  const messageData = message.getData();
  const eventTimestamp = message.getEventTimestamp();
  const properties = { ...message.getProperties() };
  const messageId = message.getMessageId();
  let hfpData;
  try {
    hfpData = hfp.Data.decode(message.getData());
  } catch (err) {
    logger.warn(
      {
        err,
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "The HFP message does not conform to the proto definition. Dropping the message.",
    );
  }
  if (hfpData == null) {
    return result;
  }
  const { topic } = hfpData;
  if (topic == null) {
    logger.warn(
      {
        properties,
        messageId: messageId.toString(),
        hfpData,
        eventTimestamp,
      },
      "The HFP message does not have an MQTT topic. Dropping the message.",
    );
    return result;
  }
  const uniqueVehicleId = getUniqueVehicleIdFromHfpTopic(topic);
  if (uniqueVehicleId == null) {
    logger.warn(
      {
        mqttTopic: topic,
        properties,
        messageId: messageId.toString(),
        hfpData,
        eventTimestamp,
      },
      "The MQTT topic of the HFP message does not contain the unique vehicle ID. Dropping the message.",
    );
    return result;
  }
  const { eventType } = topic;
  if (eventType == null) {
    logger.warn(
      {
        mqttTopic: topic,
        properties,
        messageId: messageId.toString(),
        hfpData,
        eventTimestamp,
      },
      "The MQTT topic of the HFP message does not contain the event type. Dropping the message.",
    );
    return result;
  }
  const data = transformHfpToVehicleState(logger, hfpData);
  if (data == null) {
    return result;
  }
  result = {
    type: "hfp" as const,
    data,
    eventType,
    hfpData,
    messageId,
    eventTimestamp,
    uniqueVehicleId,
  };
  return result;
};

export const parsePartialApcPulsarMessage = (
  logger: pino.Logger,
  message: Pulsar.Message,
): QueueMessage | undefined => {
  let result;
  const messageData = message.getData();
  const eventTimestamp = message.getEventTimestamp();
  const properties = { ...message.getProperties() };
  const messageId = message.getMessageId();
  let mqttMessage;
  try {
    mqttMessage = mqtt.RawMessage.decode(messageData);
  } catch (err) {
    logger.warn(
      {
        err,
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "The partial APC message does not conform to the mqtt proto definition. Dropping the message.",
    );
  }
  if (mqttMessage == null) {
    return result;
  }
  const uniqueVehicleId = getUniqueVehicleIdFromMqttTopic(mqttMessage.topic);
  if (uniqueVehicleId == null) {
    logger.warn(
      {
        mqttTopic: mqttMessage.topic,
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "Could not extract unique vehicle ID from MQTT topic",
    );
    return result;
  }
  const payloadString = mqttMessage.payload.toString();
  let data;
  try {
    data = partialApc.Convert.toPartialApc(payloadString).APC;
  } catch (errConvertPartialApc) {
    logger.warn(
      {
        err: errConvertPartialApc,
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "The partial APC message does not match the expected partial APC JSON structure. Dropping the message.",
    );
  }
  if (data == null) {
    return result;
  }
  result = {
    type: "partialApc" as const,
    data,
    messageId,
    mqttTopic: mqttMessage.topic,
    eventTimestamp,
    uniqueVehicleId,
  };
  return result;
};
