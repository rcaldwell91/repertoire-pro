#!/usr/bin/env node
/* Repertoire Pro — preflight. The "no unchecked claims" lint.
   Robert, 9 Sep: "double check it to check for errors." This reads the
   BUILT file and flags the one shape that has bitten this project three
   times: a swallowed failure — catch (e) {} or .catch(() => {}) — followed
   within eight lines by a confident message (Saved, Sent, Added, live…)
   with nothing checking the result in between.

   It lints the cloud layer (everything after the marker), because that is
   what this repo changes. base.html is v10.1 and is never modified here;
   its hits are printed as information, not failures.

   Exit 1 on any suspect in the cloud layer. Prints PREFLIGHT CLEAN otherwise. */
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '..', 'next.html');
const src = fs.readFileSync(file, 'utf8');
const marker = 'Repertoire Pro cloud layer';
const cut = src.indexOf(marker);
const base = cut >= 0 ? src.slice(0, cut) : '';
const ours = cut >= 0 ? src.slice(cut) : src;

const SWALLOW = /catch\s*\((\w+)?\)\s*\{\s*\}|\.catch\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>|\w+\s*=>)\s*\{?\s*\}?\s*\)/;
const CLAIM = /(toast|msg|say|exToast)\s*\(\s*['"`](Saved|Sent|Added|Done|Submitted|Uploaded|Signed in|Rebuilt|Mic live|Stored|Kept|Assigned|Paired|Listed|Asked)\b/;
const GUARD = /if\s*\(|\?\s*|return|error|\.then|await|status|ok\b/;

/* Known-safe on purpose, with the reason. A line matching one of these is
   not a claim about the thing that was swallowed. */
const ALLOW = [
  { re: /localStorage\.(setItem|removeItem)/, why: 'cosmetic local write; the claim is about the server call above it' },
  { re: /libRenderPlaylists\(\); libRender\(\);|RPWork\.refresh\(\)/,
    why: 'a screen redraw, not the save — the save is awaited above it and its failure returns first with "Could not save it"' },
  { re: /RP\.toast\(.*(Right|It was|Extras:)/, why: 'a toast about an answer, not about a save' }
];

function lint(text, label) {
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (!SWALLOW.test(lines[i])) continue;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 8); j++) {
      if (GUARD.test(lines[j])) break;
      if (CLAIM.test(lines[j])) {
        const allowed = ALLOW.find(a => a.re.test(lines[i]) || a.re.test(lines[j]));
        if (allowed) break;
        hits.push({ at: j + 1, swallow: lines[i].trim().slice(0, 90), claim: lines[j].trim().slice(0, 90) });
        break;
      }
    }
  }
  return hits;
}

const mine = lint(ours, 'cloud layer');
const theirs = lint(base, 'base');
if (theirs.length) {
  console.log('(info) base.html v10.1 — ' + theirs.length + ' suspect(s), not ours to change:');
  theirs.forEach(h => console.log('   line ' + h.at + ': ' + h.claim));
}
if (mine.length) {
  console.log('PREFLIGHT FAILED — ' + mine.length + ' swallowed failure(s) followed by a confident message:');
  mine.forEach(h => console.log('   ' + h.swallow + '\n      then: ' + h.claim));
  process.exit(1);
}
console.log('PREFLIGHT CLEAN — ' + file.split('/').pop() + ', cloud layer ' + ours.length + ' bytes');
