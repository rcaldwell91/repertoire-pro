/* Repertoire Pro — does the note map hear what the singer actually sang?

   Robert, 20 Sep: bubbles missing where he is clearly singing, bubbles where
   he is not, on two voice-only files. Both files are already voice-only, so
   separation is not the cause. The reading is.

   THE ANSWER KEY. A take sent to a coach carries two things about the same
   performance: the audio, and the pitch line the microphone heard live while
   it was being recorded, twenty points a second. The live line is not perfect
   either, but it is independent of the analyser and it knows when a voice was
   sounding. So it can be asked four questions of any note map built from that
   same audio:

     a) seconds where the live line is voiced and the map has no note
     b) seconds where the map has a note and the live line is unvoiced
     c) the median pitch difference, in semitones, where they overlap
     d) how many voiced runs shorter than 0.4s there were, and how many the
        map kept  (sung syllables in real songs are often 0.15 to 0.3s)

   Both target numbers are under 10% of the sung time.

   THIS TEST NEEDS A REAL SINGER. It will not pass on a synthesised tone, and
   it does not carry one: a tone has none of the things that make this hard -
   breath, consonants, a release that decays. The sixteen-note test next door
   measures TIMING and is not evidence about a voice. When this test cannot
   reach a take it says so and fails, because an unmeasured claim is not a
   passing one.

   Robert's voice is not committed to this repo. The take is fetched at run
   time and deleted afterwards. Credentials come from the environment:
     RP_SUPABASE_URL   (defaults to the project's own, which is public)
     RP_SUPABASE_KEY   a key that can read the takes table and bucket
*/
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SB_URL = process.env.RP_SUPABASE_URL || 'https://ovafsbloyrlwrolqtcat.supabase.co';
const SB_KEY = process.env.RP_SUPABASE_KEY || '';
const STUDENT = process.env.RP_STUDENT || 'lyonxdewitt';
const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');

let fails = 0;
function ok(c, w) { console.log((c ? '  ✓ ' : '  ✗ ') + w); if (!c) fails++; }
function loud(lines) {
  const w = Math.max.apply(null, lines.map(l => l.length)) + 4;
  console.log('\n' + '='.repeat(w));
  lines.forEach(l => console.log('  ' + l));
  console.log('='.repeat(w) + '\n');
}

async function sb(pathAndQuery) {
  const r = await fetch(SB_URL + pathAndQuery, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
  });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r;
}

/* ---- the comparison ------------------------------------------------- */
const STEP = 0.05;           /* the grid both lines are laid on, in seconds */
const SHORT = 0.4;           /* what the mapper's pass 2 calls short         */

function liveVoiced(notes, dur) {
  /* the live line is {t, m} twenty a second; m is null when unvoiced */
  const n = Math.ceil(dur / STEP), v = new Uint8Array(n), pitch = new Float32Array(n);
  notes.forEach(p => {
    if (!p || p.m == null) return;
    const k = Math.round(p.t / STEP);
    if (k >= 0 && k < n) { v[k] = 1; pitch[k] = p.m; }
  });
  /* the live sampler runs at 20 Hz and the grid is 20 Hz, but a dropped
     frame should not read as silence: one empty slot between two voiced
     ones is filled */
  for (let i = 1; i < n - 1; i++) if (!v[i] && v[i - 1] && v[i + 1]) { v[i] = 1; pitch[i] = pitch[i - 1]; }
  return { v: v, pitch: pitch, n: n };
}
function mapVoiced(notes, n) {
  const v = new Uint8Array(n), pitch = new Float32Array(n);
  notes.forEach(x => {
    if (!x || x.m == null) return;
    const a = Math.round(x.t / STEP), b = Math.round((x.t + (x.d || 0)) / STEP);
    for (let k = a; k <= b && k < n; k++) if (k >= 0) { v[k] = 1; pitch[k] = x.m; }
  });
  return { v: v, pitch: pitch };
}
function runsOf(v, n) {
  const runs = [];
  let i = 0;
  while (i < n) {
    if (!v[i]) { i++; continue; }
    let j = i;
    while (j + 1 < n && v[j + 1]) j++;
    runs.push({ a: i, b: j, secs: (j - i + 1) * STEP });
    i = j + 1;
  }
  return runs;
}
function median(a) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
}
function compare(live, map, dur) {
  const L = liveVoiced(live, dur);
  const M = mapVoiced(map, L.n);
  let missed = 0, phantom = 0, sung = 0;
  const diffs = [];
  for (let i = 0; i < L.n; i++) {
    if (L.v[i]) sung += STEP;
    if (L.v[i] && !M.v[i]) missed += STEP;
    if (!L.v[i] && M.v[i]) phantom += STEP;
    if (L.v[i] && M.v[i]) diffs.push(Math.abs(L.pitch[i] - M.pitch[i]));
  }
  const shortRuns = runsOf(L.v, L.n).filter(r => r.secs < SHORT);
  const kept = shortRuns.filter(r => {
    for (let k = r.a; k <= r.b; k++) if (M.v[k]) return true;
    return false;
  });
  return {
    sung: sung, missed: missed, phantom: phantom,
    missedPct: sung ? 100 * missed / sung : 0,
    phantomPct: sung ? 100 * phantom / sung : 0,
    medianSemitones: median(diffs),
    shortRuns: shortRuns.length, shortKept: kept.length
  };
}
function line(label, r) {
  console.log('    ' + label.padEnd(13) +
    'missed ' + r.missed.toFixed(1) + 's (' + r.missedPct.toFixed(1) + '%)   ' +
    'phantom ' + r.phantom.toFixed(1) + 's (' + r.phantomPct.toFixed(1) + '%)   ' +
    'median ' + (isNaN(r.medianSemitones) ? '–' : r.medianSemitones.toFixed(2)) + ' semitones   ' +
    'short runs ' + r.shortKept + '/' + r.shortRuns + ' kept');
}

(async () => {
  if (!SB_KEY) {
    loud(['NO EVIDENCE: this test cannot reach a sent take.',
          'RP_SUPABASE_KEY is not set, so there is no way to read the takes bucket.',
          'The note map has NOT been measured against a real singer.',
          'Set RP_SUPABASE_KEY to a key that can read public.takes and storage.']);
    process.exit(1);
  }

  let take = null;
  try {
    const prof = await (await sb('/rest/v1/profiles?display_name=eq.' + encodeURIComponent(STUDENT) + '&select=id')).json();
    if (!prof.length) throw new Error('no profile named ' + STUDENT);
    const rows = await (await sb('/rest/v1/takes?student_id=eq.' + prof[0].id +
      '&select=id,created_at,audio_path,notes&order=created_at.desc&limit=20')).json();
    take = rows.find(t => t.audio_path && t.notes && t.notes.length);
  } catch (e) {
    loud(['NO EVIDENCE: could not read the takes.', String(e.message || e),
          'The note map has NOT been measured against a real singer.']);
    process.exit(1);
  }
  if (!take) {
    loud(['NO EVIDENCE: ' + STUDENT + ' has no sent take that carries both',
          'audio and a live pitch line, so there is nothing to measure against.',
          'The note map has NOT been measured against a real singer.',
          'Record a take on the Pitch Tracker and send it to a coach.']);
    process.exit(1);
  }

  const tmp = path.join(os.tmpdir(), 'rp-take-' + process.pid);
  let audio;
  try {
    const r = await sb('/storage/v1/object/takes/' + take.audio_path);
    audio = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(tmp, audio);          /* deleted below; never committed */
  } catch (e) {
    loud(['NO EVIDENCE: the take row exists but its audio could not be fetched.',
          String(e.message || e)]);
    process.exit(1);
  }
  console.log('take ' + take.id + ' — ' + (audio.length / 1024).toFixed(0) + ' KB, ' +
              take.notes.length + ' live pitch points');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const p = await ctx.newPage();
  if (fs.existsSync(LOCAL)) {
    const body = fs.readFileSync(LOCAL, 'utf8');
    await p.route('**/*', r => r.request().url() === URL_ ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
  }
  await p.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(4000);

  const out = await p.evaluate(async (b64) => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const blob = new Blob([u]);
    ensureCtx();
    const dec = await ctx.decodeAudioData(await blob.arrayBuffer());
    const res = {};
    for (const clean of [true, false]) {
      const song = { id: 'sg' + Date.now() + clean, title: 't', kind: 'song',
                     cleanVox: clean, blob: blob, at: Date.now() };
      try { await buildNoteMap(song); res[clean] = song.notes || []; }
      catch (e) { res[clean] = { err: String(e && e.message || e) }; }
    }
    return { dur: dec.duration, clean: res[true], dirty: res[false] };
  }, audio.toString('base64'));

  try { fs.unlinkSync(tmp); } catch (e) {}
  await browser.close();

  console.log('audio ' + out.dur.toFixed(1) + 's');
  const results = {};
  for (const [label, notes] of [['clean=true', out.clean], ['clean=false', out.dirty]]) {
    if (!Array.isArray(notes)) { ok(false, label + ': ' + notes.err); continue; }
    const r = compare(take.notes, notes, out.dur);
    results[label] = r;
    line(label, r);
  }
  for (const label of Object.keys(results)) {
    const r = results[label];
    ok(r.missedPct < 10, label + ': missed singing under 10% of the sung time (' + r.missedPct.toFixed(1) + '%)');
    ok(r.phantomPct < 10, label + ': notes where he is not singing under 10% (' + r.phantomPct.toFixed(1) + '%)');
  }
  if (!Object.keys(results).length) ok(false, 'neither setting produced a note map');
  console.log(fails ? '\nFAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
