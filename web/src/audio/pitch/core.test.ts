import { describe, expect, it } from 'vitest';
import { FileTrace, HOP, LiveTrace, piecePad, WIN } from './core';

/* A voice-like test sound is not a real voice (RULEBOOK 4, Tests), so this
   only checks the bookkeeping: that file and mic read the same window the
   same way, in pieces as in one go. How well the core follows real singing
   is measured on real recordings (scripts/bakeoff, tests/notemap.test.mjs). */
function sound(seconds: number, sr: number): Float32Array {
  const x = new Float32Array(Math.round(seconds * sr));
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const f = 196 * Math.pow(2, Math.floor(i / sr) / 12);     /* a step up each second */
    ph += (2 * Math.PI * f) / sr;
    const env = (i / sr) % 1 < 0.8 ? 0.3 : 0;
    x[i] = env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph));
  }
  return x;
}

describe('one pitch core for file and mic', () => {
  const sr = 44100;
  const x = sound(4, sr);

  it('reads a file in pieces exactly as in one go', () => {
    const whole = new FileTrace(x, sr, null).next(1e9);
    const parts = new FileTrace(x, sr, null);
    const a = parts.next(17), b = parts.next(30), c = parts.next(1e9);
    const joined = Float32Array.from([...a, ...b, ...c]);
    expect(joined.length).toBe(whole.length);
    for (let i = 0; i < whole.length; i++) expect(Object.is(joined[i], whole[i]) || joined[i] === whole[i]).toBe(true);
  });

  it('carries on part way exactly as read in one go', () => {
    const whole = new FileTrace(x, sr, null).next(1e9);
    const late = new FileTrace(x, sr, null, undefined, 31).next(1e9);
    expect(late.length).toBe(whole.length - 31);
    for (let i = 0; i < late.length; i++) expect(Object.is(late[i], whole[31 + i]) || late[i] === whole[31 + i]).toBe(true);
  });

  it('reads a stretch of the song, given only that stretch and its edges, exactly as the whole', () => {
    const whole = new FileTrace(x, sr, null).next(1e9);
    for (const [k0, k1] of [[0, 23], [23, 51], [51, whole.length]]) {
      const pad = piecePad(sr);
      const a = Math.max(0, Math.round(k0 * HOP * sr) - pad), b = Math.min(x.length, Math.round(k1 * HOP * sr) + pad);
      const part = new FileTrace(x.slice(a, b), sr, null, undefined, k0, { offset: a, total: x.length }).next(k1 - k0);
      expect(part.length).toBe(k1 - k0);
      for (let i = 0; i < part.length; i++) expect(Object.is(part[i], whole[k0 + i]) || part[i] === whole[k0 + i]).toBe(true);
    }
  });

  it('changes note when the sound does, not two points late', () => {
    /* no rest between notes: a step of two semitones every half second */
    const y = new Float32Array(3 * sr);
    let ph = 0;
    for (let i = 0; i < y.length; i++) {
      ph += (2 * Math.PI * 220 * Math.pow(2, (2 * Math.floor(i / (sr / 2))) / 12)) / sr;
      y[i] = 0.3 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph));
    }
    const line = new FileTrace(y, sr, null).next(1e9);
    for (let s = 1; s < 6; s++) {
      const k = Math.round((s * 0.5) / HOP);
      const lo = line[k - 3], hi = line[k + 3];
      expect(hi - lo).toBeGreaterThan(1.5);
      /* the first point nearer the new note than the old is the change's own point, or one either side */
      let j = k - 3;
      while (Math.abs(line[j] - hi) > Math.abs(line[j] - lo)) j++;
      expect(Math.abs(j - k)).toBeLessThanOrEqual(1);
    }
  });

  it('gives the mic the same note at the same time as the file', () => {
    const file = new FileTrace(x, sr, null).next(1e9);
    const live = new LiveTrace(sr, null);
    /* the mic heard 2048 samples of silence first, so its windows fall
       exactly where the file's do */
    const heard = new Float32Array(WIN / 2 + x.length);
    heard.set(x, WIN / 2);
    const last = new Map<number, { at: number; m: number }>();
    let first = 0;
    for (let i = 0; i < heard.length; i += 128) {
      const end = Math.min(heard.length, i + 128);
      for (const p of live.push(heard.subarray(i, end), (end - 1 - WIN / 2) / sr)) {
        if (!last.has(p.i)) first++;            /* every point shows the moment it is read */
        last.set(p.i, p);
      }
    }
    expect(first).toBe(last.size);
    let same = 0;
    for (const [j, p] of last) {
      if (j >= file.length - 2) continue;
      expect(Math.abs(p.at - j * HOP)).toBeLessThan(1.5 / sr);            /* the same moment */
      const f = file[j];
      expect(Math.fround(p.m)).toEqual(f);                                /* the same note, exactly */
      if (Number.isFinite(f)) same++;
    }
    expect(same).toBeGreaterThan(40);
  });
});
