import { describe, expect, it } from 'vitest';
import { allCopy, copy } from './copy';

/* RULEBOOK 2.4, the copy-lint: no "acapella" or "a cappella", no jargon
   ("stem", "separator", "latency", "f0"), and no instruction line over eight
   words. Every string in core/copy is held to the eight-word cap, except
   the old app's explanations under copy.about (Robert, 24 Oct: "More about
   this"), which are prose: their words are checked, not their length. */
export const BANNED = ['acapella', 'a cappella', 'stem', 'stems', 'separator', 'latency', 'f0'];
export const MAX_WORDS = 8;
/** an exercise's How line: one plain sentence, up to 14 words (Robert, 25 Oct) */
export const MAX_HOW_WORDS = 14;
export const isHow = (at: string) => /^copy\.ex\.\w+\.how$/.test(at);

export function problems(lines: Array<{ at: string; text: string; prose?: boolean }>): string[] {
  const out: string[] = [];
  for (const { at, text, prose } of lines) {
    const low = text.toLowerCase();
    for (const w of BANNED) {
      if (new RegExp('(^|[^a-z0-9])' + w.replace(' ', '\\s+') + '([^a-z0-9]|$)').test(low)) out.push(`${at}: "${w}" in "${text}"`);
    }
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const cap = isHow(at) ? MAX_HOW_WORDS : MAX_WORDS;
    if (words > cap && !prose) out.push(`${at}: ${words} words, "${text}"`);
  }
  return out;
}

describe('copy-lint', () => {
  it('every line in core/copy is plain and short', () => {
    expect(problems(allCopy())).toEqual([]);
  });

  it('catches each banned word and a long line (it can fail)', () => {
    const bad = [
      { at: 'a', text: 'Sing the acapella' },
      { at: 'b', text: 'A Cappella mode' },
      { at: 'c', text: 'Mute the stem' },
      { at: 'd', text: 'The separator is busy' },
      { at: 'e', text: 'Latency is high' },
      { at: 'f', text: 'Your f0 is 220' },
      { at: 'g', text: 'one two three four five six seven eight nine' },
    ];
    expect(problems(bad).length).toBe(bad.length);
  });

  it('holds prose to the banned words, not to the eight-word cap (it can fail)', () => {
    const long = 'one two three four five six seven eight nine';
    expect(problems([{ at: 'copy.about.x.why', text: long, prose: true }])).toEqual([]);
    expect(problems([{ at: 'copy.about.x.why', text: long + ' latency', prose: true }])).toHaveLength(1);
    expect(problems([{ at: 'copy.train.x', text: long, prose: false }])).toHaveLength(1);
  });

  it('a How line may run to 14 words, and no further (it can fail)', () => {
    const w = (n: number) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');
    expect(problems([{ at: 'copy.ex.mum.how', text: w(14) }])).toEqual([]);
    expect(problems([{ at: 'copy.ex.mum.how', text: w(15) }])).toHaveLength(1);
    expect(problems([{ at: 'copy.ex.mum.goal', text: w(9) }])).toHaveLength(1);
    expect(problems([{ at: 'copy.train.how', text: w(9) }])).toHaveLength(1);
  });

  it('only the explanations under copy.about are prose', () => {
    const prose = allCopy().filter((l) => l.prose);
    expect(prose.length).toBeGreaterThan(50);
    expect(prose.every((l) => l.at.startsWith('copy.about.'))).toBe(true);
    /* the old app's exercises have them; the range check and Articulation (ours) do not */
    const ours = ['vowels', 'redleather', 'uniqueny', 'peterpiper', 'pops', 'tonguetip', 'lipstongue'];
    expect(Object.keys(copy.about)).toEqual(Object.keys(copy.ex).filter((k) => k !== 'rangecheck' && !ours.includes(k)));
  });

  it('does not flag ordinary words that merely contain a banned one', () => {
    expect(problems([{ at: 'x', text: 'Your system stemmed from here' }])).toEqual([]);
  });

  it('has a name for every tab', () => {
    expect(Object.keys(copy.tabs)).toEqual(['home', 'train', 'sing', 'coach', 'learn', 'library', 'profile']);
  });
});

/* Robert, 25 Oct: the pattern card already shows the notes and the
   syllable, so How says what to do with the body, breath or mouth, in one
   plain sentence: never which sound, never how many notes. */
const NUMBERS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twice', 'octave', 'notes'];
export function howProblems(ex: Record<string, { syl: string; syls?: readonly string[]; how: string }>): string[] {
  const out: string[] = [];
  for (const [id, e] of Object.entries(ex)) {
    const words = e.how.trim().split(/\s+/).filter(Boolean);
    if (words.length > MAX_HOW_WORDS) out.push(`${id}: ${words.length} words`);
    if ((e.how.match(/[.!?]/g) ?? []).length > 1) out.push(`${id}: more than one sentence`);
    const low = ' ' + e.how.toLowerCase().replace(/[^a-z0-9&' ]+/g, ' ') + ' ';
    /* the one syllable named, or two of a phrase's syllables in a row ("red leather");
       a phrase's single syllables may be everyday words ("and") */
    const bare = e.syl.toLowerCase().replace(/[^a-z]/g, '');
    if (bare.length >= 2 && low.includes(' ' + bare + ' ')) out.push(`${id}: names its sound "${e.syl}"`);
    const syls = (e.syls ?? []).map((x) => x.toLowerCase().replace(/[^a-z]/g, ''));
    for (let i = 0; i + 1 < syls.length; i++) {
      if (low.includes(' ' + syls[i] + ' ' + syls[i + 1] + ' ') || low.includes(' ' + syls[i] + syls[i + 1] + ' ')) out.push(`${id}: names its sound "${syls[i]} ${syls[i + 1]}"`);
    }
    if (/\d/.test(e.how)) out.push(`${id}: a number`);
    for (const n of NUMBERS) if (low.includes(' ' + n + ' ')) out.push(`${id}: counts notes ("${n}")`);
  }
  return out;
}

describe('How lines (Robert, 25 Oct)', () => {
  it('say what to do with the body, breath or mouth, never the sound or how many notes', () => {
    expect(howProblems(copy.ex as Record<string, { syl: string; syls?: readonly string[]; how: string }>)).toEqual([]);
  });

  it('catches a sound named, a count, two sentences and a long line (it can fail)', () => {
    expect(howProblems({
      a: { syl: 'mum', how: 'Sing mum and keep the lips buzzing.' },
      b: { syl: 'ah', how: 'Up five notes and back.' },
      c: { syl: 'oo', how: 'Round the lips. Keep it light.' },
      d: { syl: 'ee', how: 'w w w w w w w w w w w w w w w' },
      e: { syl: 'xx', syls: ['la', 'ta'], how: 'Flick the tongue on la ta.' },
    }).length).toBe(6);
  });
});

/* Robert, 27 Oct: no singer jargon a beginner wouldn't know, in an
   exercise's name, goal or How. The old app's own names live on behind
   "More about this" (copy.about[id].aka), never on the page. */
export const JARGON = ['break', 'phonation', 'staccato', 'legato', 'crescendo', 'messa di voce', 'vocal function', 'farinelli', 'narrow vowel',
  'engaged', 'the line', 'five-tone', 'nine-tone', 'register', 'passaggio', 'glottis', 'glottal', 'larynx', 'vocal folds', 'cords', 'belt',
  'twang', 'resonance', 'onset', 'support', 'diaphragm', 'falsetto', 'head voice', 'chest voice', 'mix'];
export function jargonProblems(ex: Record<string, { name: string; goal: string; how: string }>): string[] {
  const out: string[] = [];
  for (const [id, e] of Object.entries(ex)) {
    for (const [field, text] of [['name', e.name], ['goal', e.goal], ['how', e.how]] as const) {
      const low = ' ' + text.toLowerCase().replace(/[^a-z\- ]+/g, ' ') + ' ';
      for (const w of JARGON) if (low.includes(' ' + w + ' ')) out.push(`${id}.${field}: "${w}"`);
    }
  }
  return out;
}

describe('plain words (Robert, 27 Oct)', () => {
  it('no singer jargon in a name, goal or How', () => {
    expect(jargonProblems(copy.ex)).toEqual([]);
  });

  it('catches a word a beginner would not know (it can fail)', () => {
    expect(jargonProblems({
      a: { name: 'Messa di voce', goal: 'A legato scale.', how: 'Slide through your break.' },
      b: { name: 'Breath counts', goal: 'In, hold, out.', how: 'Keep the ribs wide.' },
    })).toEqual(['a.name: "messa di voce"', 'a.goal: "legato"', 'a.how: "break"']);
  });

  it('a renamed exercise keeps the old app\'s name behind More about this', () => {
    const about = copy.about as Record<string, { aka?: string }>;
    expect(about.vfe.aka).toBe('Vocal Function Exercises');
    expect(copy.ex.vfe.name).toBe('Long soft notes');
    for (const [id, a] of Object.entries(about)) if (a.aka) expect(copy.ex[id as keyof typeof copy.ex].name, id).not.toBe(a.aka);
  });
});
