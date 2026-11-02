"""Upload a verified native backend to isolated staging, without activating it."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'scripts'))
from remote_client import RemoteClient


def stage(archive, release, proof):
    if not re.fullmatch(r'[0-9]{8}-[a-z0-9-]{1,48}', release):
        raise ValueError('Invalid native release name')
    with tarfile.open(archive) as tar:
        entries = tar.getmembers()
        if any(not m.isfile() or '..' in Path(m.name).parts or not re.fullmatch(r'(?:game/[A-Za-z0-9_./-]+\.mjs|game/tools/local-protocol/vendor/ws/(?:lib/[a-z-]+\.js|index\.js|package\.json|LICENSE)|native-release\.json)', m.name) for m in entries):
            raise ValueError('Unexpected archive entry')
        manifest = json.load(tar.extractfile('native-release.json'))
        expected = manifest['files']
        if set(expected) != {m.name for m in entries if m.name != 'native-release.json'}:
            raise ValueError('Release file list mismatch')
        for name, digest in expected.items():
            if hashlib.sha256(tar.extractfile(name).read()).hexdigest() != digest:
                raise ValueError('Release content mismatch')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    target = '/opt/zombie-native/staging/' + release
    uploaded = '/tmp/games-native-' + release + '.tar.gz'
    client = RemoteClient()
    try:
        client.run("node --version; test ! -e " + shlex.quote(target), root=True, timeout=12)
        client.upload_file(archive, uploaded)
        command = f'''set -eu
echo '{digest}  {uploaded}' | sha256sum -c -
install -d -m 0755 {shlex.quote(target)}
tar --no-same-owner -xzf {shlex.quote(uploaded)} -C {shlex.quote(target)}
cd {shlex.quote(target)}
node --check game/tools/local-protocol/server.mjs
node --input-type=module -e "await import('./game/tools/local-protocol/role-session.mjs'); console.log('Native dependency import passed')"
rm -- {shlex.quote(uploaded)}
printf 'Staged only: no service, proxy, firewall or website changes.\\n'
'''
        result = client.run(command, root=True, timeout=15)
        proof.parent.mkdir(parents=True, exist_ok=True)
        proof.write_text(json.dumps({'release': release, 'remotePath': target, 'archiveSha256': digest,
            'runtimeFiles': len(expected), 'activated': False, 'publicEndpoint': False,
            'websiteChanged': False, 'validation': result}, ensure_ascii=False, indent=2), encoding='utf-8')
    finally:
        client.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive', type=Path)
    p.add_argument('--release', required=True)
    p.add_argument('--proof', type=Path, required=True)
    a = p.parse_args()
    stage(a.archive, a.release, a.proof)
