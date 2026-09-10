import type { Metadata } from "next";
import Link from "next/link";

import { List, PageShell, Prose } from "@/components/page-shell";
import { PlatformLabelNotice } from "@/components/privacy-badge";
import { publicConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How AI Remove Pilot handles your images: processed in memory, never stored, never used for training, never sent to a third-party AI service.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy"
      title="What happens to your image"
      intro="This page describes the actual implementation, not an aspiration. Where a claim depends on how the service is deployed, that is said plainly rather than glossed over."
      updated="September 2026"
    >
      <Prose heading="No permanent image storage">
        <p>
          Your image is held in memory for the duration of a single HTTP request. It is{" "}
          <strong>never written to disk</strong>: there is no upload directory, no temporary file,
          no object-storage bucket and no database. The cleaned image is returned as the body of the
          response itself, which means no download URL is created and there is nothing that could be
          visited, guessed or shared later.
        </p>
        <p>
          Buffers are overwritten and released in a{" "}
          <code className="font-mono text-xs">finally</code> block, so the release happens on the
          success path and on every failure path — a rejected file type, a corrupt image, a decoder
          error, a timeout. A background sweeper additionally force-releases anything that outlives
          its configured lifetime, five minutes by default.
        </p>
      </Prose>

      <Prose heading="Your image is inspected before it is uploaded">
        <p>
          The metadata report you see after choosing a file is produced{" "}
          <strong>in your browser</strong>, by the same parser the server uses. Nothing is
          transmitted until you press Clean Image. If you change your mind at that screen, your
          image never left your machine at all.
        </p>
      </Prose>

      <Prose heading="No training, no selling, no third-party AI">
        <List
          items={[
            <>
              Uploaded images are <strong>never used to train models</strong>, ours or anyone
              else&apos;s.
            </>,
            <>
              Image data is <strong>never sold</strong> or shared with data brokers.
            </>,
            <>
              Images are <strong>never sent to a third-party AI or vision API</strong>. Processing
              is done locally on the server with libvips (via sharp), a conventional image library.
            </>,
            <>
              There is no image gallery, no history, no account and no public image URL of any kind.
            </>,
          ]}
        />
      </Prose>

      <Prose heading="What we can read, and what we report">
        <p>
          To tell you what is in your file, the parser identifies which metadata segments exist and
          how large they are. It records <strong>categories, not values</strong>. When an image
          contains GPS data, the report says &ldquo;Location metadata detected&rdquo; and stops
          there — the coordinates are never read into the report, displayed on screen, or sent
          anywhere. The same applies to camera serial numbers, timestamps and captions.
        </p>
        <p>
          Categories that may be detected: EXIF, location, camera and device, software, date and
          time, XMP, IPTC, embedded thumbnails, comment blocks, C2PA provenance manifests, AI
          generation declarations, and colour profiles.
        </p>
      </Prose>

      <Prose heading="Colour profiles are treated differently, on purpose">
        <p>
          An ICC colour profile is not information about you — it describes how the pixel values
          should be rendered. Discarding it silently would visibly shift the colours of a wide-gamut
          image. By default the image is converted into standard sRGB and a generic sRGB profile is
          attached, so the file looks the same as before while carrying no device-specific colour
          data. This is reported as &ldquo;preserved&rdquo; rather than &ldquo;removed&rdquo;,
          because that is what happened.
        </p>
      </Prose>

      <Prose heading="Logs">
        <p>
          No image bytes, filenames, metadata values, image hashes or image URLs are written to any
          log. If an unexpected error occurs, the log line contains a random job identifier and an
          error class name — nothing derived from your file. Your hosting provider will still keep
          its own standard HTTP access logs, which typically include IP addresses and request paths;
          that is outside this application&apos;s control.
        </p>
      </Prose>

      <Prose heading="Rate limiting">
        <p>
          To keep the service available, requests are counted per client address in a short rolling
          window. The address is reduced to a non-reversible hash before being used as a counter
          key, the counter holds only a number and an expiry, and entries are discarded as soon as
          the window closes. Nothing about the request or its contents is retained.
        </p>
      </Prose>

      <Prose heading="Analytics">
        <p>
          Analytics are <strong>disabled by default</strong> and the deployment must explicitly
          enable them. When enabled, only event names and coarse technical properties can be sent —
          which format was processed, a size bucket rounded to the nearest 100 KB, a duration, or an
          error code. Image contents, filenames, metadata values, GPS data and image hashes cannot
          be transmitted: the analytics interface has no field that would accept them.
        </p>
      </Prose>

      <Prose heading="Cookies">
        <p>
          The application sets no cookies and does no cross-site tracking. Your theme preference is
          stored in your browser&apos;s local storage and never leaves your device.
        </p>
      </Prose>

      <Prose heading="Third-party services">
        <p>
          The default build loads no third-party scripts, trackers, advertising or embedded content.
          The interface font is served from the application&apos;s own domain rather than a font
          CDN. The only third party involved is whoever hosts the deployment you are using.
        </p>
      </Prose>

      <Prose heading="What this tool cannot do">
        <PlatformLabelNotice className="text-[15px]" />
        <p>
          Removing embedded metadata is a real and useful privacy improvement. It is not the same
          thing as controlling a third-party platform&apos;s classification of an image, and we do
          not claim it is. See the <Link href="/faq">FAQ</Link> for a fuller explanation.
        </p>
      </Prose>

      <Prose heading="Limits">
        <p>
          Maximum image size is {publicConfig.maxUploadMb} MB by default and is configurable per
          deployment. Supported formats are JPG/JPEG, PNG and WebP.
        </p>
      </Prose>
    </PageShell>
  );
}
