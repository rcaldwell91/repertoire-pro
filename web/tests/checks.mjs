/* Checks shared by the browser tests, run inside the built app's page. */
import { allCopy } from '../src/core/copy.ts';

export const THEMES = ['dark', 'light'];

/** Lines on screen that do not come from core/copy (RULEBOOK 2.4). A line
    made from a template ("Ready to {at} of {of}") counts as from the copy;
    the singer's own words (a song title, marked data-user) are not checked. */
export async function strayWords(page) {
  const known = new Set();
  const templates = [];
  for (const { text } of allCopy()) {
    if (/\{\w+\}/.test(text)) {
      const esc = text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      templates.push(new RegExp('^' + esc.replace(/\\?\{\w+\\?\}/g, '.+') + '$'));
    } else known.add(text);
  }
  const lines = await page.eval(`(() => {
    const mine = [...document.querySelectorAll('[data-user]')];
    mine.forEach((e) => { e.dataset.was = e.style.display; e.style.display = 'none'; });
    const t = document.body.innerText;
    mine.forEach((e) => { e.style.display = e.dataset.was; });
    return t.split('\\n').map((s) => s.trim()).filter(Boolean);
  })()`);
  return lines.filter((l) => !known.has(l) && !templates.some((r) => r.test(l)));
}

/* Every visible word, icon and slider against what is behind it, and the
   voice bar against its track: at least 3:1 (RULEBOOK 3). Behind a
   gradient, the worst of its colours counts. Buttons must set their own
   background. */
function CONTRAST_SRC() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  };
  const lin = (x) => {
    x /= 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const behind = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
        return (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse);
      }
      const c = parse(cs.backgroundColor);
      if (c[3] > 0) return [c];
    }
    return [[255, 255, 255, 1]];
  };
  const worst = (fg, el) => Math.min(...behind(el).map((b) => ratio(fg, b)));
  const shown = (el) => {
    const s = getComputedStyle(el);
    return el.getClientRects().length > 0 && s.visibility === 'visible' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const name = (el) => el.closest('button')?.getAttribute('aria-label') || el.getAttribute('aria-label') || el.id || el.parentElement.textContent.trim().slice(0, 20);
  const pairs = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText || el.tagName.toLowerCase() === 'svg') {
      const fg = parse(getComputedStyle(el).color);
      pairs.push({ what: ownText ? '"' + el.textContent.trim().slice(0, 30) + '"' : 'icon in ' + name(el), ratio: worst(fg, el) });
    }
    if (el.matches('input[role=switch]')) {
      /* a switch draws itself: its outline when off, its fill when on */
      const st = getComputedStyle(el);
      pairs.push({ what: 'switch ' + name(el), ratio: worst(parse(el.checked ? st.backgroundColor : st.borderTopColor), el.parentElement) });
    } else if (el.matches('input[type=range], input[type=checkbox]')) {
      pairs.push({ what: 'control ' + name(el), ratio: worst(parse(getComputedStyle(el).accentColor), el.parentElement) });
    }
  }
  const meter = document.querySelector('[role=meter]');
  if (meter && shown(meter)) {
    pairs.push({ what: 'voice bar on its track', ratio: ratio(parse(getComputedStyle(meter.firstElementChild).backgroundColor), parse(getComputedStyle(meter).backgroundColor)) });
  }
  const unsetButtons = [...document.querySelectorAll('button')]
    .filter((b) => {
      if (!shown(b)) return false;
      const cs = getComputedStyle(b);
      return parse(cs.backgroundColor)[3] < 1 && !cs.backgroundImage.includes('gradient');
    })
    .map((b) => b.getAttribute('aria-label') || b.textContent.trim());
  return { pairs, unsetButtons };
}

export const CONTRAST = '(' + CONTRAST_SRC.toString() + ')()';
