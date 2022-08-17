import * as $protobuf from "protobufjs";
/** Namespace mqtt. */
export namespace mqtt {
  /** Properties of a RawMessage. */
  interface IRawMessage {
    /** RawMessage SchemaVersion */
    SchemaVersion: number;

    /** RawMessage topic */
    topic?: string | null;

    /** RawMessage payload */
    payload?: Uint8Array | null;
  }

  /** Represents a RawMessage. */
  class RawMessage implements IRawMessage {
    /**
     * Constructs a new RawMessage.
     * @param [properties] Properties to set
     */
    constructor(properties?: mqtt.IRawMessage);

    /** RawMessage SchemaVersion. */
    public SchemaVersion: number;

    /** RawMessage topic. */
    public topic: string;

    /** RawMessage payload. */
    public payload: Uint8Array;

    /**
     * Creates a new RawMessage instance using the specified properties.
     * @param [properties] Properties to set
     * @returns RawMessage instance
     */
    public static create(properties?: mqtt.IRawMessage): mqtt.RawMessage;

    /**
     * Encodes the specified RawMessage message. Does not implicitly {@link mqtt.RawMessage.verify|verify} messages.
     * @param message RawMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: mqtt.IRawMessage,
      writer?: $protobuf.Writer
    ): $protobuf.Writer;

    /**
     * Encodes the specified RawMessage message, length delimited. Does not implicitly {@link mqtt.RawMessage.verify|verify} messages.
     * @param message RawMessage message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: mqtt.IRawMessage,
      writer?: $protobuf.Writer
    ): $protobuf.Writer;

    /**
     * Decodes a RawMessage message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns RawMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number
    ): mqtt.RawMessage;

    /**
     * Decodes a RawMessage message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns RawMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array
    ): mqtt.RawMessage;

    /**
     * Verifies a RawMessage message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a RawMessage message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns RawMessage
     */
    public static fromObject(object: { [k: string]: any }): mqtt.RawMessage;

    /**
     * Creates a plain object from a RawMessage message. Also converts values to other types if specified.
     * @param message RawMessage
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: mqtt.RawMessage,
      options?: $protobuf.IConversionOptions
    ): { [k: string]: any };

    /**
     * Converts this RawMessage to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for RawMessage
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }
}
