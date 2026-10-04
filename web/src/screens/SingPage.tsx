import { AudioLines, ListMusic, Mic, Music } from 'lucide-react';
import { copy } from '../core/copy';
import { navigate } from '../shell/router';

/* Sing: four doors. Only Learn a song opens this round. */
const SOON = [
  { name: copy.sing.pitchTracker, Icon: AudioLines, kind: 'pitch' },
  { name: copy.sing.freeSing, Icon: Mic, kind: 'plain' },
  { name: copy.sing.karaoke, Icon: ListMusic, kind: 'plain' },
];

export function SingPage() {
  return (
    <>
      <h1>{copy.sing.title}</h1>
      <div className="doors">
        <button type="button" className="door" data-kind="songs" id="door-learn" onClick={() => navigate('/sing/learn', 'screen')}>
          <Music size={30} strokeWidth={2} aria-hidden="true" />
          <strong>{copy.sing.learnSong}</strong>
          <span className="chip">{copy.sing.learnSongLine}</span>
        </button>
        {SOON.map(({ name, Icon, kind }) => (
          <div key={name} className="door" data-kind={kind} aria-disabled="true">
            <Icon size={30} strokeWidth={2} aria-hidden="true" />
            <strong>{name}</strong>
            <span className="chip">{copy.sing.soon}</span>
          </div>
        ))}
      </div>
    </>
  );
}
