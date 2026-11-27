import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allCopy, copy } from './copy';
import { beforeOf, fit, GAP, lineAt, LEAD, longer, MAX_LINE, MIN_LINE, nextLine, passScores, prevLine, songLines, splitPasses,
  stretchOf, sungLines, SOUNDS, STEPS, PASSES, TAIL } from './practise';
import { YourLine } from '../shell/your-line';
import { LINE_ROUTE, SPEAK_ROUTE, isRoute, lineRoute, speakRoute } from '../shell/router';

/* Robert's song features (approved 16 Nov, built 27 Nov): Practise a line,
   Speak it then sing it, and the Before take. */
const HOP = 0.05;
/** a singer's line: notes (MIDI) sung over [from, to) seconds, nothing elsewhere */
function sung(seconds: number, parts: Array<[number, number, number]>): Float32Array {
  const m = new Float32Array(Math.round(seconds / HOP)).fill(NaN);
  for (const [a, b, note] of parts) for (let k = Math.round(a / HOP); k < Math.round(b / HOP); k++) m[k] = note;
  return m;
}

describe('a song\'s lines, from the singer\'s line', () => {
  it('a silence of GAP or more ends a line; a shorter one does not', () => {
    const m = sung(20, [[1, 3, 60], [3 + GAP - 0.1, 6, 62], [6 + GAP + 0.1, 9, 64]]);
    const l = sungLines(m, HOP);
    expect(l.length).toBe(2);
    expect(l[0].start).toBeCloseTo(1, 5);
    expect(l[0].end).toBeCloseTo(5.95, 5);
    expect(l[1].start).toBeCloseTo(6 + GAP + 0.1, 5);
  });

  it('a line too short to practise joins the neighbour it is nearest', () => {
    const m = sung(20, [[1, 4, 60], [5, 5.5, 62], [8, 11, 64]]);
    const l = sungLines(m, HOP);
    expect(l.map((x) => [x.start, +x.end.toFixed(2)])).toEqual([[1, 5.45], [8, 10.95]]);
    expect(l.every((x) => x.end - x.start >= MIN_LINE)).toBe(true);
  });

  it('a line too long is cut at its longest breath, both sides long enough', () => {
    const m = sung(30, [[1, 5, 60], [5.15, 9, 62], [9.35, 15, 64]]);
    const l = sungLines(m, HOP);
    expect(l.length).toBe(2);
    expect(l[0].end).toBeCloseTo(8.95, 5);
    expect(l[1].start).toBeCloseTo(9.35, 5);
    expect(l.every((x) => x.end - x.start <= MAX_LINE)).toBe(true);
  });

  it('a brief slip, an octave or more from the notes around it, is not a line of its own', () => {
    const m = sung(20, [[1, 4, 60], [10, 13, 62]]);
    m[Math.round(7 / HOP)] = 80;
    expect(sungLines(m, HOP).length).toBe(2);
  });

  it('played from a moment before the first note to a moment after the last, never into the next line', () => {
    const m = sung(12, [[0.2, 3, 60], [3.6, 6, 62], [9, 11.9, 64]]);
    const l = songLines(m, HOP, 12);
    expect(l[0].start).toBe(0);
    /* its last note 2.95 + TAIL, so 0.1 clear of the next line's first (3.6) */
    expect(l[0].end).toBeCloseTo(Math.min(2.95 + TAIL, 3.5), 5);
    expect(l[1].start).toBeCloseTo(3.6 - LEAD + 0, 1);
    expect(l[1].start).toBeGreaterThan(2.95);
    expect(l[1].end).toBeCloseTo(5.95 + TAIL, 5);
    expect(l[2].end).toBe(12);
    /* never into the notes of the line before or after */
    const raw = sungLines(m, HOP);
    for (let i = 0; i < l.length; i++) {
      if (i > 0) expect(l[i].start).toBeGreaterThan(raw[i - 1].end);
      if (i < l.length - 1) expect(l[i].end).toBeLessThan(raw[i + 1].start);
    }
  });

  it('a line cut at a short breath stops before the next one starts, and the next starts after it ends', () => {
    /* a long line cut at its 0.35 s breath: closer than LEAD + TAIL, so each is held back from the other */
    const m = sung(16, [[1, 5, 60], [5.15, 9, 62], [9.35, 15, 64]]);
    const raw = sungLines(m, HOP);
    const l = songLines(m, HOP, 16);
    expect(raw.length).toBe(2);
    expect(l[0].end).toBeLessThan(raw[1].start);
    expect(l[1].start).toBeGreaterThan(raw[0].end);
    expect(l[0].end).toBeCloseTo(raw[1].start - 0.1, 5);
    expect(l[1].start).toBeCloseTo(raw[0].end + 0.1, 5);
  });

  it('no singing, no lines', () => {
    expect(sungLines(new Float32Array(100).fill(NaN), HOP)).toEqual([]);
  });
});

describe('picking the line', () => {
  const lines = [{ start: 1, end: 4 }, { start: 5, end: 8 }, { start: 9, end: 12 }];
  it('the line at a point on the timeline: the one it is in, else the next, else the last', () => {
    expect(lineAt(lines, 0)).toBe(0);
    expect(lineAt(lines, 4.5)).toBe(1);
    expect(lineAt(lines, 11)).toBe(2);
    expect(lineAt(lines, 30)).toBe(2);
    expect(lineAt([], 3)).toBe(-1);
  });
  it('next, previous and a longer stretch', () => {
    expect(nextLine(lines, { from: 0, to: 0 })).toEqual({ from: 1, to: 1 });
    expect(nextLine(lines, { from: 2, to: 2 })).toEqual({ from: 2, to: 2 });
    expect(nextLine(lines, { from: 0, to: 1 })).toEqual({ from: 2, to: 2 });
    expect(prevLine({ from: 0, to: 0 })).toEqual({ from: 0, to: 0 });
    expect(prevLine({ from: 2, to: 2 })).toEqual({ from: 1, to: 1 });
    expect(longer(lines, { from: 0, to: 0 })).toEqual({ from: 0, to: 1 });
    expect(longer(lines, { from: 1, to: 2 })).toEqual({ from: 1, to: 2 });
    expect(stretchOf(lines, { from: 0, to: 1 })).toEqual({ start: 1, end: 8 });
    expect(stretchOf(lines, { from: 1, to: 0 })).toBeNull();
  });
  it('a choice kept from an earlier visit fits the lines as they are now', () => {
    expect(fit(lines, null)).toEqual({ from: 0, to: 0 });
    expect(fit(lines, { from: 1, to: 2 })).toEqual({ from: 1, to: 2 });
    expect(fit(lines, { from: 2, to: 5 })).toEqual({ from: 0, to: 0 });
    expect(fit([], { from: 0, to: 0 })).toBeNull();
  });
});

describe('Practise a line: three steps, each sung twice, each pass scored', () => {
  it('the steps and sounds, as Robert gave them', () => {
    expect(STEPS).toEqual(['notes', 'sound', 'words']);
    expect(PASSES).toBe(2);
    /* Train's own sounds, as Train has them: never changed */
    expect(SOUNDS).toEqual(['liptrill', 'mum', 'straw']);
    expect(copy.ex.liptrill.name).toBe('Lip trills');
    expect(copy.ex.mum.name).toBe('Mum');
    expect(copy.ex.straw.plain).toBe('Straw singing');
    expect(copy.line.notesHow).toBe('Sing it on a light "da". No words.');
  });

  it('two passes: the round kept when the line came round again is the first', () => {
    const one = { t: [1, 1.1, 1.2], m: [60, 60, 60] }, two = { t: [1, 1.1], m: [62, 62] };
    expect(splitPasses([one], two, 3, 0, 2)).toEqual([one, two]);
  });
  it('a first pass with nothing sung: what came after the second pass began is the second', () => {
    const now = { t: [1, 1.1, 1.2], m: [60, 61, 62] };
    expect(splitPasses([], now, 0, 0, 2)).toEqual([{ t: [], m: [] }, now]);
  });
  it('a second pass with nothing sung: the first is everything, the second empty', () => {
    const now = { t: [1, 1.1], m: [60, 60] };
    expect(splitPasses([], now, 2, 0, 2)).toEqual([now, { t: [], m: [] }]);
  });
  it('stopped in the first pass: one pass', () => {
    const now = { t: [1, 1.1], m: [60, 60] };
    expect(splitPasses([], now, null, 0, 1)).toEqual([now]);
  });

  it('each pass scored as Learn a song scores a take, only inside the line', () => {
    const singer = sung(10, [[1, 6, 60]]);
    const t = Array.from({ length: 80 }, (_, i) => 1 + i * 0.05);
    const right = { t, m: t.map(() => 60.2) };
    const off = { t, m: t.map(() => 61) };
    const outside = { t: t.map((x) => x + 5), m: t.map(() => 60) };
    expect(passScores([right, off, { t: [], m: [] }], { start: 1, end: 5 }, singer, HOP, false)).toEqual([100, 0, null]);
    /* notes sung outside the line don't count, even where the song has notes */
    expect(passScores([outside], { start: 1, end: 5 }, singer, HOP, false)).toEqual([null]);
    const long = sung(14, [[1, 12, 60]]);
    const offAfter = { t: [...t, ...t.map((x) => x + 5)], m: [...t.map(() => 60.2), ...t.map(() => 61)] };
    expect(passScores([offAfter], { start: 1, end: 5 }, long, HOP, false)).toEqual([100]);
    /* Any octave, as on Learn a song */
    expect(passScores([{ t, m: t.map(() => 72) }], { start: 1, end: 5 }, singer, HOP, true)).toEqual([100]);
  });

  it('your line keeps each time round a repeated stretch, the last few, and clears them', () => {
    const y = new YourLine();
    const add = (i: number, t: number, m: number) => y.add({ i, at: 0, m, r: m } as never, t);
    for (let i = 0; i < 20; i++) add(i, 1 + i * 0.1, 60);
    for (let i = 20; i < 30; i++) add(i, 1 + (i - 20) * 0.1, 62);
    expect(y.rounds.length).toBe(1);
    expect(y.rounds[0].t.length).toBe(20);
    expect(y.rounds[0].m.every((v) => v === 60)).toBe(true);
    expect(y.t.length).toBe(10);
    expect(y.m.every((v) => v === 62)).toBe(true);
    for (let r = 0; r < 6; r++) for (let i = 0; i < 10; i++) add(100 + r * 10 + i, 1 + i * 0.1, 50 + r);
    expect(y.rounds.length).toBe(4);
    y.clear();
    expect(y.rounds.length).toBe(0);
  });
});

describe('the Before', () => {
  const takes = [{ id: 'c', created: 30 }, { id: 'b', created: 20 }, { id: 'a', created: 10 }];
  it('the first take saved, unless another was chosen and is still there', () => {
    expect(beforeOf(takes, null)?.id).toBe('a');
    expect(beforeOf(takes, 'c')?.id).toBe('c');
    expect(beforeOf(takes, 'gone')?.id).toBe('a');
    expect(beforeOf([], 'a')).toBeNull();
  });

  it('the database script: a table of its own, the singer\'s alone; nothing else changed', () => {
    const sql = readFileSync('scripts/db/2026-11-27-song-befores.sql', 'utf8');
    const code = sql.split('\n').filter((l) => !l.startsWith('--')).join('\n').toLowerCase();
    expect(code).toMatch(/create table if not exists public\.song_befores/);
    expect(code).toMatch(/enable row level security/);
    expect(code).toMatch(/revoke all on public\.song_befores from anon/);
    for (const verb of ['select', 'insert', 'update', 'delete']) expect(code).toMatch(new RegExp(`for ${verb} to authenticated`));
    /* every rule: the singer's own rows only */
    const rules = code.match(/create policy[^;]+;/g) ?? [];
    expect(rules.length).toBe(4);
    for (const r of rules) {
      expect(r).toMatch(/student_id = auth\.uid\(\)/);
      expect(r).not.toMatch(/teaches|coach|\bor\b/);
    }
    /* no other table touched */
    expect(code.match(/public\.(\w+)/g)?.every((x) => x === 'public.song_befores')).toBe(true);
    for (const w of ['drop', 'alter table public.takes', 'alter policy']) expect(code).not.toContain(w);
  });
});

describe('the pages, and their words', () => {
  it('each has its own address, reached from Learn a song', () => {
    expect(lineRoute('abc-1')).toBe('/sing/learn/song/abc-1/line');
    expect(speakRoute('abc-1')).toBe('/sing/learn/song/abc-1/speak');
    expect(isRoute(lineRoute('abc-1')) && isRoute(speakRoute('abc-1'))).toBe(true);
    expect(LINE_ROUTE.test('/sing/learn/song/x/line') && SPEAK_ROUTE.test('/sing/learn/song/x/speak')).toBe(true);
    const song = readFileSync('src/screens/SongScreen.tsx', 'utf8');
    expect(song).toMatch(/navigate\(lineRoute\(props\.id\)/);
    expect(song).toMatch(/navigate\(speakRoute\(props\.id\)/);
  });

  it('Speak it, then sing it scores nothing and never says which is better', () => {
    const words = allCopy(copy.speak, 'copy.speak').map((l) => l.text.toLowerCase());
    for (const w of ['better', 'worse', 'best', '%', 'right notes', 'score:', 'well done', 'great']) {
      expect(words.filter((x) => x.includes(w)), w).toEqual([]);
    }
    const page = readFileSync('src/screens/SpeakSing.tsx', 'utf8');
    for (const w of ['rightPct', 'passScores', 'isRight', 'NoteMap']) expect(page).not.toContain(w);
  });

  it('nothing on these pages is sourced: nothing fetched from anywhere', () => {
    for (const f of ['src/screens/PractiseLine.tsx', 'src/screens/SpeakSing.tsx', 'src/core/practise.ts', 'src/data/speak.ts', 'src/data/before.ts']) {
      const code = readFileSync(f, 'utf8');
      expect(code, f).not.toMatch(/fetch\(|XMLHttpRequest|https?:\/\//i);
    }
  });
});
