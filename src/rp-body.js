/* ======================================================================
   Repertoire Pro — the body, before the voice.

   Robert, 13 Sep: "let's do the massage and stretches — you're doing the
   research. Do a deep dive. I'll add the accounts I find later, or
   whenever; we should try to update our catalogues over time anyway."

   The research is in Drive: "RESEARCH: stretches, self-massage and the body
   before the voice". Three things came out of it that shaped this file, and
   two of them are refusals.

   1. THE APP MUST NEVER TELL ANYONE TO MASSAGE THEIR LARYNX.
      The technique with real evidence behind it — manual circumlaryngeal
      therapy — is a trained clinician doing it TO you. The middle of the
      neck carries the carotid artery, the jugular, the vagus nerve, the
      thyroid and a hyoid bone that breaks. There is a published case report
      of an ischaemic stroke from self-administered carotid sinus massage.
      So there is no throat item in here, there is no diagram of where to
      press, and the safety panel says so in the app's own voice. What IS
      here is jaw, tongue, face, shoulders and posture — which is where a
      great deal of singing tension actually lives anyway, because the
      tongue root hangs off the hyoid that carries the larynx.

   2. LONG STATIC STRETCHES MAKE YOU WEAKER.
      Held past about a minute, static stretching costs real strength and
      power. Held briefly, inside a warm-up that also moves, it costs almost
      nothing and may protect you. So every hold in here is short and every
      item says so, and the section is placed BEFORE the voice work rather
      than sold as a separate wellness corner.

   3. ONE ITEM IS NOT EVIDENCED AND IS LABELLED AS SUCH.
      Shaking — the thing Robert saw on Instagram — is almost certainly TRE.
      The mechanism is plausible and the practice is harmless and common,
      but what I could find was practitioner material and the method's own
      literature. It is in, because performers really do this and it costs
      nothing. It is labelled "what singers do" rather than "what is shown
      to work", because those are different sentences and this app has never
      blurred them.

   A NOTE ON NUMBERS: the sandbox could search the web but was blocked from
   opening the journals themselves. So not one figure from that research is
   printed on screen here. The guidance is directional and written as
   guidance; the moment somebody wants to put "4 to 7 per cent" in front of
   a user, they open the paper first.

   THE CATALOGUE IS MEANT TO GROW. Robert is finding an Instagram account and
   expects to add to this over time. Every item is one entry in ITEMS below,
   with the same shape, so adding one is adding an object.
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

  var B = window.RPBody = {};

  /* Each item: what it is · how long · how · what it is NOT · how sure we are.
     `sure` is the honest label, and it is shown: 'why' means there is a
     mechanism and a literature behind it, 'practice' means singers do it and
     it is harmless, which is a weaker claim and says so. */
  var ITEMS = [
    {
      id: 'stand', name: 'Stand up', secs: 30, sure: 'why',
      what: 'Ribs over hips, head back over your shoulders, knees soft.',
      how: 'Feet under your hips. Let your arms hang. Grow tall from the top of your head rather ' +
           'than pulling your shoulders back. Unlock your knees — locked knees stiffen everything above them.',
      why: 'A head carried forward compresses the whole neck and the larynx with it, and stops the ' +
           'ribs moving. Of everything on this screen this is the one with the most direct line to ' +
           'your voice, and it is free.',
      not: 'Not standing to attention. Effort in the posture is the problem, not the fix.'
    },
    {
      id: 'roll', name: 'Shoulders and arms', secs: 45, sure: 'why',
      what: 'Roll the shoulders, swing the arms. Keep moving.',
      how: 'Ten slow shoulder rolls back. Then let your arms swing across your body, loose, ' +
           'like you are not in charge of them. Breathe normally throughout.',
      why: 'Moving warms tissue in a way holding does not, and the research on warm-ups is fairly ' +
           'blunt that getting the body going first does something vocal exercises alone do not.',
      not: 'Not a stretch. Nothing is held here.'
    },
    {
      id: 'neck', name: 'Sides of the neck', secs: 40, sure: 'why',
      what: 'A short lean to each side. Sides only.',
      how: 'Drop one ear toward that shoulder until you feel a stretch down the side of your neck. ' +
           'Hold about fifteen seconds, breathe, come back up slowly. Other side. Twice each is plenty.',
      why: 'Short is deliberate. Held much past a minute, a static stretch measurably costs you ' +
           'strength and power — so this is brief, and it sits inside a warm-up rather than instead of one.',
      not: 'NOT the front of your throat, and no hands involved. Do not pull your head down with ' +
           'your arm, and do not roll your head backwards in a circle.'
    },
    {
      id: 'jaw', name: 'Let the jaw go', secs: 45, sure: 'why',
      what: 'Unclench, and let it hang.',
      how: 'Rest the heels of your hands on the muscle at the side of your face, above the back ' +
           'teeth — the one that bulges when you clench. Small slow circles, gently. Then let your ' +
           'jaw hang open and wag it side to side, loose. Nothing forced.',
      why: 'When the jaw does not move freely, the muscles under your chin take up the slack and ' +
           'the larynx rides up with them. This is one of the places singing tension genuinely ' +
           'lives, and it is nowhere near anything fragile.',
      not: 'Not opening as wide as you can. If your jaw clicks or hurts, stop — that is a dentist ' +
           'or a physio, not an app.'
    },
    {
      id: 'tongue', name: 'The back of the tongue', secs: 45, sure: 'why',
      what: 'The bit you cannot see, and the bit that pulls on your voice.',
      how: 'Rest a thumb gently in the soft place under your chin — no pressure, just resting — and ' +
           'say "ng… ah… ng… ah". You are feeling whether it stiffens. Then stick your tongue out, ' +
           'let it lie there heavy, and sigh. Then roll it around the outside of your teeth, both ways.',
      why: 'The root of your tongue attaches to the hyoid bone, and the hyoid carries your larynx. ' +
           'A tight tongue root pulls on the voice directly, which is why it can sound like a ' +
           'throat problem when it is not.',
      not: 'Resting, not pressing. No pushing up into the soft tissue under your chin.'
    },
    {
      id: 'face', name: 'Face and lips', secs: 30, sure: 'why',
      what: 'Wake up the bits that make the words.',
      how: 'Screw your whole face up tight for three seconds, then let it go completely. Twice. ' +
           'Then blow through loose lips like a horse until it comes easily.',
      why: 'It costs thirty seconds and it wakes the articulators. The lip blow is also the gentlest ' +
           'way into making sound at all, which is why it opens the warm-ups too.',
      not: 'Not a workout. If the lip blow will not go, your lips are probably dry — have a drink.'
    },
    {
      id: 'shake', name: 'Shake it out', secs: 60, sure: 'practice',
      what: 'Arms out, and shake. Sixty seconds of looking daft.',
      how: 'Hold your arms out in front of you and shake your hands fast and loose. Let it travel ' +
           'up into your arms and shoulders. Add your legs. Then stop dead and stand still for a ' +
           'few breaths and notice what changed.',
      why: 'Performers do this everywhere, and the idea behind it is that a deliberate shake lets ' +
           'the nervous system stand down before you sing.',
      not: 'HONESTLY: this is the one thing on this screen we cannot point at good evidence for. ' +
           'The research is thin and mostly comes from the people who teach it. It is here because ' +
           'it is free, it is harmless, and a great many singers swear by it — not because it has ' +
           'been shown to work.'
    }
  ];
  B.items = ITEMS;

  /* ------------------------------------------------------------------ */
  function sheet(html) {
    var o = $('rpSheet');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpSheet';
      o.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o);
    }
    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);' +
      'border-radius:18px 18px 0 0;width:100%;max-width:560px;padding:20px 16px ' +
      'calc(24px + env(safe-area-inset-bottom,0px));max-height:94vh;overflow-y:auto">' + html + '</div>';
    o.style.display = 'flex';
    return o.firstChild;
  }
  function shut() { var o = $('rpSheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; } }

  function mins() {
    var t = ITEMS.reduce(function (a, x) { return a + x.secs; }, 0);
    return Math.round(t / 60 * 10) / 10;
  }

  B.open = function (openId) {
    var h = '<b style="font-size:18px">Before the voice</b>' +
      '<div class="measured" style="margin-top:8px">About ' + mins() + ' minutes, and none of it ' +
      'makes a sound. Do the lot or pick one — it is not a routine you can fail.</div>';

    /* The safety panel is not small print and is not at the bottom. */
    h += '<div class="rp-card" style="margin-top:14px;padding:13px;border-left:3px solid var(--miss)">' +
      '<div class="rp-lab" style="color:var(--miss)">THE ONE RULE</div>' +
      '<div style="font-size:13.5px;line-height:1.55;margin-top:5px">' +
      '<b>Nothing here touches the front of your throat.</b> You will find videos telling singers ' +
      'to massage their own voice box. We are not going to, and neither should you on your own: the ' +
      'front of the neck carries the artery to your brain and a bone that breaks, and people have ' +
      'been seriously hurt doing it to themselves.</div>' +
      '<div style="font-size:13px;line-height:1.55;margin-top:8px;color:var(--ink-dim)">' +
      'That work is real and it helps — but it is a voice therapist’s hands, in a room with you. ' +
      'If your throat feels tight and it will not settle, that is who to see. An app cannot do it ' +
      'and should not pretend.</div></div>';

    ITEMS.forEach(function (x) {
      var open = x.id === openId;
      h += '<div class="rp-card" style="margin-top:9px;padding:12px">' +
        '<div class="row" style="justify-content:space-between;align-items:center;cursor:pointer" ' +
        'data-body="' + esc(x.id) + '">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(x.name) +
        (x.sure === 'practice' ? '<span class="rp-tag">what singers do</span>' : '') + '</div>' +
        '<div class="rp-sub">' + esc(x.what) + '</div></div>' +
        '<div style="color:var(--ink-faint);font-size:19px">' + (open ? '‹' : '›') + '</div></div>';
      if (open) {
        h += '<div style="margin-top:9px;border-top:1px solid var(--line);padding-top:9px">' +
          '<div class="rp-lab">HOW</div>' +
          '<div style="font-size:13.5px;line-height:1.6;margin-top:3px">' + esc(x.how) + '</div>' +
          '<div class="rp-lab" style="margin-top:11px">WHY</div>' +
          '<div class="measured" style="margin-top:3px">' + esc(x.why) + '</div>' +
          '<div class="rp-lab" style="margin-top:11px;color:var(--gold)">WHAT IT IS NOT</div>' +
          '<div class="measured" style="margin-top:3px">' + esc(x.not) + '</div></div>';
      }
      h += '</div>';
    });

    h += '<div class="measured" style="margin-top:14px;font-size:11.5px">Hold anything here briefly ' +
      'and keep moving. A long stretch before you sing takes strength out of you rather than ' +
      'putting it in — which is the opposite of what most people have been told.</div>';
    h += '<button class="btn" id="rpBodyX" style="width:100%;padding:12px;margin-top:14px">Close</button>';

    var box = sheet(h);
    on($('rpBodyX'), 'click', shut);
    box.querySelectorAll('[data-body]').forEach(function (el) {
      on(el, 'click', function () {
        B.open(el.dataset.body === openId ? null : el.dataset.body);
      });
    });
  };

  /* ------------------------------------------------------------------ */
  /* where it lives: the top of Train, before the singing               */
  /* ------------------------------------------------------------------ */
  function mount() {
    var host = $('modeTrain');
    if (!host || $('rpBodyRow')) return;
    var d = document.createElement('div');
    d.id = 'rpBodyRow';
    d.className = 'exrow';
    d.style.cursor = 'pointer';
    d.innerHTML = '<div class="exhead">' +
      '<div class="exname">Before the voice</div>' +
      '<button class="btn" id="rpBodyGo" style="padding:7px 12px;font-size:12px">Open</button>' +
      '</div>' +
      '<div class="exsyl" style="margin-top:6px;font-weight:600">Posture, jaw, tongue, shoulders. ' +
      'About ' + mins() + ' minutes, no sound.</div>' +
      '<div class="measured">The body first. Nothing here goes near your throat, and one of them ' +
      'says plainly that it is not evidenced.</div>';
    host.insertBefore(d, host.firstChild);
    on($('rpBodyGo'), 'click', function (e) { e.stopPropagation(); B.open(); });
    on(d, 'click', function () { B.open(); });
  }

  setInterval(mount, 1500);
  setTimeout(mount, 1000);
})();
