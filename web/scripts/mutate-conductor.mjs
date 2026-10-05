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
    from: "engine.onInterrupt(() => this.leave('interrupted'));", to: ';' },
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
    from: '    this.set({ mic: r.why });             /* refused or missing: the rest carries on without it */\n    return false;',
    to: "    this.set({ mic: r.why });\n    if (withSong) this.halt('stopped', null);\n    return false;" },
  { rule: 'the mic is handed on when nobody is listening', file: C,
    from: "if (this.snap.mic === 'open' && this.snap.state === 'running') this.micListeners.forEach((f) => f(b));",
    to: 'this.micListeners.forEach((f) => f(b));' },
  { rule: '"Hear yourself" sounds outside a song', file: C,
    from: 'if (this.monitoring && this.snap.mic === \'open\') this.engine.monitor(this.monitorGain);',
    to: 'if (this.snap.mic === \'open\') this.engine.monitor(this.monitorGain);' },
  { rule: 'a song without the mic opens it anyway', file: C,
    from: '          if (st.listen) {', to: '          if (true) {' },
  { rule: 'a repeated part does not wrap', file: C,
    from: 'if (loop && p >= loop.end && loop.end > loop.start)', to: 'if (false)' },
  { rule: 'a song keeps its memory', file: C,
    from: 'urls.forEach((u) => this.engine.forget(u));', to: ';' },
  { rule: 'a late count-in still plays', file: C,
    from: 'await this.env.wait(plan.countIn);\n        if (gen !== this.gen) return;', to: 'await this.env.wait(plan.countIn);' },
  { rule: 'a stopped note carries on to the mic', file: C,
    from: 'await src.ended;\n          if (gen !== this.gen) return;', to: 'await src.ended;' },
  { rule: 'a late mic stays open', file: C,
    from: "if (r.ok && this.snap.mic !== 'open' && this.snap.mic !== 'opening') this.engine.closeMic();", to: ';' },
  { rule: 'finishing keeps hold of everything', file: C,
    from: "if (gen === this.gen) this.halt('finished', null);", to: "if (gen === this.gen) this.set({ state: 'finished' });" },
  { rule: 'the mic set that worked is forgotten', file: C,
    from: 'this.store.set(MIC_KEY, String(r.set));', to: ';' },
  { rule: 'a refused mic blocks the note', file: C,
    from: 'if (!this.spend(token)) return false;', to: "if (!this.spend(token)) return false;\n    if (this.snap.mic === 'refused') return false;" },
  { rule: 'the ladder requires raw capture', file: W,
    from: 'c.echoCancellation = { ideal: set.echoCancellation };', to: 'c.echoCancellation = { exact: set.echoCancellation };' },
  { rule: 'the ladder forgets what worked', file: L,
    from: 'return [remembered, ...all.filter((i) => i !== remembered)];', to: 'return all;' },
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
