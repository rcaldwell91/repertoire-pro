/* ======================================================================
   Repertoire Pro — the tab order.
   Robert, 13 Sep: Home, Train, Sing, Coach, Learn, Library, Profile.
   The base app builds the bar once from its own list; the buttons are
   real nodes with their own click handlers, so they are simply put in
   his order.
   ====================================================================== */
(function () {
  'use strict';
  var ORDER = ['navHome', 'navTrain', 'navSing', 'navCoach', 'navLearn', 'navLib', 'navYou'];
  var n = 0;
  var iv = setInterval(function () {
    var nav = document.querySelector('.bottomnav');
    if (!nav || !document.getElementById('navCoach')) { if (++n > 60) clearInterval(iv); return; }
    clearInterval(iv);
    ORDER.forEach(function (id) {
      var b = document.getElementById(id);
      if (b) nav.appendChild(b);
    });
  }, 250);
})();
