"""Create a reviewed, game-only web pack from the verified Unity export.

Run with the isolated asset Python environment. No SDK settings, account data,
service URLs, native code or unselected exports are copied to public/.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
from PIL import Image
import imageio_ffmpeg
from decode_client_config import decode

APK_SHA = '7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6'
SKILL_IDS = {1000: 'grenade', 2000: 'frost', 3000: 'lightning', 4000: 'laser',
             5000: 'vehicle', 6000: 'wind', 7000: 'airdrop', 8000: 'guided',
             9000: 'iceblast', 10000: 'electron', 11000: 'vortex', 12000: 'drone',
             13000: 'fuel', 14000: 'electric'}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(export_dir, public):
    manifest = json.loads((export_dir / 'manifest.json').read_text('utf8'))
    schemas = json.loads(Path(__file__).with_name('client-schemas.json').read_text('utf8'))
    if schemas['apk_sha256'] != APK_SHA:
        raise ValueError('Unexpected source build')
    assets = public / 'assets/client-v1'
    module = public / 'client-data.mjs'
    if assets.exists() or module.exists():
        raise ValueError('Client pack exists; review and back it up before regenerating')
    inputs = []

    def read(record):
        output = record['outputs'][0]
        source = (export_dir / output['file']).resolve()
        if not source.is_relative_to(export_dir.resolve()) or sha(source) != output['sha256']:
            raise ValueError('Export hash/path mismatch')
        inputs.append({'bundle': record['bundle'], 'bundle_sha256': record['bundle_sha256'],
                       'path_id': str(record['path_id']), 'name': record.get('name'),
                       'file_sha256': output['sha256']})
        return source

    tables, table_evidence = {}, {}
    for name in ['ResDef.ModelConfig', 'ResDef.MonsterCfg', 'ResDef.LevelBaseConfig',
                 'ResDef.TextConfig', 'ResDef.MagicSkillConfig', 'ResDef.GunSkillConfig',
                 'BattleCore.LevelBaseConfig', 'BattleCore.LevelWaveConfig',
                 'BattleCore.BattleLevelUpConfig']:
        ns, cls = name.split('.')
        bundle = 'assets_resources_config_resbin_' + ('fp_' if ns == 'BattleCore' else '') + cls.lower() + '.bytes.ab'
        record = next(x for x in manifest if x['type'] == 'TextAsset' and x['bundle'] == bundle)
        result = decode(read(record).read_bytes(), name, schemas['schemas'])
        tables[name] = result['rows']
        table_evidence[name] = {k: v for k, v in result.items() if k != 'rows'}

    texts = {x['ID']: x['Content'] for x in tables['ResDef.TextConfig']}
    plain = lambda text: re.sub(r'<[^>]*>', '', text).replace('\r', '')
    text = lambda id: plain(texts.get(id, ''))
    bases = {x['LevelID']: x for x in tables['ResDef.LevelBaseConfig']}
    fp_bases = {x['LevelID']: x for x in tables['BattleCore.LevelBaseConfig']}
    waves = collections.defaultdict(list)
    for row in tables['BattleCore.LevelWaveConfig']:
        if 1001 <= row['LevelID'] <= 1050:
            if row['TriggerType'] != 1:
                raise ValueError('Schedule needs an additional trigger implementation')
            waves[row['LevelID']].append(row)
    stages = []
    for level in range(1, 51):
        id = 1000 + level
        rows = sorted(waves[id], key=lambda x: (x['TriggerTime'], x['WaveID']))
        assert rows and max(x['Wave'] for x in rows) == 20
        stages.append({'LevelID': id, 'level': level, 'name': text(bases[id]['LevelNameId']),
                       'showName': text(bases[id]['LevelShowNameId']), 'image': bases[id]['LevelImage'],
                       'base': fp_bases[id], 'waves': rows})

    monster_ids = {x['MonsterID'] for rows in waves.values() for x in rows}
    monsters = {str(x['MonsterID']): {**x, 'name': text(x['MonsterName']), 'description': text(x['MonsterDesc'])}
                for x in tables['ResDef.MonsterCfg'] if x['MonsterID'] in monster_ids}
    models = {x['ModelID']: x for x in tables['ResDef.ModelConfig']}
    assets.mkdir(parents=True)
    sprites = [x for x in manifest if x['type'] == 'Sprite']
    visuals, missing_models = {}, []
    for monster in monsters.values():
        model = models[monster['ModelID']]
        key = model['FrameConfigFile']
        monster['frameModel'] = key
        if not key:
            missing_models.append(monster['MonsterID'])
            continue  # 3D bosses need a separate mesh/animation renderer.
        if key in visuals:
            continue
        config_bundle = 'assets_resources_config_monsterspriteconfig_' + key.lower() + '.prefab.ab'
        cfg = next(x for x in manifest if x['bundle'] == config_bundle and x['type'] == 'MonoBehaviour')
        config = json.loads(read(cfg).read_text('utf8'))
        actor_sprites = {x['path_id']: x for x in sprites if x['bundle'] == 'assets_actormodel_monster_' + key.lower() + '.ab'}
        selected, animations = [], {}
        for animation in ['Idle', 'Run', 'Run2', 'Skill1', 'Death']:
            animations[animation] = []
            for ptr in config[animation]:
                spr = actor_sprites[ptr['m_PathID']]
                index = len(selected)
                selected.append((spr, Image.open(read(spr)).convert('RGBA')))
                animations[animation].append(index)
        if not selected:
            raise ValueError('Empty animation: ' + key)
        max_w = max(im.width for _, im in selected)
        max_h = max(im.height for _, im in selected)
        scale = min(1, 192 / max(max_w, max_h))
        cw, ch = max(1, round(max_w * scale)), max(1, round(max_h * scale))
        columns = 8
        sheet = Image.new('RGBA', (columns * cw, ((len(selected) + columns - 1) // columns) * ch))
        frames = []
        for i, (spr, im) in enumerate(selected):
            im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
            x, y = i % columns * cw, i // columns * ch
            sheet.paste(im, (x, y))
            frames.append([x, y, im.width, im.height])
        filename = key + '.webp'
        sheet.save(assets / filename, 'WEBP', quality=86, method=6)
        visuals[key] = {'file': './assets/client-v1/' + filename, 'frames': frames,
                        'animations': animations, 'modelScale': model['ModelScale']}

    icons = {}
    native_skills = []
    for row in tables['ResDef.MagicSkillConfig']:
        spr = next(x for x in sprites if x['name'] == row['IconName'])
        filename = row['IconName'] + '.webp'
        Image.open(read(spr)).save(assets / filename, 'WEBP', quality=93, method=6)
        id = SKILL_IDS[row['ID']]
        icons[id] = './assets/client-v1/' + filename
        native_skills.append({**row, 'id': id, 'name': text(row['Name']), 'description': text(row['Desc'])})

    audio_names = {'battle': 'BGM_juneizhandou', 'home': 'BGM_zhujiemian',
                   'won': 'BGM_shengli', 'lost': 'BGM_shibai'}
    for alias, name in audio_names.items():
        record = next(x for x in manifest if x['type'] == 'AudioClip' and x['name'] == name)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
                        '-i', str(read(record)), '-codec:a', 'libmp3lame', '-q:a', '5',
                        '-map_metadata', '-1', str(assets / (alias + '.mp3'))], check=True)

    data = {'CLIENT_STAGES': stages, 'CLIENT_MONSTERS': monsters, 'CLIENT_VISUALS': visuals,
            'CLIENT_SKILLS': native_skills, 'CLIENT_ICONS': icons,
            'CLIENT_XP': tables['BattleCore.BattleLevelUpConfig']}
    module.write_text('// Generated by tools/build_client_pack.py from the verified v1.10 APK.\n' +
                      '\n'.join('export const ' + key + '=' + json.dumps(value, ensure_ascii=False, separators=(',', ':')) + ';'
                                for key, value in data.items()) + '\n', 'utf8')
    evidence = {'apk_sha256': APK_SHA, 'package': 'com.ltzy.xnmkp', 'version': '1.10',
                'tables': table_evidence, 'stages': len(stages), 'spawn_records': sum(map(len, waves.values())),
                'monsters': len(monsters), 'animated_models': len(visuals), 'mesh_bosses_pending': missing_models,
                'inputs': inputs, 'outputs': [{'file': p.relative_to(public).as_posix(), 'sha256': sha(p), 'bytes': p.stat().st_size}
                                              for p in [*sorted(assets.iterdir()), module]]}
    (assets / 'provenance.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2), 'utf8')
    print(json.dumps({k: v for k, v in evidence.items() if k not in ['inputs', 'outputs', 'tables']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export_dir', type=Path)
    parser.add_argument('--public', type=Path, default=Path(__file__).resolve().parents[1] / 'public')
    args = parser.parse_args()
    build(args.export_dir, args.public)
