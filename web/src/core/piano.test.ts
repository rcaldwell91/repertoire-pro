import { describe, expect, it } from 'vitest';
import { PIANO_C4, equalTempered, rateFor } from './piano';

describe('the reference piano', () => {
  it('puts the measured C4 sample exactly on C4', () => {
    expect(equalTempered(69)).toBe(440);
    expect(rateFor(PIANO_C4) * PIANO_C4.measuredHz).toBeCloseTo(261.6256, 3);
    /* the file is 1.8 cents flat, so it is played very slightly faster */
    expect(rateFor(PIANO_C4)).toBeCloseTo(1.00102, 5);
  });
});
