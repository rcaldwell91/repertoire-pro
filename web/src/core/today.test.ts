import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import { DAILY, ROUTINES } from './exercises';
import { pickToday, routineToday, TODAY_ORDER, type TodayItem } from './today';

/* Robert, 27 Oct: the top card on Train is "Today": what the singer should
   do next, from one source, in this order: what a coach assigned, today's
   day of a program they bought, their own plan, which falls back to the
   daily warm-up. */
const item = (name: string): TodayItem => ({ ...routineToday('cooldown'), name });

describe('Today', () => {
  it('asks in this order: a coach, then a program, then their own plan', () => {
    expect(TODAY_ORDER).toEqual(['coach', 'program', 'own']);
  });

  it('a coach\'s assignment comes first, then a program\'s day, then their own plan', async () => {
    const all = { coach: async () => item('C'), program: async () => item('P'), own: async () => item('O') };
    expect(await pickToday(all)).toMatchObject({ name: 'C', from: 'coach' });
    expect(await pickToday({ ...all, coach: async () => null })).toMatchObject({ name: 'P', from: 'program' });
    expect(await pickToday({ ...all, coach: async () => null, program: async () => null })).toMatchObject({ name: 'O', from: 'own' });
  });

  it('with nothing from any of them, it is the daily warm-up', async () => {
    const t = await pickToday({});
    expect(t).toMatchObject({ from: 'own', name: copy.routineNames[DAILY], mins: ROUTINES[DAILY].mins, count: ROUTINES[DAILY].steps.length,
      start: { kind: 'routine', key: DAILY } });
  });

  it('a source that fails is passed over, never the end of Today', async () => {
    expect(await pickToday({ coach: async () => { throw new Error('offline'); }, own: async () => item('O') })).toMatchObject({ name: 'O' });
  });
});
