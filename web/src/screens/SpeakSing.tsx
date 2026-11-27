/* Goal: hear the difference between speaking this line and singing it. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { copy, fill } from '../core/copy';
import { clock } from '../core/time';
import { wav } from '../core/resample';
import { countBeat, gainOf, micLine, monitorOf, COUNT_BEATS, SONG_TOP } from '../core/song';
import { fit, songLines, stretchOf, type Chosen } from '../core/practise';
import type { Plan } from '../audio/conductor/conductor';
import { keepSaid, pairFor, said, type Pair, type Said } from '../data/speak';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { useSingerLine, useSong } from '../shell/hooks';
import { readSingerLine } from '../shell/singer-line';
import { useSongParts } from '../shell/song-parts';
import { micBlockedBrowser } from '../shell/env';
import { hearOn, hearVolume, lineFor, setHearOn, setLineFor } from '../shell/settings';
import { back, navigate, songRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';
import { LinePicker } from '../ui/LinePicker';
import { Slider } from '../ui/Slider';
import { SoundTrouble } from '../ui/SoundTrouble';

/* Speak it, then sing it (Robert's song feature, approved 16 Nov): on the
   line being worked on (the same one as Practise a line), the singer is
   recorded speaking the words in time with the song, then singing them
   the way they spoke them; then the two play back to back, so they can
   hear the difference. Nothing is scored here, and the app never says
   which sounds better. The two are kept on this phone (data/speak). */
type Doing = 'spoken' | 'sung' | 'hear';

export function SpeakSing(props: { id: string }) {
  const c = useConductor();
  const snap = useSnapshot();
  const song = useSong(props.id);
  const singer = useSingerLine(props.id);
  const parts = useSongParts(c, props.id, song);
  const owner = 'speak:' + props.id;
  const playing = c.active() && snap.owner === owner;
  const trouble = snap.owner === owner && !playing ? snap.sound : null;

  useEffect(() => {
    if (parts) readSingerLine(props.id);
  }, [props.id, parts]);
  const total = parts?.total ?? 0;
  const lines = useMemo(() => (singer && !singer.reading && total ? songLines(singer.m, singer.hop, total).filter((l) => l.start < total) : null),
    [singer, total]);
  const [picked, setPicked] = useState<Chosen | null>(() => lineFor(props.id));
  const chosen = lines ? fit(lines, picked) : null;
  const stretch = lines && chosen ? stretchOf(lines, chosen) : null;

  /* the pair kept for this line: one kept for another line is not shown */
  const [kept, setPair] = useState<Pair | null>(null);
  const pair = kept && stretch && Math.abs(kept.start - stretch.start) < 0.01 && Math.abs(kept.end - stretch.end) < 0.01 ? kept : null;
  const from = stretch?.start, to = stretch?.end;
  useEffect(() => {
    let live = true;
    if (from != null && to != null) void pairFor(props.id, from, to).then((p) => live && p && setPair(p));
    return () => {
      live = false;
    };
  }, [props.id, from, to]);

  const [voice, setVoice] = useState(100);
  const [music, setMusic] = useState(100);
  const [hear, setHear] = useState(hearOn);
  const [withMic, setWithMic] = useState(true);
  const [noTake, setNoTake] = useState(false);
  const doing = useRef<Doing | null>(null);
  const [doingNow, setDoingNow] = useState<Doing | null>(null);

  function choose(next: Chosen) {
    if (playing) c.stop();
    setPicked(next);
    setLineFor(props.id, next);
  }

  /* a recording ends (the line played through, or Stop): kept straight away */
  const line = useRef(stretch);
  useEffect(() => {
    line.current = stretch;
  });
  useEffect(() => {
    let was = c.active() && c.snapshot().owner === owner;
    return c.subscribe((sn) => {
      const now = c.active() && sn.owner === owner;
      if (was && !now) {
        const what = doing.current;
        const s = line.current;
        doing.current = null;
        setDoingNow(null);
        if ((what === 'spoken' || what === 'sung') && s) {
          const take = c.take(owner);
          c.dropTake();
          if (take && take.seconds >= 0.5) {
            setNoTake(false);
            void keepSaid(props.id, s.start, s.end, what, said(take.chunks, take.rate, take.seconds)).then(setPair);
          } else {
            setNoTake(true);
          }
        }
      }
      was = now;
    });
  }, [c, owner, props.id]);

  function record(ev: SyntheticEvent, what: 'spoken' | 'sung') {
    if (playing) {
      c.stop();
      return;
    }
    if (!parts || !stretch) return;
    const plan: Plan = { owner, countIn: COUNT_BEATS * countBeat(song?.bpm), countBeats: COUNT_BEATS,
      steps: [{ kind: 'song', urls: parts.urls, from: stretch.start, gains: [gainOf(voice), gainOf(music)], lengths: [stretch.end, stretch.end],
        listen: withMic, record: true, monitor: hear ? monitorOf(hearVolume()) : 0, level: parts.level, onLevel: parts.onLevel }] };
    c.dropTake();
    doing.current = what;
    setDoingNow(what);
    setNoTake(false);
    c.start(c.tap(ev.nativeEvent), plan);
  }

  /* the two, back to back: spoken first, then sung */
  const urls = useMemo(() => {
    if (!pair?.spoken || !pair.sung) return null;
    const url = (s: Said) => URL.createObjectURL(new Blob([wav([s.samples], s.rate)], { type: 'audio/wav' }));
    return [url(pair.spoken), url(pair.sung)];
  }, [pair]);
  useEffect(() => {
    if (!urls) return;
    return () => {
      c.forget(urls);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [urls, c]);
  function hearBoth(ev: SyntheticEvent) {
    if (playing) {
      c.stop();
      return;
    }
    if (!urls) return;
    doing.current = 'hear';
    setDoingNow('hear');
    c.start(c.tap(ev.nativeEvent), { owner, steps: urls.map((url) => ({ kind: 'note' as const, url })) });
  }

  function hearYourself(on: boolean) {
    setHear(on);
    setHearOn(on);
    c.setMonitor(on ? monitorOf(hearVolume()) : 0);
  }

  const mic = playing && doingNow !== 'hear' && withMic ? micLine(snap.mic, micBlockedBrowser()) : null;
  if (song === undefined) return null;
  if (song === null) {
    return (
      <>
        <BackButton label={copy.line.back} onBack={() => back('/sing/learn')} />
        <p className="line">{copy.addSong.noFile}</p>
      </>
    );
  }
  const busy = (w: Doing) => playing && doingNow === w;
  const other = (w: Doing) => playing && doingNow !== w;
  return (
    <>
      <BackButton label={copy.line.back} onBack={() => back(songRoute(props.id))} />
      <h1>{copy.speak.title}</h1>
      <p className="sub" data-user="title">{song.title}</p>

      {!parts && <p className="line">{copy.songs.needsSplit}</p>}
      {parts && !lines && singer?.reading && (
        <p className="line" role="status" id="line-reading">{fill(copy.song.reading, { at: clock(singer.readTo), of: clock(singer.seconds) })}</p>
      )}
      {lines && !lines.length && <p className="line" id="line-none">{copy.line.noSinging}</p>}

      {lines && chosen && stretch && (
        <>
          <LinePicker lines={lines} chosen={chosen} total={total} disabled={playing} onChange={choose} />

          <section className="card speak-step" id="speak-spoken">
            <p>{copy.speak.speakHow}</p>
            <button type="button" className="btn btn-start" id="speak-record" disabled={!parts || other('spoken')}
              onClick={(e) => record(e, 'spoken')}>
              {busy('spoken') ? copy.speak.stop : pair?.spoken ? copy.speak.speakAgain : copy.speak.speak}
            </button>
            <p className="sub" id="speak-spoken-kept">{pair?.spoken ? fill(copy.speak.spoken, { length: clock(pair.spoken.seconds) }) : ''}</p>
          </section>

          <section className="card speak-step" id="speak-sung">
            <p>{copy.speak.singHow}</p>
            <button type="button" className="btn btn-start" id="sing-record" disabled={!parts || !pair?.spoken || other('sung')}
              onClick={(e) => record(e, 'sung')}>
              {busy('sung') ? copy.speak.stop : pair?.sung ? copy.speak.singAgain : copy.speak.sing}
            </button>
            <p className="sub" id="speak-sung-kept">{pair?.sung ? fill(copy.speak.sung, { length: clock(pair.sung.seconds) }) : ''}</p>
          </section>

          {noTake && <p className="problem" id="speak-no-mic" role="status">{copy.speak.noMic}</p>}

          <section className="card speak-step" id="speak-both">
            <button type="button" className="btn btn-start" id="speak-hear" disabled={!urls || other('hear')} onClick={hearBoth}>
              {busy('hear') ? copy.speak.stop : copy.speak.hear}
            </button>
            <p className="hint">{copy.speak.hearing}</p>
            <p className="hint" id="speak-listen">{copy.speak.listen}</p>
            {(pair?.spoken || pair?.sung) && <p className="hint" id="speak-kept">{copy.speak.kept}</p>}
          </section>
        </>
      )}

      <SoundTrouble sound={trouble} onCheck={() => navigate('/profile/sound-check', 'screen')} />
      <div className="mic-line" id="mic-line">
        {mic && <p className="problem" role="status">{mic}</p>}
        {mic && (
          <button type="button" className="btn btn-quiet" id="carry-on" onClick={() => setWithMic(false)}>{copy.song.carryOn}</button>
        )}
      </div>

      <section className="card" aria-label={copy.song.sound}>
        <Slider id="voice-volume" label={copy.song.voice} value={voice} max={SONG_TOP}
          onChange={(v) => { setVoice(v); if (playing && doingNow !== 'hear') c.setGain(0, gainOf(v)); }} />
        <Slider id="music-volume" label={copy.song.music} value={music} max={SONG_TOP}
          onChange={(v) => { setMusic(v); if (playing && doingNow !== 'hear') c.setGain(1, gainOf(v)); }} />
        <label className="switch-row">
          <span>{copy.song.hearYourself}</span>
          <input type="checkbox" role="switch" id="hear-yourself" checked={hear} onChange={(e) => hearYourself(e.target.checked)} />
        </label>
      </section>
    </>
  );
}
