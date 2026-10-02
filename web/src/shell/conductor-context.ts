import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Conductor, Snapshot } from '../audio/conductor/conductor';

/* Screens reach sound only through this: the conductor, never the engine. */
export const ConductorContext = createContext<Conductor | null>(null);

export function useConductor(): Conductor {
  const c = useContext(ConductorContext);
  if (!c) throw new Error('no conductor');
  return c;
}

export function useSnapshot(): Snapshot {
  const c = useConductor();
  return useSyncExternalStore(
    (fn) => c.subscribe(fn),
    () => c.snapshot(),
  );
}
