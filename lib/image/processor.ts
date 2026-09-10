import sharp from "sharp";
import type { Metadata as SharpMetadata, OutputInfo } from "sharp";

import { serverConfig } from "@/lib/config";
import { inspectImage, PRIVACY_CATEGORIES } from "@/lib/image/metadata";
import { failure, type ValidationFailure } from "@/lib/image/errors";
import { trackBuffer, type Job } from "@/lib/security/cleanup";
import type {
  CleanOptions,
  ImageInspection,
  MetadataCategory,
  SupportedFormat,
} from "@/types/image";
import { EXTENSION_BY_FORMAT, MIME_BY_FORMAT } from "@/types/image";

/**
 * The cleaning pipeline.
 *
 * Everything here happens on an in-memory buffer. Nothing is written to disk,
 * so there is no temporary path to leak, traverse or forget to delete.
 *
 * What this does:  decode the image, discard every auxiliary segment, and
 * re-encode the pixels.
 *
 * What this does NOT do: fabricate replacement metadata, invent camera or
 * creator fields, forge Content Credentials, or alter pixels in an attempt to
 * change how a classifier reads the image. Removing embedded data is a privacy
 * operation; manufacturing a false origin is a different thing entirely, and
 * this tool has no code path for it.
 */

export class ProcessingError extends Error {
  readonly failure: ValidationFailure;
  constructor(f: ValidationFailure) {
    super(f.message);
    this.name = "ProcessingError";
    this.failure = f;
  }
}

export interface ProcessOutcome {
  buffer: Buffer;
  format: SupportedFormat;
  mimeType: (typeof MIME_BY_FORMAT)[SupportedFormat];
  extension: string;
  width: number;
  height: number;
  before: ImageInspection;
  after: ImageInspection;
  removed: MetadataCategory[];
  retained: { category: MetadataCategory; reason: string }[];
  losslessReencode: boolean;
  orientationApplied: boolean;
}

/** Why a category can legitimately survive cleaning. */
const RETENTION_REASONS: Partial<Record<MetadataCategory, string>> = {
  color:
    "Kept as a standard sRGB profile. The original profile was replaced, not preserved — dropping colour information entirely would change how the image looks.",
  other:
    "Container-level structure required by the format itself. It carries no information about you or your device.",
};

function reasonFor(category: MetadataCategory): string {
  return (
    RETENTION_REASONS[category] ??
    "This block is part of the encoded output and carries no identifying information."
  );
}

/**
 * Run a promise against a hard deadline.
 *
 * sharp also enforces its own timeout inside libvips; this outer race is what
 * guarantees the HTTP request returns even if a decode wedges in the thread
 * pool, so the user gets an explanation instead of a hanging spinner.
 */
async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProcessingError(failure("timeout"))), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function cleanImage(
  input: Buffer,
  format: SupportedFormat,
  options: CleanOptions,
  job: Job,
): Promise<ProcessOutcome> {
  const before = inspectImage(input);

  const pipeline = sharp(input, {
    // Refuse decompression bombs before any pixel memory is allocated.
    limitInputPixels: serverConfig.maxPixels,
    sequentialRead: true,
    // Tolerate encoder warnings, reject genuinely broken data.
    failOn: "error",
  }).timeout({ seconds: Math.ceil(serverConfig.processingTimeoutMs / 1000) });

  let meta: SharpMetadata;
  try {
    meta = await withDeadline(pipeline.metadata(), serverConfig.processingTimeoutMs);
  } catch (error) {
    throw asProcessingError(error);
  }

  if (!meta.width || !meta.height) throw new ProcessingError(failure("corrupt_image"));
  if (meta.width * meta.height > serverConfig.maxPixels) {
    throw new ProcessingError(failure("too_many_pixels"));
  }

  // EXIF orientation is a tag, not pixels. Stripping it without applying it
  // first is the classic way a "cleaned" photo comes back rotated, so bake the
  // rotation into the pixels before the tag goes away.
  const orientationApplied = options.applyOrientation && (meta.orientation ?? 1) > 1;
  if (orientationApplied) pipeline.autoOrient();

  // sharp discards all input metadata unless explicitly asked to keep it, so
  // the removal is the default and the colour profile is the only exception.
  if (options.colorProfile === "srgb" && meta.hasProfile) {
    // Converts the pixels into sRGB and attaches the standard profile, which
    // describes a colour space and contains nothing about the user.
    pipeline.withIccProfile("srgb");
  }

  const losslessWebp = format === "webp" && before.lossless;
  switch (format) {
    case "jpeg":
      pipeline.jpeg({
        quality: options.quality,
        // Better quality per byte than the baseline encoder at equal settings.
        mozjpeg: true,
        // Full chroma resolution: subsampling is where visible colour damage
        // comes from on re-encode, and this tool should not degrade an image.
        chromaSubsampling: "4:4:4",
        progressive: true,
      });
      break;
    case "png":
      pipeline.png({
        compressionLevel: 9,
        effort: 8,
        // Preserve the original storage strategy: forcing an indexed PNG to
        // truecolour would inflate it for no benefit, and vice versa.
        palette: meta.isPalette === true,
      });
      break;
    case "webp":
      pipeline.webp(
        losslessWebp ? { lossless: true, effort: 4 } : { quality: options.quality, effort: 4 },
      );
      break;
  }

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await withDeadline(
      pipeline.toBuffer({ resolveWithObject: true }),
      serverConfig.processingTimeoutMs,
    );
  } catch (error) {
    throw asProcessingError(error);
  }

  trackBuffer(job, output.data);
  const after = inspectImage(output.data);

  const beforeSet = new Set(before.categories);
  const afterSet = new Set(after.categories);
  const removed = PRIVACY_CATEGORIES.filter((c) => beforeSet.has(c) && !afterSet.has(c));
  const retained = after.categories.map((category) => ({ category, reason: reasonFor(category) }));

  return {
    buffer: output.data,
    format,
    mimeType: MIME_BY_FORMAT[format],
    extension: EXTENSION_BY_FORMAT[format],
    width: output.info.width,
    height: output.info.height,
    before,
    after,
    removed,
    retained,
    losslessReencode: format === "png" || losslessWebp,
    orientationApplied,
  };
}

/**
 * Map a decoder failure onto a user-facing reason.
 *
 * The original error text is never forwarded: libvips messages can include
 * internal details, and there is nothing in them a user can act on.
 */
function asProcessingError(error: unknown): ProcessingError {
  if (error instanceof ProcessingError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timeout")) return new ProcessingError(failure("timeout"));
  if (message.includes("pixel") && message.includes("limit")) {
    return new ProcessingError(failure("too_many_pixels"));
  }
  return new ProcessingError(failure("corrupt_image"));
}
