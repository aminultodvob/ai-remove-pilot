import { randomUUID } from "node:crypto";

import { serverConfig } from "@/lib/config";

/**
 * Job lifecycle and buffer release.
 *
 * The pipeline never writes an uploaded image to disk. There is no temporary
 * directory, no object store, and no path derived from anything a user sent.
 * An image exists as a `Buffer` inside one request and stops existing when that
 * request ends. That is the strongest version of "temporary" available to us,
 * and it removes the class of bug where a cleanup step is skipped on an error
 * path and a file is left behind.
 *
 * What still needs managing is *in-memory* residency, which is what this module
 * does:
 *
 *  - every job gets a random opaque id, used only for correlating timing
 *    metrics; it is never derived from the filename or the content;
 *  - buffers are registered so they can be overwritten and dropped in a
 *    `finally` block, on the success path and every failure path alike;
 *  - a sweeper force-releases any job that outlives its TTL, so a hung decode
 *    cannot pin an image in memory indefinitely.
 */

interface Job {
  id: string;
  startedAt: number;
  buffers: Set<Uint8Array>;
  released: boolean;
}

const jobs = new Map<string, Job>();
let sweeper: ReturnType<typeof setInterval> | null = null;

function ensureSweeper() {
  if (sweeper) return;
  const interval = Math.max(5_000, Math.min(serverConfig.jobTtlMs, 60_000));
  sweeper = setInterval(() => {
    const cutoff = Date.now() - serverConfig.jobTtlMs;
    for (const job of jobs.values()) {
      if (job.startedAt <= cutoff) releaseJob(job.id);
    }
    if (jobs.size === 0 && sweeper) {
      clearInterval(sweeper);
      sweeper = null;
    }
  }, interval);
  // Never hold the process open for the sweeper alone.
  sweeper.unref?.();
}

export function createJob(): Job {
  const job: Job = { id: randomUUID(), startedAt: Date.now(), buffers: new Set(), released: false };
  jobs.set(job.id, job);
  ensureSweeper();
  return job;
}

/** Register a buffer so it is zeroed and dropped when the job ends. */
export function trackBuffer<T extends Uint8Array>(job: Job, buffer: T): T {
  if (!job.released) job.buffers.add(buffer);
  return buffer;
}

/**
 * Overwrite and forget every buffer attached to a job.
 *
 * Zeroing is not a security guarantee — the runtime may have copied the bytes
 * during decoding, and V8 may have moved them — but it removes the obvious
 * residue and makes the intent explicit and testable. Idempotent by design, so
 * a `finally` block and the sweeper can both call it.
 */
export function releaseJob(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  for (const buffer of job.buffers) {
    try {
      buffer.fill(0);
    } catch {
      // A detached or read-only view is already unreachable; nothing to do.
    }
  }
  job.buffers.clear();
  job.released = true;
  jobs.delete(jobId);
}

/** Number of jobs currently holding memory. Exposed for tests and health checks. */
export function activeJobCount(): number {
  return jobs.size;
}

/** Test seam: releases everything and stops the sweeper. */
export function releaseAllJobs(): void {
  for (const id of [...jobs.keys()]) releaseJob(id);
  if (sweeper) {
    clearInterval(sweeper);
    sweeper = null;
  }
}

export type { Job };
