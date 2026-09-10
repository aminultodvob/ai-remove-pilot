"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ImageUp, Lock, Upload } from "lucide-react";
import * as React from "react";

import { PrivacyBadge } from "@/components/privacy-badge";
import { publicConfig } from "@/lib/config";
import { SUPPORTED_MIME_TYPES } from "@/types/image";
import { cn } from "@/lib/utils";

/**
 * The drop target.
 *
 * Three ways in, all equal citizens: drag and drop, the file picker (which is
 * also what keyboard and screen-reader users get, since the visible card is a
 * label for a real `<input type="file">`), and paste from the clipboard.
 */

export function UploadZone({
  onFile,
  disabled = false,
  compact = false,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const reduceMotion = useReducedMotion();
  // Drag events fire for every child element, so nesting is counted rather
  // than toggled — otherwise the highlight flickers as the pointer moves.
  const dragDepth = React.useRef(0);

  const accept = SUPPORTED_MIME_TYPES.join(",");

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file && !disabled) onFile(file);
    },
    [disabled, onFile],
  );

  // Paste is a first-class path: screenshots rarely exist as files on disk.
  React.useEffect(() => {
    if (disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) {
        event.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, onFile]);

  return (
    <div className="w-full">
      <motion.div
        initial={false}
        animate={reduceMotion ? undefined : { scale: dragging ? 1.008 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative rounded-2xl border-2 border-dashed transition-colors duration-150",
          dragging
            ? "border-accent bg-accent-soft"
            : "border-border bg-surface hover:border-border-strong",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          id="upload-input"
          type="file"
          accept={accept}
          // `capture` is intentionally omitted: on mobile this lets the user
          // pick between the camera and their existing library.
          // `peer` lets the visible card show the focus ring on the input's
          // behalf: the input itself is off-screen, so a ring on it would be
          // invisible and keyboard users would lose their place.
          className="peer sr-only"
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            // Reset so choosing the same file twice still fires a change.
            e.target.value = "";
          }}
        />

        <label
          htmlFor="upload-input"
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center px-6 text-center",
            "peer-focus-visible:outline-accent rounded-2xl peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4",
            compact ? "py-8" : "py-10 sm:py-14",
          )}
        >
          <span
            className={cn(
              "border-border bg-background flex items-center justify-center rounded-2xl border transition-colors",
              compact ? "size-12" : "size-16",
              dragging && "border-accent text-accent",
            )}
          >
            {dragging ? (
              <ImageUp aria-hidden className={compact ? "size-5" : "size-7"} />
            ) : (
              <Upload
                aria-hidden
                className={cn(
                  "text-muted-foreground group-hover:text-foreground transition-colors",
                  compact ? "size-5" : "size-7",
                )}
              />
            )}
          </span>

          <span
            className={cn(
              "mt-5 font-semibold tracking-tight",
              compact ? "text-base" : "text-lg sm:text-xl",
            )}
          >
            {dragging ? "Drop to load the image" : "Drop an image here"}
          </span>
          <span className="text-muted-foreground mt-1.5 text-sm">
            or{" "}
            <span className="text-accent font-medium underline underline-offset-4">
              choose a file
            </span>
            <span className="hidden sm:inline"> · or paste from your clipboard</span>
          </span>

          <span className="label-technical mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <span>JPG · PNG · WEBP</span>
            <span aria-hidden className="text-border-strong">
              |
            </span>
            <span>Max {publicConfig.maxUploadMb} MB</span>
          </span>
        </label>

        {/* Reassurance sits inside the card, where the decision is made. */}
        <div className="border-border flex flex-wrap items-center justify-center gap-2 border-t px-4 py-3">
          <PrivacyBadge icon={Lock} label="Processed temporarily" />
          <PrivacyBadge label="Not permanently stored" />
          <PrivacyBadge label="No account needed" />
        </div>
      </motion.div>
    </div>
  );
}
