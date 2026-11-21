import { describe, expect, it } from 'vitest';
import { EDGE, GLIDE, LOOK, songView } from './songview';

/* Learn a song's view (Robert, 22 Nov). The proof is the real songs
   (tests/lab-songmap.mjs); these pin the rules the path keeps. */
const HOP = 0.05;
/** a line of phrases: [start s, length s, note] */
function line(phrases: Array<[number, number, number]>, secs: number): Float32Array {
  const m = new Float32Array(Math.round(secs / HOP)).fill(NaN);
  for (const [a, d, n] of phrases) for (let k = Math.round(a / HOP); k < Math.round((a + d) / HOP); k++) m[k] = n + 0.2 * Math.sin(k);
  return m;
}
const upcomingOut = (m: Float32Array, span: number) => {
  const v = songView(m, HOP, span);
  let out = 0;
  for (let k = 0; k < m.length; k++) {
    const mid = v.mid(k * HOP);
    for (let j = k; j <= Math.min(m.length - 1, k + LOOK / HOP); j++) if (Number.isFinite(m[j]) && (m[j] < mid - span / 2 || m[j] > mid + span / 2)) out++;
  }
  return out;
};

describe('Learn a song\'s view: one spacing, sliding ahead of the notes', () => {
  const song = line([[1, 3, 60], [5, 3, 62], [9, 3, 74], [13, 3, 76], [17, 2, 66], [20, 3, 64]], 25);
  it('stays put while the notes fit, and moves only when the next ones would not', () => {
    const v = songView(song, HOP, 15);
    expect(v.span).toBe(15);
    /* 60 to 62 fit; then 62 with 74 (13 rows of room); then 74 to 76 and on down to 64: two moves */
    expect(v.moves.length).toBe(2);
    expect(v.mid(0)).toBe(v.mid(4));
    /* a taller view holds 60 to 76 at once: fewer moves */
    expect(songView(song, HOP, 20).moves.length).toBeLessThan(2);
  });
  it('each move glides, and is done LOOK seconds before the notes it is for', () => {
    const v = songView(song, HOP, 15);
    for (const mv of v.moves) expect(mv.b - mv.a).toBeGreaterThan(GLIDE - 0.06);
    expect(v.moves[0].b).toBeLessThanOrEqual(9 - LOOK + 0.06);
    expect(v.mid(9)).toBeGreaterThan(74 - 15 / 2 + EDGE - 0.01);
  });
  it('no note of the next LOOK seconds is ever out of view, while each leap fits the view', () => {
    for (const span of [15, 17, 20]) expect(upcomingOut(song, span), String(span)).toBe(0);
  });
  it('a leap too wide for the view: the nearer notes first, then the far ones a second before they are sung', () => {
    const leap = line([[1, 2, 50], [4, 2, 70]], 8);
    const v = songView(leap, HOP, 15);
    expect(v.mid(2.9)).toBeLessThan(50 + 15 / 2 - EDGE + 0.01);
    /* the glide starts once the near one has been sung, and is done well before the far one */
    expect(v.moves[0].a).toBeGreaterThanOrEqual(2.95);
    expect(v.mid(3.65)).toBeGreaterThan(70 - 15 / 2 + EDGE - 0.01);
  });
  it('a brief slip an octave off is not followed', () => {
    const m = line([[1, 6, 60]], 8);
    m[60] = 72;
    m[61] = 72;
    expect(songView(m, HOP, 15).moves.length).toBe(0);
  });
  it('no notes at all: no moves', () => {
    expect(songView(new Float32Array(100).fill(NaN), HOP, 15).moves).toEqual([]);
  });
});
