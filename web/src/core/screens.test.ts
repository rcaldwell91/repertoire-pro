import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* RULEBOOK 3 (Robert, 24 Oct): every screen has ONE stated goal, and
   everything on it must bring the person closer to it. The goal is the
   first line of the screen's file, as "Goal: ...", one line, so whoever
   adds anything to a screen reads it first. */
const SCREENS = new URL('../screens/', import.meta.url);

export function goalProblems(files: Array<{ name: string; text: string }>): string[] {
  const out: string[] = [];
  for (const { name, text } of files) {
    const first = text.split('\n')[0];
    const m = /^\/\* Goal: (.+?) \*\/$/.exec(first);
    if (!m) out.push(`${name}: the first line is not its one-line goal`);
    else if (m[1].trim().split(/\s+/).length < 3) out.push(`${name}: the goal says too little: "${m[1]}"`);
  }
  return out;
}

describe('every screen states its one goal (RULEBOOK 3)', () => {
  it('as the first line of its file', () => {
    const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'))
      .map((name) => ({ name, text: readFileSync(new URL(name, SCREENS), 'utf8') }));
    expect(files.length).toBeGreaterThan(5);
    expect(goalProblems(files)).toEqual([]);
  });

  it('catches a screen without one, or with the goal further down (it can fail)', () => {
    expect(goalProblems([
      { name: 'a.tsx', text: "import x from 'y';\n/* Goal: start the warm-up in one tap. */\n" },
      { name: 'b.tsx', text: '/* Goal: sing */\n' },
      { name: 'c.tsx', text: '/* Goal: start the warm-up in one tap. */\nimport x;\n' },
    ])).toHaveLength(2);
  });
});
