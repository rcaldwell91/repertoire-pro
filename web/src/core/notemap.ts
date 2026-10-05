/* The note map, as numbers (RULEBOOK 1b, Learn a song): the singer's line
   and your line on rows of keys, a now-line, the view pinned to the song's
   own range. Drawn by ui/NoteMap; the sums are here so they can be tested. */

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** 60 -> "C4" */
export function keyName(m: number): string {
  const r = Math.round(m);
  return NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
}

export interface Range {
  readonly lo: number;
  readonly hi: number;
}

/** The song's own range, from its singer's line, 3 semitones either side.
    Pinned: it depends only on the whole line, never on where the song is
    (RULEBOOK 4, Pitch: "Pin the view; don't recentre"). The lowest and
    highest 1% are left out, so one stray reading cannot stretch it. */
export function pinnedRange(line: ArrayLike<number>): Range | null {
  const v: number[] = [];
  for (let i = 0; i < line.length; i++) if (Number.isFinite(line[i])) v.push(line[i]);
  if (v.length < 5) return null;
  v.sort((a, b) => a - b);
  const lo = v[Math.floor(v.length * 0.01)];
  const hi = v[Math.min(v.length - 1, Math.ceil(v.length * 0.99) - 1)];
  return { lo: Math.floor(lo) - 3, hi: Math.ceil(hi) + 3 };
}

/** "Any octave": move your note by whole octaves to the one nearest the
    singer's. Off (the default), your note is drawn where it is. */
export function foldTo(m: number, ref: number): number {
  return m + 12 * Math.round((ref - m) / 12);
}

/** The singer's note at time t, or the last one before it (for folding a
    note you sing in a gap of theirs). NaN if none. */
export function singerAt(line: ArrayLike<number>, hop: number, t: number): number {
  for (let k = Math.min(line.length - 1, Math.round(t / hop)); k >= 0 && k > Math.round(t / hop) - 40; k--) {
    if (Number.isFinite(line[k])) return line[k];
  }
  return NaN;
}

/** The pen is lifted across a gap, and across a leap of more than six
    semitones (RULEBOOK 4: "Lift the pen across big jumps"). */
export const PEN_LEAP = 6;
export function penDown(prev: number, next: number): boolean {
  return Number.isFinite(prev) && Number.isFinite(next) && Math.abs(next - prev) <= PEN_LEAP;
}
