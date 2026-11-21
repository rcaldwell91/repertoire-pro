import { describe, expect, it } from 'vitest';
import { EXERCISES, NOTCH, bandOf, exercise, levelsOf, measures, type Exercise } from './exercises';

/* Robert, 22 Nov: each two-level exercise gets its missing level, a notch
   slower or faster as everywhere else; Chromatic run and Three-note turns
   still have no Beginner. */
const ex = (id: string) => exercise(id) as Exercise;
const bpm = (e: Exercise, level: number) => {
  const l = levelsOf(e).find((x) => x.level === level);
  return l?.engine.kind === 'ladder' ? l.engine.bpm : null;
};
const notch = (b: number, way: 1 | -1) => Math.round(b * (1 + way * NOTCH));

describe('the missing levels (Robert, 22 Nov)', () => {
  it('Advanced, a notch faster than Intermediate: the four tongue twisters, Three-note run and Bratty Nay', () => {
    for (const id of ['redleather', 'uniqueny', 'peterpiper', 'lipstongue', 'threerun', 'nay']) {
      expect(levelsOf(ex(id)).map((l) => l.level), id).toEqual([1, 2, 3]);
      expect(bpm(ex(id), 3), id).toBe(notch(bpm(ex(id), 2)!, 1));
    }
    /* Bratty Nay's Advanced is its Intermediate's octave pattern, faster */
    const nay = levelsOf(ex('nay'));
    expect(nay[2].engine).toMatchObject({ pattern: 'oct' });
  });
  it('Beginner, a notch slower than Intermediate: Nine-tone scale and Tongue trill', () => {
    for (const id of ['ninetone', 'tonguetrill']) {
      expect(levelsOf(ex(id)).map((l) => l.level), id).toEqual([1, 2, 3]);
      expect(bpm(ex(id), 1), id).toBe(notch(bpm(ex(id), 2)!, -1));
      expect(ex(id).level, id).toBe(1);
    }
  });
  it('Chromatic run and Three-note turns still have no Beginner; every other scored exercise has all three, but Hold the note', () => {
    for (const id of ['chrom', 'turns']) expect(levelsOf(ex(id)).map((l) => l.level), id).toEqual([2, 3]);
    const short = EXERCISES.filter((e) => measures(e) === 'pitch' && !e.lineOnly && e.engine.kind !== 'interval' && levelsOf(e).length < 3).map((e) => e.id);
    expect(short.sort()).toEqual(['chrom', 'holdnote', 'turns']);
    /* bands as everywhere: the notes' */
    expect(bandOf({ ...ex('nay'), level: 3 })).toBe(0.35);
  });
});

describe('each exercise\'s own difficulty, beside its level span (Robert, 22 Nov)', () => {
  it('as it was listed, whatever level it starts at', () => {
    const own = (id: string) => ex(id).own;
    expect([own('octleap'), own('messa'), own('octrep'), own('bwoop')]).toEqual([3, 3, 3, 3]);
    expect([own('ninetone'), own('tonguetrill'), own('chrom'), own('gee'), own('staccato')]).toEqual([2, 2, 2, 2, 2]);
    expect([own('mum'), own('laga'), own('threerun'), own('redleather'), own('yawnsigh')]).toEqual([1, 1, 1, 1, 1]);
    /* Nine-tone scale and Tongue trill start at their new Beginner, but are Intermediate on their own */
    expect([ex('ninetone').level, ex('tonguetrill').level]).toEqual([1, 1]);
  });
});
