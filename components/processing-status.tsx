"use client";

import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Live pipeline status.
 *
 * Each step reflects something that actually happened. Upload shows a real
 * percentage because the browser reports it; the server-side stage shows an
 * indeterminate bar because the server genuinely does not stream progress, and
 * inventing a moving number there would be a lie told to look reassuring.
 */

export type StageId = "read" | "validated" | "uploaded" | "cleaning" | "finalizing";

export interface Stage {
  id: StageId;
  label: string;
  state: "pending" | "active" | "done";
  /** 0-100 when a real measurement exists. */
  progress?: number;
}

export function ProcessingStatus({ stages, className }: { stages: Stage[]; className?: string }) {
  const active = stages.find((s) => s.state === "active");

  return (
    <div className={className}>
      {/* Screen readers get the current step announced, not the whole list. */}
      <p role="status" aria-live="polite" className="sr-only">
        {active ? `${active.label}${active.progress ? `, ${active.progress}%` : ""}` : "Finishing"}
      </p>

      <ol className="space-y-2.5">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                stage.state === "done" && "border-success bg-success text-white",
                stage.state === "active" && "border-accent text-accent",
                stage.state === "pending" && "border-border text-transparent",
              )}
            >
              {stage.state === "done" ? (
                <Check className="size-3" strokeWidth={3} />
              ) : stage.state === "active" ? (
                <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
              ) : (
                <span className="bg-border-strong size-1.5 rounded-full" />
              )}
            </span>

            <span
              className={cn(
                "text-sm",
                stage.state === "pending" ? "text-muted-foreground" : "text-foreground",
                stage.state === "active" && "font-medium",
              )}
            >
              {stage.label}
            </span>

            {stage.state === "active" && stage.progress !== undefined ? (
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {stage.progress}%
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <ProgressBar
        value={active?.progress}
        label={active?.label ?? "Processing"}
        className="mt-5"
      />
    </div>
  );
}

/** Determinate when a real value exists, indeterminate otherwise. */
function ProgressBar({
  value,
  label,
  className,
}: {
  value?: number;
  label: string;
  className?: string;
}) {
  const indeterminate = value === undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuetext={indeterminate ? "Working, time remaining unknown" : `${value}%`}
      className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "bg-accent h-full rounded-full transition-[width] duration-200",
          indeterminate && "w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite]",
        )}
        style={indeterminate ? undefined : { width: `${value}%` }}
      />
    </div>
  );
}
