import fs from "fs";
import path from "path";
import type Pulsar from "pulsar-client";
import { passengerCount } from "../../src/protobuf/passengerCount";
import type { ApcTestData, MqttDumpLine } from "../types";
import { parseHfpLine, parsePartialApcLine } from "./mqttDumpParsing";

const readFileLines = (filePath: string): string[] =>
  fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "");

const readApcDataFile = (filePath: string): ApcTestData[] => {
  const apcArray = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as ApcTestData[];
  const errors: {
    index: number;
    apcData: passengerCount.IData;
    eventTimestamp: number;
    err: string;
  }[] = [];
  apcArray.forEach((apc, index) => {
    const apcData = apc.data;
    const { eventTimestamp } = apc;
    const dataErrMsg = passengerCount.Data.verify(apcData);
    if (dataErrMsg != null) {
      errors.push({ index, apcData, eventTimestamp, err: dataErrMsg });
    }
    if (!(Number.isInteger(apc.eventTimestamp) && apc.eventTimestamp > 0)) {
      errors.push({
        index,
        apcData,
        eventTimestamp,
        err: "eventTimestamp must be a positive integer",
      });
    }
  });
  if (errors.length > 0) {
    throw Error(
      `For APC file ${filePath} the following data errors were found: ${JSON.stringify(
        errors,
      )}.`,
    );
  }
  return apcArray;
};

const parseTestCase = (
  directoryPath: string,
  testDirectory: string,
): {
  testName: string;
  parsedPartialApcData: Pulsar.ProducerMessage[];
  parsedHfpData: Pulsar.ProducerMessage[];
  apcData: ApcTestData[];
} => {
  const testNameFilepath = "testName";
  const subdirPath = path.join(directoryPath, testDirectory);
  const testName = readFileLines(path.join(subdirPath, testNameFilepath))[0];
  const partialApcLines = readFileLines(
    path.join(subdirPath, "partialApc.dump"),
  ) as MqttDumpLine[];
  const hfpLines = readFileLines(
    path.join(subdirPath, "hfp.dump"),
  ) as MqttDumpLine[];
  const apcData = readApcDataFile(path.join(subdirPath, "apc.json"));

  const parsedPartialApcData = partialApcLines.map(parsePartialApcLine);
  const parsedHfpData = hfpLines.map(parseHfpLine);

  if (testName === undefined) {
    throw Error(
      `Test directory ${testDirectory} does not have a name for the test in the file ${testNameFilepath}`,
    );
  }

  return { testName, parsedPartialApcData, parsedHfpData, apcData };
};

export default parseTestCase;
