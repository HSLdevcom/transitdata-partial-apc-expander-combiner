import type pino from "pino";
import Pulsar from "pulsar-client";
import { createPulsarLog } from "../src/config";

describe("createPulsarLog", () => {
  let mockLogger: pino.Logger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as pino.Logger;
  });

  test("should call logger.debug with correct arguments for Pulsar.LogLevel.DEBUG", () => {
    const pulsarLog = createPulsarLog(mockLogger);
    const message = "test debug message";
    const file = "debug.ts";
    const line = 42;
    pulsarLog(Pulsar.LogLevel.DEBUG, file, line, message);
    expect(mockLogger.debug).toHaveBeenCalledWith({ file, line }, message);
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test("should call logger.info with correct arguments for Pulsar.LogLevel.INFO", () => {
    const pulsarLog = createPulsarLog(mockLogger);
    const message = "test info message";
    const file = "info.ts";
    const line = 100;
    pulsarLog(Pulsar.LogLevel.INFO, file, line, message);
    expect(mockLogger.info).toHaveBeenCalledWith({ file, line }, message);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test("should call logger.warn with correct arguments for Pulsar.LogLevel.WARN", () => {
    const pulsarLog = createPulsarLog(mockLogger);
    const message = "test warn message";
    const file = "warn.ts";
    const line = 200;
    pulsarLog(Pulsar.LogLevel.WARN, file, line, message);
    expect(mockLogger.warn).toHaveBeenCalledWith({ file, line }, message);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  test("should call logger.error with correct arguments for Pulsar.LogLevel.ERROR", () => {
    const pulsarLog = createPulsarLog(mockLogger);
    const message = "test error message";
    const file = "error.ts";
    const line = 500;
    pulsarLog(Pulsar.LogLevel.ERROR, file, line, message);
    expect(mockLogger.error).toHaveBeenCalledWith({ file, line }, message);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  test("should throw an error for an unknown log level to satisfy exhaustive check", () => {
    const pulsarLog = createPulsarLog(mockLogger);
    const unknownLevel = -1 as Pulsar.LogLevel;
    expect(() => {
      pulsarLog(unknownLevel, "file.ts", 1, "unknown");
    }).toThrow();
  });
});
