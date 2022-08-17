import type pino from "pino";
import type Pulsar from "pulsar-client";
import type { ProcessingConfig } from "./config";
import { initializeMatching } from "./matching";

const keepReactingToHfp = async (
  producer: Pulsar.Producer,
  hfpConsumer: Pulsar.Consumer,
  expandWithApcAndSend: (
    hfpMessage: Pulsar.Message,
    sendCallback: (fullApcMessage: Pulsar.ProducerMessage) => void
  ) => void
) => {
  // Errors are handled in the calling function.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const hfpMessage = await hfpConsumer.receive();
    expandWithApcAndSend(hfpMessage, (fullApcMessage) => {
      if (fullApcMessage !== undefined) {
        // In case of an error, exit via the listener on unhandledRejection.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        producer.send(fullApcMessage);
      }
    });
    // We acknowledge hfpMessage before sending of fullApcMessage succeeds to
    // not build up backlog.
    await hfpConsumer.acknowledge(hfpMessage);
  }
  /* eslint-enable no-await-in-loop */
};

const keepSummingApcValues = async (
  partialApcConsumer: Pulsar.Consumer,
  updateApcCache: (partialApcMessage: Pulsar.Message) => void
): Promise<void> => {
  // Errors are handled on the main level.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const partialApcMessage = await partialApcConsumer.receive();
    updateApcCache(partialApcMessage);
    await partialApcConsumer.acknowledge(partialApcMessage);
  }
  /* eslint-enable no-await-in-loop */
};

const keepProcessingMessages = async (
  logger: pino.Logger,
  producer: Pulsar.Producer,
  hfpConsumer: Pulsar.Consumer,
  partialApcConsumer: Pulsar.Consumer,
  config: ProcessingConfig
): Promise<void> => {
  const { updateApcCache, expandWithApcAndSend } = initializeMatching(
    logger,
    config
  );
  const promises = [
    keepReactingToHfp(producer, hfpConsumer, expandWithApcAndSend),
    keepSummingApcValues(partialApcConsumer, updateApcCache),
  ];
  // We expect both of the promises to stay pending.
  await Promise.any(promises);
};

export default keepProcessingMessages;
