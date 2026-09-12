#!/usr/bin/env bash
# Make the working copy the released app.
#
# next.html is where the half-built things live. index.html is what anyone with
# the link gets. This is the one step between them, and it is deliberate rather
# than automatic: releasing is a decision, not a side effect of saving a file.
set -euo pipefail
cd "$(dirname "$0")"
./build-next.sh
cp next.html index.html
echo "released: index.html is now the same build as next.html"
md5sum next.html index.html
