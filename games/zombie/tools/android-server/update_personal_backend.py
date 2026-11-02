"""Activate an already staged backend and migrate the old role to admin1.

Only backend code/configuration is uploaded. APKs remain on the local computer.
"""
import argparse
import contextlib
import hashlib
import io
import json
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'scripts'))
from remote_client import RemoteClient

def update(release,config,proof):
    if not re.fullmatch(r'[0-9a-z-]{8,50}',release):raise ValueError('Invalid release')
    data=json.loads(config.read_text(encoding='utf-8'))
    if data.get('version')!=1 or sorted(data.get('accounts',{}))!=['admin1','admin2','admin3']:raise ValueError('Invalid account config')
    remote=RemoteClient()
    try:
        with remote.client.open_sftp() as s:
            unit=s.open('/etc/systemd/system/zombie-native.service','rb').read()
            routes=s.open('/etc/nginx/snippets/ai-platform-routes.conf','rb').read()
        if b'--accounts-file' in unit:raise RuntimeError('Accounts already configured; use the existing account store on later upgrades')
        if b'--websocket-url-file' not in unit:raise RuntimeError('Expected existing WSS deployment')
        updated=unit.replace(b' --log ',b' --accounts-file /opt/zombie-native/private/accounts.json --accounts-dir /opt/zombie-native/state/accounts --log ')
        if updated==unit:raise RuntimeError('Service entry mismatch')
        remote.upload_bytes(updated,'/tmp/games-native-personal.service')
        remote.upload_file(config,'/tmp/games-native-personal-accounts.json')
        result=remote.run(f'''set -euo pipefail
target=/opt/zombie-native/staging/{release}
backup=/opt/zombie-native/backups/{release}
test -f "$target/game/tools/local-protocol/personal-accounts.mjs"
test ! -e "$backup"
test ! -e /opt/zombie-native/state/accounts
systemctl is-active --quiet zombie-native.service
test "$(sha256sum /etc/systemd/system/zombie-native.service | cut -d ' ' -f1)" = {hashlib.sha256(unit).hexdigest()}
install -d -m 0700 "$backup"
cp -p /etc/systemd/system/zombie-native.service "$backup/service"
cp -p /opt/zombie-native/private/profile.json "$backup/profile.json"
readlink -f /opt/zombie-native/current > "$backup/previous-release"
rollback() {{
 cp -p "$backup/service" /etc/systemd/system/zombie-native.service
 cp -p "$backup/profile.json" /opt/zombie-native/private/profile.json
 ln -sfn "$(cat "$backup/previous-release")" /opt/zombie-native/current
 systemctl daemon-reload; systemctl restart zombie-native.service
}}
trap rollback ERR
systemctl stop zombie-native.service
# Snapshot only after stopping: preserve the most recent phone progress.
cp -p /opt/zombie-native/state/role.json "$backup/role.json"
install -d -m 0700 -o zombie-native -g zombie-native /opt/zombie-native/state/accounts
install -m 0600 -o zombie-native -g zombie-native /opt/zombie-native/state/role.json /opt/zombie-native/state/accounts/admin1.json
install -m 0600 -o zombie-native -g zombie-native /tmp/games-native-personal-accounts.json /opt/zombie-native/private/accounts.json
python3 - <<'PY'
import json,os
p='/opt/zombie-native/private/profile.json'
with open(p) as f:d=json.load(f)
d['freeActions']=True
d['coreLevel']=max(1,d.get('coreLevel',1))
with open(p+'.tmp','w') as f:json.dump(d,f)
os.chown(p+'.tmp',os.stat(p).st_uid,os.stat(p).st_gid)
os.chmod(p+'.tmp',0o600)
os.replace(p+'.tmp',p)
PY
install -m 0644 /tmp/games-native-personal.service /etc/systemd/system/zombie-native.service
ln -sfn "$target" /opt/zombie-native/current.next
mv -Tf /opt/zombie-native/current.next /opt/zombie-native/current
systemctl daemon-reload
systemctl start zombie-native.service
curl --fail --silent --output /dev/null --retry 3 --retry-connrefused --retry-delay 1 --config /opt/zombie-native/private/health.curl
systemctl is-active zombie-native nginx
test "$(sha256sum /etc/nginx/snippets/ai-platform-routes.conf | cut -d ' ' -f1)" = {hashlib.sha256(routes).hexdigest()}
rm -- /tmp/games-native-personal.service /tmp/games-native-personal-accounts.json
trap - ERR
printf 'Personal accounts active; latest shared progress migrated to admin1. Nginx unchanged.\\n'
''',root=True,timeout=18)
        proof.parent.mkdir(parents=True,exist_ok=True)
        proof.write_text(json.dumps({'release':release,'accounts':['admin1','admin2','admin3'],'migration':'latest shared role -> admin1','apkUploaded':False,'nginxChanged':False,'backup':'/opt/zombie-native/backups/'+release,'serviceValidation':result},ensure_ascii=False,indent=2),encoding='utf-8')
    finally:remote.close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--release',required=True);p.add_argument('--accounts-file',type=Path,required=True);p.add_argument('--proof',type=Path,required=True);a=p.parse_args()
    update(a.release,a.accounts_file,a.proof)
