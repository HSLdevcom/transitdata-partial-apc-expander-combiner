import type Pulsar from "pulsar-client";
import { hfp } from "../../src/protobuf/hfp";
import type * as partialApc from "../../src/quicktype/partialApc";
import { MqttDumpLine, MqttHfpPayload } from "../types";
import {
  mockHfpProducerMessage,
  mockPartialApcProducerMessage,
} from "./pulsarMocking";

// Solution for array length type-checking from
// https://stackoverflow.com/a/69370003
// on 2023-10-26.
type Indices<L extends number, T extends number[] = []> = T["length"] extends L
  ? T[number]
  : Indices<L, [T["length"], ...T]>;
type LengthAtLeast<T extends readonly unknown[], L extends number> = Pick<
  Required<T>,
  Indices<L>
>;
function hasLengthAtLeast<T extends readonly unknown[], L extends number>(
  arr: T,
  len: L,
): arr is T & LengthAtLeast<T, L> {
  return arr.length >= len;
}

const parseHfpJourneyType = (journeyType: string): hfp.Topic.JourneyType => {
  switch (journeyType) {
    case "journey":
      return hfp.Topic.JourneyType.journey;
    case "deadrun":
      return hfp.Topic.JourneyType.deadrun;
    case "signoff":
      return hfp.Topic.JourneyType.signoff;
    default: {
      const exhaustiveCheck: never = journeyType as never;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const parseHfpEventType = (eventType: string): hfp.Topic.EventType => {
  switch (eventType) {
    case "vp":
      return hfp.Topic.EventType.VP;
    case "due":
      return hfp.Topic.EventType.DUE;
    case "arr":
      return hfp.Topic.EventType.ARR;
    case "ars":
      return hfp.Topic.EventType.ARS;
    case "pde":
      return hfp.Topic.EventType.PDE;
    case "dep":
      return hfp.Topic.EventType.DEP;
    case "pas":
      return hfp.Topic.EventType.PAS;
    case "wait":
      return hfp.Topic.EventType.WAIT;
    case "doo":
      return hfp.Topic.EventType.DOO;
    case "doc":
      return hfp.Topic.EventType.DOC;
    case "tlr":
      return hfp.Topic.EventType.TLR;
    case "tla":
      return hfp.Topic.EventType.TLA;
    case "da":
      return hfp.Topic.EventType.DA;
    case "dout":
      return hfp.Topic.EventType.DOUT;
    case "ba":
      return hfp.Topic.EventType.BA;
    case "bout":
      return hfp.Topic.EventType.BOUT;
    case "vja":
      return hfp.Topic.EventType.VJA;
    case "vjout":
      return hfp.Topic.EventType.VJOUT;
    default: {
      const exhaustiveCheck: never = eventType as never;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const parseHfpTransportMode = (
  transportMode: string,
): hfp.Topic.TransportMode => {
  switch (transportMode) {
    case "bus":
      return hfp.Topic.TransportMode.bus;
    case "train":
      return hfp.Topic.TransportMode.train;
    case "tram":
      return hfp.Topic.TransportMode.tram;
    case "metro":
      return hfp.Topic.TransportMode.metro;
    case "ferry":
      return hfp.Topic.TransportMode.ferry;
    case "ubus":
      return hfp.Topic.TransportMode.ubus;
    case "robot":
      return hfp.Topic.TransportMode.robot;
    default: {
      const exhaustiveCheck: never = transportMode as never;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const parseHfpGeoHash = (parts: string[]) => {
  if (!hasLengthAtLeast(parts, 2)) {
    throw new Error(
      `Geohash needs at least two levels. This was given: ${
        parts.length === 1 ? parts[0] : ""
      }`,
    );
  }
  const latLon = parts[0].split(";");
  if (latLon.length !== 2) {
    throw new Error(
      "The first level in geohash needs to have two parts separated by ';'",
    );
  }
  const latArray = [latLon[0]];
  const lonArray = [latLon[1]];
  latArray.push(".");
  lonArray.push(".");
  parts.slice(1).forEach((elem) => {
    const latElem = elem[0];
    const lonElem = elem[1];
    latArray.push(latElem);
    lonArray.push(lonElem);
  });
  const latitude = parseFloat(latArray.join(""));
  const longitude = parseFloat(lonArray.join(""));
  return {
    latitude,
    longitude,
  };
};

const parseHfpTopic = (timestamp: Date, topic: string): hfp.ITopic => {
  const parts = topic.split("/");
  if (hasLengthAtLeast(parts, 9)) {
    const journeyType = parseHfpJourneyType(parts[3]);
    const temporalType =
      parts[4] === "ongoing"
        ? hfp.Topic.TemporalType.ongoing
        : hfp.Topic.TemporalType.upcoming;
    const eventType = parseHfpEventType(parts[5]);
    const transportMode = parseHfpTransportMode(parts[6]);
    const operatorId = parseInt(parts[7], 10);
    const vehicleNumber = parseInt(parts[8], 10);
    const base = {
      SchemaVersion: 1,
      receivedAt: timestamp.getTime(),
      topicPrefix: `/${parts[1]}/`,
      topicVersion: parts[2],
      journeyType,
      temporalType,
      eventType,
      transportMode,
      operatorId,
      vehicleNumber,
      uniqueVehicleId: `${operatorId.toString()}/${vehicleNumber.toString()}`,
    };
    if (parts.length === 9) {
      return base;
    }
    if (hasLengthAtLeast(parts, 19)) {
      if (parts.length === 19) {
        return {
          ...base,
          ...{
            routeId: parts[9],
            directionId: parseInt(parts[10], 10),
            headsign: parts[11],
            startTime: parts[12],
            nextStop: parts[13],
            geohashLevel: parseInt(parts[14], 10),
          },
          ...parseHfpGeoHash(parts.slice(15)),
        };
      }
    }
  }
  throw new Error("TLP messages are not supported");
};

const parseHfpLoc = (loc: string): hfp.Payload.LocationQualityMethod => {
  switch (loc) {
    case "GPS":
      return hfp.Payload.LocationQualityMethod.GPS;
    case "ODO":
      return hfp.Payload.LocationQualityMethod.ODO;
    case "MAN":
      return hfp.Payload.LocationQualityMethod.MAN;
    case "DR":
      // FIXME: The protobuf schema does not contain a matching type so
      // substitute.
      return hfp.Payload.LocationQualityMethod.ODO;
    case "N/A":
      return hfp.Payload.LocationQualityMethod.NA;
    default: {
      const exhaustiveCheck: never = loc as never;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

const parseHfpPayload = (payload: MqttHfpPayload): hfp.IPayload => {
  const keys = Object.keys(payload);
  if (hasLengthAtLeast(keys, 1) && keys.length < 2) {
    const key = keys[0];
    const innerPayload = payload[key];
    if (innerPayload != null) {
      const loc = parseHfpLoc(innerPayload.loc);
      const result = { ...innerPayload, loc, SchemaVersion: 1 };
      return result;
    }
  }
  throw new Error("hfpPayload object must have exactly one key");
};

const parseMqttDumpLine = (
  line: MqttDumpLine,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): {
  timestamp: Date;
  topicString: string;
  payloadObject: Record<string, unknown>;
} => {
  const othersAndPayload = line.split("{");
  if (hasLengthAtLeast(othersAndPayload, 2)) {
    const payloadString = `{${othersAndPayload.slice(1).join("{")}`;
    const payloadObject = JSON.parse(payloadString) as Record<string, unknown>;
    const timestampAndTopic = othersAndPayload[0].split(" ");
    if (hasLengthAtLeast(timestampAndTopic, 2)) {
      const timestamp = new Date(timestampAndTopic[0]);
      const topicString = timestampAndTopic.slice(1).join(" ").slice(0, -1);
      return {
        timestamp,
        topicString,
        payloadObject,
      };
    }
  }
  throw new Error(
    "An MQTT dump line must have a UTC timestamp with microseconds and 'Z' suffix, an MQTT topic and a JSON object, each separated by a single space",
  );
};

export const parseHfpLine = (line: MqttDumpLine): Pulsar.ProducerMessage => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { timestamp, topicString, payloadObject } = parseMqttDumpLine(line);
  const topic = parseHfpTopic(timestamp, topicString);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const payload = parseHfpPayload(payloadObject as MqttHfpPayload);
  const message = mockHfpProducerMessage({
    hfpData: {
      SchemaVersion: 1,
      topic,
      payload,
    },
    eventTimestamp: timestamp.getTime(),
  });
  return message;
};

export const parsePartialApcLine = (
  line: MqttDumpLine,
): Pulsar.ProducerMessage => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { timestamp, topicString, payloadObject } = parseMqttDumpLine(line);
  const message = mockPartialApcProducerMessage({
    content: payloadObject as unknown as partialApc.PartialApc,
    mqttTopic: topicString,
    eventTimestamp: timestamp.getTime(),
  });
  return message;
};
