/* A part of a song as one line of samples, for reading its pitch: the
   left and right averaged, at 44.1 kHz, as the old app read it. Decoding
   is the browser's; this file is engine-side (screens never call it). */
export const READ_RATE = 44100;

export async function decodeMono(blob: Blob): Promise<{ mono: Float32Array; sr: number }> {
  const ctx = new OfflineAudioContext(1, 1, READ_RATE);
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = buf.length, ch = buf.numberOfChannels;
  const mono = new Float32Array(n);
  if (ch === 1) mono.set(buf.getChannelData(0));
  else {
    const l = buf.getChannelData(0), r = buf.getChannelData(1);
    for (let i = 0; i < n; i++) mono[i] = (l[i] + r[i]) / 2;
  }
  return { mono, sr: buf.sampleRate };
}
