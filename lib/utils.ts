import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 3.81 MB / 812.4 KB / 900 B */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Signed percentage change, e.g. "−12.4%" or "+0.8%". */
export function formatDelta(from: number, to: number): string {
  if (from <= 0) return "—";
  const pct = ((to - from) / from) * 100;
  if (Math.abs(pct) < 0.05) return "no change";
  const sign = pct < 0 ? "−" : "+";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

export function formatDimensions(width: number | null, height: number | null): string {
  if (!width || !height) return "—";
  return `${width.toLocaleString()} × ${height.toLocaleString()}`;
}
