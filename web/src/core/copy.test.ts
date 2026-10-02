import { describe, expect, it } from 'vitest';
import { allCopy, copy } from './copy';

/* RULEBOOK 2.4, the copy-lint: no "acapella" or "a cappella", no jargon
   ("stem", "separator", "latency", "f0"), and no instruction line over eight
   words. Every string in core/copy is held to the eight-word cap. */
export const BANNED = ['acapella', 'a cappella', 'stem', 'stems', 'separator', 'latency', 'f0'];
export const MAX_WORDS = 8;

export function problems(lines: Array<{ at: string; text: string }>): string[] {
  const out: string[] = [];
  for (const { at, text } of lines) {
    const low = text.toLowerCase();
    for (const w of BANNED) {
      if (new RegExp('(^|[^a-z0-9])' + w.replace(' ', '\\s+') + '([^a-z0-9]|$)').test(low)) out.push(`${at}: "${w}" in "${text}"`);
    }
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) out.push(`${at}: ${words} words, "${text}"`);
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

  it('does not flag ordinary words that merely contain a banned one', () => {
    expect(problems([{ at: 'x', text: 'Your system stemmed from here' }])).toEqual([]);
  });

  it('has a name for every tab', () => {
    expect(Object.keys(copy.tabs)).toEqual(['home', 'train', 'sing', 'coach', 'learn', 'library', 'profile']);
  });
});
