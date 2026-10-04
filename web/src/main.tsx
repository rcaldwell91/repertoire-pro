import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Conductor } from './audio/conductor/conductor';
import { WebEngine } from './audio/engine-web/web-engine';
import { copy } from './core/copy';
import { browserEnv, localStore } from './shell/env';
import { App } from './shell/App';
import { startRouter } from './shell/router';
import { startTheme } from './shell/theme';
import { startAuth } from './data/auth';
import { resumeSplits, watchSignIns } from './data/split';
import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import './ui/tokens.css';

/* The one place the engine is made. Later the phone app swaps in a native
   engine here and nothing else changes (RULEBOOK 1). */
const conductor = new Conductor(new WebEngine(), browserEnv(), localStore());
document.title = copy.app.name;
startTheme();

/* A magic link arrives with the sign-in in the address. Let the sign-in
   read it before the router does, then go to Account. */
const fromLink = /(^#|&)(access_token|error_description)=/.test(location.hash);
void startAuth().finally(() => {
  if (fromLink) history.replaceState(null, '', location.pathname + location.search + '#/profile/account');
  startRouter();
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App conductor={conductor} />
    </StrictMode>,
  );
  watchSignIns();
  void resumeSplits();
});
