import { describe, expect, it } from 'vitest';
import { soundCheckView, type SoundCheckIn } from './sound-check';

const at = (p: Partial<SoundCheckIn>): SoundCheckIn =>
  ({ active: false, mine: true, state: 'idle', mic: 'closed', withoutMic: false, ...p });

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
});
