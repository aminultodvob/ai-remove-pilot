"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Download, Info, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";

import { ImagePreview } from "@/components/image-preview";
import { PlatformLabelNotice } from "@/components/privacy-badge";
import { Button } from "@/components/ui/button";
import { Badge, DataRow, Label } from "@/components/ui/primitives";
import { track } from "@/lib/analytics/events";
import { cn, formatBytes, formatDelta, formatDimensions } from "@/lib/utils";
import type { CleanReport } from "@/types/image";
import { CATEGORY_LABELS } from "@/types/image";

/**
 * The result screen: what changed, what did not, and the file itself.
 *
 * The "removed" list is derived from re-inspecting the *output* bytes, not from
 * a list of things the encoder was asked to drop. If a category is claimed
 * removed here, it is absent from the file the user is about to download.
 */

export function ResultPanel({
  report,
  originalPreviewUrl,
  cleanedPreviewUrl,
  downloadUrl,
  onReset,
}: {
  report: CleanReport;
  originalPreviewUrl: string;
  cleanedPreviewUrl: string;
  downloadUrl: string;
  onReset: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [showDetails, setShowDetails] = React.useState(false);

  const removed = report.metadataRemoved;
  const stillPresent = report.metadataRetained.filter((r) => r.category !== "color");
  // Re-encoding can legitimately grow a file; say so rather than let it puzzle.
  const grew = report.processedSize > report.originalSize * 1.02;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="grid gap-6 lg:grid-cols-[1.25fr_1fr]"
    >
      {/* Before / after ------------------------------------------------- */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="text-success size-5" />
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Your image is clean.</h2>
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Processed in {report.processingMs.toLocaleString()} ms. Compare the two below, then
          download.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Original</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatBytes(report.originalSize)}
              </span>
            </div>
            <ImagePreview
              src={originalPreviewUrl}
              alt="The image you uploaded"
              aspect="aspect-[4/3]"
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Clean</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatBytes(report.processedSize)}
              </span>
            </div>
            <ImagePreview
              src={cleanedPreviewUrl}
              alt="The cleaned image, ready to download"
              aspect="aspect-[4/3]"
            />
          </div>
        </div>

        {grew ? (
          <p className="border-border bg-muted text-muted-foreground mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            The clean file is larger than the original. Re-encoding at high quality with full colour
            resolution avoids adding visible compression damage, which costs bytes when the original
            was saved more aggressively. Lower the quality slider before cleaning if size matters
            more to you than fidelity.
          </p>
        ) : null}

        <p className="border-border bg-muted text-muted-foreground mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed">
          <Trash2 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Your uploaded image is not kept as a permanent file. It was processed in memory and the
          temporary processing data was released as soon as this response was sent.
        </p>
      </div>

      {/* Summary and actions --------------------------------------------- */}
      <div className="min-w-0">
        <div className="surface-card p-5">
          <Label>Clean result</Label>

          <ul className="mt-3 space-y-1.5">
            {removed.length === 0 ? (
              <li className="border-border bg-background text-muted-foreground rounded-lg border px-3 py-2 text-sm">
                No removable metadata was present. The image was re-encoded so nothing unrecognised
                could ride along.
              </li>
            ) : (
              removed.map((category) => (
                <li
                  key={category}
                  className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <span className="truncate text-sm font-medium">{CATEGORY_LABELS[category]}</span>
                  <Badge tone="success">Removed</Badge>
                </li>
              ))
            )}

            <li className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="truncate text-sm font-medium">Visual pixels</span>
              <Badge tone="neutral">
                {report.losslessReencode ? "Preserved losslessly" : "Preserved"}
              </Badge>
            </li>
          </ul>

          {stillPresent.length > 0 ? (
            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Still present: {stillPresent.map((r) => CATEGORY_LABELS[r.category]).join(", ")}. See
              technical details for why.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                track("download_clicked", { format: report.format });
                const anchor = document.createElement("a");
                anchor.href = downloadUrl;
                anchor.download = report.filename;
                anchor.click();
              }}
            >
              <Download aria-hidden />
              Download Clean Image
            </Button>
            <Button variant="secondary" size="lg" className="w-full" onClick={onReset}>
              <RotateCcw aria-hidden />
              Clean Another Image
            </Button>
          </div>

          <PlatformLabelNotice className="border-border mt-4 border-t pt-4" />
        </div>

        {/* Technical details ---------------------------------------------- */}
        <div className="surface-card mt-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            aria-controls="technical-details"
            className="hover:bg-muted flex min-h-11 w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-medium"
          >
            View technical details
            <ChevronDown
              aria-hidden
              className={cn("size-4 transition-transform", showDetails && "rotate-180")}
            />
          </button>

          <div
            id="technical-details"
            hidden={!showDetails}
            className="border-border border-t px-5 py-2"
          >
            <DataRow label="Output format" value={report.format.toUpperCase()} />
            <DataRow label="Dimensions" value={formatDimensions(report.width, report.height)} />
            <DataRow
              label="File size"
              value={
                <>
                  {formatBytes(report.originalSize)} → {formatBytes(report.processedSize)}{" "}
                  <span className="text-muted-foreground">
                    ({formatDelta(report.originalSize, report.processedSize)})
                  </span>
                </>
              }
            />
            <DataRow
              label="Metadata bytes"
              value={`${formatBytes(report.metadataBytesBefore)} → ${formatBytes(report.metadataBytesAfter)}`}
            />
            <DataRow
              label="Re-encode"
              value={report.losslessReencode ? "Lossless" : `Quality-based`}
            />
            <DataRow
              label="Orientation"
              value={report.orientationApplied ? "Baked into pixels" : "No rotation tag"}
            />
            <DataRow
              label="Detected"
              value={
                report.metadataDetected.length
                  ? report.metadataDetected.map((c) => CATEGORY_LABELS[c]).join(", ")
                  : "none"
              }
            />

            {report.metadataRetained.length > 0 ? (
              <div className="py-3">
                <Label>Retained, and why</Label>
                <ul className="mt-2 space-y-2">
                  {report.metadataRetained.map((item) => (
                    <li
                      key={item.category}
                      className="text-muted-foreground text-xs leading-relaxed"
                    >
                      <span className="text-foreground font-medium">
                        {CATEGORY_LABELS[item.category]}
                      </span>{" "}
                      — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
