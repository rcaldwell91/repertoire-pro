import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import { exercise, measures, notesFor, stepsFor, wobbleHolds, wobbleNotes, SING_LAG, WOBBLE_HOLD, WOBBLE_SPEEDS, type Exercise } from './exercises';
import { fitSecond, fitWave, hold, measures as wobbleMeasures, SETTLE, TYPICAL_RATE, TYPICAL_WIDTH } from './vibrato';
import { resultRow } from './results';

/* Vibrato (Robert approved it on 16 Nov; built 24 Nov). The measuring was
   proved on real voices in the lab (REPORTS, 24 Nov); these hold the rules
   it was proved with. */
const ex = (id: string) => exercise(id) as Exercise;

/** readings twenty a second, as the line takes them: a note wobbling `width`
    cents top to bottom at `rate` a second, from a random start, with a
    little reading noise (seeded) */
function readings(rate: number, width: number, secs = 4, opts: { drift?: number; noise?: number; seed?: number } = {}) {
  let a = opts.seed ?? 1;
  const rand = () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
  const ph = rand() * 6.28, t: number[] = [], m: number[] = [];
  for (let k = 0; k < secs * 20; k++) {
    const s = k / 20;
    t.push(s);
    m.push(60 + ((width / 2) * Math.sin(2 * Math.PI * rate * s + ph) + (opts.drift ?? 0) * s + (opts.noise ?? 3) * (rand() * 2 - 1)) / 100);
  }
  return { t, m };
}
/** two notes a half step apart taking turns `per` times a second */
function turns(per: number, secs = 4) {
  const t: number[] = [], m: number[] = [];
  for (let k = 0; k < secs * 20; k++) {
    const s = k / 20;
    t.push(s);
    m.push(60 + (Math.floor(s * per * 2) % 2));
  }
  return { t, m };
}

describe('the wobble, measured (24 Nov)', () => {
  it('reads the speed and the width of a wobble from whole cycles, not single readings', () => {
    for (const rate of [4.5, 5.5, 6.5]) {
      for (const width of [40, 80, 120]) {
        for (const seed of [1, 2, 3]) {
          const r = readings(rate, width, 1, { seed });
          const f = fitSecond(r.t, r.m);
          expect(f?.kind, `${rate} ${width}`).toBe('wobble');
          expect(Math.abs((f?.rate ?? 0) - rate), `${rate} ${width}`).toBeLessThan(0.15);
          expect(Math.abs((f?.width ?? 0) - width), `${rate} ${width}`).toBeLessThan(8);
        }
      }
    }
  });

  it('highest less lowest single reading reads a wobble low, which is why it is not used (it can fail)', () => {
    /* four readings a cycle, caught between the peaks */
    const t = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35], m = t.map((s) => 60 + 0.4 * Math.sin(2 * Math.PI * 5 * s + Math.PI / 4));
    expect((Math.max(...m) - Math.min(...m)) * 100).toBeLessThan(0.75 * 80);
  });

  it('keeps the wobble apart from a note drifting under it', () => {
    const r = readings(5.5, 70, 1, { drift: 60 });
    const f = fitSecond(r.t, r.m);
    expect(f?.kind).toBe('wobble');
    expect(Math.abs((f?.width ?? 0) - 70)).toBeLessThan(10);
  });

  it('a steady note is no wobble', () => {
    for (const seed of [1, 2, 3, 4, 5]) expect(fitSecond(...Object.values(readings(5, 0, 1, { seed, noise: 6 })) as [number[], number[]])?.kind).toBe('none');
  });

  it('two notes taking turns slowly are turns, never a wobble', () => {
    for (const per of [1, 1.5, 2, 3]) {
      const r = turns(per);
      const ms = wobbleMeasures(r.t, r.m, 0, 4);
      expect(ms.length, String(per)).toBeGreaterThan(0);
      expect(ms.filter((x) => x.kind === 'wobble'), String(per)).toEqual([]);
    }
    const r = turns(2);
    expect(hold(wobbleMeasures(r.t, r.m, 0, 4), 0, 4).kind).toBe('turns');
  });

  it('a hold: its speed and width, and at its start, middle and end', () => {
    /* the wobble widening through the hold */
    const t: number[] = [], m: number[] = [];
    for (let k = 0; k < 80; k++) {
      const s = k / 20, w = 40 + 20 * s;
      t.push(s);
      m.push(60 + ((w / 2) * Math.sin(2 * Math.PI * 5.5 * s)) / 100);
    }
    const h = hold(wobbleMeasures(t, m, 0, 4), 0, 4);
    expect(h.kind).toBe('wobble');
    expect(h.start.width as number).toBeLessThan(h.middle.width as number);
    expect(h.middle.width as number).toBeLessThan(h.end.width as number);
    expect(Math.abs((h.rate as number) - 5.5)).toBeLessThan(0.15);
    /* the first part, while the note is found, isn't measured */
    expect(wobbleMeasures(t, m, 0, 4)[0].at).toBeGreaterThanOrEqual(SETTLE);
    /* nothing heard: nothing said */
    expect(hold([], 0, 4).kind).toBe('unheard');
  });

  it('a slip of the reader (an octave out) does not wreck the measure', () => {
    const r = readings(5.5, 80, 1);
    r.m[7] += 12;
    const f = fitWave(r.t, r.m);
    expect(Math.abs((f?.width ?? 0) - 80)).toBeLessThan(10);
  });

  it('the typical ranges are the research report\'s', () => {
    expect(TYPICAL_RATE).toEqual([4.5, 6.5]);
    expect(TYPICAL_WIDTH).toEqual([50, 120]);
    expect(copy.train.typicalSpeed).toContain('4.5 to 6.5');
    expect(copy.train.typicalWidth).toContain('50 to 120');
    expect(copy.train.notTarget).toMatch(/not a target/);
  });
});

describe('Vibrato, the exercise (Robert, 16 Nov)', () => {
  const range = { lo: 45, hi: 69 };
  it('is Advanced, in Tone, last; measured, not scored; no levels; "ah", or "oh" or "ee"', () => {
    const e = ex('vibrato');
    expect(e).toMatchObject({ category: 'tone', level: 3, own: 3, engine: { kind: 'wobble' }, vowels: ['ah', 'oh', 'ee'] });
    expect(measures(e)).toBe('wobble');
    expect(e.levels).toBeUndefined();
    expect(copy.ex.vibrato.name).toBe('Vibrato');
    expect(resultRow(e, { kind: 'wobble', holds: [] })).toEqual({ kind: 'practice', app_ex_id: 'vibrato', label: 'Vibrato' });
  });

  it('a round: the lower note alone, the two notes taking turns faster and faster, then the lower note held', () => {
    const s = wobbleNotes(ex('vibrato'), range);
    const first = s.played.filter((n) => n.t < s.played.find((x, i) => i > 0 && x.lead)!.t);
    /* the lead: one note of the first speed */
    expect(first[0]).toMatchObject({ m: 47, d: WOBBLE_SPEEDS[0].d, lead: true });
    const rest = first.slice(1);
    const turnsN = WOBBLE_SPEEDS.reduce((a, b) => a + b.n, 0);
    expect(rest.slice(0, turnsN).map((n) => n.m)).toEqual(Array.from({ length: turnsN }, (_, k) => 47 + (k % 2)));
    /* each speed's notes are the same length, and the speeds get faster */
    let k = 0;
    for (const sp of WOBBLE_SPEEDS) for (let i = 0; i < sp.n; i++, k++) expect(rest[k].d).toBe(sp.d);
    expect(WOBBLE_SPEEDS.map((x) => x.d)).toEqual([...WOBBLE_SPEEDS.map((x) => x.d)].sort((a, b) => b - a));
    /* ends on the upper, then holds the lower */
    expect(rest[turnsN - 1].m).toBe(48);
    expect(rest[turnsN]).toMatchObject({ m: 47, d: WOBBLE_HOLD });
    /* each note sung and checked SING_LAG after the piano plays it, as everywhere */
    const sung = s.played.filter((n) => !n.lead);
    expect(s.notes.every((n, i) => Math.abs(n.t - sung[i].t - SING_LAG) < 1e-9 && n.d === sung[i].d)).toBe(true);
    /* a note's quiet before every round after the first, as everywhere */
    const leads = s.played.filter((n) => n.lead);
    const hold1 = rest[turnsN];
    expect(leads[1].t - (hold1.t + hold1.d)).toBeCloseTo(WOBBLE_SPEEDS[0].d, 9);
  });

  it('climbs a half step a round, both notes two half steps inside the range', () => {
    const s = wobbleNotes(ex('vibrato'), range);
    const leads = s.played.filter((n) => n.lead).map((n) => n.m);
    expect(leads[0]).toBe(range.lo + 2);
    expect(leads.every((m, i) => i === 0 || m === leads[i - 1] + 1)).toBe(true);
    expect(Math.max(...s.played.map((n) => n.m))).toBe(range.hi - 2);
    expect(wobbleHolds(s.notes).length).toBe(leads.length);
    expect(wobbleHolds(s.notes).every((n) => n.d === WOBBLE_HOLD)).toBe(true);
  });

  it('is sung on the vowel picked', () => {
    const e = ex('vibrato');
    expect(notesFor(e, range).notes.every((n) => n.syl.endsWith('ah'))).toBe(true);
    expect(notesFor(e, range, { vowel: 'ee' }).notes.every((n) => n.syl.endsWith('ee'))).toBe(true);
  });

  it('its page: steps, doing it right, watch out for, why it helps', () => {
    const a = copy.about.vibrato;
    expect(a.steps.length).toBeGreaterThanOrEqual(4);
    expect(a.right && a.watch && a.why).toBeTruthy();
    expect(stepsFor('vibrato').at(-1)).toBe(copy.stepLines.stopEasy);
    expect(a.watch).toMatch(/jaw/);
    expect(a.watch).toMatch(/head/);
    expect(a.watch).toMatch(/louder/);
    expect(a.watch).toMatch(/range/);
    expect(a.why).toMatch(/free/);
    expect(a.why).toMatch(/see/);
  });

  it('never says how to make the wobble inside the body, and never whether it sounds good (the research report\'s rules)', () => {
    const a = copy.about.vibrato;
    const how = [...a.steps, a.right, a.why, copy.ex.vibrato.goal, copy.ex.vibrato.how].join(' ').toLowerCase();
    for (const w of ['voice box', 'larynx', 'throat', 'belly', 'diaphragm', 'stomach', 'tummy', 'abdom', 'jaw', 'head', 'shake', 'shaking', 'pulse', 'pulsing',
      'muscle', 'good', 'great', 'better', 'correct', 'beautiful', 'nice', 'proper', 'wrong']) {
      expect(how, w).not.toContain(w);
    }
    /* the watch-out names the jaw and head only as what not to do */
    expect(a.watch.toLowerCase()).not.toMatch(/voice box|larynx|belly|diaphragm|good|correct/);
    /* the result: numbers beside typical ranges, never a verdict */
    const words = Object.entries(copy.train).filter(([k]) => /wobble|typical|notTarget|centsAre|overHold|perRound|noPart|stillTurns/i.test(k)).map(([, v]) => String(v).toLowerCase()).join(' ');
    for (const w of ['good', 'great', 'right', 'correct', 'should', 'aim', 'goal', 'well done']) expect(words, w).not.toContain(w);
  });
});
