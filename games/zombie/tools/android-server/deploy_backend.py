"""Activate an isolated native backend with an additive, reversible Nginx route."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import re
import secrets
import shlex
import sys
import tarfile
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'scripts'))
from remote_client import RemoteClient

ROUTES='/etc/nginx/snippets/ai-platform-routes.conf'
MARKER='# begin-zombie-native-backend'
PAGES=['/','/games/','/games/zombie/','/games/pvz/','/smartCockpit/','/quant/','/crossBorderTrend/']


def probe(path):
    try:
        with urlopen('https://caibinice.com'+path,timeout=6) as r:
            body=r.read();return {'path':path,'status':r.status,'sha256':hashlib.sha256(body).hexdigest()}
    except Exception as e:return {'path':path,'error':type(e).__name__}


def deploy(release,work,expected):
    if not re.fullmatch(r'[0-9]{8}-[a-z0-9-]{1,48}',release):raise ValueError('Invalid release')
    work.mkdir(parents=True,exist_ok=True)
    private=work/'private';private.mkdir(exist_ok=True)
    if (private/'api-base.txt').exists():raise ValueError('Private deployment state exists; inspect instead of overwriting')
    with ThreadPoolExecutor(max_workers=4) as pool:before=list(pool.map(probe,PAGES))
    if any(p.get('status')!=200 for p in before):raise RuntimeError('Existing service baseline failed: '+json.dumps(before))
    remote=RemoteClient()
    try:
        with remote.client.open_sftp() as s:original=s.open(ROUTES,'rb').read()
        if hashlib.sha256(original).hexdigest()!=expected:raise RuntimeError('Nginx changed since review')
        if MARKER.encode() in original:raise RuntimeError('Native route already exists')
        (work/'nginx-before.conf').write_bytes(original)
        fragment=(Path(__file__).parent/'nginx-native.conf.example').read_text(encoding='utf-8')
        addition='\n'+MARKER+'\n'+fragment+'\n# end-zombie-native-backend\n'
        candidate=original+addition.encode()
        (work/'nginx-after.conf').write_bytes(candidate)
        prefix='/'+secrets.token_hex(32)
        api='https://caibinice.com/native-zombie'+prefix
        platform=json.loads(Path(r'E:\Documents\AI\codex\tmp\zombie-apk-20261024\export-all-v1\text\PlatformInfo-f4130d7052-1382940089467135438.bytes').read_text(encoding='utf-8-sig'))
        data={'api-prefix':prefix.encode(),'session.secret':secrets.token_bytes(32),
              'websocket-url':(api.replace('https://','wss://',1)+'/socket').encode(),
              'platform.json':json.dumps({'EncKey':platform['EncKey']}).encode(),
              'version.json':json.dumps({'version':'1.10.100.232','update':0,'asseturl':api+'/assets/'}).encode(),
              'profile.json':json.dumps({'level':30,'gold':500000,'diamonds':12345,'energy':500,'attack':250,'maxHp':5000,'fight':1000,'reagent':99}).encode(),
              'health.curl':('url = "http://127.0.0.1:53175'+prefix+'/ver/new_ver.php"\nfail\nsilent\nshow-error\nmax-time = 3\n').encode()}
        (private/'api-base.txt').write_text(api,encoding='utf-8')
        for name,content in data.items():(private/name).write_bytes(content)
        bundle=private/'deployment-private.tar'
        with tarfile.open(bundle,'w') as tar:
            for name,content in data.items():
                info=tarfile.TarInfo(name);info.size=len(content);info.mode=0o600;tar.addfile(info,io.BytesIO(content))
        base='/tmp/games-zombie-'+release
        remote.upload_file(bundle,base+'.private.tar')
        remote.upload_file(work/'nginx-after.conf',base+'.nginx')
        remote.upload_file(Path(__file__).parent/'native-backend.service.example',base+'.service')
        script=f'''set -euo pipefail
test -d /opt/zombie-native/staging/{release}
test ! -e /etc/systemd/system/zombie-native.service
test ! -e /opt/zombie-native/current
test -z "$(ss -H -ltn '( sport = :53175 or sport = :55074 )')"
test "$(sha256sum {ROUTES} | cut -d ' ' -f1)" = {expected}
backup=/opt/zombie-native/backups/{release}
install -d -m 0700 "$backup"
cp -p {ROUTES} "$backup/routes.conf"
rollback() {{
 systemctl disable --now zombie-native.service >/dev/null 2>&1 || true
 cp -p "$backup/routes.conf" {ROUTES}
 nginx -t && systemctl reload nginx || true
 printf 'Native activation rolled back; private state preserved.\\n'
}}
trap rollback ERR
id zombie-native >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /opt/zombie-native --shell /sbin/nologin zombie-native
install -d -m 0700 -o zombie-native -g zombie-native /opt/zombie-native/private /opt/zombie-native/state
install -d -m 0755 /opt/zombie-native/downloads
tar --no-same-owner -xf {base}.private.tar -C /opt/zombie-native/private
chown -R zombie-native:zombie-native /opt/zombie-native/private
chmod 0600 /opt/zombie-native/private/*
ln -s /opt/zombie-native/staging/{release} /opt/zombie-native/current
install -m 0644 {base}.service /etc/systemd/system/zombie-native.service
systemd-analyze verify /etc/systemd/system/zombie-native.service
systemctl daemon-reload
systemctl enable --now zombie-native.service
systemctl is-active --quiet zombie-native.service
curl --output /dev/null --retry 3 --retry-connrefused --retry-delay 1 --config /opt/zombie-native/private/health.curl
install -m 0644 {base}.nginx {ROUTES}
nginx -t
systemctl reload nginx
systemctl is-active --quiet nginx
rm -- {base}.private.tar {base}.service {base}.nginx
trap - ERR
printf '\\nNative service active; HTTP and TCP are loopback-only, public WSS uses 443.\\n'
'''
        result=remote.run(script,root=True,timeout=18)
        result=result.replace(api,'<private-api-base>').replace(prefix,'/<private-install-prefix>')
        with urlopen(api+'/ver/new_ver.php',timeout=6) as response:
            if response.status!=200 or json.load(response)['update']!=0:raise RuntimeError('Public API version probe failed')
        with ThreadPoolExecutor(max_workers=4) as pool:after=list(pool.map(probe,PAGES))
        unchanged=before==after
        proof={'release':release,'httpPort':53175,'tcpPort':55074,'path':'/native-zombie/','active':True,
               'routesBeforeSha256':expected,'routesAfterSha256':hashlib.sha256(candidate).hexdigest(),
               'existingPagesUnchanged':unchanged,'before':before,'after':after,'serviceValidation':result}
        (work/'deployment-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding='utf-8')
        # Preserve ai-blog's line endings and unrelated local changes.
        mirror=Path(r'E:\codes\ai-blog\deploy\nginx\ai-platform-routes.conf');old=mirror.read_bytes()
        (work/'ai-blog-routes-before.conf').write_bytes(old)
        if MARKER.encode() in old:raise RuntimeError('Blog mirror already has native route; inspect')
        mirror.write_bytes(old+addition.replace('\n','\r\n').encode() if b'\r\n' in old else old+addition.encode())
        print(json.dumps({k:proof[k] for k in ['release','httpPort','tcpPort','path','active','existingPagesUnchanged']}))
        if not unchanged:raise RuntimeError('Existing page content changed; compare saved proof before continuing')
    finally:remote.close()


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--release',required=True);p.add_argument('--work',type=Path,required=True);p.add_argument('--expected-routes-sha256',required=True);a=p.parse_args();deploy(a.release,a.work,a.expected_routes_sha256)
