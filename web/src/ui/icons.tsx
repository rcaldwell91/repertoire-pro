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
