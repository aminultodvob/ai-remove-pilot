import { publicConfig } from "@/lib/config";

/**
 * Event-only analytics.
 *
 * The allowed event names are enumerated below and the payload type permits
 * nothing but a handful of scalars, so there is no shape in which an image, a
 * filename, a metadata value or a hash could be sent even by accident.
 *
 * Nothing is transmitted unless NEXT_PUBLIC_ENABLE_ANALYTICS is true and a sink
 * has been wired up; by default this is an inert function.
 */

export type AnalyticsEvent =
  | "upload_started"
  | "upload_success"
  | "upload_rejected"
  | "processing_started"
  | "processing_success"
  | "processing_failed"
  | "download_clicked";

/** Deliberately narrow: sizes, durations, formats and error codes only. */
export interface AnalyticsProps {
  format?: "jpeg" | "png" | "webp";
  errorCode?: string;
  /** Rounded to the nearest 100 KB so it cannot fingerprint a specific file. */
  sizeBucketKb?: number;
  durationMs?: number;
}

type Sink = (event: AnalyticsEvent, props: AnalyticsProps) => void;

let sink: Sink | null = null;

/** Register a destination. Left unset in the default build. */
export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  if (!publicConfig.analyticsEnabled || !sink) return;
  try {
    sink(event, props);
  } catch {
    // Analytics must never break the tool.
  }
}

/** Coarsen a byte count into a bucket safe to report. */
export function sizeBucket(bytes: number): number {
  return Math.round(bytes / 102_400) * 100;
}
