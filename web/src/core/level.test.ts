import { describe, expect, it } from 'vitest';
import { barFill } from './level';

describe('the voice bar', () => {
  it('is empty in silence and full at the top', () => {
    expect(barFill(0)).toBe(0);
    expect(barFill(Number.NaN)).toBe(0);
    expect(barFill(0.0005)).toBe(0);
    expect(barFill(1)).toBe(1);
    expect(barFill(4)).toBe(1);
  });
  it('puts a speaking voice in the middle', () => {
    /* -20 dB, a typical voice into a phone mic */
    expect(barFill(0.1)).toBeCloseTo(2 / 3, 5);
  });
});
