#!/usr/bin/env bash
# Builds next.html = index.html (v10.1, untouched) + the cloud layer.
# index.html stays the live build until we swap. next.html is the test page.
set -euo pipefail
cd "$(dirname "$0")"

for f in src/rp-cloud.js src/rp-coach.js; do
  node --check "$f"
done

python3 - <<'PY'
base = open('index.html', encoding='utf-8').read()
mods = []
for f in ('src/rp-cloud.js', 'src/rp-coach.js'):
    mods.append('<script>\n' + open(f, encoding='utf-8').read() + '\n</script>')
block = '\n<!-- ===== Repertoire Pro cloud layer (accounts, coach channel) ===== -->\n' + '\n'.join(mods) + '\n'
marker = '</body>'
assert base.count(marker) == 1, 'expected exactly one </body>'
out = base.replace(marker, block + marker)
open('next.html', 'w', encoding='utf-8').write(out)
print('next.html written:', len(out), 'bytes')
PY
