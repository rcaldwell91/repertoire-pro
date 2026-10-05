import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { MoreHorizontal, Play } from 'lucide-react';
import { copy, fill } from '../core/copy';
import { clock } from '../core/time';
import { deleteTake, lastSent, takeUrl, undoDelete, UNDO_MS, type StoredTake } from '../data/takes';
import { useTakes, useUser } from '../shell/hooks';
import { navigate, sendRoute } from '../shell/router';

/* "Your takes" for one song, under the sound card: newest first, with the
   date, the length and the right-note % the app measured; where each one
   has got to online; tap to hear one; a small menu to delete, with undo. */

function when(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function where(t: StoredTake, signedIn: boolean): string {
  const names = (cs: readonly { name: string }[]) => cs.map((x) => x.name).join(', ');
  if (t.sendTo.length) return fill(copy.takes.sending, { names: names(t.sendTo) });
  if (t.sent.length) return fill(copy.takes.sent, { names: names(t.sent) });
  if (t.path) return copy.takes.saved;
  if (t.progress != null) return fill(copy.takes.uploading, { n: Math.floor(t.progress * 100) });
  return signedIn ? copy.takes.onPhone : copy.takes.signIn;
}

export function TakesList(props: { songId: string | null; title?: string; playing: string | null; showSong?: boolean;
  onPlay: (ev: SyntheticEvent, t: StoredTake, url: string) => void }) {
  const takes = useTakes(props.songId, props.title);
  /* where each take can be heard from, ready before it is tapped (a take
     kept online only needs a signed link first) */
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const made = useRef<string[]>([]);
  useEffect(() => () => made.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => {
    if (!takes) return;
    const missing = takes.filter((t) => !urls.has(t.id) && (t.audio || t.path));
    if (!missing.length) return;
    let live = true;
    void Promise.all(missing.map(async (t) => [t.id, await takeUrl(t)] as const)).then((pairs) => {
      const got = pairs.filter((p): p is readonly [string, string] => !!p[1]);
      got.forEach(([, u]) => u.startsWith('blob:') && made.current.push(u));
      if (live && got.length) setUrls((was) => new Map([...was, ...got]));
    });
    return () => {
      live = false;
    };
  }, [takes, urls]);
  const me = useUser();
  const [menu, setMenu] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  /* "Sent to …", once the coaches really have it, during this visit */
  const [since] = useState(() => Date.now());
  const ls = lastSent();
  const confirm = ls && ls.songId === props.songId && ls.at >= since ? fill(copy.takes.sent, { names: ls.names }) : null;
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo]);

  if (!takes || (!takes.length && !undo)) return null;
  return (
    <section className="takes" aria-label={copy.takes.title} id="your-takes">
      <h2>{copy.takes.title}</h2>
      <div className="undo-line" role="status">
        {!undo && confirm && <span id="take-confirm">{confirm}</span>}
        {undo && (
          <>
            <span>{copy.takes.deleted}</span>
            <button type="button" className="btn btn-quiet" id="undo-delete" onClick={() => { undoDelete(undo); setUndo(null); }}>
              {copy.takes.undo}
            </button>
          </>
        )}
      </div>
      <ul>
        {takes.map((t) => (
          <li key={t.id} className="take-row" data-take={t.id} data-playing={props.playing === t.id}>
            <button type="button" className="take-hear" aria-label={copy.takes.hear} disabled={!urls.has(t.id)}
              onClick={(e) => { const u = urls.get(t.id); if (u) props.onPlay(e, t, u); }}>
              <Play size={20} aria-hidden="true" />
              <span>
                {props.showSong
                  ? t.rightPct == null
                    ? fill(copy.takes.rowSongUnscored, { song: t.songTitle, date: when(t.created), length: clock(t.seconds) })
                    : fill(copy.takes.rowSong, { song: t.songTitle, date: when(t.created), length: clock(t.seconds), pct: t.rightPct })
                  : t.rightPct == null
                    ? fill(copy.takes.rowUnscored, { date: when(t.created), length: clock(t.seconds) })
                    : fill(copy.takes.row, { date: when(t.created), length: clock(t.seconds), pct: t.rightPct })}
                <span className="sub take-where">{where(t, !!me)}</span>
              </span>
            </button>
            {menu === t.id ? (
              <span className="take-menu">
                <button type="button" className="btn btn-quiet take-send" onClick={() => { setMenu(null); navigate(sendRoute(t.songId, t.id), 'screen'); }}>
                  {copy.takes.send}
                </button>
                <button type="button" className="btn btn-quiet take-delete" onClick={() => { setMenu(null); deleteTake(t.id); setUndo(t.id); }}>
                  {copy.takes.delete}
                </button>
              </span>
            ) : (
              <button type="button" className="round take-more" aria-label={copy.takes.more} onClick={() => setMenu(t.id)}>
                <MoreHorizontal size={22} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
