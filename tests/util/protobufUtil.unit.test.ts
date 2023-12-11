import { hfp } from "../../src/protobuf/hfp";
import { mqtt } from "../../src/protobuf/mqtt";
import decodeWithoutDefaults from "../../src/util/protobufUtil";

describe("decodeWithoutDefaults", () => {
  test("decode HFP message with payload stop 'null'", () => {
    const hfpData = {
      SchemaVersion: 1,
      topic: {
        SchemaVersion: 1,
        receivedAt: new Date("2023-10-23T13:42:42.794243Z").getTime(),
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
    };
    const verificationErrorMessage = hfp.Data.verify(hfpData);
    expect(verificationErrorMessage).toBeNull();
    const encoded = hfp.Data.encode(hfp.Data.create(hfpData)).finish();
    const withDefaults = hfp.Data.decode(encoded);
    const noDefaults = decodeWithoutDefaults(hfp.Data, encoded);
    expect(withDefaults.payload).toHaveProperty("stop");
    expect(withDefaults.payload.stop).toBeDefined();
    expect(withDefaults.payload.stop).toStrictEqual(0);
    expect(withDefaults.payload.loc).toStrictEqual(expect.any(Number));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(noDefaults.payload.stop).toBeUndefined();
    expect(noDefaults.payload).not.toHaveProperty("stop");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(noDefaults.payload.loc).toStrictEqual(expect.any(Number));
    // Change Longs to Numbers so that toMatchObject succeeds.
    withDefaults.payload.tsi = Number(withDefaults.payload.tsi);
    if (withDefaults.topic?.receivedAt != null) {
      withDefaults.topic.receivedAt = Number(withDefaults.topic.receivedAt);
    }
    expect(withDefaults).toMatchObject(noDefaults);
  });

  test("decode MQTT message with missing topic", () => {
    const mqttMessage = {
      SchemaVersion: 1,
      payload: Buffer.from("foo", "utf8"),
    };
    const verificationErrorMessage = mqtt.RawMessage.verify(mqttMessage);
    expect(verificationErrorMessage).toBeNull();
    const encoded = mqtt.RawMessage.encode(
      mqtt.RawMessage.create(mqttMessage),
    ).finish();
    const withDefaults = mqtt.RawMessage.decode(encoded);
    const noDefaults = decodeWithoutDefaults(mqtt.RawMessage, encoded);
    expect(withDefaults).toHaveProperty("topic");
    expect(withDefaults.topic).toBeDefined();
    expect(withDefaults.topic).toStrictEqual("");
    expect(noDefaults).not.toHaveProperty("topic");
    expect(noDefaults.topic).toBeUndefined();
    expect(withDefaults).toMatchObject(noDefaults);
  });
});
