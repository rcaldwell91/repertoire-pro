import { useEffect, useRef } from 'react';
import { foldTo, keyName, penDown, singerAt, type Range } from '../core/notemap';
import { isRight, singerNow } from '../core/takes';

/* The note map (RULEBOOK 1b): key names down the side, the singer's line
   thick and soft, your line thin with the voice gradient on top, and a
   now-line. The view is pinned to the song's range; time moves past the
   now-line. One drawing function draws both lines (RULEBOOK 4, Pitch). */

export interface Lines {
  /** the singer's line: a note every `hop` seconds, NaN where nobody sings */
  singer: Float32Array;
  hop: number;
  /** your line, in song time */
  youT: number[];
  youM: number[];
}

const SPAN = 8;          /* seconds across the map */
const NOW_AT = 0.3;      /* where the now-line sits, from the left */
const GUTTER = 44;
const PEN_GAP = 0.21;    /* seconds between drawn points: a gap of 0.15 s (three points) or less is bridged (RULEBOOK 4, Pitch) */

type Pt = { t: number; m: number };

/** the one drawing function: a line through points, the pen lifted across
    gaps and big jumps */
function drawLine(g: CanvasRenderingContext2D, pts: Pt[], x: (t: number) => number, y: (m: number) => number,
  width: number, stroke: string | CanvasGradient): number {
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = stroke;
  g.beginPath();
  let drawn = 0;
  let prev = NaN;
  let prevT = -Infinity;
  for (const p of pts) {
    if (!Number.isFinite(p.m)) continue;
    /* the pen lifts across a gap of more than 0.15 s, a big leap, or a
       step back in time */
    if (penDown(prev, p.m) && p.t >= prevT && p.t - prevT <= PEN_GAP) g.lineTo(x(p.t), y(p.m));
    else g.moveTo(x(p.t), y(p.m));
    prev = p.m;
    prevT = p.t;
    drawn++;
  }
  g.stroke();
  return drawn;
}

export function NoteMap(props: { lines: Lines; range: Range | null; now: () => number; live: boolean; anyOctave: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let raf = 0;
    const draw = () => {
      const { lines, range, now, anyOctave } = propsRef.current;
      const css = getComputedStyle(cv);
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      const g = cv.getContext('2d');
      if (!g || !W || !H) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const at = now();
      const r = range ?? { lo: 55, hi: 72 };
      const pad = 10;
      const y = (m: number) => pad + ((r.hi - m) / (r.hi - r.lo)) * (H - 2 * pad);
      const pxs = (W - GUTTER) / SPAN;
      const nowX = GUTTER + NOW_AT * (W - GUTTER);
      const x = (t: number) => nowX + (t - at) * pxs;
      const t0 = at - NOW_AT * SPAN, t1 = at + (1 - NOW_AT) * SPAN;

      /* rows and key names */
      g.font = `600 11px Quicksand, system-ui, sans-serif`;
      g.textBaseline = 'middle';
      /* every white key named when there is room; otherwise C, E, G and A,
         so no two names touch */
      const roomy = (H - 2 * pad) / (r.hi - r.lo) >= 14;
      for (let m = Math.ceil(r.lo); m <= Math.floor(r.hi); m++) {
        const pc = ((m % 12) + 12) % 12;
        const isC = pc === 0;
        const natural = roomy ? ![1, 3, 6, 8, 10].includes(pc) : [0, 4, 7, 9].includes(pc);
        g.fillStyle = css.getPropertyValue(isC ? '--row-c' : '--row');
        g.fillRect(GUTTER, Math.round(y(m)), W - GUTTER, 1);
        if (natural) {
          g.fillStyle = css.getPropertyValue('--muted');
          g.fillText(keyName(m), 6, y(m));
        }
      }

      /* the singer's line, from the file, whatever is playing */
      const k0 = Math.max(0, Math.floor(t0 / lines.hop)), k1 = Math.min(lines.singer.length, Math.ceil(t1 / lines.hop) + 1);
      const sp: Pt[] = [];
      for (let k = k0; k < k1; k++) sp.push({ t: k * lines.hop, m: lines.singer[k] });
      g.save();
      g.beginPath();
      g.rect(GUTTER, 0, W - GUTTER, H);
      g.clip();
      const singerDrawn = drawLine(g, sp, x, y, 10, css.getPropertyValue('--singer'));

      /* your line, on top */
      const yp: Pt[] = [];
      for (let i = 0; i < lines.youT.length; i++) {
        const t = lines.youT[i];
        if (t < t0 - 1 || t > t1) continue;
        let m = lines.youM[i];
        if (anyOctave && Number.isFinite(m)) {
          const s = singerAt(lines.singer, lines.hop, t);
          if (Number.isFinite(s)) m = foldTo(m, s);
        }
        yp.push({ t, m });
      }
      const grad = g.createLinearGradient(0, pad, 0, H - pad);
      grad.addColorStop(0, css.getPropertyValue('--you-c'));
      grad.addColorStop(0.5, css.getPropertyValue('--you-b'));
      grad.addColorStop(1, css.getPropertyValue('--you-a'));
      const youDrawn = drawLine(g, yp, x, y, 3, grad);
      /* green, only where your note is right (RULEBOOK 1b: green is only a
         note you hit; the same rule gives a take its right-note %) */
      const hits = yp.map((p) => ({ t: p.t, m: isRight(p.m, singerNow(lines.singer, lines.hop, p.t), false) ? p.m : NaN }));
      const hitDrawn = drawLine(g, hits, x, y, 3, css.getPropertyValue('--hit'));
      g.restore();

      /* the now-line */
      g.fillStyle = css.getPropertyValue('--now');
      g.fillRect(Math.round(nowX) - 1, 0, 2, H);

      /* what was drawn, for the tests that check it */
      cv.dataset.lo = String(r.lo);
      cv.dataset.hi = String(r.hi);
      cv.dataset.now = at.toFixed(2);
      cv.dataset.singer = String(singerDrawn);
      cv.dataset.you = String(youDrawn);
      cv.dataset.hit = String(hitDrawn);
      (cv as HTMLCanvasElement & { drawn?: unknown }).drawn = { lines, you: yp, hits, anyOctave };
      if (propsRef.current.live) raf = requestAnimationFrame(draw);
    };
    draw();
    if (props.live) raf = requestAnimationFrame(draw);
    const t = props.live ? 0 : window.setInterval(draw, 250);
    return () => {
      cancelAnimationFrame(raf);
      if (t) clearInterval(t);
    };
  }, [props.live]);

  return (
    <div className="notemap">
      <canvas ref={ref} id="note-map" role="img" aria-label={props.label} />
    </div>
  );
}
