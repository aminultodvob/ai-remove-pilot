import { ChevronDown } from "lucide-react";

import type { FaqItem } from "@/lib/content/faq";
import { cn } from "@/lib/utils";

/**
 * Built on `<details>` / `<summary>`.
 *
 * Native disclosure is keyboard-operable, announced correctly by screen
 * readers and works before any JavaScript loads — which for a static content
 * list is strictly better than re-implementing it with state.
 */
export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div
      className={cn(
        "divide-border border-border bg-surface divide-y overflow-hidden rounded-xl border",
        className,
      )}
    >
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="hover:bg-muted flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown
              aria-hidden
              className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="text-muted-foreground px-5 pb-5 text-sm leading-relaxed text-pretty">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
