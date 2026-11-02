"""Refresh the essential startup byte manifest after editing game modules."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def build(public):
    public = public.resolve()
    seen = set()

    def visit(name):
        if name in seen:
            return
        seen.add(name)
        for match in re.finditer(r'''(?:from\s*|import\s*)['"](\./[^'"]+\.mjs)['"]''', (public / name).read_text('utf8')):
            child = ((public / name).parent / match[1]).resolve().relative_to(public).as_posix()
            visit(child)

    visit('original-app.mjs')
    seen.discard('native-entry.mjs')
    for name in ['login-background.webp', 'login-actors.webp', 'login-atlas.json', 'login-skeleton.json',
                 'start-button.webp', 'progress-track.webp', 'progress-fill.webp', 'login-runtime.mjs']:
        seen.add('assets/client-interface/' + name)
    rows = [{'path': './' + name, 'bytes': (public / name).stat().st_size,
             'sha256': hashlib.sha256((public / name).read_bytes()).hexdigest()} for name in sorted(seen)]
    (public / 'entry-resources.json').write_text(json.dumps(rows, separators=(',', ':')), 'utf8')
    print(json.dumps({'resources': len(rows), 'bytes': sum(row['bytes'] for row in rows)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=Path(__file__).resolve().parents[1] / 'public')
    build(parser.parse_args().public)
