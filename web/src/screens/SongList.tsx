import { useRef } from 'react';
import { ChevronRight, Music, Plus } from 'lucide-react';
import { copy } from '../core/copy';
import { listLine } from '../core/song';
import { hasOf, holdPicked } from '../data/songs';
import { splitPhase } from '../data/split';
import { useSongs, useUser } from '../shell/hooks';
import { back, navigate, songRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* Learn a song: the songs on this phone, and Add a song. */
export function SongList() {
  const me = useUser();
  const songs = useSongs();
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <BackButton label={copy.songs.back} onBack={() => back('/sing')} />
      <h1>{copy.songs.title}</h1>
      {me ? (
        <>
          <input ref={input} type="file" accept="audio/*" id="pick-song" hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = '';
              if (!f) return;
              holdPicked(f);
              navigate('/sing/learn/add', 'screen');
            }} />
          <button type="button" className="btn" id="add-song" onClick={() => input.current?.click()}>
            <Plus size={20} strokeWidth={2.5} aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 6 }} />
            {copy.songs.add}
          </button>
        </>
      ) : (
        <div className="card" id="sign-in-prompt">
          <p style={{ marginTop: 0 }}>{copy.songs.signInFirst}</p>
          <button type="button" className="btn" id="songs-sign-in" onClick={() => navigate('/profile/account', 'screen')}>
            {copy.songs.signIn}
          </button>
        </div>
      )}
      <div className="gap" />
      {songs && songs.length === 0 && <p className="line">{copy.songs.none}</p>}
      {songs?.map((s) => (
        <button key={s.id} type="button" className="song-row" data-song={s.id} onClick={() => navigate(songRoute(s.id), 'screen')}>
          <Music size={24} strokeWidth={2} aria-hidden="true" />
          <span style={{ flex: 1 }}>
            <strong data-user="title">{s.title}</strong>
            <span className="sub">{listLine(hasOf(s), splitPhase(s.id))}</span>
          </span>
          <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      ))}
    </>
  );
}
