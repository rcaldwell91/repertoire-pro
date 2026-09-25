#!/usr/bin/env bash
# Everything that must be green before a push. Robert's rule: no unchecked claims.
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/preflight.js next.html
node tests/tour.test.js
node tests/taps.test.js
node tests/map.test.js
# these need Robert's own recordings (RP_RECORDINGS, kept outside the repo)
# and are red and loud without them - an unmeasured claim is not a pass
node tests/singer.test.js
node tests/learnsong.test.js
node tests/score.test.js
node tests/placement.test.js
