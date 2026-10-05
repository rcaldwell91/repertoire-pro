import { describe, expect, it, beforeEach } from 'vitest';
import { Conductor, MIC_KEY, TOKEN_LIFE_MS, type LeaveReason, type Plan } from './conductor';
import { FakeEngine, FakeEnv, MemoryStore } from '../engine-fake/fake-engine';

/* Every rule of the conductor (RULEBOOK 2.1), on the fake engine.
   scripts/mutate-conductor.mjs breaks each rule in turn and checks that at
   least one of these tests then fails - a test that cannot fail proves
   nothing. */

const NOTE = 'piano/60.mp3';
const tap = { isTrusted: true, type: 'click' };
const soundCheck: Plan = { owner: 'sound-check', steps: [{ kind: 'note', url: NOTE }, { kind: 'listen' }] };
const noteOnly: Plan = { owner: 'note', steps: [{ kind: 'note', url: NOTE }] };
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

let engine: FakeEngine, env: FakeEnv, store: MemoryStore, c: Conductor;
beforeEach(() => {
  engine = new FakeEngine();
  env = new FakeEnv();
  store = new MemoryStore();
  c = new Conductor(engine, env, store);
});

/** silence and the mic closed */
const silentAndClosed = () => engine.sounding() === 0 && !engine.micOpen();

describe('nothing starts without a tap', () => {
  it('is idle, silent and not listening before anything is pressed', async () => {
    await flush();
    expect(c.snapshot().state).toBe('idle');
    expect(engine.log).toEqual([]);
    expect(silentAndClosed()).toBe(true);
  });

  it('refuses to start with no token, and touches nothing', async () => {
    expect(c.start(null, soundCheck)).toBe(false);
    await flush();
    expect(c.snapshot().state).toBe('idle');
    expect(engine.log).toEqual([]);
  });

  it('makes no token from a press the browser did not see a person make', () => {
    expect(c.tap({ isTrusted: false, type: 'click' })).toBeNull();
    expect(c.tap({ isTrusted: true, type: 'mousemove' })).toBeNull();
  });

  it('refuses a token that was not made by its own tap', async () => {
    const other = new Conductor(new FakeEngine(), new FakeEnv(), new MemoryStore());
    const foreign = other.tap(tap);
    expect(c.start(foreign, soundCheck)).toBe(false);
    expect(c.start({} as never, soundCheck)).toBe(false);
    await flush();
    expect(engine.log).toEqual([]);
  });

  it('uses a token once only', async () => {
    const t = c.tap(tap);
    expect(c.start(t, noteOnly)).toBe(true);
    await flush();
    engine.endNotes();
    await flush();
    expect(c.snapshot().state).toBe('finished');
    const plays = engine.log.filter((l) => l.startsWith('play:')).length;
    expect(c.start(t, noteOnly)).toBe(false);
    await flush();
    expect(engine.log.filter((l) => l.startsWith('play:')).length).toBe(plays);
  });

  it('will not start from a tap more than a second old', async () => {
    const t = c.tap(tap);
    env.ms += TOKEN_LIFE_MS + 1;
    expect(c.start(t, soundCheck)).toBe(false);
    await flush();
    expect(engine.log).toEqual([]);
  });

  it('will not start while the app is hidden', async () => {
    env.isHidden = true;
    expect(c.start(c.tap(tap), soundCheck)).toBe(false);
    await flush();
    expect(engine.log).toEqual([]);
  });
});

describe('a tap starts it, in order', () => {
  it('goes armed, then running: plays the note, then listens', async () => {
    const seen: string[] = [];
    c.subscribe((s) => seen.push(s.state));
    expect(c.start(c.tap(tap), soundCheck)).toBe(true);
    expect(engine.unlocks).toBe(1);                 /* unlocked inside the tap */
    expect(c.snapshot().state).toBe('armed');
    await flush();
    expect(c.snapshot().state).toBe('running');
    expect(engine.sounding()).toBe(1);
    expect(engine.micOpen()).toBe(false);           /* the note first */
    engine.endNotes();
    await flush();
    expect(engine.micOpen()).toBe(true);
    expect(c.snapshot().mic).toBe('open');
    expect(c.level()).toBe(engine.level);
    expect(seen[0]).toBe('armed');
    expect(seen).toContain('running');
  });

  it('counts in before running when the plan asks for it', async () => {
    c.start(c.tap(tap), { ...noteOnly, countIn: 2 });
    await flush();
    expect(c.snapshot().state).toBe('counting-in');
    expect(engine.sounding()).toBe(0);
    env.endWaits();
    await flush();
    expect(c.snapshot().state).toBe('running');
    expect(engine.sounding()).toBe(1);
  });
});

describe('one source at a time', () => {
  it('stops what was going before starting something else', async () => {
    c.start(c.tap(tap), noteOnly);
    await flush();
    expect(engine.sounding()).toBe(1);
    c.start(c.tap(tap), { owner: 'other', steps: [{ kind: 'note', url: NOTE }] });
    await flush();
    expect(engine.sounding()).toBe(1);
    expect(engine.peak).toBe(1);
    expect(c.snapshot().owner).toBe('other');
  });

  it('ignores a repeat press on what is already going', async () => {
    c.start(c.tap(tap), noteOnly);
    await flush();
    expect(c.start(c.tap(tap), noteOnly)).toBe(false);
    await flush();
    expect(engine.log.filter((l) => l.startsWith('play:')).length).toBe(1);
    expect(engine.peak).toBe(1);
  });

  it('a session that was replaced never reaches its mic', async () => {
    c.start(c.tap(tap), soundCheck);
    await flush();
    c.start(c.tap(tap), noteOnly);
    await flush();
    engine.endNotes();
    await flush();
    expect(engine.log.some((l) => l.startsWith('openMic'))).toBe(false);
    expect(engine.micOpen()).toBe(false);
  });
});

describe('leaving means silence and the mic closed', () => {
  const reasons: LeaveReason[] = ['screen', 'tab', 'back', 'hidden', 'interrupted'];
  for (const why of reasons) {
    it(`while the note plays: ${why}`, async () => {
      c.start(c.tap(tap), soundCheck);
      await flush();
      expect(engine.sounding()).toBe(1);
      c.leave(why);
      expect(silentAndClosed()).toBe(true);
      expect(c.snapshot().state).toBe('stopped');
      expect(c.snapshot().why).toBe(why);
    });
    it(`while listening: ${why}`, async () => {
      c.start(c.tap(tap), soundCheck);
      await flush();
      engine.endNotes();
      await flush();
      expect(engine.micOpen()).toBe(true);
      c.leave(why);
      expect(silentAndClosed()).toBe(true);
      expect(c.snapshot().state).toBe('stopped');
      expect(c.snapshot().mic).toBe('closed');
      expect(c.level()).toBe(0);
    });
  }

  it('hiding the app stops it by itself', async () => {
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.endNotes();
    await flush();
    env.hide();
    expect(silentAndClosed()).toBe(true);
    expect(c.snapshot().why).toBe('hidden');
  });

  it('a call or interruption stops it by itself', async () => {
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.interrupt();
    expect(silentAndClosed()).toBe(true);
    expect(c.snapshot().why).toBe('interrupted');
  });

  it('Stop ends it the same way', async () => {
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.endNotes();
    await flush();
    c.stop();
    expect(silentAndClosed()).toBe(true);
    expect(c.snapshot().state).toBe('stopped');
  });
});

describe('nothing resumes by itself', () => {
  it('coming back, and everything that was waiting finishing, starts nothing', async () => {
    c.start(c.tap(tap), soundCheck);
    await flush();
    env.hide();
    const after = engine.log.length;
    env.show();
    engine.endNotes();
    env.endWaits();
    engine.finishLoads();
    await flush();
    expect(engine.log.slice(after).filter((l) => l.startsWith('play:') || l.startsWith('openMic'))).toEqual([]);
    expect(c.snapshot().state).toBe('stopped');
    expect(silentAndClosed()).toBe(true);
  });

  it('a sample that finishes loading after leaving is never played', async () => {
    engine.holdLoads = true;
    c.start(c.tap(tap), soundCheck);
    await flush();
    c.leave('tab');
    engine.finishLoads();
    await flush();
    expect(engine.log.some((l) => l.startsWith('play:'))).toBe(false);
    expect(silentAndClosed()).toBe(true);
  });

  it('a count-in that ends after leaving plays nothing', async () => {
    c.start(c.tap(tap), { ...noteOnly, countIn: 2 });
    await flush();
    c.leave('back');
    env.endWaits();
    await flush();
    expect(engine.log.some((l) => l.startsWith('play:'))).toBe(false);
  });

  it('a mic that opens after leaving is closed again at once', async () => {
    engine.holdMic = true;
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.endNotes();
    await flush();
    expect(c.snapshot().mic).toBe('opening');
    c.leave('hidden');
    engine.answerMic();
    await flush();
    expect(engine.micOpen()).toBe(false);
    expect(c.snapshot().state).toBe('stopped');
  });
});

describe('finished releases everything', () => {
  it('a plan that ends lets go of the sound and the mic', async () => {
    c.start(c.tap(tap), noteOnly);
    await flush();
    const before = engine.releases;
    engine.endNotes();
    await flush();
    expect(c.snapshot().state).toBe('finished');
    expect(engine.releases).toBeGreaterThan(before);
    expect(silentAndClosed()).toBe(true);
  });
});

describe('the mic ladder', () => {
  it('moves down the ladder past a set that fails, and remembers the one that worked', async () => {
    engine.micPlan = ['busy', 'ok', 'ok'];
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.endNotes();
    await flush();
    expect(engine.micOpen()).toBe(true);
    expect(store.get(MIC_KEY)).toBe('1');
    c.stop();
    engine.log.length = 0;
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.endNotes();
    await flush();
    expect(engine.log).toContain('openMic:1,0,2');   /* what worked, first */
  });

  it('a refusal stops the ladder, says so, and the note still plays', async () => {
    engine.micPlan = ['refused', 'ok', 'ok'];
    c.start(c.tap(tap), soundCheck);
    await flush();
    expect(engine.sounding()).toBe(1);               /* the note */
    engine.endNotes();
    await flush();
    expect(engine.log.filter((l) => l.startsWith('try:'))).toEqual(['try:0']);
    expect(c.snapshot().mic).toBe('refused');
    expect(c.snapshot().state).toBe('finished');
    expect(silentAndClosed()).toBe(true);
    /* and Start plays the note again, without the mic */
    expect(c.start(c.tap(tap), soundCheck)).toBe(true);
    await flush();
    expect(engine.sounding()).toBe(1);
  });
});

describe('a song: voice and music together', () => {
  const song = (over: Partial<{ from: number; gains: number[]; loop: { start: number; end: number } }> = {}): Plan => ({
    owner: 'song:1',
    steps: [{ kind: 'song', urls: ['voice', 'music'], from: over.from ?? 0, gains: over.gains ?? [1, 1], loop: over.loop }],
  });

  it('plays nothing until a tap, then starts both parts together, from where it is told', async () => {
    expect(c.start(null, song())).toBe(false);
    await flush();
    expect(engine.log).toEqual([]);
    expect(c.start(c.tap(tap), song({ from: 42 }))).toBe(true);
    await flush();
    expect(engine.log).toContain('together:voice+music@42');
    expect(engine.log.filter((l) => l.startsWith('play:'))).toEqual([]);
    expect(c.snapshot().state).toBe('running');
  });

  it('changes each part on its own while it plays', async () => {
    c.start(c.tap(tap), song({ gains: [1, 1] }));
    await flush();
    c.setGain(0, 0.25);
    expect(engine.song?.gains).toEqual([0.25, 1]);
    c.setGain(1, 0.5);
    expect(engine.song?.gains).toEqual([0.25, 0.5]);
  });

  it('knows where the song is, on the one clock, and wraps a repeated part', async () => {
    c.start(c.tap(tap), song({ from: 10 }));
    await flush();
    engine.clock = 3.5;
    expect(c.position()).toBeCloseTo(13.5);
    c.stop();
    expect(c.position()).toBeNull();
    engine.clock = 0;
    c.start(c.tap(tap), song({ from: 20, loop: { start: 20, end: 30 } }));
    await flush();
    engine.clock = 12;
    expect(c.position()).toBeCloseTo(22);
  });

  it.each(['screen', 'tab', 'back', 'hidden', 'interrupted'] as LeaveReason[])('falls silent on leaving (%s)', async (why) => {
    c.start(c.tap(tap), song());
    await flush();
    expect(engine.sounding()).toBe(1);
    if (why === 'hidden') env.hide();
    else if (why === 'interrupted') engine.interrupt();
    else c.leave(why);
    expect(silentAndClosed()).toBe(true);
    expect(c.snapshot().state).toBe('stopped');
    expect(c.position()).toBeNull();
  });

  it('finishes, and lets everything go, when the song ends', async () => {
    c.start(c.tap(tap), song());
    await flush();
    engine.endNotes();
    await flush();
    expect(c.snapshot().state).toBe('finished');
    expect(silentAndClosed()).toBe(true);
  });

  it('is one source: a note started over it stops the song', async () => {
    c.start(c.tap(tap), song());
    await flush();
    c.start(c.tap(tap), noteOnly);
    await flush();
    expect(engine.peak).toBe(1);
  });

  it('gives a song\'s memory back when the screen is done with it', () => {
    c.forget(['voice', 'music']);
    expect(engine.forgotten).toEqual(['voice', 'music']);
  });
});

describe('a song that loads after it was left', () => {
  it('never plays, and stops loading', async () => {
    engine.holdLoads = true;
    c.start(c.tap(tap), { owner: 'song:2', steps: [{ kind: 'song', urls: ['v', 'm'], from: 0, gains: [1, 1] }] });
    await flush();
    c.leave('screen');
    engine.finishLoads();
    await flush();
    engine.finishLoads();
    await flush();
    expect(engine.log.some((l) => l.startsWith('together:'))).toBe(false);
    expect(engine.log).toContain('load:v');
    expect(engine.log).not.toContain('load:m');      /* nothing more is fetched for it */
    expect(silentAndClosed()).toBe(true);
  });
});

describe('a song you sing along to', () => {
  const sing = (monitor = 0): Plan => ({
    owner: 'song:3',
    steps: [{ kind: 'song', urls: ['voice', 'music'], from: 5, gains: [1, 1], listen: true, monitor }],
  });
  const block = (end: number) => ({ samples: new Float32Array(4), end, sampleRate: 48000 });

  it('plays the song at once and opens the mic alongside; the song never waits for it', async () => {
    engine.holdMic = true;
    c.start(c.tap(tap), sing());
    await flush();
    expect(engine.log).toContain('together:voice+music@5');
    expect(c.snapshot().mic).toBe('opening');
    engine.answerMic();
    await flush();
    expect(c.snapshot().mic).toBe('open');
    expect(engine.micOpen()).toBe(true);
    expect(c.snapshot().state).toBe('running');
  });

  it('a refused mic leaves the song playing, and says so', async () => {
    engine.micPlan = ['refused'];
    c.start(c.tap(tap), sing());
    await flush();
    expect(c.snapshot().mic).toBe('refused');
    expect(c.snapshot().state).toBe('running');
    expect(engine.sounding()).toBe(1);
  });

  it('hands on what the mic hears only while listening, and nothing after leaving', async () => {
    const heard: number[] = [];
    c.onMic((b) => heard.push(b.end));
    c.start(c.tap(tap), sing());
    await flush();
    engine.hear(block(1));
    c.leave('screen');
    engine.hear(block(2));
    expect(heard).toEqual([1]);
    expect(silentAndClosed()).toBe(true);
    engine.hear(block(3));                        /* even if the device still sends something */
    expect(heard).toEqual([1]);
  });

  it('dates what is heard in the song, taking the speaker\'s delay off the song', async () => {
    engine.latency = 0.12;
    c.start(c.tap(tap), sing());
    await flush();
    /* the song left at engine time 0 from 5 s in; heard 0.12 s later */
    expect(c.songTime(1.12)).toBeCloseTo(6);
    engine.clock = 2.12;
    expect(c.position()).toBeCloseTo(7);
  });

  it('a plain song does not ask for the mic', async () => {
    c.start(c.tap(tap), { owner: 'song:4', steps: [{ kind: 'song', urls: ['voice', 'music'], from: 0, gains: [1, 1] }] });
    await flush();
    expect(engine.log.some((l) => l.startsWith('openMic'))).toBe(false);
    expect(c.snapshot().mic).toBe('closed');
  });

  it('"Hear yourself" never sounds on a screen that only listens (the sound check)', async () => {
    c.start(c.tap(tap), soundCheck);
    await flush();
    engine.endNotes();
    await flush();
    expect(c.snapshot().mic).toBe('open');
    c.setMonitor(0.9);
    expect(engine.monitorGain).toBe(0);
  });

  it('"Hear yourself" sounds only while singing, and stops with everything else', async () => {
    c.setMonitor(0.5);
    expect(engine.monitorGain).toBe(0);
    c.start(c.tap(tap), sing(0.7));
    await flush();
    expect(engine.monitorGain).toBe(0.7);
    c.setMonitor(0.3);
    expect(engine.monitorGain).toBe(0.3);
    c.leave('hidden');
    expect(engine.monitorGain).toBe(0);
    c.setMonitor(0.9);
    expect(engine.monitorGain).toBe(0);
  });
});

describe('recording a take', () => {
  const sing = (over: Partial<{ record: boolean; loop: { start: number; end: number } }> = {}): Plan => ({
    owner: 'song:5',
    steps: [{ kind: 'song', urls: ['voice', 'music'], from: 10, gains: [1, 1], listen: true, record: over.record ?? true, loop: over.loop }],
  });
  /* a second of what the mic heard, ending at engine time `end` */
  const second = (end: number) => ({ samples: new Float32Array(48000).fill(0.1), end, sampleRate: 48000 });

  it('keeps what the mic hears, from where in the song it was heard, and ends with the session', async () => {
    engine.latency = 0.1;
    c.start(c.tap(tap), sing());
    await flush();
    engine.hear(second(1.6));             /* its first sample reached the mic at 0.6: the song at 10.5 */
    engine.hear(second(2.6));
    expect(c.take('song:5')).toBeNull();  /* still being made */
    c.leave('hidden');
    const t = c.take('song:5');
    expect(t).not.toBeNull();
    expect(t!.songAt).toBeCloseTo(10.5, 4);
    expect(t!.seconds).toBeGreaterThan(1.9);
    expect(t!.seconds).toBeLessThan(2.01);
    expect(c.snapshot().takes).toBe(1);
  });

  it('keeps nothing heard before the song, or after it ends', async () => {
    c.start(c.tap(tap), sing());
    await flush();
    engine.hear(second(-0.5));            /* before the song began */
    c.stop();
    engine.hear(second(3));
    expect(c.take('song:5')).toBeNull();
  });

  it('records only when asked, and not while a part repeats', async () => {
    c.start(c.tap(tap), sing({ record: false }));
    await flush();
    engine.hear(second(1.5));
    c.stop();
    expect(c.take('song:5')).toBeNull();
    c.start(c.tap(tap), sing({ loop: { start: 10, end: 20 } }));
    await flush();
    engine.hear(second(1.5));
    c.stop();
    expect(c.take('song:5')).toBeNull();
  });

  it('gives a take only to its own screen, until it is dropped', async () => {
    c.start(c.tap(tap), sing());
    await flush();
    engine.hear(second(1.5));
    c.stop();
    expect(c.take('song:other')).toBeNull();
    expect(c.take('song:5')).not.toBeNull();
    c.dropTake();
    expect(c.take('song:5')).toBeNull();
  });
});
