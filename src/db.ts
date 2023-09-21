import pgPromise from "pg-promise";

const pgp = pgPromise();
let db = (connectionString: string) => pgp(connectionString);

export default db;
