import pgPromise from "pg-promise";

const pgp = pgPromise();
const db = (connectionString: string) => pgp(connectionString);

export default db;
