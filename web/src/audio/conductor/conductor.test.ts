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
