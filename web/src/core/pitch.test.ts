import { describe, expect, it } from 'vitest';
import { sylOf, rungStarts } from './exercises';
import { keyName } from './notemap';
import {
  intervalRound, matchRound, seeded, shapeName, steadyParts, steadyShare, vfeParts, higherVoice, LEVEL_SHAPES, ROUND, SHAPES, SING, STEADY_SECS,
  STEADY_SHARE, STEADY_CENTS,
} from './pitch';

/* The Pitch group (Robert, 28 Oct) and Long soft notes (Stemple et al.,
   1994), as data. Match the note and Hold the note are the old app's
   (next.html 3790-3880, 3906-4010). */
const range = { lo: 48, hi: 67 };

describe('Sing the interval (shapes, Robert 28 Oct)', () => {
  const wide = { lo: 48, hi: 72 };
  it('a note plays, then the shape is sung from it: every sung note is the starting note plus its shape', () => {
    for (const level of [1, 2, 3] as const) {
      for (let s = 0; s < 10; s++) {
        const r = intervalRound(level, wide, seeded(s / 10));
        expect(r.shapes.length).toBe(ROUND);
        expect(r.played.length).toBe(ROUND);
        const sungAt = rungStarts(r.notes);
        expect(sungAt.length).toBe(ROUND);
        r.shapes.forEach((sh, k) => {
          const degs = SHAPES[sh.id].map((d) => (sh.down ? -d : d));
          const from = sungAt[k], to = sungAt[k + 1] ?? r.notes.length;
          const got = r.notes.slice(from, to).map((n) => n.m - r.played[k].m);
          expect(got, `level ${level} ${sh.id}${sh.down ? ' down' : ''}`).toEqual(sh.id === 'chord' && sh.down ? [-3, -7] : degs);
          expect(r.notes[from].t).toBeGreaterThan(r.played[k].t + r.played[k].d);
        });
      }
    }
  });

  it('shapes by level: a step, 1-5 and an octave; then a third and 1-3-5; then a fourth, sixth, seventh and shapes down', () => {
    expect(LEVEL_SHAPES[1]).toEqual({ up: ['step', 'fifth', 'octave'], down: [] });
    expect(LEVEL_SHAPES[2]).toEqual({ up: ['step', 'third', 'fifth', 'chord', 'octave'], down: [] });
    expect(LEVEL_SHAPES[3]).toEqual({ up: ['step', 'third', 'fourth', 'fifth', 'chord', 'sixth', 'seventh', 'octave'],
      down: ['step', 'third', 'fifth', 'chord', 'octave'] });
    expect(SHAPES.chord).toEqual([4, 7]);
    for (const level of [1, 2, 3] as const) {
      const seen = new Set<string>();
      for (let s = 0; s < 20; s++) intervalRound(level, wide, seeded(s / 20)).shapes.forEach((sh) => seen.add(sh.id + (sh.down ? '-' : '+')));
      const want = new Set([...LEVEL_SHAPES[level].up.map((x) => x + '+'), ...LEVEL_SHAPES[level].down.map((x) => x + '-')]);
      expect(seen, `level ${level}`).toEqual(want);
    }
  });

  it('every note of every shape sits in the singer\'s range', () => {
    for (let s = 0; s < 20; s++) {
      const r = intervalRound(3, wide, seeded(s / 20));
      for (const n of [...r.played, ...r.notes]) {
        expect(n.m).toBeGreaterThanOrEqual(wide.lo);
        expect(n.m).toBeLessThanOrEqual(wide.hi);
      }
    }
  });

  it('shows each shape in words', () => {
    expect(shapeName('fifth', false)).toBe('A fifth up');
    expect(shapeName('octave', true)).toBe('An octave down');
    expect(shapeName('chord', false)).toBe('Up the chord: 1, 3, 5');
    expect(shapeName('chord', true)).toBe('Down the chord: 5, 3, 1');
    const r = intervalRound(2, wide, seeded(0.5));
    r.shapes.forEach((sh, k) => expect(r.labels[k]).toBe(shapeName(sh.id, sh.down)));
  });

  it('the same seed draws the same round; another draws another', () => {
    expect(intervalRound(2, range, seeded(0.42))).toEqual(intervalRound(2, range, seeded(0.42)));
    expect(intervalRound(2, range, seeded(0.42))).not.toEqual(intervalRound(2, range, seeded(0.43)));
  });
});

describe('Match the note (the old app\'s)', () => {
  it('ten notes from one above the bottom to one below the top, never the same twice running', () => {
    for (let s = 0; s < 200; s++) {
      const r = matchRound({ lo: 59, hi: 63 }, seeded(s / 200));
      r.notes.forEach((n, k) => k && expect(n.m, `seed ${s}, note ${k + 1}`).not.toBe(r.notes[k - 1].m));
    }
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
