import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { inspectImage } from "@/lib/image/metadata";
import { cleanImage, ProcessingError } from "@/lib/image/processor";
import { activeJobCount, createJob, releaseJob } from "@/lib/security/cleanup";
import { DEFAULT_CLEAN_OPTIONS } from "@/types/image";

import {
  jpegWithAiXmp,
  jpegWithC2pa,
  jpegWithComment,
  jpegWithExif,
  losslessWebp,
  plainJpeg,
  plainPng,
  plainWebp,
  pngWithAiText,
  pngWithC2pa,
  pngWithSoftware,
} from "./fixtures/build";

/**
 * Run the pipeline the way the route does: copy the bytes out of the tracked
 * buffer, then release the job. Reading `result.buffer` after the release would
 * find it zeroed — which is the cleanup behaviour working, not a bug.
 */
async function clean(input: Buffer, format: "jpeg" | "png" | "webp", options = {}) {
  const job = createJob();
  try {
    const result = await cleanImage(input, format, { ...DEFAULT_CLEAN_OPTIONS, ...options }, job);
    return { ...result, buffer: Buffer.from(result.buffer) };
  } finally {
    releaseJob(job.id);
  }
}

describe("cleanImage — metadata removal", () => {
  it("removes EXIF, camera, software, timestamp and GPS from a JPEG", async () => {
    const input = await jpegWithExif();
    expect(inspectImage(input).categories).toEqual(
      expect.arrayContaining(["exif", "camera", "software", "datetime", "gps"]),
    );

    const result = await clean(input, "jpeg");

    // Verified against the output bytes, not against what we asked for.
    const after = inspectImage(result.buffer);
    for (const category of ["exif", "camera", "software", "datetime", "gps"] as const) {
      expect(after.categories).not.toContain(category);
      expect(result.removed).toContain(category);
    }
  });

  it("removes an XMP packet declaring generative-AI provenance", async () => {
    const result = await clean(jpegWithAiXmp(await plainJpeg()), "jpeg");
    expect(inspectImage(result.buffer).categories).not.toContain("xmp");
    expect(inspectImage(result.buffer).categories).not.toContain("aiGeneration");
    expect(result.removed).toContain("aiGeneration");
  });

  it("removes a C2PA JUMBF manifest from a JPEG", async () => {
    const result = await clean(jpegWithC2pa(await plainJpeg()), "jpeg");
    expect(inspectImage(result.buffer).categories).not.toContain("provenance");
    expect(result.removed).toContain("provenance");
  });

  it("removes JPEG comment segments", async () => {
    const result = await clean(jpegWithComment(await plainJpeg()), "jpeg");
    expect(inspectImage(result.buffer).categories).not.toContain("comment");
  });

  it("removes PNG text chunks, including generative-tool prompt dumps", async () => {
    const png = await plainPng();

    const software = await clean(pngWithSoftware(png), "png");
    expect(inspectImage(software.buffer).categories).not.toContain("software");

    const prompt = await clean(pngWithAiText(png), "png");
    expect(inspectImage(prompt.buffer).categories).not.toContain("aiGeneration");
    expect(inspectImage(prompt.buffer).categories).not.toContain("comment");
  });

  it("removes the PNG C2PA chunk", async () => {
    const result = await clean(pngWithC2pa(await plainPng()), "png");
    expect(inspectImage(result.buffer).categories).not.toContain("provenance");
  });

  it("leaves no EXIF block that sharp itself can read back", async () => {
    const result = await clean(await jpegWithExif(), "jpeg");
    const meta = await sharp(result.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
  });

  it("does not fabricate any replacement metadata", async () => {
    const result = await clean(await plainJpeg(), "jpeg");
    const after = inspectImage(result.buffer);
    // Only container-level structure may survive; nothing describing a device,
    // a person, a time or an origin.
    for (const category of [
      "camera",
      "gps",
      "software",
      "datetime",
      "xmp",
      "iptc",
      "provenance",
      "aiGeneration",
      "comment",
    ] as const) {
      expect(after.categories).not.toContain(category);
    }
  });
});

describe("cleanImage — output validity and quality", () => {
  it("returns a decodable image of the same format and dimensions", async () => {
    for (const [format, make] of [
      ["jpeg", plainJpeg],
      ["png", plainPng],
      ["webp", plainWebp],
    ] as const) {
      const result = await clean(await make(), format);
      const meta = await sharp(result.buffer).metadata();
      expect(meta.format).toBe(format);
      expect(meta.width).toBe(240);
      expect(meta.height).toBe(160);
      expect(result.width).toBe(240);
      expect(result.height).toBe(160);
    }
  });

  it("re-encodes PNG losslessly — the pixels are identical", async () => {
    const input = await plainPng();
    const result = await clean(input, "png");

    expect(result.losslessReencode).toBe(true);
    const before = await sharp(input).raw().toBuffer();
    const after = await sharp(result.buffer).raw().toBuffer();
    expect(Buffer.compare(before, after)).toBe(0);
  });

  it("keeps lossless WebP lossless", async () => {
    const input = await losslessWebp();
    const result = await clean(input, "webp");

    expect(result.losslessReencode).toBe(true);
    const before = await sharp(input).raw().toBuffer();
    const after = await sharp(result.buffer).raw().toBuffer();
    expect(Buffer.compare(before, after)).toBe(0);
  });

  it("keeps a JPEG visually equivalent rather than claiming it is identical", async () => {
    const input = await plainJpeg();
    const result = await clean(input, "jpeg");

    expect(result.losslessReencode).toBe(false);

    const before = await sharp(input).raw().toBuffer();
    const after = await sharp(result.buffer).raw().toBuffer();
    expect(after.length).toBe(before.length);

    // Mean absolute error across all channels should be imperceptible.
    let total = 0;
    for (let i = 0; i < before.length; i++) total += Math.abs((before[i] ?? 0) - (after[i] ?? 0));
    expect(total / before.length).toBeLessThan(2);
  });

  it("preserves transparency", async () => {
    const input = await sharp({
      create: {
        width: 60,
        height: 60,
        channels: 4,
        background: { r: 200, g: 40, b: 40, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await clean(input, "png");
    const meta = await sharp(result.buffer).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it("bakes EXIF orientation into the pixels before dropping the tag", async () => {
    // Orientation 6 means "rotate 90° clockwise when displaying".
    const input = await sharp({
      create: { width: 200, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await clean(input, "jpeg");

    expect(result.orientationApplied).toBe(true);
    // The rotation is now real, so the stored dimensions have swapped.
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(inspectImage(result.buffer).categories).not.toContain("exif");
  });

  it("honours the quality option for lossy formats", async () => {
    const input = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
        // Noise gives the encoder real detail to spend bits on, so the quality
        // setting has something to actually change.
        noise: { type: "gaussian", mean: 128, sigma: 40 },
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer();

    const low = await clean(input, "jpeg", { quality: 60 });
    const high = await clean(input, "jpeg", { quality: 100 });
    expect(low.buffer.length).toBeLessThan(high.buffer.length);
  });
});

describe("cleanImage — failure handling", () => {
  it("rejects a corrupt image with a usable reason", async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(512, 0x41)]);
    await expect(clean(broken, "jpeg")).rejects.toBeInstanceOf(ProcessingError);
    await expect(clean(broken, "jpeg")).rejects.toMatchObject({
      failure: { code: "corrupt_image" },
    });
  });

  it("rejects a truncated image", async () => {
    const jpeg = await plainJpeg(800, 600);
    await expect(clean(jpeg.subarray(0, 200), "jpeg")).rejects.toBeInstanceOf(ProcessingError);
  });

  it("releases the job on the failure path as well as the success path", async () => {
    const before = activeJobCount();

    const job = createJob();
    try {
      await cleanImage(Buffer.from("junk"), "jpeg", DEFAULT_CLEAN_OPTIONS, job);
    } catch {
      // expected
    } finally {
      releaseJob(job.id);
    }

    expect(activeJobCount()).toBe(before);
  });

  it("zeroes tracked buffers when the job is released", async () => {
    const job = createJob();
    const result = await cleanImage(await plainJpeg(), "jpeg", DEFAULT_CLEAN_OPTIONS, job);
    const copy = Buffer.from(result.buffer);

    expect(copy.some((byte) => byte !== 0)).toBe(true);
    releaseJob(job.id);
    // The pipeline's own output buffer is tracked, so it is wiped in place.
    expect(result.buffer.every((byte) => byte === 0)).toBe(true);
  });
});
