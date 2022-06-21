import type pino from "pino";
import type Pulsar from "pulsar-client";
import { hfp } from "./protobuf/hfp";
import { mqtt } from "./protobuf/mqtt";
import { passengerCount } from "./protobuf/passengerCount";
import * as partialApc from "./partialApc";

export type UniqueVehicleId = string;

interface ApcCacheItem {
  apc: partialApc.Apc;
  timestamp: number;
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
  maxCapacity: number
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
    vehicleCounts: transformVehicleCounts(apcData.vehiclecounts, maxCapacity),
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

const initializeMatching = (logger: pino.Logger, producer: Pulsar.Producer) => {
  // FIXME: consider a TTL cache like Keyv with TTL of 250 min (config value)
  const apcCache = new Map<UniqueVehicleId, ApcCacheItem>();
  const sendingTimers = new Map<UniqueVehicleId, NodeJS.Timeout>();

  // FIXME: move to config
  const timeoutInMs = 6000;

  const getMaxCapacity = (uniqueVehicleId: UniqueVehicleId): number => {
    // FIXME: just silencing tsc and eslint before proper implementation
    logger.silent(uniqueVehicleId);
    // FIXME: read a value from config matching this id
    return 40;
  };

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
        const timestamp = partialApcMessage.getEventTimestamp();
        const existingApcCacheItem = apcCache.get(uniqueVehicleId);
        if (existingApcCacheItem !== undefined) {
          newApc = sumApcValues(existingApcCacheItem.apc, newApc);
        }
        apcCache.set(uniqueVehicleId, {
          apc: newApc,
          timestamp,
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
    hfpMessageAckCallback: () => Promise<null>
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
            // FIXME: should signoff be handled akin to journey like this?
            const apcCacheItem = apcCache.get(uniqueVehicleId);
            if (apcCacheItem !== undefined) {
              const previousTimeoutId = sendingTimers.get(uniqueVehicleId);
              if (previousTimeoutId !== undefined) {
                clearTimeout(previousTimeoutId);
              }
              const timeoutId = setTimeout(() => {
                const maxCapacity = getMaxCapacity(uniqueVehicleId);
                const passengerCountData = expandWithApc(
                  hfpData,
                  apcCacheItem.apc,
                  maxCapacity
                );
                const encoded = Buffer.from(
                  passengerCount.Data.encode(passengerCountData).finish()
                );
                // FIXME: Handling sending and acking here looks ugly. Try to
                // refactor.
                //
                // In case of an error, exit via the listener on
                // unhandledRejection.
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                producer
                  .send({
                    data: encoded,
                    eventTimestamp: apcCacheItem.timestamp,
                  })
                  .then(() => hfpMessageAckCallback().then(() => {}));
                sendingTimers.delete(uniqueVehicleId);
                apcCache.delete(uniqueVehicleId);
              }, timeoutInMs);
              sendingTimers.set(uniqueVehicleId, timeoutId);
            }
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
