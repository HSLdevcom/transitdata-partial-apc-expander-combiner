import type { DatabaseConfig, VehicleTypeConfig } from "./config";
import db from "./db";

const DEFAULT_CAPACITY = 78;

export type VehicleType = string;
export type UniqueVehicleId = string;

export type VehicleTypeCapacityMap = Map<VehicleType, number>;
export type VehicleCapacityMap = Map<UniqueVehicleId, number>;

interface Vehicle {
  vehicle_id: string;
  operator_id: string;
  type: string;
}

function getUniqueVehicleId(capability: Vehicle): UniqueVehicleId {
  return `${capability.operator_id}/${capability.vehicle_id.padStart(5, "0")}`;
}

const getEquipmentFromDatabase = async (
  databaseConfig: DatabaseConfig
): Promise<Vehicle[]> => {
  return db(databaseConfig.connectionString).many(
    "SELECT vehicle_id, operator_id, type FROM equipment"
  );
};

const getCapacities = async (
  databaseConfig: DatabaseConfig,
  vehicleTypeConfig: VehicleTypeConfig
) => {
  const capabilitiesList: Vehicle[] = await getEquipmentFromDatabase(
    databaseConfig
  );
  const capabilitiesMap: Map<UniqueVehicleId, number> = new Map();

  const capacitiesByVehicleTypeJson = JSON.parse(
    vehicleTypeConfig.vehicleTypes
  ) as [string, number][];
  const capacitiesByVehicleType: VehicleTypeCapacityMap = new Map(
    capacitiesByVehicleTypeJson
  );

  capabilitiesList.forEach((capability) => {
    const mapKey: string = getUniqueVehicleId(capability);
    const capacity: number | undefined = capacitiesByVehicleType.get(
      capability.type
    );
    const mapValue: number =
      capacity === undefined ? DEFAULT_CAPACITY : capacity;
    capabilitiesMap.set(mapKey, mapValue);
  });

  return capabilitiesMap;
};

export default getCapacities;
