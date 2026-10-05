import { useEffect, useState } from 'react';
import { copy } from '../core/copy';
import { myCoaches, saveTake, type Coach } from '../data/takes';
import { useConductor } from '../shell/conductor-context';
import { useSingerLine, useSong } from '../shell/hooks';
import { review, toStored } from '../shell/take-review';
import { back, navigate, songRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* Send the take just made to one or more of your coaches (a singer can
   have several: RULEBOOK 1c). Sending keeps the take, as Save does, and
   shares it only with the coaches picked. */
export function SendTake(props: { id: string }) {
  const c = useConductor();
  const song = useSong(props.id);
  const singer = useSingerLine(props.id);
  const rv = review(c.take('song:' + props.id), singer?.m ?? null, singer?.hop ?? 0.05, false);
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
    if (!rv || !song || !Array.isArray(coaches)) return;
    const to = coaches.filter((x) => chosen.includes(x.id));
    if (!to.length) return;
    await saveTake(toStored(rv, props.id, song.title), to);
    c.dropTake();
    back(songRoute(props.id));
  }

  let body;
  if (!rv) body = <p className="line">{copy.send.noTake}</p>;
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
