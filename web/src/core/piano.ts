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

/* every shipped sample, as measured (audio/piano/notes.json): C2 to C7
   every four semitones; any other note is played by the nearest, retuned
   (Robert, 23 Oct) */
export const PIANO: readonly PianoSample[] = ([
  [36, 65.068], [40, 82.081], [44, 103.716], [48, 130.543], [52, 164.451], [56, 207.211], [60, 261.359], [64, 329.284],
  [68, 414.913], [72, 523.04], [76, 659.731], [80, 831.498], [84, 1048.525], [88, 1319.141], [92, 1666.925], [96, 2109.326],
] as const).map(([midi, measuredHz]) => ({ midi, file: `../audio/piano/${midi}.mp3`, measuredHz }));

/** the sample to play a note on, and its rate */
export function pianoFor(midi: number): { file: string; rate: number } {
  const m = Math.round(midi);
  const s = PIANO.reduce((a, b) => (Math.abs(b.midi - m) < Math.abs(a.midi - m) ? b : a));
  return { file: s.file, rate: rateFor(s, m) };
}
