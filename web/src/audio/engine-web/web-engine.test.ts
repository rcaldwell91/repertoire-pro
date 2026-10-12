import { describe, expect, it } from 'vitest';
import { heardDelay, toConstraints } from './web-engine';
import { MIC_LADDER, ladderOrder } from '../mic-ladder';

/* RULEBOOK 4, Mic: "Never require raw capture. Walk a ladder of constraint
   sets and remember what worked." */
describe('the mic ladder', () => {
  it('only ever asks, never requires', () => {
    for (const set of MIC_LADDER) {
      const c = toConstraints(set);
      const text = JSON.stringify(c);
      expect(text).not.toContain('exact');
      if (c !== true) for (const v of Object.values(c)) expect(Object.keys(v as object)).toEqual(['ideal']);
    }
  });

  it('ends on a rung that asks for nothing but a microphone', () => {
    expect(toConstraints(MIC_LADDER[MIC_LADDER.length - 1])).toBe(true);
  });

  it('tries what worked last time first, then the rest in order', () => {
    expect(ladderOrder(null)).toEqual([0, 1, 2]);
    expect(ladderOrder(2)).toEqual([2, 0, 1]);
    expect(ladderOrder(7)).toEqual([0, 1, 2]);
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
