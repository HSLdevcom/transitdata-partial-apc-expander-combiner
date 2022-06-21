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

## Docker

You can use the Docker image `ghcr.io/hsldevcom/transitdata-partial-apc-expander-combiner:edge`.
Check out [the available tags](https://github.com/HSLdevcom/transitdata-partial-apc-expander-combiner/pkgs/container/transitdata-partial-apc-expander-combiner).

## Configuration

| Environment variable                | Required? | Default value | Description                                                                                                                                                               |
| ----------------------------------- | --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HEALTH_CHECK_PORT`                 | ❌ No     | `8080`        | Which port to use to respond to health checks.                                                                                                                            |
| `PULSAR_BLOCK_IF_QUEUE_FULL`        | ❌ No     | `true`        | Whether the send operations of the producer should block when the outgoing message queue is full. If false, send operations will immediately fail when the queue is full. |
| `PULSAR_COMPRESSION_TYPE`           | ❌ No     | `LZ4`         | The compression type to use in the topic where messages are sent. Must be one of `Zlib`, `LZ4`, `ZSTD` or `SNAPPY`.                                                       |
| `PULSAR_HFP_CONSUMER_TOPIC`         | ✅ Yes    |               | The topic pattern to consume HFP messages from.                                                                                                                           |
| `PULSAR_HFP_SUBSCRIPTION`           | ✅ Yes    |               | The name of the subscription for reading messages from `PULSAR_HFP_CONSUMER_TOPIC`.                                                                                       |
| `PULSAR_PARTIAL_APC_CONSUMER_TOPIC` | ✅ Yes    |               | The topic pattern to consume partial APC vehicle messages from.                                                                                                           |
| `PULSAR_PARTIAL_APC_SUBSCRIPTION`   | ✅ Yes    |               | The name of the subscription for reading messages from `PULSAR_PARTIAL_APC_CONSUMER_TOPIC`.                                                                               |
| `PULSAR_PRODUCER_TOPIC`             | ✅ Yes    |               | The topic to send messages to.                                                                                                                                            |
| `PULSAR_SERVICE_URL`                | ✅ Yes    |               | The service URL.                                                                                                                                                          |
