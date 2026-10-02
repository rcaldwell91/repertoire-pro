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
    from: '    this.closeMic();\n    if (this.ctx && this.ctx.state',
    to: '    if (this.ctx && this.ctx.state',
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
    from: '--muted: #595959;',
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
    to: "<><h1>{copy.tabs[props.tab]}</h1><p>{'Coming soon'}</p></>",
    checks: ['words'],
  },
  {
    what: 'tabs show every label',
    file: 'src/ui/TabBar.tsx',
    from: '{on && <span>{copy.tabs[t]}</span>}',
    to: '<span>{copy.tabs[t]}</span>',
    checks: ['tabs'],
  },
];

function edit(dir, { file, from, to }) {
  const p = join(dir, file);
  const s = readFileSync(p, 'utf8');
  if (!s.includes(from)) throw new Error(`mutation does not apply: ${file}: ${from}`);
  writeFileSync(p, s.replace(from, to));
}

let caught = 0;
for (const m of MUTATIONS) {
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
    const r = spawnSync('node', [join(WEB, 'tests/browser.test.mjs')], {
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
console.log(caught === MUTATIONS.length ? `\nall ${caught} broken builds were caught` : `\n${MUTATIONS.length - caught} broken builds were NOT caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
