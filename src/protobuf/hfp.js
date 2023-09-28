/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const hfp = ($root.hfp = (() => {
  /**
   * Namespace hfp.
   * @exports hfp
   * @namespace
   */
  const hfp = {};

  hfp.Data = (function () {
    /**
     * Properties of a Data.
     * @memberof hfp
     * @interface IData
     * @property {number} SchemaVersion Data SchemaVersion
     * @property {hfp.ITopic|null} [topic] Data topic
     * @property {hfp.IPayload} payload Data payload
     */

    /**
     * Constructs a new Data.
     * @memberof hfp
     * @classdesc Represents a Data.
     * @implements IData
     * @constructor
     * @param {hfp.IData=} [properties] Properties to set
     */
    function Data(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Data SchemaVersion.
     * @member {number} SchemaVersion
     * @memberof hfp.Data
     * @instance
     */
    Data.prototype.SchemaVersion = 1;

    /**
     * Data topic.
     * @member {hfp.ITopic|null|undefined} topic
     * @memberof hfp.Data
     * @instance
     */
    Data.prototype.topic = null;

    /**
     * Data payload.
     * @member {hfp.IPayload} payload
     * @memberof hfp.Data
     * @instance
     */
    Data.prototype.payload = null;

    /**
     * Creates a new Data instance using the specified properties.
     * @function create
     * @memberof hfp.Data
     * @static
     * @param {hfp.IData=} [properties] Properties to set
     * @returns {hfp.Data} Data instance
     */
    Data.create = function create(properties) {
      return new Data(properties);
    };

    /**
     * Encodes the specified Data message. Does not implicitly {@link hfp.Data.verify|verify} messages.
     * @function encode
     * @memberof hfp.Data
     * @static
     * @param {hfp.IData} message Data message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Data.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.SchemaVersion);
      if (message.topic != null && Object.hasOwnProperty.call(message, "topic"))
        $root.hfp.Topic.encode(
          message.topic,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork()
        ).ldelim();
      $root.hfp.Payload.encode(
        message.payload,
        writer.uint32(/* id 3, wireType 2 =*/ 26).fork()
      ).ldelim();
      return writer;
    };

    /**
     * Encodes the specified Data message, length delimited. Does not implicitly {@link hfp.Data.verify|verify} messages.
     * @function encodeDelimited
     * @memberof hfp.Data
     * @static
     * @param {hfp.IData} message Data message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Data.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Data message from the specified reader or buffer.
     * @function decode
     * @memberof hfp.Data
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {hfp.Data} Data
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Data.decode = function decode(reader, length) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.hfp.Data();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1: {
            message.SchemaVersion = reader.int32();
            break;
          }
          case 2: {
            message.topic = $root.hfp.Topic.decode(reader, reader.uint32());
            break;
          }
          case 3: {
            message.payload = $root.hfp.Payload.decode(reader, reader.uint32());
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      if (!message.hasOwnProperty("SchemaVersion"))
        throw $util.ProtocolError("missing required 'SchemaVersion'", {
          instance: message,
        });
      if (!message.hasOwnProperty("payload"))
        throw $util.ProtocolError("missing required 'payload'", {
          instance: message,
        });
      return message;
    };

    /**
     * Decodes a Data message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof hfp.Data
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {hfp.Data} Data
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Data.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Data message.
     * @function verify
     * @memberof hfp.Data
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Data.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (!$util.isInteger(message.SchemaVersion))
        return "SchemaVersion: integer expected";
      if (message.topic != null && message.hasOwnProperty("topic")) {
        let error = $root.hfp.Topic.verify(message.topic);
        if (error) return "topic." + error;
      }
      {
        let error = $root.hfp.Payload.verify(message.payload);
        if (error) return "payload." + error;
      }
      return null;
    };

    /**
     * Creates a Data message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof hfp.Data
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {hfp.Data} Data
     */
    Data.fromObject = function fromObject(object) {
      if (object instanceof $root.hfp.Data) return object;
      let message = new $root.hfp.Data();
      if (object.SchemaVersion != null)
        message.SchemaVersion = object.SchemaVersion | 0;
      if (object.topic != null) {
        if (typeof object.topic !== "object")
          throw TypeError(".hfp.Data.topic: object expected");
        message.topic = $root.hfp.Topic.fromObject(object.topic);
      }
      if (object.payload != null) {
        if (typeof object.payload !== "object")
          throw TypeError(".hfp.Data.payload: object expected");
        message.payload = $root.hfp.Payload.fromObject(object.payload);
      }
      return message;
    };

    /**
     * Creates a plain object from a Data message. Also converts values to other types if specified.
     * @function toObject
     * @memberof hfp.Data
     * @static
     * @param {hfp.Data} message Data
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Data.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.SchemaVersion = 1;
        object.topic = null;
        object.payload = null;
      }
      if (
        message.SchemaVersion != null &&
        message.hasOwnProperty("SchemaVersion")
      )
        object.SchemaVersion = message.SchemaVersion;
      if (message.topic != null && message.hasOwnProperty("topic"))
        object.topic = $root.hfp.Topic.toObject(message.topic, options);
      if (message.payload != null && message.hasOwnProperty("payload"))
        object.payload = $root.hfp.Payload.toObject(message.payload, options);
      return object;
    };

    /**
     * Converts this Data to JSON.
     * @function toJSON
     * @memberof hfp.Data
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Data.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Data
     * @function getTypeUrl
     * @memberof hfp.Data
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Data.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/hfp.Data";
    };

    return Data;
  })();

  hfp.Topic = (function () {
    /**
     * Properties of a Topic.
     * @memberof hfp
     * @interface ITopic
     * @property {number} SchemaVersion Topic SchemaVersion
     * @property {number|Long} receivedAt Topic receivedAt
     * @property {string} topicPrefix Topic topicPrefix
     * @property {string} topicVersion Topic topicVersion
     * @property {hfp.Topic.JourneyType} journeyType Topic journeyType
     * @property {hfp.Topic.TemporalType} temporalType Topic temporalType
     * @property {hfp.Topic.EventType|null} [eventType] Topic eventType
     * @property {hfp.Topic.TransportMode|null} [transportMode] Topic transportMode
     * @property {number} operatorId Topic operatorId
     * @property {number} vehicleNumber Topic vehicleNumber
     * @property {string} uniqueVehicleId Topic uniqueVehicleId
     * @property {string|null} [routeId] Topic routeId
     * @property {number|null} [directionId] Topic directionId
     * @property {string|null} [headsign] Topic headsign
     * @property {string|null} [startTime] Topic startTime
     * @property {string|null} [nextStop] Topic nextStop
     * @property {number|null} [geohashLevel] Topic geohashLevel
     * @property {number|null} [latitude] Topic latitude
     * @property {number|null} [longitude] Topic longitude
     */

    /**
     * Constructs a new Topic.
     * @memberof hfp
     * @classdesc Represents a Topic.
     * @implements ITopic
     * @constructor
     * @param {hfp.ITopic=} [properties] Properties to set
     */
    function Topic(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Topic SchemaVersion.
     * @member {number} SchemaVersion
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.SchemaVersion = 1;

    /**
     * Topic receivedAt.
     * @member {number|Long} receivedAt
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.receivedAt = $util.Long
      ? $util.Long.fromBits(0, 0, false)
      : 0;

    /**
     * Topic topicPrefix.
     * @member {string} topicPrefix
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.topicPrefix = "";

    /**
     * Topic topicVersion.
     * @member {string} topicVersion
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.topicVersion = "";

    /**
     * Topic journeyType.
     * @member {hfp.Topic.JourneyType} journeyType
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.journeyType = 0;

    /**
     * Topic temporalType.
     * @member {hfp.Topic.TemporalType} temporalType
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.temporalType = 0;

    /**
     * Topic eventType.
     * @member {hfp.Topic.EventType} eventType
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.eventType = 0;

    /**
     * Topic transportMode.
     * @member {hfp.Topic.TransportMode} transportMode
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.transportMode = 0;

    /**
     * Topic operatorId.
     * @member {number} operatorId
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.operatorId = 0;

    /**
     * Topic vehicleNumber.
     * @member {number} vehicleNumber
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.vehicleNumber = 0;

    /**
     * Topic uniqueVehicleId.
     * @member {string} uniqueVehicleId
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.uniqueVehicleId = "";

    /**
     * Topic routeId.
     * @member {string} routeId
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.routeId = "";

    /**
     * Topic directionId.
     * @member {number} directionId
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.directionId = 0;

    /**
     * Topic headsign.
     * @member {string} headsign
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.headsign = "";

    /**
     * Topic startTime.
     * @member {string} startTime
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.startTime = "";

    /**
     * Topic nextStop.
     * @member {string} nextStop
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.nextStop = "";

    /**
     * Topic geohashLevel.
     * @member {number} geohashLevel
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.geohashLevel = 0;

    /**
     * Topic latitude.
     * @member {number} latitude
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.latitude = 0;

    /**
     * Topic longitude.
     * @member {number} longitude
     * @memberof hfp.Topic
     * @instance
     */
    Topic.prototype.longitude = 0;

    /**
     * Creates a new Topic instance using the specified properties.
     * @function create
     * @memberof hfp.Topic
     * @static
     * @param {hfp.ITopic=} [properties] Properties to set
     * @returns {hfp.Topic} Topic instance
     */
    Topic.create = function create(properties) {
      return new Topic(properties);
    };

    /**
     * Encodes the specified Topic message. Does not implicitly {@link hfp.Topic.verify|verify} messages.
     * @function encode
     * @memberof hfp.Topic
     * @static
     * @param {hfp.ITopic} message Topic message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Topic.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.SchemaVersion);
      writer.uint32(/* id 2, wireType 0 =*/ 16).int64(message.receivedAt);
      writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.topicPrefix);
      writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.topicVersion);
      writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.journeyType);
      writer.uint32(/* id 6, wireType 0 =*/ 48).int32(message.temporalType);
      if (
        message.eventType != null &&
        Object.hasOwnProperty.call(message, "eventType")
      )
        writer.uint32(/* id 7, wireType 0 =*/ 56).int32(message.eventType);
      if (
        message.transportMode != null &&
        Object.hasOwnProperty.call(message, "transportMode")
      )
        writer.uint32(/* id 8, wireType 0 =*/ 64).int32(message.transportMode);
      writer.uint32(/* id 9, wireType 0 =*/ 72).int32(message.operatorId);
      writer.uint32(/* id 10, wireType 0 =*/ 80).int32(message.vehicleNumber);
      writer
        .uint32(/* id 11, wireType 2 =*/ 90)
        .string(message.uniqueVehicleId);
      if (
        message.routeId != null &&
        Object.hasOwnProperty.call(message, "routeId")
      )
        writer.uint32(/* id 12, wireType 2 =*/ 98).string(message.routeId);
      if (
        message.directionId != null &&
        Object.hasOwnProperty.call(message, "directionId")
      )
        writer.uint32(/* id 13, wireType 0 =*/ 104).int32(message.directionId);
      if (
        message.headsign != null &&
        Object.hasOwnProperty.call(message, "headsign")
      )
        writer.uint32(/* id 14, wireType 2 =*/ 114).string(message.headsign);
      if (
        message.startTime != null &&
        Object.hasOwnProperty.call(message, "startTime")
      )
        writer.uint32(/* id 15, wireType 2 =*/ 122).string(message.startTime);
      if (
        message.nextStop != null &&
        Object.hasOwnProperty.call(message, "nextStop")
      )
        writer.uint32(/* id 16, wireType 2 =*/ 130).string(message.nextStop);
      if (
        message.geohashLevel != null &&
        Object.hasOwnProperty.call(message, "geohashLevel")
      )
        writer.uint32(/* id 17, wireType 0 =*/ 136).int32(message.geohashLevel);
      if (
        message.latitude != null &&
        Object.hasOwnProperty.call(message, "latitude")
      )
        writer.uint32(/* id 18, wireType 1 =*/ 145).double(message.latitude);
      if (
        message.longitude != null &&
        Object.hasOwnProperty.call(message, "longitude")
      )
        writer.uint32(/* id 19, wireType 1 =*/ 153).double(message.longitude);
      return writer;
    };

    /**
     * Encodes the specified Topic message, length delimited. Does not implicitly {@link hfp.Topic.verify|verify} messages.
     * @function encodeDelimited
     * @memberof hfp.Topic
     * @static
     * @param {hfp.ITopic} message Topic message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Topic.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Topic message from the specified reader or buffer.
     * @function decode
     * @memberof hfp.Topic
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {hfp.Topic} Topic
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Topic.decode = function decode(reader, length) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.hfp.Topic();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1: {
            message.SchemaVersion = reader.int32();
            break;
          }
          case 2: {
            message.receivedAt = reader.int64();
            break;
          }
          case 3: {
            message.topicPrefix = reader.string();
            break;
          }
          case 4: {
            message.topicVersion = reader.string();
            break;
          }
          case 5: {
            message.journeyType = reader.int32();
            break;
          }
          case 6: {
            message.temporalType = reader.int32();
            break;
          }
          case 7: {
            message.eventType = reader.int32();
            break;
          }
          case 8: {
            message.transportMode = reader.int32();
            break;
          }
          case 9: {
            message.operatorId = reader.int32();
            break;
          }
          case 10: {
            message.vehicleNumber = reader.int32();
            break;
          }
          case 11: {
            message.uniqueVehicleId = reader.string();
            break;
          }
          case 12: {
            message.routeId = reader.string();
            break;
          }
          case 13: {
            message.directionId = reader.int32();
            break;
          }
          case 14: {
            message.headsign = reader.string();
            break;
          }
          case 15: {
            message.startTime = reader.string();
            break;
          }
          case 16: {
            message.nextStop = reader.string();
            break;
          }
          case 17: {
            message.geohashLevel = reader.int32();
            break;
          }
          case 18: {
            message.latitude = reader.double();
            break;
          }
          case 19: {
            message.longitude = reader.double();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      if (!message.hasOwnProperty("SchemaVersion"))
        throw $util.ProtocolError("missing required 'SchemaVersion'", {
          instance: message,
        });
      if (!message.hasOwnProperty("receivedAt"))
        throw $util.ProtocolError("missing required 'receivedAt'", {
          instance: message,
        });
      if (!message.hasOwnProperty("topicPrefix"))
        throw $util.ProtocolError("missing required 'topicPrefix'", {
          instance: message,
        });
      if (!message.hasOwnProperty("topicVersion"))
        throw $util.ProtocolError("missing required 'topicVersion'", {
          instance: message,
        });
      if (!message.hasOwnProperty("journeyType"))
        throw $util.ProtocolError("missing required 'journeyType'", {
          instance: message,
        });
      if (!message.hasOwnProperty("temporalType"))
        throw $util.ProtocolError("missing required 'temporalType'", {
          instance: message,
        });
      if (!message.hasOwnProperty("operatorId"))
        throw $util.ProtocolError("missing required 'operatorId'", {
          instance: message,
        });
      if (!message.hasOwnProperty("vehicleNumber"))
        throw $util.ProtocolError("missing required 'vehicleNumber'", {
          instance: message,
        });
      if (!message.hasOwnProperty("uniqueVehicleId"))
        throw $util.ProtocolError("missing required 'uniqueVehicleId'", {
          instance: message,
        });
      return message;
    };

    /**
     * Decodes a Topic message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof hfp.Topic
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {hfp.Topic} Topic
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Topic.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Topic message.
     * @function verify
     * @memberof hfp.Topic
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Topic.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (!$util.isInteger(message.SchemaVersion))
        return "SchemaVersion: integer expected";
      if (
        !$util.isInteger(message.receivedAt) &&
        !(
          message.receivedAt &&
          $util.isInteger(message.receivedAt.low) &&
          $util.isInteger(message.receivedAt.high)
        )
      )
        return "receivedAt: integer|Long expected";
      if (!$util.isString(message.topicPrefix))
        return "topicPrefix: string expected";
      if (!$util.isString(message.topicVersion))
        return "topicVersion: string expected";
      switch (message.journeyType) {
        default:
          return "journeyType: enum value expected";
        case 0:
        case 1:
        case 2:
          break;
      }
      switch (message.temporalType) {
        default:
          return "temporalType: enum value expected";
        case 0:
        case 1:
          break;
      }
      if (message.eventType != null && message.hasOwnProperty("eventType"))
        switch (message.eventType) {
          default:
            return "eventType: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 10:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
          case 16:
          case 17:
            break;
        }
      if (
        message.transportMode != null &&
        message.hasOwnProperty("transportMode")
      )
        switch (message.transportMode) {
          default:
            return "transportMode: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            break;
        }
      if (!$util.isInteger(message.operatorId))
        return "operatorId: integer expected";
      if (!$util.isInteger(message.vehicleNumber))
        return "vehicleNumber: integer expected";
      if (!$util.isString(message.uniqueVehicleId))
        return "uniqueVehicleId: string expected";
      if (message.routeId != null && message.hasOwnProperty("routeId"))
        if (!$util.isString(message.routeId)) return "routeId: string expected";
      if (message.directionId != null && message.hasOwnProperty("directionId"))
        if (!$util.isInteger(message.directionId))
          return "directionId: integer expected";
      if (message.headsign != null && message.hasOwnProperty("headsign"))
        if (!$util.isString(message.headsign))
          return "headsign: string expected";
      if (message.startTime != null && message.hasOwnProperty("startTime"))
        if (!$util.isString(message.startTime))
          return "startTime: string expected";
      if (message.nextStop != null && message.hasOwnProperty("nextStop"))
        if (!$util.isString(message.nextStop))
          return "nextStop: string expected";
      if (
        message.geohashLevel != null &&
        message.hasOwnProperty("geohashLevel")
      )
        if (!$util.isInteger(message.geohashLevel))
          return "geohashLevel: integer expected";
      if (message.latitude != null && message.hasOwnProperty("latitude"))
        if (typeof message.latitude !== "number")
          return "latitude: number expected";
      if (message.longitude != null && message.hasOwnProperty("longitude"))
        if (typeof message.longitude !== "number")
          return "longitude: number expected";
      return null;
    };

    /**
     * Creates a Topic message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof hfp.Topic
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {hfp.Topic} Topic
     */
    Topic.fromObject = function fromObject(object) {
      if (object instanceof $root.hfp.Topic) return object;
      let message = new $root.hfp.Topic();
      if (object.SchemaVersion != null)
        message.SchemaVersion = object.SchemaVersion | 0;
      if (object.receivedAt != null)
        if ($util.Long)
          (message.receivedAt = $util.Long.fromValue(
            object.receivedAt
          )).unsigned = false;
        else if (typeof object.receivedAt === "string")
          message.receivedAt = parseInt(object.receivedAt, 10);
        else if (typeof object.receivedAt === "number")
          message.receivedAt = object.receivedAt;
        else if (typeof object.receivedAt === "object")
          message.receivedAt = new $util.LongBits(
            object.receivedAt.low >>> 0,
            object.receivedAt.high >>> 0
          ).toNumber();
      if (object.topicPrefix != null)
        message.topicPrefix = String(object.topicPrefix);
      if (object.topicVersion != null)
        message.topicVersion = String(object.topicVersion);
      switch (object.journeyType) {
        default:
          if (typeof object.journeyType === "number") {
            message.journeyType = object.journeyType;
            break;
          }
          break;
        case "journey":
        case 0:
          message.journeyType = 0;
          break;
        case "deadrun":
        case 1:
          message.journeyType = 1;
          break;
        case "signoff":
        case 2:
          message.journeyType = 2;
          break;
      }
      switch (object.temporalType) {
        default:
          if (typeof object.temporalType === "number") {
            message.temporalType = object.temporalType;
            break;
          }
          break;
        case "ongoing":
        case 0:
          message.temporalType = 0;
          break;
        case "upcoming":
        case 1:
          message.temporalType = 1;
          break;
      }
      switch (object.eventType) {
        default:
          if (typeof object.eventType === "number") {
            message.eventType = object.eventType;
            break;
          }
          break;
        case "VP":
        case 0:
          message.eventType = 0;
          break;
        case "DUE":
        case 1:
          message.eventType = 1;
          break;
        case "ARR":
        case 2:
          message.eventType = 2;
          break;
        case "ARS":
        case 3:
          message.eventType = 3;
          break;
        case "PDE":
        case 4:
          message.eventType = 4;
          break;
        case "DEP":
        case 5:
          message.eventType = 5;
          break;
        case "PAS":
        case 6:
          message.eventType = 6;
          break;
        case "WAIT":
        case 7:
          message.eventType = 7;
          break;
        case "DOO":
        case 8:
          message.eventType = 8;
          break;
        case "DOC":
        case 9:
          message.eventType = 9;
          break;
        case "TLR":
        case 10:
          message.eventType = 10;
          break;
        case "TLA":
        case 11:
          message.eventType = 11;
          break;
        case "DA":
        case 12:
          message.eventType = 12;
          break;
        case "DOUT":
        case 13:
          message.eventType = 13;
          break;
        case "BA":
        case 14:
          message.eventType = 14;
          break;
        case "BOUT":
        case 15:
          message.eventType = 15;
          break;
        case "VJA":
        case 16:
          message.eventType = 16;
          break;
        case "VJOUT":
        case 17:
          message.eventType = 17;
          break;
      }
      switch (object.transportMode) {
        default:
          if (typeof object.transportMode === "number") {
            message.transportMode = object.transportMode;
            break;
          }
          break;
        case "bus":
        case 0:
          message.transportMode = 0;
          break;
        case "train":
        case 1:
          message.transportMode = 1;
          break;
        case "tram":
        case 2:
          message.transportMode = 2;
          break;
        case "metro":
        case 3:
          message.transportMode = 3;
          break;
        case "ferry":
        case 4:
          message.transportMode = 4;
          break;
        case "ubus":
        case 5:
          message.transportMode = 5;
          break;
        case "robot":
        case 6:
          message.transportMode = 6;
          break;
      }
      if (object.operatorId != null) message.operatorId = object.operatorId | 0;
      if (object.vehicleNumber != null)
        message.vehicleNumber = object.vehicleNumber | 0;
      if (object.uniqueVehicleId != null)
        message.uniqueVehicleId = String(object.uniqueVehicleId);
      if (object.routeId != null) message.routeId = String(object.routeId);
      if (object.directionId != null)
        message.directionId = object.directionId | 0;
      if (object.headsign != null) message.headsign = String(object.headsign);
      if (object.startTime != null)
        message.startTime = String(object.startTime);
      if (object.nextStop != null) message.nextStop = String(object.nextStop);
      if (object.geohashLevel != null)
        message.geohashLevel = object.geohashLevel | 0;
      if (object.latitude != null) message.latitude = Number(object.latitude);
      if (object.longitude != null)
        message.longitude = Number(object.longitude);
      return message;
    };

    /**
     * Creates a plain object from a Topic message. Also converts values to other types if specified.
     * @function toObject
     * @memberof hfp.Topic
     * @static
     * @param {hfp.Topic} message Topic
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Topic.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.SchemaVersion = 1;
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.receivedAt =
            options.longs === String
              ? long.toString()
              : options.longs === Number
              ? long.toNumber()
              : long;
        } else object.receivedAt = options.longs === String ? "0" : 0;
        object.topicPrefix = "";
        object.topicVersion = "";
        object.journeyType = options.enums === String ? "journey" : 0;
        object.temporalType = options.enums === String ? "ongoing" : 0;
        object.eventType = options.enums === String ? "VP" : 0;
        object.transportMode = options.enums === String ? "bus" : 0;
        object.operatorId = 0;
        object.vehicleNumber = 0;
        object.uniqueVehicleId = "";
        object.routeId = "";
        object.directionId = 0;
        object.headsign = "";
        object.startTime = "";
        object.nextStop = "";
        object.geohashLevel = 0;
        object.latitude = 0;
        object.longitude = 0;
      }
      if (
        message.SchemaVersion != null &&
        message.hasOwnProperty("SchemaVersion")
      )
        object.SchemaVersion = message.SchemaVersion;
      if (message.receivedAt != null && message.hasOwnProperty("receivedAt"))
        if (typeof message.receivedAt === "number")
          object.receivedAt =
            options.longs === String
              ? String(message.receivedAt)
              : message.receivedAt;
        else
          object.receivedAt =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.receivedAt)
              : options.longs === Number
              ? new $util.LongBits(
                  message.receivedAt.low >>> 0,
                  message.receivedAt.high >>> 0
                ).toNumber()
              : message.receivedAt;
      if (message.topicPrefix != null && message.hasOwnProperty("topicPrefix"))
        object.topicPrefix = message.topicPrefix;
      if (
        message.topicVersion != null &&
        message.hasOwnProperty("topicVersion")
      )
        object.topicVersion = message.topicVersion;
      if (message.journeyType != null && message.hasOwnProperty("journeyType"))
        object.journeyType =
          options.enums === String
            ? $root.hfp.Topic.JourneyType[message.journeyType] === undefined
              ? message.journeyType
              : $root.hfp.Topic.JourneyType[message.journeyType]
            : message.journeyType;
      if (
        message.temporalType != null &&
        message.hasOwnProperty("temporalType")
      )
        object.temporalType =
          options.enums === String
            ? $root.hfp.Topic.TemporalType[message.temporalType] === undefined
              ? message.temporalType
              : $root.hfp.Topic.TemporalType[message.temporalType]
            : message.temporalType;
      if (message.eventType != null && message.hasOwnProperty("eventType"))
        object.eventType =
          options.enums === String
            ? $root.hfp.Topic.EventType[message.eventType] === undefined
              ? message.eventType
              : $root.hfp.Topic.EventType[message.eventType]
            : message.eventType;
      if (
        message.transportMode != null &&
        message.hasOwnProperty("transportMode")
      )
        object.transportMode =
          options.enums === String
            ? $root.hfp.Topic.TransportMode[message.transportMode] === undefined
              ? message.transportMode
              : $root.hfp.Topic.TransportMode[message.transportMode]
            : message.transportMode;
      if (message.operatorId != null && message.hasOwnProperty("operatorId"))
        object.operatorId = message.operatorId;
      if (
        message.vehicleNumber != null &&
        message.hasOwnProperty("vehicleNumber")
      )
        object.vehicleNumber = message.vehicleNumber;
      if (
        message.uniqueVehicleId != null &&
        message.hasOwnProperty("uniqueVehicleId")
      )
        object.uniqueVehicleId = message.uniqueVehicleId;
      if (message.routeId != null && message.hasOwnProperty("routeId"))
        object.routeId = message.routeId;
      if (message.directionId != null && message.hasOwnProperty("directionId"))
        object.directionId = message.directionId;
      if (message.headsign != null && message.hasOwnProperty("headsign"))
        object.headsign = message.headsign;
      if (message.startTime != null && message.hasOwnProperty("startTime"))
        object.startTime = message.startTime;
      if (message.nextStop != null && message.hasOwnProperty("nextStop"))
        object.nextStop = message.nextStop;
      if (
        message.geohashLevel != null &&
        message.hasOwnProperty("geohashLevel")
      )
        object.geohashLevel = message.geohashLevel;
      if (message.latitude != null && message.hasOwnProperty("latitude"))
        object.latitude =
          options.json && !isFinite(message.latitude)
            ? String(message.latitude)
            : message.latitude;
      if (message.longitude != null && message.hasOwnProperty("longitude"))
        object.longitude =
          options.json && !isFinite(message.longitude)
            ? String(message.longitude)
            : message.longitude;
      return object;
    };

    /**
     * Converts this Topic to JSON.
     * @function toJSON
     * @memberof hfp.Topic
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Topic.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Topic
     * @function getTypeUrl
     * @memberof hfp.Topic
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Topic.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/hfp.Topic";
    };

    /**
     * JourneyType enum.
     * @name hfp.Topic.JourneyType
     * @enum {number}
     * @property {number} journey=0 journey value
     * @property {number} deadrun=1 deadrun value
     * @property {number} signoff=2 signoff value
     */
    Topic.JourneyType = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "journey")] = 0;
      values[(valuesById[1] = "deadrun")] = 1;
      values[(valuesById[2] = "signoff")] = 2;
      return values;
    })();

    /**
     * TemporalType enum.
     * @name hfp.Topic.TemporalType
     * @enum {number}
     * @property {number} ongoing=0 ongoing value
     * @property {number} upcoming=1 upcoming value
     */
    Topic.TemporalType = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "ongoing")] = 0;
      values[(valuesById[1] = "upcoming")] = 1;
      return values;
    })();

    /**
     * EventType enum.
     * @name hfp.Topic.EventType
     * @enum {number}
     * @property {number} VP=0 VP value
     * @property {number} DUE=1 DUE value
     * @property {number} ARR=2 ARR value
     * @property {number} ARS=3 ARS value
     * @property {number} PDE=4 PDE value
     * @property {number} DEP=5 DEP value
     * @property {number} PAS=6 PAS value
     * @property {number} WAIT=7 WAIT value
     * @property {number} DOO=8 DOO value
     * @property {number} DOC=9 DOC value
     * @property {number} TLR=10 TLR value
     * @property {number} TLA=11 TLA value
     * @property {number} DA=12 DA value
     * @property {number} DOUT=13 DOUT value
     * @property {number} BA=14 BA value
     * @property {number} BOUT=15 BOUT value
     * @property {number} VJA=16 VJA value
     * @property {number} VJOUT=17 VJOUT value
     */
    Topic.EventType = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "VP")] = 0;
      values[(valuesById[1] = "DUE")] = 1;
      values[(valuesById[2] = "ARR")] = 2;
      values[(valuesById[3] = "ARS")] = 3;
      values[(valuesById[4] = "PDE")] = 4;
      values[(valuesById[5] = "DEP")] = 5;
      values[(valuesById[6] = "PAS")] = 6;
      values[(valuesById[7] = "WAIT")] = 7;
      values[(valuesById[8] = "DOO")] = 8;
      values[(valuesById[9] = "DOC")] = 9;
      values[(valuesById[10] = "TLR")] = 10;
      values[(valuesById[11] = "TLA")] = 11;
      values[(valuesById[12] = "DA")] = 12;
      values[(valuesById[13] = "DOUT")] = 13;
      values[(valuesById[14] = "BA")] = 14;
      values[(valuesById[15] = "BOUT")] = 15;
      values[(valuesById[16] = "VJA")] = 16;
      values[(valuesById[17] = "VJOUT")] = 17;
      return values;
    })();

    /**
     * TransportMode enum.
     * @name hfp.Topic.TransportMode
     * @enum {number}
     * @property {number} bus=0 bus value
     * @property {number} train=1 train value
     * @property {number} tram=2 tram value
     * @property {number} metro=3 metro value
     * @property {number} ferry=4 ferry value
     * @property {number} ubus=5 ubus value
     * @property {number} robot=6 robot value
     */
    Topic.TransportMode = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "bus")] = 0;
      values[(valuesById[1] = "train")] = 1;
      values[(valuesById[2] = "tram")] = 2;
      values[(valuesById[3] = "metro")] = 3;
      values[(valuesById[4] = "ferry")] = 4;
      values[(valuesById[5] = "ubus")] = 5;
      values[(valuesById[6] = "robot")] = 6;
      return values;
    })();

    return Topic;
  })();

  hfp.Payload = (function () {
    /**
     * Properties of a Payload.
     * @memberof hfp
     * @interface IPayload
     * @property {number} SchemaVersion Payload SchemaVersion
     * @property {string|null} [desi] Payload desi
     * @property {string|null} [dir] Payload dir
     * @property {number|null} [oper] Payload oper
     * @property {number|null} [veh] Payload veh
     * @property {string} tst Payload tst
     * @property {number|Long} tsi Payload tsi
     * @property {number|null} [spd] Payload spd
     * @property {number|null} [hdg] Payload hdg
     * @property {number|null} [lat] Payload lat
     * @property {number|null} [long] Payload long
     * @property {number|null} [acc] Payload acc
     * @property {number|null} [dl] Payload dl
     * @property {number|null} [odo] Payload odo
     * @property {number|null} [drst] Payload drst
     * @property {string|null} [oday] Payload oday
     * @property {number|null} [jrn] Payload jrn
     * @property {number|null} [line] Payload line
     * @property {string|null} [start] Payload start
     * @property {hfp.Payload.LocationQualityMethod|null} [loc] Payload loc
     * @property {number|null} [stop] Payload stop
     * @property {string|null} [route] Payload route
     * @property {number|null} [occu] Payload occu
     * @property {number|null} [seq] Payload seq
     * @property {string|null} [ttarr] Payload ttarr
     * @property {string|null} [ttdep] Payload ttdep
     * @property {number|null} [drType] Payload drType
     * @property {number|null} [tlpRequestid] Payload tlpRequestid
     * @property {hfp.Payload.TlpRequestType|null} [tlpRequesttype] Payload tlpRequesttype
     * @property {hfp.Payload.TlpPriorityLevel|null} [tlpPrioritylevel] Payload tlpPrioritylevel
     * @property {hfp.Payload.TlpReason|null} [tlpReason] Payload tlpReason
     * @property {number|null} [tlpAttSeq] Payload tlpAttSeq
     * @property {hfp.Payload.TlpDecision|null} [tlpDecision] Payload tlpDecision
     * @property {number|null} [sid] Payload sid
     * @property {number|null} [signalGroupid] Payload signalGroupid
     * @property {number|null} [tlpSignalgroupnbr] Payload tlpSignalgroupnbr
     * @property {number|null} [tlpLineConfigid] Payload tlpLineConfigid
     * @property {number|null} [tlpPointConfigid] Payload tlpPointConfigid
     * @property {number|null} [tlpFrequency] Payload tlpFrequency
     * @property {string|null} [tlpProtocol] Payload tlpProtocol
     * @property {string|null} [label] Payload label
     */

    /**
     * Constructs a new Payload.
     * @memberof hfp
     * @classdesc Represents a Payload.
     * @implements IPayload
     * @constructor
     * @param {hfp.IPayload=} [properties] Properties to set
     */
    function Payload(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * Payload SchemaVersion.
     * @member {number} SchemaVersion
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.SchemaVersion = 1;

    /**
     * Payload desi.
     * @member {string} desi
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.desi = "";

    /**
     * Payload dir.
     * @member {string} dir
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.dir = "";

    /**
     * Payload oper.
     * @member {number} oper
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.oper = 0;

    /**
     * Payload veh.
     * @member {number} veh
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.veh = 0;

    /**
     * Payload tst.
     * @member {string} tst
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tst = "";

    /**
     * Payload tsi.
     * @member {number|Long} tsi
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tsi = $util.Long ? $util.Long.fromBits(0, 0, false) : 0;

    /**
     * Payload spd.
     * @member {number} spd
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.spd = 0;

    /**
     * Payload hdg.
     * @member {number} hdg
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.hdg = 0;

    /**
     * Payload lat.
     * @member {number} lat
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.lat = 0;

    /**
     * Payload long.
     * @member {number} long
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.long = 0;

    /**
     * Payload acc.
     * @member {number} acc
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.acc = 0;

    /**
     * Payload dl.
     * @member {number} dl
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.dl = 0;

    /**
     * Payload odo.
     * @member {number} odo
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.odo = 0;

    /**
     * Payload drst.
     * @member {number} drst
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.drst = 0;

    /**
     * Payload oday.
     * @member {string} oday
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.oday = "";

    /**
     * Payload jrn.
     * @member {number} jrn
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.jrn = 0;

    /**
     * Payload line.
     * @member {number} line
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.line = 0;

    /**
     * Payload start.
     * @member {string} start
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.start = "";

    /**
     * Payload loc.
     * @member {hfp.Payload.LocationQualityMethod} loc
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.loc = 0;

    /**
     * Payload stop.
     * @member {number} stop
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.stop = 0;

    /**
     * Payload route.
     * @member {string} route
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.route = "";

    /**
     * Payload occu.
     * @member {number} occu
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.occu = 0;

    /**
     * Payload seq.
     * @member {number} seq
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.seq = 0;

    /**
     * Payload ttarr.
     * @member {string} ttarr
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.ttarr = "";

    /**
     * Payload ttdep.
     * @member {string} ttdep
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.ttdep = "";

    /**
     * Payload drType.
     * @member {number} drType
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.drType = 0;

    /**
     * Payload tlpRequestid.
     * @member {number} tlpRequestid
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpRequestid = 0;

    /**
     * Payload tlpRequesttype.
     * @member {hfp.Payload.TlpRequestType} tlpRequesttype
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpRequesttype = 0;

    /**
     * Payload tlpPrioritylevel.
     * @member {hfp.Payload.TlpPriorityLevel} tlpPrioritylevel
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpPrioritylevel = 0;

    /**
     * Payload tlpReason.
     * @member {hfp.Payload.TlpReason} tlpReason
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpReason = 0;

    /**
     * Payload tlpAttSeq.
     * @member {number} tlpAttSeq
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpAttSeq = 0;

    /**
     * Payload tlpDecision.
     * @member {hfp.Payload.TlpDecision} tlpDecision
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpDecision = 0;

    /**
     * Payload sid.
     * @member {number} sid
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.sid = 0;

    /**
     * Payload signalGroupid.
     * @member {number} signalGroupid
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.signalGroupid = 0;

    /**
     * Payload tlpSignalgroupnbr.
     * @member {number} tlpSignalgroupnbr
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpSignalgroupnbr = 0;

    /**
     * Payload tlpLineConfigid.
     * @member {number} tlpLineConfigid
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpLineConfigid = 0;

    /**
     * Payload tlpPointConfigid.
     * @member {number} tlpPointConfigid
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpPointConfigid = 0;

    /**
     * Payload tlpFrequency.
     * @member {number} tlpFrequency
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpFrequency = 0;

    /**
     * Payload tlpProtocol.
     * @member {string} tlpProtocol
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.tlpProtocol = "";

    /**
     * Payload label.
     * @member {string} label
     * @memberof hfp.Payload
     * @instance
     */
    Payload.prototype.label = "";

    /**
     * Creates a new Payload instance using the specified properties.
     * @function create
     * @memberof hfp.Payload
     * @static
     * @param {hfp.IPayload=} [properties] Properties to set
     * @returns {hfp.Payload} Payload instance
     */
    Payload.create = function create(properties) {
      return new Payload(properties);
    };

    /**
     * Encodes the specified Payload message. Does not implicitly {@link hfp.Payload.verify|verify} messages.
     * @function encode
     * @memberof hfp.Payload
     * @static
     * @param {hfp.IPayload} message Payload message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Payload.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.SchemaVersion);
      if (message.desi != null && Object.hasOwnProperty.call(message, "desi"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.desi);
      if (message.dir != null && Object.hasOwnProperty.call(message, "dir"))
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.dir);
      if (message.oper != null && Object.hasOwnProperty.call(message, "oper"))
        writer.uint32(/* id 4, wireType 0 =*/ 32).int32(message.oper);
      if (message.veh != null && Object.hasOwnProperty.call(message, "veh"))
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.veh);
      writer.uint32(/* id 6, wireType 2 =*/ 50).string(message.tst);
      writer.uint32(/* id 7, wireType 0 =*/ 56).int64(message.tsi);
      if (message.spd != null && Object.hasOwnProperty.call(message, "spd"))
        writer.uint32(/* id 8, wireType 1 =*/ 65).double(message.spd);
      if (message.hdg != null && Object.hasOwnProperty.call(message, "hdg"))
        writer.uint32(/* id 9, wireType 0 =*/ 72).int32(message.hdg);
      if (message.lat != null && Object.hasOwnProperty.call(message, "lat"))
        writer.uint32(/* id 10, wireType 1 =*/ 81).double(message.lat);
      if (message.long != null && Object.hasOwnProperty.call(message, "long"))
        writer.uint32(/* id 11, wireType 1 =*/ 89).double(message.long);
      if (message.acc != null && Object.hasOwnProperty.call(message, "acc"))
        writer.uint32(/* id 12, wireType 1 =*/ 97).double(message.acc);
      if (message.dl != null && Object.hasOwnProperty.call(message, "dl"))
        writer.uint32(/* id 13, wireType 0 =*/ 104).uint32(message.dl);
      if (message.odo != null && Object.hasOwnProperty.call(message, "odo"))
        writer.uint32(/* id 14, wireType 1 =*/ 113).double(message.odo);
      if (message.drst != null && Object.hasOwnProperty.call(message, "drst"))
        writer.uint32(/* id 15, wireType 0 =*/ 120).uint32(message.drst);
      if (message.oday != null && Object.hasOwnProperty.call(message, "oday"))
        writer.uint32(/* id 16, wireType 2 =*/ 130).string(message.oday);
      if (message.jrn != null && Object.hasOwnProperty.call(message, "jrn"))
        writer.uint32(/* id 17, wireType 0 =*/ 136).int32(message.jrn);
      if (message.line != null && Object.hasOwnProperty.call(message, "line"))
        writer.uint32(/* id 18, wireType 0 =*/ 144).int32(message.line);
      if (message.start != null && Object.hasOwnProperty.call(message, "start"))
        writer.uint32(/* id 19, wireType 2 =*/ 154).string(message.start);
      if (message.loc != null && Object.hasOwnProperty.call(message, "loc"))
        writer.uint32(/* id 20, wireType 0 =*/ 160).int32(message.loc);
      if (message.stop != null && Object.hasOwnProperty.call(message, "stop"))
        writer.uint32(/* id 21, wireType 0 =*/ 168).int32(message.stop);
      if (message.route != null && Object.hasOwnProperty.call(message, "route"))
        writer.uint32(/* id 22, wireType 2 =*/ 178).string(message.route);
      if (message.occu != null && Object.hasOwnProperty.call(message, "occu"))
        writer.uint32(/* id 23, wireType 0 =*/ 184).int32(message.occu);
      if (message.seq != null && Object.hasOwnProperty.call(message, "seq"))
        writer.uint32(/* id 24, wireType 0 =*/ 192).int32(message.seq);
      if (message.ttarr != null && Object.hasOwnProperty.call(message, "ttarr"))
        writer.uint32(/* id 25, wireType 2 =*/ 202).string(message.ttarr);
      if (message.ttdep != null && Object.hasOwnProperty.call(message, "ttdep"))
        writer.uint32(/* id 26, wireType 2 =*/ 210).string(message.ttdep);
      if (
        message.drType != null &&
        Object.hasOwnProperty.call(message, "drType")
      )
        writer.uint32(/* id 27, wireType 0 =*/ 216).int32(message.drType);
      if (
        message.tlpRequestid != null &&
        Object.hasOwnProperty.call(message, "tlpRequestid")
      )
        writer.uint32(/* id 28, wireType 0 =*/ 224).int32(message.tlpRequestid);
      if (
        message.tlpRequesttype != null &&
        Object.hasOwnProperty.call(message, "tlpRequesttype")
      )
        writer
          .uint32(/* id 29, wireType 0 =*/ 232)
          .int32(message.tlpRequesttype);
      if (
        message.tlpPrioritylevel != null &&
        Object.hasOwnProperty.call(message, "tlpPrioritylevel")
      )
        writer
          .uint32(/* id 30, wireType 0 =*/ 240)
          .int32(message.tlpPrioritylevel);
      if (
        message.tlpReason != null &&
        Object.hasOwnProperty.call(message, "tlpReason")
      )
        writer.uint32(/* id 31, wireType 0 =*/ 248).int32(message.tlpReason);
      if (
        message.tlpAttSeq != null &&
        Object.hasOwnProperty.call(message, "tlpAttSeq")
      )
        writer.uint32(/* id 32, wireType 0 =*/ 256).int32(message.tlpAttSeq);
      if (
        message.tlpDecision != null &&
        Object.hasOwnProperty.call(message, "tlpDecision")
      )
        writer.uint32(/* id 33, wireType 0 =*/ 264).int32(message.tlpDecision);
      if (message.sid != null && Object.hasOwnProperty.call(message, "sid"))
        writer.uint32(/* id 34, wireType 0 =*/ 272).int32(message.sid);
      if (
        message.signalGroupid != null &&
        Object.hasOwnProperty.call(message, "signalGroupid")
      )
        writer
          .uint32(/* id 35, wireType 0 =*/ 280)
          .int32(message.signalGroupid);
      if (
        message.tlpSignalgroupnbr != null &&
        Object.hasOwnProperty.call(message, "tlpSignalgroupnbr")
      )
        writer
          .uint32(/* id 36, wireType 0 =*/ 288)
          .int32(message.tlpSignalgroupnbr);
      if (
        message.tlpLineConfigid != null &&
        Object.hasOwnProperty.call(message, "tlpLineConfigid")
      )
        writer
          .uint32(/* id 38, wireType 0 =*/ 304)
          .int32(message.tlpLineConfigid);
      if (
        message.tlpPointConfigid != null &&
        Object.hasOwnProperty.call(message, "tlpPointConfigid")
      )
        writer
          .uint32(/* id 39, wireType 0 =*/ 312)
          .int32(message.tlpPointConfigid);
      if (
        message.tlpFrequency != null &&
        Object.hasOwnProperty.call(message, "tlpFrequency")
      )
        writer.uint32(/* id 40, wireType 0 =*/ 320).int32(message.tlpFrequency);
      if (
        message.tlpProtocol != null &&
        Object.hasOwnProperty.call(message, "tlpProtocol")
      )
        writer.uint32(/* id 41, wireType 2 =*/ 330).string(message.tlpProtocol);
      if (message.label != null && Object.hasOwnProperty.call(message, "label"))
        writer.uint32(/* id 42, wireType 2 =*/ 338).string(message.label);
      return writer;
    };

    /**
     * Encodes the specified Payload message, length delimited. Does not implicitly {@link hfp.Payload.verify|verify} messages.
     * @function encodeDelimited
     * @memberof hfp.Payload
     * @static
     * @param {hfp.IPayload} message Payload message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Payload.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a Payload message from the specified reader or buffer.
     * @function decode
     * @memberof hfp.Payload
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {hfp.Payload} Payload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Payload.decode = function decode(reader, length) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.hfp.Payload();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1: {
            message.SchemaVersion = reader.int32();
            break;
          }
          case 2: {
            message.desi = reader.string();
            break;
          }
          case 3: {
            message.dir = reader.string();
            break;
          }
          case 4: {
            message.oper = reader.int32();
            break;
          }
          case 5: {
            message.veh = reader.int32();
            break;
          }
          case 6: {
            message.tst = reader.string();
            break;
          }
          case 7: {
            message.tsi = reader.int64();
            break;
          }
          case 8: {
            message.spd = reader.double();
            break;
          }
          case 9: {
            message.hdg = reader.int32();
            break;
          }
          case 10: {
            message.lat = reader.double();
            break;
          }
          case 11: {
            message.long = reader.double();
            break;
          }
          case 12: {
            message.acc = reader.double();
            break;
          }
          case 13: {
            message.dl = reader.uint32();
            break;
          }
          case 14: {
            message.odo = reader.double();
            break;
          }
          case 15: {
            message.drst = reader.uint32();
            break;
          }
          case 16: {
            message.oday = reader.string();
            break;
          }
          case 17: {
            message.jrn = reader.int32();
            break;
          }
          case 18: {
            message.line = reader.int32();
            break;
          }
          case 19: {
            message.start = reader.string();
            break;
          }
          case 20: {
            message.loc = reader.int32();
            break;
          }
          case 21: {
            message.stop = reader.int32();
            break;
          }
          case 22: {
            message.route = reader.string();
            break;
          }
          case 23: {
            message.occu = reader.int32();
            break;
          }
          case 24: {
            message.seq = reader.int32();
            break;
          }
          case 25: {
            message.ttarr = reader.string();
            break;
          }
          case 26: {
            message.ttdep = reader.string();
            break;
          }
          case 27: {
            message.drType = reader.int32();
            break;
          }
          case 28: {
            message.tlpRequestid = reader.int32();
            break;
          }
          case 29: {
            message.tlpRequesttype = reader.int32();
            break;
          }
          case 30: {
            message.tlpPrioritylevel = reader.int32();
            break;
          }
          case 31: {
            message.tlpReason = reader.int32();
            break;
          }
          case 32: {
            message.tlpAttSeq = reader.int32();
            break;
          }
          case 33: {
            message.tlpDecision = reader.int32();
            break;
          }
          case 34: {
            message.sid = reader.int32();
            break;
          }
          case 35: {
            message.signalGroupid = reader.int32();
            break;
          }
          case 36: {
            message.tlpSignalgroupnbr = reader.int32();
            break;
          }
          case 38: {
            message.tlpLineConfigid = reader.int32();
            break;
          }
          case 39: {
            message.tlpPointConfigid = reader.int32();
            break;
          }
          case 40: {
            message.tlpFrequency = reader.int32();
            break;
          }
          case 41: {
            message.tlpProtocol = reader.string();
            break;
          }
          case 42: {
            message.label = reader.string();
            break;
          }
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      if (!message.hasOwnProperty("SchemaVersion"))
        throw $util.ProtocolError("missing required 'SchemaVersion'", {
          instance: message,
        });
      if (!message.hasOwnProperty("tst"))
        throw $util.ProtocolError("missing required 'tst'", {
          instance: message,
        });
      if (!message.hasOwnProperty("tsi"))
        throw $util.ProtocolError("missing required 'tsi'", {
          instance: message,
        });
      return message;
    };

    /**
     * Decodes a Payload message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof hfp.Payload
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {hfp.Payload} Payload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Payload.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Payload message.
     * @function verify
     * @memberof hfp.Payload
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Payload.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (!$util.isInteger(message.SchemaVersion))
        return "SchemaVersion: integer expected";
      if (message.desi != null && message.hasOwnProperty("desi"))
        if (!$util.isString(message.desi)) return "desi: string expected";
      if (message.dir != null && message.hasOwnProperty("dir"))
        if (!$util.isString(message.dir)) return "dir: string expected";
      if (message.oper != null && message.hasOwnProperty("oper"))
        if (!$util.isInteger(message.oper)) return "oper: integer expected";
      if (message.veh != null && message.hasOwnProperty("veh"))
        if (!$util.isInteger(message.veh)) return "veh: integer expected";
      if (!$util.isString(message.tst)) return "tst: string expected";
      if (
        !$util.isInteger(message.tsi) &&
        !(
          message.tsi &&
          $util.isInteger(message.tsi.low) &&
          $util.isInteger(message.tsi.high)
        )
      )
        return "tsi: integer|Long expected";
      if (message.spd != null && message.hasOwnProperty("spd"))
        if (typeof message.spd !== "number") return "spd: number expected";
      if (message.hdg != null && message.hasOwnProperty("hdg"))
        if (!$util.isInteger(message.hdg)) return "hdg: integer expected";
      if (message.lat != null && message.hasOwnProperty("lat"))
        if (typeof message.lat !== "number") return "lat: number expected";
      if (message.long != null && message.hasOwnProperty("long"))
        if (typeof message.long !== "number") return "long: number expected";
      if (message.acc != null && message.hasOwnProperty("acc"))
        if (typeof message.acc !== "number") return "acc: number expected";
      if (message.dl != null && message.hasOwnProperty("dl"))
        if (!$util.isInteger(message.dl)) return "dl: integer expected";
      if (message.odo != null && message.hasOwnProperty("odo"))
        if (typeof message.odo !== "number") return "odo: number expected";
      if (message.drst != null && message.hasOwnProperty("drst"))
        if (!$util.isInteger(message.drst)) return "drst: integer expected";
      if (message.oday != null && message.hasOwnProperty("oday"))
        if (!$util.isString(message.oday)) return "oday: string expected";
      if (message.jrn != null && message.hasOwnProperty("jrn"))
        if (!$util.isInteger(message.jrn)) return "jrn: integer expected";
      if (message.line != null && message.hasOwnProperty("line"))
        if (!$util.isInteger(message.line)) return "line: integer expected";
      if (message.start != null && message.hasOwnProperty("start"))
        if (!$util.isString(message.start)) return "start: string expected";
      if (message.loc != null && message.hasOwnProperty("loc"))
        switch (message.loc) {
          default:
            return "loc: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
            break;
        }
      if (message.stop != null && message.hasOwnProperty("stop"))
        if (!$util.isInteger(message.stop)) return "stop: integer expected";
      if (message.route != null && message.hasOwnProperty("route"))
        if (!$util.isString(message.route)) return "route: string expected";
      if (message.occu != null && message.hasOwnProperty("occu"))
        if (!$util.isInteger(message.occu)) return "occu: integer expected";
      if (message.seq != null && message.hasOwnProperty("seq"))
        if (!$util.isInteger(message.seq)) return "seq: integer expected";
      if (message.ttarr != null && message.hasOwnProperty("ttarr"))
        if (!$util.isString(message.ttarr)) return "ttarr: string expected";
      if (message.ttdep != null && message.hasOwnProperty("ttdep"))
        if (!$util.isString(message.ttdep)) return "ttdep: string expected";
      if (message.drType != null && message.hasOwnProperty("drType"))
        if (!$util.isInteger(message.drType)) return "drType: integer expected";
      if (
        message.tlpRequestid != null &&
        message.hasOwnProperty("tlpRequestid")
      )
        if (!$util.isInteger(message.tlpRequestid))
          return "tlpRequestid: integer expected";
      if (
        message.tlpRequesttype != null &&
        message.hasOwnProperty("tlpRequesttype")
      )
        switch (message.tlpRequesttype) {
          default:
            return "tlpRequesttype: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
            break;
        }
      if (
        message.tlpPrioritylevel != null &&
        message.hasOwnProperty("tlpPrioritylevel")
      )
        switch (message.tlpPrioritylevel) {
          default:
            return "tlpPrioritylevel: enum value expected";
          case 0:
          case 1:
          case 2:
            break;
        }
      if (message.tlpReason != null && message.hasOwnProperty("tlpReason"))
        switch (message.tlpReason) {
          default:
            return "tlpReason: enum value expected";
          case 0:
          case 1:
          case 2:
          case 3:
            break;
        }
      if (message.tlpAttSeq != null && message.hasOwnProperty("tlpAttSeq"))
        if (!$util.isInteger(message.tlpAttSeq))
          return "tlpAttSeq: integer expected";
      if (message.tlpDecision != null && message.hasOwnProperty("tlpDecision"))
        switch (message.tlpDecision) {
          default:
            return "tlpDecision: enum value expected";
          case 0:
          case 1:
            break;
        }
      if (message.sid != null && message.hasOwnProperty("sid"))
        if (!$util.isInteger(message.sid)) return "sid: integer expected";
      if (
        message.signalGroupid != null &&
        message.hasOwnProperty("signalGroupid")
      )
        if (!$util.isInteger(message.signalGroupid))
          return "signalGroupid: integer expected";
      if (
        message.tlpSignalgroupnbr != null &&
        message.hasOwnProperty("tlpSignalgroupnbr")
      )
        if (!$util.isInteger(message.tlpSignalgroupnbr))
          return "tlpSignalgroupnbr: integer expected";
      if (
        message.tlpLineConfigid != null &&
        message.hasOwnProperty("tlpLineConfigid")
      )
        if (!$util.isInteger(message.tlpLineConfigid))
          return "tlpLineConfigid: integer expected";
      if (
        message.tlpPointConfigid != null &&
        message.hasOwnProperty("tlpPointConfigid")
      )
        if (!$util.isInteger(message.tlpPointConfigid))
          return "tlpPointConfigid: integer expected";
      if (
        message.tlpFrequency != null &&
        message.hasOwnProperty("tlpFrequency")
      )
        if (!$util.isInteger(message.tlpFrequency))
          return "tlpFrequency: integer expected";
      if (message.tlpProtocol != null && message.hasOwnProperty("tlpProtocol"))
        if (!$util.isString(message.tlpProtocol))
          return "tlpProtocol: string expected";
      if (message.label != null && message.hasOwnProperty("label"))
        if (!$util.isString(message.label)) return "label: string expected";
      return null;
    };

    /**
     * Creates a Payload message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof hfp.Payload
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {hfp.Payload} Payload
     */
    Payload.fromObject = function fromObject(object) {
      if (object instanceof $root.hfp.Payload) return object;
      let message = new $root.hfp.Payload();
      if (object.SchemaVersion != null)
        message.SchemaVersion = object.SchemaVersion | 0;
      if (object.desi != null) message.desi = String(object.desi);
      if (object.dir != null) message.dir = String(object.dir);
      if (object.oper != null) message.oper = object.oper | 0;
      if (object.veh != null) message.veh = object.veh | 0;
      if (object.tst != null) message.tst = String(object.tst);
      if (object.tsi != null)
        if ($util.Long)
          (message.tsi = $util.Long.fromValue(object.tsi)).unsigned = false;
        else if (typeof object.tsi === "string")
          message.tsi = parseInt(object.tsi, 10);
        else if (typeof object.tsi === "number") message.tsi = object.tsi;
        else if (typeof object.tsi === "object")
          message.tsi = new $util.LongBits(
            object.tsi.low >>> 0,
            object.tsi.high >>> 0
          ).toNumber();
      if (object.spd != null) message.spd = Number(object.spd);
      if (object.hdg != null) message.hdg = object.hdg | 0;
      if (object.lat != null) message.lat = Number(object.lat);
      if (object.long != null) message.long = Number(object.long);
      if (object.acc != null) message.acc = Number(object.acc);
      if (object.dl != null) message.dl = object.dl >>> 0;
      if (object.odo != null) message.odo = Number(object.odo);
      if (object.drst != null) message.drst = object.drst >>> 0;
      if (object.oday != null) message.oday = String(object.oday);
      if (object.jrn != null) message.jrn = object.jrn | 0;
      if (object.line != null) message.line = object.line | 0;
      if (object.start != null) message.start = String(object.start);
      switch (object.loc) {
        default:
          if (typeof object.loc === "number") {
            message.loc = object.loc;
            break;
          }
          break;
        case "GPS":
        case 0:
          message.loc = 0;
          break;
        case "ODO":
        case 1:
          message.loc = 1;
          break;
        case "MAN":
        case 2:
          message.loc = 2;
          break;
        case "NA":
        case 3:
          message.loc = 3;
          break;
      }
      if (object.stop != null) message.stop = object.stop | 0;
      if (object.route != null) message.route = String(object.route);
      if (object.occu != null) message.occu = object.occu | 0;
      if (object.seq != null) message.seq = object.seq | 0;
      if (object.ttarr != null) message.ttarr = String(object.ttarr);
      if (object.ttdep != null) message.ttdep = String(object.ttdep);
      if (object.drType != null) message.drType = object.drType | 0;
      if (object.tlpRequestid != null)
        message.tlpRequestid = object.tlpRequestid | 0;
      switch (object.tlpRequesttype) {
        default:
          if (typeof object.tlpRequesttype === "number") {
            message.tlpRequesttype = object.tlpRequesttype;
            break;
          }
          break;
        case "NORMAL":
        case 0:
          message.tlpRequesttype = 0;
          break;
        case "DOOR_CLOSE":
        case 1:
          message.tlpRequesttype = 1;
          break;
        case "DOOR_OPEN":
        case 2:
          message.tlpRequesttype = 2;
          break;
        case "ADVANCE":
        case 3:
          message.tlpRequesttype = 3;
          break;
      }
      switch (object.tlpPrioritylevel) {
        default:
          if (typeof object.tlpPrioritylevel === "number") {
            message.tlpPrioritylevel = object.tlpPrioritylevel;
            break;
          }
          break;
        case "normal":
        case 0:
          message.tlpPrioritylevel = 0;
          break;
        case "high":
        case 1:
          message.tlpPrioritylevel = 1;
          break;
        case "norequest":
        case 2:
          message.tlpPrioritylevel = 2;
          break;
      }
      switch (object.tlpReason) {
        default:
          if (typeof object.tlpReason === "number") {
            message.tlpReason = object.tlpReason;
            break;
          }
          break;
        case "GLOBAL":
        case 0:
          message.tlpReason = 0;
          break;
        case "AHEAD":
        case 1:
          message.tlpReason = 1;
          break;
        case "LINE":
        case 2:
          message.tlpReason = 2;
          break;
        case "PRIOEXEP":
        case 3:
          message.tlpReason = 3;
          break;
      }
      if (object.tlpAttSeq != null) message.tlpAttSeq = object.tlpAttSeq | 0;
      switch (object.tlpDecision) {
        default:
          if (typeof object.tlpDecision === "number") {
            message.tlpDecision = object.tlpDecision;
            break;
          }
          break;
        case "ACK":
        case 0:
          message.tlpDecision = 0;
          break;
        case "NAK":
        case 1:
          message.tlpDecision = 1;
          break;
      }
      if (object.sid != null) message.sid = object.sid | 0;
      if (object.signalGroupid != null)
        message.signalGroupid = object.signalGroupid | 0;
      if (object.tlpSignalgroupnbr != null)
        message.tlpSignalgroupnbr = object.tlpSignalgroupnbr | 0;
      if (object.tlpLineConfigid != null)
        message.tlpLineConfigid = object.tlpLineConfigid | 0;
      if (object.tlpPointConfigid != null)
        message.tlpPointConfigid = object.tlpPointConfigid | 0;
      if (object.tlpFrequency != null)
        message.tlpFrequency = object.tlpFrequency | 0;
      if (object.tlpProtocol != null)
        message.tlpProtocol = String(object.tlpProtocol);
      if (object.label != null) message.label = String(object.label);
      return message;
    };

    /**
     * Creates a plain object from a Payload message. Also converts values to other types if specified.
     * @function toObject
     * @memberof hfp.Payload
     * @static
     * @param {hfp.Payload} message Payload
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Payload.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.SchemaVersion = 1;
        object.desi = "";
        object.dir = "";
        object.oper = 0;
        object.veh = 0;
        object.tst = "";
        if ($util.Long) {
          let long = new $util.Long(0, 0, false);
          object.tsi =
            options.longs === String
              ? long.toString()
              : options.longs === Number
              ? long.toNumber()
              : long;
        } else object.tsi = options.longs === String ? "0" : 0;
        object.spd = 0;
        object.hdg = 0;
        object.lat = 0;
        object.long = 0;
        object.acc = 0;
        object.dl = 0;
        object.odo = 0;
        object.drst = 0;
        object.oday = "";
        object.jrn = 0;
        object.line = 0;
        object.start = "";
        object.loc = options.enums === String ? "GPS" : 0;
        object.stop = 0;
        object.route = "";
        object.occu = 0;
        object.seq = 0;
        object.ttarr = "";
        object.ttdep = "";
        object.drType = 0;
        object.tlpRequestid = 0;
        object.tlpRequesttype = options.enums === String ? "NORMAL" : 0;
        object.tlpPrioritylevel = options.enums === String ? "normal" : 0;
        object.tlpReason = options.enums === String ? "GLOBAL" : 0;
        object.tlpAttSeq = 0;
        object.tlpDecision = options.enums === String ? "ACK" : 0;
        object.sid = 0;
        object.signalGroupid = 0;
        object.tlpSignalgroupnbr = 0;
        object.tlpLineConfigid = 0;
        object.tlpPointConfigid = 0;
        object.tlpFrequency = 0;
        object.tlpProtocol = "";
        object.label = "";
      }
      if (
        message.SchemaVersion != null &&
        message.hasOwnProperty("SchemaVersion")
      )
        object.SchemaVersion = message.SchemaVersion;
      if (message.desi != null && message.hasOwnProperty("desi"))
        object.desi = message.desi;
      if (message.dir != null && message.hasOwnProperty("dir"))
        object.dir = message.dir;
      if (message.oper != null && message.hasOwnProperty("oper"))
        object.oper = message.oper;
      if (message.veh != null && message.hasOwnProperty("veh"))
        object.veh = message.veh;
      if (message.tst != null && message.hasOwnProperty("tst"))
        object.tst = message.tst;
      if (message.tsi != null && message.hasOwnProperty("tsi"))
        if (typeof message.tsi === "number")
          object.tsi =
            options.longs === String ? String(message.tsi) : message.tsi;
        else
          object.tsi =
            options.longs === String
              ? $util.Long.prototype.toString.call(message.tsi)
              : options.longs === Number
              ? new $util.LongBits(
                  message.tsi.low >>> 0,
                  message.tsi.high >>> 0
                ).toNumber()
              : message.tsi;
      if (message.spd != null && message.hasOwnProperty("spd"))
        object.spd =
          options.json && !isFinite(message.spd)
            ? String(message.spd)
            : message.spd;
      if (message.hdg != null && message.hasOwnProperty("hdg"))
        object.hdg = message.hdg;
      if (message.lat != null && message.hasOwnProperty("lat"))
        object.lat =
          options.json && !isFinite(message.lat)
            ? String(message.lat)
            : message.lat;
      if (message.long != null && message.hasOwnProperty("long"))
        object.long =
          options.json && !isFinite(message.long)
            ? String(message.long)
            : message.long;
      if (message.acc != null && message.hasOwnProperty("acc"))
        object.acc =
          options.json && !isFinite(message.acc)
            ? String(message.acc)
            : message.acc;
      if (message.dl != null && message.hasOwnProperty("dl"))
        object.dl = message.dl;
      if (message.odo != null && message.hasOwnProperty("odo"))
        object.odo =
          options.json && !isFinite(message.odo)
            ? String(message.odo)
            : message.odo;
      if (message.drst != null && message.hasOwnProperty("drst"))
        object.drst = message.drst;
      if (message.oday != null && message.hasOwnProperty("oday"))
        object.oday = message.oday;
      if (message.jrn != null && message.hasOwnProperty("jrn"))
        object.jrn = message.jrn;
      if (message.line != null && message.hasOwnProperty("line"))
        object.line = message.line;
      if (message.start != null && message.hasOwnProperty("start"))
        object.start = message.start;
      if (message.loc != null && message.hasOwnProperty("loc"))
        object.loc =
          options.enums === String
            ? $root.hfp.Payload.LocationQualityMethod[message.loc] === undefined
              ? message.loc
              : $root.hfp.Payload.LocationQualityMethod[message.loc]
            : message.loc;
      if (message.stop != null && message.hasOwnProperty("stop"))
        object.stop = message.stop;
      if (message.route != null && message.hasOwnProperty("route"))
        object.route = message.route;
      if (message.occu != null && message.hasOwnProperty("occu"))
        object.occu = message.occu;
      if (message.seq != null && message.hasOwnProperty("seq"))
        object.seq = message.seq;
      if (message.ttarr != null && message.hasOwnProperty("ttarr"))
        object.ttarr = message.ttarr;
      if (message.ttdep != null && message.hasOwnProperty("ttdep"))
        object.ttdep = message.ttdep;
      if (message.drType != null && message.hasOwnProperty("drType"))
        object.drType = message.drType;
      if (
        message.tlpRequestid != null &&
        message.hasOwnProperty("tlpRequestid")
      )
        object.tlpRequestid = message.tlpRequestid;
      if (
        message.tlpRequesttype != null &&
        message.hasOwnProperty("tlpRequesttype")
      )
        object.tlpRequesttype =
          options.enums === String
            ? $root.hfp.Payload.TlpRequestType[message.tlpRequesttype] ===
              undefined
              ? message.tlpRequesttype
              : $root.hfp.Payload.TlpRequestType[message.tlpRequesttype]
            : message.tlpRequesttype;
      if (
        message.tlpPrioritylevel != null &&
        message.hasOwnProperty("tlpPrioritylevel")
      )
        object.tlpPrioritylevel =
          options.enums === String
            ? $root.hfp.Payload.TlpPriorityLevel[message.tlpPrioritylevel] ===
              undefined
              ? message.tlpPrioritylevel
              : $root.hfp.Payload.TlpPriorityLevel[message.tlpPrioritylevel]
            : message.tlpPrioritylevel;
      if (message.tlpReason != null && message.hasOwnProperty("tlpReason"))
        object.tlpReason =
          options.enums === String
            ? $root.hfp.Payload.TlpReason[message.tlpReason] === undefined
              ? message.tlpReason
              : $root.hfp.Payload.TlpReason[message.tlpReason]
            : message.tlpReason;
      if (message.tlpAttSeq != null && message.hasOwnProperty("tlpAttSeq"))
        object.tlpAttSeq = message.tlpAttSeq;
      if (message.tlpDecision != null && message.hasOwnProperty("tlpDecision"))
        object.tlpDecision =
          options.enums === String
            ? $root.hfp.Payload.TlpDecision[message.tlpDecision] === undefined
              ? message.tlpDecision
              : $root.hfp.Payload.TlpDecision[message.tlpDecision]
            : message.tlpDecision;
      if (message.sid != null && message.hasOwnProperty("sid"))
        object.sid = message.sid;
      if (
        message.signalGroupid != null &&
        message.hasOwnProperty("signalGroupid")
      )
        object.signalGroupid = message.signalGroupid;
      if (
        message.tlpSignalgroupnbr != null &&
        message.hasOwnProperty("tlpSignalgroupnbr")
      )
        object.tlpSignalgroupnbr = message.tlpSignalgroupnbr;
      if (
        message.tlpLineConfigid != null &&
        message.hasOwnProperty("tlpLineConfigid")
      )
        object.tlpLineConfigid = message.tlpLineConfigid;
      if (
        message.tlpPointConfigid != null &&
        message.hasOwnProperty("tlpPointConfigid")
      )
        object.tlpPointConfigid = message.tlpPointConfigid;
      if (
        message.tlpFrequency != null &&
        message.hasOwnProperty("tlpFrequency")
      )
        object.tlpFrequency = message.tlpFrequency;
      if (message.tlpProtocol != null && message.hasOwnProperty("tlpProtocol"))
        object.tlpProtocol = message.tlpProtocol;
      if (message.label != null && message.hasOwnProperty("label"))
        object.label = message.label;
      return object;
    };

    /**
     * Converts this Payload to JSON.
     * @function toJSON
     * @memberof hfp.Payload
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Payload.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the default type url for Payload
     * @function getTypeUrl
     * @memberof hfp.Payload
     * @static
     * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns {string} The default type url
     */
    Payload.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
      if (typeUrlPrefix === undefined) {
        typeUrlPrefix = "type.googleapis.com";
      }
      return typeUrlPrefix + "/hfp.Payload";
    };

    /**
     * LocationQualityMethod enum.
     * @name hfp.Payload.LocationQualityMethod
     * @enum {number}
     * @property {number} GPS=0 GPS value
     * @property {number} ODO=1 ODO value
     * @property {number} MAN=2 MAN value
     * @property {number} NA=3 NA value
     */
    Payload.LocationQualityMethod = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "GPS")] = 0;
      values[(valuesById[1] = "ODO")] = 1;
      values[(valuesById[2] = "MAN")] = 2;
      values[(valuesById[3] = "NA")] = 3;
      return values;
    })();

    /**
     * TlpRequestType enum.
     * @name hfp.Payload.TlpRequestType
     * @enum {number}
     * @property {number} NORMAL=0 NORMAL value
     * @property {number} DOOR_CLOSE=1 DOOR_CLOSE value
     * @property {number} DOOR_OPEN=2 DOOR_OPEN value
     * @property {number} ADVANCE=3 ADVANCE value
     */
    Payload.TlpRequestType = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "NORMAL")] = 0;
      values[(valuesById[1] = "DOOR_CLOSE")] = 1;
      values[(valuesById[2] = "DOOR_OPEN")] = 2;
      values[(valuesById[3] = "ADVANCE")] = 3;
      return values;
    })();

    /**
     * TlpPriorityLevel enum.
     * @name hfp.Payload.TlpPriorityLevel
     * @enum {number}
     * @property {number} normal=0 normal value
     * @property {number} high=1 high value
     * @property {number} norequest=2 norequest value
     */
    Payload.TlpPriorityLevel = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "normal")] = 0;
      values[(valuesById[1] = "high")] = 1;
      values[(valuesById[2] = "norequest")] = 2;
      return values;
    })();

    /**
     * TlpReason enum.
     * @name hfp.Payload.TlpReason
     * @enum {number}
     * @property {number} GLOBAL=0 GLOBAL value
     * @property {number} AHEAD=1 AHEAD value
     * @property {number} LINE=2 LINE value
     * @property {number} PRIOEXEP=3 PRIOEXEP value
     */
    Payload.TlpReason = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "GLOBAL")] = 0;
      values[(valuesById[1] = "AHEAD")] = 1;
      values[(valuesById[2] = "LINE")] = 2;
      values[(valuesById[3] = "PRIOEXEP")] = 3;
      return values;
    })();

    /**
     * TlpDecision enum.
     * @name hfp.Payload.TlpDecision
     * @enum {number}
     * @property {number} ACK=0 ACK value
     * @property {number} NAK=1 NAK value
     */
    Payload.TlpDecision = (function () {
      const valuesById = {},
        values = Object.create(valuesById);
      values[(valuesById[0] = "ACK")] = 0;
      values[(valuesById[1] = "NAK")] = 1;
      return values;
    })();

    return Payload;
  })();

  return hfp;
})());

export { $root as default };
