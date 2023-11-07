import pino from "pino";
import Pulsar from "pulsar-client";
import {
  getUniqueVehicleIdFromHfpTopic,
  getUniqueVehicleIdFromMqttTopic,
  initializeMatching,
  pickLowerQuality,
  sumDoorCounts,
} from "./matching";
import { hfp } from "./protobuf/hfp";
import { mqtt } from "./protobuf/mqtt";
import { passengerCount } from "./protobuf/passengerCount";
import * as partialApc from "./quicktype/partialApc";
import { ProcessingConfig } from "./types";

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
    mqtt.RawMessage.encode(mqtt.RawMessage.create(mqttMessage)).finish(),
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
    hfp.Data.encode(hfp.Data.create(hfpData)).finish(),
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
    passengerCount.Data.encode(passengerCount.Data.create(apcData)).finish(),
  );
  return { data, eventTimestamp };
};

describe("Cache and trigger sending", () => {
  // The code to test uses a callback instead of a Promise so we should use the
  // done callback to test it.
  // eslint-disable-next-line jest/no-done-callback
  test("Cache two partial APC messages and form a full APC message from an HFP message", (done) => {
    const logger = pino(
      {
        name: "test-logger",
        timestamp: pino.stdTimeFunctions.isoTime,
        level: process.env["PINO_LOG_LEVEL"] ?? "info",
      },
      pino.destination({ sync: true }),
    );
    jest.useFakeTimers();
    const processingConfig = {
      apcWaitInSeconds: 15,
      vehicleCapacities: new Map([
        ["0001/00001", 67],
        ["0012/00123", 56],
      ]),
      defaultVehicleCapacity: 78,
    };
    const { updateApcCache, expandWithApcAndSend } = initializeMatching(
      logger,
      processingConfig,
    );
    const partialApcMessage1 = mockPartialApcMessage({
      content: {
        APC: {
          schemaVersion: "1-1-0",
          messageId: "06e64ba5-e555-4e2f-b8b4-b57bc69e8b99",
          tst: "2022-08-15T10:57:08.647Z",
          lat: 60.1967,
          long: 24.9435,
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
    const lastPartialApcTst = "2022-08-15T10:57:09.942Z";
    const partialApcMessage2 = mockPartialApcMessage({
      content: {
        APC: {
          schemaVersion: "1-1-0",
          messageId: "06e64ba5-e555-4e2f-b8b4-b97bc69e8b99",
          tst: lastPartialApcTst,
          lat: 60.1968,
          long: 24.9434,
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
          tst: Math.floor(new Date(lastPartialApcTst).getTime() / 1000),
          tsi: Math.floor(new Date(lastPartialApcTst).getTime() / 1000),
          lat: 60.1968,
          long: 24.9434,
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
          expectedApcMessage.data,
        );
        expect(
          expectedData.payload.vehicleCounts?.vehicleLoadRatio,
        ).toBeDefined();
        if (expectedData.payload.vehicleCounts?.vehicleLoadRatio != null) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(
            resultData.payload.vehicleCounts?.vehicleLoadRatio,
          ).toBeCloseTo(expectedData.payload.vehicleCounts.vehicleLoadRatio);
        }
        delete resultData.payload.vehicleCounts?.vehicleLoadRatio;
        delete expectedData.payload.vehicleCounts?.vehicleLoadRatio;
        expect(resultData).toStrictEqual(expectedData);
        expect(result.eventTimestamp).toStrictEqual(
          expectedApcMessage.eventTimestamp,
        );
        done();
      } catch (error) {
        done(error);
      }
    });
    jest.runAllTimers();
  });
});

/**
 * These tests are meant to use realistic, sanitized data dumps without spending
 * a lot of time per test restructuring the data.
 *
 * The data dumps have a simple format. Each line represents one MQTT message.
 *
 * En example line is:
 * 2023-10-30T07:12:12.830452Z /hfp/v2/journey/ongoing/apc-partial/bus/0017/00022 {"APC":{"tst":"2023-10-30T07:12:07Z","lat":60.29105,"long":24.960594,"vehiclecounts":{"vehicleload":16,"doorcounts":[{"door":"1","count":[{"class":"adult","in":0,"out":0}]},{"door":"2","count":[{"class":"adult","in":0,"out":5}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"9c798e10-37ec-47aa-82db-bbca56c4cbbd"}}
 *
 * Each line starts with an ISO 8601 UTC timestamp with microseconds and the
 * suffix 'Z'. After a single space the MQTT topic follows. After a single space
 * the MQTT payload follows. As the MQTT topic might have spaces but no '{'
 * characters in it and as the MQTT payload is a JSON object, the start of the
 * payload can reliably be found by searching for the first '{' character.
 *
 * One way to collect these data dumps is by modifying and running the following
 * bash script, probably using an SSH tunnel:
 *
 * #!/bin/bash
 * #
 * # Collect MQTT messages. Dependencies:
 * # - stdbuf (coreutils)
 * # - mosquitto_sub (https://mosquitto.org/)
 * # - ts (https://joeyh.name/code/moreutils/)
 *
 * set -Eeuo pipefail
 *
 * mqtt_broker='ADD_MQTT_HOST_HERE'
 * mqtt_port='ADD_MQTT_PORT_HERE'
 * mqtt_topic_filter='ADD_MQTT_TOPIC_FILTER_HERE'
 * mqtt_client_id_prefix='ADD_MQTT_CLIENT_ID_PREFIX_HERE'
 *
 * timestamp="$(date --utc '+%Y%m%dT%H%M%SZ')"
 *
 * stdbuf -i 0 -o 0 -e 0 \
 *   mosquitto_sub \
 *   --host "${mqtt_broker}" \
 *   --port "${mqtt_port}" \
 *   --id-prefix "${mqtt_client_id_prefix}" \
 *   --qos 2 \
 *   --topic "${mqtt_topic_filter}" \
 *   --verbose \
 *   2>> "stderr_${timestamp}" |
 *   TZ=UTC ts '%Y-%m-%dT%H:%M:%.SZ' |
 *   while read -r line; do
 *     echo "${line}" >> "stdout_${timestamp}"
 *   done
 */
describe("Test using realistic, anonymized data dump extracts", () => {
  type MqttDumpLine = `${string} ${string} {${string}`;

  type MqttHfpPayload = Record<
    string,
    Omit<hfp.IPayload, "loc" | "SchemaVersion"> & {
      loc: string;
    }
  >;

  interface TimedTestMessage {
    message: Pulsar.Message;
    type: "partialApc" | "hfp";
    feedWaitInMilliseconds: number;
  }

  // Solution for array length type-checking from
  // https://stackoverflow.com/a/69370003
  // on 2023-10-26.
  type Indices<
    L extends number,
    T extends number[] = [],
  > = T["length"] extends L ? T[number] : Indices<L, [T["length"], ...T]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type LengthAtLeast<T extends readonly any[], L extends number> = Pick<
    Required<T>,
    Indices<L>
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hasLengthAtLeast<T extends readonly any[], L extends number>(
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
      const payloadObject = JSON.parse(payloadString) as Record<
        string,
        unknown
      >;
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

  const parseHfpLine = (line: MqttDumpLine): Pulsar.Message => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { timestamp, topicString, payloadObject } = parseMqttDumpLine(line);
    const topic = parseHfpTopic(timestamp, topicString);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const payload = parseHfpPayload(payloadObject as MqttHfpPayload);
    const message = mockHfpMessage({
      hfpData: {
        SchemaVersion: 1,
        topic,
        payload,
      },
      eventTimestamp: timestamp.getTime(),
    });
    return message;
  };

  const parsePartialApcLine = (line: MqttDumpLine): Pulsar.Message => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { timestamp, topicString, payloadObject } = parseMqttDumpLine(line);
    const message = mockPartialApcMessage({
      content: payloadObject as unknown as partialApc.PartialApc,
      mqttTopic: topicString,
      eventTimestamp: timestamp.getTime(),
    });
    return message;
  };

  test("parsePartialApcLine with typical input", () => {
    const input =
      '2023-10-29T12:28:10.671421Z /hfp/v2/journey/ongoing/apc-partial/bus/0012/01913 {"APC":{"tst":"2023-10-29T12:28:04Z","lat":60.1693,"long":24.932238,"vehiclecounts":{"vehicleload":32,"doorcounts":[{"door":"1","count":[{"class":"adult","in":1,"out":0}]},{"door":"2","count":[{"class":"adult","in":3,"out":2}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"0d35d30f-84be-22ac-8c0f-584cda7bba0a"}}';
    const expectedEventTimestamp = new Date(
      "2023-10-29T12:28:10.671421Z",
    ).getTime();
    const expectedOutput = mockPartialApcMessage({
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
      mqttTopic: "/hfp/v2/journey/ongoing/apc/bus/0012/01913",
      eventTimestamp: expectedEventTimestamp,
    });
    expect(parsePartialApcLine(input)).toStrictEqual(expectedOutput);
  });

  test("parseHfpLine with typical input", () => {
    const input =
      '2023-10-23T13:42:42.794243Z /hfp/v2/journey/ongoing/vp/bus/0018/01003/5520/2/Matinkylä (M)/15:56/2323253/4/60;24/17/63/84 {"VP":{"desi":"520","dir":"2","oper":6,"veh":1003,"tst":"2023-10-23T13:42:42.728Z","tsi":1698068562,"spd":8.49,"hdg":156,"lat":60.168786,"long":24.734465,"acc":-1.29,"dl":-101,"odo":20729,"drst":0,"oday":"2023-10-23","jrn":812,"line":1110,"start":"15:56","loc":"GPS","stop":2323253,"route":"5520","occu":0}}';
    const expectedEventTimestamp = new Date(
      "2023-10-23T13:42:42.794243Z",
    ).getTime();
    const expectedOutput = mockHfpMessage({
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

  const combinePartialApcAndHfpInputs = (
    partialApcInput: MqttDumpLine[],
    hfpInput: MqttDumpLine[],
  ): TimedTestMessage[] => {
    const partialApcMessages = partialApcInput.map((line) => {
      const message = parsePartialApcLine(line);
      return {
        message,
        eventTime: message.getEventTimestamp(),
        type: "partialApc" as TimedTestMessage["type"],
      };
    });
    const hfpMessages = hfpInput.map((line) => {
      const message = parseHfpLine(line);
      return {
        message,
        eventTime: message.getEventTimestamp(),
        type: "hfp" as TimedTestMessage["type"],
      };
    });
    return partialApcMessages
      .concat(hfpMessages)
      .toSorted((a, b) => a.eventTime - b.eventTime)
      .map((item, index: number, arr) => {
        if (index === 0) {
          return {
            message: item.message,
            type: item.type,
            feedWaitInMilliseconds: 0,
          };
        }
        const previous = arr[index - 1];
        if (previous != null) {
          const feedWaitInMilliseconds = item.eventTime - previous.eventTime;
          return {
            message: item.message,
            type: item.type,
            feedWaitInMilliseconds,
          };
        }
        throw new Error("We should not get here");
      });
  };

  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino(
      {
        name: "test-logger",
        timestamp: pino.stdTimeFunctions.isoTime,
        level: process.env["PINO_LOG_LEVEL"] ?? "info",
      },
      pino.destination({ sync: true }),
    );
  });

  beforeEach(() => jest.useFakeTimers());

  const testMessageFlow = (
    processingConfig: ProcessingConfig,
    partialApcInput: MqttDumpLine[],
    hfpInput: MqttDumpLine[],
    expectedApcMessages: Pulsar.ProducerMessage[],
    done: jest.DoneCallback,
  ): void => {
    const timedTestMessages = combinePartialApcAndHfpInputs(
      partialApcInput,
      hfpInput,
    );
    const { updateApcCache, expandWithApcAndSend } = initializeMatching(
      logger,
      processingConfig,
    );
    let callbackCount = 0;
    /* eslint-disable jest/no-conditional-expect */
    timedTestMessages.forEach((message) => {
      switch (message.type) {
        case "partialApc":
          updateApcCache(message.message);
          break;
        case "hfp":
          expandWithApcAndSend(message.message, (result) => {
            const expectedApcMessage = expectedApcMessages[callbackCount];
            callbackCount += 1;
            if (expectedApcMessage != null) {
              const resultData = passengerCount.Data.decode(result.data);
              const expectedData = passengerCount.Data.decode(
                expectedApcMessage.data,
              );
              expect(
                expectedData.payload.vehicleCounts?.vehicleLoadRatio,
              ).toBeDefined();
              if (
                expectedData.payload.vehicleCounts?.vehicleLoadRatio != null
              ) {
                expect(
                  resultData.payload.vehicleCounts?.vehicleLoadRatio,
                ).toBeCloseTo(
                  expectedData.payload.vehicleCounts.vehicleLoadRatio,
                );
              }
              delete resultData.payload.vehicleCounts?.vehicleLoadRatio;
              delete expectedData.payload.vehicleCounts?.vehicleLoadRatio;
              expect(resultData).toStrictEqual(expectedData);
              expect(result.eventTimestamp).toStrictEqual(
                expectedApcMessage.eventTimestamp,
              );
            } else {
              throw new Error(
                `We expected ${expectedApcMessages.length} APC messages but there were ${callbackCount} callback calls`,
              );
            }
          });
          break;
        default: {
          const exhaustiveCheck: never = message.type;
          throw new Error(String(exhaustiveCheck));
        }
      }
      jest.advanceTimersByTime(message.feedWaitInMilliseconds);
    });
    /* eslint-enable jest/no-conditional-expect */
    jest.runAllTimers();
    expect(callbackCount).toStrictEqual(expectedApcMessages.length);
    done();
  };

  /**
   * Match one partial-APC message onto one stop in the middle of a vehicle
   * journey when the bus stops and behaves in the most common, expected way.
   *
   * This is the simplest case.
   */
  // The code to test uses a callback instead of a Promise so we should use the
  // done callback to test it.
  // eslint-disable-next-line jest/no-done-callback, jest/expect-expect
  test("Match one partial APC message to a stop in the middle of a vehicle journey", (done) => {
    // FIXME: maybe check the real size of the vehicle
    const processingConfig = {
      apcWaitInSeconds: 15,
      vehicleCapacities: new Map([["0012/01913", 67]]),
      defaultVehicleCapacity: 78,
    };
    const partialApcInput: MqttDumpLine[] = [
      '2023-10-29T13:25:01.004739Z /hfp/v2/journey/ongoing/apc-partial/bus/0012/01913 {"APC":{"tst":"2023-10-29T13:24:56Z","lat":60.17172,"long":24.924236,"vehiclecounts":{"vehicleload":12,"doorcounts":[{"door":"2","count":[{"class":"adult","in":1,"out":4}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"d3d03700-9187-4ea8-b8b1-43ce08d48489"}}',
    ];
    const hfpInput: MqttDumpLine[] = [
      '2023-10-29T13:24:10.275306Z /hfp/v2/journey/ongoing/due/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/4/60;24/19/72/15 {"DUE":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:10.211Z","tsi":1698585850,"spd":4.00,"hdg":274,"lat":60.171325,"long":24.925031,"acc":-1.70,"dl":-112,"odo":741,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:24:10.749423Z /hfp/v2/journey/ongoing/vp/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/4/60;24/19/72/15 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:10.684Z","tsi":1698585850,"spd":4.53,"hdg":274,"lat":60.171325,"long":24.925031,"acc":-1.70,"dl":-112,"odo":746,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":null,"route":"4400","occu":0}}',
      '2023-10-29T13:24:36.313634Z /hfp/v2/journey/ongoing/arr/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/4/60;24/19/72/14 {"ARR":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:36.231Z","tsi":1698585876,"spd":6.00,"hdg":328,"lat":60.171578,"long":24.924196,"acc":-0.31,"dl":-112,"odo":795,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:24:36.744431Z /hfp/v2/journey/ongoing/vp/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/4/60;24/19/72/14 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:36.684Z","tsi":1698585876,"spd":6.07,"hdg":328,"lat":60.171578,"long":24.924196,"acc":-0.31,"dl":-36,"odo":804,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0}}',
      '2023-10-29T13:24:41.286967Z /hfp/v2/journey/ongoing/ars/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/5/60;24/19/72/14 {"ARS":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:41.220Z","tsi":1698585881,"spd":0.00,"hdg":330,"lat":60.171727,"long":24.924044,"acc":-1.34,"dl":-36,"odo":819,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:24:41.747461Z /hfp/v2/journey/ongoing/vp/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/5/60;24/19/72/14 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:41.684Z","tsi":1698585881,"spd":0.82,"hdg":330,"lat":60.171727,"long":24.924044,"acc":-1.34,"dl":-41,"odo":824,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0}}',
      '2023-10-29T13:24:43.302133Z /hfp/v2/journey/ongoing/doo/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/5/60;24/19/72/14 {"DOO":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:42.684Z","tsi":1698585882,"spd":0.05,"hdg":330,"lat":60.171732,"long":24.924043,"acc":-0.05,"dl":-41,"odo":824,"drst":1,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:24:43.738600Z /hfp/v2/journey/ongoing/vp/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/5/60;24/19/72/14 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:43.684Z","tsi":1698585883,"spd":0.05,"hdg":330,"lat":60.171732,"long":24.924043,"acc":-0.05,"dl":-41,"odo":824,"drst":1,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0}}',
      '2023-10-29T13:24:55.305005Z /hfp/v2/journey/ongoing/doc/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/5/60;24/19/72/14 {"DOC":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:54.684Z","tsi":1698585894,"spd":0.36,"hdg":330,"lat":60.171734,"long":24.924042,"acc":0.36,"dl":-41,"odo":824,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:24:55.741394Z /hfp/v2/journey/ongoing/vp/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/5/60;24/19/72/14 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:55.684Z","tsi":1698585895,"spd":0.36,"hdg":330,"lat":60.171734,"long":24.924042,"acc":0.36,"dl":-41,"odo":824,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0}}',
      '2023-10-29T13:25:05.273332Z /hfp/v2/journey/ongoing/pde/bus/0012/01913/4400/1/Vantaankoski/15:21/1130110/3/60;24/19/72/13 {"PDE":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:24:58.245Z","tsi":1698585898,"spd":3.00,"hdg":327,"lat":60.171790,"long":24.923970,"acc":0.98,"dl":-60,"odo":829,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"ODO","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:25:05.301862Z /hfp/v2/journey/ongoing/dep/bus/0012/01913/4400/1/Vantaankoski/15:21/1130103/4/60;24/19/72/23 {"DEP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:25:05.213Z","tsi":1698585905,"spd":8.00,"hdg":335,"lat":60.172149,"long":24.923582,"acc":0.62,"dl":-60,"odo":863,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130110,"route":"4400","occu":0,"ttarr":"2023-10-29T13:24:00.000Z","ttdep":"2023-10-29T13:24:00.000Z"}}',
      '2023-10-29T13:25:05.744793Z /hfp/v2/journey/ongoing/vp/bus/0012/01913/4400/1/Vantaankoski/15:21/1130103/0/60;24/19/72/23 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:25:05.684Z","tsi":1698585905,"spd":8.39,"hdg":335,"lat":60.172149,"long":24.923582,"acc":0.62,"dl":-65,"odo":873,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":null,"route":"4400","occu":0}}',
      '2023-10-29T13:26:13.284377Z /hfp/v2/journey/ongoing/due/bus/0012/01913/4400/1/Vantaankoski/15:21/1130103/4/60;24/19/72/52 {"DUE":{"desi":"400","dir":"1","oper":12,"veh":1913,"tst":"2023-10-29T13:26:13.214Z","tsi":1698585973,"spd":9.00,"hdg":352,"lat":60.175118,"long":24.922088,"acc":0.10,"dl":-65,"odo":1202,"drst":0,"oday":"2023-10-29","jrn":663,"line":1109,"start":"15:21","loc":"GPS","stop":1130103,"route":"4400","occu":0,"ttarr":"2023-10-29T13:26:00.000Z","ttdep":"2023-10-29T13:26:00.000Z"}}',
    ];
    const expectedApcMessages = [
      mockApcMessage({
        apcData: {
          SchemaVersion: 1,
          topic: "/hfp/v2/journey/ongoing/apc/bus/0012/01913",
          payload: {
            desi: "400",
            dir: "1",
            oper: 12,
            veh: 1913,
            tst: Math.floor(new Date("2023-10-29T13:24:56Z").getTime() / 1000),
            tsi: Math.floor(new Date("2023-10-29T13:24:56Z").getTime() / 1000),
            lat: 60.17172,
            long: 24.924236,
            odo: 829,
            oday: "2023-10-29",
            jrn: 663,
            line: 1109,
            start: "15:21",
            loc: "ODO",
            stop: 1130110,
            route: "4400",
            vehicleCounts: {
              countQuality: "regular",
              vehicleLoad: 12,
              vehicleLoadRatio: 0.1764706,
              doorCounts: [
                {
                  door: "2",
                  count: [{ clazz: "adult", in: 1, out: 4 }],
                },
              ],
            },
          },
        },
        eventTimestamp: new Date("2023-10-29T13:25:01.004739Z").getTime(),
      }),
    ];
    testMessageFlow(
      processingConfig,
      partialApcInput,
      hfpInput,
      expectedApcMessages,
      done,
    );
  });

  /**
   * When the next vehicle journey starts, alighting passengers are matched to
   * the previous vehicle journey and boarding passengers are matched to the
   * next vehicle journey.
   *
   * In the first case, the final stop of the previous vehicle journey is the
   * starting stop of the next vehicle journey.
   */
  // The code to test uses a callback instead of a Promise so we should use the
  // done callback to test it.
  // eslint-disable-next-line jest/no-done-callback, jest/expect-expect
  test("When the vehicle journey changes and the final and the starting stop is the same stop, match alighting passengers to the previous vehicle journey and boarding passengers to the next vehicle journey", (done) => {
    // FIXME: maybe check the real size of the vehicle
    const processingConfig = {
      apcWaitInSeconds: 15,
      vehicleCapacities: new Map([["0018/00679", 67]]),
      defaultVehicleCapacity: 78,
    };
    const partialApcInput: MqttDumpLine[] = [
      '2023-10-29T20:00:36.098856Z /hfp/v2/journey/ongoing/apc-partial/bus/0018/00679 {"APC":{"tst":"2023-10-29T20:00:30Z","lat":60.25123,"long":24.962042,"vehiclecounts":{"vehicleload":12,"doorcounts":[{"door":"1","count":[{"class":"adult","in":0,"out":0}]},{"door":"2","count":[{"class":"adult","in":0,"out":0}]},{"door":"3","count":[{"class":"adult","in":3,"out":3}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"7dbcf328-5e95-4203-8e09-3b9abe29f442"}}',
      '2023-10-29T20:01:08.378381Z /hfp/v2/journey/ongoing/apc-partial/bus/0018/00679 {"APC":{"tst":"2023-10-29T20:01:02Z","lat":60.251232,"long":24.962044,"vehiclecounts":{"vehicleload":12,"doorcounts":[{"door":"1","count":[{"class":"adult","in":0,"out":0}]},{"door":"2","count":[{"class":"adult","in":0,"out":0}]},{"door":"3","count":[{"class":"adult","in":0,"out":0}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"4b21b9e3-48ec-4e29-9abd-64580884ecf5"}}',
    ];
    const hfpInput: MqttDumpLine[] = [
      '2023-10-29T19:47:06.449454Z /hfp/v2/journey/ongoing/due/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/4/60;24/29/56/00 {"DUE":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:06.359Z","tsi":1698608826,"spd":10.00,"hdg":38,"lat":60.250574,"long":24.960863,"acc":-0.15,"dl":-399,"odo":10680,"drst":0,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:41:00.000Z","ttdep":"2023-10-29T19:41:00.000Z"}}',
      '2023-10-29T19:47:07.420150Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/4/60;24/29/56/00 {"VP":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:07.344Z","tsi":1698608827,"spd":10.19,"hdg":38,"lat":60.250574,"long":24.960863,"acc":-0.15,"dl":-399,"odo":10689,"drst":0,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":null,"route":"1064","occu":0}}',
      '2023-10-29T19:47:11.454381Z /hfp/v2/journey/ongoing/arr/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/4/60;24/29/56/01 {"ARR":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:11.367Z","tsi":1698608831,"spd":8.00,"hdg":64,"lat":60.250791,"long":24.961610,"acc":-0.46,"dl":-399,"odo":10729,"drst":0,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:41:00.000Z","ttdep":"2023-10-29T19:41:00.000Z"}}',
      '2023-10-29T19:47:12.411159Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/4/60;24/29/56/01 {"VP":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:12.344Z","tsi":1698608832,"spd":8.80,"hdg":64,"lat":60.250791,"long":24.961610,"acc":-0.46,"dl":-371,"odo":10738,"drst":0,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:47:40.448253Z /hfp/v2/journey/ongoing/ars/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/5/60;24/29/56/12 {"ARS":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:40.360Z","tsi":1698608860,"spd":1.00,"hdg":200,"lat":60.251228,"long":24.962009,"acc":-1.29,"dl":-371,"odo":10895,"drst":0,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:41:00.000Z","ttdep":"2023-10-29T19:41:00.000Z"}}',
      '2023-10-29T19:47:41.413561Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/5/60;24/29/56/12 {"VP":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:41.344Z","tsi":1698608861,"spd":1.85,"hdg":200,"lat":60.251228,"long":24.962009,"acc":-1.29,"dl":-400,"odo":10900,"drst":0,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:47:44.823581Z /hfp/v2/journey/ongoing/doo/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/5/60;24/29/56/12 {"DOO":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:44.344Z","tsi":1698608864,"spd":0.21,"hdg":200,"lat":60.251222,"long":24.962002,"acc":-0.05,"dl":-400,"odo":10900,"drst":1,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:41:00.000Z","ttdep":"2023-10-29T19:41:00.000Z"}}',
      '2023-10-29T19:47:45.421835Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/5/60;24/29/56/12 {"VP":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:47:45.344Z","tsi":1698608865,"spd":0.10,"hdg":200,"lat":60.251223,"long":24.962002,"acc":-0.10,"dl":-400,"odo":10900,"drst":1,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:48:21.881287Z /hfp/v2/journey/ongoing/vjout/bus/0018/00679/1064/1/Itä-Pakila/21:12/1353117/5/60;24/29/56/12 {"VJOUT":{"desi":"64","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T19:48:21.796Z","tsi":1698608901,"spd":0.00,"hdg":200,"lat":60.251226,"long":24.962006,"acc":0.00,"dl":-400,"odo":10900,"drst":1,"oday":"2023-10-29","jrn":513,"line":80,"start":"21:12","loc":"GPS","stop":1353117,"route":"1064","occu":0,"dr-type":1,"block":104}}',
      '2023-10-29T19:48:22.422101Z /hfp/v2/deadrun/ongoing/vp/bus/0018/00679 {"VP":{"desi":null,"dir":null,"oper":null,"veh":679,"tst":"2023-10-29T19:48:22.344Z","tsi":1698608902,"spd":0.00,"hdg":200,"lat":60.251226,"long":24.962007,"acc":0.00,"dl":null,"odo":10900,"drst":1,"oday":null,"jrn":null,"line":null,"start":null,"loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:50:39.494072Z /hfp/v2/journey/ongoing/vja/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/0/60;24/29/56/11 {"VJA":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:39.416Z","tsi":1698609039,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":null,"odo":null,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"dr-type":1,"block":104}}',
      '2023-10-29T19:50:39.519745Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/0/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:39.417Z","tsi":1698609039,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":null,"odo":null,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:50:39.801345Z /hfp/v2/journey/ongoing/due/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"DUE":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:39.575Z","tsi":1698609039,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":null,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T19:50:40.427982Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:40.344Z","tsi":1698609040,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":null,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":null,"route":"1064","occu":0}}',
      '2023-10-29T19:50:40.451666Z /hfp/v2/journey/ongoing/arr/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"ARR":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:40.347Z","tsi":1698609040,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":null,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T19:50:41.434876Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:41.348Z","tsi":1698609041,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":379,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:50:41.434922Z /hfp/v2/journey/ongoing/ars/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"ARS":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:41.335Z","tsi":1698609041,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":379,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T19:50:42.413486Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:50:42.344Z","tsi":1698609042,"spd":0.00,"hdg":200,"lat":60.251222,"long":24.961990,"acc":0.00,"dl":378,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:58:00.128409Z /hfp/v2/journey/ongoing/wait/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"WAIT":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:57:59.346Z","tsi":1698609479,"spd":0.00,"hdg":200,"lat":60.251234,"long":24.961987,"acc":0.00,"dl":-60,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T19:58:00.413975Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:58:00.344Z","tsi":1698609480,"spd":0.00,"hdg":200,"lat":60.251234,"long":24.961987,"acc":0.00,"dl":-60,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T19:59:00.123075Z /hfp/v2/journey/ongoing/wait/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"WAIT":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:58:59.344Z","tsi":1698609539,"spd":0.00,"hdg":200,"lat":60.251230,"long":24.961987,"acc":0.00,"dl":-120,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T19:59:00.417713Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:59:00.344Z","tsi":1698609540,"spd":0.00,"hdg":200,"lat":60.251230,"long":24.961987,"acc":0.00,"dl":-120,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T20:00:00.120213Z /hfp/v2/journey/ongoing/wait/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"WAIT":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T19:59:59.344Z","tsi":1698609599,"spd":0.00,"hdg":200,"lat":60.251236,"long":24.961990,"acc":0.00,"dl":-180,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T20:00:00.446059Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:00:00.344Z","tsi":1698609600,"spd":0.00,"hdg":200,"lat":60.251236,"long":24.961990,"acc":0.00,"dl":-180,"odo":0,"drst":1,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T20:00:58.982278Z /hfp/v2/journey/ongoing/doc/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"DOC":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:00:58.345Z","tsi":1698609658,"spd":0.00,"hdg":200,"lat":60.251241,"long":24.961992,"acc":0.00,"dl":-180,"odo":0,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T20:00:59.443410Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:00:59.344Z","tsi":1698609659,"spd":0.00,"hdg":200,"lat":60.251241,"long":24.961992,"acc":0.00,"dl":-180,"odo":0,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T20:01:00.131745Z /hfp/v2/journey/ongoing/wait/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"WAIT":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:00:59.344Z","tsi":1698609659,"spd":0.00,"hdg":200,"lat":60.251241,"long":24.961992,"acc":0.00,"dl":-240,"odo":0,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T20:01:00.412155Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/5/60;24/29/56/11 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:01:00.344Z","tsi":1698609660,"spd":0.00,"hdg":200,"lat":60.251241,"long":24.961992,"acc":0.00,"dl":-240,"odo":0,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0}}',
      '2023-10-29T20:01:44.466360Z /hfp/v2/journey/ongoing/pde/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/3/60;24/29/56/11 {"PDE":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:01:30.951Z","tsi":1698609690,"spd":2.00,"hdg":194,"lat":60.251221,"long":24.961999,"acc":1.08,"dl":-240,"odo":5,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"ODO","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T20:01:44.507543Z /hfp/v2/journey/ongoing/dep/bus/0018/00679/1064/2/Rautatientori/21:57/1353117/4/60;24/29/56/01 {"DEP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:01:44.393Z","tsi":1698609704,"spd":8.00,"hdg":247,"lat":60.250748,"long":24.961273,"acc":0.10,"dl":-240,"odo":69,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1353117,"route":"1064","occu":0,"ttarr":"2023-10-29T19:57:00.000Z","ttdep":"2023-10-29T19:57:00.000Z"}}',
      '2023-10-29T20:01:45.441250Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1064/2/Rautatientori/21:57/1342116/0/60;24/29/56/01 {"VP":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:01:45.344Z","tsi":1698609705,"spd":8.18,"hdg":247,"lat":60.250748,"long":24.961273,"acc":0.10,"dl":-284,"odo":78,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":null,"route":"1064","occu":0}}',
      '2023-10-29T20:02:06.481060Z /hfp/v2/journey/ongoing/due/bus/0018/00679/1064/2/Rautatientori/21:57/1342116/3/60;24/29/45/98 {"DUE":{"desi":"64","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T20:02:06.375Z","tsi":1698609726,"spd":9.00,"hdg":250,"lat":60.249355,"long":24.958855,"acc":-0.77,"dl":-291,"odo":279,"drst":0,"oday":"2023-10-29","jrn":1249,"line":80,"start":"21:57","loc":"GPS","stop":1342116,"route":"1064","occu":0,"ttarr":"2023-10-29T19:58:00.000Z","ttdep":"2023-10-29T19:58:00.000Z"}}',
    ];
    const expectedApcMessages = [
      mockApcMessage({
        apcData: {
          SchemaVersion: 1,
          topic: "/hfp/v2/journey/ongoing/apc/bus/0018/00679",
          payload: {
            desi: "64",
            dir: "1",
            oper: 6,
            veh: 679,
            tst: Math.floor(new Date("2023-10-29T20:01:02Z").getTime() / 1000),
            tsi: Math.floor(new Date("2023-10-29T20:01:02Z").getTime() / 1000),
            lat: 60.251232,
            long: 24.962044,
            odo: 5,
            oday: "2023-10-29",
            jrn: 513,
            line: 80,
            start: "21:12",
            loc: "ODO",
            stop: 1353117,
            route: "1064",
            vehicleCounts: {
              vehicleLoad: 9,
              vehicleLoadRatio: 0.1343284,
              doorCounts: [
                { door: "1", count: [{ clazz: "adult", in: 0, out: 0 }] },
                { door: "2", count: [{ clazz: "adult", in: 0, out: 0 }] },
                { door: "3", count: [{ clazz: "adult", in: 0, out: 3 }] },
              ],
              countQuality: "regular",
            },
          },
        },
        eventTimestamp: new Date("2023-10-29T20:01:08.378381Z").getTime(),
      }),
      mockApcMessage({
        apcData: {
          SchemaVersion: 1,
          topic: "/hfp/v2/journey/ongoing/apc/bus/0018/00679",
          payload: {
            desi: "64",
            dir: "2",
            oper: 6,
            veh: 679,
            tst: Math.floor(new Date("2023-10-29T20:01:02Z").getTime() / 1000),
            tsi: Math.floor(new Date("2023-10-29T20:01:02Z").getTime() / 1000),
            lat: 60.251232,
            long: 24.962044,
            odo: 5,
            oday: "2023-10-29",
            jrn: 1249,
            line: 80,
            start: "21:57",
            loc: "ODO",
            stop: 1353117,
            route: "1064",
            vehicleCounts: {
              vehicleLoad: 12,
              vehicleLoadRatio: 0.1791045,
              doorCounts: [
                { door: "1", count: [{ clazz: "adult", in: 0, out: 0 }] },
                { door: "2", count: [{ clazz: "adult", in: 0, out: 0 }] },
                { door: "3", count: [{ clazz: "adult", in: 3, out: 0 }] },
              ],
              countQuality: "regular",
            },
          },
        },
        eventTimestamp: new Date("2023-10-29T20:01:08.378381Z").getTime(),
      }),
    ];
    testMessageFlow(
      processingConfig,
      partialApcInput,
      hfpInput,
      expectedApcMessages,
      done,
    );
  });

  // FIXME: later
  // eslint-disable-next-line jest/no-commented-out-tests
  // test("When the vehicle journey changes and the final and the starting stop are separate, match alighting passengers to the previous vehicle journey and boarding passengers to the next vehicle journey", (done) => {});
  // FIXME: use this data set
  // Rautatieasema: leave at one stop and pick up from the another
  // 2023-10-29T13:47:42.452084Z,0.104084,bus,0018/00679,journey,due,1061,2,2023-10-29,14:52,1020201,1020201,1
  // 2023-10-29T13:51:26.464197Z,0.103197,bus,0018/00679,journey,due,1066,1,2023-10-29,15:46,1020105,1020105,1
  // + 2 partial-apc events in between
  //
  // 2023-10-29T13:47:42.452084Z /hfp/v2/journey/ongoing/due/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/3/60;24/19/74/13 {"DUE":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:42.348Z","tsi":1698587262,"spd":5.00,"hdg":268,"lat":60.171913,"long":24.943908,"acc":-1.34,"dl":-641,"odo":16319,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":1020201,"route":"1061","occu":0,"ttarr":"2023-10-29T13:39:00.000Z","ttdep":"2023-10-29T13:39:00.000Z"}}
  // 2023-10-29T13:47:43.422017Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/3/60;24/19/74/13 {"VP":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:43.344Z","tsi":1698587263,"spd":5.71,"hdg":268,"lat":60.171913,"long":24.943908,"acc":-1.34,"dl":-641,"odo":16323,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":null,"route":"1061","occu":0}}
  // 2023-10-29T13:47:43.448878Z /hfp/v2/journey/ongoing/arr/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/4/60;24/19/74/13 {"ARR":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:43.352Z","tsi":1698587263,"spd":4.00,"hdg":268,"lat":60.171912,"long":24.943823,"acc":-1.49,"dl":-641,"odo":16323,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":1020201,"route":"1061","occu":0,"ttarr":"2023-10-29T13:39:00.000Z","ttdep":"2023-10-29T13:39:00.000Z"}}
  // 2023-10-29T13:47:44.416215Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/4/60;24/19/74/13 {"VP":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:44.344Z","tsi":1698587264,"spd":2.83,"hdg":268,"lat":60.171912,"long":24.943762,"acc":-1.39,"dl":-523,"odo":16328,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":1020201,"route":"1061","occu":0}}
  // 2023-10-29T13:47:45.423961Z /hfp/v2/journey/ongoing/ars/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/5/60;24/19/74/13 {"ARS":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:45.336Z","tsi":1698587265,"spd":1.00,"hdg":269,"lat":60.171911,"long":24.943723,"acc":-1.23,"dl":-523,"odo":16333,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":1020201,"route":"1061","occu":0,"ttarr":"2023-10-29T13:39:00.000Z","ttdep":"2023-10-29T13:39:00.000Z"}}
  // 2023-10-29T13:47:45.443416Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/5/60;24/19/74/13 {"VP":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:45.344Z","tsi":1698587265,"spd":1.59,"hdg":269,"lat":60.171911,"long":24.943723,"acc":-1.23,"dl":-523,"odo":16333,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":1020201,"route":"1061","occu":0}}
  // 2023-10-29T13:47:49.037831Z /hfp/v2/journey/ongoing/vjout/bus/0018/00679/1061/2/Rautatientori/14:52/1020201/5/60;24/19/74/13 {"VJOUT":{"desi":"61","dir":"2","oper":6,"veh":679,"tst":"2023-10-29T13:47:48.956Z","tsi":1698587268,"spd":0.05,"hdg":269,"lat":60.171910,"long":24.943706,"acc":-0.05,"dl":-525,"odo":16333,"drst":0,"oday":"2023-10-29","jrn":513,"line":973,"start":"14:52","loc":"GPS","stop":1020201,"route":"1061","occu":0,"dr-type":1,"block":104}}
  // 2023-10-29T13:47:49.377939Z /hfp/v2/deadrun/ongoing/doo/bus/0018/00679 {"DOO":{"desi":null,"dir":null,"oper":null,"veh":679,"tst":"2023-10-29T13:47:48.344Z","tsi":1698587268,"spd":0.05,"hdg":269,"lat":60.171910,"long":24.943706,"acc":-0.05,"dl":null,"odo":null,"drst":1,"oday":null,"jrn":null,"line":null,"start":null,"loc":"GPS","stop":1020201,"route":"1061","occu":0,"ttarr":"2023-10-29T13:39:00.000Z","ttdep":"2023-10-29T13:39:00.000Z"}}
  // 2023-10-29T13:47:49.412022Z /hfp/v2/deadrun/ongoing/vp/bus/0018/00679 {"VP":{"desi":null,"dir":null,"oper":null,"veh":679,"tst":"2023-10-29T13:47:49.344Z","tsi":1698587269,"spd":0.10,"hdg":269,"lat":60.171910,"long":24.943705,"acc":0.05,"dl":null,"odo":16333,"drst":1,"oday":null,"jrn":null,"line":null,"start":null,"loc":"GPS","stop":1020201,"route":"1061","occu":0}}
  // 2023-10-29T13:47:58.032111Z /hfp/v2/journey/ongoing/vja/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/0/60;24/19/74/13 {"VJA":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:47:57.948Z","tsi":1698587277,"spd":0.15,"hdg":269,"lat":60.171910,"long":24.943695,"acc":0.05,"dl":null,"odo":null,"drst":1,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020201,"route":"1066","occu":0,"dr-type":1,"block":104}}
  // 2023-10-29T13:47:58.421600Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/13 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:47:58.344Z","tsi":1698587278,"spd":0.15,"hdg":269,"lat":60.171910,"long":24.943693,"acc":0.00,"dl":-118,"odo":0,"drst":1,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020201,"route":"1066","occu":0}}
  // 2023-10-29T13:48:03.398547Z /hfp/v2/journey/ongoing/doc/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/13 {"DOC":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:02.344Z","tsi":1698587282,"spd":0.26,"hdg":269,"lat":60.171910,"long":24.943682,"acc":0.05,"dl":-123,"odo":0,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020201,"route":"1066","occu":0,"ttarr":null,"ttdep":null}}
  // 2023-10-29T13:48:03.432522Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/13 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:03.344Z","tsi":1698587283,"spd":0.31,"hdg":269,"lat":60.171910,"long":24.943678,"acc":0.05,"dl":-123,"odo":0,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020201,"route":"1066","occu":0}}
  // 2023-10-29T13:48:26.457019Z /hfp/v2/journey/ongoing/due/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/4/60;24/19/74/13 {"DUE":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:26.372Z","tsi":1698587306,"spd":7.00,"hdg":175,"lat":60.171479,"long":24.943354,"acc":0.41,"dl":-146,"odo":54,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:48:27.413687Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/4/60;24/19/74/13 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:27.344Z","tsi":1698587307,"spd":7.72,"hdg":175,"lat":60.171479,"long":24.943354,"acc":0.41,"dl":-147,"odo":54,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:48:33.455715Z /hfp/v2/journey/ongoing/arr/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/13 {"ARR":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:33.388Z","tsi":1698587313,"spd":6.00,"hdg":183,"lat":60.171000,"long":24.943328,"acc":-0.82,"dl":-153,"odo":108,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:48:34.415653Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/13 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:34.344Z","tsi":1698587314,"spd":6.22,"hdg":183,"lat":60.171000,"long":24.943328,"acc":-0.82,"dl":-153,"odo":108,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0}}
  // 2023-10-29T13:48:38.466278Z /hfp/v2/journey/ongoing/ars/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"ARS":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:38.391Z","tsi":1698587318,"spd":0.00,"hdg":178,"lat":60.170845,"long":24.943334,"acc":-1.70,"dl":-153,"odo":128,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:48:38.493710Z /hfp/v2/journey/ongoing/wait/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"WAIT":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:38.344Z","tsi":1698587318,"spd":0.46,"hdg":178,"lat":60.170845,"long":24.943334,"acc":-1.70,"dl":-158,"odo":128,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:48:39.420414Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:39.344Z","tsi":1698587319,"spd":0.46,"hdg":178,"lat":60.170845,"long":24.943334,"acc":-1.70,"dl":-158,"odo":128,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0}}
  // 2023-10-29T13:48:41.434525Z /hfp/v2/journey/ongoing/doo/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"DOO":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:41.344Z","tsi":1698587321,"spd":0.10,"hdg":178,"lat":60.170845,"long":24.943334,"acc":-0.10,"dl":-158,"odo":128,"drst":1,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:48:42.415910Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:48:42.344Z","tsi":1698587322,"spd":0.10,"hdg":178,"lat":60.170846,"long":24.943334,"acc":0.00,"dl":-158,"odo":128,"drst":1,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0}}
  // 2023-10-29T13:49:19.494255Z /hfp/v2/journey/ongoing/doc/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"DOC":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:49:19.344Z","tsi":1698587359,"spd":0.05,"hdg":178,"lat":60.170853,"long":24.943338,"acc":0.00,"dl":-180,"odo":128,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:49:20.420180Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/5/60;24/19/74/03 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:49:20.344Z","tsi":1698587360,"spd":0.05,"hdg":178,"lat":60.170853,"long":24.943338,"acc":0.00,"dl":-180,"odo":128,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0}}
  // 2023-10-29T13:49:53.475005Z /hfp/v2/journey/ongoing/pde/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/4/60;24/19/74/03 {"PDE":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:49:23.422Z","tsi":1698587363,"spd":2.00,"hdg":176,"lat":60.170828,"long":24.943351,"acc":0.51,"dl":-180,"odo":132,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"ODO","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:49:53.522825Z /hfp/v2/journey/ongoing/dep/bus/0018/00679/1066/1/Paloheinä/15:46/1020122/4/60;24/19/74/03 {"DEP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:49:53.408Z","tsi":1698587393,"spd":5.00,"hdg":139,"lat":60.170573,"long":24.943581,"acc":0.87,"dl":-180,"odo":157,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020122,"route":"1066","occu":0,"ttarr":"2023-10-29T13:46:00.000Z","ttdep":"2023-10-29T13:46:00.000Z"}}
  // 2023-10-29T13:49:54.418978Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/0/60;24/19/74/03 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:49:54.344Z","tsi":1698587394,"spd":5.76,"hdg":139,"lat":60.170573,"long":24.943581,"acc":0.87,"dl":-233,"odo":162,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:50:13.431540Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/74/06 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:50:13.344Z","tsi":1698587413,"spd":9.88,"hdg":58,"lat":60.170926,"long":24.946172,"acc":-0.21,"dl":-241,"odo":324,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:50:54.422358Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/3/60;24/19/74/28 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:50:54.344Z","tsi":1698587454,"spd":6.69,"hdg":28,"lat":60.172061,"long":24.948017,"acc":-0.36,"dl":-241,"odo":495,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:50:59.407737Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/74/28 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:50:59.344Z","tsi":1698587459,"spd":8.44,"hdg":30,"lat":60.172404,"long":24.948384,"acc":0.36,"dl":-241,"odo":529,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:51:00.408690Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/74/28 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:51:00.344Z","tsi":1698587460,"spd":8.85,"hdg":30,"lat":60.172469,"long":24.948447,"acc":0.41,"dl":-241,"odo":539,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:51:11.419544Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/74/39 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:51:11.344Z","tsi":1698587471,"spd":8.64,"hdg":33,"lat":60.173191,"long":24.949321,"acc":-0.26,"dl":-241,"odo":637,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:51:13.421254Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/74/39 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:51:13.344Z","tsi":1698587473,"spd":8.59,"hdg":30,"lat":60.173331,"long":24.949482,"acc":-0.10,"dl":-241,"odo":657,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:51:19.415050Z /hfp/v2/journey/ongoing/vp/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/74/39 {"VP":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:51:19.344Z","tsi":1698587479,"spd":8.69,"hdg":37,"lat":60.173739,"long":24.949957,"acc":0.10,"dl":-241,"odo":706,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":null,"route":"1066","occu":0}}
  // 2023-10-29T13:51:26.464197Z /hfp/v2/journey/ongoing/due/bus/0018/00679/1066/1/Paloheinä/15:46/1020105/4/60;24/19/75/40 {"DUE":{"desi":"66","dir":"1","oper":6,"veh":679,"tst":"2023-10-29T13:51:26.361Z","tsi":1698587486,"spd":8.00,"hdg":5,"lat":60.174234,"long":24.950467,"acc":1.08,"dl":-241,"odo":760,"drst":0,"oday":"2023-10-29","jrn":392,"line":84,"start":"15:46","loc":"GPS","stop":1020105,"route":"1066","occu":0,"ttarr":"2023-10-29T13:48:00.000Z","ttdep":"2023-10-29T13:48:00.000Z"}}

  // FIXME: later
  /* eslint-disable jest/no-commented-out-tests */
  // test("If the vehicle journey changes after event 'dep' but before events like 'ars' or 'doo', and the next vehicle journey is soon signed on to, match alighting passengers to the next_stop_id of the vehicle journey in the 'dep' message of the previous vehcle journey and match boarding passengers to the first stop of the next vehicle journey", (done) => {});
  // test("If the vehicle starts a deadrun that turns out to take a long time, wait for a moment before matching any remaining passenger counts to the most recent next_stop before the deadrun", (done) => {});
  // test("If the vehicle starts a vehicle journey after a long deadrun, match any passengers counted during the deadrun a moment before the vehicle journey onto the first stop in the vehicle journey", (done) => {});
  /* eslint-enable jest/no-commented-out-tests */
});
