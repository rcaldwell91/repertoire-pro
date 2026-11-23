import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import {
  CATEGORIES, EXERCISES, PATTERNS, ROUTINES, DAILY, exercise, measures, ladderNotes, holdNotes, bubbleScore, HOLD_NOTES,
  MAX_RUNGS, REST_BEATS, rungStarts, firstRung, rungAt, sylOf, notesFor, atLevel, levelsOf, stepsFor, listed, type Exercise,
  SING_LAG, SHORT_LEN,
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
/* Robert, 3 Nov: six more, from his spec */
const NEW_3NOV = ['posture', 'tensioncheck', 'cheekpuffs', 'chewhum', 'tonguefwd', 'brighta'];
/* Robert's 4 Nov review: three more */
const NEW_4NOV = ['neckrelease', 'threestep', 'matchtone'];
/* Robert, 16 Nov: four more */
const NEW_16NOV = ['restnote', 'threerun', 'bends', 'bwoop'];

describe('the exercises, as data', () => {
  it('has every exercise of the old app, and the range check', () => {
    const ours: string[] = [...EXERCISES.filter((e) => e.category === 'words' || e.category === 'pitch').map((e) => e.id), ...NEW_28, ...NEW_3NOV, ...NEW_4NOV, ...NEW_16NOV];
    expect(EXERCISES.map((e) => e.id).filter((id) => id !== 'rangecheck' && !ours.includes(id)).sort()).toEqual([...OLD_IDS].sort());
    expect(exercise('bay')).toBeUndefined();
    expect(exercise('rangecheck')?.engine.kind).toBe('range');
  });

  it('keeps each one\'s group, level and quiet flag as the old app had them', () => {
    const old: Record<string, [string, number, boolean]> = {
      hiss: ['breath', 1, true], farinelli: ['breath', 1, true], liptrill: ['warmup', 1, true], straw: ['warmup', 1, true],
      hum: ['warmup', 1, true], siren: ['warmup', 1, true], mum: ['tone', 1, true], mee: ['tone', 1, true], noo: ['tone', 1, true],
      /* Bratty Nay starts at Beginner now, on the five-note scale (Robert, 3 Nov) */
      loo: ['agility', 1, true], gee: ['tone', 2, false], staccato: ['agility', 2, false], nay: ['tone', 1, false],
      wah: ['tone', 1, true], octleap: ['range', 3, false], laga: ['agility', 1, true], tongueout: ['tone', 1, true],
      tonguecresc: ['tone', 2, false], blah: ['agility', 1, true], yawnsigh: ['tone', 1, true], messa: ['breath', 3, false],
      sustain: ['breath', 1, true], ninetone: ['agility', 1, false], /* the old app's 2, until it got a Beginner (Robert, 22 Nov) */ descend: ['range', 1, true], octrep: ['range', 3, false], vfe: ['breath', 1, true],
    };
    /* as listed: since 21 Nov every scored one is sung at three levels, its own speed the Intermediate */
    for (const [id, [cat, level, quiet]] of Object.entries(old)) {
      expect(listed(id), id).toMatchObject({ category: cat, level, quiet });
    }
  });

  it('runs each one the way the old app did', () => {
    const ladders: Record<string, [string, number]> = {
      hum: ['five', 110], mum: ['five', 120], mee: ['five', 120], noo: ['five', 120], loo: ['five', 130],
      gee: ['five', 120], staccato: ['arp', 120], wah: ['down3', 100], octleap: ['leap', 100],
      tongueout: ['down5', 110], descend: ['down5', 120], octrep: ['octrep', 112],
    };
    /* the old app's speed is the Intermediate level now (Robert, 21 Nov) */
    for (const [id, [pattern, bpm]] of Object.entries(ladders)) {
      expect(listed(id)?.engine, id).toEqual({ kind: 'ladder', pattern, bpm });
      expect(atLevel(exercise(id) as Exercise, 2).engine, id).toEqual({ kind: 'ladder', pattern, bpm });
    }
    /* the old app's pattern kept as a level: La-Ga's five-note scale, Bratty Nay's octave (Robert, 3 Nov) */
    expect(atLevel(exercise('laga') as Exercise, 2).engine).toEqual({ kind: 'ladder', pattern: 'five', bpm: 132 });
    expect(atLevel(exercise('nay') as Exercise, 2).engine).toEqual({ kind: 'ladder', pattern: 'oct', bpm: 120 });
    /* and the old app's lip trills and nine-tone scale, kept as the top level (Robert, 4 Nov) */
    expect(atLevel(exercise('liptrill') as Exercise, 3).engine).toEqual({ kind: 'ladder', pattern: 'oct15', bpm: 100 });
    expect(atLevel(exercise('ninetone') as Exercise, 3).engine).toEqual({ kind: 'ladder', pattern: 'nine', bpm: 160 });
    expect(exercise('messa')?.engine).toEqual({ kind: 'hold', secs: 10 });
    expect(exercise('sustain')?.engine).toEqual({ kind: 'hold', secs: 8 });
    /* a held note keeps its length at every level (21 Nov) */
    for (const lv of levelsOf(exercise('sustain') as Exercise)) expect(lv.engine).toEqual({ kind: 'hold', secs: 8 });
    /* no set target: your best instead; counts that grow from 4 to 8 (Robert, 4 Nov) */
    expect(exercise('hiss')?.engine).toEqual({ kind: 'timed' });
    expect(exercise('farinelli')?.engine).toEqual({ kind: 'cycle', from: 4, to: 8 });
    expect(exercise('siren')?.engine).toEqual({ kind: 'glide' });
    /* Long soft notes is Stemple's four steps now (Robert, 28 Oct), not a clock */
    expect(exercise('vfe')?.engine).toEqual({ kind: 'vfe' });
    for (const [id, mins] of [['yawnsigh', 1]] as const) {
      expect(exercise(id)?.engine, id).toEqual({ kind: 'guided', mins });
    }
    /* on notes, with the microphone (Robert, 4 Nov) */
    expect(exercise('tonguecresc')).toMatchObject({ engine: { kind: 'hold', secs: 8 }, topGap: 5 });
    expect(exercise('blah')).toMatchObject({ engine: { kind: 'ladder', pattern: 'five', bpm: 110 }, lineOnly: true });
    /* not scored, so one level as before */
    expect(levelsOf(exercise('blah') as Exercise).length).toBe(1);
  });

  it('runs each pattern\'s notes as the old app did (8063-8075), every note of a round the same length (Robert, 23 Nov)', () => {
    const notes = (id: keyof typeof PATTERNS) => ({ deg: PATTERNS[id].deg, span: PATTERNS[id].span });
    expect(notes('five')).toEqual({ deg: [0, 2, 4, 5, 7, 5, 4, 2, 0], span: 7 });
    expect(notes('down5')).toEqual({ deg: [7, 5, 4, 2, 0], span: 7 });
    expect(notes('down3')).toEqual({ deg: [4, 2, 0], span: 4 });
    expect(notes('arp')).toEqual({ deg: [0, 4, 7, 4, 0], span: 7 });
    expect(notes('oct')).toEqual({ deg: [0, 4, 7, 12, 7, 4, 0], span: 12 });
    expect(notes('octrep')).toEqual({ deg: [0, 4, 7, 12, 12, 12, 12, 7, 4, 0], span: 12 });
    expect(notes('nine')).toEqual({ deg: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0], span: 14 });
    expect(notes('oct15')).toEqual({ deg: [0, 4, 7, 12, 16, 19, 17, 14, 12, 9, 7, 5, 2, 0], span: 19 });
    /* the top note and the last no longer twice as long: the old app had them so */
    for (const [id, p] of Object.entries(PATTERNS)) {
      expect(p.dur.length, id).toBe(p.deg.length);
      expect(new Set(p.dur).size, id).toBe(1);
    }
    expect(PATTERNS.five.dur[0]).toBe(1);
    expect(PATTERNS.leap.dur).toEqual([2, 2, 2]);
  });

  it('has a name, a syllable, a one-line goal and a one-line how for each, in the copy', () => {
    for (const e of EXERCISES) {
      const c = copy.ex[e.id as keyof typeof copy.ex];
      expect(c, e.id).toBeDefined();
      /* the Pitch group sings note names and jumps, not a syllable */
      for (const k of ['name', 'syl', 'goal', 'how'] as const) {
        if (!(k === 'syl' && (e.category === 'pitch' || e.id === 'posture' || e.id === 'neckrelease'))) expect(c[k], e.id + '.' + k).toMatch(/\S/);
      }
    }
  });

  it('says what it measures, and only that (7672-7684)', () => {
    const by = (kind: string) => EXERCISES.filter((e) => e.engine.kind === kind).map(measures);
    /* the line shown but not scored (Robert, 3 Nov): chewing, and the tension check; Blah on notes, and Match the tone until his
       headphone test (4 Nov). Straw and Cheek puffs scored since his real-straw test on his phone (13 Nov) */
    const lineOnly = EXERCISES.filter((e) => e.lineOnly).map((e) => e.id).sort();
    /* Note bends too (16 Nov): a flick is only about three of the line's readings */
    /* Match the tone scored since Robert's headphone check (20 Nov) */
    expect(lineOnly).toEqual(['bends', 'blah', 'chewhum', 'tensioncheck']);
    for (const id of lineOnly) expect(measures(exercise(id) as Exercise), id).toBe('none');
    expect(new Set(by('ladder').filter((_, i) => !EXERCISES.filter((e) => e.engine.kind === 'ladder')[i].lineOnly))).toEqual(new Set(['pitch']));
    expect(new Set(by('hold'))).toEqual(new Set(['pitch']));
    expect(by('timed')).toEqual(['time']);
    expect(new Set([...by('cycle'), ...by('glide'), ...by('guided')])).toEqual(new Set(['none']));
    expect(measures(exercise('straw') as Exercise)).toBe('pitch');
    expect(measures(exercise('cheekpuffs') as Exercise)).toBe('pitch');
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
  it('has the old app\'s routines and cool-down, in its warm-up order (8100-8125), with a level per step (Robert, 4 Nov)', () => {
    const ids = (k: keyof typeof ROUTINES) => ROUTINES[k].steps.map((x) => x.id);
    const lv = (k: keyof typeof ROUTINES) => ROUTINES[k].steps.map((x) => x.level);
    /* Match the note (Beginner) before Yawn-sigh (Robert, 3 Nov) */
    expect(ids('daily')).toEqual(['hiss', 'liptrill', 'siren', 'mum', 'descend', 'mee', 'match', 'yawnsigh']);
    expect(ids('intermediate')).toEqual(['hiss', 'farinelli', 'liptrill', 'descend', 'mum', 'mee', 'tongueout', 'laga', 'nay', 'wah', 'staccato', 'ninetone']);
    /* Bratty Bay dropped (Robert, 28 Oct): Octave repeat, its pattern, in its place */
    expect(ids('advanced')).toEqual(['farinelli', 'straw', 'liptrill', 'descend', 'hum', 'tongueout', 'laga', 'octrep', 'ninetone', 'staccato', 'octleap', 'messa']);
    expect(ids('quiet')).toEqual(['hiss', 'farinelli', 'liptrill', 'hum', 'siren', 'mum', 'noo', 'tongueout']);
    expect(ids('cooldown')).toEqual(['straw', 'hum', 'descend']);
    /* each step the routine's own level, but the Advanced warm-up's straw and lip trills at Beginner */
    expect(new Set([...lv('daily'), ...lv('quiet'), ...lv('cooldown')])).toEqual(new Set([1]));
    expect(new Set(lv('intermediate'))).toEqual(new Set([2]));
    expect(lv('advanced')).toEqual([3, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(ROUTINES.cooldown.down).toBe(true);
    expect(DAILY).toBe('daily');
    for (const r of Object.values(ROUTINES)) for (const s of r.steps) expect(exercise(s.id), s.id).toBeDefined();
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
      if (e.engine.kind !== 'ladder' || e.everyStep) continue;
      const p = PATTERNS[e.engine.pattern];
      const beat = 60 / e.engine.bpm;
      for (const range of [DEFAULT_RANGE, { lo: 40, hi: 64 }, { lo: 53, hi: 81 }, { lo: 55, hi: 60 }]) {
        const want = oldLadder(p.deg, p.dur, p.span, range.lo, range.hi);
        const got = ladderNotes(e, range);
        expect(got.notes.map((n) => n.m), e.id).toEqual(want.map((n) => n.m));
        /* Robert, 20 Nov: each round after a lead note in place of the
           rest's second beat, and every note sung SING_LAG after the piano;
           a short note sung SHORT_LEN at most. 23 Nov: the lead as long as
           the round's first note */
        const lead = p.dur[0] * beat, len = p.deg.length;
        got.notes.forEach((n, i) => {
          const r = Math.floor(i / len);
          expect(n.t, e.id).toBeCloseTo(want[i].t * beat + (r + 1) * lead - r * beat + SING_LAG, 6);
          expect(n.d, e.id).toBeCloseTo(e.shortNotes ? Math.min(SHORT_LEN, want[i].d * beat) : want[i].d * beat, 6);
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
    /* with the level it was sung at (Robert, 21 Nov), in its own column online, the name plain (22 Nov) */
    expect(resultRow(exercise('mum') as Exercise, { kind: 'pitch', hits: 7, n: 9 })).toEqual(
      { kind: 'practice', label: 'Mum', level: 1, app_ex_id: 'mum', score: 7, out_of: 9, pct: 78 });
    expect(resultRow(atLevel(exercise('mum') as Exercise, 3), { kind: 'pitch', hits: 7, n: 9 })).toMatchObject({ label: 'Mum', level: 3 });
  });
  it('the hiss: the seconds held', () => {
    expect(resultRow(exercise('hiss') as Exercise, { kind: 'time', seconds: 12.34 })).toEqual(
      /* no target nobody measured (Robert, 4 Nov) */
      { kind: 'practice', label: 'Steady hiss', app_ex_id: 'hiss', score: 12, seconds: 12.3 });
  });
  it('anything not measured: that it was done, and no number', () => {
    expect(resultRow(exercise('straw') as Exercise, { kind: 'none' })).toEqual({ kind: 'practice', label: copy.ex.straw.name, level: 1, app_ex_id: 'straw' });
    expect(resultRow(exercise('mum') as Exercise, { kind: 'none' })).toEqual({ kind: 'practice', label: 'Mum', level: 1, app_ex_id: 'mum' });
    /* scored on pitch, so it has levels too (21 Nov); one not scored has its name alone */
    expect(resultRow(exercise('hum') as Exercise, { kind: 'none' })).toMatchObject({ label: copy.ex.hum.name, level: 1 });
    expect(resultRow(exercise('yawnsigh') as Exercise, { kind: 'none' })).toEqual({ kind: 'practice', label: copy.ex.yawnsigh.name, app_ex_id: 'yawnsigh' });
  });
});

describe('the rungs of an exercise (the progress dots, the pattern card)', () => {
  const mum = EXERCISES.find((e) => e.id === 'mum') as Exercise;
  const range = { lo: 50, hi: 62 };
  const { notes } = ladderNotes(mum, range);
  it('begin at the notes that carry a note name, one per run of the pattern', () => {
    const starts = rungStarts(notes);
    /* up a half step a round to the top, and back down (Robert, 23 Nov) */
    expect(starts.length).toBe(2 * (62 - 7 - 51 + 1) - 1);
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBe(PATTERNS.five.deg.length);
  });
  it('the first rung is the pattern alone', () => {
    expect(firstRung(notes).length).toBe(PATTERNS.five.deg.length);
    expect(firstRung(notes).map((n) => n.m - 51)).toEqual([...PATTERNS.five.deg]);
  });
  it('knows which rung is being sung', () => {
    expect(rungAt(notes, -1)).toBe(-1);
    expect(rungAt(notes, notes[0].t)).toBe(0);
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
    /* the four tongue twisters together (Robert, 4 Nov) */
    expect(ids).toEqual(['vowels', 'redleather', 'uniqueny', 'peterpiper', 'lipstongue', 'pops', 'tonguetip']);
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
  it('La-Ga alternates one syllable a note, la first on every repeat, at every level', () => {
    const at = (level: 1 | 2 | 3) => {
      const { notes } = notesFor(atLevel(exercise('laga') as Exercise, level), { lo: 48, hi: 72 });
      const starts = rungStarts(notes);
      return starts.map((s0, k) => notes.slice(s0, starts[k + 1] ?? notes.length).map(sylOf));
    };
    expect(at(1)[0]).toEqual(['la', 'ga', 'la', 'ga', 'la']);
    expect(at(2)[0]).toEqual(['la', 'ga', 'la', 'ga', 'la', 'ga', 'la', 'ga', 'la']);
    expect(at(3)[0]).toEqual(['la', 'ga', 'la', 'ga', 'la', 'ga', 'la', 'ga', 'la', 'ga', 'la']);
    for (const level of [1, 2, 3] as const) for (const r of at(level)) expect(r[0]).toBe('la');
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
      tonguetrill: ['warmup', 1, /* Beginner since 22 Nov */ [0, 2, 4, 5, 7, 5, 4, 2, 0], ['rrr']],
      goo: ['tone', 1, [0, 4, 7, 4, 0], ['goo']],
      guh: ['tone', 2, [0, 4, 7, 12, 7, 4, 0], ['guh']],
      /* the runs' lowest level (Robert, 4 Nov: speed levels; 13 Nov: no 100 on the chromatic run and the turns) */
      run5: ['agility', 1, [0, 2, 4, 5, 7, 5, 4, 2, 0], ['my']],
      minor5: ['agility', 1, [0, 2, 3, 5, 7, 5, 3, 2, 0], ['my']],
      penta: ['agility', 1, [0, 2, 4, 7, 9, 7, 4, 2, 0], ['my']],
      chrom: ['agility', 2, [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], ['my']],
      turns: ['agility', 2, [4, 2, 0, 5, 4, 2, 7, 5, 4, 9, 7, 5], ['my']],
      arp19: ['range', 3, [0, 4, 7, 12, 16, 19, 16, 12, 7, 4, 0], ['nay']],
    };
    for (const [id, [cat, level, deg, syls]] of Object.entries(want)) {
      expect(listed(id), id).toMatchObject({ category: cat, level });
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
  it('the runs have a speed for each level (Robert, 4 and 13 Nov)', () => {
    const speeds = (id: string) => levelsOf(exercise(id) as Exercise).map((x) => [x.level, x.engine.kind === 'ladder' ? x.engine.bpm : 0]);
    for (const id of ['run5', 'minor5', 'penta']) expect(speeds(id), id).toEqual([[1, 100], [2, 130], [3, 160]]);
    for (const id of ['chrom', 'turns']) expect(speeds(id), id).toEqual([[2, 130], [3, 160]]);
    /* each two-level one got its missing level, a notch away (Robert, 22 Nov) */
    expect(speeds('ninetone')).toEqual([[1, 104], [2, 130], [3, 160]]);
    expect(speeds('redleather')).toEqual([[1, 100], [2, 120], [3, 144]]);
    expect(speeds('uniqueny')).toEqual([[1, 100], [2, 110], [3, 132]]);
    expect(speeds('peterpiper')).toEqual([[1, 100], [2, 120], [3, 144]]);
    expect(speeds('lipstongue')).toEqual([[1, 100], [2, 112], [3, 134]]);
  });
  it('Loo is sung on "loo", by its plain name', () => {
    expect(copy.ex.loo.name).toBe('Loo');
    expect(new Set(rung('loo').map(sylOf))).toEqual(new Set(['loo']));
  });
});

/* Robert's 3 Nov spec: levels inside one exercise, a new three-note
   pattern, a half step every round with no cap, the line shown but not
   scored, and six new exercises in their places */
describe('the 3 Nov Train update', () => {
  const wide = { lo: 40, hi: 76 };
  it('a new three-note pattern, 1-2-3-2-1, every note even (the last held until 23 Nov)', () => {
    expect(PATTERNS.three).toEqual({ deg: [0, 2, 4, 2, 0], dur: [1, 1, 1, 1, 1], span: 4 });
  });

  it('levels inside La-Ga, Bratty Nay and Straw, with their speeds; Big climb\'s arpeggio as the top', () => {
    const lv = (id: string) => levelsOf(exercise(id) as Exercise).map((x) => [x.level, x.engine.kind === 'ladder' ? x.engine.pattern : '', x.engine.kind === 'ladder' ? x.engine.bpm : 0]);
    expect(lv('laga')).toEqual([[1, 'three', 132], [2, 'five', 132], [3, 'arp19', 132]]);
    expect(lv('nay')).toEqual([[1, 'five', 120], [2, 'oct', 120], [3, 'oct', 144]]); /* Advanced: 22 Nov */
    expect(lv('straw')).toEqual([[1, 'three', 110], [2, 'five', 110], [3, 'arp19', 120]]);
    expect(exercise('arp19')?.engine).toMatchObject({ pattern: 'arp19' });
    /* Lip trills (Robert, 4 Nov) */
    expect(lv('liptrill')).toEqual([[1, 'five', 100], [2, 'oct', 100], [3, 'oct15', 100]]);
    /* the rest with levels are the runs, the nine-tone scale, the twisters and Match the note (4 Nov), and Tongue trill (16 Nov); the others have one */
    const many = ['laga', 'nay', 'straw', 'liptrill', 'ninetone', 'run5', 'minor5', 'penta', 'chrom', 'turns', 'redleather', 'uniqueny', 'peterpiper',
      'lipstongue', 'match', 'tonguetrill', 'threerun', 'matchtone'];
    /* since 21 Nov every other scored one has three (Hold the note two), each its band; the rest one */
    for (const e of EXERCISES) {
      if (many.includes(e.id)) continue;
      const scoredOne = measures(e) === 'pitch' && e.engine.kind !== 'interval';
      expect(levelsOf(e).length, e.id).toBe(!scoredOne ? 1 : e.engine.kind === 'steady' ? 2 : 3);
    }
    expect(levelsOf(exercise('match') as Exercise).map((x) => x.engine)).toEqual([{ kind: 'match', mode: 'wait' }, { kind: 'match', mode: 'window' },
      { kind: 'match', mode: 'blind' }]);
    /* Match the tone (Robert, 20 Nov): like Match the note, in order, then at random */
    expect(levelsOf(exercise('matchtone') as Exercise).map((x) => [x.level, x.engine])).toEqual([[1, { kind: 'tone', mode: 'order' }],
      [2, { kind: 'tone', mode: 'random' }], [3, { kind: 'tone', mode: 'hidden' }]]);
  });

  it('a routine step uses its own level, capped at the exercise\'s top (Robert, 3 and 4 Nov)', () => {
    const at = (k: keyof typeof ROUTINES, id: string) => {
      const st = ROUTINES[k].steps.find((x) => x.id === id) as { level: 1 | 2 | 3 };
      const e = atLevel(exercise(id) as Exercise, st.level).engine;
      return e.kind === 'ladder' ? e.pattern + '@' + e.bpm : e.kind;
    };
    expect(at('intermediate', 'laga')).toBe('five@132');
    expect(at('advanced', 'laga')).toBe('arp19@132');
    expect(at('intermediate', 'nay')).toBe('oct@120');
    /* the Advanced warm-up starts easy and builds: its straw and lip trills at Beginner */
    expect(at('advanced', 'straw')).toBe('three@110');
    expect(at('advanced', 'liptrill')).toBe('five@100');
    expect(at('cooldown', 'straw')).toBe('three@110');
    /* lip trills: the five-note scale for beginners, the octave at Intermediate */
    expect(at('daily', 'liptrill')).toBe('five@100');
    expect(at('quiet', 'liptrill')).toBe('five@100');
    expect(at('intermediate', 'liptrill')).toBe('oct@100');
    expect(at('intermediate', 'ninetone')).toBe('nine@130');
    expect(at('advanced', 'ninetone')).toBe('nine@160');
    expect(at('daily', 'match')).toBe('match');
    /* Mum: three levels since 21 Nov, a notch slower and faster round its own 120 */
    expect(atLevel(exercise('mum') as Exercise, 3).engine).toEqual({ kind: 'ladder', pattern: 'five', bpm: 144 });
    expect(at('daily', 'mum')).toBe('five@96');
  });

  it('its climbing exercises go up a half step every round, however many; the rest keep the old app\'s 14', () => {
    const climbing = EXERCISES.filter((e) => e.everyStep).map((e) => e.id).sort();
    /* Mum since 23 Nov, as his course's */
    expect(climbing).toEqual(['bends', 'brighta', 'bwoop', 'cheekpuffs', 'chewhum', 'laga', 'mum', 'nay', 'straw', 'tensioncheck', 'threerun', 'threestep', 'tonguefwd']);
    /* Bwoop starts in the middle (16 Nov): its own test */
    for (const id of climbing.filter((x) => !exercise(x)?.fromMiddle)) {
      for (const level of [1, 2, 3] as const) {
        const e = atLevel(exercise(id) as Exercise, level);
        if (e.engine.kind !== 'ladder') continue;
        const p = PATTERNS[e.engine.pattern];
        const { notes } = ladderNotes(e, wide);
        const all = rungStarts(notes).map((i) => notes[i].m - p.deg[0]);
        const up = wide.hi - p.span - wide.lo;
        /* Mum comes back down to where it began, a half step a round */
        const roots = exercise(id)?.andBack ? all.slice(0, up) : all;
        if (exercise(id)?.andBack) expect(all.slice(up - 1), id).toEqual([...roots].reverse());
        expect(roots[0], id).toBe(wide.lo + 1);
        expect(roots.length, id).toBe(up);
        roots.forEach((r, k) => k && expect(r - roots[k - 1], id).toBe(1));
      }
    }
    /* a two-octave range on 1-2-3-2-1: 20 rounds, not 10 in whole steps */
    const three = ladderNotes(atLevel(exercise('laga') as Exercise, 1), { lo: 48, hi: 72 });
    expect(rungStarts(three.notes).length).toBe(20);
    expect(rungStarts(ladderNotes(exercise('mee') as Exercise, wide).notes).length).toBeLessThanOrEqual(MAX_RUNGS);
  });

  it('the six new ones, in their groups, levels and places in the lists', () => {
    const want: Record<string, [string, number, boolean]> = { posture: ['warmup', 1, false], tensioncheck: ['warmup', 1, true],
      cheekpuffs: ['warmup', 1, true], chewhum: ['warmup', 1, true], tonguefwd: ['warmup', 2, true], brighta: ['tone', 2, false] };
    for (const [id, [cat, level, quiet]] of Object.entries(want)) expect(listed(id), id).toMatchObject({ category: cat, level, quiet });
    const list = (cat: string) => EXERCISES.filter((e) => e.category === cat).map((e) => e.id);
    expect(list('warmup')).toEqual(['posture', 'neckrelease', 'tensioncheck', 'restnote', 'liptrill', 'buzz', 'raspberry', 'tonguetrill', 'straw', 'cheekpuffs',
      'chewhum', 'hum', 'tonguefwd', 'siren']);
    expect(list('tone').indexOf('brighta')).toBe(list('tone').indexOf('tonguecresc') + 1);
    /* Robert's 4 Nov review: three more, 58 in all; Pitch in his order; four more on 16 Nov, 62 */
    expect(EXERCISES.length).toBe(62);
    expect(list('pitch')).toEqual(['match', 'interval', 'holdnote', 'threestep', 'matchtone']);
    expect(exercise('neckrelease')).toMatchObject({ category: 'warmup', level: 1, quiet: true, engine: { kind: 'guided', mins: 1 } });
    expect(listed('threestep')).toMatchObject({ category: 'pitch', level: 1, quiet: true, everyStep: true, engine: { kind: 'ladder', pattern: 'three', bpm: 110 } });
    expect(exercise('matchtone')).toMatchObject({ category: 'pitch', level: 1, quiet: true, engine: { kind: 'tone', mode: 'order' } });
    expect(exercise('matchtone')?.lineOnly).toBeUndefined();
    expect(copy.ex.matchtone.need).toBe('Headphones.');
    expect(exercise('posture')?.engine).toEqual({ kind: 'guided', mins: 1 });
    expect(measures(exercise('posture') as Exercise)).toBe('none');
    for (const id of ['cheekpuffs', 'tensioncheck']) expect(listed(id)?.engine).toMatchObject({ pattern: 'three', bpm: 110 });
    for (const id of ['chewhum', 'tonguefwd', 'brighta']) expect(listed(id)?.engine).toMatchObject({ pattern: 'five', bpm: 110 });
    expect(copy.ex.brighta.syl).toBe('a');
  });

  it('"How to do it" is the numbered steps where there are some, the one How line otherwise', () => {
    /* five steps, and the climbing exercises' last line (Robert, 4 Nov) */
    expect(stepsFor('laga').length).toBe(6);
    expect(stepsFor('laga')[5]).toBe(copy.stepLines.stopEasy);
    expect(stepsFor('tensioncheck')[0]).toBe('Prop your phone up at eye level.');
    expect(stepsFor('posture')[1]).toBe('If your head only reaches the wall by lifting your chin, stop just short.');
    expect(stepsFor('posture').slice(-1)[0]).toBe('When you practise, prop your phone up at eye level so you\'re not looking down.');
    expect(stepsFor('tonguefwd')[3]).toBe('Once that\'s easy, let your head drop forward and roll it loosely from side to side instead.');
    expect(stepsFor('nay')[4]).toBe('Overdo the brat, not the volume. Too bratty works better than halfway.');
    expect(stepsFor('tongueout')[2]).toBe('If your tongue keeps creeping back in, hold the tip with a clean cloth or paper towel and pull it gently out, just enough to feel a stretch at the back.');
    /* every exercise has steps now (Robert, 4 Nov) */
    expect(stepsFor('mee')[0]).toBe('Start each note on a soft hum of "m", then open to "ee".');
    /* a climber that already says when to stop keeps its own words; in the Cool-down, "Stop whenever you like." */
    expect(stepsFor('arp19')).not.toContain(copy.stepLines.stopEasy);
    expect(stepsFor('hum', { cooldown: true }).slice(-1)[0]).toBe(copy.stepLines.stopAny);
    expect(stepsFor('posture')).not.toContain(copy.stepLines.stopEasy);
  });

  /* the old app's body warm-up (next.html 18060-18200): nothing touches the
     front of the throat, no head rolled backwards in a circle, and nothing
     held long */
  it('the body checks keep the old app\'s body rules: no hands on the throat, no head rolled back, nothing held long', () => {
    const text = (id: 'posture' | 'tonguefwd' | 'tensioncheck' | 'neckrelease') => [copy.ex[id].goal, ...stepsFor(id), ...Object.values(copy.about[id]).flat()].join(' ').toLowerCase();
    /* the neck and shoulder release: no hand on the head (Robert, 13 Nov: the old app's neck stretch refused hands) */
    expect(text('neckrelease')).not.toMatch(/hand on your head|its weight draw|pull (your|the) head/);
    for (const id of ['posture', 'tonguefwd', 'tensioncheck', 'neckrelease'] as const) {
      expect(text(id), id).not.toMatch(/massage|press(?!ure)|rub|throat with|on your throat/);
      expect(text(id), id).not.toMatch(/roll[^.]*back(ward)?s? in a circle|tip (your head )?back/);
    }
    expect(text('tonguefwd')).toMatch(/drop forward/);
    expect(copy.about.posture.watch).toMatch(/holding the posture stiffly/);
  });
});
