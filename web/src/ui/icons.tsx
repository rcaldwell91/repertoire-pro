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

/* Agility's picture (Robert, 27 Oct): a quick run on a staff. Five faint
   staff lines (35%, half the stroke: Robert, 28 Oct, so the run reads
   clearly), five solid dots each on a different line or space, rising, and
   one smooth curve through them; Lucide's stroke style (24 across, stroke
   2, round caps), in Agility's blue */
const STAFF = [4, 8, 12, 16, 20];
const RUN: ReadonlyArray<readonly [number, number]> = [[4, 18], [8.5, 14], [12.5, 12], [16.5, 8], [20.5, 6]];

/** a smooth curve through points (Catmull-Rom, as cubic Béziers) */
function through(pts: ReadonlyArray<readonly [number, number]>): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6], c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${x2} ${y2}`;
  }
  return d;
}

export function QuickRun(props: { size?: number }) {
  const s = props.size ?? 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" data-picture="run">
      <g data-part="staff" strokeOpacity={0.35} strokeWidth={1}>
        {STAFF.map((y) => <line key={y} x1={2} y1={y} x2={22} y2={y} />)}
      </g>
      <path data-part="run" d={through(RUN)} />
      <g data-part="dots" fill="currentColor" stroke="none">
        {RUN.map(([x, y]) => <circle key={x} cx={x} cy={y} r={1.9} />)}
      </g>
    </svg>
  );
}
