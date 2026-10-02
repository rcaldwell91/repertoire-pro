import { ChevronRight } from 'lucide-react';
import { copy } from '../core/copy';
import { navigate } from '../shell/router';

export function ProfilePage() {
  return (
    <>
      <h1>{copy.tabs.profile}</h1>
      <button type="button" className="btn btn-quiet btn-row" onClick={() => navigate('/profile/sound-check', 'screen')}>
        <span>{copy.profile.soundCheck}</span>
        <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  );
}
