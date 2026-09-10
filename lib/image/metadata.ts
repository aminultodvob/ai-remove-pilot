/**
 * Container-level metadata inspection.
 *
 * This module reads the *structure* of an image file: which auxiliary segments
 * exist, how large they are, and which broad category of information each one
 * holds. It deliberately never returns tag values. The report a user sees says
 * "location metadata detected", never a coordinate, and the same rule holds for
 * every other field so that inspecting an image cannot itself leak it.
 *
 * It is pure and dependency-free, so the browser can run it on a File before a
 * single byte is uploaded and the server can run it again on the buffer it
 * actually received. Every read is bounds-checked: the input is untrusted, and
 * malformed offsets are the obvious attack surface here.
 */

import type {
  ImageInspection,
  MetadataCategory,
  MetadataFinding,
  SupportedFormat,
} from "@/types/image";
import { METADATA_CATEGORIES } from "@/types/image";

/* ------------------------------------------------------------------ */
/* Byte helpers                                                        */
/* ------------------------------------------------------------------ */

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number) =>
  (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u32le = (b: Uint8Array, i: number) =>
  (((b[i + 3] ?? 0) << 24) | ((b[i + 2] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i] ?? 0)) >>> 0;

/** ASCII view of a byte range. Used only for magic strings and keywords. */
function ascii(b: Uint8Array, start: number, length: number): string {
  const end = Math.min(b.length, Math.max(start, 0) + length);
  let out = "";
  for (let i = Math.max(start, 0); i < end; i++) out += String.fromCharCode(b[i] ?? 0);
  return out;
}

/** Case-insensitive search for marker strings inside a byte range. */
function containsAscii(b: Uint8Array, start: number, length: number, needles: string[]): boolean {
  // Cap the scan: a hostile file should not be able to make us build a 25 MB string.
  const hay = ascii(b, start, Math.min(length, 256 * 1024)).toLowerCase();
  return needles.some((n) => hay.includes(n));
}

/* ------------------------------------------------------------------ */
/* Format sniffing — magic bytes only, never the filename or the       */
/* browser-supplied MIME type                                          */
/* ------------------------------------------------------------------ */

export function sniffFormat(b: Uint8Array): SupportedFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "png";
  }
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

/* ------------------------------------------------------------------ */
/* Finding accumulation                                                */
/* ------------------------------------------------------------------ */

/**
 * One physical segment can imply several categories (an Exif block may hold
 * camera, GPS and software tags at once), so segment bytes are counted once
 * while categories are recorded individually.
 */
class Findings {
  readonly items: MetadataFinding[] = [];
  bytes = 0;

  add(categories: MetadataCategory[], source: string, segmentBytes?: number) {
    if (categories.length === 0) return;
    for (const category of categories) this.items.push({ category, source, bytes: segmentBytes });
    if (segmentBytes && segmentBytes > 0) this.bytes += segmentBytes;
  }
}

function finalise(
  format: SupportedFormat,
  f: Findings,
  width: number | null,
  height: number | null,
  lossless: boolean,
  hasAlpha: boolean,
): ImageInspection {
  const present = new Set(f.items.map((i) => i.category));
  return {
    format,
    width,
    height,
    lossless,
    hasAlpha,
    findings: f.items,
    categories: METADATA_CATEGORIES.filter((c) => present.has(c)),
    metadataBytes: f.bytes,
  };
}

/* ------------------------------------------------------------------ */
/* EXIF / TIFF                                                         */
/* ------------------------------------------------------------------ */

const TAG = {
  processingSoftware: 0x000b,
  make: 0x010f,
  model: 0x0110,
  orientation: 0x0112,
  software: 0x0131,
  dateTime: 0x0132,
  artist: 0x013b,
  hostComputer: 0x013c,
  copyright: 0x8298,
  exifIfd: 0x8769,
  gpsIfd: 0x8825,
  exposureTime: 0x829a,
  iso: 0x8827,
  fNumber: 0x829d,
  makerNote: 0x927c,
  dateTimeOriginal: 0x9003,
  dateTimeDigitized: 0x9004,
  imageUniqueId: 0xa420,
  cameraOwner: 0xa430,
  bodySerial: 0xa431,
  lensMake: 0xa433,
  lensModel: 0xa434,
  lensSerial: 0xa435,
  jpegThumbOffset: 0x0201,
} as const;

const CAMERA_TAGS = new Set<number>([
  TAG.make,
  TAG.model,
  TAG.exposureTime,
  TAG.iso,
  TAG.fNumber,
  TAG.makerNote,
  TAG.cameraOwner,
  TAG.bodySerial,
  TAG.lensMake,
  TAG.lensModel,
  TAG.lensSerial,
  TAG.imageUniqueId,
]);
const SOFTWARE_TAGS = new Set<number>([TAG.software, TAG.processingSoftware, TAG.hostComputer]);
const DATETIME_TAGS = new Set<number>([TAG.dateTime, TAG.dateTimeOriginal, TAG.dateTimeDigitized]);

export interface TiffScan {
  categories: MetadataCategory[];
  /** EXIF orientation value, 1-8, when present. */
  orientation: number | null;
}

/**
 * Walk a TIFF header and its IFD chain, recording only which *kinds* of tags
 * exist. IFD traversal is visit-limited and every pointer is validated against
 * the block length, so a crafted offset loop cannot hang the parser.
 */
export function scanTiff(b: Uint8Array, base: number, length: number): TiffScan | null {
  if (length < 8 || base < 0 || base + 8 > b.length) return null;

  const byteOrder = ascii(b, base, 2);
  const little = byteOrder === "II";
  if (!little && byteOrder !== "MM") return null;

  const rd16 = (i: number) => (little ? u16le(b, i) : u16be(b, i));
  const rd32 = (i: number) => (little ? u32le(b, i) : u32be(b, i));
  if (rd16(base + 2) !== 42) return null;

  const limit = Math.min(b.length, base + length);
  const found = new Set<MetadataCategory>(["exif"]);
  const visited = new Set<number>();
  let orientation: number | null = null;

  const readIfd = (ifdOffset: number, kind: "root" | "exif" | "gps" | "thumb"): number[] => {
    const at = base + ifdOffset;
    if (ifdOffset < 8 || at + 2 > limit || visited.has(at) || visited.size > 16) return [];
    visited.add(at);

    const count = rd16(at);
    // A single IFD with thousands of entries is malformed; refuse to walk it.
    if (count === 0 || count > 4096) return [];
    const entriesEnd = at + 2 + count * 12;
    if (entriesEnd + 4 > limit) return [];

    if (kind === "gps") found.add("gps");
    if (kind === "thumb") found.add("thumbnail");

    const subIfds: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      const tag = rd16(entry);

      if (CAMERA_TAGS.has(tag)) found.add("camera");
      else if (SOFTWARE_TAGS.has(tag)) found.add("software");
      else if (DATETIME_TAGS.has(tag)) found.add("datetime");
      else if (tag === TAG.artist || tag === TAG.copyright) found.add("other");

      if (kind === "root" && tag === TAG.orientation) {
        const v = rd16(entry + 8);
        if (v >= 1 && v <= 8) orientation = v;
      }
      if (kind === "thumb" && tag === TAG.jpegThumbOffset) found.add("thumbnail");
      if (tag === TAG.exifIfd) subIfds.push(rd32(entry + 8));
      if (tag === TAG.gpsIfd) readIfd(rd32(entry + 8), "gps");
    }

    // IFD1, the second link in the chain, is where a JPEG thumbnail lives.
    if (kind === "root") readIfd(rd32(entriesEnd), "thumb");
    return subIfds;
  };

  for (const sub of readIfd(rd32(base + 4), "root")) readIfd(sub, "exif");

  return { categories: METADATA_CATEGORIES.filter((c) => found.has(c)), orientation };
}

/* ------------------------------------------------------------------ */
/* Generative-AI and provenance markers                                */
/* ------------------------------------------------------------------ */

/** Strings that indicate a generative-AI declaration inside an XMP packet. */
const AI_XMP_MARKERS = [
  "trainedalgorithmicmedia",
  "compositewithtrainedalgorithmicmedia",
  "algorithmicmedia",
  "digitalsourcetype",
  "aigenerated",
  "ai-generated",
];

const PROVENANCE_MARKERS = ["c2pa", "contentcredential", "jumb"];

/** Text keywords written by common generative tools into PNG text chunks. */
const AI_TEXT_KEYWORDS = new Set([
  "parameters",
  "prompt",
  "workflow",
  "sd-metadata",
  "dream",
  "generation_data",
  "aigc",
]);

/* ------------------------------------------------------------------ */
/* JPEG                                                                */
/* ------------------------------------------------------------------ */

function inspectJpeg(b: Uint8Array): ImageInspection {
  const f = new Findings();
  let width: number | null = null;
  let height: number | null = null;

  let i = 2; // past SOI
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++; // resynchronise over fill bytes rather than abandoning the file
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff || marker === 0x00) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // Start of scan: everything after this is entropy-coded pixel data.
    if (marker === 0xda || marker === 0xd9) break;

    const length = u16be(b, i + 2);
    if (length < 2 || i + 2 + length > b.length) break;
    const payload = i + 4;
    const payloadLen = length - 2;

    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrameHeader) {
      height = u16be(b, payload + 1);
      width = u16be(b, payload + 3);
    } else if (marker === 0xe0 && ascii(b, payload, 5) === "JFIF\0") {
      f.add(["other"], "APP0 JFIF", length);
    } else if (marker === 0xe1) {
      if (ascii(b, payload, 6) === "Exif\0\0") {
        const scan = scanTiff(b, payload + 6, payloadLen - 6);
        f.add(scan ? scan.categories : ["exif"], "APP1 Exif", length);
      } else if (ascii(b, payload, 28) === "http://ns.adobe.com/xap/1.0/") {
        const cats: MetadataCategory[] = ["xmp"];
        if (containsAscii(b, payload, payloadLen, AI_XMP_MARKERS)) cats.push("aiGeneration");
        if (containsAscii(b, payload, payloadLen, PROVENANCE_MARKERS)) cats.push("provenance");
        f.add(cats, "APP1 XMP", length);
      } else {
        f.add(["other"], "APP1", length);
      }
    } else if (marker === 0xe2) {
      if (ascii(b, payload, 12) === "ICC_PROFILE\0") f.add(["color"], "APP2 ICC", length);
      else if (ascii(b, payload, 4) === "MPF\0") f.add(["other"], "APP2 MPF", length);
      else f.add(["other"], "APP2", length);
    } else if (marker === 0xeb) {
      // APP11 carries JUMBF boxes, which is where C2PA manifests live.
      const isJumbf =
        ascii(b, payload, 2) === "JP" || containsAscii(b, payload, payloadLen, PROVENANCE_MARKERS);
      f.add(isJumbf ? ["provenance"] : ["other"], "APP11 JUMBF", length);
    } else if (marker === 0xed && ascii(b, payload, 14) === "Photoshop 3.0\0") {
      f.add(["iptc"], "APP13 Photoshop/IPTC", length);
    } else if (marker === 0xfe) {
      f.add(["comment"], "COM", length);
    } else if (marker >= 0xe0 && marker <= 0xef) {
      f.add(["other"], `APP${marker - 0xe0}`, length);
    }

    i += 2 + length;
  }

  return finalise("jpeg", f, width, height, false, false);
}

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

function classifyPngKeyword(keyword: string): MetadataCategory[] {
  const k = keyword.toLowerCase().trim();
  if (k === "xml:com.adobe.xmp") return ["xmp"];
  if (k === "software" || k === "creator" || k === "source") return ["software"];
  if (k === "creation time" || k === "date:create" || k === "date:modify") return ["datetime"];
  if (AI_TEXT_KEYWORDS.has(k)) return ["aiGeneration", "comment"];
  if (k === "comment" || k === "description" || k === "title") return ["comment"];
  return ["other"];
}

function inspectPng(b: Uint8Array): ImageInspection {
  const f = new Findings();
  let width: number | null = null;
  let height: number | null = null;
  let hasAlpha = false;

  let i = 8; // past the 8-byte signature
  while (i + 8 <= b.length) {
    const dataLen = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    const data = i + 8;
    // Chunk length is a 31-bit value by spec; anything larger is corrupt.
    if (dataLen > 0x7fffffff || data + dataLen + 4 > b.length) break;
    const segment = dataLen + 12; // length + type + data + CRC

    if (type === "IHDR" && dataLen >= 13) {
      width = u32be(b, data);
      height = u32be(b, data + 4);
      const colorType = b[data + 9] ?? 0;
      hasAlpha = colorType === 4 || colorType === 6;
    } else if (type === "eXIf") {
      const scan = scanTiff(b, data, dataLen);
      f.add(scan ? scan.categories : ["exif"], "eXIf", segment);
    } else if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
      // The keyword is always stored uncompressed ahead of the payload, so it
      // can be classified without inflating anything.
      const head = ascii(b, data, Math.min(dataLen, 80));
      const keyword = head.slice(0, head.indexOf("\0") === -1 ? 79 : head.indexOf("\0"));
      const cats = classifyPngKeyword(keyword);
      if (cats.includes("xmp")) {
        if (containsAscii(b, data, dataLen, AI_XMP_MARKERS)) cats.push("aiGeneration");
        if (containsAscii(b, data, dataLen, PROVENANCE_MARKERS)) cats.push("provenance");
      }
      f.add(cats, type, segment);
    } else if (type === "iCCP" || type === "sRGB" || type === "gAMA" || type === "cHRM") {
      f.add(["color"], type, segment);
    } else if (type === "caBX") {
      f.add(["provenance"], "caBX", segment); // the C2PA-registered PNG chunk
    } else if (type === "tIME") {
      f.add(["datetime"], "tIME", segment);
    } else if (type === "dSIG" || type === "eXIF") {
      f.add(["other"], type, segment);
    }

    if (type === "IEND") break;
    i += segment;
  }

  return finalise("png", f, width, height, true, hasAlpha);
}

/* ------------------------------------------------------------------ */
/* WebP                                                                */
/* ------------------------------------------------------------------ */

function inspectWebp(b: Uint8Array): ImageInspection {
  const f = new Findings();
  let width: number | null = null;
  let height: number | null = null;
  let lossless = false;
  let hasAlpha = false;

  let i = 12; // past "RIFF" + size + "WEBP"
  while (i + 8 <= b.length) {
    const fourcc = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    const data = i + 8;
    if (size > 0x7fffffff || data + size > b.length) break;
    const segment = 8 + size + (size % 2); // chunks are padded to an even length

    if (fourcc === "VP8X" && size >= 10) {
      const flags = b[data] ?? 0;
      hasAlpha = (flags & 0x10) !== 0;
      // Canvas dimensions are stored as 24-bit little-endian, minus one.
      width = ((b[data + 4] ?? 0) | ((b[data + 5] ?? 0) << 8) | ((b[data + 6] ?? 0) << 16)) + 1;
      height = ((b[data + 7] ?? 0) | ((b[data + 8] ?? 0) << 8) | ((b[data + 9] ?? 0) << 16)) + 1;
    } else if (fourcc === "VP8 " && size >= 10) {
      // Key-frame header: 3-byte tag, 3-byte start code, then 14-bit dimensions.
      if (width === null) {
        width = u16le(b, data + 6) & 0x3fff;
        height = u16le(b, data + 8) & 0x3fff;
      }
    } else if (fourcc === "VP8L" && size >= 5) {
      lossless = true;
      if (width === null) {
        const bits = u32le(b, data + 1);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
        hasAlpha = hasAlpha || ((bits >>> 28) & 1) === 1;
      }
    } else if (fourcc === "ALPH") {
      hasAlpha = true;
    } else if (fourcc === "EXIF") {
      const scan = scanTiff(b, data, size);
      f.add(scan ? scan.categories : ["exif"], "EXIF chunk", segment);
    } else if (fourcc === "XMP ") {
      const cats: MetadataCategory[] = ["xmp"];
      if (containsAscii(b, data, size, AI_XMP_MARKERS)) cats.push("aiGeneration");
      if (containsAscii(b, data, size, PROVENANCE_MARKERS)) cats.push("provenance");
      f.add(cats, "XMP chunk", segment);
    } else if (fourcc === "ICCP") {
      f.add(["color"], "ICCP chunk", segment);
    } else if (fourcc === "C2PA") {
      f.add(["provenance"], "C2PA chunk", segment);
    }

    i += segment;
  }

  return finalise("webp", f, width, height, lossless, hasAlpha);
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Inspect an image buffer. Returns `format: null` when the bytes are not one of
 * the supported containers — callers treat that as "unsupported", never as
 * "trust the declared type instead".
 */
export function inspectImage(bytes: Uint8Array): ImageInspection {
  const format = sniffFormat(bytes);
  switch (format) {
    case "jpeg":
      return inspectJpeg(bytes);
    case "png":
      return inspectPng(bytes);
    case "webp":
      return inspectWebp(bytes);
    default:
      return {
        format: null,
        width: null,
        height: null,
        lossless: false,
        hasAlpha: false,
        findings: [],
        categories: [],
        metadataBytes: 0,
      };
  }
}

/** Categories that represent information a privacy-minded user wants gone. */
export const PRIVACY_CATEGORIES: MetadataCategory[] = [
  "exif",
  "gps",
  "camera",
  "software",
  "datetime",
  "xmp",
  "iptc",
  "thumbnail",
  "comment",
  "provenance",
  "aiGeneration",
  "other",
];

/** Read the EXIF orientation flag, if the container exposes one. */
export function readOrientation(bytes: Uint8Array): number | null {
  const format = sniffFormat(bytes);
  if (format === "jpeg") {
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1] ?? 0;
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const length = u16be(bytes, i + 2);
      if (length < 2 || i + 2 + length > bytes.length) break;
      if (marker === 0xe1 && ascii(bytes, i + 4, 6) === "Exif\0\0") {
        return scanTiff(bytes, i + 10, length - 8)?.orientation ?? null;
      }
      i += 2 + length;
    }
  }
  return null;
}
