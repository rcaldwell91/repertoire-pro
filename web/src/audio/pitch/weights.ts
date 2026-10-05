import { crepeBuild, type Crepe, type Spec } from './crepe.ts';

/* The octave anchor's model (CREPE tiny, MIT), as ml5 publishes it, pinned
   to one commit and checked byte for byte: the same weights the old app
   carried. Fetched the first time, then kept on the phone; never committed
   (RULEBOOK 3: model weights are never committed). */
const BASE = 'https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models@0612a3e7c51cbffdc5db701dff49d16d1ac26fa8/models/pitch-detection/crepe/';
const SHA256 = '0a1e492a58e22c2ad73ea0871123261317ba2e3002e2935b07f83a0296245c92';
const CACHE = 'rp-pitch-model-1';

interface Manifest {
  weightsManifest: Array<{ paths: string[]; weights: Array<Spec & { dtype: string }> }>;
}

async function get(cache: Cache | null, url: string): Promise<Response> {
  const kept = cache && (await cache.match(url));
  if (kept) return kept;
  const res = await fetch(url);
  if (!res.ok) throw new Error('model ' + res.status);
  if (cache) await cache.put(url, res.clone());
  return res;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The model, or null if it can't be fetched or isn't the right one. */
export async function loadCrepe(): Promise<Crepe | null> {
  let cache: Cache | null = null;
  try {
    cache = typeof caches !== 'undefined' ? await caches.open(CACHE) : null;
  } catch {
    cache = null;
  }
  try {
    const manifest = (await (await get(cache, BASE + 'model.json')).json()) as Manifest;
    const specs = manifest.weightsManifest.flatMap((g) => g.weights);
    const parts = await Promise.all(manifest.weightsManifest.flatMap((g) => g.paths).map(async (p) => new Uint8Array(await (await get(cache, BASE + p)).arrayBuffer())));
    const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      all.set(p, off);
      off += p.length;
    }
    if (hex(await crypto.subtle.digest('SHA-256', all)) !== SHA256) {
      if (cache) await caches.delete(CACHE);
      return null;
    }
    return crepeBuild(specs, new Float32Array(all.buffer));
  } catch {
    return null;
  }
}
