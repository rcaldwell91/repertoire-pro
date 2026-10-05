import { HOP, LINE_VER } from '../audio/pitch/core';
import { bridgeLine } from '../audio/pitch/line';
import { readLine, warmPitch } from '../audio/pitch/client';
import { decodeMono } from '../audio/decode';
import { getLine, putLine, type StoredLine } from '../data/lines';
import { getSong } from '../data/songs';
import { WIN } from '../audio/pitch/core';
import { pinnedRange, type Range } from '../core/notemap';

/* The singer's line: read from the separated voice FILE, never from what
   is playing, so it is there whatever the Voice slider says. Read in the
   pitch worker as soon as the first 30 seconds arrive, carried on when the
   whole voice comes, and kept on the phone with the way it was read, so
   reopening a song never reads it again (RULEBOOK 4, Files and Pitch). */

export interface SingerLine {
  readonly hop: number;
  /** a note every hop seconds; NaN where nobody sings or not read yet */
  readonly m: Float32Array;
  /** seconds read so far, and the song's length */
  readonly readTo: number;
  readonly seconds: number;
  /** still reading */
  readonly reading: boolean;
  /** the view: the song's own range, pinned (RULEBOOK 4, Pitch). Worked
      out from the line once it is settled - the first 30 seconds, then the
      whole song - never from where the song has got to. */
  readonly range: Range | null;
}

const lines = new Map<string, SingerLine>();
const running = new Map<string, Promise<void>>();
const again = new Set<string>();
const listeners = new Set<(id: string) => void>();

export function singerLine(id: string): SingerLine | null {
  return lines.get(id) ?? null;
}

export function onSingerLine(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function show(id: string, next: Omit<SingerLine, 'range'>): void {
  const was = lines.get(id)?.range ?? null;
  const l: SingerLine = { ...next, range: next.reading ? was : pinnedRange(next.m) ?? was };
  lines.set(id, l);
  listeners.forEach((f) => f(id));
}

/** Make sure the song's line is read as far as its voice allows. Safe to
    call as often as anything changes. */
export function readSingerLine(id: string): void {
  if (running.has(id)) {
    again.add(id);
    return;
  }
  const job = run(id)
    .catch(() => {
      const l = lines.get(id);
      if (l) show(id, { ...l, reading: false });
    })
    .finally(() => {
      running.delete(id);
      if (again.delete(id)) readSingerLine(id);
    });
  running.set(id, job);
}

/* the last points a part of the voice can give for certain: the window
   centred on a point must lie inside it, and two more points after */
function certainPoints(samples: number, sr: number, whole: boolean): number {
  const n = Math.floor(samples / sr / HOP);
  return whole ? n : Math.max(0, n - Math.ceil(WIN / 2 / sr / HOP) - 2);
}

async function run(id: string): Promise<void> {
  const song = await getSong(id);
  if (!song) return;
  let stored = await getLine(id);
  if (stored && stored.ver !== LINE_VER) stored = undefined;
  const whole = !!song.voice;
  const voice = song.voice ?? song.voice30;
  if (stored) {
    show(id, { hop: stored.hop, m: stored.m, readTo: stored.readTo, seconds: stored.seconds, reading: false });
    /* nothing more to read: it has everything this song's voice can give */
    if (stored.anchored && stored.done && (stored.whole || !whole)) return;
  }
  if (!voice) return;
  warmPitch();
  /* reading starts now: say so while the voice is unpacked */
  const was = lines.get(id);
  show(id, { hop: HOP, m: was?.m ?? new Float32Array(0), readTo: was?.readTo ?? 0, seconds: Math.max(song.seconds ?? 0, was?.seconds ?? 0), reading: true });
  const { mono, sr } = await decodeMono(voice);
  const seconds = whole ? mono.length / sr : Math.max(song.seconds ?? 0, mono.length / sr);
  const m = new Float32Array(Math.floor(seconds / HOP)).fill(NaN);
  let fromK = 0;
  if (stored && stored.anchored) {
    /* carry on from where it stopped: the end of the first 30 seconds, or
       wherever reading was cut short */
    fromK = Math.round(stored.readTo / HOP);
    m.set(stored.m.subarray(0, Math.min(fromK, m.length)));
  }
  const certain = certainPoints(mono.length, sr, whole);
  let readK = fromK;
  let savedAt = fromK;
  const save = (anchored: boolean, done: boolean) => {
    const line: StoredLine = { id, ver: LINE_VER, hop: HOP, m: m.slice(), readTo: readK * HOP, seconds, whole, done, anchored };
    return putLine(line);
  };
  show(id, { hop: HOP, m, readTo: readK * HOP, seconds, reading: true });
  await new Promise<void>((resolve, reject) => {
    readLine(mono, sr, fromK, (p) => {
      try {
        const upTo = Math.min(p.from + p.m.length, certain, m.length);
        if (upTo > p.from) m.set(p.m.subarray(0, upTo - p.from), p.from);
        readK = Math.max(readK, upTo);
        bridgeLine(m, readK);
        show(id, { hop: HOP, m, readTo: readK * HOP, seconds, reading: !p.done });
        /* kept on the phone as it goes, every 8 seconds of song, and at the end */
        if (p.done || readK - savedAt >= 8 / HOP) {
          savedAt = readK;
          void save(p.anchored, p.done).then(() => p.done && resolve(), reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  });
}
