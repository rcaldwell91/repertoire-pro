import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Conductor } from '../audio/conductor/conductor';
import { Account } from '../screens/Account';
import { AddSong } from '../screens/AddSong';
import { Look } from '../screens/Look';
import { ProfilePage } from '../screens/ProfilePage';
import { SingPage } from '../screens/SingPage';
import { SongList } from '../screens/SongList';
import { SongScreen } from '../screens/SongScreen';
import { SoundCheck } from '../screens/SoundCheck';
import { TabPage } from '../screens/TabPage';
import { TabBar } from '../ui/TabBar';
import { ConductorContext } from './conductor-context';
import { current, navigate, onRoute, SONG_ROUTE, tabOf, type Route } from './router';

/* The one screen registry (RULEBOOK 4, Screens). */
const SCREENS: Record<string, () => ReactNode> = {
  '/home': () => <TabPage tab="home" />,
  '/train': () => <TabPage tab="train" />,
  '/sing': () => <SingPage />,
  '/coach': () => <TabPage tab="coach" />,
  '/learn': () => <TabPage tab="learn" />,
  '/library': () => <TabPage tab="library" />,
  '/profile': () => <ProfilePage />,
  '/profile/sound-check': () => <SoundCheck />,
  '/profile/account': () => <Account />,
  '/profile/look': () => <Look />,
  '/sing/learn': () => <SongList />,
  '/sing/learn/add': () => <AddSong />,
};

function screenFor(route: Route): ReactNode {
  const song = SONG_ROUTE.exec(route);
  if (song) return <SongScreen id={song[1]} />;
  return SCREENS[route]();
}

export function App(props: { conductor: Conductor }) {
  const [route, setRoute] = useState<Route>(current);

  useEffect(
    () =>
      onRoute((to, why) => {
        /* leaving a screen, by tab, by link or by Back: silence first */
        props.conductor.leave(why);
        setRoute(to);
        window.scrollTo(0, 0);
      }),
    [props.conductor],
  );

  return (
    <ConductorContext.Provider value={props.conductor}>
      <div className="app">
        <main className="screen" key={route} data-screen={route}>
          {screenFor(route)}
        </main>
        <TabBar active={tabOf(route)} onPick={(t) => navigate(('/' + t) as Route, 'tab')} />
      </div>
    </ConductorContext.Provider>
  );
}
