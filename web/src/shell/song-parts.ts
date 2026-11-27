import { useEffect, useMemo, useState } from 'react';
import { FIRST_SECONDS } from '../core/limits';
import { hasOf, keepLevel, type Song } from '../data/songs';
import type { Conductor } from '../audio/conductor/conductor';

/* A song's voice and music, ready for the conductor, for the screens that
   play a line of it (Practise a line; Speak it, then sing it): the whole
   song once it is split, else its first 30 seconds; as addresses made once
   and given back when the screen is done with them; and the song's level,
   as kept with it or measured the first time it plays (then kept), as on
   Learn a song. */
export interface SongParts {
  readonly which: 'full' | 'first30';
  readonly urls: readonly string[];
  /** how long the part that plays is, in seconds */
  readonly total: number;
  readonly level: number | undefined;
  readonly onLevel: (lv: number) => void;
}

export function useSongParts(c: Conductor, id: string, song: Song | null | undefined): SongParts | null {
  const has = song ? hasOf(song) : null;
  const which: 'full' | 'first30' | null = has?.full ? 'full' : has?.first30 ? 'first30' : null;
  const a1 = which === 'full' ? song?.voice : song?.voice30;
  const a2 = which === 'full' ? song?.music : song?.music30;
  const urls = useMemo(() => (which && a1 && a2 ? [URL.createObjectURL(a1), URL.createObjectURL(a2)] : null), [which, a1, a2]);
  useEffect(() => {
    if (!urls) return;
    return () => {
      c.forget(urls);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [urls, c]);
  const [measured, setMeasured] = useState<Partial<Record<'full' | 'first30', number>>>({});
  if (!which || !urls || !song) return null;
  return {
    which,
    urls,
    total: which === 'first30' ? FIRST_SECONDS : song.seconds ?? 0,
    level: song.level?.[which] ?? measured[which],
    onLevel: (lv: number) => {
      setMeasured((m) => ({ ...m, [which]: lv }));
      void keepLevel(id, which, lv);
    },
  };
}
