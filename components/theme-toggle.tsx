"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Theme control with three states, because "follow my system" is a real
 * preference and collapsing it into a light/dark switch loses it.
 *
 * localStorage is the source of truth and is read through
 * `useSyncExternalStore`, which is what that hook is for: the value lives
 * outside React, can change in another tab, and must not be read during the
 * server render. The server snapshot is `null`, so nothing is marked selected
 * until the browser has told us what the real value is — a guess there would
 * show the wrong option highlighted for a frame.
 */

export const THEME_STORAGE_KEY = "arp-theme";
type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** Fires when this tab changes the theme; `storage` covers the other tabs. */
const CHANGE_EVENT = "arp-theme-change";

function readStored(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Private mode or blocked storage: fall back to following the OS.
  }
  return "system";
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" || (theme === "system" && prefersDark),
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = React.useSyncExternalStore<Theme | null>(subscribe, readStored, () => null);

  // While "system" is selected, an OS-level change has to repaint the page.
  React.useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const select = React.useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the class change below still applies.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "border-border bg-surface inline-flex items-center gap-0.5 rounded-full border p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => select(value)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Runs before first paint to avoid a flash of the wrong theme. Inlined as a
 * string because it has to execute ahead of React hydration.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k)||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
