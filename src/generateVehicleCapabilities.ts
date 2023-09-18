import db from './db'
require('dotenv').config()

const DEFAULT_CAPACITY: number = 78;

const capacitiesByVehicleclass: Map<String, number> = new Map([
    ["A1", 56],
    ["A2", 67],
    ["C", 78],
    ["D", 105],
    ["MA", 19],
    ["MB", 19]
])
interface Vehicle {
    vehicle_id: string;
    operator_id: string;
    type: string;
}

const getEquipmentFromDatabase = async (): Promise<Vehicle[]> => {
    return db(process.env['DATABASE_CONNECTION_URI']!).many('SELECT vehicle_id, operator_id, type FROM equipment')
}

const getCapacities = async () => {
    const capabilitiesList = await getEquipmentFromDatabase();
    let capabilitiesMap: Map<string, number> = new Map();
  
    capabilitiesList.forEach((capability) => {
      const mapKey: string = (capability.operator_id + "/" + capability.vehicle_id);
      const capacity: number | undefined = capacitiesByVehicleclass.get(capability.type);
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