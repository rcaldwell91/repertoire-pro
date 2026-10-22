import { describe, expect, it } from 'vitest';
import { CEILING, heardDelay, LOUD, safety, STAGE_DELAY, toConstraints, WebEngine } from './web-engine';
import { MIC_MODES, modeIndex } from '../mic-modes';

/* RULEBOOK 4, Mic, and Sound, Android 11: "Ask for the mic once, raw." */
describe('the mic modes', () => {
  it('asks for the raw mic exactly: echo, noise and gain off, the lowest latency', () => {
    expect(toConstraints(MIC_MODES[0])).toEqual({
      echoCancellation: { exact: false }, noiseSuppression: { exact: false }, autoGainControl: { exact: false }, latency: { ideal: 0 } });
  });
  it('offers the old app\'s other modes, for a hand tap only: the phone\'s own, processed, echo off', () => {
    expect(MIC_MODES.map((m) => m.name)).toEqual(['raw', 'phone', 'processed', 'basic']);
    expect(toConstraints(MIC_MODES[1])).toBe(true);
    expect(JSON.stringify(toConstraints(MIC_MODES[2]))).not.toContain('exact');
  });
  it('reads a remembered hand choice, and anything else as raw', () => {
    expect(modeIndex('2')).toBe(2);
    expect(modeIndex(null)).toBe(0);
    expect(modeIndex('9')).toBe(0);
    expect(modeIndex('x')).toBe(0);
  });
});

/* The old app (rpEarLag): "a reading past half a second is not believable". */
describe('the speaker\'s delay, as the phone reports it', () => {
  it('is the output and base delays together', () => {
    expect(heardDelay(0.12, 0.01)).toBeCloseTo(0.13);
    expect(heardDelay(0, 0.02)).toBeCloseTo(0.02);
  });
  it('is not believed at half a second or more, nor below zero', () => {
    expect(heardDelay(0.49, 0.02)).toBe(0);
    expect(heardDelay(0.8, 0)).toBe(0);
    expect(heardDelay(-0.1, 0)).toBe(0);
    expect(heardDelay(NaN, 0.01)).toBeCloseTo(0.01);
  });
});

/* Robert, 23 Oct: the old app's v9.8 loudness stage, as it was (next.html
   991-1014): the numbers written here as they are there. */
describe('the loudness stage', () => {
  it('is the old app\'s v9.8 stage: 0.9 in, a compressor lifts the body, 1.4 raises it all, a limiter holds the peaks', () => {
    expect(LOUD).toEqual({
      in: 0.9,
      body: { threshold: -12, knee: 6, ratio: 3, attack: 0.004, release: 0.22 },
      raise: 1.4,
      limit: { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.06 },
    });
  });
});

/* And after it, a ceiling: peaks held under -1 dB (Robert, 23 Oct). */
describe('the ceiling on the way out', () => {
  it('leaves everything up to its knee as it is', () => {
    for (const u of [0, 0.1, -0.5, CEILING.knee, -CEILING.knee]) expect(safety(u)).toBe(u);
  });
  it('rounds off anything louder, never reaching -1 dBFS', () => {
    expect(CEILING.top).toBeLessThan(10 ** (-1 / 20));
    for (const u of [0.7, 0.9, 1, 1.5, 2, -2, 10]) {
      expect(Math.abs(safety(u))).toBeLessThanOrEqual(CEILING.top);
      expect(Math.abs(safety(u))).toBeGreaterThan(CEILING.knee);
    }
    expect(safety(1.2)).toBeGreaterThan(safety(1.0));
  });
});

/* The way out holds the sound back: each compressor looks 6 ms ahead, and
   the ceiling, at twice the rate, adds 2.7 ms (measured offline, 23 Oct).
   It is part of when a sound is heard. */
describe('the way out\'s own delay', () => {
  it('is the two compressors\' look-ahead and the ceiling\'s, as measured', () => {
    expect(CEILING.oversample).toBe('2x');
    expect(STAGE_DELAY).toBeCloseTo(2 * 0.006 + 0.0027, 4);
  });
  it('is counted in when a sound is heard, beside the phone\'s own delays', () => {
    const e = new WebEngine();
    (e as unknown as { ctx: unknown }).ctx = { outputLatency: 0.12, baseLatency: 0.01 };
    expect(e.outputLatency()).toBeCloseTo(0.13 + STAGE_DELAY, 6);
  });
});
