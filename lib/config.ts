/**
 * Runtime configuration. Every operational limit is read from the environment
 * exactly once, here, so nothing downstream hard-codes a number.
 *
 * Client components must not import the server half of this module: only the
 * `NEXT_PUBLIC_` values are inlined into the bundle.
 */

function num(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function bool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

/** Safe to read from the browser. */
export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  maxUploadBytes: num(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB, 25, 1, 512) * 1024 * 1024,
  maxUploadMb: num(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB, 25, 1, 512),
  analyticsEnabled: bool(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS, false),
} as const;

/** Server-only. Reading these from a client component will silently yield defaults. */
export const serverConfig = {
  /**
   * The server limit is authoritative. It defaults to the public value so a
   * misconfigured deployment fails closed at the same number the UI advertises.
   */
  maxUploadBytes:
    num(process.env.MAX_UPLOAD_SIZE_MB, publicConfig.maxUploadMb, 1, 512) * 1024 * 1024,
  processingTimeoutMs: num(process.env.PROCESSING_TIMEOUT_MS, 30_000, 1_000, 120_000),
  jobTtlMs: num(process.env.TEMP_FILE_TTL_SECONDS, 300, 5, 3_600) * 1000,
  rateLimitRequests: num(process.env.RATE_LIMIT_REQUESTS, 20, 1, 10_000),
  rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_SECONDS, 60, 1, 86_400) * 1000,
  maxPixels: num(process.env.MAX_IMAGE_MEGAPIXELS, 100, 1, 1_000) * 1_000_000,
} as const;

export const SITE = {
  name: "AI Remove Pilot",
  tagline: "Clean Your Images. Keep Your Privacy.",
  short: "Process. Download. Gone.",
  description:
    "Clean image metadata and supported embedded provenance information without permanently storing your images. Fast, private and simple.",
} as const;
