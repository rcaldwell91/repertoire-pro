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
      say('Saved to this device.');
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

  /* `assignmentId` is what turns a take into an answer to something the
     coach set. It is passed in by whoever owns the take — the assignment
     card knows perfectly well which assignment it is, so the singer is
     never asked to pick one from a list after the fact. */
  S.send = async function (song, note, btn, assignmentId) {
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

      var forId = assignmentId || song.assignId || null;
      var row = {
        student_id: RP.user.id,
        coach_id: RP.coach.id,
        assignment_id: forId,
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

      /* Submitting the take IS finishing the assignment. Robert: "I save and
         submit that one. It sends off. Now that assignment's checked off."
         So we do not also ask him to press Mark done. */
      if (forId) {
        /* A DAILY assignment is never finished — it is done, or not done, for
           each day, and the calendar works that out from the takes actually
           submitted. Stamping done_at on one would retire it after a single
           day, which is the opposite of what "every day" means. */
        var asg = (RP.assignments || []).find(function (x) { return x.id === forId; });
        /* A submitted take is practice that demonstrably happened, so it
           counts towards the week — days practised, and the seven-day strip
           on both phones. This is not an invented number: the audio is in the
           bucket and the row is in the table. Without it Robert could do his
           assignment every morning and the scorecard would still read
           "nothing measured yet", which would be the app lying by omission. */
        try {
          if (RP.logResult) RP.logResult({
            kind: 'practice',
            label: (asg && asg.title) || song.title || 'Assignment'
          });
        } catch (e) {}
        if (asg && asg.cadence === 'daily') {
          say('Submitted to ' + RP.coach.display_name + '. Today is ticked off.');
        } else {
          var d = await RP.sb.from('assignments')
            .update({ done_at: new Date().toISOString() })
            .eq('id', forId).is('done_at', null);
          if (d.error) say('Sent, but it did not tick off: ' + d.error.message);
          else say('Submitted to ' + RP.coach.display_name + '. That one is done.');
        }
      } else {
        say('Sent to ' + RP.coach.display_name + '.');
      }
      S.redraw();
      if (RP.refresh) RP.refresh();
      return true;
    } catch (e) {
      say('Could not send it: ' + ((e && e.message) || e));
      return false;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = song.sentAt ? 'Send again' : 'Send to coach'; }
    }
  };

  /* Until now sentAt was written to the phone and never shown: the lists
     are built once and were never rebuilt after a send, so a submitted take
     looked exactly like an unsubmitted one. Redraw them. */
  S.redraw = function () {
    try { if (window.RPStudio && RPStudio.fillTakes) RPStudio.fillTakes(); } catch (e) {}
    try { if (window.RPWork) RPWork.refresh(); } catch (e) {}
    ['rpTakeList', 'rpVList'].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      var kind = id === 'rpTakeList' ? 'pitch' : 'song';
      box.innerHTML = S.listHtml(kind);
      S.wireList(box, kind, box._rpOnLoad || null);
    });
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
    /* Takes recorded against an assignment are NOT loose takes. They live on
       their own assignment card and are submitted from there, so they are
       kept out of this list rather than offering a second, contextless way
       to send the same thing. */
    var list = takes().filter(function (s) { return !s.assignId; });
    if (!list.length) {
      return '<div class="rp-empty" style="padding:8px 2px">Nothing kept yet. Record something above.</div>';
    }
    var h = '';
    list.slice(0, 12).forEach(function (s) {
      var hasNotes = !!(s.notes && s.notes.length);
      /* The pitch line, drawn on the take itself. Hearing it back without
         seeing where you were is the half that teaches you nothing. */
      var svg = (hasNotes && window.RPStudio && RPStudio.lineHtml)
        ? RPStudio.lineHtml(s.notes, s.id) : '';
      h += '<div class="rp-card" style="padding:11px">' +
        '<div class="rp-ttl">' + esc(s.title) +
        (hasNotes ? '<span class="rp-tag">notes</span>' : '') +
        (s.fx ? '<span class="rp-tag">effects</span>' : '') +
        (s.sentAt ? '<span class="rp-tag">sent</span>' : '') + '</div>' +
        (s.sentAt ? '<div class="rp-sub" style="margin:4px 0 0">Sent to your coach.</div>' : '') +
        svg +
        '<div class="row" style="gap:6px;margin-top:8px">' +
        '<button class="btn" data-hear="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Listen</button>' +
        (kind === 'pitch'
          ? '<button class="btn" data-load="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Sing along with it</button>'
          : '') +
        (hasNotes ? '<button class="btn" data-map="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Note map</button>' : '') +
        '<button class="btn" data-dl="' + esc(s.id) + '" style="flex:1;padding:9px;font-size:12px">Download</button>' +
        '<button class="btn' + (s.sentAt ? '' : ' primary') + '" data-send="' + esc(s.id) +
        '" style="flex:1;padding:9px;font-size:12px">' + (s.sentAt ? 'Send again' : 'Send to coach') + '</button>' +
        '</div></div>';
    });
    return h;
  };

  /* Robert, 16 Sep: Listen had no stop. */
  S.stopListen = function () {
    if (!S._a) return;
    try { S._a.pause(); } catch (e) {}
    try { URL.revokeObjectURL(S._a._u); } catch (e) {}
    S._a = null;
  };

  S.wireList = function (root, kind, onLoad) {
    if (!root) return;
    root._rpOnLoad = onLoad || root._rpOnLoad || null;
    onLoad = root._rpOnLoad;
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
    root.querySelectorAll('[data-map]').forEach(function (b) {
      on(b, 'click', function () { var s = find(b.dataset.map); if (s && window.RPMaps) RPMaps.fromTake(s); });
    });
    root.querySelectorAll('[data-load]').forEach(function (b) {
      on(b, 'click', function () { var s = find(b.dataset.load); if (s && onLoad) onLoad(s); });
    });
    root.querySelectorAll('[data-hear]').forEach(function (b) {
      on(b, 'click', function () {
        var s = find(b.dataset.hear);
        if (!s) return;
        try {
          S.stopListen();
          try { if (window.RPStudio && RPStudio.stopAll) RPStudio.stopAll(); } catch (e) {}
          var a = new Audio(); a._u = URL.createObjectURL(s.blob); a.src = a._u;
          a.play(); S._a = a;
          var svg = root.querySelector('[data-pl="' + (window.CSS && CSS.escape ? CSS.escape(s.id) : s.id) + '"]');
          if (svg && window.RPStudio && RPStudio.followLine) RPStudio.followLine(svg, a);
        } catch (e) { say('Could not play that one.'); }
      });
    });
  };
})();
