/* ======================================================================
   Repertoire Pro — pages, and the tile that opens one.

   Robert, 13 Sep: the pop-up sheets for "Before the voice" and "I want to
   be able to…" are wrong — "sliding up and down while you're trying to
   look through it, it's not great". And the Sing tab is the one screen
   that feels right: an icon in a gradient box, a title, one line, a
   chevron, and tapping it takes you somewhere. "I want the whole app to
   be redone like that."

   So: a PAGE is a whole screen with a back button, and a TILE is the Sing
   tab's card. Everything else in this pass is built out of those two.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  var PG = window.RPPage = {};
  var from = 'home';
  var cur = null;          /* { key, title, holder } while a page is open */
  var hueN = 0;

  function ensure() {
    var d = $('modePage');
    if (d) return d;
    var home = $('modeHome');
    if (!home || !home.parentElement) return null;
    d = document.createElement('div');
    d.id = 'modePage';
    d.className = 'mode';
    home.parentElement.insertBefore(d, home.nextSibling);
    return d;
  }

  /* ---- a tile, the Sing-tab way ------------------------------------ */
  PG.tile = function (o) {
    hueN = (hueN % 5) + 1;
    var hue = o.hue || ('hue' + hueN);
    return '<div class="mcard ' + hue + '" ' + (o.id ? 'id="' + esc(o.id) + '" ' : '') +
      (o.data ? o.data + ' ' : '') + '>' +
      '<div class="mi"><svg class="ic" style="width:22px;height:22px"><use href="#' + esc(o.icon || 'i-play') + '"/></svg></div>' +
      '<div style="min-width:0"><h4>' + esc(o.title) + (o.tag ? ' <span class="extag" style="color:var(--accent)">' + esc(o.tag) + '</span>' : '') + '</h4>' +
      (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' +
      '<div class="chev">›</div></div>';
  };
  PG.tiles = function (list) {
    hueN = 0;
    return '<div class="homegrid">' + list.map(PG.tile).join('') + '</div>';
  };

  /* ---- open / back --------------------------------------------------- */
  function modeName() {
    /* `state` is a top-level const in the base app — reachable by name, not via window */
    try { return (typeof state !== 'undefined' && state.mode) || 'home'; } catch (e) { return 'home'; }
  }

  /* open({ key, title, sub, html, node, wire, back }) — `html` is rendered;
     `node` (an existing element) is MOVED in and given back on close.  */
  PG.open = function (o) {
    var d = ensure();
    if (!d) return null;
    if (!cur) { var m = modeName(); if (m !== 'page') from = m; }
    if (cur && cur.node && cur.home) { try { cur.home.appendChild(cur.node); } catch (e) {} }
    cur = { key: o.key || '', title: o.title || '', node: o.node || null, home: o.node ? o.node.parentElement : null, back: o.back || null };

    d.innerHTML = '<button class="pill backpill" id="rpPageBack">← ' + esc(o.backLabel || 'Back') + '</button>' +
      (o.title ? '<h1 style="margin:0 0 2px">' + esc(o.title) + '</h1>' : '') +
      (o.sub ? '<div class="rp-sub" style="margin:0 0 12px">' + esc(o.sub) + '</div>' : '') +
      '<div id="rpPageBody">' + (o.html || '') + '</div>';
    if (o.node) { $('rpPageBody').appendChild(o.node); o.node.style.display = ''; }

    document.querySelectorAll('.mode').forEach(function (el) { el.classList.remove('active'); });
    d.classList.add('active');
    try { state.mode = 'page'; } catch (e) {}
    window.scrollTo(0, 0);
    on($('rpPageBack'), 'click', PG.back);
    if (o.wire) { try { o.wire($('rpPageBody')); } catch (e) {} }
    return $('rpPageBody');
  };

  PG.body = function () { return $('rpPageBody'); };
  PG.isOpen = function (key) { return !!cur && (!key || cur.key === key); };

  PG.back = function () {
    var was = cur;
    cur = null;
    if (was && was.node && was.home) { try { was.node.style.display = 'none'; was.home.appendChild(was.node); } catch (e) {} }
    if (was && was.back) { try { was.back(); return; } catch (e) {} }
    try { window.switchMode(from === 'page' ? 'home' : from); } catch (e) {}
  };

  /* leaving by the bottom nav must stand the page down, like every other
     screen the base app does not know about */
  (function install() {
    var n = 0;
    var iv = setInterval(function () {
      if (typeof window.switchMode !== 'function') { if (++n > 50) clearInterval(iv); return; }
      clearInterval(iv);
      var prev = window.switchMode;
      window.switchMode = function (m) {
        var d = $('modePage');
        if (m !== 'page') {
          if (d) d.classList.remove('active');
          if (cur) {
            var was = cur; cur = null;
            if (was.node && was.home) { try { was.node.style.display = 'none'; was.home.appendChild(was.node); } catch (e) {} }
          }
        }
        return prev.apply(this, arguments);
      };
    }, 200);
  })();
})();
