/* Practise a line (27 Nov): a song's lines, worked out from the singer's
   line as the app read it (core/practise). Reads the lines saved by
   tests/lab-songmap.mjs (LINES_OUT=dir), real songs kept outside the repo:
     LINES_IN=dir node tests/lab-lines.mjs
   Prints, for each song: the silences between notes, how many lines there
   are and how long each is, and the first few as they are played. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanLine } from '../src/core/notemap.ts';
import { songLines, sungLines } from '../src/core/practise.ts';

const DIR = process.env.LINES_IN || '';
const files = DIR ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
if (!files.length) {
  console.log('FAIL setup: LINES_IN names a folder of lines saved by tests/lab-songmap.mjs (LINES_OUT)');
  process.exit(1);
}
const BINS = [0.2, 0.3, 0.4, 0.45, 0.5, 0.6, 0.8, 1.2, 2, Infinity];
for (const f of files) {
  const l = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const m = Float32Array.from(l.m, (x) => (x == null ? NaN : x));
  const c = cleanLine(m);
  const counts = BINS.map(() => 0);
  let last = -1;
  for (let k = 0; k < c.length; k++) {
    if (!Number.isFinite(c[k])) continue;
    if (last >= 0 && k - last > 1) counts[BINS.findIndex((b) => (k - last) * l.hop < b)]++;
    last = k;
  }
  const lines = sungLines(m, l.hop);
  const lens = lines.map((x) => x.end - x.start).sort((a, b) => a - b);
  const played = songLines(m, l.hop, m.length * l.hop);
  console.log(`${f}: silences ${BINS.map((b, i) => `<${b}s ${counts[i]}`).join(', ')}`);
  console.log(`  ${lines.length} lines, first note to last ${lens[0].toFixed(1)} to ${lens[lens.length - 1].toFixed(1)} s, middle ${lens[lens.length >> 1].toFixed(1)} s; ` +
    `${lens.filter((x) => x >= 2 && x <= 8).length} of them 2 to 8 s`);
  console.log(`  played: ${played.slice(0, 8).map((x) => `${x.start.toFixed(2)}-${x.end.toFixed(2)}`).join(', ')} ...`);
}
