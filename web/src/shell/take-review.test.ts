import { describe, expect, it } from 'vitest';
import type { Take } from '../audio/conductor/conductor';
import { review } from './take-review';
import { yourLine } from './your-line';

/* Robert, 17 Nov: a take kept on the phone comes back when the song opens,
   often before the singer's line has been read again. Its score must not
   stay "too little sung to score" once the singer's line is there. */
describe('a take brought back before the singer\'s line is read', () => {
  it('is scored once the singer\'s line is there', () => {
    const owner = 'review-test';
    const t = Array.from({ length: 40 }, (_, i) => 10 + i * 0.05);
    yourLine(owner).load(t, t.map(() => 60));
    const take: Take = { owner, rate: 48000, chunks: [new Int16Array(48000 * 3)], seconds: 3, songAt: 10 };
    expect(review(take, null, 0.05, false)?.rightPct).toBeNull();
    const singer = new Float32Array(400).fill(60);
    expect(review(take, singer, 0.05, false)?.rightPct).toBe(100);
    /* and it is the same take, with the same recording */
    expect(review(take, singer, 0.05, false)?.url).toBe(review(take, null, 0.05, false)?.url);
  });
});
