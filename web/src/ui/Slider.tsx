import { copy, fill } from '../core/copy';

/* A volume slider, 0 to 100 (or to `max`), with its name and value. */
export function Slider(props: { id: string; label: string; value: number; max?: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{props.label}</span>
      <input type="range" id={props.id} min={0} max={props.max ?? 100} step={1} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} />
      <span>{fill(copy.song.percent, { n: props.value })}</span>
    </label>
  );
}
