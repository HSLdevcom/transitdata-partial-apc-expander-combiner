import { expect, jest, test } from "@jest/globals";
import assert from "node:assert";
import pino from "pino";
import type Pulsar from "pulsar-client";
import createHfpHandler from "../../src/businessLogic/hfpHandling";
import { parseHfpPulsarMessage } from "../../src/businessLogic/messageParsing";
import {
  createActor,
  isDeadRunInternal,
  isDeparture,
  setCurrent,
} from "../../src/businessLogic/vehicleActor";
import { createQueue } from "../../src/dataStructures/queue";
import { hfp } from "../../src/protobuf/hfp";
import type {
  ApcHandlingFunctions,
  HfpInboxQueueMessage,
  MessageCollection,
  NonNullableFields,
  ProcessingConfig,
  ServiceJourneyId,
  ServiceJourneyState,
  StopId,
  VehicleMachineContext,
  VehicleMachineMessageEvent,
} from "../../src/types";
import { parseHfpLine } from "../testUtil/mqttDumpParsing";
import { mockHfpMessage, mockPulsarMessage } from "../testUtil/pulsarMocking";
import createReferenceSequenceChecker from "../testUtil/referenceSequence";
import type { MqttDumpLine } from "../types";

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

const transformPulsarProducerMessageToPulsarMessage = (
  message: Pulsar.ProducerMessage,
  messageId: number,
): Pulsar.Message => {
  return mockPulsarMessage({
    buffer: message.data,
    // In this use context we know there is an eventTimestamp.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    eventTimestamp: message.eventTimestamp!,
    properties: message.properties,
    messageId,
  });
};

const createMqttDumpLineToHfpInboxQueueMessageTransformer = (
  logger: pino.Logger,
) => {
  const transform = (
    line: MqttDumpLine,
    index: number,
  ): HfpInboxQueueMessage => {
    const pulsarProducerMessage = parseHfpLine(line);
    const pulsarMessage = transformPulsarProducerMessageToPulsarMessage(
      pulsarProducerMessage,
      index,
    );
    const hfpInboxQueueMessage = parseHfpPulsarMessage(logger, pulsarMessage);
    assert(hfpInboxQueueMessage != null);
    return hfpInboxQueueMessage;
  };
  return transform;
};

describe("BeforeFirstDepartureAfterShortDeadRun", () => {
  const logger = pino(
    {
      name: "test-logger",
      timestamp: pino.stdTimeFunctions.isoTime,
      level: "debug",
    },
    pino.destination({ sync: true }),
  );

  const config: ProcessingConfig = {
    backlogDrainingWaitInSeconds: 10,
    defaultVehicleCapacity: 78,
    forcedAckCheckIntervalInSeconds: 1800,
    forcedAckIntervalInSeconds: 7200,
    keepApcFromDeadRunEndInSeconds: 1200,
    sendWaitAfterDeadRunStartInSeconds: 600,
    sendWaitAfterStopChangeInSeconds: 10,
    vehicleCapacities: new Map(),
  };
  const outboxQueue = createQueue<MessageCollection>();
  const hfpQueue = createQueue<HfpInboxQueueMessage>();
  const mockApcFuncs = {
    prepareHfpForAcknowledging: jest.fn(),
    sendApcMidServiceJourney: jest.fn(),
    sendApcFromBeginningOfLongDeadRun: jest.fn(),
    sendApcSplitBetweenServiceJourneys: jest.fn(),
    sendApcAfterLongDeadRun: jest.fn(),
    informApcWhenVehicleActorStopped: jest.fn(),
  } as ApcHandlingFunctions;
  const hfpFuncs = createHfpHandler(config, hfpQueue);
  const vehicleActor = createActor(outboxQueue, mockApcFuncs, hfpFuncs);

  test("the state machine handles a sign-on to a wrong service journey during a short dead run gracefully", () => {
    const messages: MqttDumpLine[] = [
      '2024-05-13T05:46:06.504754Z /hfp/v2/journey/ongoing/pde/bus/0012/01211/4735/1/Mikkola/08:01/4820214/3/60;25/31/30/90 {"PDE":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:45:57.620Z","tsi":1715579157,"spd":2.00,"hdg":100,"lat":60.339745,"long":25.100627,"acc":1.29,"dl":-60,"odo":15315,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"ODO","stop":4820214,"route":"4735","occu":0,"ttarr":"2024-05-13T05:45:00.000Z","ttdep":"2024-05-13T05:45:00.000Z"}}',
      '2024-05-13T05:46:06.568572Z /hfp/v2/journey/ongoing/dep/bus/0012/01211/4735/1/Mikkola/08:01/4820213/4/60;25/31/30/91 {"DEP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:06.438Z","tsi":1715579166,"spd":7.00,"hdg":95,"lat":60.339711,"long":25.101631,"acc":-0.46,"dl":-60,"odo":15364,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820214,"route":"4735","occu":0,"ttarr":"2024-05-13T05:45:00.000Z","ttdep":"2024-05-13T05:45:00.000Z"}}',
      '2024-05-13T05:46:07.356238Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/1/Mikkola/08:01/4820213/0/60;25/31/30/91 {"VP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:07.280Z","tsi":1715579167,"spd":7.87,"hdg":95,"lat":60.339711,"long":25.101631,"acc":-0.46,"dl":-66,"odo":15374,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":null,"route":"4735","occu":0}}',
      '2024-05-13T05:46:33.342997Z /hfp/v2/journey/ongoing/due/bus/0012/01211/4735/1/Mikkola/08:01/4820213/4/60;25/31/30/93 {"DUE":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:33.256Z","tsi":1715579193,"spd":8.00,"hdg":225,"lat":60.339057,"long":25.103626,"acc":0.46,"dl":-66,"odo":15562,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0,"ttarr":"2024-05-13T05:46:00.000Z","ttdep":"2024-05-13T05:46:00.000Z"}}',
      '2024-05-13T05:46:33.365243Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/1/Mikkola/08:01/4820213/4/60;25/31/30/93 {"VP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:33.280Z","tsi":1715579193,"spd":8.80,"hdg":225,"lat":60.339057,"long":25.103626,"acc":0.46,"dl":-66,"odo":15562,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":null,"route":"4735","occu":0}}',
      '2024-05-13T05:46:39.342809Z /hfp/v2/journey/ongoing/arr/bus/0012/01211/4735/1/Mikkola/08:01/4820213/3/60;25/31/30/82 {"ARR":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:39.264Z","tsi":1715579199,"spd":6.00,"hdg":230,"lat":60.338764,"long":25.102925,"acc":-0.62,"dl":-66,"odo":15611,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0,"ttarr":"2024-05-13T05:46:00.000Z","ttdep":"2024-05-13T05:46:00.000Z"}}',
      '2024-05-13T05:46:39.358795Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/1/Mikkola/08:01/4820213/3/60;25/31/30/82 {"VP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:39.280Z","tsi":1715579199,"spd":6.53,"hdg":230,"lat":60.338764,"long":25.102925,"acc":-0.62,"dl":-66,"odo":15611,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0}}',
      '2024-05-13T05:46:49.339741Z /hfp/v2/journey/ongoing/ars/bus/0012/01211/4735/1/Mikkola/08:01/4820213/4/60;25/31/30/82 {"ARS":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:49.270Z","tsi":1715579209,"spd":1.00,"hdg":147,"lat":60.338495,"long":25.102850,"acc":-0.77,"dl":-39,"odo":15651,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0,"ttarr":"2024-05-13T05:46:00.000Z","ttdep":"2024-05-13T05:46:00.000Z"}}',
      '2024-05-13T05:46:49.358781Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/1/Mikkola/08:01/4820213/4/60;25/31/30/82 {"VP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:46:49.280Z","tsi":1715579209,"spd":1.23,"hdg":147,"lat":60.338495,"long":25.102850,"acc":-0.77,"dl":-39,"odo":15651,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0}}',
      '2024-05-13T05:47:15.851590Z /hfp/v2/journey/ongoing/doo/bus/0012/01211/4735/1/Mikkola/08:01/4820213/5/60;25/31/30/82 {"DOO":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:47:15.280Z","tsi":1715579235,"spd":1.23,"hdg":54,"lat":60.338600,"long":25.102671,"acc":-0.26,"dl":-49,"odo":15666,"drst":1,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0,"ttarr":"2024-05-13T05:46:00.000Z","ttdep":"2024-05-13T05:46:00.000Z"}}',
      '2024-05-13T05:47:16.340772Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/1/Mikkola/08:01/4820213/5/60;25/31/30/82 {"VP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:47:16.280Z","tsi":1715579236,"spd":1.23,"hdg":54,"lat":60.338600,"long":25.102671,"acc":-0.26,"dl":-49,"odo":15666,"drst":1,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0}}',
      '2024-05-13T05:47:24.872962Z /hfp/v2/journey/ongoing/doc/bus/0012/01211/4735/1/Mikkola/08:01/4820213/5/60;25/31/30/82 {"DOC":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:47:24.280Z","tsi":1715579244,"spd":0.05,"hdg":54,"lat":60.338588,"long":25.102620,"acc":-0.05,"dl":-49,"odo":15666,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0,"ttarr":"2024-05-13T05:46:00.000Z","ttdep":"2024-05-13T05:46:00.000Z"}}',
      '2024-05-13T05:47:25.342412Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/1/Mikkola/08:01/4820213/5/60;25/31/30/82 {"VP":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:47:25.280Z","tsi":1715579245,"spd":0.05,"hdg":54,"lat":60.338588,"long":25.102620,"acc":-0.05,"dl":-49,"odo":15666,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0}}',
      '2024-05-13T05:47:48.333681Z /hfp/v2/journey/ongoing/vjout/bus/0012/01211/4735/1/Mikkola/08:01/4820213/5/60;25/31/30/82 {"VJOUT":{"desi":"735","dir":"1","oper":12,"veh":1211,"tst":"2024-05-13T05:47:48.270Z","tsi":1715579268,"spd":0.10,"hdg":54,"lat":60.338587,"long":25.102619,"acc":0.00,"dl":-49,"odo":15666,"drst":0,"oday":"2024-05-13","jrn":57,"line":666,"start":"08:01","loc":"GPS","stop":4820213,"route":"4735","occu":0,"dr-type":1,"block":10794}}',
      '2024-05-13T05:47:48.359404Z /hfp/v2/deadrun/ongoing/vp/bus/0012/01211 {"VP":{"desi":null,"dir":null,"oper":null,"veh":1211,"tst":"2024-05-13T05:47:48.282Z","tsi":1715579268,"spd":0.10,"hdg":54,"lat":60.338587,"long":25.102619,"acc":0.00,"dl":null,"odo":null,"drst":0,"oday":null,"jrn":null,"line":null,"start":null,"loc":"GPS","stop":4820213,"route":"4735","occu":0}}',
      '2024-05-13T05:49:26.859756Z /hfp/v2/journey/ongoing/vja/bus/0012/01211/1001/2/Eira/08:50/1250431/0/60;25/31/30/82 {"VJA":{"desi":"1","dir":"2","oper":40,"veh":1211,"tst":"2024-05-13T05:49:26.789Z","tsi":1715579366,"spd":0.05,"hdg":54,"lat":60.338593,"long":25.102628,"acc":0.00,"dl":null,"odo":null,"drst":0,"oday":"2024-05-13","jrn":1251,"line":28,"start":"08:50","loc":"GPS","stop":4820213,"route":"1001","occu":0,"dr-type":1,"block":null}}',
      '2024-05-13T05:49:27.343356Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/1001/2/Eira/08:50/1250431/0/60;25/31/30/82 {"VP":{"desi":"1","dir":"2","oper":40,"veh":1211,"tst":"2024-05-13T05:49:27.280Z","tsi":1715579367,"spd":0.05,"hdg":54,"lat":60.338593,"long":25.102628,"acc":0.00,"dl":null,"odo":0,"drst":0,"oday":"2024-05-13","jrn":1251,"line":28,"start":"08:50","loc":"GPS","stop":4820213,"route":"1001","occu":0}}',
      '2024-05-13T05:49:37.733805Z /hfp/v2/journey/ongoing/vjout/bus/0012/01211/1001/2/Eira/08:50/1250431/5/60;25/31/30/82 {"VJOUT":{"desi":"1","dir":"2","oper":40,"veh":1211,"tst":"2024-05-13T05:49:37.670Z","tsi":1715579377,"spd":0.00,"hdg":54,"lat":60.338593,"long":25.102629,"acc":-0.05,"dl":null,"odo":0,"drst":0,"oday":"2024-05-13","jrn":1251,"line":28,"start":"08:50","loc":"GPS","stop":4820213,"route":"1001","occu":0,"dr-type":1,"block":null}}',
      '2024-05-13T05:49:38.344233Z /hfp/v2/deadrun/ongoing/vp/bus/0012/01211 {"VP":{"desi":null,"dir":null,"oper":null,"veh":1211,"tst":"2024-05-13T05:49:38.280Z","tsi":1715579378,"spd":0.00,"hdg":54,"lat":60.338593,"long":25.102629,"acc":-0.05,"dl":null,"odo":0,"drst":0,"oday":null,"jrn":null,"line":null,"start":null,"loc":"GPS","stop":4820213,"route":"1001","occu":0}}',
      '2024-05-13T05:50:44.165092Z /hfp/v2/journey/ongoing/vja/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/0/60;25/31/30/83 {"VJA":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:44.086Z","tsi":1715579444,"spd":0.05,"hdg":51,"lat":60.338966,"long":25.103443,"acc":null,"dl":null,"odo":null,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820213,"route":"4735","occu":0,"dr-type":1,"block":null}}',
      '2024-05-13T05:50:44.338939Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/0/60;25/31/30/83 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:44.280Z","tsi":1715579444,"spd":0.05,"hdg":51,"lat":60.338966,"long":25.103443,"acc":null,"dl":null,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820213,"route":"4735","occu":0}}',
      '2024-05-13T05:50:44.542903Z /hfp/v2/journey/ongoing/due/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"DUE":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:44.456Z","tsi":1715579444,"spd":0.00,"hdg":51,"lat":60.338965,"long":25.103443,"acc":0.03,"dl":null,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:50:45.342969Z /hfp/v2/journey/ongoing/arr/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"ARR":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:45.260Z","tsi":1715579445,"spd":0.00,"hdg":51,"lat":60.338965,"long":25.103443,"acc":null,"dl":null,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:50:45.364902Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:45.280Z","tsi":1715579445,"spd":0.10,"hdg":51,"lat":60.338965,"long":25.103443,"acc":null,"dl":null,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0}}',
      '2024-05-13T05:50:46.351482Z /hfp/v2/journey/ongoing/ars/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"ARS":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:46.259Z","tsi":1715579446,"spd":0.00,"hdg":51,"lat":60.338966,"long":25.103443,"acc":0.05,"dl":194,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:50:46.382310Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:50:46.280Z","tsi":1715579446,"spd":0.15,"hdg":51,"lat":60.338966,"long":25.103443,"acc":0.05,"dl":193,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0}}',
      '2024-05-13T05:51:38.386861Z /hfp/v2/journey/ongoing/doo/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"DOO":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:51:38.280Z","tsi":1715579498,"spd":0.15,"hdg":51,"lat":60.338968,"long":25.103441,"acc":0.10,"dl":179,"odo":0,"drst":1,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:51:39.345970Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:51:39.280Z","tsi":1715579499,"spd":0.15,"hdg":51,"lat":60.338968,"long":25.103441,"acc":0.10,"dl":179,"odo":0,"drst":1,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0}}',
      '2024-05-13T05:53:16.351705Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:53:16.280Z","tsi":1715579596,"spd":0.05,"hdg":51,"lat":60.338964,"long":25.103431,"acc":-0.05,"dl":59,"odo":0,"drst":1,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0}}',
      '2024-05-13T05:53:16.566172Z /hfp/v2/journey/ongoing/doc/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"DOC":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:53:16.280Z","tsi":1715579596,"spd":0.10,"hdg":51,"lat":60.338964,"long":25.103431,"acc":0.05,"dl":59,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:53:17.355047Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/5/60;25/31/30/83 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:53:17.280Z","tsi":1715579597,"spd":0.10,"hdg":51,"lat":60.338964,"long":25.103431,"acc":0.05,"dl":59,"odo":0,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0}}',
      '2024-05-13T05:54:14.522702Z /hfp/v2/journey/ongoing/pde/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/3/60;25/31/30/83 {"PDE":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:54:08.595Z","tsi":1715579648,"spd":1.00,"hdg":52,"lat":60.338974,"long":25.103464,"acc":0.46,"dl":0,"odo":5,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"ODO","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:54:14.560470Z /hfp/v2/journey/ongoing/dep/bus/0012/01211/4735/2/Tikkurila as./08:54/4820207/4/60;25/31/30/93 {"DEP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:54:14.426Z","tsi":1715579654,"spd":4.00,"hdg":50,"lat":60.339089,"long":25.103705,"acc":0.31,"dl":0,"odo":20,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":4820207,"route":"4735","occu":0,"ttarr":"2024-05-13T05:54:00.000Z","ttdep":"2024-05-13T05:54:00.000Z"}}',
      '2024-05-13T05:54:15.350142Z /hfp/v2/journey/ongoing/vp/bus/0012/01211/4735/2/Tikkurila as./08:54/4820210/0/60;25/31/30/93 {"VP":{"desi":"735","dir":"2","oper":12,"veh":1211,"tst":"2024-05-13T05:54:15.280Z","tsi":1715579655,"spd":4.12,"hdg":50,"lat":60.339089,"long":25.103705,"acc":0.31,"dl":-14,"odo":24,"drst":0,"oday":"2024-05-13","jrn":871,"line":666,"start":"08:54","loc":"GPS","stop":null,"route":"4735","occu":0}}',
    ];
    // FIXME: The multiplier must match the number of reference sequence
    // checkers below. It does right now but not if this test is changed to have
    // more expect statements. The +1 comes from the initial state before the
    // messages.
    //
    // It might make sense to combine reference sequence checkers with
    // vehicleActor snapshot element extractors, collect the pairs into an
    // array and use the length of the array as the multiplier.
    expect.assertions(2 * (messages.length + 1));
    const parsed = messages.map(
      createMqttDumpLineToHfpInboxQueueMessageTransformer(logger),
    );
    const expectedServiceJourneys: (ServiceJourneyId | undefined)[] = [
      undefined,
      {
        operatingDay: "2024-05-13",
        startTime: "08:01",
        route: "4735",
        direction: 1,
      },
      {
        operatingDay: "2024-05-13",
        startTime: "08:50",
        route: "1001",
        direction: 2,
      },
      {
        operatingDay: "2024-05-13",
        startTime: "08:54",
        route: "4735",
        direction: 2,
      },
    ];
    const expectedStates = [
      "OnLongDeadRun",
      "OnServiceJourney",
      "OnShortDeadRun",
      "BeforeFirstDepartureAfterShortDeadRun",
      "OnShortDeadRun",
      "BeforeFirstDepartureAfterShortDeadRun",
      "OnServiceJourney",
    ];
    const checkCurrentServiceJourneys = createReferenceSequenceChecker(
      expectedServiceJourneys,
    );
    const checkStates = createReferenceSequenceChecker(expectedStates);
    vehicleActor.subscribe((snapshot) => {
      expect(
        checkCurrentServiceJourneys(
          snapshot.context.currentServiceJourneyState?.serviceJourneyId,
        ),
      ).toBeTruthy();
      expect(checkStates(snapshot.value)).toBeTruthy();
    });
    vehicleActor.start();
    parsed.forEach((message) => {
      vehicleActor.send({ type: "message", message });
    });
    vehicleActor.stop();
  });
});
