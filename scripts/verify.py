"""Public HTTP integrity check against the independently built manifest."""
from __future__ import annotations
import hashlib
import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from config import ROOT

URL = 'https://caibinice.com/'
manifest = json.loads((ROOT / 'dist/release-manifest.json').read_text(encoding='utf-8'))
for item in manifest['files']:
    with urlopen(Request(URL + item['path'], headers={'Accept-Encoding': 'identity'}), timeout=30) as response:
        content = response.read()
        assert response.status == 200 and hashlib.sha256(content).hexdigest() == item['sha256'], item['path']
        if item['path'].endswith('.mjs'):
            assert response.headers['Content-Type'].startswith('application/javascript')
try:
    urlopen(URL + 'games/pindou/not-found.mjs', timeout=30)
    raise AssertionError('Missing game file must return 404')
except HTTPError as error:
    assert error.code == 404
with urlopen(URL + 'games/pindou', timeout=30) as response:
    assert response.url == URL + 'games/pindou/' and response.status == 200
print(json.dumps({'result': 'PASS', 'runtime_files': len(manifest['files']), 'sha256': 'all matched', 'missing': 404, 'canonical_slash': True}))
