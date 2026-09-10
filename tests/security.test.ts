import { afterEach, describe, expect, it } from "vitest";

import { safeDownloadName, validateBytes, validateFileMeta } from "@/lib/image/validation";
import {
  activeJobCount,
  createJob,
  releaseAllJobs,
  releaseJob,
  trackBuffer,
} from "@/lib/security/cleanup";
import { checkRateLimit, clientKeyFromHeaders, resetRateLimit } from "@/lib/security/rate-limit";
import { publicConfig, serverConfig } from "@/lib/config";

import { plainJpeg, plainPng, plainWebp } from "./fixtures/build";

afterEach(() => {
  resetRateLimit();
  releaseAllJobs();
});

describe("validateBytes", () => {
  it("accepts the supported formats", async () => {
    expect(validateBytes(await plainJpeg())).toMatchObject({ ok: true, format: "jpeg" });
    expect(validateBytes(await plainPng())).toMatchObject({ ok: true, format: "png" });
    expect(validateBytes(await plainWebp())).toMatchObject({ ok: true, format: "webp" });
  });

  it("rejects a non-image regardless of what it is called", () => {
    const script = Buffer.from("#!/bin/sh\nrm -rf /\n");
    expect(validateBytes(script, "image/jpeg")).toMatchObject({
      ok: false,
      failure: { code: "unsupported_type" },
    });
  });

  it("rejects a file whose declared type contradicts its magic bytes", async () => {
    // Real PNG bytes announced as a JPEG: the bytes win, and the mismatch is
    // itself a reason to refuse rather than to quietly correct.
    expect(validateBytes(await plainPng(), "image/jpeg")).toMatchObject({
      ok: false,
      failure: { code: "unsupported_type" },
    });
  });

  it("rejects an empty body", () => {
    expect(validateBytes(Buffer.alloc(0))).toMatchObject({
      ok: false,
      failure: { code: "empty_file" },
    });
  });

  it("rejects a body over the configured limit before decoding it", () => {
    const oversized = Buffer.alloc(serverConfig.maxUploadBytes + 1);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    expect(validateBytes(oversized)).toMatchObject({ ok: false, failure: { code: "too_large" } });
  });

  it("accepts an image whose browser-supplied type is missing", async () => {
    expect(validateBytes(await plainJpeg(), "")).toMatchObject({ ok: true });
  });
});

describe("validateFileMeta", () => {
  it("rejects an oversized file with a message naming the limit", () => {
    const result = validateFileMeta({
      size: publicConfig.maxUploadBytes + 1,
      type: "image/jpeg",
      name: "big.jpg",
    });
    expect(result?.code).toBe("too_large");
    expect(result?.message).toContain(String(publicConfig.maxUploadMb));
  });

  it("rejects an unsupported declared type", () => {
    expect(validateFileMeta({ size: 1000, type: "application/pdf", name: "doc.pdf" })?.code).toBe(
      "unsupported_type",
    );
  });

  it("tolerates a missing type, which some mobile pickers send", () => {
    expect(validateFileMeta({ size: 1000, type: "", name: "IMG_0001" })).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateFileMeta({ size: 0, type: "image/png", name: "empty.png" })?.code).toBe(
      "empty_file",
    );
  });
});

describe("safeDownloadName", () => {
  it("keeps an ordinary name and swaps the extension", () => {
    expect(safeDownloadName("holiday.jpeg", "jpg")).toBe("holiday-clean.jpg");
  });

  it("strips path traversal attempts", () => {
    // Only the basename survives, so no separator can reach a header or a path.
    expect(safeDownloadName("../../../etc/passwd", "png")).toBe("passwd-clean.png");
    expect(safeDownloadName("..\\..\\windows\\system32\\config.sys", "png")).toBe(
      "config-clean.png",
    );
    expect(safeDownloadName("/etc/shadow.jpg", "jpg")).toBe("shadow-clean.jpg");
  });

  it("neutralises header-injection attempts", () => {
    const name = 'evil"\r\nX-Injected: yes\r\n\r\n.jpg';
    const result = safeDownloadName(name, "jpg");
    expect(result).not.toContain('"');
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    expect(result).not.toContain(":");
  });

  it("handles a name that sanitises down to nothing", () => {
    expect(safeDownloadName("...", "webp")).toBe("image-clean.webp");
    expect(safeDownloadName("", "webp")).toBe("image-clean.webp");
    expect(safeDownloadName(undefined, "webp")).toBe("image-clean.webp");
  });

  it("bounds the length", () => {
    const long = safeDownloadName("a".repeat(500) + ".jpg", "jpg");
    expect(long.length).toBeLessThanOrEqual(64 + "-clean.jpg".length);
  });

  it("keeps unicode names usable rather than producing an empty one", () => {
    expect(safeDownloadName("休暇の写真.jpg", "jpg")).toBe("image-clean.jpg");
  });
});

describe("rate limiting", () => {
  it("allows up to the configured number of requests, then refuses", () => {
    for (let i = 0; i < serverConfig.rateLimitRequests; i++) {
      expect(checkRateLimit("203.0.113.7").allowed).toBe(true);
    }
    const blocked = checkRateLimit("203.0.113.7");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("counts each client separately", () => {
    for (let i = 0; i < serverConfig.rateLimitRequests; i++) checkRateLimit("198.51.100.1");
    expect(checkRateLimit("198.51.100.1").allowed).toBe(false);
    expect(checkRateLimit("198.51.100.2").allowed).toBe(true);
  });

  it("prefers the first forwarded address and falls back sensibly", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9",
    );
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.10" }))).toBe("203.0.113.10");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("job lifecycle", () => {
  it("zeroes tracked buffers and forgets the job", () => {
    const job = createJob();
    const buffer = trackBuffer(job, Buffer.from([1, 2, 3, 4, 5]));
    expect(activeJobCount()).toBe(1);

    releaseJob(job.id);

    expect(buffer.every((b) => b === 0)).toBe(true);
    expect(activeJobCount()).toBe(0);
  });

  it("is idempotent, so a finally block and the sweeper can both call it", () => {
    const job = createJob();
    trackBuffer(job, Buffer.from([9, 9, 9]));
    releaseJob(job.id);
    expect(() => releaseJob(job.id)).not.toThrow();
    expect(activeJobCount()).toBe(0);
  });

  it("gives every job an unguessable id unrelated to its contents", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createJob().id));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
