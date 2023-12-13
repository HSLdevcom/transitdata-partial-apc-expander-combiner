import http from "node:http";
import util from "node:util";
import type pino from "pino";
import type {
  HealthCheckConfig,
  HealthCheckServer,
  HealthCheckStatus,
  RuntimeResources,
} from "../types";

const createHealthCheckServer = (
  logger: pino.Logger,
  { port }: HealthCheckConfig,
  resources: Partial<RuntimeResources>,
): HealthCheckServer => {
  let isHealthSetToOk = false;
  let server: http.Server | undefined = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      const isProducerConnected = resources.producer?.isConnected() ?? false;
      const isHfpConsumerConnected =
        resources.hfpConsumer?.isConnected() ?? false;
      const isPartialApcConsumerConnected =
        resources.partialApcConsumer?.isConnected() ?? false;
      const isHealthy =
        isHealthSetToOk &&
        isProducerConnected &&
        isHfpConsumerConnected &&
        isPartialApcConsumerConnected;
      if (isHealthy) {
        logger.debug("Responding to health check: OK");
        res.writeHead(204);
      } else {
        logger.warn(
          {
            isHealthSetToOk,
            isProducerConnected,
            isHfpConsumerConnected,
            isPartialApcConsumerConnected,
          },
          "Responding to health check: not OK",
        );
        res.writeHead(500);
      }
    } else {
      logger.warn({ wrongUrl: req.url }, "Wrong health check URL requested");
      res.writeHead(404);
    }
    res.end();
  });
  server.listen(port);
  const setHealth = (status: HealthCheckStatus) => {
    isHealthSetToOk = status === "ok";
  };
  const close = async (): Promise<void> => {
    if (server && server.listening) {
      await util.promisify(server.close.bind(server))();
      server = undefined;
    }
  };
  return { close, setHealth };
};

export default createHealthCheckServer;
