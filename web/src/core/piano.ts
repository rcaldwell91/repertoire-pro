/* The reference note is a real piano: Steinway B samples from the Versilian
   Community Sample Library, CC0 (RULEBOOK 4). Each sample's real pitch was
   measured offline (audio/piano/notes.json in the repo); a grand is
   stretch-tuned, so the playback rate corrects it to equal temperament
   rather than trusting the file's name ("Measure the sample file that
   ships"). */

export interface PianoSample {
  readonly midi: number;
  /** relative to the built app: the old app's own samples, one folder up,
      so the same file is shared rather than copied */
  readonly file: string;
  /** what the file actually sounds, measured */
  readonly measuredHz: number;
}

export const PIANO_C4: PianoSample = { midi: 60, file: '../audio/piano/60.mp3', measuredHz: 261.359 };

export function equalTempered(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** playback rate that puts the sample exactly on its note */
export function rateFor(s: PianoSample, midi = s.midi): number {
  return equalTempered(midi) / s.measuredHz;
}
