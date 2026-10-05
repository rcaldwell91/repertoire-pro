/* RULEBOOK 4, Tests: "Prove a new test fails on the broken case before
   trusting it." Each mutation breaks one rule in a copy of the app, builds
   that copy, and runs the browser checks that guard the rule against it.
   Every one of them must fail. The real source is never touched. */
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WEB = fileURLToPath(new URL('..', import.meta.url));

const MUTATIONS = [
  {
    what: 'changing screen does not tell the conductor',
    file: 'src/shell/App.tsx',
    from: 'props.conductor.leave(why);',
    to: '',
    checks: ['tab-switch-note', 'tab-switch-listening', 'back-while-running'],
  },
  {
    what: 'hiding the app is not noticed',
    file: 'src/shell/env.ts',
    from: "document.addEventListener('visibilitychange', vis);\n      window.addEventListener('pagehide', cb);",
    to: 'void vis;',
    checks: ['hidden-note', 'hidden-listening'],
  },
  {
    what: 'the screen starts by itself, and the conductor lets it',
    file: 'src/screens/SoundCheck.tsx',
    from: '  useEffect(() => {\n    if (!view.level) return;',
    to: '  useEffect(() => {\n    c.start(null, WITH_MIC);\n  }, [c]);\n\n  useEffect(() => {\n    if (!view.level) return;',
    and: { file: 'src/audio/conductor/conductor.ts', from: 'if (!this.spend(token)) return false;', to: 'this.spend(token);' },
    checks: ['nothing-before-start'],
  },
  {
    what: 'letting go of sound leaves the mic open',
    file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.closeMic();\n    /* Silence is immediate',
    to: '    /* Silence is immediate',
    checks: ['tab-switch-listening', 'hidden-listening', 'stop', 'back-while-running'],
  },
  {
    what: 'Start opens the mic without playing the note',
    file: 'src/screens/SoundCheck.tsx',
    from: 'steps: [NOTE, { kind: \'listen\' }]',
    to: 'steps: [{ kind: \'listen\' }]',
    checks: ['start'],
  },
  {
    what: 'no "Carry on without it"',
    file: 'src/core/sound-check.ts',
    from: "return { line: s.mic, button: 'start', level: false, carryOn: true };",
    to: "return { line: s.mic, button: 'start', level: false, carryOn: false };",
    checks: ['mic-refused'],
  },
  {
    what: 'a screen move replaces history, so Back skips it',
    file: 'src/shell/router.ts',
    from: 'location.hash = to;',
    to: "location.replace('#' + to);",
    checks: ['back'],
  },
  {
    what: 'grey tab icons too faint',
    file: 'src/ui/tokens.css',
    from: '--muted: #5b566f;',
    to: '--muted: #a0a0a0;',
    checks: ['contrast'],
  },
  {
    what: 'a button without its colours',
    file: 'src/ui/tokens.css',
    from: '  background: var(--bar);\n  color: var(--muted);',
    to: '  background: transparent;\n  color: var(--muted);',
    checks: ['contrast'],
  },
  {
    what: 'a screen writes its own words',
    file: 'src/screens/TabPage.tsx',
    from: '<h1>{copy.tabs[props.tab]}</h1>',
    to: "<><h1>{copy.tabs[props.tab]}</h1><p>{'Nothing here yet'}</p></>",
    checks: ['words'],
  },
  {
    what: 'tabs show every label',
    file: 'src/ui/TabBar.tsx',
    from: '{on && <span>{copy.tabs[t]}</span>}',
    to: '<span>{copy.tabs[t]}</span>',
    checks: ['tabs'],
  },
  /* Learn a song (tests/song.test.mjs, against the real separator) */
  { test: 'song', what: 'the progress shows the end, not how far it has got', file: 'src/core/song.ts',
    from: 'at: clock(split.readyS), of: clock(split.totalS)', to: 'at: clock(split.totalS), of: clock(split.totalS)', checks: ['split-progress'] },
  { test: 'song', what: 'the first 30 seconds cannot be played early', file: 'src/screens/SongScreen.tsx',
    from: "has?.full ? 'full' : has?.first30 ? 'first30' : null;", to: "has?.full ? 'full' : null;", checks: ['first30-early'] },
  { test: 'song', what: 'the voice slider moves the music too', file: 'src/screens/SongScreen.tsx',
    from: 'onChange={(v) => { setVoice(v); if (playing) c.setGain(0, gainOf(v)); }}',
    to: 'onChange={(v) => { setVoice(v); if (playing) { c.setGain(0, gainOf(v)); c.setGain(1, gainOf(v)); } }}', checks: ['sliders'] },
  { test: 'song', what: 'voice and music start apart', file: 'src/audio/engine-web/web-engine.ts',
    from: 'nodes.forEach((src) => src.start(when, opts.from));', to: 'nodes.forEach((src, i) => src.start(when + i * 0.02, opts.from));', checks: ['sum-matches'] },
  { test: 'song', what: 'leaving the song screen keeps it playing', file: 'src/shell/App.tsx',
    from: 'props.conductor.leave(why);', to: '', checks: ['song-leave'] },
  { test: 'song', what: 'hiding the app during a song is not noticed', file: 'src/shell/env.ts',
    from: "document.addEventListener('visibilitychange', vis);\n      window.addEventListener('pagehide', cb);", to: 'void vis;', checks: ['song-hidden'] },
  { test: 'song', what: 'reopening a song splits it again', file: 'src/data/split.ts',
    from: 'if (!song || (song.voice && song.music)) {', to: 'if (!song) {',
    and: { file: 'src/screens/SongScreen.tsx', from: "  const owner = 'song:' + props.id;", to: "  const owner = 'song:' + props.id;\n  useEffect(() => { void startSplit(props.id); }, [props.id]);" },
    checks: ['reopen'] },
  { test: 'song', what: 'Learn a song offers Add a song to someone signed out', file: 'src/screens/SongList.tsx',
    from: '      {me ? (', to: '      {true ? (', checks: ['signed-out-prompt'] },
  { test: 'song', what: 'an unreachable server looks like a failed split', file: 'src/data/separator.ts',
    from: "x.onerror = () => reject(new SplitError('offline'));", to: "x.onerror = () => reject(new SplitError('failed'));", checks: ['server-off'] },
  { test: 'song', what: 'a file over 30 MB is sent anyway', file: 'src/data/split.ts',
    from: "if (song.file.size > MAX_BYTES) return await fail(id, 'too-big');", to: "if (MAX_BYTES < 0) return await fail(id, 'too-big');", checks: ['too-big'] },
  { test: 'song', what: 'a song over 10 minutes is sent anyway', file: 'src/data/split.ts',
    from: 'if (secs != null && secs > MAX_SECONDS + 0.5)', to: 'if (secs != null && MAX_SECONDS < 0)', checks: ['too-long'] },
  { test: 'song', what: 'repeat this part does not repeat', file: 'src/audio/engine-web/web-engine.ts',
    from: '        src.loop = true;', to: '        src.loop = false;', checks: ['controls'] },
  { test: 'song', what: 'back 10 s does nothing while playing', file: 'src/screens/SongScreen.tsx',
    from: '    if (playing) startAt(ev, at, loop && (at < loop.start || at >= loop.end) ? null : loop);', to: '', checks: ['controls'] },
  { test: 'song', what: 'a restart looks like the phone taking the sound (the bug fixed this round)', file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.sleepTimer = setTimeout(() => {\n      this.sleepTimer = null;\n      const ctx = this.ctx;\n      if (!ctx || ctx.state !== \'running\' || this.sources.size) return;',
    to: '    this.sleepTimer = null;\n    { const ctx = this.ctx;\n      if (!ctx || ctx.state !== \'running\') return;',
    and: { file: 'src/audio/engine-web/web-engine.ts', from: '      this.sleeping = p;\n    }, 400);', to: '      this.sleeping = null; void p;\n    }' },
    checks: ['controls'] },
  { test: 'song', what: 'the song screen is too faint in the dark', file: 'src/ui/tokens.css',
    from: '--muted: #a6a2c4;', to: '--muted: #4a4766;', checks: ['song-contrast'] },
  /* the singer's line, your line and the note map (tests/notemap.test.mjs, and the song test for the first 30 seconds) */
  { test: 'song', what: 'the singer\'s line waits for the whole voice', file: 'src/screens/SongScreen.tsx',
    from: 'const voiceParts = has ? (has.full ? 2 : has.first30 ? 1 : 0) : 0;', to: 'const voiceParts = has ? (has.full ? 2 : 0) : 0;', checks: ['line-first30'] },
  { test: 'song', what: 'the whole voice is read again from the start', file: 'src/shell/singer-line.ts',
    from: 'fromK = Math.round(stored.readTo / HOP);', to: 'fromK = 0;', checks: ['line-first30'] },
  { test: 'notemap', what: 'the reading progress shows the end, not how far it has got', file: 'src/screens/SongScreen.tsx',
    from: 'at: clock(singer.readTo), of: clock(singer.seconds)', to: 'at: clock(singer.seconds), of: clock(singer.seconds)', checks: ['line-read'] },
  { test: 'notemap', what: 'the singer\'s line is read from the music', file: 'src/shell/singer-line.ts',
    from: 'const voice = song.voice ?? song.voice30;', to: 'const voice = song.music ?? song.music30;', checks: ['line-follows'] },
  { test: 'notemap', what: 'the singer\'s line goes with the Voice slider', file: 'src/screens/SongScreen.tsx',
    from: 'singer: singer?.m ?? new Float32Array(0),', to: 'singer: voice > 0 && singer ? singer.m : new Float32Array(0),',
    and: { file: 'src/screens/SongScreen.tsx', from: '[singer, you]);', to: '[singer, you, voice]);' }, checks: ['voice-zero'] },
  { test: 'notemap', what: 'the view follows the newest note', file: 'src/ui/NoteMap.tsx',
    from: 'const r = range ?? { lo: 55, hi: 72 };',
    to: 'const cur = singerAt(lines.singer, lines.hop, at); const r = Number.isFinite(cur) ? { lo: Math.round(cur) - 8, hi: Math.round(cur) + 8 } : range ?? { lo: 55, hi: 72 };',
    checks: ['pinned'] },
  { test: 'notemap', what: 'the speaker\'s delay is not taken off the song', file: 'src/audio/conductor/conductor.ts',
    from: 'const d = at - this.engine.outputLatency() - song.ensemble.startedAt;', to: 'const d = at - song.ensemble.startedAt;', checks: ['placement'] },
  { test: 'notemap', what: 'the mic\'s delay is not taken off what it hears', file: 'src/audio/engine-web/web-engine.ts',
    from: 'end: e.data.end - this.inputLatency', to: 'end: e.data.end', checks: ['placement'] },
  { test: 'notemap', what: 'your notes are dated when read, not at the middle of what was heard', file: 'src/audio/pitch/core.ts',
    from: 'const at = endT - WIN / 2 / this.sr;', to: 'const at = endT;', checks: ['placement'] },
  { test: 'notemap', what: '"Any octave" does nothing', file: 'src/ui/NoteMap.tsx',
    from: 'if (Number.isFinite(s)) m = foldTo(m, s);', to: 'void foldTo; void s;', checks: ['octave-switch'] },
  { test: 'notemap', what: 'octaves are folded by default', file: 'src/screens/SongScreen.tsx',
    from: 'const [anyOctave, setAnyOctave] = useState(false);', to: 'const [anyOctave, setAnyOctave] = useState(true);', checks: ['octave-switch'] },
  { test: 'notemap', what: '"Hear yourself" sounds while it is off', file: 'src/audio/conductor/conductor.ts',
    from: 'if (withSong) this.engine.monitor(this.monitorGain);', to: 'if (withSong) this.engine.monitor(0.8);', checks: ['hear-yourself'] },
  { test: 'notemap', what: 'the headphones line shows every time', file: 'src/screens/SongScreen.tsx',
    from: 'if (!store.get(HEADPHONES_SEEN)) {', to: 'if (store) {', checks: ['hear-yourself'] },
  { test: 'notemap', what: 'letting go of sound leaves the mic open, singing a song', file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.closeMic();\n    /* Silence is immediate', to: '    /* Silence is immediate', checks: ['mic-leave', 'mic-hidden'] },
  { test: 'notemap', what: 'a refused mic stops the song', file: 'src/audio/conductor/conductor.ts',
    from: '    this.set({ mic: r.why });             /* refused or missing: the rest carries on without it */\n    return false;',
    to: '    this.set({ mic: r.why });\n    if (withSong) this.halt(\'stopped\', null);\n    return false;', checks: ['mic-refused'] },
  { test: 'notemap', what: 'no "Carry on without it" on the song screen', file: 'src/screens/SongScreen.tsx',
    from: '        {mic && (\n          <button type="button" className="btn btn-quiet" id="carry-on"',
    to: '        {mic && false && (\n          <button type="button" className="btn btn-quiet" id="carry-on"', checks: ['mic-refused'] },
  { test: 'notemap', what: 'reopening a song reads its line again', file: 'src/shell/singer-line.ts',
    from: '    if (stored.anchored && stored.done && (stored.whole || !whole)) return;', to: '', checks: ['reopen-line'] },
];

function edit(dir, { file, from, to }) {
  const p = join(dir, file);
  const s = readFileSync(p, 'utf8');
  if (!s.includes(from)) throw new Error(`mutation does not apply: ${file}: ${from}`);
  writeFileSync(p, s.replace(from, to));
}

let caught = 0;
/* RP_MUTANTS=word,word runs only the broken builds whose names contain one */
const pick = (process.env.RP_MUTANTS || '').split(',').filter(Boolean);
const RUN = MUTATIONS.filter((m) => !pick.length || pick.some((w) => m.what.includes(w)));
for (const m of RUN) {
  const dir = mkdtempSync(join(tmpdir(), 'rp-mutant-'));
  try {
    for (const f of ['src', 'public', 'index.html', 'vite.config.ts', 'tsconfig.json', 'package.json']) {
      cpSync(join(WEB, f), join(dir, f), { recursive: true });
    }
    symlinkSync(join(WEB, 'node_modules'), join(dir, 'node_modules'));
    edit(dir, m);
    if (m.and) edit(dir, m.and);
    const b = spawnSync('npx', ['vite', 'build', '--outDir', join(dir, 'app'), '--emptyOutDir', '--logLevel', 'error'], { cwd: dir, encoding: 'utf8' });
    if (b.status !== 0) throw new Error('broken copy did not build: ' + b.stderr);
    /* the checks (from the real test file) against the broken build */
    const suite = { song: 'tests/song.test.mjs', notemap: 'tests/notemap.test.mjs' }[m.test] || 'tests/browser.test.mjs';
    const r = spawnSync('node', [join(WEB, suite)], {
      cwd: WEB,
      encoding: 'utf8',
      env: { ...process.env, APP_DIR: join(dir, 'app'), ONLY: m.checks.join(',') },
    });
    const out = r.stdout + r.stderr;
    const missed = m.checks.filter((c) => !new RegExp('^FAIL ' + c + '\\b', 'm').test(out));
    if (r.status !== 0 && missed.length === 0) {
      caught++;
      console.log(`caught   ${m.what}  (failed: ${m.checks.join(', ')})`);
    } else {
      console.log(`MISSED   ${m.what}  (still passing: ${missed.join(', ') || 'exit 0'})\n${out}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
console.log(caught === RUN.length ? `\nall ${caught} broken builds were caught` : `\n${RUN.length - caught} broken builds were NOT caught`);
process.exit(caught === RUN.length ? 0 : 1);
