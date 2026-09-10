import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared header + measure for the content pages, so they read as one set. */
export function PageShell({
  eyebrow,
  title,
  intro,
  children,
  updated,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  updated?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
      <span className="label-technical">{eyebrow}</span>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      {intro ? (
        <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty sm:text-lg">
          {intro}
        </p>
      ) : null}
      {updated ? <p className="label-technical mt-4">Last updated {updated}</p> : null}
      <div className="mt-10 space-y-10">{children}</div>
    </div>
  );
}

export function Prose({
  heading,
  children,
  className,
}: {
  heading: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("scroll-mt-24", className)}>
      <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{heading}</h2>
      <div className="text-muted-foreground [&_a]:text-accent [&_strong]:text-foreground mt-3 space-y-3 text-[15px] leading-relaxed text-pretty [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-medium">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list with the product's spacing, used inside `Prose`. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span aria-hidden className="bg-border-strong mt-2 size-1 shrink-0 rounded-full" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}
