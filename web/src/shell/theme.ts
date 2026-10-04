/* Dark or light (RULEBOOK 1b), chosen in Profile → Look and remembered on
   this phone. "Same as my phone" follows the phone's own setting. */
export type ThemeChoice = 'dark' | 'light' | 'phone';
const KEY = 'rp.theme';
const listeners = new Set<() => void>();
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function themeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light' || v === 'phone') return v;
  } catch {
    /* no storage: the default */
  }
  return 'phone';
}

function apply(): void {
  const c = themeChoice();
  const dark = c === 'dark' || (c === 'phone' && !!media?.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  listeners.forEach((f) => f());
}

export function setTheme(c: ThemeChoice): void {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* kept for this visit only */
  }
  apply();
}

export function startTheme(): void {
  media?.addEventListener('change', apply);
  apply();
}

export function onTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
