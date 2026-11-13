import type { Plan } from '../audio/conductor/conductor';
import { equalTempered } from '../core/piano';
import { PIANO_GAIN } from './piano-step';

/* Match the tone's plain tone (Robert, 4 Nov): made by the phone itself, a
   pure wave written into a small sound file in memory, so no sound file is
   kept in the repo and the player plays it exactly as it plays a piano note.
   Its level is the piano's: the reference notes average -16 dB over their
   first second and a half (measured from the sample files), and so does
   this. A soft start and end, so it never clicks. */
export const TONE_RATE = 48000;
export const TONE_RMS_DB = -16;
const FADE = 0.03;

/** the samples of a plain tone: `secs` long, at note `m` */
export function toneSamples(m: number, secs: number, rate = TONE_RATE): Float32Array {
  const n = Math.round(secs * rate), f = equalTempered(m);
  const amp = Math.pow(10, TONE_RMS_DB / 20) * Math.SQRT2;
  const out = new Float32Array(n);
  const fade = Math.round(FADE * rate);
  for (let i = 0; i < n; i++) {
    const edge = Math.min(1, i / fade, (n - 1 - i) / fade);
    out[i] = amp * edge * Math.sin((2 * Math.PI * f * i) / rate);
  }
  return out;
}

/** the samples as a 16-bit sound file */
export function wav(samples: Float32Array, rate = TONE_RATE): Uint8Array {
  const b = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o: number, s: string) => [...s].forEach((ch, i) => b.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  b.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  b.setUint32(16, 16, true);
  b.setUint16(20, 1, true);
  b.setUint16(22, 1, true);
  b.setUint32(24, rate, true);
  b.setUint32(28, rate * 2, true);
  b.setUint16(32, 2, true);
  b.setUint16(34, 16, true);
  str(36, 'data');
  b.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Uint8Array(b.buffer);
}

const made = new Map<string, string>();
/** the tone as a step the conductor plays, listening while it does */
export function toneStep(m: number, secs: number, opts: { listen?: boolean; monitor?: number } = {}): Plan['steps'][number] {
  const key = m + ':' + secs;
  let url = made.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([wav(toneSamples(m, secs)) as BlobPart], { type: 'audio/wav' }));
    made.set(key, url);
  }
  return { kind: 'song', urls: [url], from: 0, gains: [PIANO_GAIN], starts: [0], rates: [1], lengths: [secs], untilLast: true,
    listen: !!opts.listen, record: false, level: 1, monitor: opts.monitor ?? 0 };
}
