import { z } from "zod";

import { publicConfig, serverConfig } from "@/lib/config";
import { formatBytes } from "@/lib/utils";
import { ERROR_MESSAGES, failure, type ValidationFailure } from "@/lib/image/errors";
import { sniffFormat } from "@/lib/image/metadata";
import type { SupportedFormat } from "@/types/image";
import { SUPPORTED_MIME_TYPES } from "@/types/image";

/**
 * Validation is deliberately duplicated: the browser checks first so the user
 * gets an instant answer without uploading 25 MB, and the server checks again
 * because nothing the browser says about a file can be trusted — not the name,
 * not the extension, not the MIME type it attaches to the part.
 */

export const cleanOptionsSchema = z.object({
  quality: z.coerce.number().int().min(60).max(100).default(92),
  applyOrientation: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(true),
  colorProfile: z.enum(["srgb", "strip"]).default("srgb"),
});

export type ParsedCleanOptions = z.infer<typeof cleanOptionsSchema>;

export { ERROR_MESSAGES, failure };
export type { ValidationFailure };

export type ValidationResult =
  { ok: true; format: SupportedFormat } | { ok: false; failure: ValidationFailure };

/**
 * Client-side pre-flight. Only checks what the browser can see cheaply; the
 * magic-byte check happens once the bytes are read.
 */
export function validateFileMeta(file: {
  size: number;
  type: string;
  name: string;
}): ValidationFailure | null {
  if (file.size === 0) return failure("empty_file");
  if (file.size > publicConfig.maxUploadBytes) {
    return failure(
      "too_large",
      `This image is ${formatBytes(file.size)}, which is over the ${publicConfig.maxUploadMb} MB limit.`,
    );
  }
  // A wrong or missing MIME type is not fatal on its own — some browsers send
  // an empty string for files chosen from a camera roll — so it only fails when
  // it is present and clearly something else.
  if (file.type && !(SUPPORTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return failure("unsupported_type");
  }
  return null;
}

/**
 * Authoritative validation, run on the server against the received bytes.
 * The declared MIME type is checked *and* the magic bytes must agree with it,
 * so a `.jpg` full of script never reaches the decoder.
 */
export function validateBytes(bytes: Uint8Array, declaredMime?: string): ValidationResult {
  if (bytes.length === 0) return { ok: false, failure: failure("empty_file") };
  if (bytes.length > serverConfig.maxUploadBytes) {
    return { ok: false, failure: failure("too_large") };
  }

  const format = sniffFormat(bytes);
  if (!format) return { ok: false, failure: failure("unsupported_type") };

  if (declaredMime && (SUPPORTED_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    const expected = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    if (declaredMime !== expected) return { ok: false, failure: failure("unsupported_type") };
  }

  return { ok: true, format };
}

/**
 * Build a safe download filename from a user-supplied one.
 *
 * The original name never touches the filesystem — nothing is written to disk —
 * but it is echoed back in a `Content-Disposition` header, so it is stripped of
 * path separators, control characters and leading dots regardless.
 */
export function safeDownloadName(originalName: string | undefined, extension: string): string {
  // Allowlist rather than blocklist: anything outside a small ASCII set becomes
  // a dash, which rules out path separators, quotes, control bytes and newlines
  // (the header-injection vector) in one step.
  const base = (originalName ?? "image")
    // Reduce to a basename first. Stripping the extension before this would
    // let "../../etc/passwd" lose its tail and collapse to nothing useful.
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);

  return `${base || "image"}-clean.${extension}`;
}
