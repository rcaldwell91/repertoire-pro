import { copy } from '../core/copy';
import { TABS, type Tab } from '../shell/router';
import { TAB_ICONS } from './icons';

/* Seven tabs, each its icon with its name underneath (Robert, 21 Nov:
   people didn't know what they were pressing; this replaces the 30 Sep
   label on the active tab only). The active tab: its icon in the gradient
   pill and its name in bold ink. */
export function TabBar(props: { active: Tab; onPick: (t: Tab) => void }) {
  return (
    <nav className="tabs" aria-label={copy.app.tabsLabel}>
      {TABS.map((t) => {
        const Icon = TAB_ICONS[t];
        const on = t === props.active;
        return (
          <button
            key={t}
            type="button"
            className="tab"
            id={'tab-' + t}
            aria-current={on ? 'page' : undefined}
            onClick={() => props.onPick(t)}
          >
            <span className="tab-icon"><Icon size={22} strokeWidth={2} aria-hidden="true" /></span>
            <span className="tab-name">{copy.tabs[t]}</span>
          </button>
        );
      })}
    </nav>
  );
}
