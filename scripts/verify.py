"""Public integrity verification for a selected or batched build."""
import argparse,hashlib,json
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from urllib.request import Request,urlopen
from config import ROOT
parser=argparse.ArgumentParser();parser.add_argument('--url',default='https://caibinice.com/');args=parser.parse_args()
manifest=json.loads((ROOT/'dist/release-manifest.json').read_text(encoding='utf-8'));url=args.url.rstrip('/')+'/'
def check(item):
 with urlopen(Request(url+item['path'],headers={'Accept-Encoding':'identity'}),timeout=30) as r:
  assert r.status==200 and hashlib.sha256(r.read()).hexdigest()==item['sha256'],item['path']
  if item['path'].endswith(('.mjs','.js')):assert r.headers['Content-Type'].startswith('application/javascript')
with ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(check,manifest['files']))
for game in manifest['games']:
 for name in ['not-found.mjs','credentials/config.ini','tests/test.mjs']:
  try:urlopen(url+'games/'+game['id']+'/'+name,timeout=30);raise AssertionError('Expected 404')
  except HTTPError as e:assert e.code==404
 with urlopen(url+'games/'+game['id'],timeout=30) as r:assert r.url==url+'games/'+game['id']+'/'
print(json.dumps({'result':'PASS','games':[g['id'] for g in manifest['games']],'runtime_files':len(manifest['files']),'sha256':'all matched','missing':404,'canonical_slash':True}))
