"""Import a small reviewed sound set; preserve existing client-pack provenance."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import imageio_ffmpeg

SOUNDS = {'shot': 'GUN_heibaitegong-001', 'boom': 'Wenyadan_hit-001',
          'upgrade': 'UI_shengjichenggong', 'wallhit': 'GUN_Hitmarkers_iron-001'}


def run(export, assets):
    manifest = json.loads((export / 'manifest.json').read_text('utf8'))
    provenance = []
    for alias, name in SOUNDS.items():
        record = next(x for x in manifest if x['type'] == 'AudioClip' and x['name'] == name)
        output = record['outputs'][0]
        source = (export / output['file']).resolve()
        if not source.is_relative_to(export.resolve()) or hashlib.sha256(source.read_bytes()).hexdigest() != output['sha256']:
            raise ValueError('Export hash/path mismatch')
        dest = assets / (alias + '.mp3')
        if dest.exists():
            raise ValueError('Preserve previous imports; use an empty sound destination')
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
                        '-i', str(source), '-codec:a', 'libmp3lame', '-q:a', '4',
                        '-map_metadata', '-1', str(dest)], check=True)
        provenance.append({'alias': alias, 'name': name, 'bundle': record['bundle'],
                           'bundle_sha256': record['bundle_sha256'], 'source_sha256': output['sha256'],
                           'file': dest.name, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()})
    (assets / 'sounds-provenance.json').write_text(json.dumps(provenance, indent=2), 'utf8')
    print('Imported', len(provenance), 'native action sounds')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('assets', type=Path)
    args = parser.parse_args()
    run(args.export, args.assets)
