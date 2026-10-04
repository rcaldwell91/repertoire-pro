/* How long a song file plays, read from its own header by the browser.
   Never plays it. null if the browser cannot tell. */
export function durationOf(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('audio');
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(v);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    a.src = url;
  });
}
