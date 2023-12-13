import type protobufjs from "protobufjs/minimal";

/**
 * The protobuf specification demands type-specific default values such as 0 for
 * numbers when decoding. That is quite weird for TypeScript code which usually
 * uses null or undefined for missing values. Let's create an alternative way to
 * decode without defaults.
 *
 * Maybe the following issue will be resolved at some point so we would not need
 * our own workaround:
 * https://github.com/protobufjs/protobuf.js/issues/1572
 */

interface ProtobufMessageType<T> {
  decode: (reader: protobufjs.Reader | Uint8Array, length?: number) => T;
  toObject: (
    message: T,
    options?: protobufjs.IConversionOptions,
  ) => Record<string, unknown>;
}

const decodeWithoutDefaults = <T>(
  messageType: ProtobufMessageType<T>,
  payload: Uint8Array,
): T =>
  messageType.toObject(messageType.decode(payload), {
    longs: Number,
    defaults: false,
  }) as T;

export default decodeWithoutDefaults;
