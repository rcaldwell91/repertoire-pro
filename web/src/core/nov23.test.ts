import { describe, expect, it } from 'vitest';
import { atLevel, EXERCISES, exercise, holdNotes, ladderNotes, levelsOf, PATTERNS, rungStarts, SHORT_LEN, type Exercise } from './exercises';

/* Robert, 23 Nov */
const ex = (id: string) => exercise(id) as Exercise;
const range = { lo: 47, hi: 72 };

describe('every note of a round the same length, but the holds', () => {
  it('every note the piano plays in a round, the top and the last included, is as long as the others, at every level', () => {
    for (const e of EXERCISES) {
      for (const l of levelsOf(e)) {
        const x = atLevel(e, l.level);
        if (x.engine.kind !== 'ladder') continue;
        const { played } = ladderNotes(x, range);
        const keys = played.filter((n) => !n.lead);
        const n = PATTERNS[x.engine.pattern].deg.length;
        for (let r = 0; r < Math.min(3, keys.length / n); r++) {
          const round = keys.slice(r * n, r * n + n);
          expect(new Set(round.map((k) => k.d.toFixed(9))).size, `${e.id} ${l.level}`).toBe(1);
        }
      }
    }
  });
  it('the holds keep their long notes: Sustained note, Messa di voce, Tongue-out with a crescendo', () => {
    expect(holdNotes(ex('sustain'), range).notes[0].d).toBe(8);
    expect(holdNotes(ex('messa'), range).notes[0].d).toBe(10);
    expect(holdNotes(ex('tonguecresc'), range).notes[0].d).toBe(8);
    for (const id of ['holdnote', 'matchtone', 'vfe']) expect(ex(id).engine.kind, id).not.toBe('ladder');
  });
  it('the rest between rounds stays: a beat\'s quiet, then the lead', () => {
    const x = atLevel(ex('mee'), 2);
    const beat = 60 / 120;
    const { played } = ladderNotes(x, range);
    const leads = played.map((n, i) => [n, i] as const).filter(([n]) => n.lead);
    const [second, at] = leads[1];
    const before = played[at - 1];
    expect(second.t - (before.t + before.d)).toBeCloseTo(beat, 9);
  });
});

describe('the lead note: exactly one note of the round, at the level picked', () => {
  it('as long as the round\'s first note, on its pitch, the round right after it, at every level: shorter at Advanced', () => {
    const lens: number[] = [];
    for (const level of [1, 2, 3] as const) {
      const x = atLevel(ex('mum'), level);
      const { played } = ladderNotes(x, range);
      const [lead, first, second] = played;
      expect(lead.lead).toBe(true);
      expect(lead.m).toBe(first.m);
      expect(lead.d).toBeCloseTo(first.d, 9);
      expect(first.d).toBeCloseTo(second.d, 9);
      expect(first.t).toBeCloseTo(lead.t + lead.d, 9);
      lens.push(lead.d);
    }
    /* 0.625, 0.5 and 0.417 s at 96, 120 and 144 a minute */
    expect(lens.map((x) => +x.toFixed(3))).toEqual([0.625, 0.5, 0.417]);
  });
  it('on every exercise that moves round by round, at every level', () => {
    for (const e of EXERCISES) for (const l of levelsOf(e)) {
      const x = atLevel(e, l.level);
      if (x.engine.kind !== 'ladder') continue;
      const { played } = ladderNotes(x, range);
      played.forEach((n, i) => {
        if (!n.lead) return;
        expect(n.d, `${e.id} ${l.level}`).toBeCloseTo(played[i + 1].d, 9);
        expect(n.m, `${e.id} ${l.level}`).toBe(played[i + 1].m);
      });
    }
  });
});

describe('short notes: sung short, played whole', () => {
  it('Bwoop, Staccato and Consonant pops: the piano\'s key down for the note\'s whole beat; the sung note a quarter second at most', () => {
    for (const id of ['bwoop', 'staccato', 'pops']) {
      const x = atLevel(ex(id), 2);
      const { played, notes } = ladderNotes(x, range);
      const keys = played.filter((n) => !n.lead);
      const beat = 60 / (x.engine as { bpm: number }).bpm * PATTERNS[(x.engine as { pattern: keyof typeof PATTERNS }).pattern].dur[0];
      expect(keys[0].d, id).toBeCloseTo(beat, 9);
      expect(notes[0].d, id).toBeLessThanOrEqual(SHORT_LEN);
    }
  });
});

describe('Mum as his course\'s: a half step every round, to the top and back down', () => {
  it('up a half step a round from one above the bottom of the range to the top, then down again to where it began', () => {
    const x = atLevel(ex('mum'), 2);
    const { notes } = ladderNotes(x, range);
    const roots = rungStarts(notes).map((i) => notes[i].m);
    const up = range.hi - 7 - (range.lo + 1) + 1;
    expect(roots.slice(0, up)).toEqual(Array.from({ length: up }, (_, i) => range.lo + 1 + i));
    expect(roots.slice(up - 1)).toEqual([...roots.slice(0, up)].reverse());
    expect(roots[0]).toBe(48);
    /* the Cool-down still steps down only */
    const down = ladderNotes(x, range, { down: true });
    const d = rungStarts(down.notes).map((i) => down.notes[i].m);
    d.forEach((r, k) => k && expect(r - d[k - 1]).toBe(-1));
  });
});
