import type { LeaveReason } from '../audio/conductor/conductor';

/* The app's own screens, and the phone's back button walking them
   (RULEBOOK 4, Screens). Every screen has an address after the #, so each
   move is one step in the browser's history and Back goes one step back.
   GitHub Pages has no fallback page, so the # keeps every address on the
   one file. */

export const TABS = ['home', 'train', 'sing', 'coach', 'learn', 'library', 'profile'] as const;
export type Tab = (typeof TABS)[number];

/* Every screen's address. A song's screen carries the song's id. */
export const ROUTES = [
  ...TABS.map((t) => '/' + t),
  '/profile/sound-check', '/profile/account', '/profile/look',
  '/sing/learn', '/sing/learn/add',
] as const;
export type Route = string;
export const SONG_ROUTE = /^\/sing\/learn\/song\/([A-Za-z0-9-]+)$/;
/** sending a song's take to a coach */
export const SEND_ROUTE = /^\/sing\/learn\/song\/([A-Za-z0-9-]+)\/send(?:\/([A-Za-z0-9-]+))?$/;

export function isRoute(r: string): boolean {
  return (ROUTES as readonly string[]).includes(r) || SONG_ROUTE.test(r) || SEND_ROUTE.test(r);
}

export function songRoute(id: string): Route {
  return '/sing/learn/song/' + id;
}

/** send the take just made, or a kept one */
export function sendRoute(id: string, takeId?: string): Route {
  return songRoute(id) + '/send' + (takeId ? '/' + takeId : '');
}

export function tabOf(route: Route): Tab {
  return route.split('/')[1] as Tab;
}

function read(): Route | null {
  const h = location.hash.replace(/^#/, '');
  return isRoute(h) ? h : null;
}

type Listener = (to: Route, why: LeaveReason) => void;
const listeners = new Set<Listener>();
let pendingWhy: LeaveReason | null = null;
let depth = 0;

export function current(): Route {
  return read() ?? '/home';
}

/** Go to a screen. `why` is how the screen being left is left. */
export function navigate(to: Route, why: 'tab' | 'screen'): void {
  if (to === current()) return;
  pendingWhy = why;
  depth++;
  location.hash = to;
}

/** One step back through the app's own screens, or to `fallback` if this is
    where the app was opened. */
export function back(fallback: Route): void {
  if (depth > 0) history.back();
  else navigate(fallback, 'screen');
}

export function onRoute(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function startRouter(): void {
  if (!read()) history.replaceState(null, '', '#/home');
  window.addEventListener('hashchange', () => {
    const why = pendingWhy ?? 'back';
    if (pendingWhy === null) depth = Math.max(0, depth - 1);
    pendingWhy = null;
    const to = current();
    listeners.forEach((f) => f(to, why));
  });
}
