# transitdata-partial-apc-expander-combiner

Expand partial APC messages with service journey metadata and combine them by stops to create full APC messages.

Expand all of the partial APC messages from vehicles with service journey metadata from HFP messages.
Use vehicle IDs to map between the partial APC messages and the HFP messages.
Combine the expanded messages by stops so that the combined messages look like full APC messages.

This project depends indirectly on [transitdata-common](https://github.com/HSLdevcom/transitdata-common) project for the Protobuf proto definition files though the files have been slightly modified.

## High-level logic

This service hides fairly complex details in it.
It has to deal with streaming merging requirements, acknowledge read messages at the right time and deal with bugs and oddities in the HFP data and human driver behavior.

Some details:

- In general, if several partial APC messages are received per stop, the passenger counts are aggregated.

- We merge messages based on the server-side ingest timestamps instead of the reported time in the vehicles as experience has shown that the clocks in the vehicles cannot be trusted.

- The metro is not currently supported by this service as the current logic for detecting departures from stops depends on HFP event types `PDE` and `DEP` that are not currently available for the metro.

- There are some current limitations in the Node.js client for Apache Pulsar that are either bypassed or tolerated.
  In general, these limitations are commented in the code.

The following situations are considered in the code:

1. The vehicle departs from a stop in the middle of a service journey.

   This is the most basic case.
   In this and other cases we allow for partial APC messages to arrive a bit later than the message informing about the departure from the stop.
   That way network delays produce fewer errors of matching passenger counts to wrong stops.
   However, it's a delicate balance between the latency of the results, acceptance of network delays for the source data and avoiding overlapping time windows for consecutive stops.

1. The passengers alight from the previous service journey and board the next service journey at roughly the same time.

   This might happen, for example, if the final stop of the previous service journey and the first stop of the next service journey are the same.
   In this case we match alighting passengers to the previous service journey and the boarding passengers to the next service journey.

1. The driver signs from a dead run onto the service journey only after already allowing passengers to board.

   In this case we accept passenger counts from just before the start of the service journey but throw away old counts that might for example originate from the cleaner crew in the depot.

1. The driver signs out of the service journey and starts a dead run before letting all passengers out.

   In this case we wait for some time when a dead run starts before sending APC results for the last stop.

1. The driver initially signs onto the wrong service journey from a dead run.

   In this case we wait until the first departure from a stop on the new service journey before trusting the service journey choice.

1. The vehicle unexpectedly starts a dead run in the middle of a service journey and returns to the same service journey shortly after.

   In this case we try to figure out if we missed stops while the dead run was active.

1. The HFP messages for some vehicles do not ever get interpreted as departures from a stop.

   Possibly the messages are from broken HFP implementations or from test vehicles.
   In this case we forcibly acknowledge the read HFP messages when they become too old.

1. Some vehicles get partial APC messages but never HFP messages.

   Possibly the partial APC messages are from forgotten test systems.
   In this case we forcibly acknowledge the read partial APC messages when they become too old.

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

### Docker Compose

There is a Docker Compose setup for running the partial APC pipeline locally.
First `cd ./docker-compose` and then run either:

```sh
./run-everything-in-docker-compose.sh
```

to run every service inside Docker Compose, including this service, or run:

```sh
./run-everything-but-this-service-in-docker-compose.sh
```

to run every other piece of the pipeline except this service in Docker Compose.
This latter method probably enables you to develop and debug this service easier.

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

| Environment variable                       | Required? | Default value | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKLOG_DRAINING_WAIT_IN_SECONDS`         | ❌ No     | `60`          | We should wait for the consumer topics to finish consuming their backlogs before processing the messages further. As the streams are asynchronous, otherwise we might process the relevant HFP messages before the matching partial APC messages have been received. The proper solution uses a feature that has not yet been implemented in the TypeScript client, see https://github.com/apache/pulsar-client-node/issues/349 . For now we use a workaround where we give the process `BACKLOG_DRAINING_WAIT_IN_SECONDS` seconds to read the backlog before we start processing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `CAPACITIES_BY_VEHICLE_TYPE`               | ✅ Yes    |               | A map from vehicle types (e.g. `A1`, `A2`, `C`, `D`, `MA`, and `MB`) to the passenger capacity. The format is a stringified JSON array of arrays containing [string, number] pairs. An example value could be `[["A1", 56],["A2", 67],["C", 78],["D", 105],["MA", 19],["MB", 19]]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DATABASE_CONNECTION_URI`                  | ✅ Yes    |               | Database connection URL to get vehicle capacities. Needed only for local testing (Docker secret is used in server environment).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DEFAULT_VEHICLE_CAPACITY`                 | ❌ No     | `78`          | The default passenger capacity to use if no value is retrieved from the database.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `FORCED_ACK_CHECK_INTERVAL_IN_SECONDS`     | ❌ No     | `1800`        | We check for too old messages to forcibly acknowledge every `FORCED_ACK_CHECK_INTERVAL_IN_SECONDS` seconds. The value should be low enough so that the possible Pulsar topic backlog quotas are not hit. Not considering processing and network delays, `FORCED_ACK_INTERVAL_IN_SECONDS + FORCED_ACK_CHECK_INTERVAL_IN_SECONDS` should be less than what the possible Pulsar topic backlog quotas are in seconds. If a possible Pulsar topic backlog quota is based on storage size, you have to estimate the suitable time for these values. As every vehicle has its own `setInterval` timer, the value of `FORCED_ACK_CHECK_INTERVAL_IN_SECOND` should be high enough for the timers of thousands of vehicles to not take too much CPU time.                                                                                                                                                                                                                                                                                                                                                                                               |
| `FORCED_ACK_INTERVAL_IN_SECONDS`           | ❌ No     | `7200`        | Sometimes HFP data for a vehicle lack messages that would be interpreted as a departure. That causes the acknowledgment of read HFP messages to not get triggered. Or sometimes we receive partial APC messages but no HFP data for the same vehicle, so the acknowledgment of partial APC messages does not get triggered. For those reasons we force the acknowledgment of those HFP and partial APC messages that have been received at least `FORCED_ACK_INTERVAL_IN_SECONDS` seconds ago. The value must be higher than any of `SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS`, `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` or `KEEP_APC_FROM_DEADRUN_END_IN_SECONDS`. The value should be high enough so that no service journey has a realistic chance of needing that much time between two consecutive stops or stations, even trains or long-distance busses. The value should be low enough to not hit possible Pulsar topic backlog quotas. Due to how the forced acknowledgment is implemented, the old messages might be acknowledged only after `FORCED_ACK_CHECK_INTERVAL_IN_SECONDS + FORCED_ACK_CHECK_INTERVAL_IN_SECONDS` seconds. |
| `HEALTH_CHECK_PORT`                        | ❌ No     | `8080`        | Which port to use to respond to health checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `KEEP_APC_FROM_DEADRUN_END_IN_SECONDS`     | ❌ No     | `1200`        | Sometimes drivers sign onto a service journey after having already opened the doors and letting passengers in. Usually our service journey change logic handles this. Sometimes this happens after a long dead run, though. See `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` for the meaning of a long dead run. However, we should not use all of the partial APC messages collected during a long dead run as those include events at the depot, such as cleaners going in and out of the bus. Instead, when a new service journey starts after a long dead run, we match to the first stop only those partial APC messages received during the last `KEEP_APC_FROM_DEADRUN_END_IN_SECONDS` seconds before the service journey and those messages received on the first stop.                                                                                                                                                                                                                                                                                                                                                                 |
| `PINO_LOG_LEVEL`                           | ❌ No     | `info`        | The level of logging to use. One of "fatal", "error", "warn", "info", "debug", "trace" or "silent".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PULSAR_BLOCK_IF_QUEUE_FULL`               | ❌ No     | `true`        | Whether the send operations of the producer should block when the outgoing message queue is full. If false, send operations will immediately fail when the queue is full.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `PULSAR_COMPRESSION_TYPE`                  | ❌ No     | `LZ4`         | The compression type to use in the topic `PULSAR_PRODUCER_TOPIC`. Must be one of `Zlib`, `LZ4`, `ZSTD` or `SNAPPY`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PULSAR_HFP_CONSUMER_TOPIC`                | ✅ Yes    |               | The topic to consume HFP messages from.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PULSAR_HFP_SUBSCRIPTION`                  | ✅ Yes    |               | The name of the subscription for reading messages from `PULSAR_HFP_CONSUMER_TOPIC`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PULSAR_PARTIAL_APC_CONSUMER_TOPIC`        | ✅ Yes    |               | The topic to consume partial APC messages from.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `PULSAR_PARTIAL_APC_SUBSCRIPTION`          | ✅ Yes    |               | The name of the subscription for reading messages from `PULSAR_PARTIAL_APC_CONSUMER_TOPIC`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PULSAR_PRODUCER_TOPIC`                    | ✅ Yes    |               | The topic to send full APC messages to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `PULSAR_SERVICE_URL`                       | ✅ Yes    |               | The service URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` | ❌ No     | `600`         | Sometimes drivers sign out of the service journey before reaching the final stop. That is why after receiving an HFP event indicating that a dead run has started, wait and accumulate partial APC data for this many seconds before matching the partial APC data to the last stop seen on the previous service journey. If a new service journey is started before the wait is done, the wait will be cancelled and the sending of the APC data even for the previous service journey will be triggered by the first stop change on the new service journey. The code might refer to "short dead runs" and "long dead runs". This environment variable determines when a short dead run turns into a long one. `SEND_WAIT_AFTER_DEADRUN_START_IN_SECONDS` must be set larger than `SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS`.                                                                                                                                                                                                                                                                                                                 |
| `SEND_WAIT_AFTER_STOP_CHANGE_IN_SECONDS`   | ❌ No     | `10`          | After receiving an HFP event indicating a change from one stop to the next within the same service journey, wait and accumulate APC data for this many seconds before sending the APC data onwards. The value should be long enough to cover network delays of APC values. The value should be low enough so that it does not cover the next stop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

| Docker secret                     | Required? | Description                                        |
| --------------------------------- | --------- | -------------------------------------------------- |
| `TRANSITLOG_DEV_JORE_CONN_STRING` | ✅ Yes    | Database connection URL to get vehicle capacities. |
