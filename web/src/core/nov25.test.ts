import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import { exercise, type Exercise } from './exercises';
import { resultRow, wobbleLast } from './results';
import type { Hold } from './vibrato';

/* Robert, 25 Nov (his answer to the 24 Nov report): Vibrato's speed and
   width saved to the account, so they follow him to a new phone and his
   linked coach can read them; last time from the account when signed in,
   from the phone when not; sessions kept only on the phone stay there. */
const vib = exercise('vibrato') as Exercise;
const none = { rate: null, width: null };
const held = (kind: Hold['kind'], rate: number | null, width: number | null, m = 60): Hold & { m: number } =>
  ({ kind, rate, width, start: none, middle: none, end: none, n: 10, wobbled: rate == null ? 0 : 10, m });

describe('Vibrato on the account (25 Nov)', () => {
  it('the result carries the speed (to two places) and width (whole cents) over the held notes that wobbled', () => {
    const row = resultRow(vib, { kind: 'wobble', holds: [held('wobble', 5.4871, 76.4), held('none', null, null), held('wobble', 5.8, 81.6), held('wobble', 6.02, 90)] });
    expect(row).toEqual({ kind: 'practice', app_ex_id: 'vibrato', label: 'Vibrato', wobble_rate: 5.8, wobble_width: 82 });
    expect(resultRow(vib, { kind: 'wobble', holds: [held('wobble', 5.4871, 76.4)] })).toMatchObject({ wobble_rate: 5.49, wobble_width: 76 });
  });

  it('no wobble, no numbers: the columns are left empty', () => {
    const row = resultRow(vib, { kind: 'wobble', holds: [held('none', null, null), held('turns', null, null)] });
    expect(row).toEqual({ kind: 'practice', app_ex_id: 'vibrato', label: 'Vibrato' });
    expect('wobble_rate' in row || 'wobble_width' in row).toBe(false);
  });

  it('last time: from the account when signed in, its newest session with numbers', () => {
    const phone = { rate: 5.2, width: 70 };
    expect(wobbleLast([{ wobble_rate: null, wobble_width: null }, { wobble_rate: '4.80', wobble_width: 95 }, { wobble_rate: 6, wobble_width: 60 }], phone))
      .toEqual({ rate: 4.8, width: 95, from: 'account' });
    /* signed in, nothing on the account yet: nothing, even with a session kept only on this phone */
    expect(wobbleLast([], phone)).toBeNull();
  });

  it('last time: from this phone when signed out, or when the account can\'t be reached (and it says so)', () => {
    const phone = { rate: 5.2, width: 70 };
    expect(wobbleLast('out', phone)).toEqual({ rate: 5.2, width: 70, from: 'phone' });
    expect(wobbleLast('unreached', phone)).toEqual({ rate: 5.2, width: 70, from: 'phone' });
    expect(wobbleLast('out', null)).toBeNull();
    expect(copy.train.wobbleKept).toMatch(/this phone/);
    expect(copy.train.wobbleFromAccount).toMatch(/your account/);
  });

  it('the database script: two columns that can be left empty, and no change to who reads or writes results', () => {
    const sql = readFileSync('scripts/db/2026-11-25-results-wobble.sql', 'utf8');
    const code = sql.split('\n').filter((l) => !l.startsWith('--')).join('\n').toLowerCase();
    expect(code).toMatch(/add column if not exists wobble_rate numeric/);
    expect(code).toMatch(/add column if not exists wobble_width smallint/);
    expect(code).toMatch(/wobble_rate is null or/);
    expect(code).toMatch(/wobble_width is null or/);
    for (const w of ['not null', 'policy', 'grant', 'revoke', 'security', 'drop', 'delete', 'update ']) expect(code, w).not.toContain(w);
  });
});
