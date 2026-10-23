import { describe, expect, it } from 'vitest';
import { PIANO, PIANO_C4, equalTempered, pianoFor, rateFor } from './piano';

describe('the reference piano', () => {
  it('puts the measured C4 sample exactly on C4', () => {
    expect(equalTempered(69)).toBe(440);
    expect(rateFor(PIANO_C4) * PIANO_C4.measuredHz).toBeCloseTo(261.6256, 3);
    /* the file is 1.8 cents flat, so it is played very slightly faster */
    expect(rateFor(PIANO_C4)).toBeCloseTo(1.00102, 5);
  });
});

describe('any note, on the nearest sample (Robert, 23 Oct)', () => {
  it('plays a shipped note on its own sample, exactly in tune', () => {
    const p = pianoFor(60);
    expect(p.file).toBe('../audio/piano/60.mp3');
    expect(p.rate * 261.359).toBeCloseTo(equalTempered(60), 6);
  });
  it('plays any other note on the nearest sample, retuned to it', () => {
    for (const m of [45, 46, 57, 61, 62, 69, 81]) {
      const p = pianoFor(m);
      const s = PIANO.find((x) => x.file === p.file) as (typeof PIANO)[number];
      expect(Math.abs(s.midi - m), String(m)).toBeLessThanOrEqual(2);
      expect(p.rate * s.measuredHz, String(m)).toBeCloseTo(equalTempered(m), 6);
    }
  });
});
