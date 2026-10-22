import { describe, expect, it } from 'vitest';
import { heardDelay, LIMIT_DB, makeupOf, MONITOR_ROOM, monitorSoft, safety, toConstraints } from './web-engine';
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

/* The old app's limiter, made safe: overlapping sound never reaches full scale. */
describe('the last safety on the way out', () => {
  it('leaves everything below 0.9 as it is', () => {
    for (const u of [0, 0.1, -0.5, 0.89, -0.9]) expect(safety(u)).toBe(u);
  });
  it('rounds off anything louder, never reaching full scale', () => {
    for (const u of [0.95, 1, 1.5, 2, -2, 10]) {
      expect(Math.abs(safety(u))).toBeLessThan(1);
      expect(Math.abs(safety(u))).toBeGreaterThan(0.9);
    }
    expect(safety(1.2)).toBeGreaterThan(safety(1.0));
  });
});

/* Robert, 22 Oct: below 0.9 the way out changes nothing; the limiter starts
   there, and its own lift is taken off again (measured: loudness, chain-unity). */
describe('the limiter', () => {
  it('starts at 0.9', () => {
    expect(10 ** (LIMIT_DB / 20)).toBeCloseTo(0.9, 6);
  });
  it('knows its own lift: none with no limiting, more the lower it starts', () => {
    expect(makeupOf(0, 20)).toBeCloseTo(1);
    expect(makeupOf(-2, 20)).toBeGreaterThan(makeupOf(LIMIT_DB, 20));
    expect(makeupOf(LIMIT_DB, 20)).toBeCloseTo(10 ** ((-(LIMIT_DB + -LIMIT_DB / 20) / 20) * 0.6));
  });
});

/* Hear yourself, lifted up to +12 dB, never clips. */
describe('Hear yourself, rounded off', () => {
  it('is as it is up to 0.6', () => {
    for (const u of [0, 0.2, -0.45, 0.6, -0.6]) expect(monitorSoft(u)).toBe(u);
  });
  it('never reaches 0.9, however loud the mic', () => {
    for (const u of [0.7, 1, 2, MONITOR_ROOM, -MONITOR_ROOM]) {
      expect(Math.abs(monitorSoft(u))).toBeLessThan(0.9);
      expect(Math.abs(monitorSoft(u))).toBeGreaterThan(0.6);
    }
    expect(monitorSoft(1.2)).toBeGreaterThan(monitorSoft(0.9));
  });
});
