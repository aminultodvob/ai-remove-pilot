"use client";

/* eslint-disable @next/next/no-img-element */

import { Check, Minus } from "lucide-react";
import * as React from "react";

import { Badge, Label } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * The worked example.
 *
 * There is no image-comparison slider here, and that is the point being made:
 * cleaning does not change what the picture looks like, so a pixel slider would
 * show two identical halves and imply something happened that didn't. What
 * changes is the metadata, so that is what gets compared.
 *
 * The sample is a synthetic image generated for this page. It is not anyone's
 * photograph, and the listed tags describe a typical phone capture rather than
 * a real one.
 */

const SAMPLE = [
  { label: "EXIF", note: "Tag block, 6.2 KB" },
  { label: "Location", note: "GPS coordinates" },
  { label: "Camera / device", note: "Make, model, lens, serial" },
  { label: "Software", note: "Editor and version" },
  { label: "Date & time", note: "Capture timestamp" },
  { label: "Embedded thumbnail", note: "Second copy of the image" },
];

export function BeforeAfter({ className }: { className?: string }) {
  const [view, setView] = React.useState<"before" | "after">("before");
  const isAfter = view === "after";

  return (
    <div className={cn("surface-card overflow-hidden", className)}>
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <span className="label-technical">Worked example</span>

        <div
          role="radiogroup"
          aria-label="Show metadata before or after cleaning"
          className="border-border bg-background inline-flex rounded-lg border p-0.5"
        >
          {(["before", "after"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => setView(value)}
              className={cn(
                "min-h-9 rounded-md px-3.5 text-xs font-medium capitalize transition-colors",
                view === value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <div>
          <img
            src="/demo-image.jpg"
            alt="A synthetic sample landscape used to demonstrate the cleaning report"
            width={900}
            height={600}
            loading="lazy"
            decoding="async"
            className="border-border w-full rounded-xl border"
          />
          <p className="text-muted-foreground mt-2 text-xs">
            The same pixels in both views. Cleaning removes what is attached to the file, not what
            is in the picture.
          </p>
        </div>

        <div>
          <Label>{isAfter ? "After cleaning" : "Before cleaning"}</Label>
          <ul className="mt-3 space-y-1.5">
            {SAMPLE.map((row) => (
              <li
                key={row.label}
                className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium transition-colors",
                      isAfter && "text-muted-foreground line-through",
                    )}
                  >
                    {row.label}
                  </span>
                  {!isAfter ? (
                    <span className="text-muted-foreground block truncate text-xs">{row.note}</span>
                  ) : null}
                </span>
                <Badge tone={isAfter ? "success" : "warning"}>
                  {isAfter ? (
                    <>
                      <Check aria-hidden className="size-3" /> Removed
                    </>
                  ) : (
                    <>
                      <Minus aria-hidden className="size-3" /> Detected
                    </>
                  )}
                </Badge>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
            {isAfter
              ? "Colour information is normalised to a standard sRGB profile rather than dropped, so the image renders identically."
              : "Values are never displayed — only the presence of each category is reported."}
          </p>
        </div>
      </div>
    </div>
  );
}
