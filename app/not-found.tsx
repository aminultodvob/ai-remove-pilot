import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-24 text-center sm:py-32">
      <span className="label-technical">404</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        That page isn&apos;t here
      </h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        The link may be out of date. The tool itself is one click away.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link href="/#tool" className={cn(buttonVariants())}>
          Clean an image
        </Link>
        <Link href="/faq" className={cn(buttonVariants({ variant: "secondary" }))}>
          Read the FAQ
        </Link>
      </div>
    </div>
  );
}
