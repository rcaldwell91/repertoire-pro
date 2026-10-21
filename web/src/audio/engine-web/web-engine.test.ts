import { describe, expect, it } from 'vitest';
import { heardDelay, toConstraints } from './web-engine';
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
