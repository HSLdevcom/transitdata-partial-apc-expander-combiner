import { hfp } from "../../src/protobuf/hfp";
import { mqtt } from "../../src/protobuf/mqtt";
import * as partialApc from "../../src/quicktype/partialApc";
import decodeWithoutDefaults from "../../src/util/protobufUtil";
import { parseHfpLine, parsePartialApcLine } from "./mqttDumpParsing";
import {
  mockHfpProducerMessage,
  mockPartialApcProducerMessage,
} from "./pulsarMocking";

describe("Test MQTT dump parsing", () => {
  test("parsePartialApcLine with typical input", () => {
    const input =
      '2023-10-29T12:28:10.671421Z /hfp/v2/journey/ongoing/apc-partial/bus/0012/01913 {"APC":{"tst":"2023-10-29T12:28:04Z","lat":60.1693,"long":24.932238,"vehiclecounts":{"vehicleload":32,"doorcounts":[{"door":"1","count":[{"class":"adult","in":1,"out":0}]},{"door":"2","count":[{"class":"adult","in":3,"out":2}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"0d35d30f-84be-22ac-8c0f-584cda7bba0a"}}';
    const expectedEventTimestamp = new Date(
      "2023-10-29T12:28:10.671421Z",
    ).getTime();
    const expectedOutput = mockPartialApcProducerMessage({
      content: {
        APC: {
          schemaVersion: "1-1-0",
          messageId: "0d35d30f-84be-22ac-8c0f-584cda7bba0a",
          tst: "2023-10-29T12:28:04Z",
          lat: 60.1693,
          long: 24.932238,
          vehiclecounts: {
            countquality: "regular",
            vehicleload: 32,
            doorcounts: [
              {
                door: "1",
                count: [{ class: "adult", in: 1, out: 0 }],
              },
              {
                door: "2",
                count: [{ class: "adult", in: 3, out: 2 }],
              },
            ],
          },
        },
      },
      mqttTopic: "/hfp/v2/journey/ongoing/apc-partial/bus/0012/01913",
      eventTimestamp: expectedEventTimestamp,
    });
    // As we are wrapping JSON, the order of keys in the serialization matters.
    // Therefore test the individual parts and not the final Buffers.
    const parsed = parsePartialApcLine(input);
    const decoded = decodeWithoutDefaults(mqtt.RawMessage, parsed.data);
    const content = JSON.parse(
      decoded.payload.toString(),
    ) as partialApc.PartialApc;
    const expectedDecoded = decodeWithoutDefaults(
      mqtt.RawMessage,
      expectedOutput.data,
    );
    const expectedContent = JSON.parse(
      expectedDecoded.payload.toString(),
    ) as partialApc.PartialApc;
    expect(decoded.SchemaVersion).toStrictEqual(expectedDecoded.SchemaVersion);
    expect(decoded.topic).toStrictEqual(expectedDecoded.topic);
    expect(content).toStrictEqual(expectedContent);
  });

  test("parseHfpLine with typical input", () => {
    const input =
      '2023-10-23T13:42:42.794243Z /hfp/v2/journey/ongoing/vp/bus/0018/01003/5520/2/Matinkylä (M)/15:56/2323253/4/60;24/17/63/84 {"VP":{"desi":"520","dir":"2","oper":6,"veh":1003,"tst":"2023-10-23T13:42:42.728Z","tsi":1698068562,"spd":8.49,"hdg":156,"lat":60.168786,"long":24.734465,"acc":-1.29,"dl":-101,"odo":20729,"drst":0,"oday":"2023-10-23","jrn":812,"line":1110,"start":"15:56","loc":"GPS","stop":2323253,"route":"5520","occu":0}}';
    const expectedEventTimestamp = new Date(
      "2023-10-23T13:42:42.794243Z",
    ).getTime();
    const expectedOutput = mockHfpProducerMessage({
      hfpData: {
        SchemaVersion: 1,
        topic: {
          SchemaVersion: 1,
          receivedAt: expectedEventTimestamp,
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
          stop: 2323253,
          route: "5520",
          occu: 0,
        },
      },
      eventTimestamp: expectedEventTimestamp,
    });
    expect(parseHfpLine(input)).toStrictEqual(expectedOutput);
  });

  test("parseHfpLine with payload stop 'null'", () => {
    const input =
      '2023-10-23T13:42:42.794243Z /hfp/v2/journey/ongoing/vp/bus/0018/01003/5520/2/Matinkylä (M)/15:56/2323253/4/60;24/17/63/84 {"VP":{"desi":"520","dir":"2","oper":6,"veh":1003,"tst":"2023-10-23T13:42:42.728Z","tsi":1698068562,"spd":8.49,"hdg":156,"lat":60.168786,"long":24.734465,"acc":-1.29,"dl":-101,"odo":20729,"drst":0,"oday":"2023-10-23","jrn":812,"line":1110,"start":"15:56","loc":"GPS","stop":null,"route":"5520","occu":0}}';
    const expectedEventTimestamp = new Date(
      "2023-10-23T13:42:42.794243Z",
    ).getTime();
    const expectedOutput = mockHfpProducerMessage({
      hfpData: {
        SchemaVersion: 1,
        topic: {
          SchemaVersion: 1,
          receivedAt: expectedEventTimestamp,
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
      eventTimestamp: expectedEventTimestamp,
    });
    expect(parseHfpLine(input)).toStrictEqual(expectedOutput);
  });
});
