import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Conductor } from './audio/conductor/conductor';
import { WebEngine } from './audio/engine-web/web-engine';
import { copy } from './core/copy';
import { browserEnv, localStore } from './shell/env';
import { App } from './shell/App';
import { startRouter } from './shell/router';
import './ui/tokens.css';

/* The one place the engine is made. Later the phone app swaps in a native
   engine here and nothing else changes (RULEBOOK 1). */
const conductor = new Conductor(new WebEngine(), browserEnv(), localStore());
document.title = copy.app.name;
startRouter();
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App conductor={conductor} />
  </StrictMode>,
);
