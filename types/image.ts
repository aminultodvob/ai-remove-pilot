/**
 * Shared image/metadata vocabulary. These types are used on both the client
 * (which inspects bytes locally before anything is uploaded) and the server
 * (which re-inspects and re-encodes), so this module must stay runtime-agnostic.
 */

/** Container formats the pipeline currently accepts. */
export const SUPPORTED_FORMATS = ["jpeg", "png", "webp"] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

export const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export const MIME_BY_FORMAT: Record<SupportedFormat, SupportedMimeType> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const EXTENSION_BY_FORMAT: Record<SupportedFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/**
 * Categories of embedded data we can detect and report on.
 *
 * `color` is deliberately not a privacy category: an ICC profile describes how
 * to render pixels, and discarding it silently would change how the image
 * looks. It is reported so the user can see it, and normalized rather than
 * dropped by default.
 */
export const METADATA_CATEGORIES = [
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
  "color",
  "other",
] as const;
export type MetadataCategory = (typeof METADATA_CATEGORIES)[number];

/** Human-facing labels. Kept here so the API, UI and tests agree. */
export const CATEGORY_LABELS: Record<MetadataCategory, string> = {
  exif: "EXIF",
  gps: "Location",
  camera: "Camera / device",
  software: "Software",
  datetime: "Date & time",
  xmp: "XMP",
  iptc: "IPTC",
  thumbnail: "Embedded thumbnail",
  comment: "Comments",
  provenance: "Content Credentials (C2PA)",
  aiGeneration: "AI generation metadata",
  color: "Colour profile",
  other: "Other metadata",
};

export const CATEGORY_DESCRIPTIONS: Record<MetadataCategory, string> = {
  exif: "The general-purpose tag block written by cameras and editors.",
  gps: "Coordinates or location references. Never displayed, only reported.",
  camera: "Make, model, lens and capture settings of the device used.",
  software: "The application and version that last wrote the file.",
  datetime: "When the image was captured or last written.",
  xmp: "Adobe's XML metadata packet, often carrying editing history.",
  iptc: "Press/stock captions, creator and copyright records.",
  thumbnail: "A small second copy of the image stored inside the file.",
  comment: "Free-text comment blocks, including generator prompt dumps.",
  provenance: "Signed C2PA provenance manifests, also called Content Credentials.",
  aiGeneration: "Tags declaring the image was produced or edited by a generative model.",
  color: "ICC profile describing how the pixel values should be rendered.",
  other: "Container-level or unrecognised auxiliary blocks.",
};

/** One detected block of embedded data. Values are never captured. */
export interface MetadataFinding {
  category: MetadataCategory;
  /** Short technical origin, e.g. "JPEG APP1 (Exif)" or "PNG tEXt". */
  source: string;
  /** Size of the containing segment in bytes, when it can be determined. */
  bytes?: number;
}

/** What a container-level inspection can tell us without a full decode. */
export interface ImageInspection {
  format: SupportedFormat | null;
  width: number | null;
  height: number | null;
  /** True when the encoding is mathematically lossless (PNG, WebP VP8L). */
  lossless: boolean;
  hasAlpha: boolean;
  findings: MetadataFinding[];
  /** Deduplicated, display-ordered categories present in the file. */
  categories: MetadataCategory[];
  /** Total bytes attributable to detected metadata segments. */
  metadataBytes: number;
}

/** Options the client may send alongside a file. */
export interface CleanOptions {
  /** JPEG/WebP encoder quality, 60-100. Ignored for lossless output. */
  quality: number;
  /** Apply the EXIF orientation flag to the pixels before discarding it. */
  applyOrientation: boolean;
  /**
   * "srgb" converts to and embeds a standard sRGB profile so colours survive.
   * "strip" removes all colour information, which can shift wide-gamut images.
   */
  colorProfile: "srgb" | "strip";
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
  quality: 92,
  applyOrientation: true,
  colorProfile: "srgb",
};

/** The report returned with a cleaned image. Contains no pixel or tag values. */
export interface CleanReport {
  success: true;
  filename: string;
  mimeType: SupportedMimeType;
  originalSize: number;
  processedSize: number;
  width: number;
  height: number;
  format: SupportedFormat;
  /** Categories present before cleaning that are absent afterwards. */
  metadataRemoved: MetadataCategory[];
  /** Categories still present afterwards, with the reason they were kept. */
  metadataRetained: { category: MetadataCategory; reason: string }[];
  /** Categories detected in the uploaded file. */
  metadataDetected: MetadataCategory[];
  /** Bytes of metadata in, bytes of metadata out. */
  metadataBytesBefore: number;
  metadataBytesAfter: number;
  /** True when the encoder path was lossless end to end. */
  losslessReencode: boolean;
  /** Orientation was baked into the pixels rather than left as a tag. */
  orientationApplied: boolean;
  processingMs: number;
}

export interface CleanErrorBody {
  success: false;
  error: string;
  /** Stable machine-readable reason, safe to branch on in the UI. */
  code: CleanErrorCode;
}

export const CLEAN_ERROR_CODES = [
  "no_file",
  "unsupported_type",
  "too_large",
  "empty_file",
  "corrupt_image",
  "too_many_pixels",
  "timeout",
  "rate_limited",
  "bad_request",
  "server_error",
] as const;
export type CleanErrorCode = (typeof CLEAN_ERROR_CODES)[number];
