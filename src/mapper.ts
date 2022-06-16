import type pino from "pino";
import type Pulsar from "pulsar-client";
import { hfp } from "./protobuf/hfp";
import { mqtt } from "./protobuf/mqtt";
import { passengerCount } from "./protobuf/passengerCount";
import * as partialApc from "./partialApc";

/**
 * The details that are missing from the partial APC messages and can be filled
 * from the HFP messages.
 */
export interface TripDetails {
  desi: string;
  dir: string;
  odo: number;
  oday: string;
  jrn: number;
  line: number;
  start: string;
  loc: hfp.Payload.LocationQualityMethod;
  stop: number;
  route: string;
}

export type UniqueVehicleId = string;

export interface VehicleTripDetails {
  uniqueVehicleId: UniqueVehicleId;
  tripDetails: TripDetails;
}

export const getVehicleTripDetails = (
  hfpData: hfp.IData
): VehicleTripDetails | undefined => {
  let result: VehicleTripDetails | undefined;
  const uniqueVehicleId = hfpData.topic?.uniqueVehicleId;
  if (uniqueVehicleId !== undefined) {
    // The following code is written verbosely to help tsc type-check it.
    if (
      hfpData.payload.desi != null &&
      hfpData.payload.dir != null &&
      hfpData.payload.odo != null &&
      hfpData.payload.oday != null &&
      hfpData.payload.jrn != null &&
      hfpData.payload.line != null &&
      hfpData.payload.start != null &&
      hfpData.payload.loc != null &&
      hfpData.payload.stop != null &&
      hfpData.payload.route != null
    ) {
      const tripDetails = {
        desi: hfpData.payload.desi,
        dir: hfpData.payload.dir,
        odo: hfpData.payload.odo,
        oday: hfpData.payload.oday,
        jrn: hfpData.payload.jrn,
        line: hfpData.payload.line,
        start: hfpData.payload.start,
        loc: hfpData.payload.loc,
        stop: hfpData.payload.stop,
        route: hfpData.payload.route,
      };
      result = {
        uniqueVehicleId,
        tripDetails,
      };
    }
  }
  return result;
};

export const getUniqueVehicleIdFromMqttTopic = (
  topic: string
): UniqueVehicleId | undefined => {
  const parts = topic.split("/");
  if (parts.length >= 9) {
    return parts.slice(7, 9).join("/");
  }
  return undefined;
};

const transformLocToString = (
  locV2: hfp.Payload.LocationQualityMethod
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
 * Rename object keys and calculate vehicleLoadRatio.
 */
const transformVehicleCounts = (
  vehicleCounts: partialApc.Vehiclecounts,
  maxCapacity: number
): passengerCount.IVehicleCounts => {
  return {
    countQuality: vehicleCounts.countquality,
    vehicleLoad: vehicleCounts.vehicleload,
    vehicleLoadRatio: vehicleCounts.vehicleload / maxCapacity,
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

const buildFullApcMessage = (
  tripDetails: TripDetails,
  partialApcContent: partialApc.Apc,
  maxCapacity: number
): Buffer => {
  const payload = {
    ...tripDetails,
    ...partialApcContent,
    tst: Math.round(partialApcContent.tst.getTime() / 1000),
    tsi: Math.round(partialApcContent.tst.getTime() / 1000),
    loc: transformLocToString(tripDetails.loc),
    vehicleCounts: transformVehicleCounts(
      partialApcContent.vehiclecounts,
      maxCapacity
    ),
  };
  const passengerCountData = passengerCount.Data.create({
    SchemaVersion: 1,
    payload,
  });
  const err = passengerCount.Data.verify(passengerCountData);
  if (err) {
    throw Error(err);
  }
  return Buffer.from(passengerCount.Data.encode(passengerCountData).finish());
};

const createMapper = (logger: pino.Logger) => {
  // FIXME: use a cache like Keyv
  const recentTripDetails = new Map<UniqueVehicleId, TripDetails>();

  const updateTripDetails = (hfpMessage: Pulsar.Message): void => {
    // FIXME: later when implementing combining by stop:
    // when certain event types occur, trigger stop change and send APC message
    try {
      const hfpData = hfp.Data.decode(hfpMessage.getData());
      if (
        hfpData.topic?.journeyType === hfp.Topic.JourneyType.journey &&
        hfpData.topic?.temporalType === hfp.Topic.TemporalType.ongoing
      ) {
        const vehicleTripDetails = getVehicleTripDetails(hfpData);
        if (vehicleTripDetails !== undefined) {
          recentTripDetails.set(
            vehicleTripDetails.uniqueVehicleId,
            vehicleTripDetails.tripDetails
          );
        }
      }
    } catch (e) {
      logger.warn(
        e,
        "The HFP message does not conform to the proto definition."
      );
    }
  };

  const getMaxCapacity = (uniqueVehicleId: UniqueVehicleId): number => {
    // FIXME: just silencing tsc and eslint before proper implementation
    logger.silent(uniqueVehicleId);
    // FIXME: read a value from config matching this id
    return 40;
  };

  const expandWithTripDetails = (
    partialApcMessage: Pulsar.Message
  ): Pulsar.ProducerMessage | undefined => {
    let result: Pulsar.ProducerMessage | undefined;
    try {
      const mqttMessage = mqtt.RawMessage.decode(partialApcMessage.getData());
      const uniqueVehicleId = getUniqueVehicleIdFromMqttTopic(
        mqttMessage.topic
      );
      if (uniqueVehicleId !== undefined) {
        const tripDetails = recentTripDetails.get(uniqueVehicleId);
        if (tripDetails !== undefined) {
          const maxCapacity = getMaxCapacity(uniqueVehicleId);
          const partialApcConverted = partialApc.Convert.toWelcome(
            mqttMessage.payload.toString()
          );
          const passengerCountMessage = buildFullApcMessage(
            tripDetails,
            partialApcConverted.APC,
            maxCapacity
          );
          result = {
            data: passengerCountMessage,
            eventTimestamp: partialApcMessage.getEventTimestamp(),
          };
        }
      }
    } catch (err) {
      logger.warn(
        { err, partialApcMessage },
        "Something unexpected happened with partialApcMessage"
      );
    }
    return result;
  };

  return { updateTripDetails, expandWithTripDetails };
};

export default createMapper;
