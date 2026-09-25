#!/usr/bin/env bash
# Everything that must be green before a push. Robert's rule: no unchecked claims.
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/preflight.js next.html
node tests/tour.test.js
node tests/taps.test.js
node tests/map.test.js
# last, because it is the one that needs a real singer and will be red
# until a take is sent. A loud red here is the honest state of the evidence.
node tests/singer.test.js
node tests/learnsong.test.js
