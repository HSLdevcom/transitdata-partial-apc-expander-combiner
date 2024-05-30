import type Pulsar from "pulsar-client";
import { Actor, AnyActorLogic } from "xstate";
import type { Queue } from "./dataStructures/queue";
import { hfp } from "./protobuf/hfp";
import * as partialApc from "./quicktype/partialApc";

export type NonNullableFields<T> = { [P in keyof T]: NonNullable<T[P]> };

export type VehicleType = string;
export type UniqueVehicleId = string;

export type VehicleTypeCapacityMap = Map<VehicleType, number>;
export type VehicleCapacityMap = Map<UniqueVehicleId, number | undefined>;

export interface EquipmentFromDatabase {
  vehicle_id: string;
  operator_id: string;
  type: string;
}

export interface ProcessingConfig {
  sendWaitAfterStopChangeInSeconds: number;
  sendWaitAfterDeadRunStartInSeconds: number;
  keepApcFromDeadRunEndInSeconds: number;
  backlogDrainingWaitInSeconds: number;
  forcedAckIntervalInSeconds: number;
  forcedAckCheckIntervalInSeconds: number;
  vehicleCapacities: VehicleCapacityMap;
  defaultVehicleCapacity: number;
}

export interface PulsarConfig {
  clientConfig: Pulsar.ClientConfig;
  producerConfig: Pulsar.ProducerConfig;
  hfpConsumerConfig: Pulsar.ConsumerConfig;
  partialApcConsumerConfig: Pulsar.ConsumerConfig;
}

export interface HealthCheckConfig {
  port: number;
}

export interface DatabaseConfig {
  connectionString: string;
}

export interface VehicleTypeConfig {
  vehicleTypes: string;
}

export interface Config {
  processing: ProcessingConfig;
  pulsar: PulsarConfig;
  healthCheck: HealthCheckConfig;
  database: DatabaseConfig;
  vehicleTypes: VehicleTypeConfig;
}

export type HealthCheckStatus = "ok" | "failing";

export interface HealthCheckServer {
  close: () => Promise<void>;
  setHealth: (status: HealthCheckStatus) => void;
}

export interface RuntimeResources {
  healthCheckServer: HealthCheckServer;
  client: Pulsar.Client;
  producer: Pulsar.Producer;
  hfpConsumer: Pulsar.Consumer;
  partialApcConsumer: Pulsar.Consumer;
}

export interface PartialApcItem {
  apc: partialApc.Apc;
  mqttTopic: string;
  eventTimestamp: number;
}

export type StopId = string;
export type StopIdNumber = number;

// Do not allow missing values as that would complicate logic. Many HFP messages
// have all of the required properties even though some messages might miss some
// properties.
export interface ServiceJourneyId {
  operatingDay: string;
  startTime: string;
  route: string;
  direction: number;
}

export type DeadRun = hfp.Topic.JourneyType.deadrun;

export type VehicleJourneyId = ServiceJourneyId | DeadRun;

export interface StopState {
  currentStop: StopId;
  nextStop: StopId;
}

export interface ServiceJourneyState {
  serviceJourneyId: ServiceJourneyId;
  latestHfp: HfpServiceJourneyInboxQueueMessage;
  previousStop: StopId | undefined;
  currentStop: StopId | undefined;
}

export interface ServiceJourneyStop {
  serviceJourneyId: ServiceJourneyId;
  currentStop: StopIdNumber;
}

interface InboxQueueMessageBase {
  messageId: Pulsar.MessageId;
  eventTimestamp: number;
  uniqueVehicleId: UniqueVehicleId;
}

export interface PartialApcInboxQueueMessage extends InboxQueueMessageBase {
  type: "partialApc";
  mqttTopic: string;
  data: partialApc.Apc;
}

interface HfpInboxQueueMessageBase extends InboxQueueMessageBase {
  type: "hfp";
  data: NonNullableFields<Required<hfp.IData>>;
}

export interface HfpDeadRunInboxQueueMessage extends HfpInboxQueueMessageBase {
  vehicleJourneyId: DeadRun;
}

interface HfpServiceJourneyInboxQueueMessage extends HfpInboxQueueMessageBase {
  vehicleJourneyId: ServiceJourneyId;
  stops: Partial<StopState>;
}

export type HfpInboxQueueMessage =
  | HfpDeadRunInboxQueueMessage
  | HfpServiceJourneyInboxQueueMessage;

export type InboxQueueMessage =
  | PartialApcInboxQueueMessage
  | HfpInboxQueueMessage;

export interface HfpMessageAndStop {
  hfpMessage: HfpInboxQueueMessage;
  serviceJourneyStop: ServiceJourneyStop;
}

export interface HfpMessageAndStopPair {
  previous: HfpMessageAndStop | undefined;
  current: HfpMessageAndStop;
}

export interface VehicleContext {
  partialApcQueue: Queue<PartialApcInboxQueueMessage>;
  hfpQueue: Queue<HfpInboxQueueMessage>;
  hfpFeedPromise: Promise<void>;
}

export interface VehicleMachineContext {
  previousServiceJourneyState: ServiceJourneyState | undefined;
  currentServiceJourneyState: ServiceJourneyState | undefined;
}

export interface VehicleMachineMessageEvent {
  type: "message";
  message: HfpInboxQueueMessage;
}
export interface VehicleMachineTimerEvent {
  type: "timer";
}
export type VehicleMachineEvent =
  | VehicleMachineMessageEvent
  | VehicleMachineTimerEvent;

export interface VehicleMachineCustomArgs {
  context: VehicleMachineContext;
  event: VehicleMachineEvent;
}

export interface MessageCollection {
  toSend: Pulsar.ProducerMessage[];
  toAckPartialApc: Pulsar.MessageId[];
  toAckHfp: Pulsar.MessageId[];
}

export interface ApcHandlingFunctions {
  prepareHfpForAcknowledging: (hfpMessage: HfpInboxQueueMessage) => void;
  sendApcMidServiceJourney: (
    hfpMessageAndStop: HfpMessageAndStop,
  ) => Promise<void>;
  sendApcFromBeginningOfLongDeadRun: (
    hfpMessageAndStop: HfpMessageAndStop,
  ) => Promise<void>;
  sendApcSplitBetweenServiceJourneys: (
    hfpMessagesAndStops: NonNullableFields<HfpMessageAndStopPair>,
  ) => Promise<void>;
  sendApcAfterLongDeadRun: (
    hfpMessageAndStop: HfpMessageAndStop,
  ) => Promise<void>;
  informApcWhenVehicleActorStopped: (() => void) | undefined;
}

export interface HfpHandlingFunctions {
  setDeadRunTimer: (momentInMilliseconds: number) => void;
  removeDeadRunTimer: () => void;
  feedVehicleActor: (
    vehicleActor: Actor<AnyActorLogic>,
    backlogDrainingWaitPromise: Promise<void>,
  ) => Promise<void>;
}

export interface EndCondition {
  nHfpMessages: number;
  nPartialApcMessages: number;
  nApcMessages: number;
}

export interface HfpEndConditionFunctions {
  reportHfpQueued: (n: number) => void;
  reportHfpRead: (n: number) => void;
  isMoreHfpExpected: () => boolean;
}
