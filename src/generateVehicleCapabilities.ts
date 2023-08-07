import Postgres from "pg";
import type { DatabaseConfig } from "./config"

export const createPostgresClient = ({connectionString} :DatabaseConfig)  => {
    return new Postgres.Client({
        connectionString: connectionString
    });
}

export const getEquipmentFromDatabase = async (client: Postgres.Client) => {
    await client.connect()
    const res = await client.query("SELECT * FROM equipment")
    await client.end()
    return res.rows;

}