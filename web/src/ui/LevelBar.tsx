/* How loud the mic hears the singer: the voice colour on its track. */
export function LevelBar(props: { on: boolean; fill: number; label: string }) {
  return (
    <div
      className="level"
      data-on={props.on}
      role="meter"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(props.fill * 100)}
    >
      <span style={{ transform: `scaleX(${props.fill})` }} />
    </div>
  );
}
