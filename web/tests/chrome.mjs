/* A real Chrome, driven through its own debugging protocol.
   Not Playwright: Playwright keeps every page it drives "visible" on
   purpose, so a hidden app could never be tested through it. Here,
   opening another tab really hides the app, as switching apps on a phone
   does. Taps are real input events (the page sees isTrusted = true). */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let nextPort = 9400 + Math.floor(Math.random() * 400);

/* Online tests go through this machine's proxy, which re-signs every site
   with its own certificate. Trust exactly that certificate (by its key),
   and nothing else. */
function proxyTrust() {
  const ca = process.env.RP_PROXY_CA || '/root/.ccr/agent-proxy-ca.crt';
  if (!existsSync(ca)) return [];
  const spki = execSync(`openssl x509 -in '${ca}' -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`).toString().trim();
  return ['--ignore-certificate-errors-spki-list=' + spki];
}

export async function launch({ mic, allowMic, online = false }) {
  const port = nextPort++;
  const profile = mkdtempSync(join(tmpdir(), 'rp-chrome-'));
  const args = [
    '--headless', '--no-sandbox', '--no-first-run', '--disable-background-networking',
    '--disable-component-update', '--disable-default-apps', '--disable-domain-reliability', '--no-pings',
    /* online: reach the real separator and sign-in, through this machine's proxy */
    ...(online && process.env.HTTPS_PROXY
      ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost', ...proxyTrust()]
      : ['--no-proxy-server']),
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--use-fake-device-for-media-stream',
    '--use-file-for-fake-audio-capture=' + mic,
    ...(allowMic ? ['--use-fake-ui-for-media-stream'] : []),
    'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  let version;
  for (let i = 0; i < 50 && !version; i++) {
    try {
      version = await (await fetch(base + '/json/version')).json();
    } catch {
      await sleep(200);
    }
  }
  if (!version) throw new Error('Chrome did not start');
  const browser = await connect(version.webSocketDebuggerUrl);
  const list = await (await fetch(base + '/json/list')).json();
  const first = list.find((t) => t.type === 'page');
  const page = new Page(await connect(first.webSocketDebuggerUrl), first.id);
  await page.ready();
  return {
    page,
    browser,
    /** another tab in front: the app is hidden, for real */
    async hide() {
      const t = await (await fetch(base + '/json/new?about:blank', { method: 'PUT' })).json();
      return async () => {
        await fetch(base + '/json/activate/' + page.id);
        await fetch(base + '/json/close/' + t.id);
      };
    },
    async close() {
      try {
        await browser.send('Browser.close');
      } catch {
        /* gone */
      }
      proc.kill();
      await sleep(200);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((ok, bad) => {
    ws.onopen = ok;
    ws.onerror = bad;
  });
  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const [ok, bad] = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) bad(new Error(d.error.message));
      else ok(d.result);
    } else if (d.method) {
      for (const fn of handlers.get(d.method) || []) fn(d.params);
    }
  };
  return {
    send(method, params = {}) {
      return new Promise((ok, bad) => {
        const i = ++id;
        pending.set(i, [ok, bad]);
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    },
    on(method, fn) {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(fn);
    },
    once(method) {
      return new Promise((ok) => {
        const fn = (p) => {
          handlers.set(method, handlers.get(method).filter((f) => f !== fn));
          ok(p);
        };
        this.on(method, fn);
      });
    },
  };
}

class Page {
  constructor(conn, id) {
    this.c = conn;
    this.id = id;
    this.errors = [];
  }
  async ready() {
    await this.c.send('Page.enable');
    await this.c.send('Runtime.enable');
    this.c.on('Runtime.exceptionThrown', (p) => this.errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
    /* a phone-sized screen */
    await this.c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  }
  async addInitScript(source) {
    await this.c.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }
  async goto(url) {
    const loaded = this.c.once('Page.loadEventFired');
    await this.c.send('Page.navigate', { url });
    await loaded;
  }
  async eval(expression) {
    const r = await this.c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async waitFor(expression, ms = 5000) {
    const end = Date.now() + ms;
    for (;;) {
      if (await this.eval(expression)) return true;
      if (Date.now() > end) return false;
      await sleep(20);
    }
  }
  /** a real tap in the middle of the element */
  async tap(selector) {
    const box = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) throw new Error('nothing to tap: ' + selector);
    const at = { x: box.x, y: box.y, button: 'left', clickCount: 1 };
    await this.c.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at });
    await this.c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at });
  }
  /** the phone's back button: the browser's own history. False if there
      is nothing to go back to (Back would leave the app). */
  async back() {
    const h = await this.c.send('Page.getNavigationHistory');
    if (h.currentIndex < 1) return false;
    await this.c.send('Page.navigateToHistoryEntry', { entryId: h.entries[h.currentIndex - 1].id });
    return true;
  }
  /** choose files in a file input, as the phone's picker would */
  async setFiles(selector, paths) {
    const { root } = await this.c.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await this.c.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) throw new Error('no file input: ' + selector);
    await this.c.send('DOM.setFileInputFiles', { nodeId, files: paths });
  }
  /** type into whatever has focus, as a keyboard would */
  async type(text) {
    await this.c.send('Input.insertText', { text });
  }
  /** press a key on whatever has focus */
  async key(key, times = 1) {
    const codes = { PageDown: 34, PageUp: 33, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35 };
    for (let i = 0; i < times; i++) {
      for (const type of ['keyDown', 'keyUp']) {
        await this.c.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: codes[key] || 0 });
      }
    }
  }
  /** make a server unreachable (pattern like *modal.run*), or reachable again (null) */
  async cutOff(pattern) {
    if (!this.cutting) {
      this.cutting = true;
      this.c.on('Fetch.requestPaused', (p) => {
        void this.c.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' });
      });
    }
    if (pattern) await this.c.send('Fetch.enable', { patterns: [{ urlPattern: pattern }] });
    else await this.c.send('Fetch.disable');
  }
  async screenshot() {
    const r = await this.c.send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(r.data, 'base64');
  }
}
