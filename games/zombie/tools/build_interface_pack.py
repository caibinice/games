"""Export reviewed native login/UI/gem inputs, never screenshot composites."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
from PIL import Image
import imageio_ffmpeg
from decode_client_config import decode

APK_SHA = '7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6'


def build(source, public, schemas):
    records = json.loads((source / 'manifest.json').read_text('utf8'))
    target = public / 'assets/client-interface'
    if target.exists():
        raise ValueError('Use a new output directory; retain prior evidence')
    target.mkdir(parents=True)
    inputs = []

    def read(r):
        o = r['outputs'][0]
        f = (source / o['file']).resolve()
        if not f.is_relative_to(source.resolve()) or hashlib.sha256(f.read_bytes()).hexdigest() != o['sha256']:
            raise ValueError('Source hash/path mismatch')
        inputs.append({'bundle': r['bundle'], 'bundle_sha256': r['bundle_sha256'],
                       'path_id': str(r['path_id']), 'name': r['name'], 'sha256': o['sha256']})
        return f

    def export(name, kind, alias, bundle=None):
        rs = [r for r in records if r['name'] == name and r['type'] == kind and (not bundle or r['bundle'] == bundle)]
        if len(rs) != 1:
            raise ValueError(f'Ambiguous/missing asset: {name}: {len(rs)}')
        f = read(rs[0]); dest = target / alias
        if kind in ['Sprite', 'Texture2D']:
            Image.open(f).save(dest, 'WEBP', lossless=True, method=6)
        elif kind == 'AudioClip':
            import subprocess
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
                            '-i', str(f), '-codec:a', 'libmp3lame', '-q:a', '4', '-map_metadata', '-1', str(dest)], check=True)
        else:
            dest.write_text(json.dumps(base64.b64encode(f.read_bytes()).decode() if alias=='login-skeleton.json' else f.read_text('utf8')), 'utf8')

    login = 'assets_uiraw_login.ab'
    for name, alias in [('BG', 'login-background.webp'), ('logo', 'login-logo.webp'),
                        ('zmzg_dl_Loading_bg', 'progress-track.webp'), ('zmzg_dl_Loading', 'progress-fill.webp'),
                        ('zmzg_dl_ksyx_btn', 'start-button.webp')]:
        export(name, 'Sprite', alias, login)
    for name, kind, alias in [('ui_005_denglutu', 'Texture2D', 'login-actors.webp'),
                               ('ui_005_denglutu.atlas', 'TextAsset', 'login-atlas.json'),
                               ('ui_005_denglutu.skel', 'TextAsset', 'login-skeleton.json')]:
        export(name, kind, alias, 'assets_actormodel_ui_login.ab')
    for name, alias in [('UI_dianji', 'click'), ('UI_fanhui_gaunbi', 'close'),
                        ('UI_tanchuang_fanye', 'page'), ('UI_gongxihuode', 'reward'), ('UI_xilian', 'refine')]:
        export(name, 'AudioClip', alias + '.mp3')

    schema_pack = json.loads(schemas.read_text('utf8'))
    if schema_pack['apk_sha256'] != APK_SHA:
        raise ValueError('Unexpected schema source build')
    schemas = schema_pack['schemas']
    tables = {}
    for name in ['ResDef.GemBaseConfig', 'BattleCore.GemBaseConfig', 'ResDef.GemComposeConfig', 'ResDef.GemRollConfig']:
        ns, cls = name.split('.')
        bundle = 'assets_resources_config_resbin_' + ('fp_' if ns == 'BattleCore' else '') + cls.lower() + '.bytes.ab'
        r = next(r for r in records if r['type'] == 'TextAsset' and r['bundle'] == bundle)
        tables[name] = decode(read(r).read_bytes(), name, schemas)['rows']
    old_schemas = json.loads(Path(__file__).with_name('client-schemas.json').read_text('utf8'))['schemas']
    r = next(r for r in records if r['type'] == 'TextAsset' and r['bundle'] == 'assets_resources_config_resbin_textconfig.bytes.ab')
    texts = {r['ID']: r['Content'].replace('\0', '') for r in decode(read(r).read_bytes(), 'ResDef.TextConfig', old_schemas)['rows']}
    fp = {r['ItemID']: r for r in tables['BattleCore.GemBaseConfig']}
    gems = []
    for row in tables['ResDef.GemBaseConfig']:
        d = texts[row['Desc']]
        for i in range(3):
            d = d.replace('{' + str(i) + '}', format(row['DescParam' + str(i + 1)], '.8g'))
        d = re.sub('<[^>]*>', '', d)
        gems.append({'id': row['ItemID'], 'name': texts[row['Name']], 'description': d,
                     'quality': row['Quality'], 'part': row['BindPart'], 'type': row['GemType'],
                     'icon': row['Icon'], 'fight': row['FightVal'], 'maxStack': row['MaxStack'],
                     'params': [row['DescParam' + str(i)] for i in range(1, 4)],
                     'links': [n for n in row['LinkSkill'] if n], 'rule': fp[row['ItemID']]})
    for name in sorted({r['icon'] for r in gems}):
        export(name, 'Sprite', name + '.webp')
    module = public / 'client-gem-data.mjs'
    module.write_text('// Generated from the pinned reference APK, not online guide estimates.\n' + '\n'.join(
        'export const ' + k + '=' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) + ';'
        for k, v in [('CLIENT_GEMS', gems), ('CLIENT_GEM_COMPOSE', tables['ResDef.GemComposeConfig']),
                     ('CLIENT_GEM_ROLL', tables['ResDef.GemRollConfig'])]) + '\n', 'utf8')
    evidence = {'apk_sha256': APK_SHA, 'screenshots_used': False, 'gem_count': len(gems),
                'login_spine_version': '3.8.99', 'inputs': inputs,
                'outputs': [{'file': f.relative_to(public).as_posix(), 'sha256': hashlib.sha256(f.read_bytes()).hexdigest(),
                             'bytes': f.stat().st_size} for f in [*sorted(target.iterdir()), module]]}
    (target / 'provenance.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2), 'utf8')
    print(json.dumps({'result': 'PASS', 'gems': len(gems), 'outputs': len(evidence['outputs']), 'screenshots_used': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--public', type=Path, required=True)
    parser.add_argument('--schemas', type=Path, required=True)
    args = parser.parse_args()
    build(args.source, args.public, args.schemas)
