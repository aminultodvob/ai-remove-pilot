import { cn } from "@/lib/utils";

/**
 * The mark: an image frame with its metadata block lifted out.
 * Drawn with `currentColor` and the accent token so it works in both themes and
 * inherits size from the caller.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("text-accent", className)}
    >
      <rect
        x="2.5"
        y="5.5"
        width="27"
        height="21"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.85"
      />
      {/* The horizon of the "photo" that stays. */}
      <path
        d="M4 22.5 11.2 15a2.2 2.2 0 0 1 3.1 0L18 18.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* The tag block being removed. */}
      <rect x="18.5" y="9.5" width="8" height="2.4" rx="1.2" fill="currentColor" />
      <rect
        x="18.5"
        y="13.4"
        width="5.2"
        height="2.4"
        rx="1.2"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  );
}
