import { describe, expect, it } from 'vitest';
import {
  EXERCISES, PATTERNS, atLevel, bubbleScore, exercise, exerciseSecs, holdNotes, ladderNotes, measures, notesFor, rungStarts,
  HOLD_LEAD, HOLD_REST, SHORT_LEN, SING_LAG, type Exercise,
} from './exercises';
import { toneParts, seeded, TONE_LEAD, TONE_NOTES, TONE_SECS } from './pitch';
import { copy } from './copy';
import { stepsFor } from './exercises';

/* Robert's 20 Nov round: the timing pause, the lead note, short notes,
   Note bends' twitch, Match the tone's levels and score. */
const ex = (id: string) => exercise(id) as Exercise;
const range = { lo: 50, hi: 62 };
const HOP = 0.05;

/** a line the way the app draws one: a point every HOP, from `from` to `to`, on note m */
function sungLine(parts: ReadonlyArray<{ m: number; from: number; to: number }>) {
  const t: number[] = [], m: number[] = [];
  for (let k = 0; k * HOP < 200; k++) {
    const at = k * HOP;
    const p = parts.find((x) => at >= x.from && at < x.to);
    t.push(at);
    m.push(p ? p.m : NaN);
  }
  return { t, m };
}

describe('the pause (Robert, 13 and 20 Nov): each note checked a moment after its piano note', () => {
  it('is the voice\'s arrival measured from his takes, 0.14 s by the app\'s line, not a whole second', () => {
    expect(SING_LAG).toBe(0.14);
    expect(SING_LAG).toBeLessThan(1);
  });
  it('moves every note\'s whole window: the same note, the same length, SING_LAG after the piano', () => {
    for (const e of EXERCISES) {
      if (e.engine.kind !== 'ladder' && e.engine.kind !== 'hold') continue;
      const { notes, played } = notesFor(e, range);
      const piano = played.filter((n) => !n.lead);
      expect(piano.length, e.id).toBe(notes.length);
      notes.forEach((n, i) => {
        expect(n.m, e.id).toBe(piano[i].m);
        /* a short note is sung short over the piano's whole note (23 Nov) */
        if (e.shortNotes) expect(n.d, e.id).toBeCloseTo(Math.min(SHORT_LEN, piano[i].d), 9);
        else expect(n.d, e.id).toBeCloseTo(piano[i].d, 9);
        expect(n.t - piano[i].t, e.id).toBeCloseTo(SING_LAG, 9);
      });
    }
  });
  it('the first note of every round counts when sung on time from silence; wrong notes still score low', () => {
    for (const id of ['run5', 'mum', 'nay', 'ninetone', 'sustain']) {
      for (const level of [1, 2, 3] as const) {
        const e = atLevel(ex(id), level);
        const { notes, played } = notesFor(e, range);
        const piano = played.filter((n) => !n.lead);
        /* the voice starts with the piano and the line shows it 0.05 s later, as the app's reader does */
        const voice = (shift: number) => sungLine(piano.map((n) => ({ m: n.m + shift, from: n.t + 0.05, to: n.t + n.d + 0.05 })));
        const right = bubbleScore(notes, voice(0).t, voice(0).m, HOP, false);
        const starts = rungStarts(notes);
        expect(starts.every((i) => right.hit[i]), `${id} ${level}: the first of each round`).toBe(true);
        expect(right.hits, `${id} ${level}`).toBe(right.n);
        const off = bubbleScore(notes, voice(3).t, voice(3).m, HOP, false);
        expect(off.hits, `${id} ${level} three half steps off`).toBe(0);
      }
    }
  });
  it('a reading before the pause is not checked: it belongs to the note before, or to none', () => {
    const { notes, played } = ladderNotes(ex('mum'), range);
    const first = played.find((n) => !n.lead) as { t: number; m: number };
    /* on the note only from the piano's moment to just before the pause: never counted */
    const early = sungLine([{ m: first.m, from: first.t, to: first.t + SING_LAG - 0.01 }]);
    expect(bubbleScore(notes, early.t, early.m, HOP, false).fill[0]).toBe(0);
  });
});

describe('the lead note (Robert, 20 Nov): the round\'s first note alone before every round', () => {
  it('before every round of every exercise that moves round by round, the first included; never sung, never scored', () => {
    for (const e of EXERCISES) {
      if (e.engine.kind !== 'ladder' && e.engine.kind !== 'hold') continue;
      for (const lv of [1, 2, 3] as const) {
        const x = atLevel(e, lv);
        const { notes, played, beat } = notesFor(x, range);
        const leads = played.filter((n) => n.lead);
        const starts = rungStarts(notes);
        expect(leads.length, e.id).toBe(starts.length);
        expect(notes.some((n) => n.lead), e.id).toBe(false);
        const piano = played.filter((n) => !n.lead);
        const firstOf = rungStarts(piano.map((_, i) => notes[i]));
        leads.forEach((l, r) => {
          const n = piano[firstOf[r]];
          /* the same note, ending as the round begins */
          expect(l.m, e.id).toBe(n.m);
          expect(l.t + l.d, e.id).toBeCloseTo(n.t, 9);
          /* 23 Nov: as long as one note of the round (a hold's stays HOLD_LEAD) */
          expect(l.d, e.id).toBeCloseTo(x.engine.kind === 'hold' ? HOLD_LEAD : PATTERNS[(x.engine as { pattern: keyof typeof PATTERNS }).pattern].dur[0] * beat, 9);
          /* in the rest: after the round before has ended, with room between */
          if (r > 0) {
            const prev = piano[firstOf[r] - 1];
            expect(l.t - (prev.t + (x.shortNotes ? PATTERNS[(x.engine as { pattern: keyof typeof PATTERNS }).pattern].dur.at(-1) as number * beat : prev.d)), e.id)
              .toBeCloseTo(x.engine.kind === 'hold' ? HOLD_REST - HOLD_LEAD : beat, 6);
          }
        });
      }
    }
  });
  it('the listed length counts it: the last piano note\'s end and the count-in', () => {
    const e = ex('mum');
    const { played, beat } = ladderNotes(e, range);
    const last = played[played.length - 1];
    expect(exerciseSecs(e, range)).toBeCloseTo(last.t + last.d + 3 * beat, 6);
    const h = holdNotes(ex('sustain'), range);
    expect(h.length).toBeCloseTo(5 * HOLD_LEAD + 5 * 8 + 4 * (HOLD_REST - HOLD_LEAD), 6);
  });
});

describe('short notes (Robert, 20 Nov: "the bubbles should be as short as the notes"; 23 Nov: "short notes must not be chopped")', () => {
  it('Staccato, Consonant pops and Bwoop: sung and drawn a quarter second at most; the piano plays each whole, its beat, as every note', () => {
    expect(SHORT_LEN).toBe(0.25);
    for (const id of ['staccato', 'pops', 'bwoop']) {
      const e = ex(id);
      const { notes, played } = ladderNotes(e, range);
      const beat = 60 / (e.engine as { bpm: number }).bpm, p = PATTERNS[(e.engine as { pattern: keyof typeof PATTERNS }).pattern];
      expect(notes.every((n) => n.d <= SHORT_LEN + 1e-9), id).toBe(true);
      expect(played.filter((n) => !n.lead).every((n) => Math.abs(n.d - p.dur[0] * beat) < 1e-9), id).toBe(true);
      /* each key let go as the next is pressed: one after another at the pattern's timing */
      const keys = played.filter((n) => !n.lead).slice(0, p.deg.length);
      keys.slice(1).forEach((k, i) => expect(k.t, id).toBeCloseTo(keys[i].t + keys[i].d, 9));
    }
    expect(ladderNotes(atLevel(ex('mum'), 2), range).notes[0].d).toBeCloseTo(0.5, 9);
  });
  it('Bwoop is still "bwoop", scored by the short-note rule', () => {
    expect(copy.ex.bwoop.syl).toBe('bwoop');
    expect(measures(ex('bwoop'))).toBe('pitch');
  });
});

describe('Note bends (Robert, 20 Nov): a fast twitch', () => {
  it('note, neighbour, note, neighbour, note, neighbour, note, flicks of 0.15 to 0.2 s back to back, line shown, not scored', () => {
    const { notes } = ladderNotes(ex('bends'), range);
    const r0 = notes.slice(0, PATTERNS.bend.deg.length);
    expect(r0.map((n) => n.m - r0[0].m)).toEqual([0, 1, 0, 1, 0, 1, 0]);
    expect(r0.slice(1, -1).every((n) => n.d >= 0.15 && n.d <= 0.2)).toBe(true);
    expect(measures(ex('bends'))).toBe('none');
  });
});

describe('Match the tone (Robert, 20 Nov): shorter holds, levels, a score', () => {
  it('holds 4 s after 2 s to find it: long enough to hear the wobble and still it', () => {
    expect(TONE_LEAD).toBe(2);
    expect(TONE_SECS).toBe(4);
  });
  it('Beginner in order, a whole step a note; Intermediate and Advanced at random; ten notes in the range', () => {
    const r = { lo: 45, hi: 69 };
    const order = toneParts(r, seeded(0.2), 'order').map((p) => (p.kind === 'tone' ? p.m : 0));
    expect(order.length).toBe(TONE_NOTES);
    for (let i = 1; i < order.length; i++) expect(order[i] - order[i - 1] === 2 || order[i] < order[i - 1]).toBe(true);
    for (const mode of ['random', 'hidden'] as const) {
      const a = toneParts(r, seeded(0.2), mode).map((p) => (p.kind === 'tone' ? p.m : 0));
      expect(a.length).toBe(TONE_NOTES);
      expect(a.every((m) => m >= r.lo + 2 && m <= r.hi - 2)).toBe(true);
      expect(a.join()).not.toBe(order.join());
      for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
    }
  });
  it('scored, with its listed length from its holds; its page says its job', () => {
    expect(measures(ex('matchtone'))).toBe('pitch');
    expect(exerciseSecs(ex('matchtone'), range)).toBe(TONE_NOTES * (3 + TONE_LEAD + TONE_SECS + 3));
    expect(copy.ex.matchtone.goal).toMatch(/wobble/);
    expect(stepsFor('matchtone').join(' ')).toMatch(/hear the wobble between your voice and the tone, and make it disappear/);
    expect(stepsFor('matchtone', { level: 3 }).join(' ')).toMatch(/hidden until the tone stops/);
  });
});
