import { cn } from "@/lib/utils";

const STEPS = [
  { name: "Validate", detail: "Magic bytes, size, dimensions" },
  { name: "Inspect", detail: "Which segments exist" },
  { name: "Clean", detail: "Discard every auxiliary block" },
  { name: "Re-encode", detail: "Pixels back out" },
  { name: "Return", detail: "Straight to your browser" },
  { name: "Release", detail: "Buffers zeroed and dropped" },
];

/**
 * The pipeline, stated as the sequence it actually is. Each label maps to a
 * real stage in `lib/image/processor.ts` — this is documentation, not decoration.
 */
export function PipelineVisual({ className }: { className?: string }) {
  return (
    <div className={cn("surface-card overflow-hidden", className)}>
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
        <span className="label-technical">Image pipeline</span>
        <span className="label-technical">In memory · no disk</span>
      </div>

      <ol className="divide-border flex flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0">
        {STEPS.map((step, index) => (
          <li key={step.name} className="flex-1 px-4 py-3.5 sm:px-3.5">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[10px]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium">{step.name}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-snug">{step.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
