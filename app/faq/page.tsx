import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/faq-accordion";
import { PageShell, Prose } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { FAQ } from "@/lib/content/faq";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about image storage, metadata removal, quality, platform AI labels and supported formats in AI Remove Pilot.",
  alternates: { canonical: "/faq" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageShell
        eyebrow="FAQ"
        title="Questions worth asking a privacy tool"
        intro="Including the one where the answer is no."
      >
        <FaqAccordion items={FAQ} />

        <Prose heading="Still deciding?">
          <p>
            The <Link href="/how-it-works">How It Works</Link> page walks through the pipeline step
            by step, and the <Link href="/privacy">Privacy</Link> page describes exactly what is and
            is not kept.
          </p>
          <div className="pt-2">
            <Link href="/#tool" className={cn(buttonVariants())}>
              Clean an image
            </Link>
          </div>
        </Prose>
      </PageShell>
    </>
  );
}
