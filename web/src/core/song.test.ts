import { describe, expect, it } from 'vitest';
import { copy } from './copy';
import { gainOf, listLine, repeatPart, songLine, titleFrom, type SongHas, countBeat, monitorOf, songLevel, MAX_LIFT, MONITOR_DEFAULT, SONG_PEAK } from './song';
import { clock } from './time';

const has = (over: Partial<SongHas> = {}): SongHas => ({ state: 'new', full: false, first30: false, ...over });

describe('the song screen line', () => {
  it('shows real progress: the upload, then how far into the song is ready', () => {
    expect(songLine(has(), { phase: 'sending', fraction: 0.42 }).text).toBe('Sending the song… 42%');
    expect(songLine(has(), { phase: 'splitting', readyS: 30.4, totalS: 279.2 }).text).toBe('Splitting: ready to 0:30 of 4:39');
    expect(songLine(has(), { phase: 'waiting' }).text).toBe(copy.song.waiting);
  });
  it('says what to do about each problem, and offers the one button that helps', () => {
    expect(songLine(has(), { phase: 'problem', problem: 'signed-out' })).toEqual({ text: copy.song.signIn, action: 'sign-in' });
    expect(songLine(has(), { phase: 'problem', problem: 'offline' })).toEqual({ text: copy.song.offline, action: 'try-again' });
    expect(songLine(has(), { phase: 'problem', problem: 'too-big' })).toEqual({ text: copy.song.tooBig, action: null });
    expect(songLine(has(), { phase: 'problem', problem: 'too-long' })).toEqual({ text: copy.song.tooLong, action: null });
    expect(songLine(has({ state: 'problem', problem: 'offline' }), null).action).toBe('try-again');
  });
  it('never says it failed before it has started', () => {
    expect(songLine(has({ state: 'new' }), null)).toEqual({ text: copy.songs.needsSplit, action: 'split' });
    expect(songLine(has({ state: 'splitting' }), null).action).toBeNull();
  });
  it('says ready when the parts are on the phone', () => {
    expect(songLine(has({ state: 'ready', full: true }), null).text).toBe(copy.song.ready);
    expect(songLine(has({ state: 'first30', first30: true }), null).text).toBe(copy.song.first30);
    expect(listLine(has({ full: true }), null)).toBe(copy.songs.ready);
    expect(listLine(has(), { phase: 'waiting' })).toBe(copy.songs.splitting);
  });
});

describe('the controls', () => {
  it('slider 100 is the song\'s own level, 0 is silent', () => {
    expect(gainOf(100)).toBe(1);
    expect(gainOf(0)).toBe(0);
    expect(gainOf(50)).toBeCloseTo(0.25);
    expect(gainOf(150)).toBe(1);
  });
  it('repeats the ten seconds just heard', () => {
    expect(repeatPart(42, 270)).toEqual({ start: 32, end: 42 });
    expect(repeatPart(3, 270)).toEqual({ start: 0, end: 10 });
    expect(repeatPart(3, 6)).toEqual({ start: 0, end: 6 });
  });
  it('makes a title from the file name', () => {
    expect(titleFrom('All_of_Me.mp3')).toBe('All of Me');
    expect(titleFrom('Ride (live).m4a')).toBe('Ride (live)');
  });
  it('counts in at the song\'s own tempo when it is known, else once a second', () => {
    expect(countBeat(undefined)).toBe(1);
    expect(countBeat(120)).toBeCloseTo(0.5);
    expect(countBeat(60)).toBeCloseTo(1);
    expect(countBeat(0)).toBe(1);
    expect(countBeat(900)).toBe(1);               /* not believable */
  });
  it('writes times as minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(30)).toBe('0:30');
    expect(clock(279.9)).toBe('4:39');
    expect(clock(723)).toBe('12:03');
  });
});

/* Robert, 22 Oct: a raw mic with no auto gain is quiet; the Hear yourself
   slider, 0 to 100, reaches about +12 dB over the mic at 100. Default 70. */
describe('the Hear yourself volume', () => {
  it('is off at 0, about +12 dB over the mic at 100, by ear in between', () => {
    expect(monitorOf(0)).toBe(0);
    expect(20 * Math.log10(monitorOf(100))).toBeCloseTo(12, 1);
    expect(monitorOf(50)).toBeCloseTo(monitorOf(100) / 4);
    expect(monitorOf(150)).toBe(monitorOf(100));
    expect(monitorOf(-5)).toBe(0);
  });
  it('starts at 70', () => {
    expect(MONITOR_DEFAULT).toBe(70);
  });
});

/* Robert, 22 Oct: each song brought up to a proper level once, its loudest
   moment at -1 dBFS, voice and music by the same amount. */
describe('a song\'s level', () => {
  it('puts the loudest moment of the song at -1 dBFS', () => {
    expect(20 * Math.log10(SONG_PEAK)).toBeCloseTo(-1, 5);
    expect(songLevel(0.2) * 0.2).toBeCloseTo(SONG_PEAK);
    expect(songLevel(SONG_PEAK)).toBeCloseTo(1);
  });
  it('brings a song that is too loud down to it', () => {
    expect(songLevel(1.6) * 1.6).toBeCloseTo(SONG_PEAK);
  });
  it('never lifts silence or a near-silent file without end', () => {
    expect(songLevel(0)).toBe(1);
    expect(songLevel(NaN)).toBe(1);
    expect(songLevel(1e-6)).toBe(MAX_LIFT);
  });
});
