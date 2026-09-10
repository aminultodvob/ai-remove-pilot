import type { Metadata } from "next";
import Link from "next/link";

import { List, PageShell, Prose } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for AI Remove Pilot, an image metadata cleaning utility.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms"
      title="Terms of use"
      intro="Plain-language terms for a small utility. This page describes the service; it is not legal advice, and it does not replace advice from a qualified professional about your own situation."
      updated="September 2026"
    >
      <Prose heading="What the service is">
        <p>
          AI Remove Pilot removes embedded metadata from an image and returns the re-encoded file.
          It is provided as a free utility, as-is, with no warranty of any kind.
        </p>
      </Prose>

      <Prose heading="Images you may process">
        <p>
          Only process images you own or otherwise have the right to process. You are responsible
          for the content you submit and for how you use the result. Do not use the service to
          process material that is unlawful to possess or distribute, or to strip attribution or
          rights-management information from someone else&apos;s work in order to misrepresent its
          authorship.
        </p>
      </Prose>

      <Prose heading="Acceptable use">
        <List
          items={[
            "Do not attempt to disrupt the service, exhaust its capacity, or bypass its rate limits.",
            "Do not attempt to exploit the image decoder, submit deliberately malformed files as attacks, or probe the host it runs on.",
            "Do not use the service to misrepresent the origin or authorship of an image.",
            "Automated use should respect the published rate limits.",
          ]}
        />
      </Prose>

      <Prose heading="No guarantee about third-party platforms">
        <p>
          The service cleans data embedded in an image file. It has no influence over how any
          third-party platform, network or service classifies, labels or discloses an image. In
          particular, we make <strong>no guarantee</strong> that cleaning an image will remove,
          prevent or affect an AI-generated-content label applied by any platform. Platforms may use
          signals unrelated to file metadata, including their own records and their own classifiers.
        </p>
      </Prose>

      <Prose heading="Limitations of the processing">
        <List
          items={[
            "Metadata removal covers the formats and segment types the tool supports. A container may hold structures the parser does not recognise; re-encoding from decoded pixels is what causes those to be dropped rather than a guarantee that each one was identified.",
            "JPEG and lossy WebP are re-compressed. The result is visually equivalent, not bit-identical.",
            "The service does not fabricate metadata, forge provenance credentials, or alter pixels to influence classifiers.",
          ]}
        />
      </Prose>

      <Prose heading="Temporary processing">
        <p>
          Images are processed in memory and are not stored. See the{" "}
          <Link href="/privacy">Privacy</Link> page for the details of what that means in practice.
          Because nothing is retained, we cannot recover a processed image for you afterwards — keep
          your original until you are satisfied with the result.
        </p>
      </Prose>

      <Prose heading="Availability">
        <p>
          Availability is not guaranteed. The service may be slow, rate limited, interrupted or
          withdrawn at any time, with or without notice, including for maintenance or capacity
          reasons.
        </p>
      </Prose>

      <Prose heading="Liability">
        <p>
          To the fullest extent permitted by applicable law, the service is provided without
          warranties of any kind, express or implied, and the operator is not liable for any loss or
          damage arising from its use — including loss of image data, loss of image quality, or any
          consequence of an image being labelled, classified or handled in a particular way by a
          third party. Some jurisdictions do not allow certain exclusions, in which case the
          narrowest permitted exclusion applies.
        </p>
      </Prose>

      <Prose heading="Changes">
        <p>
          These terms may change as the service changes. The date at the top of this page reflects
          the current version.
        </p>
      </Prose>
    </PageShell>
  );
}
