import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace hfp. */
export namespace hfp {
  /** Properties of a Data. */
  interface IData {
    /** Data SchemaVersion */
    SchemaVersion: number;

    /** Data topic */
    topic?: hfp.ITopic | null;

    /** Data payload */
    payload: hfp.IPayload;
  }

  /** Represents a Data. */
  class Data implements IData {
    /**
     * Constructs a new Data.
     * @param [properties] Properties to set
     */
    constructor(properties?: hfp.IData);

    /** Data SchemaVersion. */
    public SchemaVersion: number;

    /** Data topic. */
    public topic?: hfp.ITopic | null;

    /** Data payload. */
    public payload: hfp.IPayload;

    /**
     * Creates a new Data instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Data instance
     */
    public static create(properties?: hfp.IData): hfp.Data;

    /**
     * Encodes the specified Data message. Does not implicitly {@link hfp.Data.verify|verify} messages.
     * @param message Data message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: hfp.IData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified Data message, length delimited. Does not implicitly {@link hfp.Data.verify|verify} messages.
     * @param message Data message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: hfp.IData,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Data message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Data
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): hfp.Data;

    /**
     * Decodes a Data message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Data
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): hfp.Data;

    /**
     * Verifies a Data message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Data message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Data
     */
    public static fromObject(object: { [k: string]: any }): hfp.Data;

    /**
     * Creates a plain object from a Data message. Also converts values to other types if specified.
     * @param message Data
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: hfp.Data,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Data to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Data
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  /** Properties of a Topic. */
  interface ITopic {
    /** Topic SchemaVersion */
    SchemaVersion: number;

    /** Topic receivedAt */
    receivedAt: number | Long;

    /** Topic topicPrefix */
    topicPrefix: string;

    /** Topic topicVersion */
    topicVersion: string;

    /** Topic journeyType */
    journeyType: hfp.Topic.JourneyType;

    /** Topic temporalType */
    temporalType: hfp.Topic.TemporalType;

    /** Topic eventType */
    eventType?: hfp.Topic.EventType | null;

    /** Topic transportMode */
    transportMode?: hfp.Topic.TransportMode | null;

    /** Topic operatorId */
    operatorId: number;

    /** Topic vehicleNumber */
    vehicleNumber: number;

    /** Topic uniqueVehicleId */
    uniqueVehicleId: string;

    /** Topic routeId */
    routeId?: string | null;

    /** Topic directionId */
    directionId?: number | null;

    /** Topic headsign */
    headsign?: string | null;

    /** Topic startTime */
    startTime?: string | null;

    /** Topic nextStop */
    nextStop?: string | null;

    /** Topic geohashLevel */
    geohashLevel?: number | null;

    /** Topic latitude */
    latitude?: number | null;

    /** Topic longitude */
    longitude?: number | null;
  }

  /** Represents a Topic. */
  class Topic implements ITopic {
    /**
     * Constructs a new Topic.
     * @param [properties] Properties to set
     */
    constructor(properties?: hfp.ITopic);

    /** Topic SchemaVersion. */
    public SchemaVersion: number;

    /** Topic receivedAt. */
    public receivedAt: number | Long;

    /** Topic topicPrefix. */
    public topicPrefix: string;

    /** Topic topicVersion. */
    public topicVersion: string;

    /** Topic journeyType. */
    public journeyType: hfp.Topic.JourneyType;

    /** Topic temporalType. */
    public temporalType: hfp.Topic.TemporalType;

    /** Topic eventType. */
    public eventType: hfp.Topic.EventType;

    /** Topic transportMode. */
    public transportMode: hfp.Topic.TransportMode;

    /** Topic operatorId. */
    public operatorId: number;

    /** Topic vehicleNumber. */
    public vehicleNumber: number;

    /** Topic uniqueVehicleId. */
    public uniqueVehicleId: string;

    /** Topic routeId. */
    public routeId: string;

    /** Topic directionId. */
    public directionId: number;

    /** Topic headsign. */
    public headsign: string;

    /** Topic startTime. */
    public startTime: string;

    /** Topic nextStop. */
    public nextStop: string;

    /** Topic geohashLevel. */
    public geohashLevel: number;

    /** Topic latitude. */
    public latitude: number;

    /** Topic longitude. */
    public longitude: number;

    /**
     * Creates a new Topic instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Topic instance
     */
    public static create(properties?: hfp.ITopic): hfp.Topic;

    /**
     * Encodes the specified Topic message. Does not implicitly {@link hfp.Topic.verify|verify} messages.
     * @param message Topic message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: hfp.ITopic,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified Topic message, length delimited. Does not implicitly {@link hfp.Topic.verify|verify} messages.
     * @param message Topic message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: hfp.ITopic,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Topic message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Topic
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): hfp.Topic;

    /**
     * Decodes a Topic message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Topic
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): hfp.Topic;

    /**
     * Verifies a Topic message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Topic message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Topic
     */
    public static fromObject(object: { [k: string]: any }): hfp.Topic;

    /**
     * Creates a plain object from a Topic message. Also converts values to other types if specified.
     * @param message Topic
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: hfp.Topic,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Topic to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Topic
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  namespace Topic {
    /** JourneyType enum. */
    enum JourneyType {
      journey = 0,
      deadrun = 1,
      signoff = 2,
    }

    /** TemporalType enum. */
    enum TemporalType {
      ongoing = 0,
      upcoming = 1,
    }

    /** EventType enum. */
    enum EventType {
      VP = 0,
      DUE = 1,
      ARR = 2,
      ARS = 3,
      PDE = 4,
      DEP = 5,
      PAS = 6,
      WAIT = 7,
      DOO = 8,
      DOC = 9,
      TLR = 10,
      TLA = 11,
      DA = 12,
      DOUT = 13,
      BA = 14,
      BOUT = 15,
      VJA = 16,
      VJOUT = 17,
    }

    /** TransportMode enum. */
    enum TransportMode {
      bus = 0,
      train = 1,
      tram = 2,
      metro = 3,
      ferry = 4,
      ubus = 5,
      robot = 6,
    }
  }

  /** Properties of a Payload. */
  interface IPayload {
    /** Payload SchemaVersion */
    SchemaVersion: number;

    /** Payload desi */
    desi?: string | null;

    /** Payload dir */
    dir?: string | null;

    /** Payload oper */
    oper?: number | null;

    /** Payload veh */
    veh?: number | null;

    /** Payload tst */
    tst: string;

    /** Payload tsi */
    tsi: number | Long;

    /** Payload spd */
    spd?: number | null;

    /** Payload hdg */
    hdg?: number | null;

    /** Payload lat */
    lat?: number | null;

    /** Payload long */
    long?: number | null;

    /** Payload acc */
    acc?: number | null;

    /** Payload dl */
    dl?: number | null;

    /** Payload odo */
    odo?: number | null;

    /** Payload drst */
    drst?: number | null;

    /** Payload oday */
    oday?: string | null;

    /** Payload jrn */
    jrn?: number | null;

    /** Payload line */
    line?: number | null;

    /** Payload start */
    start?: string | null;

    /** Payload loc */
    loc?: hfp.Payload.LocationQualityMethod | null;

    /** Payload stop */
    stop?: number | null;

    /** Payload route */
    route?: string | null;

    /** Payload occu */
    occu?: number | null;

    /** Payload seq */
    seq?: number | null;

    /** Payload ttarr */
    ttarr?: string | null;

    /** Payload ttdep */
    ttdep?: string | null;

    /** Payload drType */
    drType?: number | null;

    /** Payload tlpRequestid */
    tlpRequestid?: number | null;

    /** Payload tlpRequesttype */
    tlpRequesttype?: hfp.Payload.TlpRequestType | null;

    /** Payload tlpPrioritylevel */
    tlpPrioritylevel?: hfp.Payload.TlpPriorityLevel | null;

    /** Payload tlpReason */
    tlpReason?: hfp.Payload.TlpReason | null;

    /** Payload tlpAttSeq */
    tlpAttSeq?: number | null;

    /** Payload tlpDecision */
    tlpDecision?: hfp.Payload.TlpDecision | null;

    /** Payload sid */
    sid?: number | null;

    /** Payload signalGroupid */
    signalGroupid?: number | null;

    /** Payload tlpSignalgroupnbr */
    tlpSignalgroupnbr?: number | null;

    /** Payload tlpLineConfigid */
    tlpLineConfigid?: number | null;

    /** Payload tlpPointConfigid */
    tlpPointConfigid?: number | null;

    /** Payload tlpFrequency */
    tlpFrequency?: number | null;

    /** Payload tlpProtocol */
    tlpProtocol?: string | null;

    /** Payload label */
    label?: string | null;
  }

  /** Represents a Payload. */
  class Payload implements IPayload {
    /**
     * Constructs a new Payload.
     * @param [properties] Properties to set
     */
    constructor(properties?: hfp.IPayload);

    /** Payload SchemaVersion. */
    public SchemaVersion: number;

    /** Payload desi. */
    public desi: string;

    /** Payload dir. */
    public dir: string;

    /** Payload oper. */
    public oper: number;

    /** Payload veh. */
    public veh: number;

    /** Payload tst. */
    public tst: string;

    /** Payload tsi. */
    public tsi: number | Long;

    /** Payload spd. */
    public spd: number;

    /** Payload hdg. */
    public hdg: number;

    /** Payload lat. */
    public lat: number;

    /** Payload long. */
    public long: number;

    /** Payload acc. */
    public acc: number;

    /** Payload dl. */
    public dl: number;

    /** Payload odo. */
    public odo: number;

    /** Payload drst. */
    public drst: number;

    /** Payload oday. */
    public oday: string;

    /** Payload jrn. */
    public jrn: number;

    /** Payload line. */
    public line: number;

    /** Payload start. */
    public start: string;

    /** Payload loc. */
    public loc: hfp.Payload.LocationQualityMethod;

    /** Payload stop. */
    public stop: number;

    /** Payload route. */
    public route: string;

    /** Payload occu. */
    public occu: number;

    /** Payload seq. */
    public seq: number;

    /** Payload ttarr. */
    public ttarr: string;

    /** Payload ttdep. */
    public ttdep: string;

    /** Payload drType. */
    public drType: number;

    /** Payload tlpRequestid. */
    public tlpRequestid: number;

    /** Payload tlpRequesttype. */
    public tlpRequesttype: hfp.Payload.TlpRequestType;

    /** Payload tlpPrioritylevel. */
    public tlpPrioritylevel: hfp.Payload.TlpPriorityLevel;

    /** Payload tlpReason. */
    public tlpReason: hfp.Payload.TlpReason;

    /** Payload tlpAttSeq. */
    public tlpAttSeq: number;

    /** Payload tlpDecision. */
    public tlpDecision: hfp.Payload.TlpDecision;

    /** Payload sid. */
    public sid: number;

    /** Payload signalGroupid. */
    public signalGroupid: number;

    /** Payload tlpSignalgroupnbr. */
    public tlpSignalgroupnbr: number;

    /** Payload tlpLineConfigid. */
    public tlpLineConfigid: number;

    /** Payload tlpPointConfigid. */
    public tlpPointConfigid: number;

    /** Payload tlpFrequency. */
    public tlpFrequency: number;

    /** Payload tlpProtocol. */
    public tlpProtocol: string;

    /** Payload label. */
    public label: string;

    /**
     * Creates a new Payload instance using the specified properties.
     * @param [properties] Properties to set
     * @returns Payload instance
     */
    public static create(properties?: hfp.IPayload): hfp.Payload;

    /**
     * Encodes the specified Payload message. Does not implicitly {@link hfp.Payload.verify|verify} messages.
     * @param message Payload message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encode(
      message: hfp.IPayload,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Encodes the specified Payload message, length delimited. Does not implicitly {@link hfp.Payload.verify|verify} messages.
     * @param message Payload message or plain object to encode
     * @param [writer] Writer to encode to
     * @returns Writer
     */
    public static encodeDelimited(
      message: hfp.IPayload,
      writer?: $protobuf.Writer,
    ): $protobuf.Writer;

    /**
     * Decodes a Payload message from the specified reader or buffer.
     * @param reader Reader or buffer to decode from
     * @param [length] Message length if known beforehand
     * @returns Payload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decode(
      reader: $protobuf.Reader | Uint8Array,
      length?: number,
    ): hfp.Payload;

    /**
     * Decodes a Payload message from the specified reader or buffer, length delimited.
     * @param reader Reader or buffer to decode from
     * @returns Payload
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    public static decodeDelimited(
      reader: $protobuf.Reader | Uint8Array,
    ): hfp.Payload;

    /**
     * Verifies a Payload message.
     * @param message Plain object to verify
     * @returns `null` if valid, otherwise the reason why it is not
     */
    public static verify(message: { [k: string]: any }): string | null;

    /**
     * Creates a Payload message from a plain object. Also converts values to their respective internal types.
     * @param object Plain object
     * @returns Payload
     */
    public static fromObject(object: { [k: string]: any }): hfp.Payload;

    /**
     * Creates a plain object from a Payload message. Also converts values to other types if specified.
     * @param message Payload
     * @param [options] Conversion options
     * @returns Plain object
     */
    public static toObject(
      message: hfp.Payload,
      options?: $protobuf.IConversionOptions,
    ): { [k: string]: any };

    /**
     * Converts this Payload to JSON.
     * @returns JSON object
     */
    public toJSON(): { [k: string]: any };

    /**
     * Gets the default type url for Payload
     * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
     * @returns The default type url
     */
    public static getTypeUrl(typeUrlPrefix?: string): string;
  }

  namespace Payload {
    /** LocationQualityMethod enum. */
    enum LocationQualityMethod {
      GPS = 0,
      ODO = 1,
      MAN = 2,
      NA = 3,
    }

    /** TlpRequestType enum. */
    enum TlpRequestType {
      NORMAL = 0,
      DOOR_CLOSE = 1,
      DOOR_OPEN = 2,
      ADVANCE = 3,
    }

    /** TlpPriorityLevel enum. */
    enum TlpPriorityLevel {
      normal = 0,
      high = 1,
      norequest = 2,
    }

    /** TlpReason enum. */
    enum TlpReason {
      GLOBAL = 0,
      AHEAD = 1,
      LINE = 2,
      PRIOEXEP = 3,
    }

    /** TlpDecision enum. */
    enum TlpDecision {
      ACK = 0,
      NAK = 1,
    }
  }
}
