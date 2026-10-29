import type { ReactNode, SyntheticEvent } from 'react';
import { Pause, Play, RotateCcw, Settings, X } from 'lucide-react';
import { copy } from '../core/copy';

/* The singing screen's one layout (RULEBOOK 1b; Robert, 28 Oct). Every
   singing screen is drawn through this, and where each part sits is set
   here and in its one CSS rule (.sing, in tokens.css), nowhere else, so the
   path map can move them later without touching an exercise. The controls
   are built here once: Pause (Resume once paused), Restart, the gear (the
   sound sheet) and Close. An exercise only says what each one does. */

export interface SingControls {
  readonly paused: boolean;
  /** Pause; absent while there is nothing to pause (a part waiting for Next) */
  readonly pause?: () => void;
  readonly resume: (ev: SyntheticEvent) => void;
  readonly restart: (ev: SyntheticEvent) => void;
  /** the gear; absent when the sheet would have nothing in it */
  readonly gear?: { readonly open: boolean; readonly toggle: () => void };
  readonly close: () => void;
}

export function SingLayout(props: {
  colour: string;
  title: string;
  controls: SingControls;
  /** what the mic is doing, when it needs saying */
  status?: ReactNode;
  /** the sound sheet, while the gear is open */
  sheet?: ReactNode;
  /** a line above the map: the shape to sing, the part */
  prompt?: ReactNode;
  /** the note map */
  map?: ReactNode;
  /** how far through: the dots */
  dots?: ReactNode;
  /** everything else the exercise shows */
  children?: ReactNode;
}) {
  const k = props.controls;
  return (
    <div className="sing" data-colour={props.colour} id="ex-run" data-paused={k.paused ? 'true' : undefined}>
      <div className="sing-top">
        <strong>{props.title}</strong>
        <button type="button" className="round close" id="ex-close" aria-label={copy.train.close} onClick={k.close}>
          <X size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="sing-status mic-line" id="mic-line">{props.status}</div>
      {props.sheet && <div className="sing-sheet">{props.sheet}</div>}
      {props.prompt != null && <div className="sing-prompt">{props.prompt}</div>}
      {props.map && <div className="sing-map">{props.map}</div>}
      {props.dots}
      <div className="sing-body">{props.children}</div>
      <div className="sing-bar" role="toolbar" aria-label={copy.train.controls}>
        {k.paused ? (
          <button type="button" className="btn sing-btn" id="ex-pause" onClick={k.resume}>
            <Play size={22} strokeWidth={2} aria-hidden="true" />
            <span>{copy.train.resume}</span>
          </button>
        ) : (
          <button type="button" className="btn sing-btn" id="ex-pause" disabled={!k.pause} onClick={k.pause}>
            <Pause size={22} strokeWidth={2} aria-hidden="true" />
            <span>{copy.train.pause}</span>
          </button>
        )}
        <button type="button" className="btn btn-quiet sing-btn" id="ex-restart" onClick={k.restart}>
          <RotateCcw size={22} strokeWidth={2} aria-hidden="true" />
          <span>{copy.train.restart}</span>
        </button>
        {k.gear && (
          <button type="button" className="round gear" id="ex-gear-run" aria-label={copy.train.soundSheet} aria-expanded={k.gear.open}
            onClick={k.gear.toggle}>
            <Settings size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
