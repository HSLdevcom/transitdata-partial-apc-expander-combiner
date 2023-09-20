import db from './db'
require('dotenv').config()

const DEFAULT_CAPACITY: number = 78;

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
    return (capability.operator_id + "/" + capability.vehicle_id.padStart(5, "0"));
}

const getEquipmentFromDatabase = async (): Promise<Vehicle[]> => {
    return db(process.env['DATABASE_CONNECTION_URI']!).many('SELECT vehicle_id, operator_id, type FROM equipment')
}

const getCapacities = async () => {
    const capabilitiesList: Vehicle[] = await getEquipmentFromDatabase();
    let capabilitiesMap: Map<UniqueVehicleId, number> = new Map();

    const capacitiesByVehicleTypeJson = JSON.parse(process.env['CAPACITIES_BY_VEHICLE_TYPE']!) as [string, number][];
    const capacitiesByVehicleType: VehicleTypeCapacityMap = new Map(capacitiesByVehicleTypeJson);
    
    capabilitiesList.forEach((capability) => {
      const mapKey: string = getUniqueVehicleId(capability);
      const capacity: number | undefined = capacitiesByVehicleType.get(capability.type);
      const mapValue: number = capacity === undefined ? DEFAULT_CAPACITY : capacity;
      capabilitiesMap.set(mapKey, mapValue);
    })
  
    return capabilitiesMap;
  };

/*
(async () => {
    const test = await getEquipmentFromDatabase()
    console.log("EQUIPMENT:", test)
})()
*/
export default getCapacities