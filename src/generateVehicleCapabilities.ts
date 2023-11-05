import type {
  DatabaseConfig,
  UniqueVehicleId,
  EquipmentFromDatabase,
  VehicleTypeCapacityMap,
  VehicleTypeConfig,
} from "./types";
import db from "./db";

function getUniqueVehicleId(
  capability: EquipmentFromDatabase,
): UniqueVehicleId {
  return `${capability.operator_id.padStart(
    4,
    "0",
  )}/${capability.vehicle_id.padStart(5, "0")}`;
}

const getEquipmentFromDatabase = async (
  databaseConfig: DatabaseConfig,
): Promise<EquipmentFromDatabase[]> => {
  return db(databaseConfig.connectionString).many(
    "SELECT vehicle_id, operator_id, type FROM equipment",
  );
};

const getCapacities = async (
  databaseConfig: DatabaseConfig,
  vehicleTypeConfig: VehicleTypeConfig,
) => {
  const capabilitiesList: EquipmentFromDatabase[] =
    await getEquipmentFromDatabase(databaseConfig);
  const capabilitiesMap: Map<UniqueVehicleId, number | undefined> = new Map();

  const capacitiesByVehicleTypeJson = JSON.parse(
    vehicleTypeConfig.vehicleTypes,
  ) as [string, number][];
  const capacitiesByVehicleType: VehicleTypeCapacityMap = new Map(
    capacitiesByVehicleTypeJson,
  );

  capabilitiesList.forEach((capability) => {
    const mapKey: string = getUniqueVehicleId(capability);
    const capacity: number | undefined = capacitiesByVehicleType.get(
      capability.type,
    );
    const mapValue: number | undefined = capacity;
    capabilitiesMap.set(mapKey, mapValue);
  });

  return capabilitiesMap;
};

export default getCapacities;
