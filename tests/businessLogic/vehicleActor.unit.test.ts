import assert from "node:assert";
import pino from "pino";
import type Pulsar from "pulsar-client";
import { parseHfpPulsarMessage } from "../../src/businessLogic/messageParsing";
import {
  isDeadRunInternal,
  isDeparture,
  setCurrent,
} from "../../src/businessLogic/vehicleActor";
import { hfp } from "../../src/protobuf/hfp";
import type {
  HfpInboxQueueMessage,
  NonNullableFields,
  ServiceJourneyState,
  StopId,
  VehicleMachineContext,
  VehicleMachineMessageEvent,
} from "../../src/types";
import { mockHfpMessage } from "../testUtil/pulsarMocking";

describe("Guards and actions", () => {
  const logger = pino(
    {
      name: "test-logger",
      timestamp: pino.stdTimeFunctions.isoTime,
      level: "debug",
    },
    pino.destination({ sync: true }),
  );

  let startVpEvent: VehicleMachineMessageEvent;
  let pdeEvent: VehicleMachineMessageEvent;
  let depEvent: VehicleMachineMessageEvent;
  let depFirstStopEvent: VehicleMachineMessageEvent;
  let depEolEvent: VehicleMachineMessageEvent;
  let nextVpEvent: VehicleMachineMessageEvent;
  let afterStartVpContext: VehicleMachineContext;
  let afterStartVpPreviousContext: VehicleMachineContext;
  let afterPdeContext: VehicleMachineContext;
  let afterPdePreviousContext: VehicleMachineContext;
  let afterDepContext: VehicleMachineContext;
  let afterDepPreviousContext: VehicleMachineContext;

  beforeEach(() => {
    const createEvent = (
      pulsarMessage: Pulsar.Message,
    ): VehicleMachineMessageEvent => {
      const parsed = parseHfpPulsarMessage(logger, pulsarMessage);
      expect(parsed).toBeDefined();
      assert(parsed != null);
      return { type: "message", message: parsed };
    };

    const createContext = (
      message: HfpInboxQueueMessage,
      previousStop: StopId | undefined,
      currentStop: StopId | undefined,
      usePrevious: boolean,
    ): VehicleMachineContext => {
      expect(message.vehicleJourneyId).not.toStrictEqual(
        hfp.Topic.JourneyType.deadrun,
      );
      assert(message.vehicleJourneyId !== hfp.Topic.JourneyType.deadrun);
      const serviceJourneyState: ServiceJourneyState = {
        serviceJourneyId: message.vehicleJourneyId,
        latestHfp: message,
        previousStop,
        currentStop,
      };
      return {
        previousServiceJourneyState: usePrevious
          ? serviceJourneyState
          : undefined,
        currentServiceJourneyState: usePrevious
          ? undefined
          : serviceJourneyState,
      };
    };

    // Next the following extract from an HFP dump is used and modified for test
    // data:
    // 2024-02-28T07:38:02.221492Z /hfp/v2/journey/ongoing/vp/bus/0012/01825/4400/1/Vantaankoski/09:12/1334126/4/60;24/28/58/42 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1825,"tst":"2024-02-28T07:37:59.634Z","tsi":1709105879,"spd":12.09,"hdg":333,"lat":60.254120,"long":24.882459,"acc":0.57,"dl":-33,"odo":10687,"drst":0,"oday":"2024-02-28","jrn":578,"line":1109,"start":"09:12","loc":"GPS","stop":1334126,"route":"4400","occu":0}}
    // 2024-02-28T07:38:02.900734Z /hfp/v2/journey/ongoing/pde/bus/0012/01825/4400/1/Vantaankoski/09:12/1334126/3/60;24/28/58/33 {"PDE":{"desi":"400","dir":"1","oper":12,"veh":1825,"tst":"2024-02-28T07:37:49.584Z","tsi":1709105869,"spd":5.00,"hdg":335,"lat":60.253399,"long":24.883218,"acc":1.39,"dl":-60,"odo":10599,"drst":0,"oday":"2024-02-28","jrn":578,"line":1109,"start":"09:12","loc":"ODO","stop":1334126,"route":"4400","occu":0,"ttarr":"2024-02-28T07:37:00.000Z","ttdep":"2024-02-28T07:37:00.000Z"}}
    // 2024-02-28T07:38:02.941313Z /hfp/v2/journey/ongoing/dep/bus/0012/01825/4400/1/Vantaankoski/09:12/1334128/4/60;24/28/58/42 {"DEP":{"desi":"400","dir":"1","oper":12,"veh":1825,"tst":"2024-02-28T07:38:00.318Z","tsi":1709105880,"spd":12.00,"hdg":334,"lat":60.254221,"long":24.882361,"acc":0.57,"dl":-60,"odo":10687,"drst":0,"oday":"2024-02-28","jrn":578,"line":1109,"start":"09:12","loc":"GPS","stop":1334126,"route":"4400","occu":0,"ttarr":"2024-02-28T07:37:00.000Z","ttdep":"2024-02-28T07:37:00.000Z"}}
    // 2024-02-28T07:38:03.213616Z /hfp/v2/journey/ongoing/vp/bus/0012/01825/4400/1/Vantaankoski/09:12/1334128/0/60;24/28/58/42 {"VP":{"desi":"400","dir":"1","oper":12,"veh":1825,"tst":"2024-02-28T07:38:00.634Z","tsi":1709105880,"spd":12.66,"hdg":334,"lat":60.254221,"long":24.882361,"acc":0.57,"dl":-60,"odo":10701,"drst":0,"oday":"2024-02-28","jrn":578,"line":1109,"start":"09:12","loc":"GPS","stop":null,"route":"4400","occu":0}}

    const startVpMessageData: NonNullableFields<Required<hfp.IData>> = {
      SchemaVersion: 1,
      topic: {
        SchemaVersion: 1,
        receivedAt: 1709105882221,
        topicPrefix: "/hfp/",
        topicVersion: "v2",
        journeyType: 0,
        temporalType: 0,
        eventType: 0,
        transportMode: 0,
        operatorId: 12,
        vehicleNumber: 1825,
        uniqueVehicleId: "12/1825",
        routeId: "4400",
        directionId: 1,
        headsign: "Vantaankoski",
        startTime: "09:12",
        nextStop: "1334126",
        geohashLevel: 4,
        latitude: 60.254,
        longitude: 24.882,
      },
      payload: {
        SchemaVersion: 1,
        desi: "400",
        dir: "1",
        oper: 12,
        veh: 1825,
        tst: "2024-02-28T07:37:59.634Z",
        tsi: 1709105879,
        spd: 12.09,
        hdg: 333,
        lat: 60.25412,
        long: 24.882459,
        acc: 0.57,
        dl: 4294967263,
        odo: 10687,
        drst: 0,
        oday: "2024-02-28",
        jrn: 578,
        line: 1109,
        start: "09:12",
        loc: 0,
        stop: 1334126,
        route: "4400",
        occu: 0,
      },
    };
    const startVpPulsarMessage = mockHfpMessage({
      hfpData: startVpMessageData,
      eventTimestamp: 1709105882221,
      messageId: 1,
    });
    startVpEvent = createEvent(startVpPulsarMessage);
    afterStartVpContext = createContext(
      startVpEvent.message,
      "1332113",
      "1334126",
      false,
    );
    afterStartVpPreviousContext = createContext(
      startVpEvent.message,
      "1332113",
      "1334126",
      true,
    );

    const pdeMessageData: NonNullableFields<Required<hfp.IData>> = {
      SchemaVersion: 1,
      topic: {
        SchemaVersion: 1,
        receivedAt: 1709105882900,
        topicPrefix: "/hfp/",
        topicVersion: "v2",
        journeyType: 0,
        temporalType: 0,
        eventType: 4,
        transportMode: 0,
        operatorId: 12,
        vehicleNumber: 1825,
        uniqueVehicleId: "12/1825",
        routeId: "4400",
        directionId: 1,
        headsign: "Vantaankoski",
        startTime: "09:12",
        nextStop: "1334126",
        geohashLevel: 3,
        latitude: 60.253,
        longitude: 24.883,
      },
      payload: {
        SchemaVersion: 1,
        desi: "400",
        dir: "1",
        oper: 12,
        veh: 1825,
        tst: "2024-02-28T07:37:49.584Z",
        tsi: 1709105869,
        spd: 5,
        hdg: 335,
        lat: 60.253399,
        long: 24.883218,
        acc: 1.39,
        dl: 4294967236,
        odo: 10599,
        drst: 0,
        oday: "2024-02-28",
        jrn: 578,
        line: 1109,
        start: "09:12",
        loc: 1,
        stop: 1334126,
        route: "4400",
        occu: 0,
        ttarr: "2024-02-28T07:37:00.000Z",
        ttdep: "2024-02-28T07:37:00.000Z",
      },
    };
    const pdePulsarMessage = mockHfpMessage({
      hfpData: pdeMessageData,
      eventTimestamp: 1709105882900,
      messageId: 2,
    });
    pdeEvent = createEvent(pdePulsarMessage);
    afterPdeContext = createContext(
      pdeEvent.message,
      "1334126",
      undefined,
      false,
    );
    afterPdePreviousContext = createContext(
      pdeEvent.message,
      "1334126",
      undefined,
      true,
    );

    const depMessageData: NonNullableFields<Required<hfp.IData>> = {
      SchemaVersion: 1,
      topic: {
        SchemaVersion: 1,
        receivedAt: 1709105882941,
        topicPrefix: "/hfp/",
        topicVersion: "v2",
        journeyType: 0,
        temporalType: 0,
        eventType: 5,
        transportMode: 0,
        operatorId: 12,
        vehicleNumber: 1825,
        uniqueVehicleId: "12/1825",
        routeId: "4400",
        directionId: 1,
        headsign: "Vantaankoski",
        startTime: "09:12",
        nextStop: "1334128",
        geohashLevel: 4,
        latitude: 60.254,
        longitude: 24.882,
      },
      payload: {
        SchemaVersion: 1,
        desi: "400",
        dir: "1",
        oper: 12,
        veh: 1825,
        tst: "2024-02-28T07:38:00.318Z",
        tsi: 1709105880,
        spd: 12,
        hdg: 334,
        lat: 60.254221,
        long: 24.882361,
        acc: 0.57,
        dl: 4294967236,
        odo: 10687,
        drst: 0,
        oday: "2024-02-28",
        jrn: 578,
        line: 1109,
        start: "09:12",
        loc: 0,
        stop: 1334126,
        route: "4400",
        occu: 0,
        ttarr: "2024-02-28T07:37:00.000Z",
        ttdep: "2024-02-28T07:37:00.000Z",
      },
    };
    const depPulsarMessage = mockHfpMessage({
      hfpData: depMessageData,
      eventTimestamp: 1709105882941,
      messageId: 3,
    });
    depEvent = createEvent(depPulsarMessage);
    afterDepContext = createContext(
      depEvent.message,
      "1334126",
      "1334128",
      false,
    );
    afterDepPreviousContext = createContext(
      depEvent.message,
      "1334126",
      "1334128",
      true,
    );

    const depFirstStopMessageData = structuredClone(depMessageData);
    depFirstStopMessageData.topic.nextStop = "1334126";
    const depFirstStopPulsarMessage = mockHfpMessage({
      hfpData: depFirstStopMessageData,
      eventTimestamp: 1709105882941,
      messageId: 3,
    });
    depFirstStopEvent = createEvent(depFirstStopPulsarMessage);

    const depEolMessageData = structuredClone(depMessageData);
    depEolMessageData.topic.nextStop = "EOL";
    const depEolPulsarMessage = mockHfpMessage({
      hfpData: depEolMessageData,
      eventTimestamp: 1709105882941,
      messageId: 3,
    });
    depEolEvent = createEvent(depEolPulsarMessage);

    const nextVpMessageData: NonNullableFields<Required<hfp.IData>> = {
      SchemaVersion: 1,
      topic: {
        SchemaVersion: 1,
        receivedAt: 1709105883213,
        topicPrefix: "/hfp/",
        topicVersion: "v2",
        journeyType: 0,
        temporalType: 0,
        eventType: 0,
        transportMode: 0,
        operatorId: 12,
        vehicleNumber: 1825,
        uniqueVehicleId: "12/1825",
        routeId: "4400",
        directionId: 1,
        headsign: "Vantaankoski",
        startTime: "09:12",
        nextStop: "1334128",
        geohashLevel: 0,
        latitude: 60.254,
        longitude: 24.882,
      },
      payload: {
        SchemaVersion: 1,
        desi: "400",
        dir: "1",
        oper: 12,
        veh: 1825,
        tst: "2024-02-28T07:38:00.634Z",
        tsi: 1709105880,
        spd: 12.66,
        hdg: 334,
        lat: 60.254221,
        long: 24.882361,
        acc: 0.57,
        dl: 4294967236,
        odo: 10701,
        drst: 0,
        oday: "2024-02-28",
        jrn: 578,
        line: 1109,
        start: "09:12",
        loc: 0,
        route: "4400",
        occu: 0,
      },
    };
    const nextVpPulsarMessage = mockHfpMessage({
      hfpData: nextVpMessageData,
      eventTimestamp: 1709105883213,
      messageId: 4,
    });
    nextVpEvent = createEvent(nextVpPulsarMessage);
  });

  describe("isDeparture", () => {
    const check = (
      context: VehicleMachineContext,
      event: VehicleMachineMessageEvent,
      expected: boolean,
    ) => {
      const result = isDeparture({ context, event });
      expect(result).toStrictEqual(expected);
    };

    /* eslint-disable jest/expect-expect */
    test("PDE counts as departure", () => {
      check(afterStartVpContext, pdeEvent, true);
      check(afterStartVpPreviousContext, pdeEvent, true);
    });

    test("DEP right after PDE for same stop does not count as departure", () => {
      check(afterPdeContext, depEvent, false);
    });

    test("DEP with the preceding PDE missing counts as departure", () => {
      check(afterStartVpContext, depEvent, true);
      check(afterStartVpPreviousContext, depEvent, true);
      check(afterPdePreviousContext, pdeEvent, true);
    });

    test("Message that is not PDE or DEP does not count as departure", () => {
      check(afterStartVpContext, nextVpEvent, false);
      check(afterStartVpPreviousContext, nextVpEvent, false);
      check(afterPdeContext, nextVpEvent, false);
      check(afterPdePreviousContext, nextVpEvent, false);
      check(afterDepContext, nextVpEvent, false);
      check(afterDepPreviousContext, nextVpEvent, false);
    });

    test("No message with next stop EOL counts as departure", () => {
      check(afterStartVpContext, depEolEvent, false);
      check(afterStartVpPreviousContext, depEolEvent, false);
      check(afterPdeContext, depEolEvent, false);
      check(afterPdePreviousContext, depEolEvent, false);
    });
    /* eslint-enable jest/expect-expect */
  });

  describe("setCurrent", () => {
    test("DEP after PDE normally adds currentStop", () => {
      const result = setCurrent({ context: afterPdeContext, event: depEvent });
      assert(!isDeadRunInternal(depEvent.message));
      const expectedResult: Partial<VehicleMachineContext> = {
        previousServiceJourneyState: undefined,
        currentServiceJourneyState: {
          serviceJourneyId: depEvent.message.vehicleJourneyId,
          latestHfp: depEvent.message,
          previousStop: "1334126",
          currentStop: "1334128",
        },
      };
      expect(result).toStrictEqual(expectedResult);
    });

    test("DEP after PDE on first stop of service journey does not have a new next stop to add", () => {
      const result = setCurrent({
        context: afterPdeContext,
        event: depFirstStopEvent,
      });
      assert(!isDeadRunInternal(depFirstStopEvent.message));
      const expectedResult: Partial<VehicleMachineContext> = {
        previousServiceJourneyState: undefined,
        currentServiceJourneyState: {
          serviceJourneyId: depFirstStopEvent.message.vehicleJourneyId,
          latestHfp: depFirstStopEvent.message,
          previousStop: "1334126",
          currentStop: undefined,
        },
      };
      expect(result).toStrictEqual(expectedResult);
    });

    test("DEP with next stop EOL after PDE without next stop EOL adds the current stop back into context for later splitted APC message", () => {
      const result = setCurrent({
        context: afterPdeContext,
        event: depEolEvent,
      });
      assert(!isDeadRunInternal(depEolEvent.message));
      const expectedResult: Partial<VehicleMachineContext> = {
        previousServiceJourneyState: undefined,
        currentServiceJourneyState: {
          serviceJourneyId: depEolEvent.message.vehicleJourneyId,
          latestHfp: depEolEvent.message,
          previousStop: "1334126",
          currentStop: "1334126",
        },
      };
      expect(result).toStrictEqual(expectedResult);
    });
  });
});
