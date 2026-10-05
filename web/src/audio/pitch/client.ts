import type { FromWorker, ToWorker } from './worker.ts';
import { HOP, piecePad, type LivePoint } from './core.ts';

/* The page's side of the pitch workers, made when first needed: one for
   the mic, and READERS for reading a song's file - one fewer than the
   cores the phone reports (an iPhone reports 4), at least 2, at most 4. */
const READERS = Math.max(2, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 2) - 1));
/** seconds of song one reader takes at a time */
const STRETCH = 10;
let nextJob = 1;
const jobs = new Map<number, (d: Extract<FromWorker, { type: 'line' }>) => void>();
let onLive: ((pts: LivePoint[]) => void) | null = null;

function make(): Worker {
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<FromWorker>) => {
    const d = e.data;
    if (d.type === 'line') jobs.get(d.job)?.(d);
    else onLive?.(d.pts);
  };
  return w;
}
let micWorker: Worker | null = null;
const readers: Worker[] = [];
function mic(): Worker {
  if (!micWorker) micWorker = make();
  return micWorker;
}
function reader(i: number): Worker {
  while (readers.length <= i) readers.push(make());
  return readers[i];
}

function send(msg: ToWorker, transfer: Transferable[] = []): void {
  mic().postMessage(msg, transfer);
}

/** Start the readers early, so the model is ready by the time it is needed. */
export function warmPitch(): void {
  for (let i = 0; i < READERS; i++) reader(i);
}

export interface LinePiece {
  readonly from: number;
  readonly m: Float32Array;
  readonly points: number;
  readonly anchored: boolean;
  readonly done: boolean;
}

/** Read a voice into a line from point `fromK` on. The song is shared out
    in stretches, in order, to the readers; each stretch comes back a piece
    at a time, the earliest first. `onPiece` hears every piece, with `done`
    on the last of all. The returned function stops it. */
export function readLine(mono: Float32Array, sr: number, fromK: number, onPiece: (p: LinePiece) => void): () => void {
  const points = Math.floor(mono.length / sr / HOP);
  const step = Math.round(STRETCH / HOP), pad = piecePad(sr);
  const stretches: Array<[number, number]> = [];
  for (let k = fromK; k < points; k += step) stretches.push([k, Math.min(points, k + step)]);
  const mine: number[] = [];
  let left = stretches.length, next = 0, stopped = false;
  const give = (w: number) => {
    if (stopped || next >= stretches.length) return;
    const [k0, k1] = stretches[next++];
    const job = nextJob++;
    mine.push(job);
    jobs.set(job, (d) => {
      if (d.done) {
        jobs.delete(job);
        left--;
        give(w);                      /* this reader takes the next stretch */
      }
      onPiece({ ...d, done: left === 0 });
    });
    const a = Math.max(0, Math.round(k0 * HOP * sr) - pad), b = Math.min(mono.length, Math.round(k1 * HOP * sr) + pad);
    const part = mono.slice(a, b);
    reader(w).postMessage({ type: 'read', job, mono: part, sr, fromK: k0, toK: k1, offset: a, total: mono.length } satisfies ToWorker, [part.buffer]);
  };
  if (!stretches.length) onPiece({ from: fromK, m: new Float32Array(0), points, anchored: true, done: true });
  for (let w = 0; w < READERS; w++) give(w);
  return () => {
    stopped = true;
    for (const job of mine) {
      if (!jobs.delete(job)) continue;
      readers.forEach((r) => r.postMessage({ type: 'cancel', job } satisfies ToWorker));
    }
  };
}

/** The mic's line: blocks in, points out. */
export const livePitch = {
  start(sr: number, cb: (pts: LivePoint[]) => void): void {
    onLive = cb;
    send({ type: 'live-start', sr });
  },
  push(samples: Float32Array, end: number): void {
    if (onLive) send({ type: 'live', samples, end }, [samples.buffer]);
  },
  stop(): void {
    if (!onLive) return;
    onLive = null;
    send({ type: 'live-stop' });
  },
};
