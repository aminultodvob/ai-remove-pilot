"use client";

/* eslint-disable @next/next/no-img-element */

import { cn } from "@/lib/utils";

/**
 * Preview of a local image.
 *
 * A plain `<img>` is used on purpose. `next/image` optimises through a server
 * route, and the whole point of this screen is that the user's image has not
 * left their machine yet — the source here is always a `blob:` object URL.
 */
export function ImagePreview({
  src,
  alt,
  caption,
  className,
  aspect = "aspect-[4/3]",
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  aspect?: string;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div
        className={cn(
          "border-border bg-muted relative flex items-center justify-center overflow-hidden rounded-xl border",
          aspect,
        )}
      >
        {/* Checkerboard so transparent PNGs read as transparent rather than
            white. Kept very faint: for the opaque images that make up most
            uploads it should register as texture, not as a pattern competing
            with the photograph. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%), linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 8px 8px",
          }}
        />
        <img
          src={src}
          alt={alt}
          className="relative max-h-full max-w-full object-contain"
          decoding="async"
        />
      </div>
      {caption ? (
        <figcaption className="text-muted-foreground mt-2 text-xs">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
