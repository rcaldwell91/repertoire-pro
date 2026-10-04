/* The separator's own limits (services/separator/jobs.py), checked on the
   phone first so nobody waits for an upload that will be refused. */
export const MAX_BYTES = 30_000_000;
export const MAX_SECONDS = 600;
/** the separator keeps a job this long; after it, a split must start again */
export const JOB_KEEP_MS = 45 * 60 * 1000;
export const FIRST_SECONDS = 30;
