import { useEffect, useState, useSyncExternalStore } from 'react';
import { onUser, user, type User } from '../data/auth';
import { getSong, listSongs, onSongs, type Song } from '../data/songs';
import { onSplit, splitPhase } from '../data/split';
import type { SplitPhase } from '../core/song';
import { onTheme, themeChoice, type ThemeChoice } from './theme';

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
