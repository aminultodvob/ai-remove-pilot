import { NextResponse } from "next/server";

import { publicConfig, serverConfig } from "@/lib/config";
import { cleanImage, ProcessingError } from "@/lib/image/processor";
import {
  cleanOptionsSchema,
  ERROR_MESSAGES,
  safeDownloadName,
  validateBytes,
} from "@/lib/image/validation";
import { createJob, releaseJob, trackBuffer } from "@/lib/security/cleanup";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/security/rate-limit";
import type { CleanErrorCode, CleanReport } from "@/types/image";

/**
 * POST /api/process — clean one image.
 *
 * Request:  multipart/form-data with a `file` part and optional `quality`,
 *           `applyOrientation` and `colorProfile` fields.
 *
 * Response: the cleaned image itself as the body, plus an `X-Clean-Report`
 *           header holding a base64 JSON summary.
 *
 * Returning the bytes directly is a privacy decision, not a style one. A
 * download URL would mean the cleaned image has to exist somewhere addressable
 * for some period, which is exactly the thing this product promises not to do.
 * There is no token, no temporary path and nothing to expire: the response *is*
 * the artefact, and once it has been streamed the image exists only in the
 * user's browser.
 */

// sharp is a native module and the pipeline needs real buffers.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cleaning one image is a matter of seconds. Capping the platform duration well
// below the default means a wedged request fails fast instead of billing for
// five minutes of nothing.
export const maxDuration = 60;

function errorResponse(
  code: CleanErrorCode,
  status: number,
  message?: string,
  extra?: HeadersInit,
) {
  return NextResponse.json(
    { success: false as const, code, error: message ?? ERROR_MESSAGES[code] },
    { status, headers: { "Cache-Control": "no-store", ...(extra ?? {}) } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const rate = checkRateLimit(clientKeyFromHeaders(request.headers));
  if (!rate.allowed) {
    return errorResponse("rate_limited", 429, undefined, {
      "Retry-After": String(rate.retryAfter),
    });
  }

  // Cross-origin form posts are rejected when the browser tells us the origin.
  // Direct API clients (curl, scripts) send no Origin header and are unaffected.
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      if (host && new URL(origin).host !== host) return errorResponse("bad_request", 403);
    } catch {
      return errorResponse("bad_request", 400);
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return errorResponse("bad_request", 415);
  }

  // Reject an oversized body from its declared length before buffering it.
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > serverConfig.maxUploadBytes * 1.05) {
    return errorResponse("too_large", 413);
  }

  const job = createJob();
  const startedAt = Date.now();

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorResponse("bad_request", 400);
    }

    const file = form.get("file");
    if (!file || typeof file === "string") return errorResponse("no_file", 400);
    if (file.size === 0) return errorResponse("empty_file", 400);
    if (file.size > serverConfig.maxUploadBytes) return errorResponse("too_large", 413);

    const parsedOptions = cleanOptionsSchema.safeParse({
      quality: form.get("quality") ?? undefined,
      applyOrientation: form.get("applyOrientation") ?? undefined,
      colorProfile: form.get("colorProfile") ?? undefined,
    });
    if (!parsedOptions.success) return errorResponse("bad_request", 400);

    const buffer = trackBuffer(job, Buffer.from(await file.arrayBuffer()));

    // The declared type is only ever a cross-check against the magic bytes;
    // the bytes decide.
    const validation = validateBytes(buffer, file.type || undefined);
    if (!validation.ok) {
      const status = validation.failure.code === "too_large" ? 413 : 415;
      return errorResponse(validation.failure.code, status, validation.failure.message);
    }

    const outcome = await cleanImage(buffer, validation.format, parsedOptions.data, job);

    const filename = safeDownloadName(
      typeof file.name === "string" ? file.name : undefined,
      outcome.extension,
    );

    const report: CleanReport = {
      success: true,
      filename,
      mimeType: outcome.mimeType,
      originalSize: buffer.length,
      processedSize: outcome.buffer.length,
      width: outcome.width,
      height: outcome.height,
      format: outcome.format,
      metadataDetected: outcome.before.categories,
      metadataRemoved: outcome.removed,
      metadataRetained: outcome.retained,
      metadataBytesBefore: outcome.before.metadataBytes,
      metadataBytesAfter: outcome.after.metadataBytes,
      losslessReencode: outcome.losslessReencode,
      orientationApplied: outcome.orientationApplied,
      processingMs: Date.now() - startedAt,
    };

    // Copy out of the tracked buffer before the `finally` block zeroes it.
    const body = new Uint8Array(outcome.buffer);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": outcome.mimeType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Clean-Report": Buffer.from(JSON.stringify(report), "utf8").toString("base64"),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ProcessingError) {
      const status = error.failure.code === "timeout" ? 504 : 422;
      return errorResponse(error.failure.code, status, error.failure.message);
    }
    // Never echo an internal error to the client, and never log the image.
    console.error("[process] unhandled failure", {
      jobId: job.id,
      name: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse("server_error", 500);
  } finally {
    // Runs on success, on validation failure, on decoder failure and on
    // timeout. Nothing is left holding the image.
    releaseJob(job.id);
  }
}

/** Advertise the limits without requiring an upload. */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      endpoint: "POST /api/process",
      accepts: ["image/jpeg", "image/png", "image/webp"],
      maxUploadBytes: serverConfig.maxUploadBytes,
      maxUploadMb: publicConfig.maxUploadMb,
      storage: "none — images are processed in memory and never written to disk",
      responseBody: "the cleaned image; summary in the X-Clean-Report header (base64 JSON)",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
