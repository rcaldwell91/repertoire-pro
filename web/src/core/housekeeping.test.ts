import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* RULEBOOK 2.7 and 2.8. Knowledge is carried between builds by copying the
   source doc into web/docs, never by summarising it: each copy is held to
   the exact bytes of Robert's file in Drive ("Repertoire" folder). And every
   merge to main gets a report for Robert in plain words, in REPORTS. */
const WEB = new URL('../../', import.meta.url);
const ROOT = new URL('../', WEB);

/** the docs as copied, 22 Oct 2026, from Drive: name, Drive id, bytes, sha-256 */
export const DOCS = [
  { name: 'android-samsung-headset.md', drive: '1JVCpddRvokFrotg9OvPa2_2WPkialvMp', bytes: 998,
    sha256: '9e167925316e01d07bed121e34da90c04914ffba20643114019c57e271f82b8d' },
  { name: 'android-audio-history.md', drive: '1wyZJf0fMHssPIP2DOTAHfIVxUXVHn3oP', bytes: 11439,
    sha256: '94f9fbbe9d03f3030359fc9c412dd54d2afa9c3945331551a8ed3646f6db9622' },
];

export const REPORT_PARTS = ['## What works', '## What was measured', '## Not tried on a real phone', '## Your taps'];

export function reportProblems(latest: string | null, log: string | null): string[] {
  const out: string[] = [];
  if (latest == null) return ['no REPORTS/latest.md'];
  if (!/^# Report, \d{1,2} [A-Z][a-z]{2} \d{4}, commit [0-9a-f]{7}\b/.test(latest)) out.push('the report starts without its date and commit');
  for (const p of REPORT_PARTS) if (!latest.includes('\n' + p + '\n')) out.push('the report has no "' + p.slice(3) + '"');
  if (log == null || !log.includes(latest.trim())) out.push('the latest report is not in REPORTS/log.md');
  return out;
}

describe('knowledge carried as copies, not summaries', () => {
  it('keeps each source doc exactly as it is in Drive', () => {
    for (const d of DOCS) {
      const f = new URL('docs/' + d.name, WEB);
      expect(existsSync(f), d.name).toBe(true);
      const b = readFileSync(f);
      expect(b.length, d.name).toBe(d.bytes);
      expect(createHash('sha256').update(b).digest('hex'), d.name).toBe(d.sha256);
    }
  });
});

describe('a report for Robert with every merge', () => {
  const read = (p: string) => (existsSync(new URL(p, ROOT)) ? readFileSync(new URL(p, ROOT), 'utf8') : null);
  it('has its date and commit, what works, what was measured, what was not tried on a real phone, and the taps, and is in the log', () => {
    expect(reportProblems(read('REPORTS/latest.md'), read('REPORTS/log.md'))).toEqual([]);
  });
  it('catches a report missing a part, its date, or its place in the log (it can fail)', () => {
    const good = '# Report, 22 Oct 2026, commit abcdef1\n\n' + REPORT_PARTS.map((p) => p + '\nx\n').join('\n');
    expect(reportProblems(good, 'older\n\n' + good)).toEqual([]);
    expect(reportProblems(good.replace('## Your taps\n', ''), good).length).toBe(2);
    expect(reportProblems(good.replace('22 Oct 2026', 'today'), 'x').length).toBe(2);
    expect(reportProblems(null, null).length).toBe(1);
  });
});
