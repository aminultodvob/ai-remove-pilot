"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#tool", label: "Tools" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/privacy", label: "Privacy" },
  { href: "/faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the mobile sheet, matching what a dialog would do.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-200",
        scrolled
          ? "border-border bg-background/85 backdrop-blur-md"
          : "bg-background border-transparent",
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-6"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md text-[15px] font-semibold tracking-tight"
        >
          <Logo className="size-7" />
          <span>AI Remove Pilot</span>
        </Link>

        <ul className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/#tool"
            className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
          >
            Upload Image
          </Link>
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-11 items-center justify-center rounded-lg md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-menu" className="border-border bg-background border-t md:hidden">
          <ul className="mx-auto max-w-6xl px-5 py-2 sm:px-6">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-center rounded-lg px-2 text-sm"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 py-3">
              <ThemeToggle />
              <Link
                href="/#tool"
                onClick={() => setOpen(false)}
                className="bg-accent text-accent-foreground inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium"
              >
                Upload Image
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
