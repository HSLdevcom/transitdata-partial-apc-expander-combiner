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
        expect(resultData.payload.vehicleCounts?.vehicleLoadRatio).toBeCloseTo(
          expectedData.payload.vehicleCounts?.vehicleLoadRatio as number,
        );
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

  type MqttHfpPayload = {
    [key: string]: Omit<hfp.IPayload, "loc" | "SchemaVersion"> & {
      loc: string;
    };
  };

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
    payloadObject: { [key: string]: unknown };
  } => {
    const othersAndPayload = line.split("{");
    if (hasLengthAtLeast(othersAndPayload, 2)) {
      const payloadString = `{${othersAndPayload.slice(1).join("{")}`;
      const payloadObject = JSON.parse(payloadString) as {
        [key: string]: unknown;
      };
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
});
