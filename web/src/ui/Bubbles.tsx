import { useEffect, useRef } from 'react';
import type { Note } from '../core/exercises';
import { bubbleScore, rungAt, rungStarts, sylOf } from '../core/exercises';
import { foldTo, keyName } from '../core/notemap';
import { RIGHT_WITHIN } from '../core/takes';
import { drawLine } from './NoteMap';

/* The singing screen (RULEBOOK 1b; Robert, 24 and 25 Oct): the note map
   fills the screen at one zoom, the same on every exercise and every round
   (Robert, 20 Nov), centred on the rung being sung and gliding smoothly as
   the pattern climbs, following the notes when a rung is taller than the
   view; the ladder of note names at the left; the old app's syllable
   bubbles, each exactly as tall as the band that counts with a line at its
   note, its syllable inside or just above it, the one to sing now ringed,
   your line with the voice gradient on top. The white line is the moment
   a bubble starts and is checked, SING_LAG after its piano note. Each bubble fills green
   with the share of it you sang on the note: the same rule as the score
   (RULEBOOK 4, Bubbles). With no notes (a siren), only your line.
   Sing the interval (Robert, 28 Oct): the note that plays before each turn
   is drawn hollow, and the view fits the whole turn, that note and every
   note to sing, so the next note is seen before it comes. */

const SPAN = 4;          /* seconds across: wide enough for a syllable in a one-beat note */
const NOW_AT = 0.3;
const GUTTER = 44;
/** One zoom, the same on every exercise and every round (Robert, 20 Nov:
    "so singers get used to it and learn to be exact"): this many half
    steps from the top of the map to the bottom, one spacing between notes
    everywhere. On a 360 x 740 phone a row is 28 px (the map is 463 px). */
export const ZOOM = 16;
/** room kept above the highest and below the lowest note in view, in half steps */
export const ROOM = 2;
/** the view moves to a new rung, or follows the notes: this far toward it each second's quarter */
export const GLIDE_SECONDS = 0.25;
/** A bubble is exactly as tall as the band that counts (Robert, 20 Nov:
    "a singer will think anywhere inside counts"): within half a half step
    either side of its note (core/takes RIGHT_WITHIN), one row at this
    zoom, never more; a line through it marks the note itself. This
    replaces 16 Nov's "at least 40 px". */
export const BAND = 2 * RIGHT_WITHIN;
/** the map's own margin above the top row and below the bottom one, in px:
    enough for half a note name (16 Nov: 14 before, the room given to the rows) */
const PAD = 6;

export interface YouLine {
  readonly t: number[];
  readonly m: number[];
}

export function Bubbles(props: { notes: readonly Note[]; you: YouLine; now: () => number; live: boolean; anyOctave: boolean;
  colour: string; label: string; count?: number | null;
  /** the note heard before each rung, one per rung: drawn hollow, the view fitted to the turn */
  heard?: readonly Note[];
  /** false: the line shown but not marked, no bubble fills (Robert, 3 Nov) */
  scored?: boolean;
  /** one per rung (Match the note, Advanced: Robert 4 Nov): until this time the
      rung's line and fill are hidden, then they appear as the note plays again */
  reveal?: readonly number[];
  /** your line not shown at all, until this is false (Match the tone at Advanced, Robert 20 Nov) */
  hideYou?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  /* where the view is now (it glides toward the rung being sung) */
  const view = useRef<{ lo: number; hi: number; at: number; step: number } | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let raf = 0;
    const draw = () => {
      const { notes, you, now, anyOctave, colour, heard, scored = true, reveal, hideYou } = propsRef.current;
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
      /* the view's target, always ZOOM half steps tall: the notes of the rung
         being sung (the first before it starts, the last after), ROOM
         either side, centred; a rung too tall for that, the notes about to
         be sung, and the view follows them (Robert, 20 Nov: "it never
         zooms"); with no notes (a siren), what has been sung */
      let tlo = 48, thi = 72;
      /* a turn heard then sung: its whole time across the view */
      let turn: { a: number; b: number; heard: Note } | null = null;
      if (notes.length) {
        const starts = rungStarts(notes);
        let r = Math.max(0, Math.min(starts.length - 1, rungAt(notes, at)));
        if (heard?.length) {
          r = 0;
          heard.forEach((h, k) => {
            if (h.t <= at && k < starts.length) r = k;
          });
        }
        const from = starts[r] ?? 0, to = starts[r + 1] ?? notes.length;
        const rung = notes.slice(from, to);
        const h = heard?.[r];
        const all = h ? [h, ...rung] : rung;
        let a = Math.min(...all.map((n) => n.m)) - ROOM, b = Math.max(...all.map((n) => n.m)) + ROOM;
        if (b - a > ZOOM) {
          /* too tall: the notes sounding now and in the next second and a half, kept inside the rung */
          const near = rung.filter((n) => n.t + n.d >= at && n.t <= at + 1.5);
          const pick = near.length ? near : [rung[at < rung[0].t ? 0 : rung.length - 1]];
          const mid = (Math.min(...pick.map((n) => n.m)) + Math.max(...pick.map((n) => n.m))) / 2;
          const c = Math.max(a + ZOOM / 2, Math.min(b - ZOOM / 2, mid));
          a = c - ZOOM / 2;
          b = c + ZOOM / 2;
        }
        tlo = a;
        thi = b;
        if (h) turn = { a: h.t - 0.3, b: Math.max(...rung.map((n) => n.t + n.d)) + 0.3, heard: h };
      } else if (you.m.length) {
        const sung = you.m.slice(-40).filter(Number.isFinite);
        if (sung.length) {
          tlo = Math.floor(Math.min(...sung)) - ROOM;
          thi = Math.ceil(Math.max(...sung)) + ROOM;
        }
      }
      {
        const mid = (thi + tlo) / 2;
        tlo = mid - ZOOM / 2;
        thi = mid + ZOOM / 2;
      }
      /* glide there: the first frame jumps, every later one closes a share of the gap */
      const wall = performance.now() / 1000;
      let v = view.current;
      if (!v) v = view.current = { lo: tlo, hi: thi, at: wall, step: 0 };
      else {
        const k = 1 - Math.exp(-(wall - v.at) / GLIDE_SECONDS);
        const nlo = v.lo + (tlo - v.lo) * k, nhi = v.hi + (thi - v.hi) * k;
        v.step = Math.max(v.step, Math.abs(nlo - v.lo), Math.abs(nhi - v.hi));
        v.lo = nlo;
        v.hi = nhi;
        v.at = wall;
      }
      const lo = v.lo, hi = v.hi;
      const pad = PAD;
      const rowH = (H - 2 * pad) / (hi - lo);
      const y = (m: number) => pad + ((hi - m) / (hi - lo)) * (H - 2 * pad);
      const t0 = turn ? turn.a : at - NOW_AT * SPAN, t1 = turn ? turn.b : at + (1 - NOW_AT) * SPAN;
      const pxs = (W - GUTTER) / (t1 - t0);
      const x = (t: number) => GUTTER + (t - t0) * pxs;
      const nowX = x(at);

      /* the ladder of note names: every white key when there is room,
         otherwise C, E, G and A, so no two names touch */
      g.font = '600 12px Quicksand, system-ui, sans-serif';
      g.textBaseline = 'middle';
      const roomy = rowH >= 14;
      let names = 0;
      for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
        const pc = ((m % 12) + 12) % 12;
        g.fillStyle = css.getPropertyValue(pc === 0 ? '--row-c' : '--row');
        g.fillRect(GUTTER, Math.round(y(m)), W - GUTTER, 1);
        const named = roomy ? ![1, 3, 6, 8, 10].includes(pc) : [0, 4, 7, 9].includes(pc);
        if (named) {
          g.fillStyle = css.getPropertyValue('--muted');
          g.fillText(keyName(m), 6, y(m));
          names++;
        }
      }

      g.save();
      g.beginPath();
      g.rect(GUTTER, 0, W - GUTTER, H);
      g.clip();
      /* the bubbles: the share sung on the note filled green, every
         syllable inside, the one to sing now bigger with a white ring */
      const score = bubbleScore(notes, you.t, you.m, 0.05, anyOctave);
      /* a hidden try: its rung's notes and line are not shown until it is revealed */
      const starts0 = rungStarts(notes);
      const rungOf = (i: number) => {
        let r = 0;
        starts0.forEach((s0, k) => {
          if (i >= s0) r = k;
        });
        return r;
      };
      const hiddenNote = (i: number) => !!reveal && at < (reveal[rungOf(i)] ?? -Infinity);
      const hiddenAt = (t: number) => {
        if (hideYou) return true;
        if (!reveal) return false;
        const k = notes.findIndex((q) => t >= q.t - 0.2 && t < (reveal[rungOf(notes.indexOf(q))] ?? -Infinity));
        return k >= 0 && hiddenNote(k);
      };
      let hiddenPts = 0;
      const h = rowH * BAND;
      const tint = css.getPropertyValue('--' + colour).trim();
      let current = -1, visible = 0, labelled = 0, outside = 0;
      const bubble = (n: Note, i: number, isNow: boolean) => {
        const bh = h;
        const bx = x(n.t), bw = Math.max(6, n.d * pxs - 2), by = y(n.m) - bh / 2;
        const shape = () => {
          g.beginPath();
          if (g.roundRect) g.roundRect(bx, by, bw, bh, bh / 2);
          else g.rect(bx, by, bw, bh);
        };
        shape();
        g.globalAlpha = 0.35;
        g.fillStyle = tint;
        g.fill();
        g.globalAlpha = 1;
        if (scored && score.fill[i] > 0 && !hiddenNote(i)) {
          g.save();
          shape();
          g.clip();
          g.fillStyle = css.getPropertyValue('--hit');
          g.fillRect(bx, by, bw * score.fill[i], bh);
          g.restore();
        }
        /* the note itself: a line through the middle of its band */
        g.globalAlpha = 0.55;
        g.fillStyle = css.getPropertyValue('--ink');
        g.fillRect(bx + 2, Math.round(y(n.m)) - 0.5, Math.max(1, bw - 4), 1);
        g.globalAlpha = 1;
        shape();
        /* the ring on the note to sing now: white in the dark, ink in the
           light, so it shows on both (the --now token); the same height as
           the rest, as the band is the same */
        g.lineWidth = isNow ? 3 : 1;
        g.strokeStyle = isNow ? css.getPropertyValue('--now') : tint;
        g.stroke();
        /* the syllable inside when it fits, otherwise just above the bubble
           (below, at the top of the map) */
        const syl = sylOf(n);
        g.font = `700 ${isNow ? 14 : 12}px Quicksand, system-ui, sans-serif`;
        const tw = g.measureText(syl).width;
        const inside = tw + 6 <= bw && bh >= 15;
        g.fillStyle = css.getPropertyValue('--ink');
        g.textAlign = 'center';
        if (inside) g.fillText(syl, bx + bw / 2, by + bh / 2);
        else {
          outside++;
          const above = by - 9 >= 8;
          g.fillText(syl, bx + bw / 2, above ? by - 9 : by + bh + 9);
        }
        g.textAlign = 'left';
        labelled++;
      };
      notes.forEach((n, i) => {
        if (n.t + n.d < t0 || n.t > t1) return;
        visible++;
        const isNow = at >= n.t && at < n.t + n.d;
        if (isNow) current = i;
        else bubble(n, i, false);
      });
      if (current >= 0) bubble(notes[current], current, true);   /* on top of its neighbours */
      /* the note heard first: hollow, its name inside, never scored */
      let heardShown = 0;
      if (turn) {
        const n = turn.heard, bx = x(n.t), bw = Math.max(6, n.d * pxs - 2), by = y(n.m) - h / 2;
        g.beginPath();
        if (g.roundRect) g.roundRect(bx, by, bw, h, h / 2);
        else g.rect(bx, by, bw, h);
        g.setLineDash([5, 4]);
        g.lineWidth = 2;
        g.strokeStyle = tint;
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = css.getPropertyValue('--muted');
        g.font = '700 12px Quicksand, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(sylOf(n), bx + bw / 2, by + h / 2, bw + 8);
        g.textAlign = 'left';
        heardShown++;
      }

      /* your line, on top, in the voice gradient */
      const pts: Array<{ t: number; m: number }> = [];
      for (let i = 0; i < you.t.length; i++) {
        const t = you.t[i];
        if (t < t0 - 1 || t > t1) continue;
        if (hiddenAt(t)) {
          hiddenPts++;
          continue;
        }
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
      cv.dataset.hits = String(scored ? score.hits : 0);
      cv.dataset.fill = (scored ? score.fill.map((f, i) => (hiddenNote(i) ? 0 : f)) : score.fill.map(() => 0)).map((f) => f.toFixed(2)).join(',');
      cv.dataset.visible = String(visible);
      cv.dataset.labelled = String(labelled);
      cv.dataset.names = String(names);
      cv.dataset.bubble = h.toFixed(1);
      cv.dataset.row = rowH.toFixed(1);
      cv.dataset.nowBubble = h.toFixed(1);
      cv.dataset.zoom = (hi - lo).toFixed(2);
      cv.dataset.outside = String(outside);
      cv.dataset.viewLo = lo.toFixed(2);
      cv.dataset.viewHi = hi.toFixed(2);
      cv.dataset.viewStep = v.step.toFixed(3);
      cv.dataset.viewT0 = t0.toFixed(2);
      cv.dataset.viewT1 = t1.toFixed(2);
      cv.dataset.heardShown = String(heardShown);
      cv.dataset.hidden = String(hiddenPts);
      if (propsRef.current.live) raf = requestAnimationFrame(draw);
    };
    view.current = null;
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
