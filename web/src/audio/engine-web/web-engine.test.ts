import { describe, expect, it } from 'vitest';
import { toConstraints } from './web-engine';
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
