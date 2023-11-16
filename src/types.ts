import type { MutexInterface } from "async-mutex";
import type Pulsar from "pulsar-client";
import type { PriorityQueue } from "./dataStructures/priorityQueue";
import { hfp } from "./protobuf/hfp";
import * as partialApc from "./quicktype/partialApc";

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
  sendWaitAfterDeadrunStartInSeconds: number;
  keepApcFromDeadrunEndInSeconds: number;
  backlogDrainingWaitInSeconds: number;
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

export interface EndCondition {
  nHfpMessages: number;
  nPartialApcMessages: number;
  nApcMessages: number;
}

export interface PartialApcItem {
  apc: partialApc.Apc;
  mqttTopic: string;
  eventTimestamp: number;
}

export type StopId = string;

// Do not allow missing values as that would complicate logic. Many HFP messages
// have all of the required properties even though some messages might miss some
// properties.
export interface VehicleJourney {
  operatingDay: string;
  startTime: string;
  route: string;
  direction: number;
}

export interface StopState {
  currentStop: StopId;
  nextStop: StopId;
}

export interface VehicleJourneyState {
  vehicleJourney: VehicleJourney;
  stopState: StopState;
}

export interface InitiallyUnknownState {
  type: "initiallyUnknown";
}

export interface FirstStopOnNewVehicleJourneyState {
  type: "firstStopOnNewVehicleJourney";
  currentVehicleJourneyState: VehicleJourneyState;
}

export interface MidVehicleJourneyState {
  type: "midVehicleJourney";
  currentVehicleJourneyState: VehicleJourneyState;
}

export interface ShortDeadrunState {
  type: "shortDeadrun";
  previousVehicleJourneyState: VehicleJourneyState;
}

export interface LongDeadrunState {
  type: "longDeadrun";
}

export type VehicleState =
  | InitiallyUnknownState
  | FirstStopOnNewVehicleJourneyState
  | MidVehicleJourneyState
  | ShortDeadrunState
  | LongDeadrunState;

export interface InboxQueueMessageBase {
  messageId: Pulsar.MessageId;
  eventTimestamp: number;
  uniqueVehicleId: UniqueVehicleId;
}

export interface PartialApcInboxQueueMessage extends InboxQueueMessageBase {
  type: "partialApc";
  mqttTopic: string;
  data: partialApc.Apc;
}

export interface HfpInboxQueueMessageBase extends InboxQueueMessageBase {
  type: "hfp";
  journeyType: hfp.Topic.JourneyType.deadrun | hfp.Topic.JourneyType.journey;
  data: hfp.IData;
}

export interface HfpDeadrunInboxQueueMessage extends HfpInboxQueueMessageBase {
  journeyType: hfp.Topic.JourneyType.deadrun;
}

export interface HfpVehicleJourneyInboxQueueMessage
  extends HfpInboxQueueMessageBase {
  journeyType: hfp.Topic.JourneyType.journey;
  currentVehicleJourneyState: VehicleJourneyState;
  eventType: hfp.Topic.EventType;
}

export type HfpInboxQueueMessage =
  | HfpDeadrunInboxQueueMessage
  | HfpVehicleJourneyInboxQueueMessage;

export type PoisonPill = "STOP";

export type InboxQueueMessage =
  | PartialApcInboxQueueMessage
  | HfpInboxQueueMessage;

export type InboxQueueMessageOrPoisonPill = InboxQueueMessage | PoisonPill;

export interface IgnoreAndAckCommand {
  type: "ignoreAndAck";
}

export interface PotentiallySendOnDeadrunCommand {
  type: "potentiallySendOnDeadrun";
}

export interface SendOnJourneyCommand {
  type: "sendOnJourney";
}

export interface OnlyCollectCommand {
  type: "onlyCollect";
}

export type PreVehicleQueueCommand =
  | "ignoreAndAck"
  | "potentiallySendOnDeadrun"
  | "sendOnJourney"
  | "onlyCollect";

export interface CacheCommand {
  type: "cache";
  value: "cacheMostRecent" | "cacheAlsoPrevious";
}

export interface SendCommand {
  type: "send";
  value: "sendWithThisStopMetadata" | "sendWithCachedStopMetadata";
}

export interface CropCommand {
  type: "crop";
  value: "cropToRecentApcMessages";
}

export type PostVehicleQueueCommand = CacheCommand | SendCommand | CropCommand;

export interface TransitionOutput {
  preCommand: PreVehicleQueueCommand;
  postCommands: PostVehicleQueueCommand[];
}

export interface HfpVehicleQueueMessage {
  type: "hfp";
  commands: PostVehicleQueueCommand[];
  // effectTimestamp is when Marker should affect the sending of messages.
  // There might be a delay in comparison to the wrapped eventTimestamp, for
  // example.
  effectTimestamp: number;
  wrapped: HfpInboxQueueMessage;
}

export type PartialApcVehicleQueueMessage = PartialApcInboxQueueMessage;

export type VehicleQueueMessage =
  | HfpVehicleQueueMessage
  | PartialApcVehicleQueueMessage;

export interface VehicleContext {
  vehicleState: VehicleState;
  nextSendOnJourneyAllowedAfterTimestamp: number;
  abortDeadrunTrigger: (() => void) | undefined;
  deadrunTriggerTimestamp: number | undefined;
  inboxQueue: PriorityQueue<InboxQueueMessageOrPoisonPill>;
  midQueue: PriorityQueue<VehicleQueueMessage>;
  messageFormingMutex: MutexInterface;
}

export interface SharedContext {
  backlogDrainingWait: Promise<void>;
  reportSent: ((toAdd: number) => void) | undefined;
}

export interface MessageCollection {
  toSend: Pulsar.ProducerMessage[];
  toAckPartialApc: Pulsar.MessageId[];
  toAckHfp: Pulsar.MessageId[];
}

export interface MessageCollectionState {
  collection: MessageCollection;
  isMessageCollectionFormed: boolean;
  previousVehicleJourney: HfpInboxQueueMessage | undefined;
  latestHfp: HfpInboxQueueMessage | undefined;
  partialApcs: PartialApcInboxQueueMessage[];
}
