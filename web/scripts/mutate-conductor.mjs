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
const L = 'src/audio/mic-ladder.ts';

export const MUTATIONS = [
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
    from: "        }\n        if (gen !== this.gen) return;\n      }\n      if (plan.countIn",
    to: "        }\n      }\n      if (plan.countIn" },
  { rule: 'a late song part still plays', file: C,
    from: "if (!samples.has(u)) samples.set(u, await this.engine.load(u));\n            if (gen !== this.gen) return;",
    to: "if (!samples.has(u)) samples.set(u, await this.engine.load(u));" },
  { rule: 'a song volume reaches the wrong part', file: C,
    from: 'this.song?.ensemble.setGain(part, gain);', to: 'this.song?.ensemble.setGain(0, gain);' },
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
    from: 'if (this.monitoring && this.snap.mic === \'open\') this.engine.monitor(this.monitorGain);',
    to: 'if (this.snap.mic === \'open\') this.engine.monitor(this.monitorGain);' },
  { rule: 'a song without the mic opens it anyway', file: C,
    from: "      if (plan.steps.some((st) => st.kind === 'listen' || (st.kind === 'song' && st.listen))) {", to: '      if (true) {' },
  { rule: 'a repeated part does not wrap', file: C,
    from: 'if (loop && p >= loop.end && loop.end > loop.start)', to: 'if (false)' },
  { rule: 'a song keeps its memory', file: C,
    from: 'urls.forEach((u) => this.engine.forget(u));', to: ';' },
  { rule: 'a late count-in still plays', file: C,
    from: 'await this.env.wait(plan.countIn);\n        if (gen !== this.gen) return;', to: 'await this.env.wait(plan.countIn);' },
  { rule: 'a stopped note carries on to the next step', file: C,
    from: 'await src.ended;\n          if (gen !== this.gen) return;', to: 'await src.ended;' },
  { rule: 'a late mic stays open', file: C,
    from: "if (r.ok && this.snap.mic !== 'open' && this.snap.mic !== 'opening' && this.snap.mic !== 'held') this.engine.closeMic();", to: ';' },
  { rule: 'finishing keeps hold of everything', file: C,
    from: "if (gen === this.gen) this.halt('finished', null);", to: "if (gen === this.gen) this.set({ state: 'finished' });" },
  { rule: 'the mic set that worked is forgotten', file: C,
    from: 'this.store.set(MIC_KEY, String(r.set));', to: ';' },
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
  { rule: 'the ladder requires raw capture', file: W,
    from: 'c.echoCancellation = { ideal: set.echoCancellation };', to: 'c.echoCancellation = { exact: set.echoCancellation };' },
  { rule: 'the ladder forgets what worked', file: L,
    from: 'return [remembered, ...all.filter((i) => i !== remembered)];', to: 'return all;' },
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
  { rule: 'a mic another app holds is not said (Android 9)', file: C,
    from: "      if (held && this.snap.mic === 'open') this.set({ mic: 'held' });", to: "      if (held && false) this.set({ mic: 'held' });" },
];

function run() {
  const out = join(mkdtempSync(join(tmpdir(), 'mut-')), 'r.json');
  const r = spawnSync('npx', ['vitest', 'run', 'src/audio', '--reporter=json', '--outputFile=' + out], { encoding: 'utf8' });
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
for (const m of MUTATIONS) {
  const src = readFileSync(m.file, 'utf8');
  const n = src.split(m.from).length - 1;
  if (n !== 1) {
    console.log(`✗ ${m.rule}: the code to break was found ${n} times, not once`);
    survived++;
    continue;
  }
  writeFileSync(m.file, src.replace(m.from, m.to));
  let r;
  try { r = run(); } finally { writeFileSync(m.file, src); }
  if (r.code === 0 || !r.failed.length) {
    console.log(`✗ ${m.rule}: broken, and every test still passed`);
    survived++;
  } else {
    console.log(`✓ ${m.rule}: caught by ${r.failed.length} — ${r.failed.slice(0, 3).join(' | ')}`);
  }
}
console.log(survived ? `\n${survived} broken rule(s) went unnoticed` : `\nall ${MUTATIONS.length} broken rules were caught`);
process.exit(survived ? 1 : 0);
