import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import {
  CATEGORIES, EXERCISES, PATTERNS, ROUTINES, DAILY, exercise, measures, ladderNotes, holdNotes, bubbleScore, HOLD_NOTES,
  MAX_RUNGS, REST_BEATS, rungStarts, firstRung, rungAt, sylOf, notesFor, type Exercise,
} from './exercises';
import { DEFAULT_RANGE, rangeFrom, RANGE_POINTS } from './range';
import { SoundClock, LOUD_RMS, QUIET_END } from './timed';
import { resultRow } from './results';

/* The old app is the checklist (RULEBOOK 2.6): its exercise library, its
   patterns and routines (next.html 7686-8134), its ladder (3700-3752), its
   range check (3754-3790), its timed hiss (9110-9135) and its results
   (rp-cloud.js 870-905). Where the old code is quoted below, it is copied
   as it is there, so the new code is held to what it did. */

/* the old app's exercises; Bratty Bay was dropped (Robert, 28 Oct: Octave repeat sings its pattern) */
const OLD_IDS = ['hiss', 'farinelli', 'liptrill', 'straw', 'hum', 'siren', 'mum', 'mee', 'noo', 'loo', 'gee', 'staccato', 'nay',
  'wah', 'octleap', 'laga', 'tongueout', 'tonguecresc', 'blah', 'yawnsigh', 'messa', 'sustain', 'ninetone', 'descend', 'octrep', 'vfe'];

/* Robert, 28 Oct: new exercises, in our own words */
const NEW_28 = ['buzz', 'raspberry', 'tonguetrill', 'pulses', 'goo', 'guh', 'run5', 'minor5', 'penta', 'chrom', 'turns', 'arp19'];

describe('the exercises, as data', () => {
  it('has every exercise of the old app, and the range check', () => {
    const ours: string[] = [...EXERCISES.filter((e) => e.category === 'words' || e.category === 'pitch').map((e) => e.id), ...NEW_28];
    expect(EXERCISES.map((e) => e.id).filter((id) => id !== 'rangecheck' && !ours.includes(id)).sort()).toEqual([...OLD_IDS].sort());
    expect(exercise('bay')).toBeUndefined();
    expect(exercise('rangecheck')?.engine.kind).toBe('range');
  });

  it('keeps each one\'s group, level and quiet flag as the old app had them', () => {
    const old: Record<string, [string, number, boolean]> = {
      hiss: ['breath', 1, true], farinelli: ['breath', 1, true], liptrill: ['warmup', 1, true], straw: ['warmup', 1, true],
      hum: ['warmup', 1, true], siren: ['warmup', 1, true], mum: ['tone', 1, true], mee: ['tone', 1, true], noo: ['tone', 1, true],
      loo: ['agility', 1, true], gee: ['tone', 2, false], staccato: ['agility', 2, false], nay: ['tone', 2, false],
      wah: ['tone', 1, true], octleap: ['range', 3, false], laga: ['agility', 1, true], tongueout: ['tone', 1, true],
      tonguecresc: ['tone', 2, false], blah: ['agility', 1, true], yawnsigh: ['tone', 1, true], messa: ['breath', 3, false],
      sustain: ['breath', 1, true], ninetone: ['agility', 2, false], descend: ['range', 1, true], octrep: ['range', 3, false], vfe: ['breath', 1, true],
    };
    for (const [id, [cat, level, quiet]] of Object.entries(old)) {
      expect(exercise(id), id).toMatchObject({ category: cat, level, quiet });
    }
  });

  it('runs each one the way the old app did', () => {
    const ladders: Record<string, [string, number]> = {
      liptrill: ['oct15', 100], hum: ['five', 110], mum: ['five', 120], mee: ['five', 120], noo: ['five', 120], loo: ['five', 130],
      gee: ['five', 120], staccato: ['arp', 120], nay: ['oct', 120], wah: ['down3', 100], octleap: ['leap', 100],
      laga: ['five', 132], tongueout: ['down5', 110], ninetone: ['nine', 160], descend: ['down5', 120], octrep: ['octrep', 112],
    };
    for (const [id, [pattern, bpm]] of Object.entries(ladders)) expect(exercise(id)?.engine, id).toEqual({ kind: 'ladder', pattern, bpm });
    expect(exercise('messa')?.engine).toEqual({ kind: 'hold', secs: 10 });
    expect(exercise('sustain')?.engine).toEqual({ kind: 'hold', secs: 8 });
    expect(exercise('hiss')?.engine).toEqual({ kind: 'timed', target: 20 });
    expect(exercise('farinelli')?.engine).toEqual({ kind: 'cycle', counts: [4, 4, 4] });
    expect(exercise('siren')?.engine).toEqual({ kind: 'glide' });
    /* Long soft notes is Stemple's four steps now (Robert, 28 Oct), not a clock */
    expect(exercise('vfe')?.engine).toEqual({ kind: 'vfe' });
    for (const [id, mins] of [['straw', 3], ['tonguecresc', 2], ['blah', 1], ['yawnsigh', 1]] as const) {
      expect(exercise(id)?.engine, id).toEqual({ kind: 'guided', mins });
    }
  });

  it('runs each pattern as the old app did (8063-8075)', () => {
    expect(PATTERNS.five).toEqual({ deg: [0, 2, 4, 5, 7, 5, 4, 2, 0], dur: [1, 1, 1, 1, 2, 1, 1, 1, 2], span: 7 });
    expect(PATTERNS.down5).toEqual({ deg: [7, 5, 4, 2, 0], dur: [1, 1, 1, 1, 2], span: 7 });
    expect(PATTERNS.down3).toEqual({ deg: [4, 2, 0], dur: [1, 1, 2], span: 4 });
    expect(PATTERNS.arp).toEqual({ deg: [0, 4, 7, 4, 0], dur: [1, 1, 2, 1, 2], span: 7 });
    expect(PATTERNS.oct).toEqual({ deg: [0, 4, 7, 12, 7, 4, 0], dur: [1, 1, 1, 2, 1, 1, 2], span: 12 });
    expect(PATTERNS.octrep).toEqual({ deg: [0, 4, 7, 12, 12, 12, 12, 7, 4, 0], dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2], span: 12 });
    expect(PATTERNS.nine).toEqual({ deg: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0],
      dur: [1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2], span: 14 });
    expect(PATTERNS.oct15).toEqual({ deg: [0, 4, 7, 12, 16, 19, 17, 14, 12, 9, 7, 5, 2, 0],
      dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], span: 19 });
  });

  it('has a name, a syllable, a one-line goal and a one-line how for each, in the copy', () => {
    for (const e of EXERCISES) {
      const c = copy.ex[e.id as keyof typeof copy.ex];
      expect(c, e.id).toBeDefined();
      /* the Pitch group sings note names and jumps, not a syllable */
      for (const k of ['name', 'syl', 'goal', 'how'] as const) if (!(k === 'syl' && e.category === 'pitch')) expect(c[k], e.id + '.' + k).toMatch(/\S/);
    }
  });

  it('says what it measures, and only that (7672-7684)', () => {
    const by = (kind: string) => EXERCISES.filter((e) => e.engine.kind === kind).map(measures);
    expect(new Set(by('ladder'))).toEqual(new Set(['pitch']));
    expect(new Set(by('hold'))).toEqual(new Set(['pitch']));
    expect(by('timed')).toEqual(['time']);
    expect(new Set([...by('cycle'), ...by('glide'), ...by('guided')])).toEqual(new Set(['none']));
    expect(measures(exercise('rangecheck') as Exercise)).toBe('range');
  });

  it('has its seven groups by colour: Range and Pitch with Agility\'s blue, Articulation in a colour of its own (1b; Robert, 23, 25 and 28 Oct)', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(['warmup', 'breath', 'tone', 'agility', 'range', 'words', 'pitch']);
    expect(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.colour]))).toEqual({
      warmup: 'warmup', breath: 'breath', tone: 'tone', agility: 'pitch', range: 'pitch', words: 'words', pitch: 'pitch' });
    const others = CATEGORIES.filter((c) => c.id !== 'words').map((c) => c.colour);
    expect(others).not.toContain(CATEGORIES.find((c) => c.id === 'words')?.colour);
    for (const e of EXERCISES) expect(CATEGORIES.some((c) => c.id === e.category), e.id).toBe(true);
  });
});

describe('the routines', () => {
  it('has the old app\'s routines and cool-down, in its warm-up order (8100-8125)', () => {
    expect(ROUTINES.daily).toEqual({ mins: 9, steps: ['hiss', 'liptrill', 'siren', 'mum', 'descend', 'mee', 'yawnsigh'] });
    expect(ROUTINES.intermediate).toEqual({ mins: 16,
      steps: ['hiss', 'farinelli', 'liptrill', 'descend', 'mum', 'mee', 'tongueout', 'laga', 'nay', 'wah', 'staccato', 'ninetone'] });
    expect(ROUTINES.advanced).toEqual({ mins: 20,
      /* Bratty Bay dropped (Robert, 28 Oct): Octave repeat, its pattern, in its place */
      steps: ['farinelli', 'straw', 'liptrill', 'descend', 'hum', 'tongueout', 'laga', 'octrep', 'ninetone', 'staccato', 'octleap', 'messa'] });
    expect(ROUTINES.quiet).toEqual({ mins: 10, steps: ['hiss', 'farinelli', 'liptrill', 'hum', 'siren', 'mum', 'noo', 'tongueout'] });
    expect(ROUTINES.cooldown).toEqual({ mins: 3, steps: ['straw', 'hum', 'descend'] });
    expect(DAILY).toBe('daily');
    for (const r of Object.values(ROUTINES)) for (const s of r.steps) expect(exercise(s), s).toBeDefined();
  });
});

/* the old app's ladder, as it is in next.html 3706-3740 (rest 2 beats) */
function oldLadder(deg: readonly number[], dur: readonly number[], span: number, lo0: number, hi0: number) {
  const lo = lo0 + 1;
  const topRoot = hi0 - span;
  let roots: number[] = [];
  for (let r = lo; r <= topRoot; r++) roots.push(r);
  if (roots.length === 0) roots = [lo];
  if (roots.length > 14) {
    const step = Math.ceil(roots.length / 14);
    roots = roots.filter((_, i) => i % step === 0);
  }
  const notes: Array<{ m: number; t: number; d: number }> = [];
  let t = 0;
  roots.forEach((root) => {
    deg.forEach((dg, i) => {
      notes.push({ m: root + dg, t, d: dur[i] });
      t += dur[i];
    });
    t += 2;
  });
  return notes;
}

describe('the ladder climbs your range as the old app did (3700-3752)', () => {
  it('for every pattern, from one above your lowest to your highest less the span, at most 14 rungs, two beats apart', () => {
    expect(MAX_RUNGS).toBe(14);
    expect(REST_BEATS).toBe(2);
    for (const e of EXERCISES) {
      if (e.engine.kind !== 'ladder') continue;
      const p = PATTERNS[e.engine.pattern];
      const beat = 60 / e.engine.bpm;
      for (const range of [DEFAULT_RANGE, { lo: 40, hi: 64 }, { lo: 53, hi: 81 }, { lo: 55, hi: 60 }]) {
        const want = oldLadder(p.deg, p.dur, p.span, range.lo, range.hi);
        const got = ladderNotes(e, range);
        expect(got.notes.map((n) => n.m), e.id).toEqual(want.map((n) => n.m));
        got.notes.forEach((n, i) => {
          expect(n.t, e.id).toBeCloseTo(want[i].t * beat, 6);
          expect(n.d, e.id).toBeCloseTo(want[i].d * beat, 6);
        });
      }
    }
  });

  it('carries each note\'s syllable, and the first of each rung its note name too', () => {
    const got = ladderNotes(exercise('mum') as Exercise, DEFAULT_RANGE);
    expect(got.notes[0].syl).toBe('A♯2 · mum');
    expect(got.notes[1].syl).toBe('mum');
  });

  it('holds five notes, evenly through your range, three seconds apart', () => {
    const e = exercise('sustain') as Exercise;
    const got = holdNotes(e, DEFAULT_RANGE);
    expect(got.notes.length).toBe(HOLD_NOTES);
    expect(got.notes.map((n) => n.m)).toEqual([48, 53, 57, 62, 66]);
    expect(got.notes.every((n) => n.d === 8)).toBe(true);
    expect(got.notes[1].t - got.notes[0].t).toBe(11);
  });
});

describe('the bubbles (RULEBOOK 4, Bubbles)', () => {
  const notes = [{ m: 60, t: 0, d: 1, syl: '' }, { m: 62, t: 1, d: 1, syl: '' }, { m: 64, t: 2, d: 1, syl: '' }];
  const hop = 0.05;
  const line = (f: (t: number) => number, upTo = 3) => {
    const t: number[] = [], m: number[] = [];
    for (let i = 0; i * hop < upTo - 1e-9; i++) { t.push(i * hop); m.push(f(i * hop)); }
    return { t, m };
  };

  it('a hit is half the note within a semitone, and the fill is the same share', () => {
    /* the first note sung right for 0.6 of it, the second for 0.4, the third not at all */
    const { t, m } = line((x) => (x < 0.6 ? 60.3 : x < 1 ? 55 : x < 1.4 ? 61.6 : x < 2 ? 50 : 70));
    const s = bubbleScore(notes, t, m, hop, false);
    expect(s.fill.map((f) => Math.round(f * 100) / 100)).toEqual([0.6, 0.4, 0]);
    expect(s.hit).toEqual([true, false, false]);
    expect(s.hits).toBe(1);
    expect(s.n).toBe(3);
    expect(s.sung).toBe(true);
  });

  it('within a semitone means the note itself: half a semitone either side', () => {
    const near = bubbleScore([notes[0]], ...Object.values(line(() => 60.49, 1)) as [number[], number[]], hop, false);
    const far = bubbleScore([notes[0]], ...Object.values(line(() => 60.51, 1)) as [number[], number[]], hop, false);
    expect(near.hits).toBe(1);
    expect(far.hits).toBe(0);
  });

  it('rounds time before comparing: a point at 0.9999999 belongs to the note ending at 1', () => {
    /* the float bug that once lost 63 of 488 notes */
    const t = [0.2, 0.45, 0.9999999 - 0.5, 0.9999999], m = [60, 60, 60, 62];
    const s = bubbleScore([{ m: 62, t: 1, d: 0.1, syl: '' }], t, m, hop, false);
    expect(s.fill[0]).toBeGreaterThan(0);
  });

  it('is octave exact, unless Any octave is on', () => {
    const { t, m } = line((x) => (x < 1 ? 48 : x < 2 ? 50 : 52));
    expect(bubbleScore(notes, t, m, hop, false).hits).toBe(0);
    expect(bubbleScore(notes, t, m, hop, true).hits).toBe(3);
  });

  it('scores nothing that was not sung', () => {
    const s = bubbleScore(notes, [], [], hop, false);
    expect(s.hits).toBe(0);
    expect(s.sung).toBe(false);
  });
});

describe('the range (rp-range.js; the range check, next.html 3754-3790)', () => {
  it('is A2 to A4 until it is measured', () => {
    expect(DEFAULT_RANGE).toEqual({ lo: 45, hi: 69 });
  });

  it('measures four seconds of singing at each end: the 5th and the 95th percentile', () => {
    expect(RANGE_POINTS).toBe(80);
    const low = Array.from({ length: 80 }, (_, i) => 40 + (i % 20) / 2);
    const high = Array.from({ length: 80 }, (_, i) => 60 + (i % 20) / 2);
    /* as the old app's percentile reads them: the 5th of the low is 40.5, rounded to 41 */
    expect(rangeFrom(low, high)).toEqual({ lo: 41, hi: 70 });
  });

  it('keeps at least seven notes between them, or makes it an octave', () => {
    expect(rangeFrom(Array(80).fill(55), Array(80).fill(59))).toEqual({ lo: 55, hi: 67 });
  });
});

describe('the timed hiss (9110-9135; Robert, 1 Oct)', () => {
  it('times itself from the first sound and stops after a second of quiet', () => {
    expect(LOUD_RMS).toBeCloseTo(0.01);
    expect(QUIET_END).toBe(1);
    const c = new SoundClock();
    const feed = (from: number, to: number, rms: number) => {
      for (let t = from; t < to - 1e-9; t += 0.1) c.feed(Math.round(t * 10) / 10, rms);
    };
    feed(0, 2, 0.001);
    expect(c.state()).toMatchObject({ heard: false, done: false });
    feed(2, 9, 0.05);
    expect(c.state()).toMatchObject({ heard: true, done: false });
    expect(c.state().held).toBeCloseTo(6.9, 1);
    feed(9, 10.2, 0.001);
    expect(c.state()).toMatchObject({ done: true });
    expect(c.state().held).toBeCloseTo(6.9, 1);          /* first sound to last, as the old app counted it */
    feed(10.2, 12, 0.05);
    expect(c.state().held).toBeCloseTo(6.9, 1);          /* the result stays */
  });
});

describe('a result, with only what was measured (rp-cloud.js 870-905, rp-score.js)', () => {
  it('a sung exercise: notes hit of notes, and the %', () => {
    expect(resultRow(exercise('mum') as Exercise, { kind: 'pitch', hits: 7, n: 9 })).toEqual(
      { kind: 'practice', label: 'Mum', app_ex_id: 'mum', score: 7, out_of: 9, pct: 78 });
  });
  it('the hiss: the seconds held, of the seconds aimed for', () => {
    expect(resultRow(exercise('hiss') as Exercise, { kind: 'time', seconds: 12.34 })).toEqual(
      { kind: 'practice', label: 'Steady hiss', app_ex_id: 'hiss', score: 12, out_of: 20, seconds: 12.3 });
  });
  it('anything not measured: that it was done, and no number', () => {
    expect(resultRow(exercise('straw') as Exercise, { kind: 'none' })).toEqual({ kind: 'practice', label: copy.ex.straw.name, app_ex_id: 'straw' });
    expect(resultRow(exercise('mum') as Exercise, { kind: 'none' })).toEqual({ kind: 'practice', label: 'Mum', app_ex_id: 'mum' });
  });
});

describe('the rungs of an exercise (the progress dots, the pattern card)', () => {
  const mum = EXERCISES.find((e) => e.id === 'mum') as Exercise;
  const range = { lo: 50, hi: 62 };
  const { notes } = ladderNotes(mum, range);
  it('begin at the notes that carry a note name, one per run of the pattern', () => {
    const starts = rungStarts(notes);
    expect(starts.length).toBe(62 - 7 - 51 + 1);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBe(PATTERNS.five.deg.length);
  });
  it('the first rung is the pattern alone', () => {
    expect(firstRung(notes).length).toBe(PATTERNS.five.deg.length);
    expect(firstRung(notes).map((n) => n.m - 51)).toEqual([...PATTERNS.five.deg]);
  });
  it('knows which rung is being sung', () => {
    expect(rungAt(notes, -1)).toBe(-1);
    expect(rungAt(notes, 0)).toBe(0);
    expect(rungAt(notes, notes[PATTERNS.five.deg.length].t)).toBe(1);
    expect(rungAt(notes, notes[PATTERNS.five.deg.length].t - 0.01)).toBe(0);
    const last = notes[notes.length - 1];
    expect(rungAt(notes, last.t + last.d + 1)).toBe(rungStarts(notes).length);
  });
  it('a held note is a rung of its own', () => {
    const sus = EXERCISES.find((e) => e.id === 'sustain') as Exercise;
    expect(rungStarts(holdNotes(sus, range).notes)).toEqual([0, 1, 2, 3, 4]);
  });
  it('the syllable alone, without the note name', () => {
    expect(sylOf(notes[0])).toBe('mum');
    expect(sylOf(notes[1])).toBe('mum');
    expect(notes[0].syl).not.toBe('mum');
  });
});

describe('Articulation: clear words while singing (Robert, 25 Oct)', () => {
  const range = { lo: 50, hi: 62 };
  it('has its exercises, each with notes and so scored on pitch', () => {
    const ids = EXERCISES.filter((e) => e.category === 'words').map((e) => e.id);
    expect(ids).toEqual(['vowels', 'redleather', 'uniqueny', 'peterpiper', 'pops', 'tonguetip', 'lipstongue']);
    for (const id of ids) {
      const e = exercise(id) as Exercise;
      expect(e.engine.kind, id).toBe('ladder');
      expect(measures(e), id).toBe('pitch');
      expect((copy.ex[id] as { syls?: readonly string[] }).syls?.length, id).toBeGreaterThan(1);
    }
  });
  it('the five vowels sit on one held note, then step up', () => {
    const { notes } = ladderNotes(exercise('vowels') as Exercise, range);
    const first = notes.slice(0, 5);
    expect(first.map((n) => n.m)).toEqual([51, 51, 51, 51, 51]);
    expect(first.map(sylOf)).toEqual(['mah', 'meh', 'mee', 'moh', 'moo']);
    expect(notes[5].m).toBe(52);
    expect(sylOf(notes[5])).toBe('mah');
  });
  it('a tongue twister fits its pattern exactly: a syllable a note, ending on the last, the same every repeat (Robert, 28 Oct)', () => {
    for (const id of ['redleather', 'uniqueny', 'peterpiper'] as const) {
      const e = exercise(id) as Exercise;
      const syls = copy.ex[id].syls as readonly string[];
      expect(e.engine.kind === 'ladder' && PATTERNS[e.engine.pattern].deg.length, id).toBe(syls.length);
      const { notes } = ladderNotes(e, range);
      const starts = rungStarts(notes);
      for (let r = 0; r < starts.length; r++) {
        expect(notes.slice(starts[r], starts[r + 1] ?? notes.length).map(sylOf), `${id} repeat ${r + 1}`).toEqual([...syls]);
      }
    }
  });
  it('consonant pops are short repeated notes', () => {
    const e = exercise('pops') as Exercise;
    const { notes } = ladderNotes(e, range);
    const rung = firstRung(notes);
    expect(new Set(rung.map((n) => n.m)).size).toBe(1);
    expect(rung.every((n) => n.d <= 0.35)).toBe(true);
    expect(rung.map(sylOf).slice(0, 4)).toEqual(['puh', 'buh', 'tuh', 'duh']);
  });
  it('the tongue tip goes up on one sound and down on another; the lips and tongue carry the whole phrase', () => {
    const tip = firstRung(ladderNotes(exercise('tonguetip') as Exercise, range).notes).map(sylOf);
    expect(tip).toEqual(['la', 'la', 'la', 'la', 'la', 'ta', 'ta', 'ta', 'ta']);
    const lips = firstRung(ladderNotes(exercise('lipstongue') as Exercise, range).notes).map(sylOf);
    expect(lips.length).toBe(9);
    expect(lips.join(' ')).toBe((copy.ex.lipstongue.syls as readonly string[]).join(' '));
  });
  it('an exercise with one syllable still carries it on every note', () => {
    const { notes } = ladderNotes(exercise('mum') as Exercise, range);
    expect(new Set(notes.map(sylOf))).toEqual(new Set(['mum']));
  });
});

/* Robert, 27 Oct: the syllables on each note follow the old app's syl
   strings (next.html 7686-8099, copied here as they are). "la-ga la-ga"
   alternates a syllable a note; "mmm / nnn / ng" are three hums, one a
   repeat; "a · b" lists other ways to sing it, and the first is sung. */
const OLD_SYL: Record<string, string> = {
  liptrill: 'brrr', hum: 'mmm / nnn / ng', mum: 'mum', mee: 'mee', noo: 'noo', loo: 'loo · lah', gee: 'gee · kee', staccato: 'bah · hoo',
  nay: 'nay', wah: 'wah', octleap: 'ma', laga: 'la-ga la-ga', tongueout: 'ah · uh', messa: 'ah · oh · oo', sustain: 'ee · ah',
  ninetone: 'lah · nay · numbers', descend: 'oo · ol', octrep: 'buh · mum · nay',
};
describe('the syllables on each note (Robert, 27 Oct)', () => {
  const range = { lo: 50, hi: 64 };
  const sung = (id: string) => {
    const e = exercise(id) as Exercise;
    const { notes } = notesFor(e, range);
    const starts = rungStarts(notes);
    return starts.map((s, k) => notes.slice(s, starts[k + 1] ?? notes.length).map(sylOf));
  };
  it('La-Ga alternates one syllable a note, la first on every repeat', () => {
    const rungs = sung('laga');
    expect(rungs[0]).toEqual(['la', 'ga', 'la', 'ga', 'la', 'ga', 'la', 'ga', 'la']);
    for (const r of rungs) expect(r[0]).toBe('la');
  });
  it('the three hums change with each repeat: mmm, nnn, ng, and round again', () => {
    const rungs = sung('hum');
    expect(rungs.slice(0, 4).map((r) => [...new Set(r)])).toEqual([['mmm'], ['nnn'], ['ng'], ['mmm']]);
  });
  it('every sung syllable comes from the old app\'s string, and the first of a list of choices is the one sung', () => {
    for (const [id, old] of Object.entries(OLD_SYL)) {
      const tokens = old.split(/[\s·/-]+/).filter(Boolean);
      const all = sung(id).flat();
      for (const s of new Set(all)) expect(tokens, `${id}: "${s}" is not in "${old}"`).toContain(s);
      if (/·/.test(old)) {
        const first = old.split('·')[0].trim();
        /* the one exception: tongue-out is sung on "uh", the old app's own how (its version 2) */
        expect(new Set(all), id).toEqual(new Set([id === 'tongueout' ? 'uh' : first]));
      }
    }
  });
});

describe('the content round (Robert, 28 Oct)', () => {
  const range = { lo: 48, hi: 67 };
  const rung = (id: string) => firstRung(ladderNotes(exercise(id) as Exercise, range).notes);
  it('Octave leaps is a true leap: low note, straight to the octave, back down', () => {
    expect(rung('octleap').map((n) => n.m - 49)).toEqual([0, 12, 0]);
    expect(rung('octleap').map(sylOf)).toEqual(['ma', 'ma', 'ma']);
  });
  it('the new exercises: their groups, levels, patterns and syllables', () => {
    const want: Record<string, [string, number, number[], string[]]> = {
      buzz: ['warmup', 1, [0, 2, 4, 5, 7, 5, 4, 2, 0], ['vvv']],
      tonguetrill: ['warmup', 2, [0, 2, 4, 5, 7, 5, 4, 2, 0], ['rrr']],
      goo: ['tone', 1, [0, 4, 7, 4, 0], ['goo']],
      guh: ['tone', 2, [0, 4, 7, 12, 7, 4, 0], ['guh']],
      run5: ['agility', 1, [0, 2, 4, 5, 7, 5, 4, 2, 0], ['my']],
      minor5: ['agility', 2, [0, 2, 3, 5, 7, 5, 3, 2, 0], ['my']],
      penta: ['agility', 2, [0, 2, 4, 7, 9, 7, 4, 2, 0], ['my']],
      chrom: ['agility', 3, [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], ['my']],
      turns: ['agility', 3, [4, 2, 0, 5, 4, 2, 7, 5, 4, 9, 7, 5], ['my']],
      arp19: ['range', 3, [0, 4, 7, 12, 16, 19, 16, 12, 7, 4, 0], ['nay']],
    };
    for (const [id, [cat, level, deg, syls]] of Object.entries(want)) {
      expect(exercise(id), id).toMatchObject({ category: cat, level });
      const r = rung(id);
      expect(r.map((n) => n.m - r[0].m + deg[0]), id).toEqual(deg);
      expect([...new Set(r.map(sylOf))], id).toEqual(syls);
      expect(measures(exercise(id) as Exercise), id).toBe('pitch');
    }
    expect(exercise('raspberry')).toMatchObject({ category: 'warmup', level: 1, engine: { kind: 'glide' } });
    expect(measures(exercise('raspberry') as Exercise)).toBe('none');
    expect(exercise('pulses')).toMatchObject({ category: 'breath', level: 1, engine: { kind: 'guided' } });
  });
  it('the buzz is a repeat on "vvv", then a repeat on "zzz"', () => {
    const { notes } = ladderNotes(exercise('buzz') as Exercise, range);
    const s = rungStarts(notes);
    expect([sylOf(notes[s[0]]), sylOf(notes[s[1]]), sylOf(notes[s[2]])]).toEqual(['vvv', 'zzz', 'vvv']);
  });
  it('the runs go faster at higher levels', () => {
    const bpm = (id: string) => { const e = exercise(id) as Exercise; return e.engine.kind === 'ladder' ? e.engine.bpm : 0; };
    expect(bpm('run5')).toBeLessThan(bpm('minor5'));
    expect(bpm('minor5')).toBe(bpm('penta'));
    expect(bpm('penta')).toBeLessThan(bpm('chrom'));
    expect(bpm('chrom')).toBe(bpm('turns'));
  });
  it('Loo is sung on "loo", by its plain name', () => {
    expect(copy.ex.loo.name).toBe('Loo');
    expect(new Set(rung('loo').map(sylOf))).toEqual(new Set(['loo']));
  });
});
