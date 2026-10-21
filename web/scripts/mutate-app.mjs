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
    from: '    this.closeMic();\n    /* RULEBOOK 4, Sound, Android 1',
    to: '    /* RULEBOOK 4, Sound, Android 1',
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
    from: 'if (opts.from >= begins) src.start(when, opts.from - begins);', to: 'if (opts.from >= begins) src.start(when + i * 0.02, opts.from - begins);', checks: ['sum-matches'] },
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
  /* sound on an Android phone (RULEBOOK 4, Sound, Android; tests/android.test.mjs) */
  { test: 'android', what: 'a hung resume is waited for forever (Android 2)', file: 'src/audio/engine-web/web-engine.ts',
    from: '      await race(ctx.resume(), LIMITS.resume);', to: '      await ctx.resume();', checks: ['start-hangs'] },
  { test: 'android', what: 'sound is said to play without the clock proving it (Android 3, 7)', file: 'src/audio/engine-web/web-engine.ts',
    from: '    if (!(await this.clockMoves(ctx, LIMITS.clock)) || ctx !== this.ctx) {', to: '    if (ctx !== this.ctx) {', checks: ['start-hangs'] },
  { test: 'android', what: 'Start says Pause before the sound is proved', file: 'src/screens/SongScreen.tsx',
    from: "{sounding || (playing && snap.state === 'counting-in') ? copy.song.pause : playing ? copy.song.starting : copy.song.start}", to: '{playing ? copy.song.pause : copy.song.start}', checks: ['start-hangs'] },
  { test: 'android', what: 'sound that will not start sits silently, with no message (Android 8)', file: 'src/screens/SongScreen.tsx',
    from: '<SoundTrouble sound={trouble}', to: '<SoundTrouble sound={null}', checks: ['start-hangs'] },
  { test: 'android', what: 'the sound is woken after the tap has run out', file: 'src/audio/engine-web/web-engine.ts',
    from: '    const ctx = this.context();\n    /* Android 3', to: '    await pause(5500);\n    const ctx = this.context();\n    /* Android 3', checks: ['gesture-only'] },
  { test: 'android', what: 'the sound is suspended after it stops (Android 1)', file: 'src/audio/engine-web/web-engine.ts',
    from: '  release(): void {\n    this.stopAll();\n    this.closeMic();',
    to: '  release(): void {\n    this.stopAll();\n    this.closeMic();\n    setTimeout(() => { if (!this.sources.size) void this.ctx?.suspend(); }, 400);',
    checks: ['never-suspends', 'ten-starts'] },
  { test: 'android', what: 'the sound wakes before the mic opens (Android 4)', file: 'src/audio/conductor/conductor.ts',
    from: '        if (!(await this.openMic(gen))) return;', to: '        void this.openMic(gen);', checks: ['mic-first'] },
  { test: 'android', what: 'a clock standing still is never noticed (Android 5)', file: 'src/audio/engine-web/web-engine.ts',
    from: '    });\n    this.watch();\n    const stop = () =>', to: '    });\n    const stop = () =>', checks: ['stall-rebuild', 'hear-yourself-rebuilt'] },
  { test: 'android', what: 'the tap after a stall keeps the stalled sound (Android 5)', file: 'src/audio/conductor/conductor.ts',
    from: '      const woke = await this.engine.wake(this.rebuild);', to: '      const woke = await this.engine.wake(false);', checks: ['stall-rebuild'] },
  { test: 'android', what: 'a rebuilt sound leaves the mic on the old one (Android 5)', file: 'src/audio/engine-web/web-engine.ts',
    from: '    if (this.stream) await this.attachMic(ctx);\n    return { ok: true };', to: '    if (this.stream && !rebuild) await this.attachMic(ctx);\n    return { ok: true };',
    checks: ['hear-yourself-rebuilt'] },
  { test: 'android', what: 'a mic another app takes is not noticed (Android 9)', file: 'src/audio/engine-web/web-engine.ts',
    from: '      track.onmute = () => this.stream === stream && this.heldCbs.forEach((f) => f(true));\n', to: '', checks: ['mic-held'] },
  { what: 'the Sound check says the clock stands still when it moves', file: 'src/core/sound-check.ts',
    from: "    clock: r.moving ? 'moving' : 'still',", to: "    clock: 'still',", checks: ['start'] },
  /* Robert's four decisions, 13 Oct */
  { test: 'android', what: 'a mic another app had is not asked for again on the tap', file: 'src/audio/engine-web/web-engine.ts',
    from: '    if ((r.ok && r.held) || (!r.ok && r.why === \'held\')) {', to: '    if (false) {', checks: ['held-retry'] },
  { test: 'android', what: 'a held mic is asked for again and again', file: 'src/audio/engine-web/web-engine.ts',
    from: '    if ((r.ok && r.held) || (!r.ok && r.why === \'held\')) {', to: '    for (let i = 0; i < 4 && ((r.ok && r.held) || (!r.ok && r.why === \'held\')); i++) {', checks: ['held-retry'] },
  { test: 'android', what: 'a held mic does not say to tap Start', file: 'src/core/song.ts',
    from: "  if (mic === 'held') return copy.song.micHeld + ' ' + copy.song.tryStart;", to: "  if (mic === 'held') return copy.song.micHeld;", checks: ['held-retry'] },
  { test: 'android', what: 'Start does not count in', file: 'src/screens/SongScreen.tsx',
    from: '    startAt(ev, pos >= shown - 0.25 ? 0 : pos, loop, true);', to: '    startAt(ev, pos >= shown - 0.25 ? 0 : pos, loop, false);', checks: ['count-in'] },
  { test: 'android', what: 'back 10 s counts in', file: 'src/screens/SongScreen.tsx',
    from: '    if (playing) startAt(ev, at, loop && (at < loop.start || at >= loop.end) ? null : loop);', to: '    if (playing) startAt(ev, at, loop && (at < loop.start || at >= loop.end) ? null : loop, true);', checks: ['count-in'] },
  { test: 'android', what: 'the count-in is not shown on the note map', file: 'src/ui/NoteMap.tsx',
    from: '{props.count != null && <div', to: '{false && <div', checks: ['count-in'] },
  { test: 'android', what: '"Test without mic" opens the mic', file: 'src/screens/SoundCheck.tsx',
    from: "quiet: 0.8, rebuild: true, steps: [NOTE] };", to: "quiet: 0.8, rebuild: true, steps: [NOTE, { kind: 'listen' }] };", checks: ['test-without-mic'] },
  { test: 'android', what: '"Test without mic" keeps the old sound', file: 'src/screens/SoundCheck.tsx',
    from: "quiet: 0.8, rebuild: true, steps: [NOTE] };", to: "quiet: 0.8, steps: [NOTE] };", checks: ['test-without-mic'] },
  { test: 'android', what: '"Test without mic" says it came back without measuring', file: 'src/screens/SoundCheck.tsx',
    from: "const cameBack = !!report && report.clock === 'moving' && report.sentOut && !trouble;", to: 'const cameBack = true;', checks: ['test-without-mic'] },
  { test: 'android', what: 'which mic is in use is not said', file: 'src/screens/SoundCheck.tsx',
    from: "{(mode === 'phone' || mode === 'mode') && mine && report?.micName && (", to: "{false && (", checks: ['phone-mic'] },
  /* the USB-C headset (Robert's phone test, 21 Oct): the old app's final mic rules */
  { test: 'android', what: 'the raw mic is only wished for (ideal, not exact)', file: 'src/audio/engine-web/web-engine.ts',
    from: '  const v = (x: boolean) => (set.exact ? { exact: x } : { ideal: x });', to: '  const v = (x: boolean) => ({ ideal: x });', checks: ['mic-once-raw'] },
  { test: 'android', what: 'Start asks for the mic twice when it opens', file: 'src/audio/engine-web/web-engine.ts',
    from: '    let r = await this.ask(set, device, wait);', to: '    let r = await this.ask(set, device, wait);\n    if (r.ok) { this.closeMic(); r = await this.ask(set, device, wait); }', checks: ['mic-once-raw'] },
  { test: 'android', what: 'a refused mic walks down a ladder of modes', file: 'src/audio/engine-web/web-engine.ts',
    from: '    let r = await this.ask(set, device, wait);', to: "    let r = await this.ask(set, device, wait);\n    if (!r.ok && r.why === 'failed') r = await this.ask({ name: 'phone' }, device, wait);", checks: ['no-ladder'] },
  { test: 'android', what: 'the old ladder\'s rung is kept', file: 'src/audio/conductor/conductor.ts',
    from: '    store.remove(OLD_RUNG_KEY);', to: '', checks: ['mode-by-hand'] },
  { test: 'android', what: 'a mode chosen by hand is not remembered', file: 'src/audio/conductor/conductor.ts',
    from: '    this.store.set(MODE_KEY, String(next));', to: '', checks: ['mode-by-hand'] },
  { test: 'android', what: 'a rebuild does not wait for the old sound to close', file: 'src/audio/engine-web/web-engine.ts',
    from: '        await race(old.close(), LIMITS.close);', to: '        void old.close();', checks: ['rebuild-awaits-close'] },
  { test: 'android', what: 'a rebuild does not wait 800 ms', file: 'src/audio/engine-web/web-engine.ts',
    from: '      await pause(REBUILD_SETTLE_MS);\n', to: '', checks: ['rebuild-awaits-close'] },
  { test: 'android', what: 'the chosen mic is not used on the first request', file: 'src/audio/engine-web/web-engine.ts',
    from: '    const device = await this.chosenDevice();', to: '    const device = await Promise.resolve(null);', checks: ['phone-mic'] },
  { test: 'android', what: 'the chosen mic\'s note is never cleared', file: 'src/audio/engine-web/web-engine.ts',
    from: '    } finally {\n      if (device) drop(PENDING_KEY);', to: '    } finally {\n      void device;', checks: ['phone-mic'] },
  { test: 'android', what: 'a mic that took the phone down is chosen again', file: 'src/audio/engine-web/web-engine.ts',
    from: '    const pending = read(PENDING_KEY);', to: '    const pending = null as string | null;', checks: ['mic-crash'] },
  { test: 'android', what: 'sound made before the mic opened is kept', file: 'src/audio/engine-web/web-engine.ts',
    from: '    if (!rebuild && this.ctx && this.ctx.state !== \'closed\' && this.stream && !this.bornWithMic) rebuild = true;', to: '', checks: ['born-before-mic'] },
  /* the old app as the checklist (RULEBOOK 2.6), 12 Oct */
  { test: 'android', what: 'a clock that crawls is not a stall', file: 'src/audio/engine-web/web-engine.ts',
    from: '      if (now.clock - ref.clock < STALL_PACE * wall) {', to: '      if (now.clock - ref.clock <= 0) {', checks: ['clock-crawls'] },
  { test: 'android', what: 'a close that never answers holds up the rebuild', file: 'src/audio/engine-web/web-engine.ts',
    from: '        await race(old.close(), LIMITS.close);', to: '        await old.close();', checks: ['close-hangs'] },
  { test: 'android', what: 'a mic that never answers holds Start for ever', file: 'src/audio/engine-web/web-engine.ts',
    from: '    const stream = await race(asked, wait);', to: '    const stream = await asked;', checks: ['mic-hangs'] },
  { test: 'android', what: 'a song that will not load goes back to Start without a word', file: 'src/audio/conductor/conductor.ts',
    from: "        this.set({ sound: 'load' });\n", to: '', checks: ['load-fails'] },
  { test: 'android', what: 'no "Use headphones." while singing', file: 'src/screens/SongScreen.tsx',
    from: '{listening && noHeadphones && <p', to: '{false && noHeadphones && <p', checks: ['use-headphones'] },
  { test: 'android', what: '"Any octave" is forgotten', file: 'src/screens/SongScreen.tsx',
    from: "useState(() => localStore().get(ANY_OCTAVE) === '1')", to: 'useState(() => false)', checks: ['any-octave-kept'] },
  { test: 'android', what: 'no silent sample on Start (Android 3)', file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.kick(ctx);\n', to: '', checks: ['ten-starts'] },
  { test: 'android', what: 'mic graphs stack up on the one sound', file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.stream = null;\n    this.detachMic();', to: '    this.stream = null;\n    this.attached = null;',
    and: { file: 'src/audio/engine-web/web-engine.ts', from: '    this.detachMic();\n    this.attached = ctx;', to: '    this.attached = ctx;' }, checks: ['ten-starts'] },
  { what: 'DuckDuckGo is not named when it keeps the mic', file: 'src/screens/SoundCheck.tsx',
    from: "{micBlockedBrowser() && ['refused',", to: "{false && ['refused',", checks: ['duckduckgo'] },
  { test: 'takes', what: 'overlapping parts clip (no limiter)', file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.out.connect(limit);', to: '    this.out.connect(ctx.destination);', checks: ['take-no-clip'] },
  { test: 'song', what: 'a song the phone refused to store is not said', file: 'src/screens/AddSong.tsx',
    from: '      setFailed(true);', to: '', checks: ['add-fails'] },
  { test: 'library', what: 'storage that will not open looks like "No songs yet"', file: 'src/shell/hooks.ts',
    from: '() => live && setSongs(false));', to: '() => live && setSongs([]));', checks: ['no-storage'] },
  { test: 'library', what: 'a long title runs off the screen', file: 'src/ui/tokens.css',
    from: '  overflow-wrap: anywhere;\n}', to: '  white-space: nowrap;\n}', checks: ['long-title'] },
  { test: 'library', what: 'the old Library keeps its stray entries', file: 'src/data/db.ts',
    from: '      await clearStrays(d);\n', to: '', checks: ['stray-cleared'] },
  { test: 'library', what: 'an old-app song shaped a little like ours is cleared too', file: 'src/data/db.ts',
    from: "!('artist' in o) && !('added' in o) && !('addedAt' in o)", to: 'true', checks: ['old-song-kept'] },
  { test: 'library', what: 'a stray with no copy in this app is cleared anyway', file: 'src/data/db.ts',
    from: '            if (here && here.fileName === v.fileName) go.push', to: '            if (here || !here) go.push', checks: ['stray-without-copy-kept'] },
  { test: 'library', what: 'the clear-up runs on every start', file: 'src/data/db.ts',
    from: '    localStorage.setItem(STRAYS, \'1\');', to: '', checks: ['once-only'] },
  { test: 'song', what: 'the song screen is too faint in the dark', file: 'src/ui/tokens.css',
    from: '--muted: #a6a2c4;', to: '--muted: #4a4766;', checks: ['song-contrast'] },
  /* the singer's line, your line and the note map (tests/notemap.test.mjs, and the song test for the first 30 seconds) */
  { test: 'song', what: 'the singer\'s line waits for the whole voice', file: 'src/screens/SongScreen.tsx',
    from: 'const voiceParts = has ? (has.full ? 2 : has.first30 ? 1 : 0) : 0;', to: 'const voiceParts = has ? (has.full ? 2 : 0) : 0;', checks: ['line-first30'] },
  { test: 'song', what: 'the whole voice is read again from the start', file: 'src/shell/singer-line.ts',
    from: 'fromK = Math.round(stored.readTo / HOP);', to: 'fromK = 0;', checks: ['line-first30'] },
  { test: 'notemap', what: 'the reading progress shows the end, not how far it has got', file: 'src/screens/SongScreen.tsx',
    from: 'at: clock(singer.readTo), of: clock(singer.seconds)', to: 'at: clock(singer.seconds), of: clock(singer.seconds)', checks: ['line-read'] },
  { test: 'notemap', what: 'the song is read by one reader alone', file: 'src/audio/pitch/client.ts',
    from: 'const READERS = Math.max(2, Math.min(4, (globalThis.navigator?.hardwareConcurrency || 2) - 1));', to: 'const READERS = 1;',
    checks: ['line-shared'] },
  { test: 'notemap', what: 'the singer\'s line is read from the music', file: 'src/shell/singer-line.ts',
    from: 'const voice = song.voice ?? song.voice30;', to: 'const voice = song.music ?? song.music30;', checks: ['line-follows'] },
  { test: 'notemap', what: 'the singer\'s line goes with the Voice slider', file: 'src/screens/SongScreen.tsx',
    from: 'singer: singer?.m ?? new Float32Array(0), hop:', to: 'singer: voice > 0 && singer ? singer.m : new Float32Array(0), hop:',
    and: { file: 'src/screens/SongScreen.tsx', from: '[singer, you, shownLine]);', to: '[singer, you, shownLine, voice]);' }, checks: ['voice-zero'] },
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
    from: "useState(() => localStore().get(ANY_OCTAVE) === '1')", to: "useState(() => localStore().get(ANY_OCTAVE) !== '0')", checks: ['octave-switch'] },
  { test: 'notemap', what: '"Hear yourself" sounds while it is off', file: 'src/audio/conductor/conductor.ts',
    from: 'if (withSong) this.engine.monitor(this.monitorGain);', to: 'if (withSong) this.engine.monitor(0.8);', checks: ['hear-yourself'] },
  { test: 'notemap', what: 'the headphones line shows every time', file: 'src/screens/SongScreen.tsx',
    from: 'if (!store.get(HEADPHONES_SEEN)) {', to: 'if (store) {', checks: ['hear-yourself'] },
  { test: 'notemap', what: 'letting go of sound leaves the mic open, singing a song', file: 'src/audio/engine-web/web-engine.ts',
    from: '    this.closeMic();\n    /* RULEBOOK 4, Sound, Android 1', to: '    /* RULEBOOK 4, Sound, Android 1', checks: ['mic-leave', 'mic-hidden'] },
  { test: 'notemap', what: 'a refused mic stops the song', file: 'src/audio/conductor/conductor.ts',
    from: "    this.set({ mic: r.ok ? (r.held ? 'held' : 'open') : r.why });\n    return true;",
    to: "    this.set({ mic: r.ok ? (r.held ? 'held' : 'open') : r.why });\n    if (!r.ok) this.halt('stopped', null);\n    return r.ok;", checks: ['mic-refused'] },
  { test: 'notemap', what: 'no "Carry on without it" on the song screen', file: 'src/screens/SongScreen.tsx',
    from: '        {mic && (\n          <button type="button" className="btn btn-quiet" id="carry-on"',
    to: '        {mic && false && (\n          <button type="button" className="btn btn-quiet" id="carry-on"', checks: ['mic-refused'] },
  { test: 'notemap', what: 'reopening a song reads its line again', file: 'src/shell/singer-line.ts',
    from: '    if (stored.anchored && stored.done && (stored.whole || !whole)) return;', to: '', checks: ['reopen-line'] },
  /* takes (tests/takes.test.mjs, against the real database, with the two test accounts) */
  { test: 'takes', what: 'the take records the music too', file: 'src/audio/engine-web/web-engine.ts',
    from: '      src.connect(g);\n      g.connect(this.way(ctx));', to: '      src.connect(g);\n      g.connect(this.way(ctx));\n      if (this.tap) g.connect(this.tap);', checks: ['take-voice-only'] },
  { test: 'takes', what: 'a take is placed without the speaker\'s delay', file: 'src/audio/conductor/conductor.ts',
    from: 'this.recorder?.push(b, (at) => this.songTime(at));', to: 'this.recorder?.push(b, (at) => this.songTime(at + this.engine.outputLatency()));',
    checks: ['take-lines-up'] },
  { test: 'takes', what: 'a take plays back from the song\'s start, not its own place', file: 'src/screens/SongScreen.tsx',
    from: 'starts: [0, 0, t.songAt] }] });', to: 'starts: [0, 0, 0] }] });', checks: ['take-lines-up'] },
  { test: 'takes', what: 'the right-note % uses a looser rule than the map', file: 'src/core/takes.ts',
    from: '    if (isRight(m[i], s, anyOctave)) hit++;', to: '    if (Math.abs(m[i] - s) < 1) hit++;', checks: ['take-review'] },
  { test: 'takes', what: 'the map colours by a looser rule than the right-note %', file: 'src/ui/NoteMap.tsx',
    from: 'isRight(p.m, singerNow(lines.singer, lines.hop, p.t), false) ? p.m : NaN', to: 'Math.abs(p.m - singerNow(lines.singer, lines.hop, p.t)) < 1 ? p.m : NaN',
    checks: ['take-review'] },
  { test: 'takes', what: 'leaving a take keeps it playing', file: 'src/shell/App.tsx',
    from: 'props.conductor.leave(why);', to: '', checks: ['take-leave'] },
  { test: 'takes', what: 'offline, Save keeps nothing', file: 'src/data/takes.ts',
    from: "  await inStore('takes', 'readwrite', (s) => s.put({ ...t, sendTo, sent: [] }));",
    to: "  if (!navigator.onLine) return;\n  await inStore('takes', 'readwrite', (s) => s.put({ ...t, sendTo, sent: [] }));", checks: ['take-saved-first'] },
  { test: 'takes', what: 'a take kept offline never goes online by itself', file: 'src/data/takes.ts',
    from: "  window.addEventListener('online', () => void syncTakes());", to: '',
    and: { file: 'src/data/takes.ts', from: '  setInterval(() => void syncTakes(), 20000);', to: '' }, checks: ['take-offline'] },
  { test: 'takes', what: 'delete has no undo', file: 'src/data/takes.ts',
    from: 'export const UNDO_MS = 6000;', to: 'export const UNDO_MS = 0;', checks: ['take-delete-undo'] },
  { test: 'takes', what: 'deleting leaves the recording online', file: 'src/data/takes.ts',
    from: "    await supabase.storage.from('takes').remove([t.path]);", to: '', checks: ['take-delete-undo'] },
  { test: 'takes', what: 'Save shares the take with every coach', file: 'src/screens/SongScreen.tsx',
    from: 'void saveTake(toStored(rv, props.id, song.title));',
    to: 'void myCoaches().then((cs) => saveTake(toStored(rv, props.id, song.title), cs ?? []));',
    and: { file: 'src/screens/SongScreen.tsx', from: "import { saveTake, UNDO_MS, type StoredTake } from '../data/takes';", to: "import { myCoaches, saveTake, UNDO_MS, type StoredTake } from '../data/takes';" },
    checks: ['take-private'] },
  { test: 'takes', what: 'sending goes to nobody', file: 'src/screens/SendTake.tsx',
    from: '    const to = coaches.filter((x) => chosen.includes(x.id));', to: '    const to = coaches.filter((x) => chosen.includes(x.id) && false);', checks: ['take-send'] },
  { test: 'takes', what: 'a saved take is not kept online', file: 'src/data/takes.ts',
    from: '      if (!t.kept) {', to: '      if (false) {', checks: ['take-new-phone'] },
  { test: 'takes', what: 'an uploaded take loses its recording on the phone', file: 'src/data/takes.ts',
    from: "  const have = new Set<string | undefined>([...local.map((t) => t.path), ...local.map((t) => `${me}/${t.id}.wav`)]);",
    to: '  const have = new Set<string | undefined>(local.filter(() => false).map((t) => t.path));', checks: ['take-offline'] },
  { test: 'takes', what: 'sending a kept take uploads it again', file: 'src/data/takes.ts',
    from: '      if (!path && t.audio) {', to: '      if (t.audio) {', checks: ['take-send-kept'] },
  { test: 'takes', what: 'a take thrown away has no undo', file: 'src/screens/SongScreen.tsx',
    from: '    if (rv) setRemoved(rv.take);', to: '', checks: ['take-removed-undo'] },
  { test: 'takes', what: 'no line for a singer with no coach', file: 'src/screens/SendTake.tsx',
    from: '  else if (!coaches.length) body = <p className="line" id="no-coach">{copy.send.none}</p>;', to: '  else if (!coaches.length) body = null;',
    checks: ['take-no-coach'] },
  { test: 'takes', what: 'this app shares the old app\'s store again', file: 'src/data/db.ts',
    from: "export const DB = 'repertoire-app';", to: "export const DB = 'repertoire';", checks: ['apps-side-by-side'] },
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
    const suite = { song: 'tests/song.test.mjs', notemap: 'tests/notemap.test.mjs', takes: 'tests/takes.test.mjs', android: 'tests/android.test.mjs',
      library: 'tests/library.test.mjs' }[m.test] || 'tests/browser.test.mjs';
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
