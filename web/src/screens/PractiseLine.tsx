/* Goal: learn one line of this song in three steps, each sung twice. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { copy, fill } from '../core/copy';
import { clock } from '../core/time';
import { countBeat, gainOf, micLine, monitorOf, COUNT_BEATS, SONG_TOP } from '../core/song';
import { fit, passScores, songLines, splitPasses, stretchOf, PASSES, SOUNDS, STEPS, type Chosen, type SoundId } from '../core/practise';
import type { Plan } from '../audio/conductor/conductor';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { useSingerLine, useSong } from '../shell/hooks';
import { readSingerLine } from '../shell/singer-line';
import { useSongParts } from '../shell/song-parts';
import { useYourLine } from '../shell/your-line';
import { localStore, micBlockedBrowser } from '../shell/env';
import { hearOn, hearVolume, lineFor, lineSound, setHearOn, setLineFor, setLineSound } from '../shell/settings';
import { back, navigate, songRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';
import { LinePicker } from '../ui/LinePicker';
import { NoteMap } from '../ui/NoteMap';
import { Slider } from '../ui/Slider';
import { SoundTrouble } from '../ui/SoundTrouble';

/* Practise a line (Robert's song feature, approved 16 Nov): the singer picks
   one line of the song and learns it in three steps, each sung twice as
   the line comes round again: the notes on a light "da"; then on an
   exercise sound, one of Train's own (Lip trills, Mum, Straw singing, as
   Train has them); then with the words, as easily as on the sound. Their
   line is drawn against the song's on Learn a song's map, and each pass is
   scored as Learn a song scores a take. Then the next line, or a longer
   stretch. The conductor plays and listens; this screen asks and shows. */
const ANY_OCTAVE = 'rp.anyOctave';

interface Run {
  readonly step: number;
  readonly scores: Array<number | null>;
  /** how many passes were played */
  readonly reached: number;
  readonly finished: boolean;
}

export function PractiseLine(props: { id: string }) {
  const c = useConductor();
  const snap = useSnapshot();
  const song = useSong(props.id);
  const singer = useSingerLine(props.id);
  const parts = useSongParts(c, props.id, song);
  const owner = 'line:' + props.id;
  const playing = c.active() && snap.owner === owner;
  const trouble = snap.owner === owner && !playing ? snap.sound : null;
  const listening = playing && snap.mic === 'open';
  const you = useYourLine(c, owner, listening, snap.startedAt);
  const anyOctave = localStore().get(ANY_OCTAVE) === '1';

  useEffect(() => {
    if (parts) readSingerLine(props.id);
  }, [props.id, parts]);

  /* the song's lines, once its singer's line is read */
  const total = parts?.total ?? 0;
  const lines = useMemo(() => (singer && !singer.reading && total ? songLines(singer.m, singer.hop, total).filter((l) => l.start < total) : null),
    [singer, total]);
  const [picked, setPicked] = useState<Chosen | null>(() => lineFor(props.id));
  const chosen = lines ? fit(lines, picked) : null;
  const stretch = lines && chosen ? stretchOf(lines, chosen) : null;

  const [step, setStep] = useState(0);
  const [sound, setSoundNow] = useState<SoundId>(() => lineSound(SOUNDS));
  const setSound = (s: SoundId) => {
    setSoundNow(s);
    setLineSound(s);
  };
  const [run, setRun] = useState<Run | null>(null);
  const [voice, setVoice] = useState(100);
  const [music, setMusic] = useState(100);
  const [hear, setHear] = useState(hearOn);
  const [withMic, setWithMic] = useState(true);

  function choose(next: Chosen) {
    if (playing) c.stop();
    setPicked(next);
    setLineFor(props.id, next);
    /* a new line starts from the first step */
    setStep(0);
    setRun(null);
  }

  /* where the second pass began in your line, and how far the run got;
     when it ends (both passes played, or stopped), each pass scored */
  const mark = useRef<{ at: number | null; rounds: number; reached: number; step: number }>({ at: null, rounds: 0, reached: 0, step: 0 });
  const scoring = useRef({ stretch, singer, anyOctave });
  useEffect(() => {
    scoring.current = { stretch, singer, anyOctave };
  });
  useEffect(() => {
    let was = c.active() && c.snapshot().owner === owner;
    return c.subscribe((sn) => {
      const now = c.active() && sn.owner === owner;
      const m = mark.current;
      if (now && sn.state === 'running') {
        m.reached = Math.max(m.reached, sn.step + 1);
        if (sn.step === 1 && m.at == null) {
          m.at = you.t.length;
          m.rounds = you.rounds.length;
        }
      }
      const { stretch: st, singer: sg, anyOctave: any } = scoring.current;
      if (was && !now && st && sg) {
        const passes = splitPasses(you.rounds, { t: you.t, m: you.m }, m.at, m.rounds, m.reached);
        setRun({ step: m.step, scores: passScores(passes, st, sg.m, sg.hop, any), reached: m.reached, finished: sn.state === 'finished' });
      }
      was = now;
    });
  }, [c, owner, you]);

  function sing(ev: SyntheticEvent) {
    if (playing) {
      c.stop();
      return;
    }
    if (!parts || !stretch) return;
    const pass = { kind: 'song' as const, urls: parts.urls, from: stretch.start, gains: [gainOf(voice), gainOf(music)],
      /* the line once: both parts let go at its end */
      lengths: [stretch.end, stretch.end], listen: withMic, monitor: hear ? monitorOf(hearVolume()) : 0, level: parts.level, onLevel: parts.onLevel };
    const plan: Plan = { owner, countIn: COUNT_BEATS * countBeat(song?.bpm), countBeats: COUNT_BEATS, steps: Array.from({ length: PASSES }, () => pass) };
    mark.current = { at: null, rounds: 0, reached: 0, step };
    setRun(null);
    c.start(c.tap(ev.nativeEvent), plan);
  }

  function hearYourself(on: boolean) {
    setHear(on);
    setHearOn(on);
    c.setMonitor(on ? monitorOf(hearVolume()) : 0);
  }

  const lineView = useMemo(() => ({ singer: singer?.m ?? new Float32Array(0), hop: singer?.hop ?? 0.05,
    readTo: singer ? (singer.reading ? singer.readTo : Infinity) : 0, youT: you.t, youM: you.m }), [singer, you, snap.state, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = () => (playing ? c.position() ?? stretch?.start ?? 0 : stretch?.start ?? 0);
  const mic = playing && withMic ? micLine(snap.mic, micBlockedBrowser()) : null;

  if (song === undefined) return null;
  const toSong = () => back(songRoute(props.id));
  if (song === null) {
    return (
      <>
        <BackButton label={copy.line.back} onBack={() => back('/sing/learn')} />
        <p className="line">{copy.addSong.noFile}</p>
      </>
    );
  }

  const here = run && run.step === step ? run : null;
  const stepId = STEPS[step];
  const name = (s: SoundId) => (copy.ex[s] as { name: string; plain?: string }).plain ?? copy.ex[s].name;
  return (
    <>
      <BackButton label={copy.line.back} onBack={toSong} />
      <h1>{copy.line.title}</h1>
      <p className="sub" data-user="title">{song.title}</p>

      {!parts && <p className="line">{copy.songs.needsSplit}</p>}
      {parts && !lines && singer?.reading && (
        <p className="line" role="status" id="line-reading">{fill(copy.song.reading, { at: clock(singer.readTo), of: clock(singer.seconds) })}</p>
      )}
      {lines && !lines.length && <p className="line" id="line-none">{copy.line.noSinging}</p>}

      {lines && chosen && stretch && (
        <>
          <LinePicker lines={lines} chosen={chosen} total={total} disabled={playing} onChange={choose} />
          <NoteMap lines={lineView} range={singer?.range ?? null} now={now} live={playing} anyOctave={anyOctave} label={copy.song.map}
            count={playing && snap.state === 'counting-in' ? snap.count : null} />

          <section className="card line-step" id="line-step" data-step={stepId} aria-label={copy.line.title}>
            <p className="sub" id="line-step-n">{fill(copy.line.step, { n: step + 1 })}</p>
            <h2 id="line-step-title">{stepId === 'notes' ? copy.line.notes : stepId === 'sound' ? copy.line.sound : copy.line.words}</h2>
            {stepId === 'notes' && <p id="line-how">{copy.line.notesHow}</p>}
            {stepId === 'sound' && (
              <>
                <p className="sub">{copy.line.soundPick}</p>
                <div className="line-sounds" role="radiogroup" aria-label={copy.line.soundPick}>
                  {SOUNDS.map((s) => (
                    <button key={s} type="button" className="choice" role="radio" aria-checked={sound === s} data-sound={s}
                      disabled={playing} onClick={() => setSound(s)}>{name(s)}</button>
                  ))}
                </div>
                <p id="line-how">{copy.ex[sound].how}</p>
                {'need' in copy.ex[sound] && <p className="hint" id="line-need">{(copy.ex[sound] as { need: string }).need}</p>}
              </>
            )}
            {stepId === 'words' && (
              <>
                <p id="line-how">{copy.line.wordsHow}</p>
                <p className="hint" id="line-ease">{fill(copy.line.wordsEase, { sound: name(sound) })}</p>
              </>
            )}

            <button type="button" className="btn btn-start" id="line-sing" disabled={!parts} onClick={sing}>
              {playing ? copy.line.stop : copy.line.sing}
            </button>
            <p className="line" id="line-pass" role="status" style={{ minHeight: '1.5em' }}>
              {playing && snap.state === 'running' ? fill(copy.line.pass, { n: snap.step + 1 }) : ''}
            </p>
            {here && (
              <ul className="line-scores" id="line-scores">
                {Array.from({ length: PASSES }, (_, i) => {
                  const pct = here.scores[i];
                  const text = i >= here.reached || i >= here.scores.length ? fill(copy.line.passMissed, { n: i + 1 })
                    : pct == null ? fill(copy.line.passUnscored, { n: i + 1 }) : fill(copy.line.passScore, { n: i + 1, pct });
                  return <li key={i} data-pass={i + 1} data-pct={pct ?? ''}>{text}</li>;
                })}
              </ul>
            )}
            {here?.finished && step === STEPS.length - 1 && <p id="line-done">{copy.line.done}</p>}
            {!playing && (
              <div className="line-moves">
                {here?.finished && step < STEPS.length - 1 && (
                  <button type="button" className="btn" id="line-next-step" onClick={() => setStep(step + 1)}>{copy.line.nextStep}</button>
                )}
                {here?.finished && step === STEPS.length - 1 && chosen.to < lines.length - 1 && (
                  <>
                    <button type="button" className="btn" id="line-on" onClick={() => choose({ from: chosen.to + 1, to: chosen.to + 1 })}>{copy.line.next}</button>
                    <button type="button" className="btn btn-quiet" id="line-on-longer" onClick={() => choose({ from: chosen.from, to: chosen.to + 1 })}>{copy.line.longer}</button>
                  </>
                )}
                {here?.finished && step === STEPS.length - 1 && (
                  <button type="button" className="btn btn-quiet" id="line-restart" onClick={() => { setStep(0); setRun(null); }}>{copy.line.restart}</button>
                )}
                {step > 0 && (
                  <button type="button" className="btn btn-quiet" id="line-back-step" onClick={() => setStep(step - 1)}>{copy.line.backStep}</button>
                )}
              </div>
            )}
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
          onChange={(v) => { setVoice(v); if (playing) c.setGain(0, gainOf(v)); }} />
        <Slider id="music-volume" label={copy.song.music} value={music} max={SONG_TOP}
          onChange={(v) => { setMusic(v); if (playing) c.setGain(1, gainOf(v)); }} />
        <label className="switch-row">
          <span>{copy.song.hearYourself}</span>
          <input type="checkbox" role="switch" id="hear-yourself" checked={hear} onChange={(e) => hearYourself(e.target.checked)} />
        </label>
      </section>
    </>
  );
}
