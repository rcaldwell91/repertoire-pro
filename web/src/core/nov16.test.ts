import { describe, expect, it } from 'vitest';
import { copy, fill } from './copy';
import {
  EXERCISES, PATTERNS, ROUTINES, atLevel, bubbleScore, exercise, ladderNotes, levelsOf, measures, rightFor, rungStarts, stepsFor, SHORT_NEED,
  type Exercise, type Level,
} from './exercises';
import { REST_DONE, REST_MIN, restNote, restSlides } from './rest';
import { remindersFor, SPOTS } from './tension';

/* Robert's additions, 16 Nov: four new exercises, Tongue trill's Advanced
   level, and added lines on seven that exist. */

const ex = (id: string) => exercise(id) as Exercise;
const list = (cat: string) => EXERCISES.filter((e) => e.category === cat).map((e) => e.id);
const span = (id: string) => {
  const lv = levelsOf(ex(id));
  return lv.length > 1 ? fill(copy.train.levelSpan, { from: copy.levels[lv[0].level], to: copy.levels[lv[lv.length - 1].level] }) : copy.levels[lv[0].level];
};
const range = { lo: 45, hi: 69 };

describe('four new exercises (Robert, 16 Nov), none in a routine', () => {
  it('in their groups, levels and places', () => {
    expect(EXERCISES.length).toBe(62);
    expect(list('warmup').indexOf('restnote')).toBe(list('warmup').indexOf('tensioncheck') + 1);
    expect(list('agility').indexOf('threerun')).toBe(list('agility').indexOf('run5') - 1);
    expect(list('agility').indexOf('bends')).toBe(list('agility').indexOf('turns') + 1);
    expect(list('range').indexOf('bwoop')).toBe(list('range').indexOf('descend') + 1);
    expect(ex('restnote')).toMatchObject({ category: 'warmup', level: 1, quiet: true, engine: { kind: 'glide', rest: true } });
    expect(ex('bends')).toMatchObject({ category: 'agility', level: 3, lineOnly: true, everyStep: true, engine: { kind: 'ladder', pattern: 'bend', bpm: 100 } });
    expect(ex('bwoop')).toMatchObject({ category: 'range', level: 3, quiet: false, shortNotes: true, fromMiddle: true, everyStep: true,
      engine: { kind: 'ladder', pattern: 'five', bpm: 120 } });
    expect(levelsOf(ex('threerun')).map((l) => [l.level, l.engine])).toEqual([[1, { kind: 'ladder', pattern: 'threerun', bpm: 100 }],
      [2, { kind: 'ladder', pattern: 'threerun', bpm: 130 }]]);
    expect(span('threerun')).toBe('Beginner to Intermediate');
    for (const r of Object.values(ROUTINES)) for (const id of ['restnote', 'threerun', 'bends', 'bwoop']) expect(r.steps.map((s) => s.id)).not.toContain(id);
  });

  it('Three-note run: 3-2-1 then 1-2-3 in one round, beats 1-1-2, 1-1-2, a half step higher each round, on the runs\' "my" and steps', () => {
    expect(PATTERNS.threerun).toMatchObject({ deg: [4, 2, 0, 0, 2, 4], dur: [1, 1, 2, 1, 1, 2] });
    const { notes } = ladderNotes(atLevel(ex('threerun'), 1), range);
    const roots = rungStarts(notes).map((i) => notes[i].m - 4);
    roots.forEach((r, k) => k && expect(r - roots[k - 1]).toBe(1));
    expect(copy.ex.threerun.syl).toBe(copy.ex.run5.syl);
    expect(copy.about.threerun.steps).toEqual(copy.about.run5.steps);
    expect(copy.about.threerun.why).toBe(copy.about.run5.why);
    expect(copy.about.threerun.watch).toBe(copy.about.run5.watch);
    expect(copy.about.threerun.right).toBe('All three notes are clear on the way down and on the way up, with no slide between them.');
    expect(measures(ex('threerun'))).toBe('pitch');
  });

  it('Note bends: the note, four flicks of a quarter beat out and three quarters back, the note held two beats; up, then down, by rounds', () => {
    const { notes, beat } = ladderNotes(ex('bends'), range);
    expect(beat).toBeCloseTo(0.6, 6);
    const starts = rungStarts(notes);
    const round = (r: number) => notes.slice(starts[r], starts[r + 1] ?? notes.length);
    const r0 = round(0), r1 = round(1), root0 = r0[0].m, root1 = r1[0].m;
    expect(r0.map((n) => n.m - root0)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 0]);
    expect(r1.map((n) => n.m - root1)).toEqual([0, -1, 0, -1, 0, -1, 0, -1, 0, 0]);
    expect(r0.map((n) => +(n.d / beat).toFixed(2))).toEqual([1, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 2]);
    expect(root1 - root0).toBe(1);
    expect(Math.min(...notes.map((n) => n.m))).toBeGreaterThanOrEqual(range.lo);
    expect(Math.max(...notes.map((n) => n.m))).toBeLessThanOrEqual(range.hi);
    expect(measures(ex('bends'))).toBe('none');
    expect(copy.ex.bends.syl).toBe('ah');
  });

  it('Bwoop: "bwoop" everywhere, never "boop" but where it warns against it; from the middle of the range to the top', () => {
    expect(copy.ex.bwoop.name).toBe('Bwoop');
    expect(copy.ex.bwoop.syl).toBe('bwoop');
    const all = [copy.ex.bwoop.goal, copy.ex.bwoop.how, ...stepsFor('bwoop'), copy.about.bwoop.right, copy.about.bwoop.watch, copy.about.bwoop.why];
    for (const t of all) for (const m of t.matchAll(/\bb\w*oop\b/gi)) expect(['bwoop', 'boop'], t).toContain(m[0].toLowerCase());
    for (const t of all.filter((x) => /\bboop\b/i.test(x))) expect(t, t).toMatch(/"bwoop", not "boop"|"w" dropping out so it turns into "boop"/);
    const { notes } = ladderNotes(ex('bwoop'), range);
    const roots = rungStarts(notes).map((i) => notes[i].m);
    expect(roots[0]).toBe(Math.round((range.lo + range.hi) / 2 - PATTERNS.five.span / 2));
    expect(roots[roots.length - 1]).toBe(range.hi - PATTERNS.five.span);
    roots.forEach((r, k) => k && expect(r - roots[k - 1]).toBe(1));
    expect(notes.every((n) => n.need === SHORT_NEED)).toBe(true);
    /* the short-note rule: 0.1 s on the note counts */
    const n = notes[0];
    expect(bubbleScore([n], [n.t + 0.02, n.t + 0.07], [n.m, n.m], 0.05, false).hits).toBe(1);
  });

  it('every one that climbs ends with the climbing line; Find your resting note does not climb', () => {
    for (const id of ['threerun', 'bends', 'bwoop'] as const) expect(stepsFor(id).slice(-1)[0]).toBe(copy.stepLines.stopEasy);
    expect(stepsFor('restnote').slice(-1)[0]).toBe('Tap Done.');
    expect(stepsFor('restnote')).toHaveLength(5);
  });

  it('no reminder that contradicts them: not "Open tall, not wide" on the hum or the "bwoop"', () => {
    expect(remindersFor('restnote', [...SPOTS])).not.toContain('wide');
    expect(remindersFor('bwoop', [...SPOTS])).not.toContain('wide');
    expect(remindersFor('threerun', [...SPOTS])).toEqual(remindersFor('run5', [...SPOTS]));
    expect(remindersFor('bends', [...SPOTS])).toEqual([...SPOTS]);
  });
});

describe('Find your resting note: where each slide came to rest (core/rest)', () => {
  /* a slide down from `from` to `to` over `secs`, then held on `to` for `hold` (readings every 0.05 s, a little wobble) */
  const slide = (t0: number, from: number, to: number, secs: number, hold: number) => {
    const t: number[] = [], m: number[] = [];
    for (let x = 0; x < secs; x += 0.05) { t.push(t0 + x); m.push(from + ((to - from) * x) / secs); }
    for (let x = 0; x < hold; x += 0.05) { t.push(t0 + secs + x); m.push(to + 0.15 * Math.sin(x * 9)); }
    return { t, m };
  };
  const join = (...parts: Array<{ t: number[]; m: number[] }>) => ({ t: parts.flatMap((p) => p.t), m: parts.flatMap((p) => p.m) });

  it('names the note a slide settled on, even when it settles between two (the nearer)', () => {
    const a = slide(0, 52, 45, 1.2, 1.0);
    expect(restNote(a.t, a.m)).toBe(45);
    const b = slide(0, 50, 44.3, 1, 1);
    expect(restNote(b.t, b.m)).toBe(44);
  });

  it('the last settled stretch: a slide that settles, then sighs away below it, is still the settled note', () => {
    const a = slide(0, 52, 45, 1, 0.9);
    const tail = slide(1.95, 45, 41, 0.3, 0);
    const j = join(a, tail);
    expect(restNote(j.t, j.m)).toBe(45);
  });

  it('a slide that never settles names nothing', () => {
    const a = slide(0, 55, 44, 2.5, 0);
    expect(restNote(a.t, a.m)).toBeNull();
    /* settled, but for under 0.6 s */
    const b = slide(0, 52, 45, 1, 0.45);
    expect(restNote(b.t, b.m)).toBeNull();
  });

  it('three slides with pauses between: three results; one still going is not counted until the sound has stopped', () => {
    const j = join(slide(0, 52, 45, 1, 1), slide(3, 53, 46, 1, 1), slide(6, 52, 44, 1, 1));
    const done = restSlides(j.t, j.m, { now: 8.1 + REST_DONE + 0.01 });
    expect(done.map((x) => x.note)).toEqual([45, 46, 44]);
    expect(restSlides(j.t, j.m, { now: 8.2 }).map((x) => x.note)).toEqual([45, 46]);
    expect(restSlides(j.t, j.m, { all: true }).map((x) => x.note)).toEqual([45, 46, 44]);
  });

  it('a short sound is not a slide; silence between readings (NaN) is skipped', () => {
    const blip = slide(0, 50, 50, REST_MIN - 0.15, 0);
    const a = slide(2, 52, 45, 1, 1);
    const gap = { t: [1, 1.05, 1.1], m: [NaN, NaN, NaN] };
    const j = join(blip, gap, a);
    expect(restSlides(j.t, j.m, { all: true }).map((x) => x.note)).toEqual([45]);
  });

  it('the result in Robert\'s words, with the notes the app names', () => {
    expect(fill(copy.train.restResult, { notes: 'A2, A2 and G♯2' })).toBe('Your slides came to rest on A2, A2 and G♯2.');
    expect(copy.train.restNone.join(' ')).toBe("That slide didn't come to rest on a note. Try again and let it settle.");
    const words = [copy.ex.restnote.goal, ...stepsFor('restnote'), copy.about.restnote.right, copy.about.restnote.why, copy.train.restResult,
      copy.train.restSlide].join(' ').toLowerCase();
    expect(words).not.toMatch(/speaking pitch|natural note/);
  });
});

describe('Tongue trill: an Advanced level, the trill through puffed cheeks (Robert, 16 Nov)', () => {
  it('Intermediate to Advanced, the same pattern and speed', () => {
    expect(levelsOf(ex('tonguetrill')).map((l) => [l.level, l.engine])).toEqual([[2, { kind: 'ladder', pattern: 'five', bpm: 120 }],
      [3, { kind: 'ladder', pattern: 'five', bpm: 120 }]]);
    expect(span('tonguetrill')).toBe('Intermediate to Advanced');
  });

  it('at Advanced its own step 3 and doing-right line; at Intermediate today\'s', () => {
    const at = (l: Level) => stepsFor('tonguetrill', { level: l });
    expect(at(2)[2]).toBe('Sing the pattern on the trill, keeping it rolling on every note.');
    expect(at(3)[2]).toBe('Keep the trill going and close your lips until only a little air gets out. Your cheeks will puff out. Keep them puffed and sing the pattern.');
    expect(at(3).filter((_, i) => i !== 2)).toEqual(at(2).filter((_, i) => i !== 2));
    expect(rightFor('tonguetrill', 2)).toBe('The trill keeps rolling through every note and your jaw stays loose.');
    expect(rightFor('tonguetrill', 3)).toBe('The trill keeps rolling and your cheeks stay puffed on every note.');
    expect(rightFor('mum', 3)).toBe(copy.about.mum.right);
  });

  it('no "Keep your face still." at Advanced, where the cheeks puff; at Intermediate it can show', () => {
    expect(remindersFor('tonguetrill', ['face'], 3)).toEqual([]);
    expect(remindersFor('tonguetrill', ['face'], 2)).toEqual(['face']);
  });
});

describe('added lines on exercises that exist (Robert, 16 Nov), everything else as it was', () => {
  it('Humming: the fingertip under the chin, last of its own steps, and its watch-out', () => {
    const own = copy.about.hum.steps;
    expect(own[own.length - 1]).toBe('Rest a fingertip under your chin, in the soft spot behind the bone. It should stay soft while you hum.');
    expect(copy.about.hum.watch).toMatch(/The soft spot under your chin going hard or pushing down against your finger\.$/);
  });

  it('the three tongue-out exercises: the mirror, straight after the step that puts the tongue out', () => {
    const mirror = 'If you can, watch in a mirror. Your tongue should stay out on every note.';
    for (const id of ['tongueout', 'tonguecresc', 'brighta'] as const) {
      const s = copy.about[id].steps;
      expect(s[1], id).toBe(mirror);
      expect(s[0], id).toMatch(/^Stick (your tongue out|out your tongue)/);
    }
  });

  it('Cheek puffs, Mum and Breath pulses', () => {
    expect(copy.about.cheekpuffs.steps[1]).toBe('Make a sound, letting the air out through your lips in a small, steady stream. It should be a real note, not just air.');
    expect(copy.about.cheekpuffs.right).toBe('You hear a clear note, your cheeks stay puffed the whole time, pinching your nose changes nothing, and your shoulders keep making full circles.');
    expect(copy.about.cheekpuffs.watch).toMatch(/Your cheeks going flat, and the air rushing out all at once\.$/);
    const mum = copy.about.mum.steps;
    expect(mum[mum.indexOf('Start each note gently, and keep the vowel from drifting.') + 1]).toBe('Say it the way you\'d speak it, at talking volume. Don\'t get louder as the notes climb.');
    expect(copy.about.mum.right).toMatch(/The "uh" sounds the same on every note, and the top is no louder than the bottom\.$/);
    expect(copy.about.mum.watch).toMatch(/Your chin lifting as the notes rise\.$/);
    expect(copy.about.pulses.steps).toHaveLength(7);
    expect(copy.about.pulses.steps[0]).toBe('Put one hand on your chest and one on your belly, just below your ribs.');
    expect(copy.about.pulses.steps[6]).toBe('Chest still lifting? Lie on your back with a book on your belly and breathe so the book rises. Then try again standing.');
    expect(copy.about.pulses.right).toMatch(/^Your chest hand stays still when you breathe in, your belly hand moves in on each "ha"/);
    expect(copy.about.pulses.watch).toMatch(/^Pushing the sound from your throat/);
    /* sounds and movement cues as they were */
    expect(copy.ex.mum.syl).toBe('mum');
    expect(copy.ex.cheekpuffs.cue).toBe('Keep rolling your shoulders.');
  });
});
