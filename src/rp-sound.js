/* ======================================================================
   Repertoire Pro — one thing makes a sound at a time.

   Robert, 24 Sep: an unsaved take's listen-back kept playing when he went
   to the Library, and a Library song then played on top of it. Two voices
   in his headphones, and no obvious way to stop either.

   Every part of the app that can make a sound had its own stop, and each
   one only knew about itself. So there is now one owner. Anything about to
   make a sound claims it first, and claiming it stops whatever held it
   before — whoever that was. Nothing has to know about anything else.

   The page going to the background pauses whatever holds it, and a screen
   that is left lets go of it. Both are the same idea as the claim: the
   sound belongs to the thing on screen, not to the app.
   ====================================================================== */
(function () {
  'use strict';
  var S = window.RPSound = {};
  var holder = null;          /* { name, stop } */
  var quiet = false;          /* true while we are the ones doing the stopping */

  /* Take the sound. Whoever had it is stopped first. `stop` is how this
     owner is silenced later; it must be safe to call twice. */
  S.claim = function (name, stop) {
    if (holder && holder.name !== name) {
      var prev = holder;
      holder = null;
      quiet = true;
      try { prev.stop(); } catch (e) {}
      quiet = false;
    }
    holder = { name: name, stop: stop || function () {} };
    return name;
  };

  /* Give it up without stopping anything — for an owner that has already
     stopped itself, or whose sound has ended. */
  S.release = function (name) {
    if (holder && holder.name === name) holder = null;
  };

  S.holder = function () { return holder ? holder.name : null; };

  /* Silence whatever is making a sound, whoever it is. */
  S.stopAll = function (except) {
    if (!holder || holder.name === except) return;
    var prev = holder;
    holder = null;
    quiet = true;
    try { prev.stop(); } catch (e) {}
    quiet = false;
  };

  /* true while a stop is being run by this module, so an owner's own stop
     handler can tell "I was replaced" from "the singer pressed stop" */
  S.stopping = function () { return quiet; };

  document.addEventListener('visibilitychange', function () {
    /* Robert's phone going to sleep is not a reason to keep singing at him.
       Owners that can resume (Learn a song, the Pitch Tracker) handle sleep
       themselves; this catches everything that cannot. */
    if (!document.hidden) return;
    if (!holder || holder.pausesItself) return;
    S.stopAll();
  });

  /* An owner that knows how to pause and pick up again says so, and this
     leaves it alone on sleep. */
  S.claimResumable = function (name, stop) {
    S.claim(name, stop);
    if (holder) holder.pausesItself = true;
    return name;
  };
})();
