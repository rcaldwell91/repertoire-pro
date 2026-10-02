import { copy } from '../core/copy';
import type { Tab } from '../shell/router';

/* For now each tab shows only its name. */
export function TabPage(props: { tab: Tab }) {
  return <h1>{copy.tabs[props.tab]}</h1>;
}
