import { ChevronRight } from 'lucide-react';
import { copy } from '../core/copy';
import { navigate, type Route } from '../shell/router';

const ENTRIES: Array<[string, Route]> = [
  [copy.profile.account, '/profile/account'],
  [copy.profile.look, '/profile/look'],
  [copy.profile.soundCheck, '/profile/sound-check'],
];

export function ProfilePage() {
  return (
    <>
      <h1>{copy.tabs.profile}</h1>
      {ENTRIES.map(([label, to]) => (
        <button key={to} type="button" className="btn btn-quiet btn-row" id={'go-' + to.split('/').pop()}
          onClick={() => navigate(to, 'screen')}>
          <span>{label}</span>
          <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      ))}
    </>
  );
}
