"""Publish all configured client battle tables as small, lazy-loaded JSON files.

Normal/elite counts are derived from LevelType, not a guessed level ceiling.
Other modes retain their original parameters; web adaptations are labelled.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
from PIL import Image
from decode_client_config import decode


def run(export, public):
    manifest = json.loads((export / 'manifest.json').read_text('utf8'))
    schema_file = json.loads(Path(__file__).with_name('client-schemas.json').read_text('utf8'))
    schemas = schema_file['schemas']
    bundle_index = collections.defaultdict(list)
    for r in manifest:
        bundle_index[r['bundle']].append(r)
    inputs = []
    def read(r):
        f = r['outputs'][0]
        p = (export / f['file']).resolve()
        if not p.is_relative_to(export.resolve()) or hashlib.sha256(p.read_bytes()).hexdigest() != f['sha256']:
            raise ValueError('Export path/hash mismatch')
        inputs.append({'bundle': r['bundle'], 'bundle_sha256': r['bundle_sha256'],
                       'name': r.get('name'), 'source_sha256': f['sha256']})
        return p
    def table(name):
        ns, cls = name.split('.')
        prefix = 'fp_' if ns == 'BattleCore' else ''
        r = next(r for r in bundle_index[f'assets_resources_config_resbin_{prefix}{cls.lower()}.bytes.ab'] if r['type'] == 'TextAsset')
        return decode(read(r).read_bytes(), name, schemas)['rows']

    bases = table('ResDef.LevelBaseConfig')
    fp = {r['LevelID']: r for r in table('BattleCore.LevelBaseConfig')}
    models = {r['ModelID']: r for r in table('ResDef.ModelConfig')}
    text_rows = table('ResDef.TextConfig')
    texts = {r['ID']: re.sub(r'<[^>]*>', '', r['Content']) for r in text_rows}
    monsters = table('ResDef.MonsterCfg')
    wave_index = {r['name']: r for r in bundle_index['assets_resources_config_resbin_fp_levelwaveconfig.ab'] if r['type'] == 'TextAsset'}
    root = public / 'assets/client-campaign'
    module = public / 'client-expanded.mjs'
    if root.exists() or module.exists():
        raise ValueError('Use a new pack destination; preserve earlier evidence')
    root.mkdir(parents=True)
    normal, elite, activities = [], [], []
    chunks = collections.defaultdict(dict)
    wave_fields = [f[0] for f in schemas['BattleCore.LevelWaveConfig']['fields']]
    counters = collections.Counter()
    referenced = set()
    for base in bases:
        id = base['LevelID']; record = wave_index.get('LevelWaveConfig' + str(id))
        metadata = {'LevelID': id, 'LevelType': base['LevelType'], 'LogicType': base['LogicType'],
                    'name': texts.get(base['LevelNameId'], str(id)), 'image': base['LevelImage'],
                    'file': './assets/client-campaign/levels-' + str(id//100) + '.json', 'available': bool(record)}
        if base['LevelType'] == 1:
            metadata['level'] = len(normal) + 1; normal.append(metadata)
        elif base['LevelType'] == 2:
            metadata['level'] = len(elite) + 1; elite.append(metadata)
        elif base['LevelType'] != 98:
            activities.append(metadata)
        if not record:
            counters['missing_wave_files'] += 1
            continue
        decoded = decode(read(record).read_bytes(), 'BattleCore.LevelWaveConfig', schemas)
        waves = sorted(decoded['rows'], key=lambda r: (r['TriggerTime'], r['WaveID']))
        referenced.update(r['MonsterID'] for r in waves if r['MonsterID'])
        mode = 'native-time' if all(r['TriggerType'] == 1 and r['MonsterID'] for r in waves) else 'web-adapted'
        metadata['waves'] = max((r['Wave'] for r in waves), default=0)
        metadata['scheduleMode'] = mode
        obj = {**metadata, 'base': fp[id], 'waveFields': wave_fields,
               'waveRows': [[r[k] for k in wave_fields] for r in waves],
               'source_sha256': decoded['source_sha256']}
        chunks[id//100][str(id)] = obj
        counters['files'] += 1; counters['spawn_records'] += len(waves); counters[mode] += 1

    for key, entries in chunks.items():
        (root / ('levels-' + str(key) + '.json')).write_text(json.dumps(entries, ensure_ascii=False, separators=(',', ':')), 'utf8')
    assert len(normal) == len(elite) and all(r['available'] for r in normal + elite)
    actors = {}; pending = []
    # Reuse previously shipped atlases, generate only newly referenced models.
    old_text = (public / 'client-data.mjs').read_text('utf8')
    old_visuals = json.loads(re.search(r'^export const CLIENT_VISUALS=(.*);$', old_text, re.M)[1])
    extra_monsters = {}
    for m in monsters:
        model = models.get(m['ModelID'], {})
        key = model.get('FrameConfigFile', '')
        extra_monsters[str(m['MonsterID'])] = {k: m[k] for k in ['MonsterID', 'ModelID', 'Type', 'Hp', 'HpCount', 'Atk', 'MoveSpeed', 'IsFly', 'ModelScale']}
        extra_monsters[str(m['MonsterID'])].update(name=texts.get(m['MonsterName'], ''), description=texts.get(m['MonsterDesc'], ''), frameModel=key)
        if m['MonsterID'] not in referenced or not key or key in old_visuals or key in actors:
            continue
        cfgs = bundle_index.get('assets_resources_config_monsterspriteconfig_' + key.lower() + '.prefab.ab', [])
        cfg = next((r for r in cfgs if r['type'] == 'MonoBehaviour'), None)
        sprites = {r['path_id']: r for r in bundle_index.get('assets_actormodel_monster_' + key.lower() + '.ab', []) if r['type'] == 'Sprite'}
        if not cfg or not sprites:
            pending.append(key); continue
        tree = json.loads(read(cfg).read_text('utf8')); frames = []; animations = {}
        for anim in ['Idle', 'Run', 'Run2', 'Skill1', 'Death']:
            animations[anim] = []
            for ptr in tree[anim]:
                r = sprites[ptr['m_PathID']]
                animations[anim].append(len(frames)); frames.append(Image.open(read(r)).convert('RGBA'))
        if not frames:
            pending.append(key); continue
        scale = min(1, 192 / max(max(im.size) for im in frames))
        cw, ch = max(1, round(max(im.width for im in frames)*scale)), max(1, round(max(im.height for im in frames)*scale))
        sheet = Image.new('RGBA', (cw*8, ch*((len(frames)+7)//8))); rects = []
        for i, im in enumerate(frames):
            im = im.resize((max(1, round(im.width*scale)), max(1, round(im.height*scale))), Image.Resampling.LANCZOS)
            x, y = i%8*cw, i//8*ch; sheet.paste(im, (x,y)); rects.append([x,y,im.width,im.height])
        filename = key + '.webp'; sheet.save(root / filename, 'WEBP', quality=86, method=6)
        actors[key] = {'file': './assets/client-campaign/'+filename, 'frames': rects, 'animations': animations, 'modelScale': model['ModelScale']}

    # Activity tables load only when the permanent activity screen is opened.
    (root/'activities.json').write_text(json.dumps(activities, ensure_ascii=False, separators=(',', ':')), 'utf8')
    values = {'CAMPAIGN_ENTRIES': normal, 'ELITE_ENTRIES': elite, 'EXTRA_MONSTERS': extra_monsters, 'EXTRA_VISUALS': actors}
    module.write_text('// Generated from reviewed client tables; activity rules may use documented web adaptations.\n' + '\n'.join(
        'export const '+k+'='+json.dumps(v,ensure_ascii=False,separators=(',', ':'))+';' for k,v in values.items())+'\n', 'utf8')
    (public/'campaign-limits.mjs').write_text('// Derived from reference APK LevelType=1/2.\nexport const CAMPAIGN_LEVEL_COUNT='+str(len(normal))+';\n', 'utf8')
    proof = {'apk_sha256': schema_file['apk_sha256'], 'normal': len(normal), 'elite': len(elite), 'activity_configs': len(activities),
             'counts': dict(counters), 'storage_chunks': len(chunks), 'extra_animated_models': len(actors), 'pending_frame_configs': sorted(set(pending)), 'inputs': inputs}
    (root/'provenance.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2), 'utf8')
    print(json.dumps({k:v for k,v in proof.items() if k!='inputs'}, ensure_ascii=False))


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('export',type=Path);p.add_argument('--public',type=Path,default=Path(__file__).resolve().parents[1]/'public')
    a=p.parse_args();run(a.export,a.public)
