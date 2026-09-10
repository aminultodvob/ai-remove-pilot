import Link from "next/link";

import { Logo } from "@/components/logo";

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/#tool", label: "Clean an image" },
      { href: "/how-it-works", label: "How It Works" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/faq", label: "FAQ" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-border bg-surface border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <Logo className="size-7" />
            AI Remove Pilot
          </div>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Private image cleaning, without the permanent upload.
          </p>
        </div>

        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="label-technical">{group.title}</h2>
            <ul className="mt-3 space-y-1">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-5 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 AI Remove Pilot</p>
          <p className="max-w-xl text-pretty">
            Cleaning metadata does not control how a third-party platform classifies an image.
          </p>
        </div>
      </div>
    </footer>
  );
}
