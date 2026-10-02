import { copy } from '../core/copy';
import { TABS, type Tab } from '../shell/router';
import { TAB_ICONS } from './icons';

/* Seven tabs, an icon each; the label shows on the active tab only. */
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
            aria-label={copy.tabs[t]}
            aria-current={on ? 'page' : undefined}
            onClick={() => props.onPick(t)}
          >
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
            {on && <span>{copy.tabs[t]}</span>}
          </button>
        );
      })}
    </nav>
  );
}
