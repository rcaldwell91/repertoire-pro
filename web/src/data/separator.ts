import { SEPARATOR_URL } from './config';
import type { Problem } from '../core/song';

/* The voice/music splitter (services/separator). Every call carries the
   person's sign-in. Nothing is kept there: each part can be fetched once. */

export type Part = 'voice' | 'music' | 'voice30' | 'music30';

export interface JobStatus {
  readonly stage: 'waiting' | 'reading' | 'separating' | 'saving' | 'done' | 'failed' | 'cancelled';
  readonly progress: number;
  readonly ready_s: number;
  readonly seconds: number | null;
  readonly first30_ready: boolean;
  readonly ready: Part[];
  readonly error?: string;
}

export class SplitError extends Error {
  constructor(readonly problem: Problem) {
    super(problem);
  }
}

function problemFor(status: number, error: string | undefined): Problem {
  if (status === 401) return 'signed-out';
  if (status === 413) return error === 'too long' ? 'too-long' : 'too-big';
  if (status === 415) return 'not-audio';
  if (status === 429) return 'one-at-a-time';
  if (status === 503) return 'busy';
  if (status === 404 || status === 410) return 'expired';
  return 'failed';
}

function errorOf(text: string): string | undefined {
  try {
    return (JSON.parse(text) as { error?: string }).error;
  } catch {
    return undefined;
  }
}

/** Send the song; onProgress gets the real fraction sent, 0 to 1. */
export function upload(file: Blob, token: string, onProgress: (f: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', SEPARATOR_URL + '/jobs');
    x.setRequestHeader('Authorization', 'Bearer ' + token);
    x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    x.onload = () => {
      if (x.status === 202) {
        onProgress(1);
        resolve((JSON.parse(x.responseText) as { job: string }).job);
      } else reject(new SplitError(problemFor(x.status, errorOf(x.responseText))));
    };
    x.onerror = () => reject(new SplitError('offline'));
    x.ontimeout = () => reject(new SplitError('offline'));
    x.send(file);
  });
}

async function call(path: string, token: string, method = 'GET'): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(SEPARATOR_URL + path, { method, headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  } catch {
    throw new SplitError('offline');
  }
  if (!r.ok) throw new SplitError(problemFor(r.status, errorOf(await r.text())));
  return r;
}

export async function status(job: string, token: string): Promise<JobStatus> {
  return (await (await call('/jobs/' + job, token)).json()) as JobStatus;
}

/** Collect one part. It is deleted from the server as it is handed over. */
export async function collect(job: string, part: Part, token: string): Promise<Blob> {
  const r = await call(`/jobs/${job}/${part}`, token);
  return new Blob([await r.arrayBuffer()], { type: 'audio/mpeg' });
}
