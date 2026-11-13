/* When the voice arrives on each note, from saved takes (Robert, 13 Nov;
   core/timing.ts). Read only: it reads take rows that have already been
   fetched to a file, and prints the whole spread for each exercise and
   speed, then every note, so a pause can be chosen from real singing.

     node scripts/note-timing.mjs TAKES.json [--audio DIR]

   TAKES.json: an array of takes rows as the takes table holds them (the
   `notes` column carries the line, the piano notes, the exercise and the
   delays the phone reported). With --audio, each take's recording
   (DIR/<file name of audio_path>) is read again by the checks' own pitch
   reader (tests/voice.mjs, not the app's), placed at the take's songAt, as
   a second reading that doesn't depend on the app's.
   Only ever run on takes their singer has said may be read. */
import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { arrivals, spread } from '../src/core/timing.ts';
import { pcm, pitchTrack } from '../tests/voice.mjs';

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.log('usage: node scripts/note-timing.mjs TAKES.json [--audio DIR]');
  process.exit(1);
}
const audioDir = rest[0] === '--audio' ? rest[1] : null;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const rows = JSON.parse(readFileSync(file, 'utf8'));
const ms = (x) => (x == null ? '-' : Math.round(x * 1000) + ' ms');

function show(label, all) {
  const s = spread(all);
  console.log(`\n${label}: ${s.notes} notes, ${s.reached} reached (${s.notes - s.reached} never on the note)`);
  console.log(`  arrival after the piano: min ${ms(s.at.min)}, 10% ${ms(s.at.p10)}, 25% ${ms(s.at.p25)}, median ${ms(s.at.median)}, ` +
    `75% ${ms(s.at.p75)}, 90% ${ms(s.at.p90)}, max ${ms(s.at.max)}`);
  console.log('  ' + s.bins.map((b) => `${Math.round(b.from * 1000)}:${b.count}`).join('  '));
}

const groups = new Map();
for (const r of rows) {
  const d = r.notes || {};
  if (!d.piano || !d.t) continue;
  const piano = d.piano;
  const beat = piano.length > 1 ? Math.min(...piano.map((p) => p[2])) : 0;
  const key = `${d.exercise ?? 'song'} (shortest note ${beat.toFixed(2)} s)`;
  const app = arrivals(piano, d.t.map((x) => x ?? NaN), d.m.map((x) => x ?? NaN), !!d.anyOctave);
  let own = null;
  if (audioDir && r.audio_path) {
    const f = join(audioDir, basename(r.audio_path));
    if (existsSync(f)) {
      const x = pcm(FFMPEG, f);
      const m = pitchTrack(x);
      const t = m.map((_, i) => d.songAt + i / 100 + 2048 / 2 / 48000);
      own = arrivals(piano, t, m, !!d.anyOctave);
    }
  }
  const g = groups.get(key) ?? { app: [], own: [], takes: 0, delays: [] };
  g.app.push(...app);
  if (own) g.own.push(...own);
  g.takes++;
  if (d.delays) g.delays.push(d.delays);
  groups.set(key, g);
}
for (const [key, g] of groups) {
  show(`${key}, ${g.takes} take(s), by the app's line`, g.app);
  if (g.own.length) show(`${key}, read again from the recording`, g.own);
  if (g.delays.length) console.log('  delays the phone reported: ' + g.delays.map((x) => `out ${ms(x.out)}, mic ${ms(x.mic)}`).join('; '));
  console.log('  every note (m, piano at, arrival): ' + g.app.map((a) => `${a.m}@${a.t.toFixed(2)}:${ms(a.after)}`).join(' '));
}
