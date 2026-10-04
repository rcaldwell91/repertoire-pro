import { copy } from '../core/copy';
import { useTheme } from '../shell/hooks';
import { back } from '../shell/router';
import { setTheme, type ThemeChoice } from '../shell/theme';
import { BackButton } from '../ui/BackButton';

const CHOICES: Array<[ThemeChoice, string]> = [
  ['dark', copy.look.dark],
  ['light', copy.look.light],
  ['phone', copy.look.phone],
];

export function Look() {
  const now = useTheme();
  return (
    <>
      <BackButton label={copy.look.back} onBack={() => back('/profile')} />
      <h1>{copy.look.title}</h1>
      <div className="choices" role="radiogroup" aria-label={copy.look.label}>
        {CHOICES.map(([c, label]) => (
          <button key={c} type="button" className="choice" role="radio" id={'theme-' + c} aria-checked={now === c}
            onClick={() => setTheme(c)}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
