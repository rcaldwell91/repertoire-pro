/* ======================================================================
   Repertoire Pro — getting a take off the phone.

   Three things, which Robert asked for as three things:
     · SEND to your coach — the audio, and for a Pitch Tracker take the note
       line with it, so he can see where you were as well as hear it.
     · DOWNLOAD to the phone, so a take is yours and not trapped in an app.
     · SHARE a Free Sing song the same way.

   Audio goes to a PRIVATE bucket, in a folder named after you. Nobody can
   reach it with a link alone: your coach gets it because the database says
   he teaches you, and the app asks for a signed address that expires.
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
  function say(m) { if (window.RP && RP.toast) RP.toast(m); }

  var S = window.RPSend = {};

  function takes() {
    try {
      return (LIB.songs || [])
        .filter(function (s) { return s.kind === 'recording' && s.blob; })
        .sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
    } catch (e) { return []; }
  }

  function ext(type) {
    if (!type) return 'webm';
    if (type.indexOf('mp4') >= 0) return 'm4a';
    if (type.indexOf('mpeg') >= 0) return 'mp3';
    if (type.indexOf('wav') >= 0) return 'wav';
    if (type.indexOf('ogg') >= 0) return 'ogg';
    return 'webm';
  }

  /* ---------------------------------------------------------------- */
  /* download — the take belongs to the singer                         */
  /* ---------------------------------------------------------------- */
  S.download = function (song) {
    try {
      var url = URL.createObjectURL(song.blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (song.title || 'take').replace(/[^\w\- ]+/g, '') + '.' + ext(song.blob.type);
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 4000);
      say('Saved to your phone.');
    } catch (e) {
      say('This browser would not save it: ' + (e.message || e));
    }
  };

  /* ---------------------------------------------------------------- */
  /* send to the coach                                                 */
  /* ---------------------------------------------------------------- */
  S.canSend = function () {
    return !!(window.RP && RP.user && RP.sb && RP.coach);
  };

  S.send = async function (song, note, btn) {
    if (!window.RP || !RP.user || !RP.sb) { say('Sign in first.'); return false; }
    if (!RP.coach) { say('No coach yet — put their code in on the Coach tab.'); return false; }
    if (!song || !song.blob) { say('That take has no audio.'); return false; }
    if (song.blob.size > 25 * 1024 * 1024) {
      say('That take is too big to send (over 25MB). Record a shorter one.');
      return false;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    var path = RP.user.id + '/' + (song.id || Date.now()) + '.' + ext(song.blob.type);
    try {
      var up = await RP.sb.storage.from('takes').upload(path, song.blob, {
        contentType: song.blob.type || 'audio/webm', upsert: true
      });
      if (up.error) throw up.error;

      var row = {
        student_id: RP.user.id,
        coach_id: RP.coach.id,
        title: song.title || 'A take',
        note: note || '',
        audio_path: path,
        duration: song.duration || null,
        kind: song.notes && song.notes.length ? 'practice' : 'song'
      };
      if (song.notes && song.notes.length) row.notes = song.notes;

      var ins = await RP.sb.from('takes').insert(row);
      if (ins.error) throw ins.error;

      song.sentAt = Date.now();
      try { await dbPut('songs', song); } catch (e) {}
      say('Sent to ' + RP.coach.display_name + '.');
      if (RP.refresh) RP.refresh();
      return true;
    } catch (e) {
      say('Could not send it: ' + ((e && e.message) || e));
      return false;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send to coach'; }
    }
  };

  /* a signed address, good for an hour, so audio is never public */
  S.playable = async function (path) {
    if (!window.RP || !RP.sb || !path) return null;
    try {
      var r = await RP.sb.storage.from('takes').createSignedUrl(path, 3600);
      if (r.error) return null;
      return r.data && r.data.signedUrl;
    } catch (e) { return null; }
  };

  /* ---------------------------------------------------------------- */
  /* the list of your takes, with what you can do with each            */
  /* ---------------------------------------------------------------- */
  S.listHtml = function (kind) {
    var list = takes();
    if (!list.length) {
      return '<div class="rp-empty" style="padding:8px 2px">Nothing kept yet. Record something above.</div>';
    }
    var h = '';
    list.slice(0, 12).forEach(function (s) {
      var hasNotes = !!(s.notes && s.notes.length);
      h += '<div class="rp-card" style="padding:11px">' +
        '<div class="rp-ttl">' + esc(s.title) +
        (hasNotes ? '<span class="rp-tag">notes</span>' : '') +
        (s.fx ? '<span class="rp-tag">effects</span>' : '') +
        (s.sentAt ? '<span class="rp-tag">sent</span>' : '') + '</div>' +
        '<div class="row" style="gap:6px;margin-top:8px">' +
        (kind === 'pitch'
          ? '<button class="btn" data-load="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Sing over it</button>'
          : '<button class="btn" data-hear="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Listen</button>') +
        '<button class="btn" data-dl="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Download</button>' +
        '<button class="btn primary" data-send="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Send to coach</button>' +
        '</div></div>';
    });
    return h;
  };

  S.wireList = function (root, kind, onLoad) {
    if (!root) return;
    function find(id) { return takes().find(function (x) { return x.id === id; }); }
    root.querySelectorAll('[data-dl]').forEach(function (b) {
      on(b, 'click', function () { var s = find(b.dataset.dl); if (s) S.download(s); });
    });
    root.querySelectorAll('[data-send]').forEach(function (b) {
      on(b, 'click', function () {
        var s = find(b.dataset.send);
        if (!s) return;
        if (!S.canSend()) {
          return say(window.RP && RP.user
            ? 'No coach yet — put their code in on the Coach tab.'
            : 'Sign in first, then you can send it to your coach.');
        }
        S.send(s, '', b);
      });
    });
    root.querySelectorAll('[data-load]').forEach(function (b) {
      on(b, 'click', function () { var s = find(b.dataset.load); if (s && onLoad) onLoad(s); });
    });
    root.querySelectorAll('[data-hear]').forEach(function (b) {
      on(b, 'click', function () {
        var s = find(b.dataset.hear);
        if (!s) return;
        try {
          if (S._a) { S._a.pause(); URL.revokeObjectURL(S._a._u); }
          var a = new Audio(); a._u = URL.createObjectURL(s.blob); a.src = a._u;
          a.play(); S._a = a;
        } catch (e) { say('Could not play that one.'); }
      });
    });
  };
})();
