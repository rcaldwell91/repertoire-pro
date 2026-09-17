#!/usr/bin/env bash
# Everything that must be green before a push. Robert's rule: no unchecked claims.
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/preflight.js next.html
node tests/tour.test.js
node tests/taps.test.js
