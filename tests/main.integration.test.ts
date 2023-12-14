import * as postgresql from "@testcontainers/postgresql";
import fs from "fs";
import path from "path";
import pgPromise from "pg-promise";
import Pulsar from "pulsar-client";
import * as testcontainers from "testcontainers";
import main from "../src/main";
import { passengerCount } from "../src/protobuf/passengerCount";
import type { EndCondition } from "../src/types";
import decodeWithoutDefaults from "../src/util/protobufUtil";
import parseTestCase from "./testUtil/testCaseParsing";
import type { ApcTestData } from "./types";

// FIXME: Consider adding this into the test cases as well as .env files
const setEnvironmentVariables = ({
  serviceUrl,
  partialApcTopic,
  hfpTopic,
  apcTopic,
  postgresConnectionUri,
}: {
  serviceUrl: string;
  partialApcTopic: string;
  hfpTopic: string;
  apcTopic: string;
  postgresConnectionUri: string;
}): void => {
  process.env["BACKLOG_DRAINING_WAIT_IN_SECONDS"] = "60";
  process.env["CAPACITIES_BY_VEHICLE_TYPE"] = `
    [
      ["A1", 56],
      ["A2", 67],
      ["C", 78],
      ["D", 105],
      ["MA", 19],
      ["MB", 19]
    ]`;
  process.env["DATABASE_CONNECTION_URI"] = postgresConnectionUri;
  process.env["DEFAULT_VEHICLE_CAPACITY"] = "78";
  process.env["HEALTH_CHECK_PORT"] = "8080";
  process.env["KEEP_APC_FROM_DEADRUN_END_IN_SECONDS"] = "1200";
  process.env["PINO_LOG_LEVEL"] = "debug";
  process.env["PULSAR_BLOCK_IF_QUEUE_FULL"] = "true";
  process.env["PULSAR_COMPRESSION_TYPE"] = "LZ4";
  process.env["PULSAR_HFP_CONSUMER_TOPIC"] = hfpTopic;
  process.env["PULSAR_HFP_SUBSCRIPTION"] =
    "transitdata_partial_apc_expander_combiner_hfp";
  process.env["PULSAR_PARTIAL_APC_CONSUMER_TOPIC"] = partialApcTopic;
  process.env["PULSAR_PARTIAL_APC_SUBSCRIPTION"] =
    "transitdata_partial_apc_expander_combiner_partial_apc";
  process.env["PULSAR_PRODUCER_TOPIC"] = apcTopic;
  process.env["PULSAR_SERVICE_URL"] = serviceUrl;
  process.env["SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS"] = "600";
  process.env["SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS"] = "10";
};

const createVehicleModels = async (
  dir: string,
  db: pgPromise.IDatabase<unknown>,
): Promise<void> => {
  const tableName = "equipment";
  const tableInput = JSON.parse(
    fs.readFileSync(path.join(dir, "transitlogDbEquipment.json"), "utf8"),
  ) as Record<string, string | null>[];
  const createTableQuery = `
      CREATE TABLE ${tableName} (
        vehicle_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        type TEXT
      );
    `;
  await db.none(createTableQuery);
  const insertQuery = db.$config.pgp.helpers.insert(
    tableInput,
    ["operator_id", "vehicle_id", "type"],
    tableName,
  );
  await db.none(insertQuery);
};

/**
 * These tests are meant to use realistic, sanitized data dumps without spending
 * a lot of time per test restructuring the data.
 *
 * The data dumps have a simple format. Each line represents one MQTT message.
 *
 * En example line is:
 * 2023-10-30T07:12:12.830452Z /hfp/v2/journey/ongoing/apc-partial/bus/0017/00022 {"APC":{"tst":"2023-10-30T07:12:07Z","lat":60.29105,"long":24.960594,"vehiclecounts":{"vehicleload":16,"doorcounts":[{"door":"1","count":[{"class":"adult","in":0,"out":0}]},{"door":"2","count":[{"class":"adult","in":0,"out":5}]}],"countquality":"regular"},"schemaVersion":"1-1-0","messageId":"9c798e10-37ec-47aa-82db-bbca56c4cbbd"}}
 *
 * Each line starts with an ISO 8601 UTC timestamp with microseconds and the
 * suffix 'Z'. After a single space the MQTT topic follows. After a single space
 * the MQTT payload follows. As the MQTT topic might have spaces but no '{'
 * characters in it and as the MQTT payload is a JSON object, the start of the
 * payload can reliably be found by searching for the first '{' character.
 *
 * One way to collect these data dumps is by modifying and running the template
 * bash script in <projectRoot>/scripts/collect-mqtt-data.template.sh .
 */
describe("Test using realistic, anonymized data dump extracts and testcontainers", () => {
  const singleTestTimeoutInMilliseconds = 180_000;
  jest.setTimeout(singleTestTimeoutInMilliseconds);

  const testDataDir = "./tests/testData";

  const partialApcTopic = "persistent://public/default/partial-apc";
  const hfpTopic = "persistent://public/default/hfp";
  const apcTopic = "persistent://public/default/expanded-apc";

  let postgresContainer: postgresql.StartedPostgreSqlContainer;
  let db: pgPromise.IDatabase<unknown>;
  let postgresConnectionUri: string;

  const pulsarImage = "apachepulsar/pulsar:latest";
  const pulsarPortNumber = 6650;
  let pulsarContainer: testcontainers.StartedTestContainer;
  let pulsarClient: Pulsar.Client;
  let partialApcProducer: Pulsar.Producer;
  let hfpProducer: Pulsar.Producer;
  let apcReader: Pulsar.Reader;

  const createPulsarContainer =
    (): Promise<testcontainers.StartedTestContainer> =>
      new testcontainers.GenericContainer(pulsarImage)
        .withExposedPorts(pulsarPortNumber)
        .withCommand(["bin/pulsar", "standalone"])
        .withHealthCheck({
          test: ["CMD-SHELL", "bin/pulsar-admin brokers healthcheck"],
          interval: 500,
          timeout: 60_000,
          retries: 120,
        })
        .withWaitStrategy(testcontainers.Wait.forHealthCheck())
        .start();

  beforeAll(async () => {
    // The database is only read by the individual tests so we do not need to
    // recreate it for every test.
    postgresContainer = await new postgresql.PostgreSqlContainer().start();
    postgresConnectionUri = postgresContainer.getConnectionUri();
    const pgp = pgPromise();
    db = pgp(postgresConnectionUri);
    // FIXME: Instead, write the vehicle models into the database for each test
    // case in beforeEach to enable changing the capacity of the same bus over
    // time also in these tests. Same mechanism, just copy a small extract of
    // transitlogDbEquipment.json into each test case directory.
    await createVehicleModels(testDataDir, db);
    // Close the DB connection.
    await db.$pool.end();
    // Just in case pgp.end does any more deconstruction, run it.
    pgp.end();
  });

  beforeEach(async () => {
    pulsarContainer = await createPulsarContainer();
    const pulsarHost = pulsarContainer.getHost();
    const pulsarPort = pulsarContainer.getMappedPort(pulsarPortNumber);
    const serviceUrl = `pulsar://${pulsarHost}:${pulsarPort}`;
    pulsarClient = new Pulsar.Client({ serviceUrl });
    partialApcProducer = await pulsarClient.createProducer({
      topic: partialApcTopic,
    });
    hfpProducer = await pulsarClient.createProducer({
      topic: hfpTopic,
    });
    apcReader = await pulsarClient.createReader({
      topic: apcTopic,
      startMessageId: Pulsar.MessageId.earliest(),
    });
    setEnvironmentVariables({
      serviceUrl,
      partialApcTopic,
      hfpTopic,
      apcTopic,
      postgresConnectionUri,
    });
  });

  afterEach(async () => {
    await partialApcProducer.flush();
    await partialApcProducer.close();
    await hfpProducer.flush();
    await hfpProducer.close();
    await apcReader.close();
    await pulsarClient.close();
    await pulsarContainer.stop();
  });

  afterAll(async () => {
    await postgresContainer.stop();
  });

  const feedPulsar = async (
    parsedPartialApcData: Pulsar.ProducerMessage[],
    parsedHfpData: Pulsar.ProducerMessage[],
  ): Promise<void> => {
    const partialApcPromises = parsedPartialApcData.map((msg) =>
      partialApcProducer.send(msg),
    );
    const hfpPromises = parsedHfpData.map((msg) => hfpProducer.send(msg));
    await Promise.all([...partialApcPromises, ...hfpPromises]);
  };

  const runMain = async (
    endCondition: EndCondition,
    stepInMilliseconds: number,
  ): Promise<void> => {
    jest.useFakeTimers();
    let isMainDone = false;
    const mainPromise = main(endCondition).then(() => {
      isMainDone = true;
    });
    const advanceTime = async () => {
      while (!isMainDone) {
        // eslint-disable-next-line no-await-in-loop
        await jest.advanceTimersByTimeAsync(stepInMilliseconds);
      }
    };
    await Promise.all([mainPromise, advanceTime()]);
    jest.useRealTimers();
  };

  const collectResults = async (
    nMessagesExpected: number,
  ): Promise<Pulsar.Message[]> => {
    const apcPulsarMessages: Pulsar.Message[] = [];
    while (apcPulsarMessages.length < nMessagesExpected) {
      expect(apcReader.hasNext()).toBeTruthy();
      // eslint-disable-next-line no-await-in-loop
      apcPulsarMessages.push(await apcReader.readNext());
    }
    return apcPulsarMessages;
  };

  const checkAndRemoveVehicleLoadRatios = (
    received: ApcTestData,
    expected: ApcTestData,
  ): void => {
    const nDigitsAfterDecimalPoint = 5;
    expect(expected.data.payload.vehicleCounts?.vehicleLoadRatio).toBeDefined();
    if (expected.data.payload.vehicleCounts?.vehicleLoadRatio != null) {
      expect(received.data.payload.vehicleCounts?.vehicleLoadRatio).toBeCloseTo(
        expected.data.payload.vehicleCounts.vehicleLoadRatio,
        nDigitsAfterDecimalPoint,
      );
    }
    // eslint-disable-next-line no-param-reassign
    delete received.data.payload.vehicleCounts?.vehicleLoadRatio;
    // eslint-disable-next-line no-param-reassign
    delete expected.data.payload.vehicleCounts?.vehicleLoadRatio;
  };

  const checkResults = (
    apcPulsarMessages: Pulsar.Message[],
    expectedApcData: ApcTestData[],
  ) => {
    expect(apcPulsarMessages).toHaveLength(expectedApcData.length);
    apcPulsarMessages.forEach((msg, index) => {
      const decoded: ApcTestData = {
        data: decodeWithoutDefaults(passengerCount.Data, msg.getData()),
        eventTimestamp: msg.getEventTimestamp(),
      };
      const expected = expectedApcData[index];
      expect(expected).toBeDefined();
      if (expected == null) {
        throw Error("Test case expectedApcData not defined");
      }
      checkAndRemoveVehicleLoadRatios(decoded, expected);
      expect(decoded.data).toStrictEqual(expected.data);
      expect(decoded.eventTimestamp).toStrictEqual(
        expectedApcData[index]?.eventTimestamp,
      );
    });
  };

  const runSingleDataTest = async ({
    parsedPartialApcData,
    parsedHfpData,
    expectedApcData,
  }: {
    parsedPartialApcData: Pulsar.ProducerMessage[];
    parsedHfpData: Pulsar.ProducerMessage[];
    expectedApcData: ApcTestData[];
  }) => {
    const stepInMilliseconds = 100;
    const endCondition = {
      nHfpMessages: parsedHfpData.length,
      nPartialApcMessages: parsedPartialApcData.length,
      nApcMessages: expectedApcData.length,
    };
    await feedPulsar(parsedPartialApcData, parsedHfpData);
    await runMain(endCondition, stepInMilliseconds);
    const apcPulsarMessages = await collectResults(expectedApcData.length);
    checkResults(apcPulsarMessages, expectedApcData);
  };

  const createTestsFromSubdirectories = (directoryPath: string): void => {
    const subdirectories = fs
      .readdirSync(directoryPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();

    // eslint-disable-next-line no-restricted-syntax
    for (const subdir of subdirectories) {
      const { testName, parsedHfpData, parsedPartialApcData, apcData } =
        parseTestCase(directoryPath, subdir);
      // The actual test is run in another function so silence ESLint.
      // eslint-disable-next-line jest/valid-title,jest/expect-expect
      test(testName, async () => {
        await runSingleDataTest({
          parsedHfpData,
          parsedPartialApcData,
          expectedApcData: apcData,
        });
      });
    }
  };

  createTestsFromSubdirectories(testDataDir);
});
