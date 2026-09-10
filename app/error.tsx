"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. It deliberately does not print the error message:
 * there is nothing actionable in it for a visitor, and this product's failure
 * copy should always answer the question a user of a privacy tool actually has.
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-24 text-center sm:py-32">
      <span className="bg-danger-soft text-danger flex size-11 items-center justify-center rounded-xl">
        <AlertTriangle aria-hidden className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        This page failed to load. No image was stored, and nothing you uploaded was kept.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
