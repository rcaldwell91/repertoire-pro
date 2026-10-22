/* Prove the conductor's tests can fail (RULEBOOK 4, Tests: "Prove a new test
   fails on the broken case before trusting it").

   Each entry breaks exactly one rule in the source, runs the unit tests, and
   puts the source back. A rule whose break no test notices is reported, and
   the script fails. */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const C = 'src/audio/conductor/conductor.ts';
const W = 'src/audio/engine-web/web-engine.ts';
const M = 'src/audio/mic-modes.ts';

export const MUTATIONS = [
  { rule: 'a copied source doc is changed (RULEBOOK 2.8)', file: 'docs/android-samsung-headset.md',
    from: 'Samsung', to: 'Samsong', all: true },
  { rule: 'a copied source doc is summarised (RULEBOOK 2.8)', file: 'docs/android-audio-history.md',
    from: ', then retries once with a 600 ms breath', to: '' },
  { rule: 'the report for Robert has no taps (RULEBOOK 2.7)', file: '../REPORTS/latest.md',
    from: '## Your taps\n', to: '## Taps\n' },
  { rule: 'the report for Robert says nothing about the real phone (RULEBOOK 2.7)', file: '../REPORTS/latest.md',
    from: '## Not tried on a real phone\n', to: '' },
  { rule: 'the report for Robert has no commit (RULEBOOK 2.7)', file: '../REPORTS/latest.md',
    from: ', commit ', to: ', ' },
  { rule: 'the latest report is not in the log (RULEBOOK 2.7)', file: '../REPORTS/log.md',
    from: '## What was measured\n', to: '## Measured\n', all: true },
  { rule: 'starts without a token', file: C,
    from: 'if (!this.spend(token)) return false;', to: 'this.spend(token);' },
  { rule: 'a press nobody made counts as a tap', file: C,
    from: 'if (!ev || ev.isTrusted !== true) return null;', to: 'if (!ev) return null;' },
  { rule: 'a token works twice', file: C,
    from: 'this.tokens.delete(token);', to: ';' },
  { rule: 'an old tap still starts it', file: C,
    from: 'return this.env.wallMs() - at <= TOKEN_LIFE_MS;', to: 'return true;' },
  { rule: 'starts while hidden', file: C,
    from: 'if (this.env.hidden()) return false;', to: ';' },
  { rule: 'two sources at once', file: C,
    from: "if (this.active()) this.halt('stopped', null);                      /* one source at a time */", to: ';' },
  { rule: 'a repeat press starts it again', file: C,
    from: 'if (this.active() && this.snap.owner === plan.owner) return false;', to: ';' },
  { rule: 'leaving keeps the sound and the mic', file: C,
    from: "if (this.active()) this.halt('stopped', why);", to: "if (this.active()) this.set({ state: 'stopped', why });" },
  { rule: 'hiding the app does not stop it', file: C,
    from: "env.onHidden(() => this.leave('hidden'));", to: ';' },
  { rule: 'an interruption does not stop it', file: C,
    from: "      if (this.snap.state !== 'armed') this.leave('interrupted');", to: ';' },
  { rule: 'a late sample still plays', file: C,
    from: "        }\n        if (gen !== this.gen) return;\n      }\n      /* each song's level",
    to: "        }\n      }\n      /* each song's level" },
  { rule: 'a late song part still plays', file: C,
    from: "if (!samples.has(u)) samples.set(u, await this.engine.load(u));\n            if (gen !== this.gen) return;",
    to: "if (!samples.has(u)) samples.set(u, await this.engine.load(u));" },
  { rule: 'a song volume reaches the wrong part', file: C,
    from: 'song?.ensemble.setGain(part, part < song.parts', to: 'song?.ensemble.setGain(0, part < song.parts' },
  { rule: 'the song position ignores the clock', file: C,
    from: 'const p = song.from + Math.max(0, d);', to: 'const p = song.from;' },
  { rule: 'the speaker\'s delay is not taken off the song', file: C,
    from: 'const d = at - this.engine.outputLatency() - song.ensemble.startedAt;', to: 'const d = at - song.ensemble.startedAt;' },
  { rule: 'a refused mic stops the song', file: C,
    from: "    this.set({ mic: r.ok ? (r.held ? 'held' : 'open') : r.why });\n    return true;",
    to: "    this.set({ mic: r.ok ? (r.held ? 'held' : 'open') : r.why });\n    if (!r.ok) this.halt('stopped', null);\n    return r.ok;" },
  { rule: 'the mic is handed on when nobody is listening', file: C,
    from: "      if (this.snap.mic !== 'open' || this.snap.state !== 'running') return;\n", to: '' },
  { rule: '"Hear yourself" sounds outside a song', file: C,
    from: '    if (this.monitoring) this.engine.monitor(this.monitorGain);',
    to: '    this.engine.monitor(this.monitorGain);' },
  { rule: '"Hear yourself" switched on during the 3-2-1 is lost', file: C,
    from: "          if (st.listen) {\n", to: "          if (st.listen) {\n            if (st.monitor != null) this.monitorGain = st.monitor;\n" },
  { rule: '"Hear yourself" changed while another app holds the mic is lost', file: C,
    from: '    if (this.monitoring) this.engine.monitor(this.monitorGain);', to: "    if (this.monitoring && this.snap.mic === 'open') this.engine.monitor(this.monitorGain);" },
  { rule: 'a song with no level kept is not measured', file: C,
    from: '        if (level == null) {', to: '        if (level == null && false) {' },
  { rule: 'a measured level is not handed back to keep', file: C,
    from: '          st.onLevel?.(level);', to: '' },
  { rule: 'a kept level is measured again', file: C,
    from: '        let level = st.level;', to: '        let level: number | undefined = undefined;' },
  { rule: 'the music is lifted differently from the voice', file: C,
    from: 'gains: st.gains.map((g, k) => (k < parts ? g * lv : g))', to: 'gains: st.gains.map((g, k) => (k === 0 ? g * lv : g))' },
  { rule: 'a take over the song is lifted with it', file: C,
    from: 'const parts = Math.min(st.songParts ?? st.urls.length, st.urls.length);', to: 'const parts = st.urls.length;', all: true },
  { rule: 'a volume changed while it plays loses the level', file: C,
    from: 'song?.ensemble.setGain(part, part < song.parts ? gain * song.level : gain);', to: 'song?.ensemble.setGain(part, gain);' },
  { rule: 'a song is put somewhere other than -1 dBFS', file: 'src/core/song.ts',
    from: 'export const SONG_PEAK = 10 ** (-1 / 20);', to: 'export const SONG_PEAK = 10 ** (-3 / 20);' },
  { rule: 'a near-silent song is lifted without end', file: 'src/core/song.ts',
    from: '  return Math.min(MAX_LIFT, Math.max(1, SONG_PEAK / peak));', to: '  return Math.max(1, SONG_PEAK / peak);' },
  { rule: 'a song at full volume is turned down', file: 'src/core/song.ts',
    from: '  return Math.min(MAX_LIFT, Math.max(1, SONG_PEAK / peak));', to: '  return Math.min(MAX_LIFT, SONG_PEAK / peak);' },
  { rule: 'Hear yourself at 100 is not six times the mic', file: 'src/core/song.ts',
    from: 'export const MONITOR_MAX = 6;', to: 'export const MONITOR_MAX = 3;' },
  { rule: 'the loudness stage is not the old app\'s v9.8', file: W,
    from: '  raise: 1.4,', to: '  raise: 1.2,' },
  /* the ceiling at the plain rate: rendered offline, Ride's chorus then
     reaches -0.7 dB between the samples (-1.3 dB at twice the rate); in the
     browser check the difference is too small to see, so this guards it */
  { rule: 'the ceiling runs at the plain rate', file: W,
    from: "oversample: '2x' as OverSampleType", to: "oversample: 'none' as OverSampleType" },
  { rule: 'the ceiling reaches -1 dBFS', file: W,
    from: 'export const CEILING = { knee: 0.66, top: 0.8,', to: 'export const CEILING = { knee: 0.66, top: 0.95,' },
  { rule: 'the way out\'s delay is not counted when a sound is heard', file: W,
    from: '    return heardDelay(ctx.outputLatency, ctx.baseLatency) + STAGE_DELAY;', to: '    return heardDelay(ctx.outputLatency, ctx.baseLatency);' },
  { rule: 'Hear yourself starts somewhere other than 70', file: 'src/core/song.ts',
    from: 'export const MONITOR_DEFAULT = 70;', to: 'export const MONITOR_DEFAULT = 80;' },
  { rule: 'a song without the mic opens it anyway', file: C,
    from: "      if (plan.steps.some((st) => st.kind === 'listen' || (st.kind === 'song' && st.listen))) {", to: '      if (true) {' },
  { rule: 'a repeated part does not wrap', file: C,
    from: 'if (loop && p >= loop.end && loop.end > loop.start)', to: 'if (false)' },
  { rule: 'a song keeps its memory', file: C,
    from: 'urls.forEach((u) => this.engine.forget(u));', to: ';' },
  { rule: 'a late count-in still plays', file: C,
    from: 'await this.env.wait(plan.countIn / beats);\n          if (gen !== this.gen) return;', to: 'await this.env.wait(plan.countIn / beats);' },
  { rule: 'a stopped note carries on to the next step', file: C,
    from: 'await src.ended;\n          if (gen !== this.gen) return;', to: 'await src.ended;' },
  { rule: 'a late mic stays open', file: C,
    from: "if (r.ok && this.snap.mic !== 'open' && this.snap.mic !== 'opening' && this.snap.mic !== 'held') this.engine.closeMic();", to: ';' },
  { rule: 'finishing keeps hold of everything', file: C,
    from: "if (gen === this.gen) this.halt('finished', null);", to: "if (gen === this.gen) this.set({ state: 'finished' });" },
  { rule: 'a mic mode is remembered without a hand tap', file: C,
    from: '    /* once, raw (or the mode chosen by hand): never another by itself */', to: "    this.store.set('rp.mic.set', '1');" },
  { rule: 'the hand-chosen mic mode is ignored', file: C,
    from: '    const r: MicResult = await this.engine.openMic(MIC_MODES[modeIndex(this.store.get(MODE_KEY))]);', to: '    const r: MicResult = await this.engine.openMic(MIC_MODES[0]);' },
  { rule: 'the old ladder\'s rung is kept', file: C,
    from: '    store.remove(OLD_RUNG_KEY);', to: '' },
  { rule: 'a refused mic blocks the note', file: C,
    from: 'if (!this.spend(token)) return false;', to: "if (!this.spend(token)) return false;\n    if (this.snap.mic === 'refused') return false;" },
  { rule: 'leaving does not end the take', file: C,
    from: '    this.gen++;\n    this.endTake();', to: '    this.gen++;' },
  { rule: 'a take is recorded while a part repeats', file: C,
    from: 'if (st.record && !st.loop) this.recorder = new Recorder();', to: 'if (st.record) this.recorder = new Recorder();' },
  { rule: 'a take keeps what was heard before the song', file: 'src/audio/recorder.ts',
    from: '      if (s == null) return;                 /* heard before the song began */\n      this.start = s;', to: '      this.start = s ?? 0;' },
  { rule: 'a take is placed without the speaker\'s delay', file: C,
    from: 'this.recorder?.push(b, (at) => this.songTime(at));', to: 'this.recorder?.push(b, (at) => this.songTime(at + this.engine.outputLatency()));' },
  { rule: 'the ceiling lets full scale through', file: W,
    from: '  return a <= knee ? u : Math.sign(u) * (knee + (top - knee) * Math.tanh((a - knee) / (top - knee)));', to: '  return a <= knee ? u : u;' },
  { rule: 'the raw mic is only wished for, not required (Android 11)', file: W,
    from: '  const v = (x: boolean) => (set.exact ? { exact: x } : { ideal: x });', to: '  const v = (x: boolean) => ({ ideal: x });' },
  { rule: 'the raw mic does not ask for the lowest latency', file: M,
    from: "autoGainControl: false, exact: true, lowestLatency: true },", to: "autoGainControl: false, exact: true },"},
  { rule: 'a mode chosen by hand cycles wrongly', file: M,
    from: '  return Number.isInteger(n) && n >= 0 && n < MIC_MODES.length ? n : 0;', to: '  return Number.isInteger(n) && n >= 0 && n < MIC_MODES.length - 1 ? n : 0;' },
  /* RULEBOOK 4, Sound, Android */
  { rule: 'the sound wakes before the mic opens (Android 4)', file: C,
    from: '        if (!(await this.openMic(gen))) return;', to: '        void this.openMic(gen);' },
  { rule: 'the sound is woken outside the tap', file: C,
    from: '      const woke = await this.engine.wake(this.rebuild);', to: '      await Promise.resolve();\n      const woke = await this.engine.wake(this.rebuild);' },
  { rule: 'sound the clock did not prove is said to play (Android 7)', file: C,
    from: '      if (!woke.ok) {', to: '      if (woke.ok === "never") {' },
  { rule: 'sound that would not start is not said (Android 8)', file: C,
    from: "        this.set({ sound: woke.why === 'blocked' && !woke.tap ? 'tap' : woke.why });", to: '' },
  { rule: 'a stall is never noticed (Android 5)', file: C,
    from: "      if (this.snap.state !== 'running') return;\n      this.rebuild = true;", to: '      return;\n      this.rebuild = true;' },
  { rule: 'the sound rebuilds by itself after a stall (Android 6)', file: C,
    from: "      this.set({ sound: 'stalled' });\n    });", to: "      this.set({ sound: 'stalled' });\n      void this.engine.wake(true);\n    });" },
  { rule: 'the tap after a stall does not rebuild (Android 5)', file: C,
    from: "      this.rebuild = true;\n      this.halt('stopped', null);\n      this.set({ sound: 'stalled' });", to: "      this.halt('stopped', null);\n      this.set({ sound: 'stalled' });" },
  { rule: 'a healthy start rebuilds every time', file: C,
    from: '      this.rebuild = false;\n', to: '' },
  /* Robert's four decisions, 13 Oct */
  { rule: 'the count-in is one long wait, not 3-2-1', file: C,
    from: '        const beats = Math.max(1, Math.round(plan.countBeats ?? 1));', to: '        const beats = 1;' },
  { rule: 'the count-in ignores the song\'s tempo', file: 'src/core/song.ts',
    from: '? 60 / bpm : 1;', to: '? 1 : 1;' },
  { rule: '"Test without mic" does not wait for the phone to settle', file: C,
    from: '        await this.env.wait(plan.quiet);\n', to: '' },
  { rule: 'the phone\'s own mic is kept on the phone', file: C,
    from: "    this.engine.setMicChoice('phone');", to: "    this.engine.setMicChoice('phone');\n    this.store.set('rp.mic.phone', '1');" },
  /* the old app as the checklist (RULEBOOK 2.6), 12 Oct */
  { rule: 'a song that will not load goes back to Start without a word', file: C,
    from: "        this.set({ sound: 'load' });\n", to: '' },
  { rule: 'the pitch reader drifts from the old app\'s (the first dip)', file: 'src/audio/pitch/yin.ts',
    from: '    if (dp[tau] < 0.15) {', to: '    if (dp[tau] < 0.16) {' },
  { rule: 'the pitch reader drifts from the old app\'s (its highest note)', file: 'src/audio/pitch/yin.ts',
    from: 'const tmin = Math.max(2, Math.floor(sr / 1400));', to: 'const tmin = Math.max(2, Math.floor(sr / 1500));' },
  { rule: 'the gate drifts from the old app\'s default', file: 'src/audio/pitch/yin.ts',
    from: 'export const CLARITY = 0.42 - 0.2 * 0.16;', to: 'export const CLARITY = 0.42 - 0.25 * 0.16;' },
  { rule: 'a reading is dated where the old app did not date it', file: 'src/audio/pitch/yin.ts',
    from: 'return (win >> 1) - Math.round(512 + 0.002 * sr);', to: 'return (win >> 1) - 512;' },
  { rule: 'the octave anchor trusts an unsure model', file: 'src/audio/pitch/line.ts',
    from: 'anc.conf[ai] < 0.5) return m;', to: 'anc.conf[ai] < 0.4) return m;' },
  { rule: 'the view can pin too tight to read', file: 'src/core/notemap.ts',
    from: 'export const MIN_SPAN = 14;', to: 'export const MIN_SPAN = 0;' },
  { rule: 'the view can pin too wide to read', file: 'src/core/notemap.ts',
    from: '  if (hi - lo > MAX_SPAN) {', to: '  if (hi - lo > 999) {' },
  { rule: 'an unbelievable speaker delay is believed', file: 'src/audio/engine-web/web-engine.ts',
    from: '  return d > 0 && d < 0.5 ? d : 0;', to: '  return d > 0 ? d : 0;' },
  { rule: 'the checklist names a test that is gone', file: 'src/core/notemap.test.ts',
    from: "  it('is never so tight the lanes fuse", to: "  it('is narrow or wide" },
  { rule: 'a mic another app holds is not said (Android 9)', file: C,
    from: "      if (held && this.snap.mic === 'open') this.set({ mic: 'held' });", to: "      if (held && false) this.set({ mic: 'held' });" },
];

function run() {
  const out = join(mkdtempSync(join(tmpdir(), 'mut-')), 'r.json');
  const r = spawnSync('npx', ['vitest', 'run', 'src', '--reporter=json', '--outputFile=' + out], { encoding: 'utf8' });
  let failed = [];
  try {
    const j = JSON.parse(readFileSync(out, 'utf8'));
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.status !== 'passed') failed.push(a.title);
  } catch {
    failed = ['(the tests did not run: ' + (r.stderr || '').slice(0, 200) + ')'];
  }
  return { code: r.status, failed };
}

const base = run();
if (base.code !== 0) {
  console.log('The unmodified conductor already fails its tests:', base.failed);
  process.exit(1);
}
let survived = 0;
/* RP_MUTANTS=word,word runs only the broken rules whose names contain one */
const pick = (process.env.RP_MUTANTS || '').split(',').filter(Boolean);
const RUN = MUTATIONS.filter((m) => !pick.length || pick.some((w) => m.rule.includes(w)));
for (const m of RUN) {
  const src = readFileSync(m.file, 'utf8');
  const n = src.split(m.from).length - 1;
  if (m.all ? n < 1 : n !== 1) {
    console.log(`✗ ${m.rule}: the code to break was found ${n} times, not once`);
    survived++;
    continue;
  }
  writeFileSync(m.file, m.all ? src.split(m.from).join(m.to) : src.replace(m.from, m.to));
  let r;
  try { r = run(); } finally { writeFileSync(m.file, src); }
  if (r.code === 0 || !r.failed.length) {
    console.log(`✗ ${m.rule}: broken, and every test still passed`);
    survived++;
  } else {
    console.log(`✓ ${m.rule}: caught by ${r.failed.length} — ${r.failed.slice(0, 3).join(' | ')}`);
  }
}
console.log(survived ? `\n${survived} broken rule(s) went unnoticed` : `\nall ${RUN.length} broken rules were caught`);
process.exit(survived ? 1 : 0);
