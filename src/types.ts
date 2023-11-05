import type Pulsar from "pulsar-client";

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
  apcWaitInSeconds: number;
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
