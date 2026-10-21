import type { Env, Store } from '../audio/conductor/conductor';

/* The browser, as the conductor sees it. */
export function browserEnv(): Env {
  return {
    wallMs: () => performance.now(),
    hidden: () => document.visibilityState === 'hidden',
    onHidden(cb) {
      const vis = () => {
        if (document.visibilityState === 'hidden') cb();
      };
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('pagehide', cb);
      return () => {
        document.removeEventListener('visibilitychange', vis);
        window.removeEventListener('pagehide', cb);
      };
    },
    wait: (seconds) => new Promise((r) => setTimeout(r, seconds * 1000)),
  };
}

/** DuckDuckGo's browser will not give the app the microphone (the old
    app, 12 Sep): name the browser, and the one that works. */
export function micBlockedBrowser(): boolean {
  return /DuckDuckGo|Ddg\//.test(navigator.userAgent);
}

/** Remembered on this phone; a private window or full storage just forgets. */
export function localStore(): Store {
  return {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* nothing to keep it in */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* nothing kept */
      }
    },
  };
}
