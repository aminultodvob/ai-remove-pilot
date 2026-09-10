import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("surface-card p-5", className)}>
      <span className="bg-accent-soft text-accent flex size-9 items-center justify-center rounded-lg">
        <Icon aria-hidden className="size-[18px]" />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
        {description}
      </p>
    </div>
  );
}

/** A numbered step, used by the How It Works sequence. */
export function StepCard({
  step,
  title,
  description,
  className,
}: {
  step: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="text-accent font-mono text-xs font-medium">{step}</span>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed text-pretty">
        {description}
      </p>
    </div>
  );
}
