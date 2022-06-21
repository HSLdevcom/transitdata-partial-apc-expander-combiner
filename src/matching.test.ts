import { getUniqueVehicleIdFromMqttTopic } from "./matching";

test("Getting a unique vehicle ID from a valid MQTT topic succeeds", () => {
  const mqttTopic = "/hfp/v2/journey/ongoing/apc/bus/0022/00758";
  const uniqueVehicleId = "0022/00758";
  expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBe(uniqueVehicleId);
});

test("Getting a unique vehicle ID from an invalid MQTT topic returns undefined", () => {
  const mqttTopic = "/hfp/v2/journey/ongoing/foobar/0022/00758";
  expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBeUndefined();
});
