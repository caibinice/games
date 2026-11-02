"""Activate staged code only; retain private settings and all account progress."""
import argparse
import json
from pathlib import Path
import re
import sys
ROOT=Path(__file__).resolve().parents[4];sys.path.insert(0,str(ROOT/'scripts'))
from remote_client import RemoteClient

def activate(release,proof):
    if not re.fullmatch(r'[0-9a-z-]{8,50}',release):raise ValueError('Invalid release')
    r=RemoteClient()
    try:
        out=r.run(f'''set -euo pipefail
target=/opt/zombie-native/staging/{release}
backup=/opt/zombie-native/backups/{release}
test -f "$target/game/tools/local-protocol/server.mjs"
test ! -e "$backup"
install -d -m 0700 "$backup"
readlink -f /opt/zombie-native/current > "$backup/previous-release"
sha256sum /etc/systemd/system/zombie-native.service /etc/nginx/snippets/ai-platform-routes.conf > "$backup/protected-services.sha256"
rollback() {{ ln -sfn "$(cat "$backup/previous-release")" /opt/zombie-native/current; systemctl restart zombie-native.service; }}
trap rollback ERR
systemctl stop zombie-native.service
tar -czf "$backup/accounts.tar.gz" -C /opt/zombie-native/state accounts
sha256sum /opt/zombie-native/state/accounts/*.json > "$backup/account-integrity.sha256"
ln -sfn "$target" /opt/zombie-native/current.next
mv -Tf /opt/zombie-native/current.next /opt/zombie-native/current
sha256sum --check --status "$backup/account-integrity.sha256"
systemctl start zombie-native.service
curl --fail --silent --output /dev/null --retry 3 --retry-connrefused --retry-delay 1 --config /opt/zombie-native/private/health.curl
systemctl is-active zombie-native nginx
sha256sum --check --status "$backup/protected-services.sha256"
trap - ERR
printf 'Backend code updated; account files, service unit and Nginx unchanged.\\n'
''',root=True,timeout=18)
        proof.write_text(json.dumps({'release':release,'apkUploaded':False,'accountFilesPreserved':True,'nginxChanged':False,'validation':out},ensure_ascii=False,indent=2),encoding='utf8')
    finally:r.close()
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--release',required=True);p.add_argument('--proof',type=Path,required=True);a=p.parse_args();activate(a.release,a.proof)
