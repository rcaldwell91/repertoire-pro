import { BookOpen, CircleUser, Disc3, Dumbbell, GraduationCap, House, Mic, type LucideIcon } from 'lucide-react';
import type { Tab } from '../shell/router';

/* One stroke set (Lucide) for every tab. Library is a record. */
export const TAB_ICONS: Record<Tab, LucideIcon> = {
  home: House,
  train: Dumbbell,
  sing: Mic,
  coach: GraduationCap,
  learn: BookOpen,
  library: Disc3,
  profile: CircleUser,
};

/** Agility's picture (Robert, 25 Oct): a hummingbird, drawn in Lucide's
    stroke style (24 across, stroke 2, round caps), in Agility's blue */
export function Hummingbird(props: { size?: number }) {
  const s = props.size ?? 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" data-picture="hummingbird">
      {/* the body, its head to the right, the tail to the lower left */}
      <path d="M8 13c0-3 2.5-5 5.5-5 2 0 3.5 1.2 4 3l3 1.5-3 .5c-.6 2.4-2.4 4-5 4-1.2 0-2.3-.4-3.2-1" />
      {/* the beak */}
      <path d="M17.5 11H22" />
      {/* the wing, raised */}
      <path d="M11 9.5C9 7 7 5.5 4 5.5c1 2.5 2.5 4.5 5 5.5" />
      {/* the tail feathers */}
      <path d="M8 13l-5 4.5M8.5 14.5L5 19" />
      {/* the eye */}
      <path d="M15.5 10.5h.01" />
    </svg>
  );
}
