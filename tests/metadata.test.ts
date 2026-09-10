import { describe, expect, it } from "vitest";

import { inspectImage, sniffFormat } from "@/lib/image/metadata";
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

describe("sniffFormat", () => {
  it("identifies supported containers by their magic bytes", async () => {
    expect(sniffFormat(await plainJpeg())).toBe("jpeg");
    expect(sniffFormat(await plainPng())).toBe("png");
    expect(sniffFormat(await plainWebp())).toBe("webp");
  });

  it("rejects non-images and truncated headers", () => {
    expect(sniffFormat(Buffer.from("<?php echo 1; ?>"))).toBeNull();
    expect(sniffFormat(Buffer.from([0xff, 0xd8]))).toBeNull(); // one byte short of JPEG
    expect(sniffFormat(Buffer.alloc(0))).toBeNull();
  });

  it("ignores what the file claims to be and reads the bytes", async () => {
    // A GIF header with a .jpg extension is still not a JPEG.
    expect(sniffFormat(Buffer.from("GIF89a............", "latin1"))).toBeNull();
  });
});

describe("inspectImage — JPEG", () => {
  it("reports EXIF, camera, software, timestamp and location categories", async () => {
    const inspection = inspectImage(await jpegWithExif());

    expect(inspection.format).toBe("jpeg");
    expect(inspection.categories).toContain("exif");
    expect(inspection.categories).toContain("camera");
    expect(inspection.categories).toContain("software");
    expect(inspection.categories).toContain("datetime");
    expect(inspection.categories).toContain("gps");
    expect(inspection.metadataBytes).toBeGreaterThan(0);
  });

  it("reads dimensions from the frame header", async () => {
    const inspection = inspectImage(await plainJpeg(321, 123));
    expect(inspection.width).toBe(321);
    expect(inspection.height).toBe(123);
  });

  it("detects a generative-AI declaration in an XMP packet", async () => {
    const inspection = inspectImage(jpegWithAiXmp(await plainJpeg()));
    expect(inspection.categories).toContain("xmp");
    expect(inspection.categories).toContain("aiGeneration");
  });

  it("detects a C2PA manifest in an APP11 JUMBF box", async () => {
    const inspection = inspectImage(jpegWithC2pa(await plainJpeg()));
    expect(inspection.categories).toContain("provenance");
  });

  it("detects a comment segment", async () => {
    const inspection = inspectImage(jpegWithComment(await plainJpeg()));
    expect(inspection.categories).toContain("comment");
  });

  it("never returns a metadata value, only its category and size", async () => {
    const inspection = inspectImage(await jpegWithExif());
    const serialised = JSON.stringify(inspection);
    // Every distinctive string written into the fixture must be absent.
    for (const secret of ["FixtureCam", "FX-1", "Fixture Suite", "SN-0001", "51/1", "2026:01:02"]) {
      expect(serialised).not.toContain(secret);
    }
  });
});

describe("inspectImage — PNG", () => {
  it("reads dimensions and reports a lossless container", async () => {
    const inspection = inspectImage(await plainPng());
    expect(inspection.format).toBe("png");
    expect(inspection.width).toBe(240);
    expect(inspection.height).toBe(160);
    expect(inspection.lossless).toBe(true);
  });

  it("classifies text chunks by keyword", async () => {
    const withSoftware = inspectImage(pngWithSoftware(await plainPng()));
    expect(withSoftware.categories).toContain("software");

    const withPrompt = inspectImage(pngWithAiText(await plainPng()));
    expect(withPrompt.categories).toContain("aiGeneration");
    expect(withPrompt.categories).toContain("comment");
  });

  it("detects the C2PA caBX chunk", async () => {
    const inspection = inspectImage(pngWithC2pa(await plainPng()));
    expect(inspection.categories).toContain("provenance");
  });
});

describe("inspectImage — WebP", () => {
  it("distinguishes lossy from lossless", async () => {
    expect(inspectImage(await plainWebp()).lossless).toBe(false);
    expect(inspectImage(await losslessWebp()).lossless).toBe(true);
  });

  it("reads canvas dimensions", async () => {
    const inspection = inspectImage(await plainWebp());
    expect(inspection.format).toBe("webp");
    expect(inspection.width).toBe(240);
    expect(inspection.height).toBe(160);
  });
});

describe("inspectImage — hostile input", () => {
  it("returns an empty result for unrecognised bytes instead of throwing", () => {
    const inspection = inspectImage(Buffer.from("not an image at all"));
    expect(inspection.format).toBeNull();
    expect(inspection.categories).toEqual([]);
  });

  it("survives a truncated JPEG", async () => {
    const jpeg = await jpegWithExif();
    expect(() => inspectImage(jpeg.subarray(0, 64))).not.toThrow();
    expect(() => inspectImage(jpeg.subarray(0, jpeg.length - 100))).not.toThrow();
  });

  it("survives a JPEG whose segment length points past the end of the file", async () => {
    const jpeg = Buffer.from(await plainJpeg());
    // Overwrite the first segment's length with an enormous value.
    jpeg.writeUInt16BE(0xfffe, 4);
    expect(() => inspectImage(jpeg)).not.toThrow();
  });

  it("survives a PNG chunk claiming an impossible length", async () => {
    const png = Buffer.from(await plainPng());
    png.writeUInt32BE(0xfffffff0, 8 + 12 + 8); // a chunk after IHDR
    expect(() => inspectImage(png)).not.toThrow();
  });

  it("does not hang on an EXIF IFD pointing at itself", async () => {
    const jpeg = Buffer.from(await jpegWithExif());
    // Find the TIFF header and make IFD0 point back to offset 8 repeatedly.
    const exifAt = jpeg.indexOf(Buffer.from("Exif\0\0", "latin1"));
    expect(exifAt).toBeGreaterThan(0);
    const tiff = exifAt + 6;
    const little = jpeg.toString("latin1", tiff, tiff + 2) === "II";
    if (little) jpeg.writeUInt32LE(8, tiff + 4);
    else jpeg.writeUInt32BE(8, tiff + 4);

    const started = Date.now();
    expect(() => inspectImage(jpeg)).not.toThrow();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
