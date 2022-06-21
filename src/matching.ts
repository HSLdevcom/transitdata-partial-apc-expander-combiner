import type pino from "pino";
import type Pulsar from "pulsar-client";
import type { UniqueVehicleId, ProcessingConfig } from "./config";
import { hfp } from "./protobuf/hfp";
import { mqtt } from "./protobuf/mqtt";
import { passengerCount } from "./protobuf/passengerCount";
import * as partialApc from "./partialApc";

interface ApcCacheItem {
  apc: partialApc.Apc;
  eventTimestamp: number;
}

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
 * Mainly just rename the object keys and calculate the vehicleLoadRatio.
 */
const transformVehicleCounts = (
  vehicleCounts: partialApc.Vehiclecounts,
  vehicleCapacity: number
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

/**
 * Consider the quality order as "regular" > "defect" > "other" and select the
 * lower quality of the two. For any unexpected quality, pick "other".
 */
const pickLowerQuality = (oldQuality: string, newQuality: string): string => {
  let quality = "other";
  if (
    oldQuality === "defect" &&
    (newQuality === "defect" || newQuality === "regular")
  ) {
    quality = "defect";
  } else if (oldQuality === "regular" && newQuality === "regular") {
    quality = "regular";
  }
  return quality;
};

const sumDoorCounts = (
  cachedDoorcounts: partialApc.Doorcount[],
  newDoorcounts: partialApc.Doorcount[]
): partialApc.Doorcount[] => {
  type DoorName = string;
  type ClassName = string;
  const doorMap = new Map<DoorName, Map<ClassName, partialApc.Count>>();
  cachedDoorcounts.concat(newDoorcounts).forEach((dc) => {
    const classMap = doorMap.get(dc.door);
    if (classMap === undefined) {
      doorMap.set(dc.door, new Map(dc.count.map((c) => [c.class, c])));
    } else {
      dc.count.forEach((c) => {
        const previousClassValues = classMap.get(c.class);
        if (previousClassValues === undefined) {
          classMap.set(c.class, c);
        } else {
          classMap.set(c.class, {
            class: c.class,
            in: previousClassValues.in + c.in,
            out: previousClassValues.out + c.out,
          });
        }
      });
      doorMap.set(dc.door, classMap);
    }
  });
  const doorcounts = [...doorMap].map(([doorName, classMap]) => ({
    door: doorName,
    count: [...classMap].map(([, classCount]) => classCount),
  }));
  return doorcounts;
};

const sumApcValues = (
  cachedApc: partialApc.Apc,
  newApc: partialApc.Apc
): partialApc.Apc => {
  const lowerQuality = pickLowerQuality(
    cachedApc.vehiclecounts.countquality,
    newApc.vehiclecounts.countquality
  );
  const doorcounts = sumDoorCounts(
    cachedApc.vehiclecounts.doorcounts,
    newApc.vehiclecounts.doorcounts
  );
  return {
    ...newApc,
    vehiclecounts: {
      countquality: lowerQuality,
      vehicleload: newApc.vehiclecounts.vehicleload,
      doorcounts,
    },
  };
};

const expandWithApc = (
  hfpData: hfp.Data,
  apcData: partialApc.Apc,
  vehicleCapacity: number
): passengerCount.IData => {
  const tst = Math.round(apcData.tst.getTime() / 1000);
  const payload: passengerCount.IPayload = {
    ...hfpData.payload,
    ...apcData,
    tst,
    tsi: tst,
    loc:
      hfpData.payload.loc != null
        ? transformLocToString(hfpData.payload.loc)
        : null,
    vehicleCounts: transformVehicleCounts(
      apcData.vehiclecounts,
      vehicleCapacity
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
  return passengerCountData;
};

const initializeMatching = (
  logger: pino.Logger,
  {
    apcWaitInSeconds,
    vehicleCapacities,
    defaultVehicleCapacity,
  }: ProcessingConfig
) => {
  const apcCache = new Map<UniqueVehicleId, ApcCacheItem>();
  const sendingTimers = new Map<UniqueVehicleId, NodeJS.Timeout>();
  const apcWaitInMilliseconds = apcWaitInSeconds * 1000;

  const getVehicleCapacity = (uniqueVehicleId: UniqueVehicleId): number =>
    vehicleCapacities.get(uniqueVehicleId) ?? defaultVehicleCapacity;

  const updateApcCache = (partialApcMessage: Pulsar.Message): void => {
    try {
      const mqttMessage = mqtt.RawMessage.decode(partialApcMessage.getData());
      const uniqueVehicleId = getUniqueVehicleIdFromMqttTopic(
        mqttMessage.topic
      );
      if (uniqueVehicleId !== undefined) {
        let newApc = partialApc.Convert.toWelcome(
          mqttMessage.payload.toString()
        ).APC;
        const eventTimestamp = partialApcMessage.getEventTimestamp();
        const existingApcCacheItem = apcCache.get(uniqueVehicleId);
        if (existingApcCacheItem !== undefined) {
          newApc = sumApcValues(existingApcCacheItem.apc, newApc);
        }
        // Prefer the timestamp of the latest partial APC message.
        apcCache.set(uniqueVehicleId, {
          apc: newApc,
          eventTimestamp,
        });
      }
    } catch (err) {
      logger.warn(
        { err, partialApcMessage },
        "Something unexpected happened with partialApcMessage"
      );
    }
  };

  const expandWithApcAndSend = (
    hfpMessage: Pulsar.Message,
    sendCallback: (fullApcMessage: Pulsar.ProducerMessage) => void
  ): void => {
    try {
      const hfpData = hfp.Data.decode(hfpMessage.getData());
      if (hfpData.topic?.temporalType === hfp.Topic.TemporalType.ongoing) {
        const { uniqueVehicleId } = hfpData.topic;
        if (uniqueVehicleId !== undefined) {
          if (hfpData.topic.journeyType === hfp.Topic.JourneyType.deadrun) {
            apcCache.delete(uniqueVehicleId);
          } else if (
            hfpData.topic?.eventType != null &&
            hfpData.topic?.eventType in
              [
                hfp.Topic.EventType.PDE,
                hfp.Topic.EventType.DEP,
                hfp.Topic.EventType.VJOUT,
              ]
          ) {
            const previousTimeoutId = sendingTimers.get(uniqueVehicleId);
            if (previousTimeoutId !== undefined) {
              clearTimeout(previousTimeoutId);
              // This is not strictly necessary as we should overwrite it next
              // but let's delete the old timeoutId just in case we make a
              // mistake later.
              sendingTimers.delete(uniqueVehicleId);
            }
            const timeoutId = setTimeout(() => {
              sendingTimers.delete(uniqueVehicleId);
              const apcCacheItem = apcCache.get(uniqueVehicleId);
              if (apcCacheItem !== undefined) {
                const vehicleCapacity = getVehicleCapacity(uniqueVehicleId);
                const passengerCountData = expandWithApc(
                  hfpData,
                  apcCacheItem.apc,
                  vehicleCapacity
                );
                const encoded = Buffer.from(
                  passengerCount.Data.encode(passengerCountData).finish()
                );
                const fullApcMessage = {
                  data: encoded,
                  eventTimestamp: apcCacheItem.eventTimestamp,
                };
                // We do not wait for the finishing of the Promise below so we
                // can clean up before any other HFP event causes us to send the
                // same APC data.
                sendCallback(fullApcMessage);
                apcCache.delete(uniqueVehicleId);
              }
            }, apcWaitInMilliseconds);
            sendingTimers.set(uniqueVehicleId, timeoutId);
          }
        }
      }
    } catch (e) {
      logger.warn(
        e,
        "The HFP message does not conform to the proto definition."
      );
    }
  };

  return { updateApcCache, expandWithApcAndSend };
};

export default initializeMatching;
