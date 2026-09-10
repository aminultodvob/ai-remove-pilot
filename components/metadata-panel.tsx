"use client";

import { Check, Info, MapPin } from "lucide-react";
import * as React from "react";

import { Badge, Label } from "@/components/ui/primitives";
import { formatBytes, formatDimensions } from "@/lib/utils";
import type { ImageInspection, MetadataCategory } from "@/types/image";
import { CATEGORY_DESCRIPTIONS, CATEGORY_LABELS } from "@/types/image";

/**
 * The metadata report.
 *
 * Presence only, never values. "Location metadata detected" is the most this
 * panel will ever say about a GPS block — a privacy tool that prints your
 * coordinates back at you on a shared screen has defeated itself.
 */

const FORMAT_LABELS: Record<string, string> = { jpeg: "JPEG", png: "PNG", webp: "WebP" };

export function MetadataPanel({
  inspection,
  fileSize,
  className,
}: {
  inspection: ImageInspection;
  fileSize: number;
  className?: string;
}) {
  const privacyCategories = inspection.categories.filter((c) => c !== "color" && c !== "other");

  return (
    <div className={className}>
      <Label>Image information</Label>
      <dl className="mt-3 grid grid-cols-2 gap-x-4">
        <Field label="Format" value={FORMAT_LABELS[inspection.format ?? ""] ?? "—"} />
        <Field label="File size" value={formatBytes(fileSize)} />
        <Field
          label="Dimensions"
          value={formatDimensions(inspection.width, inspection.height)}
          className="col-span-2"
        />
      </dl>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <Label>Metadata detected</Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {inspection.metadataBytes > 0 ? formatBytes(inspection.metadataBytes) : "none"}
          </span>
        </div>

        {inspection.categories.length === 0 ? (
          <p className="border-border bg-muted text-muted-foreground mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
            <Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
            No embedded metadata found in this file. Cleaning will still re-encode it to remove
            anything the scanner does not recognise.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {inspection.categories.map((category, index) => (
              <li
                key={category}
                className="animate-row-in"
                // Staggered purely with a delay, so a skipped animation still
                // leaves every row visible.
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <CategoryRow category={category} />
              </li>
            ))}
          </ul>
        )}

        {privacyCategories.includes("gps") ? (
          <p className="border-border bg-muted text-muted-foreground mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
            <MapPin aria-hidden className="text-warning mt-0.5 size-3.5 shrink-0" />
            This image carries location metadata. The coordinates are not read or displayed here —
            only their presence is reported.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CategoryRow({ category }: { category: MetadataCategory }) {
  const isColor = category === "color";
  return (
    <div className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{CATEGORY_LABELS[category]}</span>
        <span
          title={CATEGORY_DESCRIPTIONS[category]}
          className="text-muted-foreground hidden shrink-0 sm:block"
        >
          <Info aria-hidden className="size-3.5" />
          <span className="sr-only">{CATEGORY_DESCRIPTIONS[category]}</span>
        </span>
      </span>
      <Badge tone={isColor ? "neutral" : "warning"}>{isColor ? "Preserved" : "Detected"}</Badge>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label-technical">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
