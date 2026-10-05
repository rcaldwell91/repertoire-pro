import { actToMidiConf, crepeFrame, crepePredict, type Crepe } from './crepe.ts';
import { anchored, type Anchors } from './line.ts';
import { CLARITY, GATE_LEVEL, yinHz, yinOffset } from './yin.ts';

/* THE pitch core (RULEBOOK 2 and 4: "One pitch core for files and mic").
   The song file and the microphone are read by the same code: a window of
   WIN samples, the loudness gate, the pitch method on the part of the
   window it reads, the model's octave anchor, the median of five.

   A file point at time t uses the window centred on t. A live point uses
   the window that ends now, and is dated at that window's centre - so for
   the same sound the two give the same note at the same time, and your
   line lands on the singer's line (RULEBOOK 4, Timing: "correct each line
   at its own source"). */

export const HOP = 0.05;          /* twenty points a second, file and mic */
export const WIN = 4096;
export const ANCHOR_STEP = 0.22;
/** how this line was read; a stored line of another version is read again */
export const LINE_VER = 1;

export interface Method {
  readonly name: string;
  detect(win: Float32Array, sr: number): number;
  /** where in the window the method reads from */
  offset(sr: number): number;
}

/* The bake-off winner (scripts/bakeoff, 5 Oct): the old app's method. */
export const METHOD: Method = {
  name: 'yin',
  detect: (w, sr) => yinHz(w, sr, CLARITY),
  offset: (sr) => yinOffset(WIN, sr),
};

function midiOf(f: number): number {
  return 69 + 12 * Math.log2(f / 440);
}

function rms(w: Float32Array): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * w[i];
  return Math.sqrt(s / w.length);
}

/** One point from a window: the gate, the method, the anchor. */
function reading(win: Float32Array, sr: number, method: Method): number | null {
  if (rms(win) < GATE_LEVEL) return null;
  const f = method.detect(win.subarray(method.offset(sr)), sr);
  return f > 0 ? midiOf(f) : null;
}

/** The median of five readings centred on point j - two before, two after -
    never reaching across a gap, so a note's first point is not dragged
    toward silence and a note change is not drawn late. (The old app took
    the median of the LAST five, which put every change of note two points,
    0.1 s, late on both lines.) `upTo` is the newest reading there is; with
    fewer than two after j the point is provisional, and is given again
    when they come. NaN where nobody sings. */
export function centred5(raw: ArrayLike<number>, j: number, upTo: number, ring = 0): number {
  const at = (i: number) => raw[ring ? i % ring : i];
  const mid = at(j);
  if (!Number.isFinite(mid)) return NaN;
  const v = [mid];
  for (let d = 1; d <= 2 && j - d >= 0; d++) {
    const x = at(j - d);
    if (!Number.isFinite(x)) break;
    v.push(x);
  }
  for (let d = 1; d <= 2 && j + d <= upTo; d++) {
    const x = at(j + d);
    if (!Number.isFinite(x)) break;
    v.push(x);
  }
  v.sort((a, b) => a - b);
  return v[v.length >> 1];
}

/** Reads a file a piece at a time, in order, keeping its place: read in
    pieces, or started part way (to carry on from the first 30 seconds), it
    gives exactly what it gives read in one go. */
export class FileTrace {
  private k = 0;
  private readonly win = new Float32Array(WIN);
  private readonly ancN: number;
  private readonly ancMidi: Float32Array;
  private readonly ancConf: Float32Array;
  private readonly one = { step: 1, midi: new Float32Array(1), conf: new Float32Array(1) };
  private readonly raw: Float32Array;
  private rawTo: number;
  private readonly mono: Float32Array;
  private readonly sr: number;
  private readonly crepe: Crepe | null;
  private readonly method: Method;

  constructor(mono: Float32Array, sr: number, crepe: Crepe | null, method: Method = METHOD, startK = 0) {
    this.mono = mono;
    this.sr = sr;
    this.crepe = crepe;
    this.method = method;
    this.k = startK;
    this.raw = new Float32Array(this.points).fill(NaN);
    /* as many anchors as the old app made: one every ANCHOR_STEP, to the end */
    this.ancN = Math.floor(mono.length / sr / ANCHOR_STEP) + 1;
    this.ancMidi = new Float32Array(this.ancN).fill(NaN);
    this.ancConf = new Float32Array(this.ancN);
    this.rawTo = Math.max(0, startK - 2);
  }

  get points(): number {
    return Math.floor(this.mono.length / this.sr / HOP);
  }

  get at(): number {
    return this.k;
  }

  /* the model's anchor nearest time t: made only where a point needs one
     (where there is a pitch to anchor), and once */
  private anchorAt(t: number): Anchors | null {
    if (!this.crepe) return null;
    const ai = Math.round(t / ANCHOR_STEP);
    if (ai < 0 || ai >= this.ancN) return null;
    if (Number.isNaN(this.ancMidi[ai])) {
      const r = actToMidiConf(crepePredict(this.crepe, crepeFrame(this.mono, this.sr, ai * ANCHOR_STEP)));
      this.ancMidi[ai] = r.midi;
      this.ancConf[ai] = r.conf;
    }
    this.one.midi[0] = this.ancMidi[ai];
    this.one.conf[0] = this.ancConf[ai];
    return this.one;
  }

  /** the reading at each point up to `to` (not included), once each */
  private readTo(to: number): void {
    to = Math.min(this.points, to);
    if (to <= this.rawTo) return;
    for (let k = this.rawTo; k < to; k++) {
      const t = k * HOP;
      const start = Math.round(t * this.sr) - (WIN >> 1);
      for (let j = 0; j < WIN; j++) {
        const sp = start + j;
        this.win[j] = sp >= 0 && sp < this.mono.length ? this.mono[sp] : 0;
      }
      const m = reading(this.win, this.sr, this.method);
      this.raw[k] = m == null ? NaN : anchored(m, 0, this.anchorAt(t));
    }
    this.rawTo = to;
  }

  /** the next n points: the note, NaN where none */
  next(n: number): Float32Array {
    const end = Math.min(this.points, this.k + n);
    const out = new Float32Array(Math.max(0, end - this.k));
    this.readTo(end + 2);
    for (let i = 0; this.k < end; this.k++, i++) {
      out[i] = centred5(this.raw, this.k, this.points - 1);
    }
    return out;
  }
}

export interface LivePoint {
  /** which point: a later one with the same i replaces it */
  readonly i: number;
  /** engine time of the point (its window's centre) */
  readonly at: number;
  /** the note, NaN where none */
  readonly m: number;
}

/** The microphone, a point every HOP seconds, from the same reading and the
    same centred median as a file. A point is given at once (so the line
    keeps up with the voice) and given again as the two after it arrive;
    the last time it is given it equals what a file would show. */
export class LiveTrace {
  private readonly buf = new Float32Array(WIN);
  private filled = 0;
  private w = 0;
  private sinceLast = 0;
  private n = -1;
  private readonly raw = new Float64Array(8);
  private readonly ats = new Float64Array(8);
  private anchor: { at: number; midi: number; conf: number } | null = null;
  private readonly sr: number;
  private readonly crepe: Crepe | null;
  private readonly method: Method;
  private readonly frame = new Float32Array(WIN);

  constructor(sr: number, crepe: Crepe | null, method: Method = METHOD) {
    this.sr = sr;
    this.crepe = crepe;
    this.method = method;
  }

  /** samples whose last one was heard at engine time `end` (seconds);
      returns the points they complete or change */
  push(samples: Float32Array, end: number): LivePoint[] {
    const out: LivePoint[] = [];
    const step = Math.round(HOP * this.sr);
    for (let i = 0; i < samples.length; i++) {
      this.buf[this.w] = samples[i];
      this.w = (this.w + 1) % WIN;                     /* a ring: the oldest sample is at w */
      if (this.filled < WIN) this.filled++;
      if (++this.sinceLast >= step && this.filled === WIN) {
        this.sinceLast = 0;
        const endT = end - (samples.length - 1 - i) / this.sr;
        const at = endT - WIN / 2 / this.sr;
        this.frame.set(this.buf.subarray(this.w), 0);
        this.frame.set(this.buf.subarray(0, this.w), WIN - this.w);
        let m = reading(this.frame, this.sr, this.method);
        if (m != null && this.crepe) {
          if (!this.anchor || at - this.anchor.at >= ANCHOR_STEP) {
            const tc = WIN / 2 / this.sr;            /* the window's centre, as for a file */
            const r = actToMidiConf(crepePredict(this.crepe, crepeFrame(this.frame, this.sr, tc)));
            this.anchor = { at, ...r };
          }
          m = anchored(m, 0, { step: 1, midi: Float32Array.of(this.anchor.midi), conf: Float32Array.of(this.anchor.conf) });
        }
        const n = ++this.n;
        this.raw[n % 8] = m == null ? NaN : m;
        this.ats[n % 8] = at;
        for (let j = Math.max(0, n - 2); j <= n; j++) {
          out.push({ i: j, at: this.ats[j % 8], m: centred5(this.raw, j, n, 8) });
        }
      }
    }
    return out;
  }
}
