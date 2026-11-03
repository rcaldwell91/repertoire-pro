import { describe, expect, it } from 'vitest';
import { EXERCISES } from './exercises';
import { cueFor, pickReminder, remindersFor, SPOTS, NO_LINE } from './tension';

/* Robert, 3 Nov: the "Ah" tension check's ticks bring a reminder line to
   later exercises, at most one, rotating through the ticks that suit the
   exercise; never one that contradicts it. Five exercises have a movement
   cue instead, which wins. */
describe('tension reminders', () => {
  it('six spots, in the spec\'s order', () => {
    expect(SPOTS).toEqual(['chin', 'jaw', 'wide', 'face', 'tongue', 'neck']);
  });

  it('never a reminder that contradicts the exercise', () => {
    const all = [...SPOTS];
    const not = (id: string) => all.filter((x) => !remindersFor(id, all).includes(x));
    expect(not('nay')).toEqual(['wide', 'face']);
    for (const id of ['hum', 'mum', 'liptrill', 'buzz', 'raspberry', 'straw', 'cheekpuffs', 'chewhum', 'tonguefwd', 'tongueout', 'tonguecresc', 'brighta', 'tonguetrill']) {
      expect(not(id), id).toContain('wide');
    }
    expect(not('chewhum')).toEqual(['jaw', 'wide', 'face']);
    expect(not('cheekpuffs')).toEqual(['wide', 'face']);
    expect(not('brighta')).toEqual(['wide', 'face', 'tongue']);
    for (const id of ['tongueout', 'tonguecresc', 'tonguefwd', 'tonguetrill', 'laga', 'loo', 'blah', 'vowels', 'redleather', 'pops', 'tonguetip']) {
      expect(not(id), id).toContain('tongue');
    }
    /* chin and neck can show everywhere a reminder can */
    for (const e of EXERCISES) if (!NO_LINE.includes(e.id)) expect(remindersFor(e.id, ['chin', 'neck']), e.id).toEqual(['chin', 'neck']);
  });

  it('none on Posture check, the tension check itself, or Sing the interval', () => {
    expect(NO_LINE).toEqual(['posture', 'tensioncheck', 'interval']);
    for (const id of NO_LINE) expect(remindersFor(id, [...SPOTS])).toEqual([]);
  });

  it('rotates: each start shows the next tick that suits the exercise', () => {
    expect(pickReminder('mee', ['jaw', 'neck'], 0)).toBe('jaw');
    expect(pickReminder('mee', ['jaw', 'neck'], 1)).toBe('neck');
    expect(pickReminder('mee', ['jaw', 'neck'], 2)).toBe('jaw');
    expect(pickReminder('chewhum', ['jaw'], 0)).toBeNull();
    expect(pickReminder('mee', [], 0)).toBeNull();
  });

  it('the movement cue on its five exercises, and only there', () => {
    const cued = EXERCISES.filter((e) => cueFor(e.id)).map((e) => e.id).sort();
    expect(cued).toEqual(['cheekpuffs', 'chewhum', 'mum', 'straw', 'tonguefwd']);
    expect(cueFor('tonguefwd')).toBe('Keep your head moving slowly.');
  });
});
