import formProducerMessage from "../../src/businessLogic/producerMessageForming";
import { hfp } from "../../src/protobuf/hfp";
import { passengerCount } from "../../src/protobuf/passengerCount";
import { PartialApcItem, ServiceJourneyStop } from "../../src/types";

describe("formProducerMessage", () => {
  test("oper value null does not lead to zero", () => {
    const vehicleCapacity = 100;
    const hfpData: hfp.IData = {
      SchemaVersion: 1,
      topic: {
        SchemaVersion: 1,
        receivedAt: 123,
        topicPrefix: "/hfp/",
        topicVersion: "v2",
        journeyType: hfp.Topic.JourneyType.journey,
        temporalType: hfp.Topic.TemporalType.ongoing,
        eventType: hfp.Topic.EventType.VJOUT,
        transportMode: hfp.Topic.TransportMode.bus,
        operatorId: 18,
        vehicleNumber: 1028,
        uniqueVehicleId: "18/1028",
        routeId: "1500",
        directionId: 1,
        headsign: "Munkkivuori",
        startTime: "16:17",
        nextStop: "EOL",
        geohashLevel: 4,
        latitude: 60.205,
        longitude: 24.876,
      },
      payload: {
        SchemaVersion: 1,
        desi: null,
        dir: null,
        oper: null,
        veh: 1028,
        tst: "2024-02-11T15:05:54.661Z",
        tsi: 1707663954,
        spd: 4.06,
        hdg: 301,
        lat: 60.205475,
        long: 24.876274,
        acc: -1.08,
        dl: null,
        odo: 15597,
        drst: 0,
        oday: null,
        jrn: null,
        line: null,
        start: null,
        loc: hfp.Payload.LocationQualityMethod.GPS,
        stop: 123,
        route: "1500",
        occu: 0,
      },
    };
    const partialApcItem: PartialApcItem = {
      apc: {
        tst: "2024-02-11T15:07:29Z",
        lat: 60.20546,
        long: 24.87675,
        vehiclecounts: {
          vehicleload: 2,
          doorcounts: [
            { door: "1", count: [{ class: "adult", in: 0, out: 3 }] },
            { door: "2", count: [{ class: "adult", in: 0, out: 3 }] },
            { door: "3", count: [{ class: "adult", in: 0, out: 3 }] },
          ],
          countquality: "regular",
        },
        schemaVersion: "1-1-0",
        messageId: "a64be8d1-174f-4ae0-8ff2-ec600fd9f134",
      },
      mqttTopic: "/hfp/v2/journey/ongoing/apc-partial/bus/0018/01028",
      eventTimestamp: 100,
    };
    const expectedData: passengerCount.IData = {
      SchemaVersion: 1,
      topic: "/hfp/v2/journey/ongoing/apc-partial/bus/0018/01028",
      payload: {
        veh: 1028,
        odo: 15597,
        loc: "GPS",
        route: "1500",
        dir: "1",
        tst: 1707664049,
        tsi: 1707664049,
        lat: 60.20546,
        long: 24.87675,
        oday: "2024-02-11",
        start: "16:17",
        stop: 123,
        vehicleCounts: {
          vehicleLoad: 2,
          vehicleLoadRatio: 0.02,
          doorCounts: [
            { door: "1", count: [{ clazz: "adult", in: 0, out: 3 }] },
            { door: "2", count: [{ clazz: "adult", in: 0, out: 3 }] },
            { door: "3", count: [{ clazz: "adult", in: 0, out: 3 }] },
          ],
          countQuality: "regular",
        },
      },
    };
    const serviceJourneyStop: ServiceJourneyStop = {
      serviceJourneyId: {
        operatingDay: "2024-02-11",
        startTime: "16:17",
        route: "1500",
        direction: 1,
      },
      currentStop: 123,
    };
    const result = formProducerMessage(
      vehicleCapacity,
      hfpData,
      partialApcItem,
      serviceJourneyStop,
    );
    const resultData = passengerCount.Data.toObject(
      passengerCount.Data.decode(result.data),
      { longs: Number },
    );
    expect(resultData).toStrictEqual(expectedData);
  });
});
