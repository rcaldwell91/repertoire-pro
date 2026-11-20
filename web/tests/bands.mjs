/* The band that counts at each level (Robert, 21 Nov: "the Beginner and
   Advanced bands come from real singing, not picked numbers"). Every note
   held 0.3 s or more in real sung voices (RP_VOICES, recordings kept
   outside the repo), read with the test's own pitch reader every 10 ms:
   how far each reading sits from its note. Then, for each band, the share
   of notes that would count (at least HIT_SHARE of their readings within
   the band), sung right, and sung a half step off (the same real notes,
   scored against the note next door). Prints; doesn't pass or fail. */
import { pcm, pitchTrack } from './voice.mjs';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VOICES = (process.env.RP_VOICES || '').split(',').filter(Boolean);
const HIT_SHARE = +(process.env.SHARE || 0.5), MIN_FRAMES = +(process.env.MIN_FRAMES || 30), SMOOTH = 7;
const median = (v) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
const all = [];
for (const file of VOICES) {
  const m = pitchTrack(pcm(FFMPEG, file));
  /* the recording's own tuning: where its readings sit between half steps */
  let sx = 0, sy = 0;
  for (const v of m) if (Number.isFinite(v)) { sx += Math.cos(2 * Math.PI * v); sy += Math.sin(2 * Math.PI * v); }
  const tune = Math.atan2(sy, sx) / (2 * Math.PI);
  const r = m.map((v) => v - tune);
  /* a held note: where the smoothed line stays on one half step 0.3 s or more */
  const sm = r.map((_, i) => { const w = r.slice(Math.max(0, i - SMOOTH), i + SMOOTH + 1).filter(Number.isFinite); return w.length > SMOOTH ? median(w) : NaN; });
  let notes = 0;
  for (let i = 0; i < sm.length;) {
    if (!Number.isFinite(sm[i])) { i++; continue; }
    const k = Math.round(sm[i]);
    let j = i;
    while (j + 1 < sm.length && Number.isFinite(sm[j + 1]) && Math.round(sm[j + 1]) === k) j++;
    if (j - i + 1 >= MIN_FRAMES) {
      const dev = r.slice(i, j + 1).filter(Number.isFinite).map((v) => v - k);
      all.push({ file, k, dev, secs: (j - i + 1) / 100 });
      notes++;
    }
    i = j + 1;
  }
  console.log(`${file.split('/').pop()}: tuning ${(tune * 100).toFixed(0)} hundredths, ${notes} held notes`);
}
const absDev = all.flatMap((n) => n.dev.map(Math.abs)).sort((a, b) => a - b);
const pc = (p) => absDev[Math.floor(absDev.length * p)].toFixed(2);
console.log(`${all.length} held notes, ${absDev.length} readings; distance from the note: half within ${pc(0.5)}, three in four ${pc(0.75)}, nine in ten ${pc(0.9)}, 95 in 100 ${pc(0.95)} half steps`);
/* each note's own middle distance, a measure of how steady it is */
const mids = all.map((n) => median(n.dev.map(Math.abs))).sort((a, b) => a - b);
console.log(`each note's typical distance: half of notes ${mids[mids.length >> 1].toFixed(2)}, nine in ten ${mids[Math.floor(mids.length * 0.9)].toFixed(2)}, 95 in 100 ${mids[Math.floor(mids.length * 0.95)].toFixed(2)}`);
const share = (dev, off, b) => dev.filter((d) => Math.abs(d - off) < b).length / dev.length;
console.log(`counted when ${HIT_SHARE * 100}% of a note's readings are within the band`);
console.log('band (half a band either side) | right notes counted | a half step off counted (worse side)');
for (let b = 0.15; b <= 1.001; b += 0.05) {
  const right = all.filter((n) => share(n.dev, 0, b) >= HIT_SHARE).length;
  const off = Math.max(all.filter((n) => share(n.dev, 1, b) >= HIT_SHARE).length, all.filter((n) => share(n.dev, -1, b) >= HIT_SHARE).length);
  console.log(`±${b.toFixed(2)} | ${(100 * right / all.length).toFixed(1)}% | ${(100 * off / all.length).toFixed(1)}%`);
}
