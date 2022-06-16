import type Pulsar from "pulsar-client";

export const keepUpdatingTripDetails = async (
  hfpConsumer: Pulsar.Consumer,
  updateTripDetails: (hfpMessage: Pulsar.Message) => void
) => {
  // Errors are handled in the calling function.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const hfpMessage = await hfpConsumer.receive();
    updateTripDetails(hfpMessage);
    await hfpConsumer.acknowledge(hfpMessage);
  }
  /* eslint-enable no-await-in-loop */
};

export const keepExpandingAndCombiningAndSending = async (
  producer: Pulsar.Producer,
  partialApcConsumer: Pulsar.Consumer,
  expandWithTripDetails: (
    partialApcMessage: Pulsar.Message
  ) => Pulsar.ProducerMessage | undefined
) => {
  // Errors are handled in the calling function.
  /* eslint-disable no-await-in-loop */
  for (;;) {
    const partialApcMessage = await partialApcConsumer.receive();
    const expandedApcMessage = expandWithTripDetails(partialApcMessage);
    // FIXME: Add logic for combining by stops
    if (expandedApcMessage !== undefined) {
      // In case of an error, exit via the listener on unhandledRejection.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      producer.send(expandedApcMessage).then(() => {
        // In case of an error, exit via the listener on unhandledRejection.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        partialApcConsumer.acknowledge(partialApcMessage).then(() => {});
      });
    }
  }
  /* eslint-enable no-await-in-loop */
};
