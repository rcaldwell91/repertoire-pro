import { describe, expect, it } from 'vitest';
import { joinTakes, type Recording } from './recorder';

/* An exercise paused and resumed (Robert, 28 Oct): each stretch sung is its
   own recording; the take is one, each later stretch sung over the earlier
   from where it begins (a resume starts again at the repeat's start). */
const RATE = 100;
const rec = (songAt: number, n: number, v: number): Recording =>
  ({ rate: RATE, chunks: [Int16Array.from({ length: n }, () => v)], seconds: n / RATE, songAt });
const flat = (r: Recording) => Array.from(r.chunks.flatMap((c) => Array.from(c)));

describe('joinTakes', () => {
  it('none is none; one is itself', () => {
    expect(joinTakes([])).toBeNull();
    const one = rec(2, 50, 1);
    expect(flat(joinTakes([one]) as Recording)).toEqual(flat(one));
    expect(joinTakes([one])?.songAt).toBe(2);
  });
  it('a resume sung again from the repeat\'s start: the later stretch from there on, the earlier before it', () => {
    /* sung 0 to 3 s, paused, resumed from 2 s and sung to 5 s */
    const j = joinTakes([rec(0, 300, 1), rec(2, 300, 2)]) as Recording;
    const s = flat(j);
    expect(j.songAt).toBe(0);
    expect(j.seconds).toBeCloseTo(5);
    expect(s.length).toBe(500);
    expect(s.slice(0, 200).every((x) => x === 1)).toBe(true);
    expect(s.slice(200).every((x) => x === 2)).toBe(true);
  });
  it('a gap between stretches is silence, in time', () => {
    const s = flat(joinTakes([rec(1, 100, 1), rec(3, 100, 2)]) as Recording);
    expect(s.length).toBe(300);
    expect(s.slice(100, 200).every((x) => x === 0)).toBe(true);
    expect(s[200]).toBe(2);
  });
});
