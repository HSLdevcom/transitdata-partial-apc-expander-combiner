import pino from "pino";
import Pulsar from "pulsar-client";
import {
  getUniqueVehicleIdFromHfpTopic,
  getUniqueVehicleIdFromMqttTopic,
  initializeMatching,
  pickLowerQuality,
  sumDoorCounts,
} from "./matching";
import type * as partialApc from "./partialApc";
import { hfp } from "./protobuf/hfp";
import { mqtt } from "./protobuf/mqtt";
import { passengerCount } from "./protobuf/passengerCount";

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

test("Pick the lower quality from two quality levels", () => {
  expect(pickLowerQuality("regular", "regular")).toBe("regular");
  expect(pickLowerQuality("regular", "defect")).toBe("defect");
  expect(pickLowerQuality("regular", "other")).toBe("other");
  expect(pickLowerQuality("regular", "foo")).toBe("other");
  expect(pickLowerQuality("defect", "regular")).toBe("defect");
  expect(pickLowerQuality("defect", "defect")).toBe("defect");
  expect(pickLowerQuality("defect", "other")).toBe("other");
  expect(pickLowerQuality("defect", "foo")).toBe("other");
  expect(pickLowerQuality("other", "regular")).toBe("other");
  expect(pickLowerQuality("other", "defect")).toBe("other");
  expect(pickLowerQuality("other", "other")).toBe("other");
  expect(pickLowerQuality("other", "foo")).toBe("other");
  expect(pickLowerQuality("foo", "regular")).toBe("other");
  expect(pickLowerQuality("foo", "defect")).toBe("other");
  expect(pickLowerQuality("foo", "other")).toBe("other");
  expect(pickLowerQuality("foo", "foo")).toBe("other");
});

describe("Sum door counts", () => {
  test("Add door counts for the same door and class", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "adult", in: 4, out: 1 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 5, out: 3 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add door counts only for a new class", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    const expected = [
      {
        door: "1",
        count: [
          { class: "adult", in: 1, out: 2 },
          { class: "child", in: 4, out: 1 },
        ],
      },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add door counts only for a new door", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 1, out: 2 }] },
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add door counts for an existing and a new door", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "adult", in: 1, out: 1 }] },
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 2, out: 3 }] },
      { door: "2", count: [{ class: "child", in: 4, out: 1 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("Add zero values", () => {
    const cached = [{ door: "1", count: [{ class: "adult", in: 1, out: 2 }] }];
    const toBeAdded = [
      { door: "1", count: [{ class: "adult", in: 0, out: 0 }] },
      { door: "2", count: [{ class: "pram", in: 0, out: 0 }] },
    ];
    const expected = [
      { door: "1", count: [{ class: "adult", in: 1, out: 2 }] },
      { door: "2", count: [{ class: "pram", in: 0, out: 0 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });

  test("A complicated example", () => {
    const cached = [
      {
        door: "1",
        count: [
          { class: "adult", in: 1, out: 1 },
          { class: "child", in: 3, out: 1 },
        ],
      },
      { door: "2", count: [{ class: "adult", in: 1, out: 1 }] },
    ];
    const toBeAdded = [
      {
        door: "1",
        count: [
          { class: "child", in: 3, out: 1 },
          { class: "pram", in: 0, out: 0 },
        ],
      },
      { door: "2", count: [{ class: "child", in: 0, out: 2 }] },
      { door: "4", count: [{ class: "pram", in: 1, out: 0 }] },
    ];
    const expected = [
      {
        door: "1",
        count: [
          { class: "adult", in: 1, out: 1 },
          { class: "child", in: 6, out: 2 },
          { class: "pram", in: 0, out: 0 },
        ],
      },
      {
        door: "2",
        count: [
          { class: "adult", in: 1, out: 1 },
          { class: "child", in: 0, out: 2 },
        ],
      },
      { door: "4", count: [{ class: "pram", in: 1, out: 0 }] },
    ];
    expect(sumDoorCounts(cached, toBeAdded)).toStrictEqual(expected);
  });
});

const mockPulsarMessage = ({
  buffer,
  eventTimestamp,
}: {
  buffer: Buffer;
  eventTimestamp: number;
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
  });
  return message;
};

const mockPartialApcMessage = ({
  content,
  mqttTopic,
  eventTimestamp,
}: {
  content: partialApc.PartialApc;
  mqttTopic: string;
  eventTimestamp: number;
}): Pulsar.Message => {
  const mqttMessage = {
    SchemaVersion: 1,
    topic: mqttTopic,
    payload: Buffer.from(JSON.stringify(content), "utf8"),
  };
  const verificationErrorMessage = mqtt.RawMessage.verify(mqttMessage);
  if (verificationErrorMessage) {
    throw Error(verificationErrorMessage);
  }
  const buffer = Buffer.from(
    mqtt.RawMessage.encode(mqtt.RawMessage.create(mqttMessage)).finish()
  );
  return mockPulsarMessage({ buffer, eventTimestamp });
};

const mockHfpMessage = ({
  hfpData,
  eventTimestamp,
}: {
  hfpData: hfp.IData;
  eventTimestamp: number;
}): Pulsar.Message => {
  const verificationErrorMessage = hfp.Data.verify(hfpData);
  if (verificationErrorMessage) {
    throw Error(verificationErrorMessage);
  }
  const buffer = Buffer.from(
    hfp.Data.encode(hfp.Data.create(hfpData)).finish()
  );
  return mockPulsarMessage({ buffer, eventTimestamp });
};

const mockApcMessage = ({
  apcData,
  eventTimestamp,
}: {
  apcData: passengerCount.IData;
  eventTimestamp: number;
}): Pulsar.ProducerMessage => {
  const verificationErrorMessage = passengerCount.Data.verify(apcData);
  if (verificationErrorMessage) {
    throw Error(verificationErrorMessage);
  }
  const data = Buffer.from(
    passengerCount.Data.encode(passengerCount.Data.create(apcData)).finish()
  );
  return { data, eventTimestamp };
};

describe("Cache and trigger sending", () => {
  // The code to test uses a callback instead of a Promise so we should use the
  // done callback to test it.
  // eslint-disable-next-line jest/no-done-callback
  test("Cache two partial APC messages and form a full APC message from an HFP message", (done) => {
    const logger = pino({
      name: "test-logger",
      timestamp: pino.stdTimeFunctions.isoTime,
      sync: true,
    });
    const processingConfig = {
      // 5000 ms is the normal jest timeout. Let's go under that.
      apcWaitInSeconds: 0.1,
      vehicleCapacities: new Map([
        ["0001/00001", 67],
        ["0012/00123", 56],
      ]),
      defaultVehicleCapacity: 78,
    };
    const { updateApcCache, expandWithApcAndSend } = initializeMatching(
      logger,
      processingConfig
    );
    const partialApcMessage1 = mockPartialApcMessage({
      content: {
        APC: {
          schemaVersion: "1-1-0",
          oper: 22,
          veh: 758,
          messageId: "06e64ba5-e555-4e2f-b8b4-b57bc69e8b99",
          tst: new Date("2022-08-15T10:57:08.647Z"),
          lat: 24.9435,
          long: 60.1967,
          vehiclecounts: {
            countquality: "regular",
            vehicleload: 15,
            doorcounts: [
              {
                door: "door1",
                count: [{ class: "adult", in: 3, out: 0 }],
              },
              {
                door: "door2",
                count: [
                  { class: "adult", in: 0, out: 2 },
                  { class: "pram", in: 1, out: 0 },
                ],
              },
            ],
          },
        },
      },
      mqttTopic: "/hfp/v2/journey/ongoing/apc/bus/0022/00758",
      eventTimestamp: 1660731500000,
    });
    const lastPartialApcTst = new Date("2022-08-15T10:57:09.942Z");
    const partialApcMessage2 = mockPartialApcMessage({
      content: {
        APC: {
          schemaVersion: "1-1-0",
          oper: 22,
          veh: 758,
          messageId: "06e64ba5-e555-4e2f-b8b4-b97bc69e8b99",
          tst: lastPartialApcTst,
          lat: 24.9434,
          long: 60.1968,
          vehiclecounts: {
            countquality: "regular",
            vehicleload: 16,
            doorcounts: [
              {
                door: "door1",
                count: [{ class: "adult", in: 1, out: 0 }],
              },
              {
                door: "door2",
                count: [
                  { class: "adult", in: 1, out: 0 },
                  { class: "pram", in: 0, out: 1 },
                ],
              },
            ],
          },
        },
      },
      mqttTopic: "/hfp/v2/journey/ongoing/apc/bus/0022/00758",
      eventTimestamp: 1660731501000,
    });
    const hfpMessage = mockHfpMessage({
      hfpData: {
        SchemaVersion: 1,
        topic: {
          SchemaVersion: 1,
          receivedAt: 1660731510000,
          topicPrefix: "/hfp/",
          topicVersion: "v2",
          journeyType: hfp.Topic.JourneyType.journey,
          temporalType: hfp.Topic.TemporalType.ongoing,
          eventType: hfp.Topic.EventType.PDE,
          transportMode: hfp.Topic.TransportMode.bus,
          operatorId: 22,
          vehicleNumber: 758,
          uniqueVehicleId: "22/758",
          routeId: "2550",
          directionId: 2,
          headsign: "Itäkeskus(M)",
          startTime: "08:50",
          nextStop: "1361102",
          geohashLevel: 4,
          latitude: 60.224,
          longitude: 25.014,
        },
        payload: {
          SchemaVersion: 1,
          desi: "550",
          dir: "2",
          oper: 22,
          veh: 758,
          tst: "2022-08-15T10:57:13.035Z",
          tsi: 1660731510,
          spd: 12.09,
          hdg: 124,
          lat: 60.224338,
          long: 25.014406,
          acc: 0.63,
          dl: -180,
          odo: 2147483647,
          drst: null,
          oday: "2022-08-15",
          jrn: 1281,
          line: 261,
          start: "08:50",
          loc: hfp.Payload.LocationQualityMethod.GPS,
          stop: 1361102,
          route: "2550",
          occu: 0,
          ttarr: "2022-06-20T06:43:00.000Z",
          ttdep: "2022-06-20T06:43:00.000Z",
        },
      },
      eventTimestamp: 1660731510000,
    });
    const expectedApcMessage = mockApcMessage({
      apcData: {
        SchemaVersion: 1,
        topic: "/hfp/v2/journey/ongoing/apc/bus/0022/00758",
        payload: {
          desi: "550",
          dir: "2",
          oper: 22,
          veh: 758,
          tst: Math.floor(lastPartialApcTst.getTime() / 1000),
          tsi: Math.floor(lastPartialApcTst.getTime() / 1000),
          lat: 24.9434,
          long: 60.1968,
          odo: 2147483647,
          oday: "2022-08-15",
          jrn: 1281,
          line: 261,
          start: "08:50",
          loc: "GPS",
          stop: 1361102,
          route: "2550",
          vehicleCounts: {
            countQuality: "regular",
            vehicleLoad: 16,
            vehicleLoadRatio: 0.2051282,
            doorCounts: [
              {
                door: "door1",
                count: [{ clazz: "adult", in: 4, out: 0 }],
              },
              {
                door: "door2",
                count: [
                  { clazz: "adult", in: 1, out: 2 },
                  { clazz: "pram", in: 1, out: 1 },
                ],
              },
            ],
          },
        },
      },
      eventTimestamp: 1660731501000,
    });
    updateApcCache(partialApcMessage1);
    updateApcCache(partialApcMessage2);
    expandWithApcAndSend(hfpMessage, (result) => {
      try {
        const resultData = passengerCount.Data.decode(result.data);
        const expectedData = passengerCount.Data.decode(
          expectedApcMessage.data
        );
        expect(resultData.payload.vehicleCounts?.vehicleLoadRatio).toBeCloseTo(
          expectedData.payload.vehicleCounts?.vehicleLoadRatio as number
        );
        delete resultData.payload.vehicleCounts?.vehicleLoadRatio;
        delete expectedData.payload.vehicleCounts?.vehicleLoadRatio;
        expect(resultData).toStrictEqual(expectedData);
        expect(result.eventTimestamp).toStrictEqual(
          expectedApcMessage.eventTimestamp
        );
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
