import { describe, expect, it } from 'vitest';
import { sylOf, rungStarts } from './exercises';
import { keyName } from './notemap';
import {
  intervalRound, jumpName, matchRound, seeded, steadyParts, steadyShare, vfeParts, higherVoice, JUMPS, ROUND, SING, STEADY_SECS,
  STEADY_SHARE, STEADY_CENTS,
} from './pitch';

/* The Pitch group (Robert, 28 Oct) and Long soft notes (Stemple et al.,
   1994), as data. Match the note and Hold the note are the old app's
   (next.html 3790-3880, 3906-4010). */
const range = { lo: 48, hi: 67 };

describe('Sing the interval', () => {
  it('ten jumps a round, each played from a starting note and sung to its target', () => {
    for (const level of [1, 2, 3] as const) {
      const r = intervalRound(level, range, seeded(0.3));
      expect(r.notes.length).toBe(ROUND);
      expect(r.played.length).toBe(ROUND);
      r.notes.forEach((n, k) => {
        const jump = n.m - r.played[k].m;
        expect(JUMPS[level].semis, `level ${level} jump ${jump}`).toContain(Math.abs(jump));
        if (!JUMPS[level].down) expect(jump).toBeGreaterThan(0);
        expect(n.d).toBe(SING);
        expect(n.t).toBeGreaterThan(r.played[k].t + r.played[k].d);
      });
    }
  });

  it('a step and an octave up; then a third and a fifth; then a fourth, sixth, seventh and jumps down', () => {
    expect(JUMPS[1]).toEqual({ semis: [2, 12], down: false });
    expect(JUMPS[2]).toEqual({ semis: [2, 4, 7, 12], down: false });
    expect(JUMPS[3]).toEqual({ semis: [2, 4, 5, 7, 9, 11, 12], down: true });
    const two = intervalRound(2, range, seeded(0.7));
    const all = new Set(two.notes.map((n, k) => n.m - two.played[k].m));
    expect([...all].sort((a, b) => a - b)).toEqual([2, 4, 7, 12]);
    const downs = intervalRound(3, range, seeded(0.1));
    expect(downs.notes.some((n, k) => n.m < downs.played[k].m)).toBe(true);
  });

  it('both notes of every jump sit in the singer\'s range', () => {
    for (let s = 0; s < 20; s++) {
      const r = intervalRound(3, range, seeded(s / 20));
      for (let k = 0; k < ROUND; k++) {
        for (const m of [r.played[k].m, r.notes[k].m]) {
          expect(m).toBeGreaterThanOrEqual(range.lo);
          expect(m).toBeLessThanOrEqual(range.hi);
        }
      }
    }
  });

  it('shows each jump in words, each a round of its own', () => {
    expect(jumpName(7, false)).toBe('A fifth up');
    expect(jumpName(12, true)).toBe('An octave down');
    const r = intervalRound(1, range, seeded(0.5));
    expect(rungStarts(r.notes).length).toBe(ROUND);
    for (const n of r.notes) expect(['A step up', 'An octave up']).toContain(sylOf(n));
  });

  it('the same seed draws the same round; another draws another', () => {
    expect(intervalRound(2, range, seeded(0.42))).toEqual(intervalRound(2, range, seeded(0.42)));
    expect(intervalRound(2, range, seeded(0.42))).not.toEqual(intervalRound(2, range, seeded(0.43)));
  });
});

describe('Match the note (the old app\'s)', () => {
  it('ten notes from one above the bottom to one below the top, never the same twice running', () => {
    for (let s = 0; s < 10; s++) {
      const r = matchRound(range, seeded(s / 10));
      expect(r.notes.length).toBe(10);
      r.notes.forEach((n, k) => {
        expect(n.m).toBeGreaterThanOrEqual(range.lo + 1);
        expect(n.m).toBeLessThanOrEqual(range.hi - 1);
        expect(r.played[k].m).toBe(n.m);
        expect(sylOf(n)).toBe(keyName(n.m));
      });
    }
  });
  it('a hit is holding it 1.2 s within a semitone: half of its 2.4 s bubble', () => {
    expect(SING / 2).toBeCloseTo(1.2);
  });
});

describe('Hold the note (the old app\'s Hold a note)', () => {
  it('ten notes, held five seconds each, inside the range', () => {
    const p = steadyParts(range, seeded(0.2));
    expect(p.length).toBe(10);
    for (const x of p) {
      expect(x.kind).toBe('steady');
      if (x.kind !== 'steady') continue;
      expect(x.secs).toBe(STEADY_SECS);
      expect(x.m).toBeGreaterThanOrEqual(range.lo);
      expect(x.m).toBeLessThanOrEqual(range.hi);
    }
  });
  it('every third note out at an edge of the range; the others three in from each end', () => {
    for (let s = 0; s < 10; s++) {
      steadyParts(range, seeded(s / 10)).forEach((x, i) => {
        if (x.kind !== 'steady') return;
        const edge = x.m <= range.lo + 3 || x.m >= range.hi - 3;
        if ((i + 1) % 3 === 0) expect(edge, `note ${i + 1}`).toBe(true);
        else {
          expect(x.m).toBeGreaterThanOrEqual(range.lo + 3);
          expect(x.m).toBeLessThanOrEqual(range.hi - 3);
        }
      });
    }
  });
  it('held when 70% of the five seconds is within 35 cents; octave exact unless Any octave', () => {
    expect(STEADY_SHARE).toBe(0.7);
    expect(STEADY_CENTS).toBe(35);
    const hop = 0.05, t: number[] = [], m: number[] = [];
    for (let k = 0; k < 130; k++) { t.push(k * hop); m.push(k * hop < 1.2 + 3.6 ? 60.3 : 61); }
    const share = steadyShare(t, m, hop, 60, 1.2, 5, false);
    expect(share).toBeCloseTo(0.72, 1);
    expect(share).toBeGreaterThanOrEqual(STEADY_SHARE);
    expect(steadyShare(t, m.map((x) => x + 0.1), hop, 60, 1.2, 5, false)).toBe(0);  /* 40 cents off */
    expect(steadyShare(t, m.map((x) => x - 12), hop, 60, 1.2, 5, false)).toBe(0);
    expect(steadyShare(t, m.map((x) => x - 12), hop, 60, 1.2, 5, true)).toBeCloseTo(share);
  });
});

describe('Long soft notes (Stemple\'s vocal function exercises)', () => {
  it('higher voices on F4 and from C4, lower on F3 and from C3, by the middle of the range', () => {
    expect(higherVoice({ lo: 53, hi: 77 })).toBe(true);
    expect(higherVoice({ lo: 45, hi: 69 })).toBe(false);
    const hi = vfeParts({ lo: 53, hi: 77 }), lo = vfeParts({ lo: 45, hi: 69 });
    expect(hi.filter((p) => p.kind === 'long' && p.step === 1).map((p) => p.kind === 'long' && p.m)).toEqual([65, 65]);
    expect(lo.filter((p) => p.kind === 'long' && p.step === 1).map((p) => p.kind === 'long' && p.m)).toEqual([53, 53]);
    expect(hi.filter((p) => p.kind === 'long' && p.step === 4).map((p) => p.kind === 'long' && p.m)).toEqual([60, 62, 64, 65, 67, 60, 62, 64, 65, 67]);
    expect(lo.filter((p) => p.kind === 'long' && p.step === 4).map((p) => p.kind === 'long' && p.m)).toEqual([48, 50, 52, 53, 55, 48, 50, 52, 53, 55]);
  });
  it('the four steps in order, each twice: "ee" held, a slide up and a slide down on "knoll", "ol" held on five notes', () => {
    const p = vfeParts(range);
    expect(p.map((x) => (x.kind === 'long' ? `${x.step}:${x.syl}` : x.kind === 'slide' ? `${x.step}:${x.syl}:slide` : 'steady'))).toEqual([
      '1:ee', '1:ee', '2:knoll:slide', '2:knoll:slide', '3:knoll:slide', '3:knoll:slide',
      '4:ol', '4:ol', '4:ol', '4:ol', '4:ol', '4:ol', '4:ol', '4:ol', '4:ol', '4:ol']);
    expect(p.map((x) => (x.kind === 'steady' ? 0 : x.round))).toEqual([1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
  });
});
