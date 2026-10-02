/* What the Sound check screen says and offers, from where the conductor is.
   Kept here so the screen stays thin (RULEBOOK 2) and this can be tested
   without a browser. */

export type SoundCheckLine =
  | 'ready' | 'note' | 'opening' | 'listening' | 'refused' | 'unavailable' | 'failed' | 'again';

export interface SoundCheckIn {
  readonly active: boolean;
  /** the conductor's session is one this screen started */
  readonly mine: boolean;
  readonly state: string;
  readonly mic: 'closed' | 'opening' | 'open' | 'refused' | 'unavailable' | 'failed';
  /** the singer chose "Carry on without it" */
  readonly withoutMic: boolean;
}

export interface SoundCheckView {
  readonly line: SoundCheckLine;
  readonly button: 'start' | 'stop';
  readonly level: boolean;
  readonly carryOn: boolean;
}

export function soundCheckView(s: SoundCheckIn): SoundCheckView {
  if (s.mine && s.active) {
    if (s.mic === 'open') return { line: 'listening', button: 'stop', level: true, carryOn: false };
    if (s.mic === 'opening') return { line: 'opening', button: 'stop', level: false, carryOn: false };
    return { line: 'note', button: 'stop', level: false, carryOn: false };
  }
  if (s.mine && !s.withoutMic && (s.mic === 'refused' || s.mic === 'unavailable' || s.mic === 'failed')) {
    return { line: s.mic, button: 'start', level: false, carryOn: true };
  }
  if (s.mine && s.state === 'finished') return { line: 'again', button: 'start', level: false, carryOn: false };
  return { line: 'ready', button: 'start', level: false, carryOn: false };
}
