"""Upgrade only the native service to WSS on the existing HTTPS path."""
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'scripts'))
from remote_client import RemoteClient


def main():
    work=Path(r'E:\Documents\AI\codex\tmp\zombie-native-cloud-20261031')
    private=work/'private';base=(private/'api-base.txt').read_text().strip()
    url=base.replace('https://','wss://',1)+'/socket';(private/'websocket-url').write_text(url,encoding='utf-8')
    remote=RemoteClient()
    try:
        with remote.client.open_sftp() as s:
            routes=s.open('/etc/nginx/snippets/ai-platform-routes.conf','rb').read()
            unit=s.open('/etc/systemd/system/zombie-native.service','rb').read()
        if b'--websocket-url-file' in unit:raise RuntimeError('WSS service already configured; inspect first')
        block=('# begin-zombie-native-backend\n'+(Path(__file__).parent/'nginx-native.conf.example').read_text()+'\n# end-zombie-native-backend').encode()
        after,count=re.subn(rb'# begin-zombie-native-backend\n.*?# end-zombie-native-backend',lambda _:block,routes,flags=re.S)
        if count!=1:raise RuntimeError('Native Nginx block mismatch')
        updated=unit.replace(b'--tcp-bind 0.0.0.0',b'--tcp-bind 127.0.0.1')
        updated=updated.replace(b' --log ',b' --websocket-url-file /opt/zombie-native/private/websocket-url --log ')
        remote.upload_bytes(after,'/tmp/games-native-wss.nginx')
        remote.upload_bytes(updated,'/tmp/games-native-wss.service')
        remote.upload_file(private/'websocket-url','/tmp/games-native-wss.url')
        digest=hashlib.sha256(routes).hexdigest()
        result=remote.run(f'''set -euo pipefail
test -d /opt/zombie-native/staging/20261031-wss3
test "$(sha256sum /etc/nginx/snippets/ai-platform-routes.conf | cut -d ' ' -f1)" = {digest}
backup=/opt/zombie-native/backups/20261031-wss3
test ! -e "$backup"
install -d -m 0700 "$backup"
cp -p /etc/nginx/snippets/ai-platform-routes.conf "$backup/routes.conf"
cp -p /etc/systemd/system/zombie-native.service "$backup/service"
readlink -f /opt/zombie-native/current > "$backup/previous-release"
rollback() {{
 cp -p "$backup/routes.conf" /etc/nginx/snippets/ai-platform-routes.conf
 cp -p "$backup/service" /etc/systemd/system/zombie-native.service
 ln -sfn "$(cat "$backup/previous-release")" /opt/zombie-native/current
 systemctl daemon-reload; systemctl restart zombie-native.service
 nginx -t && systemctl reload nginx || true
}}
trap rollback ERR
install -m 0600 -o zombie-native -g zombie-native /tmp/games-native-wss.url /opt/zombie-native/private/websocket-url
install -m 0644 /tmp/games-native-wss.service /etc/systemd/system/zombie-native.service
ln -sfn /opt/zombie-native/staging/20261031-wss3 /opt/zombie-native/current.next
mv -Tf /opt/zombie-native/current.next /opt/zombie-native/current
systemctl daemon-reload
systemctl restart zombie-native.service
curl --output /dev/null --retry 3 --retry-connrefused --retry-delay 1 --config /opt/zombie-native/private/health.curl
install -m 0644 /tmp/games-native-wss.nginx /etc/nginx/snippets/ai-platform-routes.conf
nginx -t
systemctl reload nginx
systemctl is-active zombie-native nginx
rm -- /tmp/games-native-wss.url /tmp/games-native-wss.service /tmp/games-native-wss.nginx
trap - ERR
''',root=True,timeout=18)
        mirror=Path(r'E:\codes\ai-blog\deploy\nginx\ai-platform-routes.conf');old=mirror.read_bytes();normalized=old.replace(b'\r\n',b'\n')
        changed,n=re.subn(rb'# begin-zombie-native-backend\n.*?# end-zombie-native-backend',lambda _:block,normalized,flags=re.S)
        if n!=1:raise RuntimeError('Review ai-blog mirror before changing it')
        (work/'ai-blog-before-wss.conf').write_bytes(old);mirror.write_bytes(changed.replace(b'\n',b'\r\n') if b'\r\n' in old else changed)
        (work/'wss-upgrade-proof.json').write_text(json.dumps({'release':'20261031-wss3','rawTcpBind':'127.0.0.1','rawTcpPort':55074,'websocketPath':'/native-zombie/<private-prefix>/socket','publicPort':443,'routesSha256':hashlib.sha256(after).hexdigest(),'serviceValidation':result},ensure_ascii=False,indent=2),encoding='utf-8')
        print('Native WSS route enabled; raw TCP is loopback-only')
    finally:remote.close()


if __name__=='__main__':main()
