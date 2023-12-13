import { hfp } from "./protobuf/hfp";
import { passengerCount } from "./protobuf/passengerCount";
import * as partialApc from "./quicktype/partialApc";
import type { PartialApcItem } from "./types";

const transformLocToString = (
  locV2: hfp.Payload.LocationQualityMethod,
): string => {
  switch (locV2) {
    case hfp.Payload.LocationQualityMethod.GPS:
      return "GPS";
    case hfp.Payload.LocationQualityMethod.ODO:
      return "ODO";
    case hfp.Payload.LocationQualityMethod.MAN:
      return "MAN";
    case hfp.Payload.LocationQualityMethod.NA:
      return "N/A";
    default: {
      const exhaustiveCheck: never = locV2;
      throw new Error(String(exhaustiveCheck));
    }
  }
};

/**
 * Mainly just rename the object keys and calculate the vehicleLoadRatio.
 */
const transformVehicleCounts = (
  vehicleCounts: partialApc.Vehiclecounts,
  vehicleCapacity: number,
): passengerCount.IVehicleCounts => {
  return {
    countQuality: vehicleCounts.countquality,
    vehicleLoad: vehicleCounts.vehicleload,
    vehicleLoadRatio: vehicleCounts.vehicleload / vehicleCapacity,
    doorCounts: vehicleCounts.doorcounts.map((dc) => ({
      door: dc.door,
      count: dc.count.map((c) => ({
        clazz: c.class,
        in: c.in,
        out: c.out,
      })),
    })),
  };
};

const combineHfpAndPartialApc = (
  hfpData: hfp.IData,
  apcData: partialApc.Apc,
  mqttTopic: string,
  vehicleCapacity: number,
  preferTopicStop: boolean,
): passengerCount.IData => {
  const tst = Math.floor(new Date(apcData.tst).getTime() / 1000);
  let { stop } = hfpData.payload;
  if (preferTopicStop) {
    const nextStopString = hfpData.topic?.nextStop;
    let nextStop: number | undefined;
    if (nextStopString != null && nextStopString !== "EOL") {
      nextStop = parseInt(nextStopString, 10);
      if (Number.isFinite(nextStop)) {
        stop = nextStop;
      }
    }
  }
  const base =
    stop != null ? { ...hfpData.payload, stop } : { ...hfpData.payload };
  const payload: passengerCount.IPayload = {
    ...base,
    ...apcData,
    tst,
    tsi: tst,
    loc:
      hfpData.payload.loc != null
        ? transformLocToString(hfpData.payload.loc)
        : null,
    vehicleCounts: transformVehicleCounts(
      apcData.vehiclecounts,
      vehicleCapacity,
    ),
    // Override the field oper of the partial APC data as the APC devices likely
    // do not have access to the correct value.
    ...(hfpData.payload.oper == null ? {} : { oper: hfpData.payload.oper }),
  };
  const passengerCountData = passengerCount.Data.create({
    SchemaVersion: 1,
    topic: mqttTopic,
    payload,
  });
  const err = passengerCount.Data.verify(passengerCountData);
  if (err) {
    throw Error(err);
  }
  return passengerCountData;
};

const formProducerMessage = (
  vehicleCapacity: number,
  hfpData: hfp.IData,
  partialApcItem: PartialApcItem,
  preferTopicStop: boolean,
) => {
  const passengerCountData = combineHfpAndPartialApc(
    hfpData,
    partialApcItem.apc,
    partialApcItem.mqttTopic,
    vehicleCapacity,
    preferTopicStop,
  );
  const encoded = Buffer.from(
    passengerCount.Data.encode(passengerCountData).finish(),
  );
  return {
    data: encoded,
    // Prefer the timestamp of the latest partial APC message.
    eventTimestamp: partialApcItem.eventTimestamp,
  };
};

export default formProducerMessage;
