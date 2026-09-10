import { ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** A single reassurance chip. Icon defaults to the shield mark. */
export function PrivacyBadge({
  label,
  icon: Icon = ShieldCheck,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Icon aria-hidden className="text-success size-3.5" />
      {label}
    </span>
  );
}

/**
 * The product's central honesty statement.
 *
 * It appears wherever a user might reasonably form the wrong expectation, and
 * the wording is deliberately unhedged: this tool cleans what is embedded in a
 * file, and that is a different thing from controlling what a platform decides
 * about an image.
 */
export function PlatformLabelNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground text-xs leading-relaxed text-pretty", className)}>
      AI Remove Pilot cleans embedded image metadata and supported provenance information. Social
      platforms may use additional signals to determine whether an image is AI-generated, so
      cleaning an image does not guarantee removal of an AI-generated-content label.
    </p>
  );
}
