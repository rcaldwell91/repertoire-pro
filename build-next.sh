#!/usr/bin/env bash
# Builds next.html = index.html (v10.1) + the cloud layer + two tiny hooks.
# index.html itself is never modified. Run this after editing anything in src/.
set -euo pipefail
cd "$(dirname "$0")"

for f in src/rp-cloud.js src/rp-coach.js src/rp-score.js src/rp-plain.js; do node --check "$f"; done
test -s src/rp-skin.css

python3 - <<'PY'
base = open('index.html', encoding='utf-8').read()

# ---------------------------------------------------------------------
# Two hooks into the places where the app has ALREADY worked a number out
# and shown it to the singer. We send that same number on to their coach.
# Nothing here computes, rounds or invents a score of its own.
# ---------------------------------------------------------------------
PATCHES = [
    # 1. Ear drills: score out of rounds, and average distance from the note.
    ("    V10.markPractised('Ear training');",
     "    try { if (window.RP && RP.logResult) RP.logResult({ kind: 'ear',\n"
     "      label: 'Ear · ' + EAR.kind, score: EAR.score, out_of: EAR.rounds, cents: avg }); } catch (e) {}\n"
     "    V10.markPractised('Ear training');"),

    # 2. Steady note: the percentage of the hold that stayed inside the window.
    ("    $('susResult').textContent = pct+'% steady — '+msg;",
     "    $('susResult').textContent = pct+'% steady — '+msg;\n"
     "    try { if (window.RP && RP.logResult) RP.logResult({ kind: 'sustain',\n"
     "      label: 'Steady note', pct: pct, seconds: SUS.dur }); } catch (e) {}"),
]
# ---------------------------------------------------------------------
# Home, in plain words with a sense of where you are in the session.
# "scale ladder", "note maps" and "key guardrails" told a beginner nothing.
# ---------------------------------------------------------------------
WORDS = [
    ('<div class="js">scale ladder &middot; 5 min</div>', '<div class="js">Step 1 &middot; 5 min</div>'),
    ('<div class="js">scale ladder · 5 min</div>',        '<div class="js">Step 1 · 5 min</div>'),
    ('<div class="js">note match · 5 min</div>',          '<div class="js">Step 2 · 5 min</div>'),
    ('<div class="js">your song · 5 min</div>',           '<div class="js">Step 3 · 5 min</div>'),
    ('<p>Warmups &amp; exercises, on the keys</p>',
     '<p>Exercises that build your voice, a level at a time</p>'),
    ('<p>Your song &mdash; note bars, words, scoring</p>',
     '<p>Sing a song and see every note you hit</p>'),
    ('<p>Sing with any video &mdash; key guardrails</p>',
     '<p>Sing along to any video, kept in your range</p>'),
    ('<p>Songs, takes &amp; note maps</p>',
     '<p>Your songs, and every take you have recorded</p>'),
    ('<p>Your voice, live on the keyboard</p>',
     '<p>See your voice on the keys as you sing</p>'),
    ('<p>Note bars, words &amp; scoring &mdash; your songs, takes or built-ins</p>',
     '<p>Sing a song and see every note you hit</p>'),
    ('<p>Karaoke over songs you own, with key rails</p>',
     '<p>Sing over songs you own, kept in your range</p>'),
    ('<p>Live pitch on the keys — see the exact note</p>',
     '<p>See your voice on the keys as you sing</p>'),
]
for a, r in WORDS:
    if a in base:
        base = base.replace(a, r)

for anchor, replacement in PATCHES:
    n = base.count(anchor)
    assert n == 1, 'anchor found %d times, expected 1: %r' % (n, anchor[:60])
    base = base.replace(anchor, replacement, 1)

mods = ['<style>\n' + open('src/rp-skin.css', encoding='utf-8').read() + '\n</style>']
for f in ('src/rp-cloud.js', 'src/rp-coach.js', 'src/rp-score.js', 'src/rp-plain.js'):
    mods.append('<script>\n' + open(f, encoding='utf-8').read() + '\n</script>')
block = '\n<!-- ===== Repertoire Pro cloud layer (accounts, coach channel, scorecards) ===== -->\n' \
        + '\n'.join(mods) + '\n'

marker = '</body>'
assert base.count(marker) == 1, 'expected exactly one </body>'
open('next.html', 'w', encoding='utf-8').write(base.replace(marker, block + marker))
print('next.html written, %d hooks applied' % len(PATCHES))
PY
