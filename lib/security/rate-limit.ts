import { serverConfig } from "@/lib/config";

/**
 * Fixed-window rate limiting, held in process memory.
 *
 * This is deliberately the simplest thing that works for a single-instance or
 * small-fleet deployment: no database, no Redis, nothing that would need to
 * store a record about a visitor. The trade-off is that the window is per
 * instance, so a horizontally scaled deployment enforces N times the configured
 * limit in aggregate. If that matters, put a shared limiter at the edge — see
 * the deployment notes in the README.
 *
 * The key is a truncated hash of the client IP, never the IP itself, and
 * entries evict as soon as their window closes.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Cheap non-cryptographic hash. Enough to avoid holding raw addresses. */
function keyFor(ip: string): string {
  let h = 2166136261;
  for (let i = 0; i < ip.length; i++) {
    h ^= ip.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Drop closed windows so the map cannot grow without bound. */
function sweep(now: number) {
  if (windows.size < 1024) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
  limit: number;
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const limit = serverConfig.rateLimitRequests;
  const key = keyFor(ip);
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + serverConfig.rateLimitWindowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0, limit };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter,
    limit,
  };
}

/**
 * Best-effort client address, used only as a rate-limit key.
 *
 * Forwarded headers are attacker-controlled unless a trusted proxy sets them,
 * so this is not an identity — it is a bucket. Nothing is logged or persisted.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}

/** Test seam: clears all windows. */
export function resetRateLimit(): void {
  windows.clear();
}
