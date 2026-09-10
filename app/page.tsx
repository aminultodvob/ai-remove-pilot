import {
  Cpu,
  Database,
  EyeOff,
  FileCheck2,
  Layers,
  MapPinOff,
  ScanLine,
  Timer,
} from "lucide-react";
import Link from "next/link";

import { BeforeAfter } from "@/components/before-after";
import { FaqAccordion } from "@/components/faq-accordion";
import { FeatureCard, StepCard } from "@/components/feature-card";
import { Hero } from "@/components/hero";
import { PipelineVisual } from "@/components/pipeline-visual";
import { PlatformLabelNotice } from "@/components/privacy-badge";
import { buttonVariants } from "@/components/ui/button";
import { Section, SectionHeading } from "@/components/ui/primitives";
import { publicConfig, SITE } from "@/lib/config";
import { FAQ } from "@/lib/content/faq";
import { cn } from "@/lib/utils";

const TRUST = [
  { icon: Database, label: "No permanent storage" },
  { icon: EyeOff, label: "No image training" },
  { icon: Cpu, label: "No third-party AI APIs" },
  { icon: Timer, label: "Released after processing" },
];

const STEPS = [
  {
    step: "01",
    title: "Upload",
    description:
      "Drop your image into AI Remove Pilot. It is read and inspected in your browser first — nothing is sent until you ask for it.",
  },
  {
    step: "02",
    title: "Clean",
    description:
      "Remove unnecessary embedded metadata and supported provenance information, then re-encode the pixels.",
  },
  {
    step: "03",
    title: "Download",
    description:
      "Download the processed image. It comes back as the response itself, so there is no link left behind to expire.",
  },
];

const REMOVES = [
  {
    icon: MapPinOff,
    title: "Location and device records",
    description:
      "GPS coordinates, camera make and model, lens data and body serial numbers — the fields that tie a photo to a place and a piece of hardware.",
  },
  {
    icon: ScanLine,
    title: "Editing and software history",
    description:
      "Software tags, timestamps, XMP packets and IPTC records that describe when a file was made and what touched it along the way.",
  },
  {
    icon: Layers,
    title: "Embedded extras",
    description:
      "Thumbnails, comment blocks — including the prompt dumps some generative tools write — and supported C2PA provenance manifests.",
  },
  {
    icon: FileCheck2,
    title: "Verified by re-reading the output",
    description:
      "The report is produced by inspecting the cleaned file, not by listing what the encoder was asked to drop. If it says removed, it's absent.",
  },
];

/** FAQ structured data, generated from the same content the page renders. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  description: SITE.description,
  url: publicConfig.appUrl,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([appJsonLd, faqJsonLd]) }}
      />

      <Hero />

      {/* Trust strip ---------------------------------------------------- */}
      <div className="border-border bg-surface border-y">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-3 px-5 py-5 sm:px-6 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="text-muted-foreground flex items-center gap-2 text-sm">
              <Icon aria-hidden className="text-success size-4 shrink-0" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {/* How it works --------------------------------------------------- */}
      <Section id="how-it-works">
        <SectionHeading
          eyebrow="How it works"
          title="Upload. Clean. Download."
          description="Three steps, and a fourth principle that matters more than any of them."
        />

        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <StepCard key={step.step} {...step} />
          ))}
        </div>

        <div className="border-accent/25 bg-accent-soft mt-8 rounded-xl border px-5 py-4">
          <p className="text-[15px] font-medium">Your file doesn&apos;t become our library.</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            There is no gallery, no account, no history and no bucket. The image exists on our
            server for the length of one request and is released when that request ends.
          </p>
        </div>

        <PipelineVisual className="mt-8" />
      </Section>

      {/* What gets removed ---------------------------------------------- */}
      <Section className="border-border border-t">
        <SectionHeading
          eyebrow="Metadata cleaning"
          title="What actually comes out of the file"
          description="Images carry more than pixels. Most of it is written automatically, and most people never see it until it travels somewhere they didn't intend."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {REMOVES.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      {/* Worked example -------------------------------------------------- */}
      <Section className="border-border border-t">
        <SectionHeading
          eyebrow="Before and after"
          title="The picture stays. The record attached to it doesn't."
          description="Pixels are preserved as closely as the format allows — losslessly for PNG and lossless WebP. What changes is everything wrapped around them."
        />
        <BeforeAfter className="mt-10" />
      </Section>

      {/* Privacy architecture -------------------------------------------- */}
      <Section id="privacy" className="border-border border-t">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <SectionHeading
            eyebrow="Privacy architecture"
            title="The safest place to put an image is nowhere"
            description="Most of this product's privacy properties come from things it does not have. There is no upload directory to misconfigure, no bucket to leave public, and no database row to leak."
          />

          <ul className="space-y-3">
            {[
              [
                "Processed in memory",
                "Your image is never written to disk, so there is no temporary file to forget to delete.",
              ],
              [
                "Returned, not hosted",
                "The cleaned image is the HTTP response. No download URL exists, so none can be guessed or shared by accident.",
              ],
              [
                "Released on every path",
                "Buffers are overwritten and dropped in a finally block — on success, on validation failure, on a decoder error and on timeout alike.",
              ],
              [
                "Nothing logged",
                "No image bytes, no filenames, no metadata values and no hashes appear in any log line.",
              ],
            ].map(([title, body]) => (
              <li key={title} className="surface-card px-5 py-4">
                <p className="text-[15px] font-medium">{title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <Link href="/privacy" className={cn(buttonVariants({ variant: "secondary" }))}>
            Read the full privacy page
          </Link>
        </div>
      </Section>

      {/* FAQ -------------------------------------------------------------- */}
      <Section id="faq" className="border-border border-t">
        <SectionHeading eyebrow="FAQ" title="Questions worth asking a privacy tool" />
        <FaqAccordion items={FAQ.slice(0, 5)} className="mt-8" />
        <Link href="/faq" className={cn(buttonVariants({ variant: "ghost" }), "mt-4 px-0 sm:px-0")}>
          See all questions
        </Link>
      </Section>

      {/* Final CTA --------------------------------------------------------- */}
      <Section className="border-border border-t">
        <div className="surface-card px-6 py-10 text-center sm:px-10 sm:py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Metadata out. Image back.
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-sm leading-relaxed text-pretty sm:text-base">
            {SITE.short} No account, no library, nothing kept.
          </p>
          <Link
            href="#tool"
            className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full sm:w-auto")}
          >
            Clean an Image
          </Link>
          <PlatformLabelNotice className="mx-auto mt-6 max-w-xl" />
        </div>
      </Section>
    </>
  );
}
