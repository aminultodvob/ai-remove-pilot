import type { Metadata } from "next";
import Link from "next/link";

import { List, PageShell, Prose } from "@/components/page-shell";
import { PipelineVisual } from "@/components/pipeline-visual";
import { PlatformLabelNotice } from "@/components/privacy-badge";
import { buttonVariants } from "@/components/ui/button";
import { publicConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "The AI Remove Pilot pipeline, step by step: local inspection, validation, metadata removal, re-encoding, and immediate release of processing data.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <PageShell
      eyebrow="How it works"
      title="Upload. Clean. Download."
      intro="Three steps for you, six for the pipeline. Here is what each one actually does."
    >
      <PipelineVisual />

      <Prose heading="01 · Upload">
        <p>
          Drop an image into AI Remove Pilot, choose one from your device, or paste one from your
          clipboard. Before anything is sent, your browser reads the file and runs the metadata
          parser locally, which is why the report appears instantly and why you can walk away at
          that point without having uploaded anything.
        </p>
        <p>
          The parser identifies the container from its magic bytes, not from the file extension or
          the type your operating system reports.
        </p>
      </Prose>

      <Prose heading="02 · Clean">
        <p>When you press Clean Image, the file is sent once and the server:</p>
        <List
          items={[
            <>
              <strong>Validates</strong> it again from scratch — magic bytes, declared type, size,
              and pixel count — because nothing the browser said about the file can be trusted.
            </>,
            <>
              <strong>Inspects</strong> the container to record which metadata segments exist.
            </>,
            <>
              <strong>Decodes</strong> the pixels, applying the EXIF orientation flag so the image
              does not come back rotated once that flag is gone.
            </>,
            <>
              <strong>Re-encodes</strong> from the pixels alone. Auxiliary segments are not copied
              forward, which is why removal is the default rather than a list of tags to delete.
            </>,
            <>
              <strong>Re-inspects the output</strong> to build your report, so what you are told was
              removed is verified against the file you are about to download.
            </>,
          ]}
        />
      </Prose>

      <Prose heading="03 · Download">
        <p>
          The cleaned image comes back as the response body itself. There is no temporary URL, no
          token and nothing to expire, because nothing was stored to expire in the first place. Your
          browser holds the result, and the server has already released it.
        </p>
      </Prose>

      <Prose heading="Your file doesn't become our library">
        <p>
          This is the principle the other three steps exist to serve. There is no gallery, no
          account, no processing history and no storage bucket. An image exists on the server for
          the length of one request. Everything else about this product follows from that decision.
        </p>
      </Prose>

      <Prose heading="Quality">
        <p>
          Removing metadata requires re-encoding, so the honest answer depends on the format. PNG
          and lossless WebP are re-encoded losslessly — the pixels are mathematically identical.
          JPEG and lossy WebP are re-compressed; the default is quality 92 with full chroma
          resolution (no subsampling), which is visually equivalent to the original in normal use.
          We do not claim a JPEG result is bit-identical, because it is not.
        </p>
      </Prose>

      <Prose heading="What we do not do">
        <List
          items={[
            "We do not fabricate metadata, invent camera details, or write false creator information.",
            "We do not forge Content Credentials or any other provenance signature.",
            "We do not alter pixels to influence how a classifier reads an image.",
          ]}
        />
        <PlatformLabelNotice className="text-[15px]" />
      </Prose>

      <Prose heading="Limits">
        <p>
          JPG/JPEG, PNG and WebP, up to {publicConfig.maxUploadMb} MB per image. One image at a
          time; batch processing is not part of this version.
        </p>
        <div className="pt-2">
          <Link href="/#tool" className={cn(buttonVariants())}>
            Clean an image
          </Link>
        </div>
      </Prose>
    </PageShell>
  );
}
