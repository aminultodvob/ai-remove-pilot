import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/process/route";
import { inspectImage } from "@/lib/image/metadata";
import { activeJobCount, releaseAllJobs } from "@/lib/security/cleanup";
import { resetRateLimit } from "@/lib/security/rate-limit";
import { serverConfig } from "@/lib/config";
import type { CleanReport } from "@/types/image";

import { jpegWithExif, plainPng, plainWebp } from "./fixtures/build";

afterEach(() => {
  resetRateLimit();
  releaseAllJobs();
});

/** Build a multipart request the same shape the browser sends. */
function upload(
  body: Buffer | null,
  {
    filename = "photo.jpg",
    type = "image/jpeg",
    fields = {},
    headers = {},
  }: {
    filename?: string;
    type?: string;
    fields?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): Request {
  const form = new FormData();
  if (body) {
    form.append("file", new File([new Uint8Array(body)], filename, { type }), filename);
  }
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new Request("http://localhost:3000/api/process", { method: "POST", body: form, headers });
}

function readReport(response: Response): CleanReport {
  const header = response.headers.get("X-Clean-Report");
  expect(header).toBeTruthy();
  return JSON.parse(Buffer.from(header!, "base64").toString("utf8")) as CleanReport;
}

describe("POST /api/process — success", () => {
  it("returns the cleaned image itself, not a link to one", async () => {
    const response = await POST(upload(await jpegWithExif()));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("no-store");

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(inspectImage(bytes).format).toBe("jpeg");

    // Nothing in the response should point anywhere the image could be fetched.
    const serialised = JSON.stringify([...response.headers.entries()]);
    expect(serialised).not.toMatch(/https?:\/\//);
    expect(serialised.toLowerCase()).not.toContain("token");
  });

  it("reports removals that are verifiable in the returned bytes", async () => {
    const response = await POST(upload(await jpegWithExif()));
    const report = readReport(response);
    const bytes = Buffer.from(await response.arrayBuffer());
    const after = inspectImage(bytes);

    expect(report.success).toBe(true);
    expect(report.metadataRemoved).toEqual(
      expect.arrayContaining(["exif", "gps", "camera", "software"]),
    );
    for (const removed of report.metadataRemoved) {
      expect(after.categories).not.toContain(removed);
    }
    expect(report.processedSize).toBe(bytes.length);
  });

  it("never includes a filesystem path or an internal detail in the report", async () => {
    const response = await POST(upload(await jpegWithExif()));
    const raw = JSON.stringify(readReport(response));
    expect(raw).not.toMatch(/[A-Za-z]:\\/); // Windows path
    expect(raw).not.toMatch(/\/(tmp|var|home|usr)\//); // POSIX path
    expect(raw).not.toContain("node_modules");
  });

  it("sanitises the download filename it echoes back", async () => {
    const response = await POST(
      upload(await plainPng(), {
        filename: '../../evil"\r\nX-Injected: 1.png',
        type: "image/png",
      }),
    );
    const disposition = response.headers.get("Content-Disposition") ?? "";
    // The injection payload survives only as inert text: the CR/LF that would
    // have started a new header, the quote that would have closed the value,
    // and the separators that would have made it a path are all gone.
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).not.toContain("..");
    expect(disposition).not.toContain("/");
    expect(disposition.match(/"/g)).toHaveLength(2);
    expect(readReport(response).filename).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("handles PNG and WebP", async () => {
    const png = await POST(upload(await plainPng(), { filename: "a.png", type: "image/png" }));
    expect(readReport(png).format).toBe("png");
    expect(readReport(png).losslessReencode).toBe(true);

    const webp = await POST(upload(await plainWebp(), { filename: "a.webp", type: "image/webp" }));
    expect(readReport(webp).format).toBe("webp");
  });

  it("accepts a same-origin request that declares its origin", async () => {
    const response = await POST(
      upload(await plainPng(), {
        filename: "a.png",
        type: "image/png",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      }),
    );
    expect(response.status).toBe(200);
  });

  it("releases every job it created", async () => {
    await POST(upload(await jpegWithExif()));
    await POST(upload(Buffer.from("not an image"), { filename: "x.jpg" }));
    expect(activeJobCount()).toBe(0);
  });
});

describe("POST /api/process — rejections", () => {
  it("rejects a request with no file", async () => {
    const response = await POST(upload(null));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "no_file" });
  });

  it("rejects a non-image disguised with an image name and type", async () => {
    const response = await POST(
      upload(Buffer.from("<?php system($_GET['c']); ?>"), { filename: "shell.jpg" }),
    );
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ code: "unsupported_type" });
  });

  it("rejects a real PNG announced as a JPEG", async () => {
    const response = await POST(await Promise.resolve(upload(await plainPng())));
    expect(response.status).toBe(415);
  });

  it("rejects an empty file", async () => {
    const response = await POST(upload(Buffer.alloc(0)));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "empty_file" });
  });

  it("rejects a body over the size limit", async () => {
    const oversized = Buffer.alloc(serverConfig.maxUploadBytes + 1024);
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    const response = await POST(upload(oversized));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: "too_large" });
  });

  it("rejects a corrupt image with an explanation, not a stack trace", async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2048, 0x41)]);
    const response = await POST(upload(broken));
    expect(response.status).toBe(422);

    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("corrupt_image");
    expect(body.error).not.toMatch(/at .+:\d+:\d+/);
    expect(body.error.length).toBeLessThan(200);
  });

  it("rejects a cross-origin form post", async () => {
    const response = await POST(
      upload(await plainPng(), {
        filename: "a.png",
        type: "image/png",
        headers: { origin: "https://attacker.example", host: "localhost:3000" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects a body that is not multipart", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/process", {
        method: "POST",
        body: JSON.stringify({ file: "nope" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(415);
  });

  it("rejects an out-of-range option instead of clamping it silently", async () => {
    const response = await POST(upload(await plainPng(), { fields: { quality: "999" } }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "bad_request" });
  });

  it("rate limits a client that floods the endpoint", async () => {
    const image = await jpegWithExif();
    const headers = { "x-forwarded-for": "192.0.2.55" };

    let limited: Response | null = null;
    for (let i = 0; i < serverConfig.rateLimitRequests + 1; i++) {
      const response = await POST(upload(image, { headers }));
      if (response.status === 429) {
        limited = response;
        break;
      }
    }

    expect(limited).not.toBeNull();
    expect(limited!.headers.get("Retry-After")).toBeTruthy();
    await expect(limited!.json()).resolves.toMatchObject({ code: "rate_limited" });
  });
});
