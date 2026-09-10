"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, RotateCcw, Sparkles, X } from "lucide-react";
import * as React from "react";

import { ImagePreview } from "@/components/image-preview";
import { MetadataPanel } from "@/components/metadata-panel";
import { PlatformLabelNotice } from "@/components/privacy-badge";
import { ProcessingStatus, type Stage } from "@/components/processing-status";
import { ResultPanel } from "@/components/result-panel";
import { UploadZone } from "@/components/upload-zone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/primitives";
import { sizeBucket, track } from "@/lib/analytics/events";
import { inspectImage } from "@/lib/image/metadata";
import { ERROR_MESSAGES } from "@/lib/image/errors";
import { validateFileMeta } from "@/lib/image/validation";
import { cn, formatBytes } from "@/lib/utils";
import type { CleanErrorCode, CleanReport, ImageInspection } from "@/types/image";
import { DEFAULT_CLEAN_OPTIONS } from "@/types/image";

/**
 * The tool.
 *
 * Everything before the user presses "Clean Image" happens locally: the file is
 * read into an ArrayBuffer, inspected by the same parser the server uses, and
 * previewed from an object URL. No request is made and no byte leaves the
 * browser until the user asks for it.
 */

type Phase = "idle" | "inspecting" | "ready" | "processing" | "done" | "error";

interface Loaded {
  file: File;
  previewUrl: string;
  inspection: ImageInspection;
}

interface Failure {
  code: CleanErrorCode;
  message: string;
}

/**
 * Best reason we can give when the response body is not ours to read.
 *
 * Hosting platforms enforce their own body-size and duration limits in front of
 * the application, and they answer with an HTML error page rather than the
 * JSON shape the route returns.
 */
function statusFallback(status: number): CleanErrorCode {
  if (status === 413) return "too_large";
  if (status === 429) return "rate_limited";
  if (status === 504 || status === 408) return "timeout";
  return "server_error";
}

export function ImageWorkspace() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [failure, setFailure] = React.useState<Failure | null>(null);
  const [uploadPct, setUploadPct] = React.useState(0);
  const [serverWorking, setServerWorking] = React.useState(false);
  const [result, setResult] = React.useState<{
    report: CleanReport;
    url: string;
  } | null>(null);
  const [quality, setQuality] = React.useState(DEFAULT_CLEAN_OPTIONS.quality);

  const requestRef = React.useRef<XMLHttpRequest | null>(null);
  // Every object URL we mint, so none is left allocated when the view changes.
  const urlsRef = React.useRef<Set<string>>(new Set());

  const mintUrl = React.useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);

  const revokeAll = React.useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  }, []);

  React.useEffect(() => () => revokeAll(), [revokeAll]);

  const reset = React.useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    revokeAll();
    setLoaded(null);
    setResult(null);
    setFailure(null);
    setUploadPct(0);
    setServerWorking(false);
    setPhase("idle");
  }, [revokeAll]);

  /* ---------------------------------------------------------------- */
  /* Local load and inspection                                         */
  /* ---------------------------------------------------------------- */

  const handleFile = React.useCallback(
    async (file: File) => {
      revokeAll();
      setResult(null);
      setFailure(null);
      setPhase("inspecting");
      track("upload_started", { sizeBucketKb: sizeBucket(file.size) });

      const metaFailure = validateFileMeta(file);
      if (metaFailure) {
        track("upload_rejected", { errorCode: metaFailure.code });
        setFailure(metaFailure);
        setPhase("error");
        return;
      }

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const inspection = inspectImage(bytes);

        // The magic bytes are the authority, not the extension the OS gave it.
        if (!inspection.format) {
          track("upload_rejected", { errorCode: "unsupported_type" });
          setFailure({ code: "unsupported_type", message: ERROR_MESSAGES.unsupported_type });
          setPhase("error");
          return;
        }

        setLoaded({ file, previewUrl: mintUrl(file), inspection });
        setPhase("ready");
        track("upload_success", { format: inspection.format, sizeBucketKb: sizeBucket(file.size) });
      } catch {
        setFailure({ code: "corrupt_image", message: ERROR_MESSAGES.corrupt_image });
        setPhase("error");
      }
    },
    [mintUrl, revokeAll],
  );

  /* ---------------------------------------------------------------- */
  /* Cleaning                                                          */
  /* ---------------------------------------------------------------- */

  const clean = React.useCallback(() => {
    if (!loaded) return;
    setPhase("processing");
    setFailure(null);
    setUploadPct(0);
    setServerWorking(false);
    const startedAt = performance.now();
    track("processing_started", { format: loaded.inspection.format ?? undefined });

    const body = new FormData();
    body.append("file", loaded.file, loaded.file.name);
    body.append("quality", String(quality));
    body.append("applyOrientation", String(DEFAULT_CLEAN_OPTIONS.applyOrientation));
    body.append("colorProfile", DEFAULT_CLEAN_OPTIONS.colorProfile);

    const xhr = new XMLHttpRequest();
    requestRef.current = xhr;
    xhr.open("POST", "/api/process");
    xhr.responseType = "blob";
    xhr.timeout = 120_000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      setUploadPct(pct);
      // Past this point the browser is waiting on the server, which does not
      // report intermediate progress.
      if (pct >= 100) setServerWorking(true);
    };

    const fail = (code: CleanErrorCode, message?: string) => {
      track("processing_failed", { errorCode: code });
      setFailure({ code, message: message ?? ERROR_MESSAGES[code] });
      setPhase("error");
      requestRef.current = null;
    };

    xhr.onerror = () =>
      fail(
        "server_error",
        "The request couldn't reach the server. Check your connection and try again.",
      );
    xhr.ontimeout = () => fail("timeout");
    xhr.onabort = () => {
      // A user-initiated cancel is not an error state.
      requestRef.current = null;
    };

    xhr.onload = async () => {
      requestRef.current = null;
      const blob = xhr.response as Blob;

      if (xhr.status !== 200) {
        try {
          const parsed = JSON.parse(await blob.text()) as { code?: CleanErrorCode; error?: string };
          fail(parsed.code ?? "server_error", parsed.error);
        } catch {
          // Not our JSON. A host's proxy can reject a request before it ever
          // reaches the route — most often an oversized body — and it answers
          // with its own HTML error page. The status is then the only thing we
          // can read, so translate it rather than saying "something went wrong".
          fail(statusFallback(xhr.status));
        }
        return;
      }

      const header = xhr.getResponseHeader("X-Clean-Report");
      if (!header) return fail("server_error");

      let report: CleanReport;
      try {
        const raw = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
        report = JSON.parse(new TextDecoder().decode(raw)) as CleanReport;
      } catch {
        return fail("server_error");
      }

      setResult({ report, url: mintUrl(blob) });
      setPhase("done");
      track("processing_success", {
        format: report.format,
        durationMs: Math.round(performance.now() - startedAt),
      });
    };

    xhr.send(body);
  }, [loaded, mintUrl, quality]);

  const cancel = React.useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setPhase("ready");
    setUploadPct(0);
    setServerWorking(false);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  const stages: Stage[] = React.useMemo(() => {
    const uploading = uploadPct < 100;
    return [
      { id: "read", label: "Image read in your browser", state: "done" },
      { id: "validated", label: "Format and size validated", state: "done" },
      {
        id: "uploaded",
        label: "Sending to the processor",
        state: uploading ? "active" : "done",
        progress: uploading ? uploadPct : undefined,
      },
      {
        id: "cleaning",
        label: "Cleaning metadata and re-encoding",
        state: serverWorking ? "active" : "pending",
      },
      { id: "finalizing", label: "Returning your file", state: "pending" },
    ];
  }, [serverWorking, uploadPct]);

  /*
   * Exactly one view is live at a time, and it is resolved here rather than as
   * a chain of conditionals in the JSX. AnimatePresence in "wait" mode needs a
   * single keyed child — handing it a list with nulls in it leaves the incoming
   * panel stuck mid-transition.
   */
  const view: { key: string; node: React.ReactNode } = (() => {
    if (loaded && phase === "done" && result) {
      return {
        key: "done",
        node: (
          <ResultPanel
            report={result.report}
            originalPreviewUrl={loaded.previewUrl}
            cleanedPreviewUrl={result.url}
            downloadUrl={result.url}
            onReset={reset}
          />
        ),
      };
    }

    if (loaded) {
      return {
        key: "workspace",
        node: (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label>Original image</Label>
                <button
                  type="button"
                  onClick={reset}
                  className="text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs"
                >
                  <X aria-hidden className="size-3.5" />
                  Remove
                </button>
              </div>
              <ImagePreview
                src={loaded.previewUrl}
                alt="Preview of the image you selected"
                caption={`${loaded.file.name} · ${formatBytes(loaded.file.size)} · never uploaded until you press Clean`}
              />
            </div>

            <div className="min-w-0">
              <div className="surface-card p-5">
                {phase === "processing" ? (
                  <>
                    <h2 className="text-lg font-semibold tracking-tight">Cleaning your image…</h2>
                    <ProcessingStatus stages={stages} className="mt-4" />
                    <Button variant="secondary" className="mt-5 w-full" onClick={cancel}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <MetadataPanel inspection={loaded.inspection} fileSize={loaded.file.size} />

                    {failure ? <ErrorCard failure={failure} className="mt-5" compact /> : null}

                    {loaded.inspection.lossless ? (
                      <p className="border-border bg-muted text-muted-foreground mt-5 rounded-lg border px-3 py-2 text-xs leading-relaxed">
                        This format is lossless, so the pixels are re-encoded without any quality
                        setting to choose.
                      </p>
                    ) : (
                      <QualityControl value={quality} onChange={setQuality} className="mt-5" />
                    )}

                    <Button size="lg" className="mt-5 w-full" onClick={clean}>
                      <Sparkles aria-hidden />
                      {failure ? "Try Again" : "Clean Image"}
                    </Button>

                    <PlatformLabelNotice className="border-border mt-4 border-t pt-4" />
                  </>
                )}
              </div>
            </div>
          </div>
        ),
      };
    }

    // Failed before a file could even be loaded: explain, then offer the zone again.
    if (phase === "error") {
      return {
        key: "error-empty",
        node: (
          <>
            <ErrorCard failure={failure} onRetry={reset} />
            <div className="mt-4">
              <UploadZone onFile={handleFile} compact />
            </div>
          </>
        ),
      };
    }

    return {
      key: "idle",
      node: (
        <>
          <UploadZone onFile={handleFile} disabled={phase === "inspecting"} />
          {phase === "inspecting" ? (
            <p role="status" className="text-muted-foreground mt-3 text-center text-sm">
              Reading the file in your browser…
            </p>
          ) : null}
        </>
      ),
    };
  })();

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        <Panel key={view.key}>{view.node}</Panel>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

function ErrorCard({
  failure,
  onRetry,
  className,
  compact = false,
}: {
  failure: Failure | null;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  if (!failure) return null;
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/40 bg-danger-soft rounded-xl border px-4 py-3",
        compact ? "" : "sm:px-5 sm:py-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle aria-hidden className="text-danger mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-foreground text-sm font-medium">{failure.message}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Nothing was stored. You can pick a different image or try the same one again.
          </p>
          {onRetry ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              <RotateCcw aria-hidden />
              Start over
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Quality is only meaningful for the lossy encoders, so it is hidden otherwise. */
function QualityControl({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="quality" className="label-technical">
          Re-encode quality
        </label>
        <span className="text-xs font-medium tabular-nums">{value}</span>
      </div>
      <input
        id="quality"
        type="range"
        min={60}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-muted accent-accent mt-2 h-2 w-full cursor-pointer appearance-none rounded-full"
        aria-describedby="quality-help"
      />
      <p id="quality-help" className="text-muted-foreground mt-1.5 text-xs">
        92 keeps the image visually equivalent to the original. Higher values grow the file without
        a visible gain.
      </p>
    </div>
  );
}
