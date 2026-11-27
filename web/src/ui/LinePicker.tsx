import { copy, fill } from '../core/copy';
import { clock } from '../core/time';
import { lineAt, longer, nextLine, prevLine, stretchOf, type Chosen, type Stretch } from '../core/practise';

/* The line being worked on (Practise a line; Speak it, then sing it): which
   one, and where in the song; picked on the song's timeline, a line before
   or after, or a longer stretch with the next line added on. Everything it
   offers is worked out in core/practise. */
export function LinePicker(props: { lines: readonly Stretch[]; chosen: Chosen; total: number; disabled?: boolean;
  onChange: (c: Chosen) => void }) {
  const { lines, chosen, total } = props;
  const s = stretchOf(lines, chosen);
  if (!s) return null;
  const one = chosen.from === chosen.to;
  const label = one
    ? fill(copy.line.pick, { n: chosen.from + 1, of: lines.length, from: clock(s.start), to: clock(s.end) })
    : fill(copy.line.picks, { n: chosen.from + 1, m: chosen.to + 1, of: lines.length, from: clock(s.start), to: clock(s.end) });
  return (
    <section className="card line-picker" aria-label={copy.line.where}>
      <p className="line-which" id="line-which" role="status">{label}</p>
      <input type="range" id="line-where" aria-label={copy.line.where} min={0} max={Math.max(total, 0.1)} step={0.1}
        value={Math.min(s.start, total)} disabled={props.disabled}
        onChange={(e) => {
          const i = lineAt(lines, Number(e.target.value));
          if (i >= 0 && (i !== chosen.from || !one)) props.onChange({ from: i, to: i });
        }} />
      <div className="line-moves">
        <button type="button" className="btn btn-quiet" id="line-prev" disabled={props.disabled || chosen.from === 0}
          onClick={() => props.onChange(prevLine(chosen))}>{copy.line.prev}</button>
        <button type="button" className="btn btn-quiet" id="line-next" disabled={props.disabled || chosen.to >= lines.length - 1}
          onClick={() => props.onChange(nextLine(lines, chosen))}>{copy.line.next}</button>
      </div>
      <div className="line-moves">
        <button type="button" className="btn btn-quiet" id="line-longer" disabled={props.disabled || chosen.to >= lines.length - 1}
          onClick={() => props.onChange(longer(lines, chosen))}>{copy.line.longer}</button>
        {!one && (
          <button type="button" className="btn btn-quiet" id="line-shorter" disabled={props.disabled}
            onClick={() => props.onChange({ from: chosen.from, to: chosen.from })}>{copy.line.shorter}</button>
        )}
      </div>
    </section>
  );
}
