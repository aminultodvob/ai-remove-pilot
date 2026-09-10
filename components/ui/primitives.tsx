import * as React from "react";

import { cn } from "@/lib/utils";

/** Small shared building blocks. Kept together because none of them is big
 *  enough to deserve a file, and they are always used in combination. */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-border border-b px-5 py-4", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

/** The uppercase mono eyebrow used above section headings and on data keys. */
export function Label({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("label-technical", className)} {...props} />;
}

type BadgeTone = "neutral" | "accent" | "success" | "danger" | "warning";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  accent: "bg-accent-soft text-accent border-transparent",
  success: "bg-success-soft text-success border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  warning: "bg-muted text-warning border-border",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** A key/value row for technical detail lists. */
export function DataRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border flex items-baseline justify-between gap-4 border-b py-2 text-sm last:border-0",
        className,
      )}
    >
      <span className="label-technical shrink-0">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Page-level section wrapper: consistent max width and vertical rhythm. */
export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 sm:py-24", className)}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <Label>{eyebrow}</Label> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty">
          {description}
        </p>
      ) : null}
    </div>
  );
}
