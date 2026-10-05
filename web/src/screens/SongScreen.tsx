import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Repeat, RotateCcw } from 'lucide-react';
import { copy, fill } from '../core/copy';
import { gainOf, micLine, repeatPart, songLine, MONITOR_GAIN } from '../core/song';
import { barFill } from '../core/level';
import { clock } from '../core/time';
import { FIRST_SECONDS } from '../core/limits';
import type { Plan } from '../audio/conductor/conductor';
import { hasOf } from '../data/songs';
import { startSplit } from '../data/split';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { useSingerLine, useSong, useSplit } from '../shell/hooks';
import { readSingerLine } from '../shell/singer-line';
import { useYourLine } from '../shell/your-line';
import { localStore } from '../shell/env';
import { back, navigate } from '../shell/router';
import { BackButton } from '../ui/BackButton';
import { Slider } from '../ui/Slider';
import { LevelBar } from '../ui/LevelBar';
import { NoteMap } from '../ui/NoteMap';

const HEADPHONES_SEEN = 'rp.hint.headphones';

/* Learn a song, one screen (RULEBOOK 1b): the note map with the singer's
   line and yours, the play bar, back 10 s, Start, repeat this part, and
   one sound card. Start plays the song and, if the mic is allowed, draws
   your line as you sing. The conductor plays and listens; this screen only
   asks and shows. Nothing plays until Start is tapped, and leaving the
   screen or hiding the app means silence and the mic closed (the shell
   tells the conductor). */
export function SongScreen(props: { id: string }) {
  const c = useConductor();
  const snap = useSnapshot();
  const song = useSong(props.id);
  const split = useSplit(props.id);
  const owner = 'song:' + props.id;

  const has = song ? hasOf(song) : null;
  const which: 'full' | 'first30' | null = has?.full ? 'full' : has?.first30 ? 'first30' : null;
  const playing = c.active() && snap.owner === owner;
  const singer = useSingerLine(props.id);
  /* read the singer's line as soon as there is a voice to read it from */
  const voiceParts = has ? (has.full ? 2 : has.first30 ? 1 : 0) : 0;
  useEffect(() => {
    if (voiceParts) readSingerLine(props.id);
  }, [props.id, voiceParts]);

  /* the parts to play, as addresses the engine can load, made once per set
     of parts and given back when the screen is done with them (a sound
     already playing keeps its own copy) */
  const a1 = which === 'full' ? song?.voice : song?.voice30;
  const a2 = which === 'full' ? song?.music : song?.music30;
  const parts = useMemo(
    () => (which && a1 && a2 ? { which, urls: [URL.createObjectURL(a1), URL.createObjectURL(a2)] } : null),
    [which, a1, a2],
  );
  useEffect(() => {
    if (!parts) return;
    return () => {
      c.forget(parts.urls);
      parts.urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [parts, c]);

  const total = parts?.which === 'first30' ? FIRST_SECONDS : song?.seconds ?? 0;
  const [pos, setPos] = useState(0);
  const [voice, setVoice] = useState(100);
  const [music, setMusic] = useState(100);
  const [loop, setLoop] = useState<{ start: number; end: number } | null>(null);
  const [anyOctave, setAnyOctave] = useState(false);
  const [hear, setHear] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const [withMic, setWithMic] = useState(true);
  const shown = total;


  const listening = playing && snap.mic === 'open';
  const you = useYourLine(c, listening, snap.startedAt);
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!listening) return;
    let raf = 0;
    const tick = () => {
      setLevel(barFill(c.level()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [listening, c]);

  /* follow the song while it plays; when it ends, back to the start */
  const lastState = useRef(snap.state);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const p = c.position();
      if (p != null) setPos(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, c]);
  useEffect(() => {
    if (lastState.current !== snap.state && snap.owner === owner && snap.state === 'finished') setPos(0);
    lastState.current = snap.state;
  }, [snap.state, snap.owner, owner]);

  const plan = (from: number, withLoop = loop): Plan | null =>
    parts ? { owner, steps: [{ kind: 'song', urls: parts.urls, from, gains: [gainOf(voice), gainOf(music)], loop: withLoop ?? undefined,
      listen: withMic, monitor: hear ? MONITOR_GAIN : 0 }] } : null;

  function startAt(ev: SyntheticEvent, from: number, withLoop = loop) {
    const p = plan(from, withLoop);
    if (!p) return;
    if (playing) c.stop();
    c.start(c.tap(ev.nativeEvent), p);
  }

  function toggle(ev: SyntheticEvent) {
    if (playing) {
      const p = c.position();
      c.stop();
      if (p != null) setPos(p);
      return;
    }
    startAt(ev, pos >= shown - 0.25 ? 0 : pos);
  }

  function back10(ev: SyntheticEvent) {
    const at = Math.max(0, (playing ? c.position() ?? pos : pos) - 10);
    setPos(at);
    if (playing) startAt(ev, at, loop && (at < loop.start || at >= loop.end) ? null : loop);
    if (loop && (at < loop.start || at >= loop.end)) setLoop(null);
  }

  function repeat(ev: SyntheticEvent) {
    const at = playing ? c.position() ?? pos : pos;
    if (loop) {
      setLoop(null);
      if (playing) startAt(ev, at, null);
      return;
    }
    const part = repeatPart(at, shown);
    setLoop(part);
    setPos(part.start);
    if (playing) startAt(ev, part.start, part);
  }

  const [seeking, setSeeking] = useState<number | null>(null);
  function seekEnd(ev: SyntheticEvent) {
    if (seeking == null) return;
    const at = seeking;
    setSeeking(null);
    setPos(at);
    const keep = loop && at >= loop.start && at < loop.end ? loop : null;
    if (!keep) setLoop(null);
    if (playing) startAt(ev, at, keep);
  }

  const line = useMemo(() => (has ? songLine(has, split) : null), [has, split]);
  const mic = playing && withMic ? micLine(snap.mic) : null;

  function hearYourself(on: boolean) {
    setHear(on);
    c.setMonitor(on ? MONITOR_GAIN : 0);
    if (on) {
      const store = localStore();
      if (!store.get(HEADPHONES_SEEN)) {
        store.set(HEADPHONES_SEEN, '1');
        setHeadphones(true);
      }
    }
  }

  const lines = useMemo(() => ({ singer: singer?.m ?? new Float32Array(0), hop: singer?.hop ?? 0.05, youT: you.t, youM: you.m }), [singer, you]);
  const now = () => (playing ? c.position() ?? pos : seeking ?? pos);

  if (song === undefined) return null;
  if (song === null) {
    return (
      <>
        <BackButton label={copy.song.back} onBack={() => back('/sing/learn')} />
        <p className="line">{copy.addSong.noFile}</p>
      </>
    );
  }

  const at = seeking ?? pos;
  return (
    <>
      <BackButton label={copy.song.back} onBack={() => back('/sing/learn')} />
      <h1 data-user="title">{song.title}</h1>
      <div className="line" id="song-line">
        <span className={line?.action && line.action !== 'split' ? 'problem' : ''} role="status">{line?.text}</span>
        {line?.action === 'sign-in' && (
          <div><button type="button" className="btn btn-quiet" id="line-sign-in" onClick={() => navigate('/profile/account', 'screen')}>
            {copy.song.signInButton}</button></div>
        )}
        {line?.action === 'split' && (
          <div><button type="button" className="btn" id="line-split" onClick={() => void startSplit(props.id)}>
            {copy.song.splitNow}</button></div>
        )}
        {line?.action === 'try-again' && (
          <div><button type="button" className="btn btn-quiet" id="line-try-again" onClick={() => void startSplit(props.id)}>
            {copy.song.tryAgain}</button></div>
        )}
      </div>

      {voiceParts > 0 && (
        <>
          <NoteMap lines={lines} range={singer?.range ?? null} now={now} live={playing} anyOctave={anyOctave} label={copy.song.map} />
          <p className="hint map-line" id="map-line" role="status">
            {singer?.reading ? fill(copy.song.reading, { at: clock(singer.readTo), of: clock(singer.seconds) }) : ''}
          </p>
          <label className="switch-row">
            <span>{copy.song.anyOctave}</span>
            <input type="checkbox" role="switch" id="any-octave" checked={anyOctave} onChange={(e) => setAnyOctave(e.target.checked)} />
          </label>
        </>
      )}

      <div className="playbar">
        <input type="range" id="song-position" aria-label={copy.song.position} min={0} max={Math.max(shown, 0.1)} step={0.1}
          value={Math.min(at, shown)} disabled={!parts}
          onChange={(e) => setSeeking(Number(e.target.value))}
          onPointerUp={seekEnd} onKeyUp={seekEnd} />
        <span className="time" id="song-time">{fill(copy.song.time, { at: clock(at), of: clock(shown) })}</span>
      </div>

      <div className="controls">
        <button type="button" className="round" id="back-10" aria-label={copy.song.back10} disabled={!parts} onClick={back10}>
          <RotateCcw size={24} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className="round play" id="song-play" disabled={!parts} onClick={toggle}>
          {playing ? copy.song.pause : copy.song.start}
        </button>
        <button type="button" className="round" id="repeat-part" aria-label={copy.song.repeat} aria-pressed={!!loop}
          disabled={!parts} onClick={repeat}>
          <Repeat size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <p className="line" style={{ minHeight: '1.5em', textAlign: 'center' }} id="repeat-line">
        {loop ? fill(copy.song.repeating, { from: clock(loop.start), to: clock(loop.end) }) : ''}
      </p>
      <div className="mic-line" id="mic-line">
        {mic && <p className="problem" role="status">{mic}</p>}
        {mic && (
          <button type="button" className="btn btn-quiet" id="carry-on" onClick={() => setWithMic(false)}>
            {copy.song.carryOn}
          </button>
        )}
      </div>

      <section className="card" aria-label={copy.song.sound}>
        <Slider id="voice-volume" label={copy.song.voice} value={voice}
          onChange={(v) => { setVoice(v); if (playing) c.setGain(0, gainOf(v)); }} />
        <Slider id="music-volume" label={copy.song.music} value={music}
          onChange={(v) => { setMusic(v); if (playing) c.setGain(1, gainOf(v)); }} />
        <label className="switch-row">
          <span>{copy.song.hearYourself}</span>
          <input type="checkbox" role="switch" id="hear-yourself" checked={hear} onChange={(e) => hearYourself(e.target.checked)} />
        </label>
        <LevelBar on={listening} fill={listening ? level : 0} label={copy.song.yourLevel} />
        {headphones && <p className="hint" id="headphones">{copy.song.headphones}</p>}
      </section>
    </>
  );
}
