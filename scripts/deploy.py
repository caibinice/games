"""Deploy only the built static package; keep /games/pindou and other sites intact."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import subprocess
import tarfile
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

from config import ROOT, work_root

ROUTES = '/etc/nginx/snippets/ai-platform-routes.conf'
URL = 'https://caibinice.com/games/pindou/'
BLOCK = re.compile(r'^[ \t]*# begin-pindou-static-game\r?\n.*?^[ \t]*# end-pindou-static-game[^\r\n]*', re.M | re.S)
EXTENSIONS = {'.html', '.css', '.mjs', '.js', '.json', '.webmanifest', '.svg', '.png', '.webp'}


def merge_routes(current: str, fragment: str) -> str:
    matches = list(BLOCK.finditer(current))
    if len(matches) > 1:
        raise RuntimeError('Duplicate pindou route markers; inspect routes before deployment.')
    if matches:
        match = matches[0]
        return current[:match.start()] + fragment.rstrip('\r\n') + current[match.end():]
    return current.rstrip() + '\n\n' + fragment.rstrip() + '\n'


def validate_dist(dist: Path) -> dict:
    manifest = json.loads((dist / 'release-manifest.json').read_text(encoding='utf-8'))
    if (manifest.get('version'), manifest.get('game'), manifest.get('base'), manifest.get('levels'), manifest.get('patterns')) != (1, 'pindou', '/games/pindou/', 100, 40):
        raise RuntimeError('Build manifest differs from expected pindou catalogue; rebuild first.')
    expected = {'release-manifest.json'}
    names = []
    for item in manifest['files']:
        name = item['path']
        parts = Path(name).parts
        if not re.fullmatch(r'[A-Za-z0-9._/-]+', name) or not name.startswith('games/pindou/') or any(p.startswith('.') or p.lower().startswith('credentials') for p in parts) or Path(name).suffix not in EXTENSIONS:
            raise RuntimeError('Unexpected runtime path in build manifest.')
        file = dist / name
        if file.is_symlink() or not file.resolve().is_relative_to(dist.resolve()):
            raise RuntimeError('Build file escapes dist.')
        content = file.read_bytes()
        if len(content) != item['bytes'] or hashlib.sha256(content).hexdigest() != item['sha256']:
            raise RuntimeError('Build hash mismatch: ' + name)
        if (ROOT / 'public' / name).read_bytes() != content:
            raise RuntimeError('Build is stale; run npm run build: ' + name)
        names.append(name)
        expected.add(name)
        compressed = Path(str(file) + '.gz')
        if compressed.exists():
            if compressed.is_symlink() or gzip.decompress(compressed.read_bytes()) != content:
                raise RuntimeError('Precompressed file differs: ' + name)
            expected.add(name + '.gz')
    actual = {p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file()}
    source = {p.relative_to(ROOT / 'public').as_posix() for p in (ROOT / 'public').rglob('*') if p.is_file()}
    if len(names) != len(set(names)) or set(names) != source or actual != expected:
        raise RuntimeError('Unexpected/missing build file; build only the public runtime.')
    for required in ['index.html', 'app.mjs', 'engine.mjs', 'previous-simple-artworks.mjs']:
        if 'games/pindou/' + required not in names:
            raise RuntimeError('Missing built module: ' + required)
    return manifest


def package_dist(dist: Path, archive: Path) -> dict:
    manifest = validate_dist(dist)
    with tarfile.open(archive, 'w:gz') as tar:
        for path in sorted(dist.rglob('*')):
            if path.is_file():
                tar.add(path, arcname=(Path('www') / path.relative_to(dist)).as_posix())
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--game', choices=['pindou'], default='pindou')
    parser.add_argument('--dry-run', action='store_true', help='Validate/package dist without SSH or credentials')
    parser.add_argument('--blog-root', type=Path, default=ROOT.parent / 'ai-blog', help='Optional sibling route mirror, not a game dependency')
    args = parser.parse_args()
    commit = subprocess.run(['git', '-C', str(ROOT), 'rev-parse', '--short=10', 'HEAD'], capture_output=True, text=True).stdout.strip() or 'working'
    if not re.fullmatch('[a-z0-9]+', commit):
        raise RuntimeError('Invalid commit identifier')
    stamp = datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S-%f')
    release = datetime.now(UTC).strftime('%Y%m%d%H%M%S') + '-' + commit
    backup = work_root() / 'backups' / f'games-pindou-{stamp}'
    staging = work_root() / 'tmp' / f'games-pindou-release-{stamp}'
    staging.mkdir(parents=True, exist_ok=False)
    archive = staging / f'pindou-{release}.tar.gz'
    manifest = package_dist(ROOT / 'dist', archive)
    package = {'release': release, 'repository': 'https://github.com/caibinice/games', 'commit': commit,
               'url': URL, 'source': str(ROOT / 'dist'), 'archive': str(archive),
               'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'runtime_files': len(manifest['files'])}
    (staging / 'package.json').write_text(json.dumps(package, indent=2), encoding='utf-8')
    if args.dry_run:
        print(json.dumps({'result': 'PASS', 'mode': 'dry-run', **package}, ensure_ascii=False))
        return
    # No import/network/credentials required for the offline packaging path above.
    from remote_client import RemoteClient
    backup.mkdir(parents=True, exist_ok=False)
    remote = RemoteClient()
    try:
        with remote.client.open_sftp() as sftp:
            with sftp.open(ROUTES, 'rb') as file:
                original = file.read()
        (backup / 'ai-platform-routes.before.conf').write_bytes(original)
        digest = hashlib.sha256(original).hexdigest()
        fragment = (ROOT / 'deploy/nginx/pindou.conf').read_text(encoding='utf-8')
        merged = merge_routes(original.decode('utf-8'), fragment)
        previous = remote.run('readlink -f /opt/pindou/www 2>/dev/null || true', root=True, timeout=30).strip()
        rollback = {'release': release, 'previous': previous, 'local_backup': str(backup),
                    'remote_backup': f'/opt/pindou/backups/{release}', 'routes_sha256_before': digest, **package}
        (backup / 'rollback.json').write_text(json.dumps(rollback, indent=2), encoding='utf-8')
        upload, next_conf = f'/tmp/pindou-{release}.tar.gz', f'/tmp/pindou-routes-{release}.conf'
        remote.upload_file(archive, upload, 0o600)
        remote.upload_bytes(merged.encode(), next_conf, 0o600)
        paths = ' '.join(item['path'] for item in manifest['files'])
        remote.run(f'''
set -euo pipefail
root=/opt/pindou
target="$root/releases/{release}"
backup="$root/backups/{release}"
actual="$(sha256sum {ROUTES} | cut -d' ' -f1)"
[[ "$actual" = "{digest}" ]] || {{ echo 'Shared routes changed; retry.'; exit 1; }}
previous="$(readlink -f "$root/www" 2>/dev/null || true)"
[[ -z "$previous" || "$previous" = "$root/releases/"* ]] || {{ echo 'Unexpected previous game root'; exit 1; }}
mkdir -p "$target" "$backup"
cp {ROUTES} "$backup/ai-platform-routes.before.conf"
printf '%s\\n' "$previous" > "$backup/previous-release.txt"
rollback() {{
  cp "$backup/ai-platform-routes.before.conf" {ROUTES}
  if [[ -n "$previous" && -d "$previous" ]]; then
    ln -sfn "$previous" "$root/www.rollback"
    mv -Tf "$root/www.rollback" "$root/www"
  elif [[ -L "$root/www" ]]; then rm -f "$root/www"; fi
  nginx -t && systemctl reload nginx
  echo 'Pindou rolled back to previous built package.'
}}
trap rollback ERR
tar -xzf {upload} -C "$target"
chown -R aiapps:aiapps "$target"
find "$target" -type d -exec chmod 755 {{}} +
find "$target" -type f -exec chmod 644 {{}} +
ln -sfn "$target/www" "$root/www.next"
mv -Tf "$root/www.next" "$root/www"
install -m 644 {next_conf} {ROUTES}
nginx -t
systemctl reload nginx
systemctl is-active --quiet nginx
curl -fsS --resolve caibinice.com:443:127.0.0.1 {URL} | grep -q 'MELLOW BEADS'
for path in {paths}; do
  curl -fsS --resolve caibinice.com:443:127.0.0.1 "https://caibinice.com/$path" >/dev/null
done
curl -fsSI --resolve caibinice.com:443:127.0.0.1 {URL}app.mjs | grep -qi 'content-type: application/javascript'
code="$(curl -sS -o /dev/null -w '%{{http_code}}' --resolve caibinice.com:443:127.0.0.1 {URL}not-found.mjs)"
[[ "$code" = 404 ]]
curl -fsS --resolve caibinice.com:443:127.0.0.1 https://caibinice.com/ >/dev/null
curl -fsS --resolve caibinice.com:443:127.0.0.1 https://caibinice.com/smartParking/ >/dev/null
trap - ERR
rm -f {upload} {next_conf}
echo 'Pindou built package activated: {release}'
''', root=True, timeout=180)
        # Preserve the optional blog's other routes and only mirror this fragment.
        local_routes = args.blog_root / 'deploy/nginx/ai-platform-routes.conf'
        if local_routes.exists():
            current = local_routes.read_bytes()
            (backup / 'ai-platform-routes.blog.before.conf').write_bytes(current)
            next_local = merge_routes(current.decode('utf-8'), fragment).encode('utf-8')
            if next_local != current:
                local_routes.write_bytes(next_local)
        (staging / 'deployment.json').write_text(json.dumps(rollback, indent=2), encoding='utf-8')
        print(f'Local rollback: {backup / "rollback.json"}')
        print(f'URL: {URL}')
    finally:
        remote.close()


if __name__ == '__main__':
    main()
