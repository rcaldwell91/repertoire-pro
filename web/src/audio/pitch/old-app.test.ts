import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLARITY, GATE_LEVEL, yinHz, yinOffset } from './yin';
import { anchored } from './line';
import { WIN } from './core';

/* RULEBOOK 2.6: the old app's code is the checklist. The pitch reader was
   ported from next.html; these hold it to the old app's own code, loaded
   from next.html itself, so a change on either side shows. */
const OLD = readFileSync(new URL('../../../../next.html', import.meta.url), 'utf8');
function oldFn(name: string): string {
  const at = OLD.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not in next.html: ' + name);
  const end = OLD.indexOf('\n}\n', at);
  return OLD.slice(at, end + 2);
}

/* a voice-like window: a few harmonics with drifting strength, and noise
   (this compares two copies of one method; it claims nothing about pitch) */
function windowOf(f0: number, sr: number, seed: number, noise: number): Float32Array {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5;
  const w = new Float32Array(WIN);
  for (let i = 0; i < WIN; i++) {
    const t = i / sr;
    w[i] = 0.4 * Math.sin(2 * Math.PI * f0 * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f0 * t + 1) + 0.1 * Math.sin(2 * Math.PI * 3 * f0 * t + 2) + noise * rnd();
  }
  return w;
}

describe('the pitch reader is the old app\'s', () => {
  it('reads exactly what the old app\'s yinHz reads, at its default gate', () => {
    const NGATE = { clarity: CLARITY };
    const old = new Function('NGATE', oldFn('yinHz') + '; return yinHz;')(NGATE) as (b: Float32Array, sr: number) => number;
    /* the old code moved at each limit: the sweep must meet both */
    /* (the 1400 Hz cap itself is never what decides: the shortest lag, sr/1400, stops first) */
    const oldTop = new Function('NGATE', oldFn('yinHz').replace('Math.floor(sr/1400)', 'Math.floor(sr/1500)') + '; return yinHz;')(NGATE) as typeof old;
    const oldEdge = new Function('NGATE', oldFn('yinHz').replace('dp[tau] < 0.15', 'dp[tau] < 0.16') + '; return yinHz;')(NGATE) as typeof old;
    let n = 0;
    let differ = 0;
    const seen = { edge: 0, top: 0 };
    for (const sr of [44100, 48000]) {
      /* across the range, and right at its top, where the limit decides */
      for (const f0 of [55, 62, 80, 110, 196, 262, 440, 880, 1300, 1404, 1407, 1412, 1418, 1500]) {
        /* from clean to rough, finely, so the first-dip line is met */
        for (let noise = 0; noise <= 2; noise += 0.05) {
          const w = windowOf(f0, sr, n++, noise);
          const a = yinHz(w, sr, CLARITY), b = old(w, sr);
          if (a !== b) differ++;
          if (oldTop(w, sr) !== b) seen.top++;
          if (oldEdge(w, sr) !== b) seen.edge++;
        }
      }
    }
    expect(differ).toBe(0);
    /* the sweep really reaches both limits, so a change to either shows */
    expect(seen.top).toBeGreaterThan(0);
    expect(seen.edge).toBeGreaterThan(0);
  });

  it('gates at the old app\'s default setting (20)', () => {
    const NGATE: { cal: number | null; amount: number; level: number; clarity: number } = { cal: null, amount: 0, level: 0, clarity: 0 };
    const src = oldFn('ngateApply').replace(/\n\s*(ngateUi|try)\b[\s\S]*$/, '\n}');
    const apply = new Function('NGATE', 'localStorage', 'document', 'ngateUi', src + '; return ngateApply;')(
      NGATE, { setItem() {} }, { getElementById: () => null }, () => undefined) as (a: number) => void;
    apply(20);
    expect(GATE_LEVEL).toBeCloseTo(NGATE.level, 12);
    expect(CLARITY).toBeCloseTo(NGATE.clarity, 12);
  });

  it('dates a file\'s reading where the old app does', () => {
    const at = OLD.indexOf('function yinOffset(sr)');
    const line = OLD.slice(at, OLD.indexOf('\n', at));
    const old = new Function('WIN', line + '; return yinOffset;')(WIN) as (sr: number) => number;
    for (const sr of [22050, 44100, 48000]) expect(yinOffset(WIN, sr)).toBe(old(sr));
  });

  it('moves a note onto the model\'s octave only as the old app does: a sure anchor, more than four semitones away', () => {
    const at = OLD.indexOf('if(MICM.anchorConf >= 0.5');
    const body = OLD.slice(at, OLD.indexOf('\n  }\n', at) + 4);
    const old = new Function('m', 'MICM', 'performance', body + '; return m;') as (m: number, a: object, p: object) => number;
    const now = { now: () => 1000 };
    for (const conf of [0.3, 0.49, 0.5, 0.9]) {
      for (const am of [48, 60, 72]) {
        for (let m = 30; m <= 96; m += 0.75) {
          const want = old(m, { anchorConf: conf, anchorMidi: am, anchorAt: 900 }, now);
          expect(anchored(m, 0, { step: 1, midi: Float32Array.of(am), conf: Float32Array.of(conf) })).toBeCloseTo(want, 9);
        }
      }
    }
  });
});
