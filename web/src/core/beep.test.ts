import { describe, expect, it } from 'vitest';
import { BEEP_GAIN, BEEP_HZ, BEEP_RATE, BEEP_SECONDS, BEEP_URL, beepWav } from './beep';

/* The count-in beep (Robert, 24 Oct): short and soft, a sound file the
   engine loads like any other, so the conductor owns it. */
describe('the count-in beep', () => {
  it('is a short, soft sound file', () => {
    expect(BEEP_SECONDS).toBeLessThanOrEqual(0.12);
    expect(BEEP_GAIN).toBeLessThan(0.8);
    const w = beepWav();
    expect(String.fromCharCode(...w.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...w.subarray(8, 12))).toBe('WAVE');
    const v = new DataView(w.buffer);
    expect(v.getUint32(24, true)).toBe(BEEP_RATE);
    expect(v.getUint32(40, true)).toBe(2 * Math.round(BEEP_SECONDS * BEEP_RATE));
  });

  it('is a tone that starts and ends in silence (no click)', () => {
    const w = beepWav();
    const v = new DataView(w.buffer);
    const n = (w.length - 44) / 2;
    const s = (i: number) => v.getInt16(44 + 2 * i, true) / 32767;
    expect(Math.abs(s(0))).toBeLessThan(0.01);
    expect(Math.abs(s(n - 1))).toBeLessThan(0.01);
    /* its pitch: zero crossings over the middle */
    let crossings = 0;
    for (let i = Math.round(n * 0.25); i < Math.round(n * 0.75); i++) if ((s(i) >= 0) !== (s(i - 1) >= 0)) crossings++;
    const hz = (crossings / 2) / (0.5 * n / BEEP_RATE);
    expect(Math.abs(hz - BEEP_HZ)).toBeLessThan(40);
    expect(Math.max(...Array.from({ length: n }, (_, i) => Math.abs(s(i))))).toBeGreaterThan(0.9);
  });

  it('loads as an address, like a piano note', () => {
    expect(BEEP_URL.startsWith('data:audio/wav;base64,')).toBe(true);
    const b = Buffer.from(BEEP_URL.slice('data:audio/wav;base64,'.length), 'base64');
    expect(Buffer.compare(b, Buffer.from(beepWav()))).toBe(0);
  });
});
