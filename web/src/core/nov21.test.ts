import { describe, expect, it } from 'vitest';
import {
  BANDS, EXERCISES, NOTCH, ROUTINES, atLevel, bandAt, bandOf, bubbleScore, exercise, levelsOf, listed, measures, type Exercise, type Level, type Note,
} from './exercises';
import { RIGHT_WITHIN } from './takes';
import { atSameLevel, hasLevels, levelOfRow, resultRow } from './results';

/* Robert, 21 Nov: "the level sets how exact you have to be and how fast it
   goes ... every exercise becomes something to level up on" */
const ex = (id: string) => exercise(id) as Exercise;
const one = (m: number): Note[] => [{ m: 60, t: 0, d: 1, syl: 'C4 · ma' }].map((n) => ({ ...n, m }));
/** a note sung `off` half steps from it, steadily, for its whole length */
const sungOff = (off: number, within: number) => {
  const t = Array.from({ length: 20 }, (_, i) => i * 0.05), m = t.map(() => 60 + off);
  return bubbleScore(one(60), t, m, 0.05, false, within).hits;
};

describe('the band that counts at each level', () => {
  it('Beginner wider, Intermediate today\'s, Advanced narrower, from real singing (tests/bands.mjs)', () => {
    expect(BANDS.notes).toEqual({ 1: 0.65, 2: RIGHT_WITHIN, 3: 0.35 });
    expect(RIGHT_WITHIN).toBe(0.5);
    /* the holds keep today's 0.35 as Intermediate; none narrower passes real held notes */
    expect(BANDS.holds).toEqual({ 1: 0.5, 2: 0.35, 3: 0.35 });
  });
  it('what counts is the band: 0.4 off counts at Beginner and Intermediate, not Advanced; 0.6 at Beginner alone; a half step off never', () => {
    expect([1, 2, 3].map((l) => sungOff(0.4, BANDS.notes[l as Level]))).toEqual([1, 1, 0]);
    expect([1, 2, 3].map((l) => sungOff(0.6, BANDS.notes[l as Level]))).toEqual([1, 0, 0]);
    expect([1, 2, 3].map((l) => sungOff(1, BANDS.notes[l as Level]))).toEqual([0, 0, 0]);
    expect([1, 2, 3].map((l) => sungOff(-1, BANDS.notes[l as Level]))).toEqual([0, 0, 0]);
  });
  it('an exercise at a level carries its band; Hold the note and Match the tone the holds\'', () => {
    expect([1, 2, 3].map((l) => atLevel(ex('mum'), l as Level).within)).toEqual([0.65, 0.5, 0.35]);
    expect([1, 2, 3].map((l) => atLevel(ex('run5'), l as Level).within)).toEqual([0.65, 0.5, 0.35]);
    expect([1, 2, 3].map((l) => atLevel(ex('matchtone'), l as Level).within)).toEqual([0.5, 0.35, 0.35]);
    expect([1, 2].map((l) => atLevel(ex('holdnote'), l as Level).within)).toEqual([0.5, 0.35]);
    /* Sing the interval: its band goes with its own level */
    expect(bandAt(ex('interval'), 3)).toBe(0.35);
    expect(bandOf(atLevel(ex('chrom'), 2))).toBe(0.5);
  });
});

describe('how fast: a notch slower at Beginner, today\'s at Intermediate, a notch faster at Advanced', () => {
  const bpms = (id: string) => levelsOf(ex(id)).map((l) => (l.engine.kind === 'ladder' ? l.engine.bpm : null));
  it('a notch is a fifth of the speed', () => {
    expect(NOTCH).toBe(0.2);
    expect(bpms('mum')).toEqual([96, 120, 144]);
    expect(bpms('hum')).toEqual([88, 110, 132]);
    expect(bpms('wah')).toEqual([80, 100, 120]);
    expect(bpms('octrep')).toEqual([90, 112, 134]);
    expect(bpms('staccato')).toEqual([96, 120, 144]);
  });
  it('every one with one level gets all three, its own speed the Intermediate, the same pattern at each', () => {
    for (const e of EXERCISES) {
      const own = listed(e.id) as Exercise;
      if (own.levels || own.lineOnly || own.engine.kind === 'interval' || measures(own) !== 'pitch') continue;
      const lv = levelsOf(e);
      expect(lv.map((l) => l.level), e.id).toEqual(own.engine.kind === 'steady' ? [1, 2] : [1, 2, 3]);
      expect(lv[1].engine, e.id).toEqual(own.engine);
      for (const l of lv) expect(l.engine.kind === 'ladder' && own.engine.kind === 'ladder' ? l.engine.pattern === own.engine.pattern : true, e.id).toBe(true);
      expect(e.level, e.id).toBe(1);
    }
  });
  it('a held note keeps its length; ones with levels keep theirs; ones not scored stay as they are', () => {
    for (const id of ['sustain', 'messa', 'tonguecresc']) for (const l of levelsOf(ex(id))) expect(l.engine).toEqual(listed(id)?.engine);
    for (const id of ['liptrill', 'straw', 'laga', 'nay', 'match', 'matchtone', 'tonguetrill', 'run5', 'chrom', 'turns', 'ninetone', 'threerun', 'redleather'])
      expect(levelsOf(ex(id)), id).toEqual(listed(id)?.levels);
    /* no Beginner on the chromatic run and the turns (13 Nov) */
    expect(levelsOf(ex('chrom')).map((l) => l.level)).toEqual([2, 3]);
    expect(levelsOf(ex('turns')).map((l) => l.level)).toEqual([2, 3]);
    for (const id of ['tensioncheck', 'chewhum', 'blah', 'bends', 'siren', 'hiss', 'posture', 'rangecheck', 'vfe', 'interval'])
      expect(levelsOf(ex(id)).length, id).toBe(1);
  });
  it('in a routine each step keeps the level the routine gives it', () => {
    const at = (k: keyof typeof ROUTINES, id: string) => atLevel(ex(id), (ROUTINES[k].steps.find((s) => s.id === id) as { level: Level }).level);
    expect(at('daily', 'mum')).toMatchObject({ level: 1, within: 0.65, engine: { bpm: 96 } });
    expect(at('intermediate', 'mum')).toMatchObject({ level: 2, within: 0.5, engine: { bpm: 120 } });
    expect(at('advanced', 'octleap')).toMatchObject({ level: 3, within: 0.35, engine: { bpm: 120 } });
  });
});

describe('a result shows the level it was sung at; best and last time compare within a level', () => {
  it('kept with the result, and in its label online', () => {
    const r = resultRow(atLevel(ex('octleap'), 2), { kind: 'pitch', hits: 3, n: 6 });
    expect(r).toMatchObject({ label: 'Octave leaps · Intermediate', level: 2 });
    expect(levelOfRow(r)).toBe(2);
    expect(levelOfRow({ label: 'Octave leaps · Advanced' })).toBe(3);
    /* one saved before levels were kept: no level, so compared with none */
    expect(levelOfRow({ label: 'Match the note' })).toBeNull();
    expect(hasLevels(ex('hiss'))).toBe(false);
    expect(hasLevels(ex('interval'))).toBe(true);
    expect(resultRow(ex('interval'), { kind: 'pitch', hits: 3, n: 6 }, 3)).toMatchObject({ level: 3, label: 'Sing the interval · Advanced' });
  });
  it('last time is the last at the same level, never another level\'s, nor one from before levels were kept', () => {
    const rows = [{ label: 'Match the note · Advanced', cents: 80 }, { label: 'Match the note · Beginner', level: 1 as Level, cents: 20 },
      { label: 'Match the note', cents: 5 }, { label: 'Match the note · Beginner', cents: 40 }];
    expect(atSameLevel(rows, 1).map((r) => r.cents)).toEqual([20, 40]);
    expect(atSameLevel(rows, 3).map((r) => r.cents)).toEqual([80]);
    expect(atSameLevel(rows, 2)).toEqual([]);
  });
});
