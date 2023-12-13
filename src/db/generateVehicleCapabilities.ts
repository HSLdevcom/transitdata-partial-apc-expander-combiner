import createDb from "./db";
import type {
  DatabaseConfig,
  EquipmentFromDatabase,
  UniqueVehicleId,
  VehicleTypeCapacityMap,
  VehicleTypeConfig,
} from "../types";

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
  const db = createDb(databaseConfig.connectionString);
  const result: EquipmentFromDatabase[] = await db.many(
    "SELECT vehicle_id, operator_id, type FROM equipment",
  );
  // Close the database connection after use.
  await db.$pool.end();
  // This might be unnecessary but close the database connection another way, as
  // well.
  db.$config.pgp.end();
  return result;
};

const getCapacities = async (
  databaseConfig: DatabaseConfig,
  vehicleTypeConfig: VehicleTypeConfig,
) => {
  const capabilitiesList: EquipmentFromDatabase[] =
    await getEquipmentFromDatabase(databaseConfig);
  const capabilitiesMap = new Map<UniqueVehicleId, number | undefined>();

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
