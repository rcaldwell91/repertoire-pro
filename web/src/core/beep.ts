/* The count-in sound (Robert, 24 Oct): a short, soft beep on each of 3, 2,
   1, played by the conductor through the sound engine like every other
   sound. It is made here, in the app's own terms, as a tiny sound file the
   engine loads like a piano note: nothing to ship, nothing recorded. */

export const BEEP_HZ = 880;
export const BEEP_SECONDS = 0.08;
export const BEEP_RATE = 44100;
/** soft: well under the piano's 0.8 */
export const BEEP_GAIN = 0.35;

/** the beep as a 16-bit mono WAV, a sine faded in and out so it never clicks */
export function beepWav(): Uint8Array {
  const n = Math.round(BEEP_SECONDS * BEEP_RATE);
  const bytes = new Uint8Array(44 + 2 * n);
  const v = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + 2 * n, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);          /* PCM */
  v.setUint16(22, 1, true);          /* mono */
  v.setUint32(24, BEEP_RATE, true);
  v.setUint32(28, BEEP_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, 2 * n, true);
  const fade = Math.round(0.008 * BEEP_RATE);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fade, (n - 1 - i) / fade);
    const s = Math.sin((2 * Math.PI * BEEP_HZ * i) / BEEP_RATE) * env;
    v.setInt16(44 + 2 * i, Math.round(s * 32767), true);
  }
  return bytes;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const x = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[x >> 18] + B64[(x >> 12) & 63] + (i + 1 < b.length ? B64[(x >> 6) & 63] : '=') + (i + 2 < b.length ? B64[x & 63] : '=');
  }
  return out;
}

/** the beep as an address the engine can load */
export const BEEP_URL = 'data:audio/wav;base64,' + base64(beepWav());
