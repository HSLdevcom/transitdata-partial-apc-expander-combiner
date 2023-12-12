import pino from "pino";
import {
  getUniqueVehicleIdFromHfpTopic,
  getUniqueVehicleIdFromMqttTopic,
  parseHfpPulsarMessage,
} from "../src/messageParsing";
import { hfp } from "../src/protobuf/hfp";
import * as partialApc from "../src/quicktype/partialApc";
import { mockHfpMessage } from "./testUtil/pulsarMocking";

describe("Get unique vehicle IDs", () => {
  test("Get a unique vehicle ID from a valid MQTT topic", () => {
    const mqttTopic = "/hfp/v2/journey/ongoing/apc/bus/0022/00758";
    const uniqueVehicleId = "0022/00758";
    expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBe(uniqueVehicleId);
  });

  test("Get undefined instead of a unique vehicle ID from an invalid MQTT topic", () => {
    const mqttTopic = "/hfp/v2/journey/ongoing/foobar/0022/00758";
    expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBeUndefined();
  });

  test("Get a unique vehicle ID from a valid HFP topic", () => {
    const hfpTopic = {
      SchemaVersion: 1,
      receivedAt: 123,
      topicPrefix: "/hfp/",
      topicVersion: "v2",
      journeyType: hfp.Topic.JourneyType.journey,
      temporalType: hfp.Topic.TemporalType.ongoing,
      operatorId: 22,
      vehicleNumber: 758,
      uniqueVehicleId: "22/758",
    };
    const uniqueVehicleId = "0022/00758";
    expect(getUniqueVehicleIdFromHfpTopic(hfpTopic)).toBe(uniqueVehicleId);
  });
});

describe("Convert anonymized data", () => {
  const convertToPartial = (s: string): partialApc.PartialApc =>
    partialApc.Convert.toPartialApc(s);

  describe("partialApc", () => {
    test("First fixed data example", () => {
      const mqttPayload =
        '{"APC":{"tst":"2022-07-05T09:10:40.123Z","lat":55.55517,"long":12.918473,"vehiclecounts":{"vehicleload":3,"doorcounts":[{"door":"door1","count":[{"class":"adult","in":1,"out":0}]},{"door":"door2","count":[{"class":"adult","in":0,"out":0}]},{"door":"door3","count":[{"class":"adult","in":0,"out":2}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"05093457020702856023487297fe2b28"}}';
      expect(() => convertToPartial(mqttPayload)).not.toThrow();
    });
  });
});

describe("parseHfpPulsarMessage", () => {
  test("parse HFP message with payload stop 'null'", () => {
    const logger = pino(
      {
        name: "test-logger",
        timestamp: pino.stdTimeFunctions.isoTime,
        level: "debug",
      },
      pino.destination({ sync: true }),
    );
    const eventTimestamp = new Date("2023-10-23T13:42:42.794243Z").getTime();
    const input = mockHfpMessage({
      hfpData: {
        SchemaVersion: 1,
        topic: {
          SchemaVersion: 1,
          receivedAt: eventTimestamp,
          topicPrefix: "/hfp/",
          topicVersion: "v2",
          journeyType: hfp.Topic.JourneyType.journey,
          temporalType: hfp.Topic.TemporalType.ongoing,
          eventType: hfp.Topic.EventType.VP,
          transportMode: hfp.Topic.TransportMode.bus,
          operatorId: 18,
          vehicleNumber: 1003,
          uniqueVehicleId: "18/1003",
          routeId: "5520",
          directionId: 2,
          headsign: "Matinkylä (M)",
          startTime: "15:56",
          nextStop: "2323253",
          geohashLevel: 4,
          latitude: 60.168,
          longitude: 24.734,
        },
        payload: {
          SchemaVersion: 1,
          desi: "520",
          dir: "2",
          oper: 6,
          veh: 1003,
          tst: "2023-10-23T13:42:42.728Z",
          tsi: 1698068562,
          spd: 8.49,
          hdg: 156,
          lat: 60.168786,
          long: 24.734465,
          acc: -1.29,
          dl: -101,
          odo: 20729,
          drst: 0,
          oday: "2023-10-23",
          jrn: 812,
          line: 1110,
          start: "15:56",
          loc: hfp.Payload.LocationQualityMethod.GPS,
          stop: null,
          route: "5520",
          occu: 0,
        },
      },
      eventTimestamp,
      messageId: 1,
    });
    const expectedOutput = undefined;
    expect(parseHfpPulsarMessage(logger, input)).toStrictEqual(expectedOutput);
  });
});
