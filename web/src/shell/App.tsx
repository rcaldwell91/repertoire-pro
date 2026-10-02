import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Conductor } from '../audio/conductor/conductor';
import { ProfilePage } from '../screens/ProfilePage';
import { SoundCheck } from '../screens/SoundCheck';
import { TabPage } from '../screens/TabPage';
import { TabBar } from '../ui/TabBar';
import { ConductorContext } from './conductor-context';
import { current, navigate, onRoute, tabOf, type Route } from './router';

/* The one screen registry (RULEBOOK 4, Screens). */
const SCREENS: Record<Route, () => ReactNode> = {
  '/home': () => <TabPage tab="home" />,
  '/train': () => <TabPage tab="train" />,
  '/sing': () => <TabPage tab="sing" />,
  '/coach': () => <TabPage tab="coach" />,
  '/learn': () => <TabPage tab="learn" />,
  '/library': () => <TabPage tab="library" />,
  '/profile': () => <ProfilePage />,
  '/profile/sound-check': () => <SoundCheck />,
};

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
          {SCREENS[route]()}
        </main>
        <TabBar active={tabOf(route)} onPick={(t) => navigate(('/' + t) as Route, 'tab')} />
      </div>
    </ConductorContext.Provider>
  );
}
