import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ImageWorkspace } from "@/components/image-workspace";
import { buttonVariants } from "@/components/ui/button";
import { publicConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * The hero *is* the tool. The headline is deliberately short so the drop zone
 * stays above the fold on a laptop — a utility that makes you scroll to find
 * the utility has its priorities backwards.
 */
export function Hero() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-8 pb-4 sm:px-6 sm:pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <span className="border-border bg-surface label-technical inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
            <ShieldCheck aria-hidden className="text-success size-3.5" />
            Private by default
          </span>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Clean Your Images. Keep Your Privacy.
          </h1>

          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-base leading-relaxed text-pretty">
            Remove unnecessary image metadata and supported embedded provenance information in
            seconds. Your files aren&apos;t kept after processing.
          </p>

          <p className="label-technical mt-3">
            No account · No image library · No permanent uploads
          </p>
        </div>

        <div id="tool" className="mt-8 scroll-mt-24">
          <ImageWorkspace />
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#tool"
            className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:w-auto")}
          >
            Clean an Image
          </Link>
          <Link
            href="/how-it-works"
            className={cn(buttonVariants({ variant: "ghost" }), "w-full sm:w-auto")}
          >
            How It Works
            <ArrowRight aria-hidden />
          </Link>
        </div>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          JPG · PNG · WebP · up to {publicConfig.maxUploadMb} MB per image
        </p>
      </div>
    </div>
  );
}
