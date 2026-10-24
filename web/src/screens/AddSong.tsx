/* Goal: add one song from your own files. */
import { useState } from 'react';
import { copy } from '../core/copy';
import { titleFrom } from '../core/song';
import { addSong, holdPicked, picked } from '../data/songs';
import { startSplit } from '../data/split';
import { back, navigate, songRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* The confirm step: the title (editable) and "I own this copy". Saving
   puts the song on the phone straight away, then splitting starts. */
export function AddSong() {
  const [file] = useState(picked);
  const [title, setTitle] = useState(() => (file ? titleFrom(file.name) : ''));
  const [own, setOwn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    if (!file || !own || !title.trim()) return;
    setSaving(true);
    setFailed(false);
    let song;
    try {
      song = await addSong(file, title.trim());
    } catch {
      /* never claimed as saved (the old app's rule) */
      setSaving(false);
      setFailed(true);
      return;
    }
    holdPicked(null);
    void startSplit(song.id);
    navigate(songRoute(song.id), 'screen');
  }

  return (
    <>
      <BackButton label={copy.addSong.back} onBack={() => back('/sing/learn')} />
      <h1>{copy.addSong.title}</h1>
      {!file ? (
        <p className="line">{copy.addSong.noFile}</p>
      ) : (
        <>
          <label className="field">
            <span>{copy.addSong.name}</span>
            <input className="input" id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" id="own-copy" checked={own} onChange={(e) => setOwn(e.target.checked)} />
            <span>{copy.addSong.own}</span>
          </label>
          <button type="button" className="btn" id="save-song" disabled={!own || !title.trim() || saving} onClick={() => void save()}>
            {copy.addSong.save}
          </button>
          {failed && <p className="line problem" id="add-failed" role="status">{copy.addSong.failed}</p>}
        </>
      )}
    </>
  );
}
