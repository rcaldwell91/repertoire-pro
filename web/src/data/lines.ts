import { inStore } from './db';

/* The singer's line for each song, kept on the phone so reopening a song
   never reads it again. `ver` names the way it was read: a line read an
   older way is read again (RULEBOOK 4, Pitch: "version stored traces"). */
export interface StoredLine {
  readonly id: string;
  readonly ver: number;
  readonly hop: number;
  /** a note every hop seconds; NaN where nobody sings */
  readonly m: Float32Array;
  /** seconds read so far, and the song's length */
  readonly readTo: number;
  readonly seconds: number;
  /** read from the whole voice, not just its first 30 seconds */
  readonly whole: boolean;
  /** all of that voice has been read */
  readonly done: boolean;
  /** read with the octave anchor (false if its model could not be fetched) */
  readonly anchored: boolean;
}

export function getLine(id: string): Promise<StoredLine | undefined> {
  return inStore<StoredLine | undefined>('lines', 'readonly', (s) => s.get(id) as IDBRequest<StoredLine | undefined>);
}

export function putLine(line: StoredLine): Promise<unknown> {
  return inStore('lines', 'readwrite', (s) => s.put(line));
}
