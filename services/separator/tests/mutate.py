"""Prove the tests fail on the broken case (RULEBOOK 4, Tests): break one
rule at a time in a copy of the code, run the tests against the copy, and
check that they fail. The real code is never touched.

    python tests/mutate.py
"""
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MUTATIONS = [
    ('expired tokens are let in', 'auth.py', "leeway=0,", "leeway=10**9,", 'test_auth.py test_api.py'),
    ('the signature is not checked', 'auth.py', "options={'require'", "options={'verify_signature': False, 'require'", 'test_auth.py'),
    ('anonymous sign-ins are let in', 'auth.py', "if claims.get('is_anonymous') is True:", "if False:", 'test_auth.py'),
    ('another project\'s tokens are let in', 'auth.py', "issuer=self._issuer, ", "", 'test_auth.py'),
    ('no token is let in', 'api.py', "        except Refused as e:\n            log.info('refused: %s', e)\n            return no(401, 'sign in')",
     "        except Refused as e:\n            user = 'nobody'", 'test_api.py'),
    ('the size limit is 10 times bigger', 'jobs.py', 'MAX_BYTES = 30_000_000', 'MAX_BYTES = 300_000_000', 'test_api.py'),
    ('the length is not checked', 'api.py', 'if secs > J.MAX_SECONDS:', 'if False:', 'test_api.py'),
    ('two jobs per person', 'jobs.py', "    key = 'user:' + user\n", "    key = 'user:' + user + job\n", 'test_api.py'),
    ('no cap on everyone', 'jobs.py', 'MAX_JOBS = 3 ', 'MAX_JOBS = 30 ', 'test_api.py'),
    ('a collected result is kept', 'jobs.py', "    files.remove(job, name)\n    rec", "    rec", 'test_api.py'),
    ('the upload is kept while separating', 'worker.py', "        files.remove(job, 'in')                         # the upload", "        pass  # the upload", 'test_worker.py'),
    ('the sweep keeps old files', 'jobs.py', "        if now - born > keep or rec is None:", "        if False:", 'test_api.py'),
    ('results are kept two hours', 'jobs.py', 'KEEP_S = 45 * 60 ', 'KEEP_S = 120 * 60 ', 'test_api.py'),
    ('the first 30 s are handed back one chunk early', 'sep_core.py', 'return min(self.chunks, max(1, math.ceil(need / self.step)))',
     'return min(self.chunks, max(1, math.ceil(need / self.step) - 1))', 'test_worker.py'),
    ('the music is not song minus voice', 'worker.py', 'music = mix - voice', 'music = mix', 'test_worker.py'),
    ('a cancel is ignored', 'sep_core.py', "                if should_stop():\n                    return None", "                pass", 'test_worker.py'),
    ('a result can be collected twice', 'jobs.py', "return store.put(f'got:{job}:{name}', True, skip_if_exists=True)", "store.put(f'got:{job}:{name}', True); return True", 'test_api.py'),
    ('a stranger sees your job', 'api.py', "if not rec or rec.get('user') != user:", "if not rec:", 'test_api.py'),
]

caught = 0
for what, file, old, new, tests in MUTATIONS:
    d = tempfile.mkdtemp(prefix='sep-mutant-')
    try:
        shutil.copytree(HERE, d, dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__', '.pytest_cache'))
        p = os.path.join(d, file)
        s = open(p).read()
        if old not in s:
            print('DOES NOT APPLY:', what)
            continue
        open(p, 'w').write(s.replace(old, new))
        r = subprocess.run([sys.executable, '-m', 'pytest', '-q', '-x', '-W', 'ignore', '-p', 'no:cacheprovider',
                            *[os.path.join('tests', t) for t in tests.split()]], cwd=d, capture_output=True, text=True)
        if r.returncode != 0:
            caught += 1
            print('caught  ', what)
        else:
            print('MISSED  ', what)
    finally:
        shutil.rmtree(d, ignore_errors=True)
print(f'\n{caught} of {len(MUTATIONS)} broken rules were caught')
sys.exit(0 if caught == len(MUTATIONS) else 1)
