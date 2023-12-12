import pgPromise from "pg-promise";

const pgp = pgPromise();
const createDb = (connectionString: string) => pgp(connectionString);

export default createDb;
