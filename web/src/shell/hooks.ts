import { useEffect, useState, useSyncExternalStore } from 'react';
import { onUser, user, type User } from '../data/auth';
import { getSong, listSongs, onSongs, type Song } from '../data/songs';
import { onSplit, splitPhase } from '../data/split';
import type { SplitPhase } from '../core/song';
import { onTheme, themeChoice, type ThemeChoice } from './theme';
import { onSingerLine, singerLine, type SingerLine } from './singer-line';
import { onTakes, takesFor, type StoredTake } from '../data/takes';

/* What screens watch: the signed-in person, the songs on the phone, and
   splits under way. */

export function useUser(): User | null {
  return useSyncExternalStore(onUser, user);
}

export function useTheme(): ThemeChoice {
  return useSyncExternalStore(onTheme, themeChoice);
}

export function useSongs(): Song[] | null {
  const [songs, setSongs] = useState<Song[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void listSongs().then((s) => live && setSongs(s), () => live && setSongs([]));
    load();
    const off = onSongs(load);
    return () => {
      live = false;
      off();
    };
  }, []);
  return songs;
}

/** undefined while loading; null if there is no such song */
export function useSong(id: string): Song | null | undefined {
  const [song, setSong] = useState<Song | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const load = () => void getSong(id).then((s) => live && setSong(s ?? null), () => live && setSong(null));
    load();
    const off = onSongs(load);
    return () => {
      live = false;
      off();
    };
  }, [id]);
  return song;
}

export function useSplit(id: string): SplitPhase | null {
  return useSyncExternalStore(
    (fn) => onSplit((changed) => changed === id && fn()),
    () => splitPhase(id),
  );
}

/** The singer's line for a song, as far as it has been read. */
export function useSingerLine(id: string): SingerLine | null {
  return useSyncExternalStore(
    (fn) => onSingerLine((changed) => changed === id && fn()),
    () => singerLine(id),
  );
}

/** The takes kept for a song, newest first; null while loading. */
export function useTakes(songId: string): StoredTake[] | null {
  const [takes, setTakes] = useState<StoredTake[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void takesFor(songId).then((t) => live && setTakes(t), () => live && setTakes([]));
    load();
    const off = onTakes(load);
    return () => {
      live = false;
      off();
    };
  }, [songId]);
  return takes;
}
