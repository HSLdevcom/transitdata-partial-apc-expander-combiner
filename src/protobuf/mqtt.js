/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const mqtt = ($root.mqtt = (() => {
  /**
   * Namespace mqtt.
   * @exports mqtt
   * @namespace
   */
  const mqtt = {};

  mqtt.RawMessage = (function () {
    /**
     * Properties of a RawMessage.
     * @memberof mqtt
     * @interface IRawMessage
     * @property {number} SchemaVersion RawMessage SchemaVersion
     * @property {string|null} [topic] RawMessage topic
     * @property {Uint8Array|null} [payload] RawMessage payload
     */

    /**
     * Constructs a new RawMessage.
     * @memberof mqtt
     * @classdesc Represents a RawMessage.
     * @implements IRawMessage
     * @constructor
     * @param {mqtt.IRawMessage=} [properties] Properties to set
     */
    function RawMessage(properties) {
      if (properties)
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null) this[keys[i]] = properties[keys[i]];
    }

    /**
     * RawMessage SchemaVersion.
     * @member {number} SchemaVersion
     * @memberof mqtt.RawMessage
     * @instance
     */
    RawMessage.prototype.SchemaVersion = 1;

    /**
     * RawMessage topic.
     * @member {string} topic
     * @memberof mqtt.RawMessage
     * @instance
     */
    RawMessage.prototype.topic = "";

    /**
     * RawMessage payload.
     * @member {Uint8Array} payload
     * @memberof mqtt.RawMessage
     * @instance
     */
    RawMessage.prototype.payload = $util.newBuffer([]);

    /**
     * Creates a new RawMessage instance using the specified properties.
     * @function create
     * @memberof mqtt.RawMessage
     * @static
     * @param {mqtt.IRawMessage=} [properties] Properties to set
     * @returns {mqtt.RawMessage} RawMessage instance
     */
    RawMessage.create = function create(properties) {
      return new RawMessage(properties);
    };

    /**
     * Encodes the specified RawMessage message. Does not implicitly {@link mqtt.RawMessage.verify|verify} messages.
     * @function encode
     * @memberof mqtt.RawMessage
     * @static
     * @param {mqtt.IRawMessage} message RawMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RawMessage.encode = function encode(message, writer) {
      if (!writer) writer = $Writer.create();
      writer.uint32(/* id 1, wireType 0 =*/ 8).int32(message.SchemaVersion);
      if (message.topic != null && Object.hasOwnProperty.call(message, "topic"))
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.topic);
      if (
        message.payload != null &&
        Object.hasOwnProperty.call(message, "payload")
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).bytes(message.payload);
      return writer;
    };

    /**
     * Encodes the specified RawMessage message, length delimited. Does not implicitly {@link mqtt.RawMessage.verify|verify} messages.
     * @function encodeDelimited
     * @memberof mqtt.RawMessage
     * @static
     * @param {mqtt.IRawMessage} message RawMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    RawMessage.encodeDelimited = function encodeDelimited(message, writer) {
      return this.encode(message, writer).ldelim();
    };

    /**
     * Decodes a RawMessage message from the specified reader or buffer.
     * @function decode
     * @memberof mqtt.RawMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {mqtt.RawMessage} RawMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RawMessage.decode = function decode(reader, length) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length,
        message = new $root.mqtt.RawMessage();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1:
            message.SchemaVersion = reader.int32();
            break;
          case 2:
            message.topic = reader.string();
            break;
          case 3:
            message.payload = reader.bytes();
            break;
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      if (!message.hasOwnProperty("SchemaVersion"))
        throw $util.ProtocolError("missing required 'SchemaVersion'", {
          instance: message,
        });
      return message;
    };

    /**
     * Decodes a RawMessage message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof mqtt.RawMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {mqtt.RawMessage} RawMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    RawMessage.decodeDelimited = function decodeDelimited(reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a RawMessage message.
     * @function verify
     * @memberof mqtt.RawMessage
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    RawMessage.verify = function verify(message) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (!$util.isInteger(message.SchemaVersion))
        return "SchemaVersion: integer expected";
      if (message.topic != null && message.hasOwnProperty("topic"))
        if (!$util.isString(message.topic)) return "topic: string expected";
      if (message.payload != null && message.hasOwnProperty("payload"))
        if (
          !(
            (message.payload && typeof message.payload.length === "number") ||
            $util.isString(message.payload)
          )
        )
          return "payload: buffer expected";
      return null;
    };

    /**
     * Creates a RawMessage message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof mqtt.RawMessage
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {mqtt.RawMessage} RawMessage
     */
    RawMessage.fromObject = function fromObject(object) {
      if (object instanceof $root.mqtt.RawMessage) return object;
      let message = new $root.mqtt.RawMessage();
      if (object.SchemaVersion != null)
        message.SchemaVersion = object.SchemaVersion | 0;
      if (object.topic != null) message.topic = String(object.topic);
      if (object.payload != null)
        if (typeof object.payload === "string")
          $util.base64.decode(
            object.payload,
            (message.payload = $util.newBuffer(
              $util.base64.length(object.payload)
            )),
            0
          );
        else if (object.payload.length) message.payload = object.payload;
      return message;
    };

    /**
     * Creates a plain object from a RawMessage message. Also converts values to other types if specified.
     * @function toObject
     * @memberof mqtt.RawMessage
     * @static
     * @param {mqtt.RawMessage} message RawMessage
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    RawMessage.toObject = function toObject(message, options) {
      if (!options) options = {};
      let object = {};
      if (options.defaults) {
        object.SchemaVersion = 1;
        object.topic = "";
        if (options.bytes === String) object.payload = "";
        else {
          object.payload = [];
          if (options.bytes !== Array)
            object.payload = $util.newBuffer(object.payload);
        }
      }
      if (
        message.SchemaVersion != null &&
        message.hasOwnProperty("SchemaVersion")
      )
        object.SchemaVersion = message.SchemaVersion;
      if (message.topic != null && message.hasOwnProperty("topic"))
        object.topic = message.topic;
      if (message.payload != null && message.hasOwnProperty("payload"))
        object.payload =
          options.bytes === String
            ? $util.base64.encode(message.payload, 0, message.payload.length)
            : options.bytes === Array
            ? Array.prototype.slice.call(message.payload)
            : message.payload;
      return object;
    };

    /**
     * Converts this RawMessage to JSON.
     * @function toJSON
     * @memberof mqtt.RawMessage
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    RawMessage.prototype.toJSON = function toJSON() {
      return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
    };

    return RawMessage;
  })();

  return mqtt;
})());

export { $root as default };
