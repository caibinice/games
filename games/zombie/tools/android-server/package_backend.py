"""Package only the native Node dependency closure; credentials stay external."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

GAME = Path(__file__).resolve().parents[2]
ENTRY = GAME / 'tools/local-protocol/server.mjs'
IMPORT = re.compile(r"(?:\bfrom\s*|\bimport\s*)['\"]([^'\"]+)['\"]")


def dependency_files(entry=ENTRY, root=GAME):
    root = root.resolve()
    pending, found = [entry.resolve()], set()
    vendor=(root/'tools/local-protocol/vendor/ws').resolve()
    while pending:
        path = pending.pop()
        if path in found:
            continue
        if path.is_relative_to(vendor):
            reviewed=[vendor/name for name in ['index.js','wrapper.mjs','package.json','LICENSE']]+list((vendor/'lib').glob('*.js'))
            metadata=json.loads((vendor/'package.json').read_text(encoding='utf-8'))
            if metadata.get('name')!='ws' or metadata.get('version')!='8.18.3':raise ValueError('Unreviewed WebSocket dependency version')
            found.update(reviewed);continue
        if not path.is_relative_to(root) or path.suffix != '.mjs' or not path.is_file():
            raise ValueError('Unexpected runtime dependency')
        text = path.read_text(encoding='utf-8')
        if re.search(r'\bimport\s*\(', text):
            raise ValueError('Review dynamic import before packaging')
        found.add(path)
        for target in IMPORT.findall(text):
            if target.startswith('node:'):
                continue
            if not target.startswith('.'):
                raise ValueError('Review external dependency: ' + target)
            pending.append((path.parent / target).resolve())
    return sorted(found)


def package(out):
    out = out.resolve()
    if out.exists():
        raise ValueError('Use a new output archive; existing releases are preserved')
    files = dependency_files()
    contents = {'game/' + p.relative_to(GAME).as_posix(): p.read_bytes() for p in files}
    manifest = {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}
    contents['native-release.json'] = json.dumps({'schema': 1, 'entry': 'game/tools/local-protocol/server.mjs',
        'nodeMinimum': 20, 'files': manifest, 'secretsIncluded': False,
        'backendComplete': False}, indent=2).encode()
    out.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(out, 'w:gz') as archive:
        for name, data in contents.items():
            info = tarfile.TarInfo(name)
            info.size, info.mode, info.mtime = len(data), 0o644, 0
            archive.addfile(info, io.BytesIO(data))
    with tarfile.open(out) as archive:
        for name, digest in manifest.items():
            if hashlib.sha256(archive.extractfile(name).read()).hexdigest() != digest:
                raise ValueError('Archive hash mismatch')
    proof = {'files': len(files), 'bytes': out.stat().st_size,
             'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'secretsIncluded': False}
    out.with_suffix(out.suffix + '.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
    print(json.dumps(proof))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    package(parser.parse_args().out)
