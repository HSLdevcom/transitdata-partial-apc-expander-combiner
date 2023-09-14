import db from './db'
require('dotenv').config()

//TODO Remove this hardcoded object?
/*const capacitiesByVehicleclass: Map<String, number> = new Map([
    ["A1", 56],
    ["A2", 67],
    ["C", 78],
    ["D", 105],
    ["MA", 19],
    ["MB", 19],
])*/

interface Vehicle {
    vehicle_id: string;
    operator_id: string;
    type: string;
}


export const getEquipmentFromDatabase = async (): Promise<Vehicle[]> => {
    // @ts-ignore
    return db(process.env.DATABASE_CONNECTION_URI).many('SELECT vehicle_id, operator_id, type FROM equipment')
}

/*const combineVehiclesAndCapacity = async (vehicles: Array<any>) => {
    let vehicleCapacities: [String, number]
    vehicles.forEach((vehicle) => {
        vehicleCapacities.push(vehicle.registry_nr, capacitiesByVehicleclass.get(vehicle.type))
    })
}*/

(async () => {
    const test = await getEquipmentFromDatabase()
    console.log(test)
})()