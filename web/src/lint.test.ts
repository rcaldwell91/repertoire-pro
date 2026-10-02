import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

/* RULEBOOK 2.1: screens/ and ui/ may not import engine-* or touch
   AudioContext or getUserMedia. RULEBOOK 2.4: their words come from
   core/copy. The lint rule is only worth something if it fails on the
   broken case, so each break is fed to it and must be caught. */
const eslint = new ESLint({ cwd: process.cwd() });
async function errors(code: string, filePath: string): Promise<string[]> {
  const [r] = await eslint.lintText(code, { filePath });
  return r.messages.filter((m) => m.severity === 2).map((m) => m.ruleId + ': ' + m.message);
}

const BREAKS: Array<[string, string]> = [
  ['imports a web engine', "import { WebEngine } from '../audio/engine-web/web-engine';\nexport const e = WebEngine;"],
  ['imports the fake engine', "import { FakeEngine } from '../audio/engine-fake/fake-engine';\nexport const e = FakeEngine;"],
  ['makes an AudioContext', 'export const a = new AudioContext();'],
  ['makes an AudioContext from window', 'export const a = new window.AudioContext();'],
  ['asks for the mic', 'export const m = navigator.mediaDevices.getUserMedia({ audio: true });'],
  ['writes its own words', 'export const X = () => <p>Press start</p>;'],
  ['makes up a tap', "export const go = (c: { tap(e: unknown): unknown }) => c.tap({ isTrusted: true, type: 'click' });"],
  ['writes its own label', 'export const X = () => <button aria-label="Start" />;'],
];

describe('the sound and words lint rule', () => {
  for (const dir of ['screens', 'ui']) {
    for (const [what, code] of BREAKS) {
      it(`refuses a ${dir} file that ${what}`, async () => {
        expect((await errors(code, `src/${dir}/Broken.tsx`)).length).toBeGreaterThan(0);
      }, 30000);
    }
  }

  it('lets a screen use the conductor and the copy', async () => {
    const ok = "import { copy } from '../core/copy';\nimport type { Conductor } from '../audio/conductor/conductor';\n" +
      'export const X = (p: { c: Conductor }) => <button aria-label={copy.soundCheck.start} onClick={() => p.c.stop()}>{copy.soundCheck.start}</button>;';
    expect(await errors(ok, 'src/screens/Fine.tsx')).toEqual([]);
  }, 30000);

  it('does not apply to the place the engine is made', async () => {
    expect(await errors('export const a = new AudioContext();', 'src/audio/engine-web/x.ts')).toEqual([]);
  }, 30000);
});
