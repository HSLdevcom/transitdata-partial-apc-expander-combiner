# transitdata-partial-apc-expander-combiner

Expand partial APC messages with trip metadata and combine them by stops to create full APC messages.

Expand all of the partial APC messages from vehicles with trip metadata from HFP messages.
Use vehicle IDs to map between the partial APC messages and the HFP messages.
Combine the expanded messages by stops so that the combined messages look like full APC messages.

This project depends indirectly on [transitdata-common](https://github.com/HSLdevcom/transitdata-common) project for the Protobuf proto definition files though the files have been slightly modified.

## Business logic

```mermaid
flowchart TB;
  %% Nodes

  start("Start handling either an HFP or a partial APC event.")
  stop("Stop processing the event.")
  hfp("Start handling the HFP event.")
  journeyType("Assess the journey type.")
  eventType("Assess the event type.")
  clearApc("Clear the APC values for this vehicle\nfrom the APC cache.")
  sumApc("Add the APC values\ninto the existing APC values\nfor this vehicle\nin the APC cache.")
  sendApc("Clear any previous timer for this vehicle.\nStart a new timer of n seconds for this vehicle.\nWhen the time is up,\nread the APC values for this vehicle from the APC cache\nand combine them with the trip details from this event.\nSend the combination to the Pulsar cluster.")

  %% Edges
  %%
  %% Events from https://digitransit.fi/en/developers/apis/4-realtime-api/vehicle-positions/ on 2022-06-20

  start -- "partial APC event" --> sumApc
  start -- "HFP event" --> hfp;
  hfp -- upcoming --> stop;
  hfp -- ongoing --> journeyType;
  journeyType -- "journey,\nsignoff" --> eventType;
  journeyType -- deadrun --> clearApc;
  eventType -- "vp,\ndue,\narr,\nars,\npas,\nwait,\ndoo,\ndoc,\ntlr,\ntla,\nda,\ndout,\nba,\nbout,\nvja" --> stop;
  eventType -- dep --> sendApc;
  eventType -- pde --> sendApc;
  eventType -- vjout --> sendApc;
  sendApc --> clearApc;
  clearApc --> stop;
  sumApc --> stop;
```

## Development

1. Install [the build dependencies for the Apache Pulsar C++ client](https://pulsar.apache.org/docs/en/client-libraries-cpp/#system-requirements).
1. Create a suitable `.env` file for configuration.
   Check below for the configuration reference.
1. Install dependencies:

   ```sh
   npm install
   ```

1. Run linters and tests and build:

   ```sh
   npm run check-and-build
   ```

1. Load the environment variables:

   ```sh
   set -a
   source .env
   set +a
   ```

1. Run the application:

   ```sh
   npm start
   ```

## Testing approach

There are unit tests, property-based tests and integration tests.
`npm run check-and-build` runs all tests.

The integration tests are based on anonymized MQTT data dumps and expected results.
Each integration test case has its own subdirectory under `./tests/testData/`.
The data is collected with [`./scripts/collect-mqtt-data.template.sh`](./scripts/collect-mqtt-data.template.sh).

As there is some delay-based business logic in use, integration tests cannot practically be run so that the code being tested would run in Docker while the test logic would run outside of Docker.
Otherwise it would take e.g. 15 minutes for one integration test to finish while most of the execution time is spent waiting a timer to go off.
Instead we mock the timers in the integration tests and use [Testcontainers](https://testcontainers.com/) for the services we depend on.

## Docker

You can use the Docker image `hsldevcom/transitdata-partial-apc-expander-combiner:edge`.
Check out [the available tags](https://hub.docker.com/r/hsldevcom/transitdata-partial-apc-expander-combiner).

## Configuration

| Environment variable                       | Required? | Default value | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKLOG_DRAINING_WAIT_IN_SECONDS`         | ❌ No     | `60`          | We should wait for the consumer topics to finish consuming their backlogs before processing the messages further. As the streams are asynchronous, otherwise we might process the relevant HFP messages before the matching partial APC messages have been received. The proper solution uses a feature that has not yet been implemented in the TypeScript client, see https://github.com/apache/pulsar-client-node/issues/349 . For now we use a workaround where we give the process `BACKLOG_DRAINING_WAIT_IN_SECONDS` seconds to read the backlog before we start processing.                                                                                                                                                                                                                                        |
| `CAPACITIES_BY_VEHICLE_TYPE`               | ✅ Yes    |               | A map from vehicle types (e.g. `A1`, `A2`, `C`, `D`, `MA`, and `MB`) to the passenger capacity. The format is a stringified JSON array of arrays containing [string, number] pairs. An example value could be `[["A1", 56],["A2", 67],["C", 78],["D", 105],["MA", 19],["MB", 19]]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `DATABASE_CONNECTION_URI`                  | ✅ Yes    |               | Database connection URL to get vehicle capacities. Needed only for local testing (Docker secret is used in server environment).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DEFAULT_VEHICLE_CAPACITY`                 | ❌ No     | `78`          | The default passenger capacity to use if no value is retrieved from the database.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `HEALTH_CHECK_PORT`                        | ❌ No     | `8080`        | Which port to use to respond to health checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `KEEP_APC_FROM_DEADRUN_END_IN_SECONDS`     | ❌ No     | `1200`        | Sometimes drivers sign into a vehicle journey after having already opened the doors and letting passengers in. Usually our vehicle journey change logic handles this. Sometimes this happens after a long deadrun, though. See `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` for the meaning of a long deadrun. However, we should not use all of the partial APC messages collected during a long deadrun as those include events at the depot, such as cleaners going in and out of the bus. Instead, when a new vehicle journey starts after a long deadrun, we match to the first stop only those partial APC messages received during the last `KEEP_APC_FROM_DEADRUN_END_IN_SECONDS` seconds before the vehicle journey and those messages received on the first stop.                                                 |
| `PINO_LOG_LEVEL`                           | ❌ No     | `info`        | The level of logging to use. One of "fatal", "error", "warn", "info", "debug", "trace" or "silent".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PULSAR_BLOCK_IF_QUEUE_FULL`               | ❌ No     | `true`        | Whether the send operations of the producer should block when the outgoing message queue is full. If false, send operations will immediately fail when the queue is full.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PULSAR_COMPRESSION_TYPE`                  | ❌ No     | `LZ4`         | The compression type to use in the topic `PULSAR_PRODUCER_TOPIC`. Must be one of `Zlib`, `LZ4`, `ZSTD` or `SNAPPY`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PULSAR_HFP_CONSUMER_TOPIC`                | ✅ Yes    |               | The topic to consume HFP messages from.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PULSAR_HFP_SUBSCRIPTION`                  | ✅ Yes    |               | The name of the subscription for reading messages from `PULSAR_HFP_CONSUMER_TOPIC`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PULSAR_PARTIAL_APC_CONSUMER_TOPIC`        | ✅ Yes    |               | The topic to consume partial APC messages from.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PULSAR_PARTIAL_APC_SUBSCRIPTION`          | ✅ Yes    |               | The name of the subscription for reading messages from `PULSAR_PARTIAL_APC_CONSUMER_TOPIC`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `PULSAR_PRODUCER_TOPIC`                    | ✅ Yes    |               | The topic to send full APC messages to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PULSAR_SERVICE_URL`                       | ✅ Yes    |               | The service URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` | ❌ No     | `600`         | Sometimes drivers sign out of the vehicle journey before reaching the final stop. That is why after receiving an HFP event indicating that a deadrun has started, wait and accumulate partial APC data for this many seconds before matching the partial APC data to the last stop seen on the previous vehicle journey. If a new vehicle journey is started before the wait is done, the wait will be cancelled and the sending of the APC data even for the previous vehicle journey will be triggered by the first stop change on the new vehicle journey. The code might refer to "short deadruns" and "long deadruns". This environment variable determines when a short deadrun turns into a long one. `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` must be set larger than `SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS`. |
| `SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS`   | ❌ No     | `10`          | After receiving an HFP event indicating a change from one stop to the next within the same vehicle journey, wait and accumulate APC data for this many seconds before sending the APC data onwards. The value should be long enough to cover network delays of APC values. The value should be low enough so that it does not cover the next stop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

| Docker secret                     | Required? | Description                                        |
| --------------------------------- | --------- | -------------------------------------------------- |
| `TRANSITLOG_DEV_JORE_CONN_STRING` | ✅ Yes    | Database connection URL to get vehicle capacities. |
