/// <reference lib="webworker" />
import { FileTrace, LiveTrace, type LivePoint } from './core.ts';
import { loadCrepe } from './weights.ts';
import type { Crepe } from './crepe.ts';

/* The pitch core's one worker, for the song file and the microphone alike
   (RULEBOOK 4, Pitch: one pitch core for files and mic; read in a worker).
   A file is read in short pieces so the mic, when it is on, never waits
   behind it. */

export type ToWorker =
  | { type: 'read'; job: number; mono: Float32Array; sr: number; fromK: number }
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

async function read(job: number, mono: Float32Array, sr: number, fromK: number): Promise<void> {
  await ready;
  const t = new FileTrace(mono, sr, crepe, undefined, fromK);
  const points = t.points;
  while (!cancelled.has(job)) {
    const from = t.at;
    const m = t.next(PIECE);
    const done = t.at >= points;
    scope.postMessage({ type: 'line', job, from, m, points, anchored: !!crepe, done } satisfies FromWorker, [m.buffer]);
    if (done) break;
    await pause();             /* let the mic's blocks in first */
  }
  cancelled.delete(job);
}

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const d = e.data;
  if (d.type === 'read') void read(d.job, d.mono, d.sr, d.fromK);
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
