import { useEffect, useRef } from 'react';
import type { Note } from '../core/exercises';
import { bubbleScore } from '../core/exercises';
import { foldTo, keyName } from '../core/notemap';
import { drawLine } from './NoteMap';

/* The singing screen (RULEBOOK 1b): the old app's syllable bubbles,
   smaller, a white ring on the note to sing now, your line with the voice
   gradient on top. Each bubble fills green with the share of it you sang
   on the note: the same rule as the score (RULEBOOK 4, Bubbles). With no
   notes (a siren), only your line. */

const SPAN = 6;          /* seconds across */
const NOW_AT = 0.3;
const GUTTER = 40;

export interface YouLine {
  readonly t: number[];
  readonly m: number[];
}

export function Bubbles(props: { notes: readonly Note[]; you: YouLine; now: () => number; live: boolean; anyOctave: boolean;
  colour: string; label: string; count?: number | null }) {
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
      const { notes, you, now, anyOctave, colour } = propsRef.current;
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
      /* pinned to the exercise's own notes, three either side, at least an octave */
      let lo = notes.length ? Math.min(...notes.map((n) => n.m)) - 3 : 48;
      let hi = notes.length ? Math.max(...notes.map((n) => n.m)) + 3 : 72;
      if (!notes.length && you.m.length) {
        const sung = you.m.filter(Number.isFinite);
        if (sung.length) {
          lo = Math.min(lo, Math.floor(Math.min(...sung)) - 2);
          hi = Math.max(hi, Math.ceil(Math.max(...sung)) + 2);
        }
      }
      if (hi - lo < 12) {
        const mid = (hi + lo) / 2;
        lo = mid - 6;
        hi = mid + 6;
      }
      const pad = 10;
      const y = (m: number) => pad + ((hi - m) / (hi - lo)) * (H - 2 * pad);
      const pxs = (W - GUTTER) / SPAN;
      const nowX = GUTTER + NOW_AT * (W - GUTTER);
      const x = (t: number) => nowX + (t - at) * pxs;
      const t0 = at - NOW_AT * SPAN, t1 = at + (1 - NOW_AT) * SPAN;

      g.font = '600 11px Quicksand, system-ui, sans-serif';
      g.textBaseline = 'middle';
      for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
        const pc = ((m % 12) + 12) % 12;
        g.fillStyle = css.getPropertyValue(pc === 0 ? '--row-c' : '--row');
        g.fillRect(GUTTER, Math.round(y(m)), W - GUTTER, 1);
        if ([0, 4, 7, 9].includes(pc)) {
          g.fillStyle = css.getPropertyValue('--muted');
          g.fillText(keyName(m), 6, y(m));
        }
      }

      g.save();
      g.beginPath();
      g.rect(GUTTER, 0, W - GUTTER, H);
      g.clip();
      /* the bubbles: smaller than the old app's (1b), the share sung on the note filled green */
      const score = bubbleScore(notes, you.t, you.m, 0.05, anyOctave);
      const h = Math.max(9, Math.min(18, ((H - 2 * pad) / (hi - lo)) * 0.9));
      const tint = css.getPropertyValue('--' + colour).trim();
      let current = -1;
      notes.forEach((n, i) => {
        if (n.t + n.d < t0 || n.t > t1) return;
        const bx = x(n.t), bw = Math.max(12, n.d * pxs - 3), by = y(n.m) - h / 2;
        const shape = () => {
          g.beginPath();
          if (g.roundRect) g.roundRect(bx, by, bw, h, h / 2);
          else g.rect(bx, by, bw, h);
        };
        shape();
        g.globalAlpha = 0.35;
        g.fillStyle = tint;
        g.fill();
        g.globalAlpha = 1;
        if (score.fill[i] > 0) {
          g.save();
          shape();
          g.clip();
          g.fillStyle = css.getPropertyValue('--hit');
          g.fillRect(bx, by, bw * score.fill[i], h);
          g.restore();
        }
        const now = at >= n.t && at < n.t + n.d;
        if (now) current = i;
        shape();
        g.lineWidth = now ? 2.5 : 1;
        g.strokeStyle = now ? '#ffffff' : tint;
        g.stroke();
        if (bw > 34) {
          g.fillStyle = css.getPropertyValue('--ink');
          g.font = '600 10px Quicksand, system-ui, sans-serif';
          g.fillText(n.syl, bx + 7, by + h / 2, bw - 10);
        }
      });

      /* your line, on top, in the voice gradient */
      const pts: Array<{ t: number; m: number }> = [];
      for (let i = 0; i < you.t.length; i++) {
        const t = you.t[i];
        if (t < t0 - 1 || t > t1) continue;
        let m = you.m[i];
        if (anyOctave && Number.isFinite(m)) {
          const n = notes.find((q) => t >= q.t && t < q.t + q.d);
          if (n) m = foldTo(m, n.m);
        }
        pts.push({ t, m });
      }
      const grad = g.createLinearGradient(0, pad, 0, H - pad);
      grad.addColorStop(0, css.getPropertyValue('--you-c'));
      grad.addColorStop(0.5, css.getPropertyValue('--you-b'));
      grad.addColorStop(1, css.getPropertyValue('--you-a'));
      const drawn = drawLine(g, pts, x, y, 3, grad);
      g.restore();

      g.fillStyle = css.getPropertyValue('--now');
      g.fillRect(Math.round(nowX) - 1, 0, 2, H);

      /* what was drawn, for the tests that check it */
      cv.dataset.now = at.toFixed(2);
      cv.dataset.current = String(current);
      cv.dataset.you = String(drawn);
      cv.dataset.hits = String(score.hits);
      cv.dataset.fill = score.fill.map((f) => f.toFixed(2)).join(',');
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
    <div className="notemap bubbles">
      <canvas ref={ref} id="bubbles" role="img" aria-label={props.label} />
      {props.count != null && <div className="count-in" id="count-in" aria-live="assertive">{props.count}</div>}
    </div>
  );
}
