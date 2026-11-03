import { copy } from './copy';
import { exercise } from './exercises';

/* The "Ah" tension check (Robert, 3 Nov): where the singer felt tension,
   ticked after it, and the one-line reminder each tick brings to later
   exercises. At most one line shows while singing. Five exercises have a
   movement cue, which is part of how they are done, so it wins there;
   everywhere else a reminder, rotating through the ticks that suit the
   exercise, one more each time an exercise starts. A reminder that would
   contradict the exercise never shows. */

export const SPOTS = ['chin', 'jaw', 'wide', 'face', 'tongue', 'neck'] as const;
export type Spot = (typeof SPOTS)[number];

/** no line at all: the posture check, the check itself, and Sing the interval, whose line is its shape */
export const NO_LINE: readonly string[] = ['posture', 'tensioncheck', 'interval'];

/* where a reminder would contradict the exercise: "Open tall, not wide"
   with closed lips, a tongue held out, or the one wide-mouthed exercise;
   "Keep your face still" where the face acts or moves; "Let your jaw hang
   loose" while chewing; "Let your tongue rest" where the tongue is the point */
const NOT: Record<Spot, readonly string[]> = {
  chin: [],
  jaw: ['chewhum'],
  wide: ['nay', 'hum', 'mum', 'liptrill', 'buzz', 'raspberry', 'straw', 'cheekpuffs', 'chewhum', 'tonguefwd', 'tongueout', 'tonguecresc', 'brighta',
    'tonguetrill'],
  face: ['nay', 'cheekpuffs', 'chewhum', 'brighta'],
  tongue: ['tongueout', 'tonguecresc', 'brighta', 'tonguefwd', 'tonguetrill', 'laga', 'loo', 'blah'],
  neck: [],
};

/** the ticked spots whose reminder suits this exercise, in the spec's order */
export function remindersFor(id: string, ticked: readonly Spot[]): Spot[] {
  if (NO_LINE.includes(id)) return [];
  const words = exercise(id)?.category === 'words';
  return SPOTS.filter((s) => ticked.includes(s) && !NOT[s].includes(id) && !(s === 'tongue' && words));
}

/** the reminder for this start: the turn-th of those that suit it, round and round */
export function pickReminder(id: string, ticked: readonly Spot[], turn: number): Spot | null {
  const fit = remindersFor(id, ticked);
  return fit.length ? fit[turn % fit.length] : null;
}

/** the exercise's movement cue, if it has one */
export function cueFor(id: string): string | null {
  const e = (copy.ex as Record<string, { cue?: string }>)[id];
  return e?.cue ?? null;
}
