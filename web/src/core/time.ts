/** 0:07, 4:39, 12:03 */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
