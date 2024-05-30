/**
 * This module combines HFP and partial APC data to form a complete APC message.
 */

import type Pulsar from "pulsar-client";
import { hfp } from "../protobuf/hfp";
import { passengerCount } from "../protobuf/passengerCount";
import * as partialApc from "../quicktype/partialApc";
import type { PartialApcItem, ServiceJourneyStop } from "../types";

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
    case hfp.Payload.LocationQualityMethod.DR:
      return "DR";
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
  serviceJourneyStop: ServiceJourneyStop,
): passengerCount.IData => {
  const tst = Math.floor(new Date(apcData.tst).getTime() / 1000);
  const reliableServiceJourney = {
    dir: serviceJourneyStop.serviceJourneyId.direction.toString(),
    oday: serviceJourneyStop.serviceJourneyId.operatingDay,
    start: serviceJourneyStop.serviceJourneyId.startTime,
    route: serviceJourneyStop.serviceJourneyId.route,
    stop: serviceJourneyStop.currentStop,
  };
  const base = { ...hfpData.payload, ...reliableServiceJourney };
  // Drop vehiclecounts because of the capitalization difference between partial
  // APC and passengerCount.
  const { vehiclecounts, ...apcDataWithoutVehiclecounts } = apcData;
  const payload: passengerCount.IPayload = {
    ...base,
    ...apcDataWithoutVehiclecounts,
    tst,
    tsi: tst,
    loc:
      hfpData.payload.loc != null
        ? transformLocToString(hfpData.payload.loc)
        : null,
    vehicleCounts: transformVehicleCounts(vehiclecounts, vehicleCapacity),
    // Override the field oper of the partial APC data as the APC devices likely
    // do not have access to the correct value.
    ...(hfpData.payload.oper == null ? {} : { oper: hfpData.payload.oper }),
  };
  const passengerCountDataObject = {
    SchemaVersion: 1,
    topic: mqttTopic,
    payload,
  };
  const err = passengerCount.Data.verify(passengerCountDataObject);
  if (err) {
    throw Error(err);
  }
  const passengerCountData = passengerCount.Data.create(
    passengerCountDataObject,
  );
  return passengerCountData;
};

const formProducerMessage = (
  vehicleCapacity: number,
  hfpData: hfp.IData,
  partialApcItem: PartialApcItem,
  serviceJourneyStop: ServiceJourneyStop,
): Pulsar.ProducerMessage => {
  const passengerCountData = combineHfpAndPartialApc(
    hfpData,
    partialApcItem.apc,
    partialApcItem.mqttTopic,
    vehicleCapacity,
    serviceJourneyStop,
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
