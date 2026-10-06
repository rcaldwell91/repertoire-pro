import { describe, expect, it } from 'vitest';
import { reportWords, soundCheckView, type SoundCheckIn } from './sound-check';

const at = (p: Partial<SoundCheckIn>): SoundCheckIn =>
  ({ active: false, mine: true, state: 'idle', step: 1, mic: 'closed', withoutMic: false, ...p });

describe('the Sound check screen', () => {
  it('offers Start, and nothing else, before anything happens', () => {
    expect(soundCheckView(at({ mine: false }))).toEqual({ line: 'ready', button: 'start', level: false, carryOn: false });
  });
  it('offers Stop while the note plays and the mic opens', () => {
    expect(soundCheckView(at({ active: true, state: 'running' })).button).toBe('stop');
    expect(soundCheckView(at({ active: true, state: 'running', mic: 'opening' })).line).toBe('opening');
  });
  it('shows the bar only while the mic is open', () => {
    expect(soundCheckView(at({ active: true, state: 'running', mic: 'open' })).level).toBe(true);
    expect(soundCheckView(at({ state: 'stopped', mic: 'closed' })).level).toBe(false);
  });
  it('offers "Carry on without it" when the mic is refused, until chosen', () => {
    const refused = at({ state: 'finished', mic: 'refused' });
    expect(soundCheckView(refused)).toMatchObject({ line: 'refused', button: 'start', carryOn: true });
    expect(soundCheckView({ ...refused, withoutMic: true })).toMatchObject({ line: 'again', carryOn: false });
  });
  it('shows Start again after leaving, whatever was going on', () => {
    expect(soundCheckView(at({ state: 'stopped', mic: 'closed' }))).toMatchObject({ line: 'ready', button: 'start' });
    /* a session from before this screen was opened is not this screen's */
    expect(soundCheckView(at({ mine: false, state: 'finished', mic: 'refused' })).line).toBe('ready');
  });
  it('never says a note plays before the clock has proved it, nor that it listens during the note', () => {
    expect(soundCheckView(at({ active: true, state: 'armed', mic: 'open' })).line).toBe('starting');
    expect(soundCheckView(at({ active: true, state: 'running', step: 0, mic: 'open' })).line).toBe('note');
    expect(soundCheckView(at({ active: true, state: 'running', step: 1, mic: 'open' })).line).toBe('listening');
  });
  it('says when another app has the mic', () => {
    expect(soundCheckView(at({ active: true, state: 'running', mic: 'held' })).line).toBe('held');
    expect(soundCheckView(at({ state: 'finished', mic: 'held' })).line).toBe('held');
  });
});

describe('the Sound check report, in plain words', () => {
  const r = { moving: true, state: 'running', mic: 'open' as const, micLabel: 'Headset microphone', headphones: ['Wired headset'],
    output: null, outLevel: 0.2, micLevel: 0.05 };
  it('reads each row from what the phone says', () => {
    expect(reportWords(r)).toEqual({ clock: 'moving', state: 'running', mic: 'micWorking', micName: 'Headset microphone', sentOut: true,
      heard: 20, headphones: 'Wired headset', output: null });
  });
  it('a clock that stands still says so, whatever the phone calls it', () => {
    expect(reportWords({ ...r, moving: false }).clock).toBe('still');
    expect(reportWords({ ...r, moving: false }).state).toBe('running');
  });
  it('names a mic held by another app, refused, or not used', () => {
    expect(reportWords({ ...r, mic: 'held' }).mic).toBe('micHeld');
    expect(reportWords({ ...r, mic: 'refused' })).toMatchObject({ mic: 'micRefused', heard: null });
    expect(reportWords({ ...r, mic: 'closed', headphones: [] })).toMatchObject({ mic: 'micClosed', headphones: null });
  });
});
