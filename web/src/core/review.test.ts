import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import {
  EXERCISES, HIT_SHARE, ROUTINES, atLevel, bubbleScore, exercise, ladderNotes, holdNotes, nextInGroup, routineMins, routineSecs, routineSteps, rungStarts,
  type Exercise, type Note,
} from './exercises';
import { HOLD_TO_COUNT, intervalRound, landing, matchRound, nearness, seeded, toneParts, waitParts, SING, SING_SLOW } from './pitch';
import { resultRow } from './results';
import { cycleAt } from './timed';
import { arrivals, spread } from './timing';
import { toneSamples, wav, TONE_RMS_DB } from '../shell/tone';
import { DEFAULT_RANGE } from './range';

/* Robert's 4 Nov review, his 13 Nov answers to its plan, and what he found
   on his phone on 13 Nov. Each rule here can fail. */

const ex = (id: string) => exercise(id) as Exercise;
/** a line that sings these notes right through, a point every 50 ms */
function sing(notes: ReadonlyArray<{ m: number; t: number; d: number }>, opts: { skip?: (n: number) => boolean; off?: number } = {}) {
  const t: number[] = [], m: number[] = [];
  notes.forEach((n, i) => {
    for (let x = n.t; x < n.t + n.d - 1e-9; x += 0.05) {
      t.push(x);
      m.push(opts.skip?.(i) ? NaN : n.m + (opts.off ?? 0));
    }
  });
  return { t, m };
}

describe('Next moves on (Robert, 13 Nov: from the tension check it went to Posture check, and there did nothing)', () => {
  it('is the next exercise in the group, by id, whatever level the exercise is at', () => {
    /* since 16 Nov Find your resting note comes straight after the tension check */
    expect(nextInGroup('tensioncheck')).toBe('restnote');
    expect(nextInGroup('posture')).toBe('neckrelease');
    expect(nextInGroup('neckrelease')).toBe('tensioncheck');
    /* the last of a group goes round to its first, never to itself */
    expect(nextInGroup('siren')).toBe('posture');
    for (const e of EXERCISES) expect(nextInGroup(e.id), e.id).not.toBe(e.id);
    /* the copy an exercise is shown as, at a level, is still found */
    expect(nextInGroup(atLevel(ex('laga'), 3).id)).toBe(nextInGroup('laga'));
  });
});

describe('rounds you didn\'t sing don\'t count (Robert, 4 and 13 Nov: rounds, not notes)', () => {
  const notes = ladderNotes(ex('mum'), { lo: 50, hi: 62 }).notes;
  const starts = rungStarts(notes);
  const roundOf = (i: number) => starts.filter((s) => s <= i).length - 1;
  it('a round with no voice at all is left out', () => {
    const line = sing(notes, { skip: (i) => roundOf(i) >= 2 });
    const s = bubbleScore(notes, line.t, line.m, 0.05, false);
    expect(s.rounds).toEqual({ sung: 2, of: starts.length });
    expect(s.n).toBe(starts[2]);
    expect(s.hits).toBe(starts[2]);
  });
  it('a silent note inside a sung round is a miss, not left out', () => {
    const line = sing(notes, { skip: (i) => i === 4 });
    const s = bubbleScore(notes, line.t, line.m, 0.05, false);
    expect(s.n).toBe(notes.length);
    expect(s.hits).toBe(notes.length - 1);
  });
  it('a wrong voice in every round still counts every round, and scores low', () => {
    const line = sing(notes, { off: 3 });
    const s = bubbleScore(notes, line.t, line.m, 0.05, false);
    expect(s.n).toBe(notes.length);
    expect(s.hits).toBe(0);
  });
  it('the result keeps only what was counted, and says how many rounds', () => {
    const row = resultRow(ex('mum'), { kind: 'pitch', hits: 9, n: 18, rounds: { sung: 2, of: 5 } });
    expect(row).toMatchObject({ score: 9, out_of: 18, pct: 50 });
    expect(copy.train.roundsSung).toMatch(/\{k\}.*\{n\}/);
  });
});

describe('a note to land in a longer time still counts after 1.2 s on it (Match the note, Sing the interval at Beginner)', () => {
  const n: Note = { m: 60, t: 0, d: 5, syl: 'C4 · C4', need: HOLD_TO_COUNT };
  const at = (secs: number, from = 0) => ({ t: Array.from({ length: Math.round(secs / 0.05) }, (_, i) => from + i * 0.05), m: Array(Math.round(secs / 0.05)).fill(60) });
  it('1.2 s on it is a hit, 1.0 s is not; the bubble shows the same', () => {
    expect(bubbleScore([n], at(1.25, 3).t, at(1.25, 3).m, 0.05, false).hits).toBe(1);
    expect(bubbleScore([n], at(1.0, 3).t, at(1.0, 3).m, 0.05, false).hits).toBe(0);
    expect(bubbleScore([n], at(1.25, 3).t, at(1.25, 3).m, 0.05, false).fill[0]).toBeCloseTo(0.5, 1);
  });
  it('Match the note: five seconds at Intermediate; at Advanced three, then the note again, and the line shown from then', () => {
    const r = seeded(0.3);
    const w = matchRound(DEFAULT_RANGE, r, 'window');
    expect(w.notes.every((x) => x.d === 5 && x.need === HOLD_TO_COUNT)).toBe(true);
    const b = matchRound(DEFAULT_RANGE, seeded(0.3), 'blind');
    expect(b.notes.every((x) => x.d === 3)).toBe(true);
    expect(b.reveal?.length).toBe(10);
    expect(b.played.length).toBe(20);
    /* shown once the note plays again, before the next turn begins */
    b.notes.forEach((x, i) => {
      expect((b.reveal as number[])[i]).toBeGreaterThan(x.t + x.d - 1e-9);
      expect((b.reveal as number[])[i]).toBeLessThan(b.played[2 * i + 2]?.t ?? b.length);
    });
  });
  it('Match the note at Beginner: ten notes in order, a half step apart, from one above the bottom', () => {
    expect(waitParts({ lo: 45, hi: 69 }).map((p) => (p.kind === 'wait' ? p.m : 0))).toEqual([46, 47, 48, 49, 50, 51, 52, 53, 54, 55]);
  });
  it('Sing the interval at Beginner gives five seconds a note; the other levels 2.4', () => {
    expect(intervalRound(1, DEFAULT_RANGE, seeded(0.1)).notes.every((x) => x.d === SING_SLOW && x.need === HOLD_TO_COUNT)).toBe(true);
    expect(intervalRound(2, DEFAULT_RANGE, seeded(0.1)).notes.every((x) => x.d === SING)).toBe(true);
  });
});

describe('very short notes (Staccato, Consonant pops): counted once 0.1 s is heard on the note (13 Nov, from the real-voice check)', () => {
  it('only those two; and 0.1 s on the note is a hit, 0.05 s is not, a wrong note never', () => {
    expect(EXERCISES.filter((e) => e.shortNotes).map((e) => e.id).sort()).toEqual(['bwoop', 'pops', 'staccato']);
    const n = ladderNotes(ex('staccato'), { lo: 50, hi: 62 }).notes[0];
    expect(n.need).toBe(0.1);
    const pts = (k: number, m: number) => ({ t: Array.from({ length: k }, (_, i) => n.t + 0.02 + i * 0.05), m: Array(k).fill(m) });
    expect(bubbleScore([n], pts(2, n.m).t, pts(2, n.m).m, 0.05, false).hits).toBe(1);
    expect(bubbleScore([n], pts(1, n.m).t, pts(1, n.m).m, 0.05, false).hits).toBe(0);
    expect(bubbleScore([n], pts(6, n.m + 3).t, pts(6, n.m + 3).m, 0.05, false).hits).toBe(0);
    expect(ladderNotes(ex('mum'), { lo: 50, hi: 62 }).notes[0].need).toBeUndefined();
  });
  it('and most of what was heard in it on the note: 0.1 s on it then 0.15 s off is a miss, and its bubble stops short', () => {
    const n = ladderNotes(ex('pops'), { lo: 50, hi: 62 }).notes[0];
    const t = [0, 1, 2, 3, 4].map((i) => n.t + 0.02 + i * 0.05);
    const off = [n.m, n.m, n.m + 3, n.m + 3, n.m + 3];
    const r = bubbleScore([n], t, off, 0.05, false);
    expect(r.hits).toBe(0);
    expect(r.fill[0]).toBeLessThan(HIT_SHARE);
    /* three on and two off is most of it */
    expect(bubbleScore([n], t, [n.m, n.m, n.m, n.m + 3, n.m + 3], 0.05, false).hits).toBe(1);
    /* a longer note keeps its own rule: half its length on it, whatever else is heard */
    const mum = ladderNotes(ex('mum'), { lo: 50, hi: 62 }).notes[0];
    const k = Math.ceil(mum.d / 2 / 0.05) + 1;
    const tm = Array.from({ length: Math.floor(mum.d / 0.05) }, (_, i) => mum.t + 0.01 + i * 0.05);
    expect(bubbleScore([mum], tm, tm.map((_, i) => (i < k ? mum.m : mum.m + 3)), 0.05, false).hits).toBe(1);
  });
});

describe('how a try landed (Match the note, Robert 4 Nov)', () => {
  const line = (pts: Array<[number, number]>) => ({ t: pts.map((p) => p[0]), m: pts.map((p) => p[1]) });
  it('the first try, the time to settle within 35 cents for 0.6 s, and how close it settled', () => {
    const pts: Array<[number, number]> = [];
    for (let t = 2; t < 2.3; t += 0.05) pts.push([t, 60.8]);          /* starts 80 cents sharp */
    for (let t = 2.3; t < 2.8; t += 0.05) pts.push([t, 60.5]);        /* slides */
    for (let t = 2.8; t < 4.5; t += 0.05) pts.push([t, 60.1]);        /* settles 10 cents off */
    const l = line(pts);
    const r = landing(l.t, l.m, 60, 1.6, 6.6, false);
    expect(r.first).toBeCloseTo(80, 0);
    expect(r.settleAfter).toBeCloseTo(0.8, 1);
    expect(r.settled).toBeCloseTo(10, 0);
  });
  it('a moment on the note is not settling: it has to stay 0.6 s', () => {
    const pts: Array<[number, number]> = [];
    for (let t = 2; t < 2.2; t += 0.05) pts.push([t, 60.1]);          /* on it for 0.2 s */
    for (let t = 2.2; t < 2.8; t += 0.05) pts.push([t, 61]);          /* off again */
    for (let t = 2.8; t < 4; t += 0.05) pts.push([t, 60]);            /* then stays */
    const l = line(pts);
    expect(landing(l.t, l.m, 60, 1.6, 6.6, false).settleAfter).toBeCloseTo(0.8, 1);
  });
  it('never settles: null, never a guess; nothing sung: all null', () => {
    const l = line([[2, 62], [2.05, 62], [2.1, 62]]);
    expect(landing(l.t, l.m, 60, 1.6, 6.6, false)).toEqual({ first: 200, settleAfter: null, settled: null });
    expect(landing([], [], 60, 0, 5, false)).toEqual({ first: null, settleAfter: null, settled: null });
  });
  it('in words: very close, close, a bit off, far off', () => {
    expect([10, 30, 80, 150].map(nearness)).toEqual(['veryClose', 'close', 'bitOff', 'farOff']);
  });
  it('kept with the result: first tries in cents, the settle time in seconds, how close in the new column', () => {
    const row = resultRow(ex('match'), { kind: 'pitch', hits: 7, n: 10, landing: { firstOn: 4, tries: 10, first: 61.4, settleAfter: 1.83, settled: 12.6 } });
    expect(row).toMatchObject({ score: 7, out_of: 10, cents: 61, seconds: 1.8, settle_cents: 13 });
  });
});

describe('breath counts grow (Robert, 4 Nov)', () => {
  it('4, then one more each round, up to 8', () => {
    expect(cycleAt(0, 4, 8)).toMatchObject({ round: 1, count: 4, phase: 0 });
    expect(cycleAt(4.5, 4, 8)).toMatchObject({ round: 1, count: 4, phase: 1 });
    expect(cycleAt(12, 4, 8)).toMatchObject({ round: 2, count: 5, phase: 0 });
    expect(cycleAt(12 + 15 + 18 + 21 + 24, 4, 8)).toMatchObject({ round: 6, count: 8 });
    expect(cycleAt(12 + 15 + 18 + 21 + 24 + 24, 4, 8)).toMatchObject({ round: 7, count: 8 });
  });
});

describe('the Cool-down steps down; the routines\' lengths are worked out (Robert, 4 Nov)', () => {
  it('a ladder in the Cool-down starts in the middle and goes down a half step a round to one above the bottom', () => {
    const r = { lo: 45, hi: 69 };
    const roots = (e: Exercise) => {
      const n = ladderNotes(e, r, { down: true }).notes;
      return rungStarts(n).map((i) => n[i].m);
    };
    const straw = roots(atLevel(ex('straw'), 1));
    expect(straw[0]).toBe(55);
    expect(straw[straw.length - 1]).toBe(46);
    straw.forEach((x, k) => k && expect(straw[k - 1] - x).toBe(1));
    const up = ladderNotes(atLevel(ex('straw'), 1), r).notes;
    expect(up[0].m).toBe(46);
  });
  it('Tongue-out with a crescendo keeps its notes five half steps below the top', () => {
    const n = holdNotes(ex('tonguecresc'), { lo: 45, hi: 69 }).notes;
    expect(Math.max(...n.map((x) => x.m))).toBe(64);
    expect(Math.max(...holdNotes(ex('sustain'), { lo: 45, hi: 69 }).notes.map((x) => x.m))).toBe(66);
  });
  it('the daily warm-up opens with the tension check for anyone who has never done it', () => {
    expect(routineSteps('daily', false)[0]).toEqual({ id: 'tensioncheck', level: 1 });
    expect(routineSteps('daily', true)[0].id).toBe('hiss');
    expect(routineSteps('quiet', false)[0].id).toBe('hiss');
  });
  /* 21 Nov: each step at the routine's own level, now a notch slower at
     Beginner and faster at Advanced on the exercises that had one speed */
  it('lengths from the exercises: at the default range, about 10, 15, 15, 11 and 4 minutes', () => {
    expect(routineMins(ROUTINES.daily.steps, DEFAULT_RANGE)).toBe(10);
    expect(routineMins(routineSteps('daily', false), DEFAULT_RANGE)).toBe(11);
    expect(routineMins(ROUTINES.intermediate.steps, DEFAULT_RANGE)).toBe(15);
    expect(routineMins(ROUTINES.advanced.steps, DEFAULT_RANGE)).toBe(15);
    expect(routineMins(ROUTINES.quiet.steps, DEFAULT_RANGE)).toBe(11);
    expect(routineMins(ROUTINES.cooldown.steps, DEFAULT_RANGE, true)).toBe(4);
    /* a wider range sings more rounds: longer */
    expect(routineSecs(ROUTINES.daily.steps, { lo: 40, hi: 76 })).toBeGreaterThan(routineSecs(ROUTINES.daily.steps, DEFAULT_RANGE));
  });
});

describe('Match the tone\'s plain tone (Robert, 4 Nov)', () => {
  it('ten notes: five in order a whole step apart, then five drawn at random, all inside the range', () => {
    const p = toneParts({ lo: 45, hi: 69 }, seeded(0.4)).map((x) => (x.kind === 'tone' ? x.m : 0));
    expect(p.length).toBe(10);
    for (let k = 1; k < 5; k++) expect(p[k] - p[k - 1]).toBe(2);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(47);
    expect(Math.max(...p)).toBeLessThanOrEqual(67);
  });
  it('a pure tone on the note, at the piano\'s level, with no click at either end', () => {
    const x = toneSamples(69, 1);
    const rms = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
    /* the piano's reference notes average -16 dB over their first 1.5 s (measured from the sample files, 13 Nov) */
    expect(20 * Math.log10(rms)).toBeCloseTo(-16, 0);
    expect(TONE_RMS_DB).toBe(-16);
    expect(Math.abs(x[0])).toBeLessThan(1e-6);
    expect(Math.abs(x[x.length - 1])).toBeLessThan(0.01);
    /* 440 cycles in a second: count the rising zero crossings */
    let up = 0;
    for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) up++;
    expect(Math.abs(up - 440)).toBeLessThanOrEqual(1);
    const w = wav(x);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(w.length).toBe(44 + x.length * 2);
  });
});

describe('when the voice arrives on each note (Robert, 13 Nov: the measurement, not a change)', () => {
  const piano: Array<[number, number, number]> = [[60, 0, 0.5], [62, 0.5, 0.5], [64, 1, 0.5], [65, 1.5, 0.5]];
  const late = (secs: number, off = 0) => {
    const t: number[] = [], m: number[] = [];
    for (let x = 0; x < 2.2; x += 0.05) {
      t.push(x);
      const k = piano.findIndex(([, at, d]) => x - secs >= at && x - secs < at + d);
      m.push(k < 0 ? NaN : piano[k][0] + off);
    }
    return { t, m };
  };
  it('a voice 0.2 s late arrives 0.2 s after each note', () => {
    const l = late(0.2);
    const a = arrivals(piano, l.t, l.m);
    for (const x of a) expect(x.after).toBeCloseTo(0.2, 1);
    const s = spread(a);
    expect(s.reached).toBe(4);
    expect(s.at.median).toBeCloseTo(0.2, 1);
  });
  it('the wrong notes never arrive: missed, not counted as late', () => {
    const l = late(0, 3);
    expect(spread(arrivals(piano, l.t, l.m)).reached).toBe(0);
  });
});
