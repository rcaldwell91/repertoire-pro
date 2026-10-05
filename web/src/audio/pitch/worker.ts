/// <reference lib="webworker" />
import { FileTrace, LiveTrace, type LivePoint } from './core.ts';
import { loadCrepe } from './weights.ts';
import type { Crepe } from './crepe.ts';

/* The pitch core in a worker, for the song file and the microphone alike
   (RULEBOOK 4, Pitch: one pitch core for files and mic; read in a worker).
   The mic has one worker to itself; a song's file is shared out to a few
   more, one stretch each, so a phone's several cores read it together. A
   stretch is read in short pieces, so whatever else the worker is asked
   never waits long. */

export type ToWorker =
  /** read points fromK..toK of a song, given that stretch of it (and its
      edges) starting at sample `offset` of a song `total` samples long */
  | { type: 'read'; job: number; mono: Float32Array; sr: number; fromK: number; toK: number; offset: number; total: number }
  | { type: 'cancel'; job: number }
  | { type: 'live-start'; sr: number }
  | { type: 'live'; samples: Float32Array; end: number }
  | { type: 'live-stop' };

export type FromWorker =
  | { type: 'line'; job: number; from: number; m: Float32Array; points: number; anchored: boolean; done: boolean }
  | { type: 'live'; pts: LivePoint[] };

const PIECE = 10;            /* half a second of song at a time */
const scope = self as unknown as DedicatedWorkerGlobalScope;
let crepe: Crepe | null = null;
const ready = loadCrepe().then((c) => (crepe = c));
const cancelled = new Set<number>();
let live: LiveTrace | null = null;
let liveSr = 0;

const pause = () => new Promise<void>((r) => setTimeout(r, 0));

async function read(d: Extract<ToWorker, { type: 'read' }>): Promise<void> {
  const { job, mono, sr, fromK, offset, total } = d;
  await ready;
  const t = new FileTrace(mono, sr, crepe, undefined, fromK, { offset, total });
  const points = Math.min(t.points, d.toK);
  while (!cancelled.has(job)) {
    const from = t.at;
    const m = t.next(Math.min(PIECE, points - from));
    const done = t.at >= points;
    scope.postMessage({ type: 'line', job, from, m, points, anchored: !!crepe, done } satisfies FromWorker, [m.buffer]);
    if (done) break;
    await pause();             /* let the mic's blocks in first */
  }
  cancelled.delete(job);
}

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const d = e.data;
  if (d.type === 'read') void read(d);
  else if (d.type === 'cancel') cancelled.add(d.job);
  else if (d.type === 'live-start') {
    live = null;
    liveSr = d.sr;
  } else if (d.type === 'live') {
    if (!live) live = new LiveTrace(liveSr, crepe);
    const pts = live.push(d.samples, d.end);
    if (pts.length) scope.postMessage({ type: 'live', pts } satisfies FromWorker);
  } else if (d.type === 'live-stop') live = null;
};
