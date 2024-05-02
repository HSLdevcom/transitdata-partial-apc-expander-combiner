import type pino from "pino";
import type Pulsar from "pulsar-client";
import { hfp } from "../protobuf/hfp";
import { mqtt } from "../protobuf/mqtt";
import * as partialApc from "../quicktype/partialApc";
import type {
  HfpInboxQueueMessage,
  PartialApcInboxQueueMessage,
  StopState,
  UniqueVehicleId,
  VehicleJourneyId,
} from "../types";
import decodeWithoutDefaults from "../util/protobufUtil";

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

export const getVehicleJourneyId = (
  logger: pino.Logger,
  hfpData: hfp.IData,
  hfpDataTopic: hfp.ITopic,
  hfpDataPayload: hfp.IPayload,
): VehicleJourneyId | undefined => {
  if (hfpDataTopic.journeyType === hfp.Topic.JourneyType.deadrun) {
    return hfp.Topic.JourneyType.deadrun;
  }

  const { startTime, routeId, directionId } = hfpDataTopic;
  const { oday, start, route, dir } = hfpDataPayload;

  const currentOperatingDay = oday;
  if (currentOperatingDay == null) {
    logger.warn(
      { hfpData },
      "HFP message payload is missing oday. Dropping the message.",
    );
    return undefined;
  }
  const currentStartTime = startTime ?? start;
  if (currentStartTime == null) {
    logger.warn(
      { hfpData },
      "HFP message topic and payload are missing start time. Dropping the message.",
    );
    return undefined;
  }
  if (startTime !== start) {
    logger.warn(
      { hfpData },
      "HFP message payload property start differs from startTime in the topic. Preferring startTime.",
    );
  }
  const currentRoute = routeId ?? route;
  if (currentRoute == null) {
    logger.warn(
      { hfpData },
      "HFP message topic and payload are missing route. Dropping the message.",
    );
    return undefined;
  }
  if (routeId !== route) {
    logger.warn(
      { hfpData },
      "HFP message payload property route differs from routeId in the topic. Preferring routeId.",
    );
  }
  const payloadDirectionInt = dir != null ? parseInt(dir, 10) : null;
  const payloadDirection = Number.isFinite(payloadDirectionInt)
    ? payloadDirectionInt
    : null;
  const currentDirection = directionId ?? payloadDirection;
  if (currentDirection == null) {
    logger.warn(
      { hfpData },
      "HFP message topic and payload are missing direction. Dropping the message.",
    );
    return undefined;
  }
  if (directionId !== payloadDirection) {
    logger.warn(
      { hfpData },
      "HFP message payload property dir differs from directionId in the topic. Preferring directionId.",
    );
  }
  return {
    operatingDay: currentOperatingDay,
    startTime: currentStartTime,
    route: currentRoute,
    direction: currentDirection,
  };
};

export const getStops = (
  logger: pino.Logger,
  hfpData: hfp.IData,
  hfpDataTopic: hfp.ITopic,
  hfpDataPayload: hfp.IPayload,
  vehicleJourney: VehicleJourneyId,
): Partial<StopState> => {
  const { nextStop } = hfpDataTopic;
  const { stop } = hfpDataPayload;
  if (vehicleJourney !== hfp.Topic.JourneyType.deadrun && nextStop == null) {
    logger.info(
      { hfpData },
      "HFP message topic is missing next stop even when journeyType is journey. Continuing anyway.",
    );
  }
  return {
    ...(stop != null && { currentStop: stop.toString() }),
    ...(nextStop != null && { nextStop }),
  };
};

export const parseHfpPulsarMessage = (
  logger: pino.Logger,
  message: Pulsar.Message,
): HfpInboxQueueMessage | undefined => {
  const messageData = message.getData();
  const eventTimestamp = message.getEventTimestamp();
  const properties = { ...message.getProperties() };
  const messageId = message.getMessageId();
  let hfpData: hfp.IData | undefined;
  try {
    hfpData = decodeWithoutDefaults(hfp.Data, message.getData());
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
    return undefined;
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
    return undefined;
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
    return undefined;
  }
  if (hfpData.topic?.temporalType !== hfp.Topic.TemporalType.ongoing) {
    logger.debug(
      { hfpData },
      "HFP message temporal type is upcoming. Dropping the message.",
    );
    return undefined;
  }
  const vehicleJourneyId = getVehicleJourneyId(
    logger,
    hfpData,
    topic,
    hfpData.payload,
  );
  if (vehicleJourneyId == null) {
    return undefined;
  }
  const stops = getStops(
    logger,
    hfpData,
    topic,
    hfpData.payload,
    vehicleJourneyId,
  );
  return {
    messageId,
    eventTimestamp,
    uniqueVehicleId,
    type: "hfp" as const,
    vehicleJourneyId,
    stops,
    data: { ...hfpData, ...{ topic } },
  };
};

const replacePartialApcTopic = (topic: string) => {
  const parts = topic.split("/");
  parts[5] = "apc";
  return parts.join("/");
};

export const parsePartialApcPulsarMessage = (
  logger: pino.Logger,
  message: Pulsar.Message,
): PartialApcInboxQueueMessage | undefined => {
  const messageData = message.getData();
  const eventTimestamp = message.getEventTimestamp();
  const properties = { ...message.getProperties() };
  const messageId = message.getMessageId();
  let mqttMessage: mqtt.IRawMessage | undefined;
  try {
    mqttMessage = decodeWithoutDefaults(mqtt.RawMessage, messageData);
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
    return undefined;
  }
  if (mqttMessage.topic == null) {
    logger.warn(
      {
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "The partial APC message does not have an MQTT topic. Dropping the message.",
    );
    return undefined;
  }
  const uniqueVehicleId = getUniqueVehicleIdFromMqttTopic(mqttMessage.topic);
  // Prepare for the output MQTT topic already here.
  const mqttTopic = replacePartialApcTopic(mqttMessage.topic);
  if (uniqueVehicleId == null) {
    logger.warn(
      {
        mqttTopic: mqttMessage.topic,
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "Could not extract unique vehicle ID from MQTT topic. Dropping the message.",
    );
    return undefined;
  }
  if (mqttMessage.payload == null) {
    logger.warn(
      {
        properties,
        messageId: messageId.toString(),
        dataString: messageData.toString("utf8"),
        eventTimestamp,
      },
      "The partial APC message does not have an MQTT payload. Dropping the message.",
    );
    return undefined;
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
    return undefined;
  }
  return {
    messageId,
    eventTimestamp,
    uniqueVehicleId,
    type: "partialApc" as const,
    data,
    mqttTopic,
  };
};
