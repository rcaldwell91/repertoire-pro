import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* RULEBOOK 2.6: the old app is the checklist. Every rule in CHECKLIST.md
   marked ✓ names the tests that guard it; each must exist. A ✗ must say
   whose decision it waits on, and a — must say why it isn't in the app. */
const WEB = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, WEB), 'utf8');

export function problems(list: string): string[] {
  const out: string[] = [];
  const rules = list.split('\n').filter((l) => /^- [✓✗—] /.test(l));
  if (rules.length < 50) out.push(`only ${rules.length} rules listed`);
  for (const line of rules) {
    const mark = line[2];
    const refs = [...line.matchAll(/`([a-z]+):([^`]+)`/g)].map((m) => ({ suite: m[1], rest: m[2] }));
    if (mark === '✓' && !refs.length) out.push('no test named: ' + line);
    if (mark === '✗' && !/Robert's decision/.test(line)) out.push('a cross must wait on Robert\'s decision: ' + line);
    if (mark === '—' && !/(Not |not |Replaced by|See the decisions|In the new app|The new app|new app has)/.test(line)) out.push('say why it is not in the app: ' + line);
    for (const { suite, rest } of refs) {
      if (suite === 'unit') {
        const at = rest.indexOf(':');
        const file = 'src/' + rest.slice(0, at);
        const words = rest.slice(at + 1);
        if (!existsSync(new URL(file, WEB))) out.push(`no such test file: ${file}`);
        else if (!read(file).replace(/\\/g, '').includes(words)) out.push(`no test "${words}" in ${file}`);
      } else {
        const file = `tests/${suite}.test.mjs`;
        if (!existsSync(new URL(file, WEB))) out.push(`no such suite: ${file}`);
        else if (!new RegExp(`'${rest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(read(file))) out.push(`no check "${rest}" in ${file}`);
      }
    }
  }
  return out;
}

describe('the old app as the checklist', () => {
  it('names a test that exists for every rule ticked, and a reason for every other', () => {
    expect(problems(read('CHECKLIST.md'))).toEqual([]);
  });

  it('catches a test that does not exist, a tick with no test, and a cross with no decision (it can fail)', () => {
    const bad = Array.from({ length: 50 }, () => '- — Not in the new app.').join('\n') +
      '\n- ✓ a rule — test: `android:no-such-check`\n- ✓ a rule with nothing\n- ✗ a rule\n- ✓ a rule — test: `unit:core/song.test.ts:no such words`';
    expect(problems(bad).length).toBe(4);
  });
});
