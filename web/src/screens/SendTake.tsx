import { useEffect, useState } from 'react';
import { copy } from '../core/copy';
import { myCoaches, saveTake, sendTake, takesFor, type Coach, type StoredTake } from '../data/takes';
import { useConductor } from '../shell/conductor-context';
import { useSingerLine, useSong } from '../shell/hooks';
import { review, toStored } from '../shell/take-review';
import { back, navigate, songRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* Send a take to one or more of your coaches (a singer can have several:
   RULEBOOK 1c): the take just made (sending keeps it, as Save does), or one
   already kept (its recording is already online: nothing is uploaded
   again). Only the coaches picked can hear it. */
export function SendTake(props: { id: string; takeId?: string }) {
  const c = useConductor();
  const song = useSong(props.id);
  const singer = useSingerLine(props.id);
  const rv = props.takeId ? null : review(c.take('song:' + props.id), singer?.m ?? null, singer?.hop ?? 0.05, false);
  const [kept, setKept] = useState<StoredTake | null | undefined>(undefined);
  useEffect(() => {
    if (!props.takeId) return;
    let live = true;
    void takesFor(null).then((all) => live && setKept(all.find((t) => t.id === props.takeId) ?? null));
    return () => {
      live = false;
    };
  }, [props.takeId]);
  const hasTake = props.takeId ? !!kept : !!rv;
  const [coaches, setCoaches] = useState<Coach[] | null | 'offline' | undefined>(undefined);
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    myCoaches().then((list) => live && setCoaches(list), () => live && setCoaches('offline'));
    return () => {
      live = false;
    };
  }, []);

  async function send() {
    if (!Array.isArray(coaches)) return;
    const to = coaches.filter((x) => chosen.includes(x.id));
    if (!to.length) return;
    if (kept) await sendTake(kept.id, to);
    else if (rv && song) {
      await saveTake(toStored(rv, props.id, song.title), to);
      c.dropTake();
    } else return;
    back(songRoute(props.id));
  }

  let body;
  if (!hasTake) body = props.takeId && kept === undefined ? null : <p className="line">{copy.send.noTake}</p>;
  else if (coaches === undefined) body = null;
  else if (coaches === null) {
    body = (
      <>
        <p className="line">{copy.send.signIn}</p>
        <button type="button" className="btn btn-quiet" id="send-sign-in" onClick={() => navigate('/profile/account', 'screen')}>
          {copy.send.signInButton}
        </button>
      </>
    );
  } else if (coaches === 'offline') body = <p className="line problem">{copy.send.offline}</p>;
  else if (!coaches.length) body = <p className="line" id="no-coach">{copy.send.none}</p>;
  else {
    body = (
      <>
        <p className="line">{copy.send.pick}</p>
        <div className="choices" role="group" aria-label={copy.send.pick}>
          {coaches.map((x) => (
            <label key={x.id} className="check coach-pick">
              <input type="checkbox" data-coach={x.id} checked={chosen.includes(x.id)}
                onChange={(e) => setChosen((cs) => (e.target.checked ? [...cs, x.id] : cs.filter((y) => y !== x.id)))} />
              <span data-user="coach">{x.name}</span>
            </label>
          ))}
        </div>
        <div className="gap" />
        <button type="button" className="btn" id="send-go" disabled={!chosen.length} onClick={() => void send()}>
          {copy.send.go}
        </button>
      </>
    );
  }

  return (
    <>
      <BackButton label={copy.send.back} onBack={() => back(songRoute(props.id))} />
      <h1>{copy.send.title}</h1>
      {body}
    </>
  );
}
