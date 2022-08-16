import { getUniqueVehicleIdFromMqttTopic, pickLowerQuality } from "./matching";

test("Get a unique vehicle ID from a valid MQTT topic", () => {
  const mqttTopic = "/hfp/v2/journey/ongoing/apc/bus/0022/00758";
  const uniqueVehicleId = "0022/00758";
  expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBe(uniqueVehicleId);
});

test("Get undefined instead of a unique vehicle ID from an invalid MQTT topic", () => {
  const mqttTopic = "/hfp/v2/journey/ongoing/foobar/0022/00758";
  expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBeUndefined();
});

test("Pick the lower quality from two quality levels", () => {
  expect(pickLowerQuality("regular", "regular")).toBe("regular");
  expect(pickLowerQuality("regular", "defect")).toBe("defect");
  expect(pickLowerQuality("regular", "other")).toBe("other");
  expect(pickLowerQuality("regular", "foo")).toBe("other");
  expect(pickLowerQuality("defect", "regular")).toBe("defect");
  expect(pickLowerQuality("defect", "defect")).toBe("defect");
  expect(pickLowerQuality("defect", "other")).toBe("other");
  expect(pickLowerQuality("defect", "foo")).toBe("other");
  expect(pickLowerQuality("other", "regular")).toBe("other");
  expect(pickLowerQuality("other", "defect")).toBe("other");
  expect(pickLowerQuality("other", "other")).toBe("other");
  expect(pickLowerQuality("other", "foo")).toBe("other");
  expect(pickLowerQuality("foo", "regular")).toBe("other");
  expect(pickLowerQuality("foo", "defect")).toBe("other");
  expect(pickLowerQuality("foo", "other")).toBe("other");
  expect(pickLowerQuality("foo", "foo")).toBe("other");
});
