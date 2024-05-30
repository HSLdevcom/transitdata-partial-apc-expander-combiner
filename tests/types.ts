import type { hfp } from "../src/protobuf/hfp";
import type { passengerCount } from "../src/protobuf/passengerCount";

export type MqttDumpLine = `${string} ${string} {${string}}`;

export type MqttHfpPayload = Record<
  string,
  Omit<hfp.IPayload, "loc" | "SchemaVersion"> & {
    loc: string;
  }
>;

export interface ApcTestData {
  data: passengerCount.IData;
  eventTimestamp: number;
}
