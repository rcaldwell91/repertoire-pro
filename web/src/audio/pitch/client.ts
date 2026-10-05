import type { FromWorker, ToWorker } from './worker.ts';
import type { LivePoint } from './core.ts';

/* The page's side of the pitch worker: one worker, made when first needed. */
let worker: Worker | null = null;
let nextJob = 1;
const jobs = new Map<number, (d: Extract<FromWorker, { type: 'line' }>) => void>();
let onLive: ((pts: LivePoint[]) => void) | null = null;

function w(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const d = e.data;
      if (d.type === 'line') jobs.get(d.job)?.(d);
      else onLive?.(d.pts);
    };
  }
  return worker;
}

function send(msg: ToWorker, transfer: Transferable[] = []): void {
  w().postMessage(msg, transfer);
}

/** Start the worker early, so the model is ready by the time it is needed. */
export function warmPitch(): void {
  w();
}

export interface LinePiece {
  readonly from: number;
  readonly m: Float32Array;
  readonly points: number;
  readonly anchored: boolean;
  readonly done: boolean;
}

/** Read a voice into a line from point `fromK` on, a piece at a time.
    The returned function stops it. */
export function readLine(mono: Float32Array, sr: number, fromK: number, onPiece: (p: LinePiece) => void): () => void {
  const job = nextJob++;
  jobs.set(job, (d) => {
    if (d.done) jobs.delete(job);
    onPiece(d);
  });
  send({ type: 'read', job, mono, sr, fromK }, [mono.buffer]);
  return () => {
    if (!jobs.delete(job)) return;
    send({ type: 'cancel', job });
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
