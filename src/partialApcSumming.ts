import * as partialApc from "./quicktype/partialApc";

/**
 * Select the lower of the two quality levels. Consider the quality order as
 * "regular" > "defect" > "other". For any unexpected quality level, pick
 * "other".
 */
export const pickLowerQuality = (
  oldQuality: string,
  newQuality: string,
): string => {
  let quality = "other";
  if (oldQuality === "regular" && newQuality === "regular") {
    quality = "regular";
  } else if (
    (oldQuality === "regular" && newQuality === "defect") ||
    (oldQuality === "defect" && newQuality === "regular") ||
    (oldQuality === "defect" && newQuality === "defect")
  ) {
    quality = "defect";
  }
  return quality;
};

export const sumDoorCounts = (
  cachedDoorcounts: partialApc.Doorcount[],
  newDoorcounts: partialApc.Doorcount[],
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

export const sumApcValues = (
  cachedApc: partialApc.Apc,
  newApc: partialApc.Apc,
): partialApc.Apc => {
  const lowerQuality = pickLowerQuality(
    cachedApc.vehiclecounts.countquality,
    newApc.vehiclecounts.countquality,
  );
  const doorcounts = sumDoorCounts(
    cachedApc.vehiclecounts.doorcounts,
    newApc.vehiclecounts.doorcounts,
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
