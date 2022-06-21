import type pino from "pino";
import type Pulsar from "pulsar-client";
import initializeMatching from "./matching";

const keepReactingToHfp = async (
  hfpConsumer: Pulsar.Consumer,
  expandWithApcAndSend: (
    hfpMessage: Pulsar.Message,
    hfpMessageAckCallback: () => Promise<null>
  ) => void
) => {
  // Errors are handled in the calling function.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const hfpMessage = await hfpConsumer.receive();
    expandWithApcAndSend(hfpMessage, () => hfpConsumer.acknowledge(hfpMessage));
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
  partialApcConsumer: Pulsar.Consumer
): Promise<void> => {
  const { updateApcCache, expandWithApcAndSend } = initializeMatching(
    logger,
    producer
  );
  const promises = [
    keepReactingToHfp(hfpConsumer, expandWithApcAndSend),
    keepSummingApcValues(partialApcConsumer, updateApcCache),
  ];
  // We expect neither of the
  await Promise.any(promises);
};

export default keepProcessingMessages;
