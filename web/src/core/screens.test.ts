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

/* RULEBOOK 1b (Robert, 28 Oct): the singing screen's controls are built
   once, and where they sit is set in ONE layout place: every screen that
   sings (it draws the note map's bubbles) goes through SingLayout, none
   lays out its own singing screen, and the placement is one CSS rule. */
export function layoutProblems(files: Array<{ name: string; text: string }>, css: string): string[] {
  const out: string[] = [];
  for (const { name, text } of files) {
    if (text.includes('<Bubbles') && !text.includes('<SingLayout')) out.push(`${name}: sings without the one layout`);
    if (/id="ex-run"|id="ex-pause"|id="ex-restart"|id="ex-close"/.test(text)) out.push(`${name}: builds its own singing controls`);
  }
  const areas = css.match(/grid-template-areas:[^;]*'bar'/g) ?? [];
  if (areas.length !== 1) out.push(`the controls' place is set in ${areas.length} rules, not one`);
  return out;
}

describe('the singing screen\'s one layout (RULEBOOK 1b)', () => {
  it('every singing screen through the one layout, its controls placed in one rule', () => {
    const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'))
      .map((name) => ({ name, text: readFileSync(new URL(name, SCREENS), 'utf8') }));
    const css = readFileSync(new URL('../ui/tokens.css', import.meta.url), 'utf8');
    expect(files.some((f) => f.text.includes('<SingLayout'))).toBe(true);
    expect(layoutProblems(files, css)).toEqual([]);
  });

  it('catches a screen that lays out its own (it can fail)', () => {
    expect(layoutProblems([
      { name: 'a.tsx', text: '<Bubbles notes={n} />' },
      { name: 'b.tsx', text: '<div id="ex-run"><button id="ex-close" /></div>' },
      { name: 'c.tsx', text: '<SingLayout><Bubbles /></SingLayout>' },
    ], ".a { grid-template-areas: 'top' 'bar'; } .b { grid-template-areas: 'bar' 'top'; }")).toHaveLength(3);
  });
});
