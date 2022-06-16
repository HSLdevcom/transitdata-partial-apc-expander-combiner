# transitdata-partial-apc-expander-combiner

Expand partial APC messages with trip metadata and combine them by stops to create full APC messages.

Expand all of the partial APC messages from vehicles with trip metadata from HFP messages.
Use vehicle IDs to map between the partial APC messages and the HFP messages.
Combine the expanded messages by stops so that the combined messages look like full APC messages.

This project depends indirectly on [transitdata-common](https://github.com/HSLdevcom/transitdata-common) project for the Protobuf proto definition files though the files have been slightly modified.

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
