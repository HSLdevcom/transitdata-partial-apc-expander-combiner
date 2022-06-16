import {
  getUniqueVehicleIdFromMqttTopic,
  getVehicleTripDetails,
} from "./mapper";
import { hfp } from "./protobuf/hfp";

test("Getting a unique vehicle ID from a valid MQTT topic succeeds", () => {
  const mqttTopic = "/hfp/v2/journey/ongoing/apc/bus/0022/00758";
  const uniqueVehicleId = "0022/00758";
  expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBe(uniqueVehicleId);
});

test("Getting a unique vehicle ID from an invalid MQTT topic returns undefined", () => {
  const mqttTopic = "/hfp/v2/journey/ongoing/foobar/0022/00758";
  expect(getUniqueVehicleIdFromMqttTopic(mqttTopic)).toBeUndefined();
});

test("Extracting details from a simple HFP message succeeds", () => {
  const mockHfpMessage: hfp.IData = {
    topic: {
      SchemaVersion: 1,
      uniqueVehicleId: "0022/00758",
      receivedAt: 123,
      topicPrefix: "/hfp/",
      topicVersion: "v2",
      journeyType: hfp.Topic.JourneyType.journey,
      temporalType: hfp.Topic.TemporalType.ongoing,
      operatorId: 22,
      vehicleNumber: 758,
    },
    payload: {
      SchemaVersion: 1,
      tst: "2022-06-01T05:06:44.123Z",
      tsi: 1654060004,
      desi: "555",
      dir: "1",
      odo: 45.12,
      oday: "2022-06-01",
      jrn: 1,
      line: 164,
      start: "08:00",
      loc: hfp.Payload.LocationQualityMethod.GPS,
      stop: 1234567,
      route: "2555",
    },
    SchemaVersion: 1,
  };
  const vehicleTripDetails = {
    uniqueVehicleId: "0022/00758",
    tripDetails: {
      desi: "555",
      dir: "1",
      odo: 45.12,
      oday: "2022-06-01",
      jrn: 1,
      line: 164,
      start: "08:00",
      loc: hfp.Payload.LocationQualityMethod.GPS,
      stop: 1234567,
      route: "2555",
    },
  };
  expect(getVehicleTripDetails(mockHfpMessage)).toStrictEqual(
    vehicleTripDetails
  );
});
