/* What the Sound check screen says and offers, from where the conductor is.
   Kept here so the screen stays thin (RULEBOOK 2) and this can be tested
   without a browser. */

export type SoundCheckLine =
  | 'ready' | 'starting' | 'note' | 'opening' | 'listening' | 'refused' | 'unavailable' | 'failed' | 'held' | 'again';

export type Mic = 'closed' | 'opening' | 'open' | 'refused' | 'unavailable' | 'failed' | 'held';

export interface SoundCheckIn {
  readonly active: boolean;
  /** the conductor's session is one this screen started */
  readonly mine: boolean;
  readonly state: string;
  /** the step playing: 0 is the note */
  readonly step: number;
  readonly mic: Mic;
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
    if (s.mic === 'opening') return { line: 'opening', button: 'stop', level: false, carryOn: false };
    /* nothing is said to play until the clock has proved it (RULEBOOK 4, Sound, Android 7) */
    if (s.state !== 'running') return { line: 'starting', button: 'stop', level: false, carryOn: false };
    if (s.step === 0) return { line: 'note', button: 'stop', level: false, carryOn: false };
    if (s.mic === 'open') return { line: 'listening', button: 'stop', level: true, carryOn: false };
    if (s.mic === 'held') return { line: 'held', button: 'stop', level: false, carryOn: false };
    return { line: 'note', button: 'stop', level: false, carryOn: false };
  }
  if (s.mine && !s.withoutMic && (s.mic === 'refused' || s.mic === 'unavailable' || s.mic === 'failed' || s.mic === 'held')) {
    return { line: s.mic, button: 'start', level: false, carryOn: true };
  }
  if (s.mine && s.state === 'finished') return { line: 'again', button: 'start', level: false, carryOn: false };
  return { line: 'ready', button: 'start', level: false, carryOn: false };
}

/** The Sound check's report, in plain words, row by row. */
export interface ReportIn {
  readonly moving: boolean;
  readonly state: string;
  readonly mic: Mic;
  readonly micLabel: string | null;
  readonly headphones: readonly string[];
  readonly output: string | null;
  readonly outLevel: number;
  readonly micLevel: number;
}

export interface ReportWords {
  readonly clock: 'moving' | 'still';
  readonly state: string;
  readonly mic: 'micWorking' | 'micRefused' | 'micHeld' | 'micMissing' | 'micFailed' | 'micClosed';
  readonly micName: string | null;
  readonly sentOut: boolean;
  /** the mic heard sound while the note played, as a percent; null if no mic */
  readonly heard: number | null;
  readonly headphones: string | null;
  readonly output: string | null;
}

export function reportWords(r: ReportIn): ReportWords {
  const mic = ({ open: 'micWorking', held: 'micHeld', refused: 'micRefused', unavailable: 'micMissing', failed: 'micFailed',
    closed: 'micClosed', opening: 'micClosed' } as const)[r.mic];
  const live = r.mic === 'open' || r.mic === 'held';
  return {
    clock: r.moving ? 'moving' : 'still',
    state: r.state,
    mic,
    micName: r.micLabel || null,
    sentOut: r.outLevel > 0.001,
    heard: live ? Math.round(Math.min(1, r.micLevel * 4) * 100) : null,
    headphones: r.headphones.length ? r.headphones.join(', ') : null,
    output: r.output,
  };
}
