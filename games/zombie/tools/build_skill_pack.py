"""Export reviewed native skill timing, dependency catalog and combat parameters.

Input is the verified v1.10 APK export. Fixed array loops are documented by the
unpack RVAs in skill-schemas.json; the decoder rejects trailing/truncated bytes.
Only game data/art is copied, never native executables or service settings.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
from PIL import Image
from decode_client_config import decode

IDS = dict(zip(range(1000, 14001, 1000), ['grenade', 'frost', 'lightning', 'laser',
    'vehicle', 'wind', 'airdrop', 'guided', 'iceblast', 'electron', 'vortex', 'drone', 'fuel', 'electric']))
APK_SHA = '7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def normalize(value):
    if isinstance(value, dict):
        if list(value) == ['_serializedValue']:
            return value['_serializedValue'] / 4294967296
        return {key: normalize(v) for key, v in value.items()}
    if isinstance(value, list):
        return [normalize(v) for v in value]
    return value


def build(export_dir, public, reference):
    export_dir, public = export_dir.resolve(), public.resolve()
    assets, module = public/'assets/client-skills', public/'client-skill-data.mjs'
    if assets.exists() or module.exists():
        raise ValueError('Preserve existing skill pack before regenerating')
    manifest = json.loads((export_dir/'manifest.json').read_text('utf8'))
    metadata = json.loads(Path(__file__).with_name('skill-schemas.json').read_text('utf8'))
    old_schemas = json.loads(Path(__file__).with_name('client-schemas.json').read_text('utf8'))
    if metadata['apk_sha256'] != APK_SHA or old_schemas['apk_sha256'] != APK_SHA:
        raise ValueError('Unreviewed APK version')
    schemas = {**old_schemas['schemas'], **metadata['schemas']}
    inputs = {}

    def read(rec):
        out = rec['outputs'][0];p = (export_dir/out['file']).resolve()
        if not p.is_relative_to(export_dir) or sha(p) != out['sha256']:
            raise ValueError('Export path/hash mismatch')
        inputs[(rec['bundle'], rec['path_id'])] = {'bundle': rec['bundle'],
            'bundle_sha256': rec['bundle_sha256'], 'path_id': str(rec['path_id']),
            'name': rec['name'], 'sha256': out['sha256']}
        return p

    def table(name):
        ns, cls = name.split('.')
        bundle = 'assets_resources_config_resbin_' + ('fp_' if ns == 'BattleCore' else '') + cls.lower()+'.bytes.ab'
        rec = next(x for x in manifest if x['type'] == 'TextAsset' and x['bundle'] == bundle)
        return decode(read(rec).read_bytes(), name, schemas)['rows']

    bases = {x['SkillID']: x for x in table('BattleCore.SkillBaseConfg')}
    builds = {x['BuildID']: x for x in table('ResDef.BuildConfig')}
    groups = table('BattleCore.BuildGroupConfig')
    attrs = {x['ID']: x for x in table('BattleCore.BuffFuncSkillAttrConfig')}
    buffs = {x['BuffID']: x for x in table('BattleCore.BuffConfig')}
    buff_attrs = {x['BuffID']: x for x in table('BattleCore.BuffAttrConfig')}
    subs = {x['SkillID']: x for x in table('BattleCore.SubSkillConfg')}
    texts = {x['ID']: re.sub('<[^>]+>', '', x['Content']) for x in table('ResDef.TextConfig')}
    disp = {x['name']: x for x in manifest if x['type'] == 'MonoBehaviour' and x['bundle'] == 'assets_resources_skilldisp.ab'}
    normalized = {}

    def graph(id):
        if id not in normalized:
            rec = disp[str(subs[id]['SkillDispID'] if id in subs else bases[id]['SkillDispID'])]
            normalized[id] = normalize(json.loads(read(rec).read_text('utf8'))['m_skillDispData'])
        return normalized[id]

    def bullet(id, index=0):
        row = graph(id)['m_allElemBullet'][index];b = row['m_bulletData'];hit = row['m_impactData']
        return {'speed': b['m_initMoveSpeed'], 'range': b['m_shootRange'], 'through': b['m_hitThroughCount'],
            'radius': row['m_bulletTestParam']['m_radius'], 'damageIndex': hit['m_damageIndex'],
            'knockback': hit['m_backOffDist'] if hit['m_ImpactType'] == 2 else 0,
            'count': b['m_fireGroup']['m_autoDegreeCount'], 'group': b['m_fireGroup'],
            'angle': b['m_fireGroup']['m_autoDegreeDelta'], 'damageRatio': hit['m_damageRatio']}

    def area(id, index=0):
        row = graph(id)['m_allElemShootPoint'][index]
        return {'radius': row['m_shootTestParam']['m_range']['m_radiusOut'],
            'duration': row['m_shootPointLife']['m_lifeTime'],
            'interval': row['m_shootFireCount']['m_fireInterval'],
            'delay': row['m_shootFireCount']['m_delayStart'], 'damageIndex': row['m_impactData']['m_damageIndex']}

    rules = {}
    for id, key in IDS.items():
        b = next(v for v in builds.values() if v['SkillID'] == id and v['MainSkillBuild'])
        row = bases[id]
        rules[key] = {'id': id, 'name': texts[b['Name']], 'baseBuild': b['BuildID'],
            'cooldown': row['SkillCD'], 'minCooldown': row['MinSkillCD'],
            'duration': row['SkillDurationTime'], 'damage': row['AttrDamageData'],
            'subSkills': [v for v in b['AddSubSkillID'] if v]}

    profiles = {'frost': bullet(2011, 1), 'frostShard': bullet(2021), 'frostGiant': bullet(2111),
        'magnet': area(3011), 'magnetSplash': area(3012), 'magnetExplosion': area(3111),
        'magnetMatrix': area(3041), 'magnetParticle': bullet(3091)}
    for profile, graph_id in [('frostShard', 2021), ('frostGiant', 2011)]:
        selection = graph(graph_id)['m_allRuleEvent'][0]['m_selectRandomEnemy']
        profiles[profile]['targetCount'] = selection['m_shootCnt']
        profiles[profile]['targetSelection'] = selection['m_searchTargetParam']
    catalog = {}
    for group in groups:
        if not 1001 <= group['GroupID'] <= 1014:
            continue
        b = builds[group['BuildID']];key = IDS[(group['GroupID']-1000)*1000]
        a = attrs.get(b['AttrLibraryID'])
        catalog[str(b['BuildID'])] = {'id': b['BuildID'], 'skill': key, 'name': texts[b['Name']],
            'description': texts[b['Desc']], 'weight': group['Weight'], 'limit': group['MaxSelectCount'],
            'requires': [v for v in group['DependCondition'] if v['Type']],
            'conflicts': [v for v in group['ConflictCondition'] if v['Type']],
            'main': bool(b['MainSkillBuild']), 'add': [v for v in b['AddSubSkillID'] if v],
            'remove': [v for v in b['RmvSubSkillID'] if v], 'buffs': [v for v in [b['BuffID1'], b['BuffID2']] if v],
            'attrs': {'skills': [v for v in a['SkillID'] if v],
                      'values': [v for v in a['AttrData'] if v['DataType']]} if a else None}
    status = {}
    for id in [20611,20811,21911,30111,30411,30811,31011]:
        status[str(id)] = {**buffs[id], **buff_attrs[id]}
    assets.mkdir(parents=True)
    # Keep the user's full reference, including the author's watermark.
    reference = reference.resolve()
    im = Image.open(reference);im.verify()
    shutil.copyfile(reference, assets/'community-prerequisites.jpg')
    texture = next(x for x in manifest if x['type']=='Texture2D' and x['name']=='ganbingzidan_zidan_1205_zj_Tex')
    Image.open(read(texture)).save(assets/'frost-projectile.webp', 'WEBP', lossless=True, method=6)
    data = {'CLIENT_SKILL_RULES': rules, 'CLIENT_BUILD_CATALOG': catalog,
            'CLIENT_COMBAT_PROFILES': profiles, 'CLIENT_SKILL_STATUS': status}
    module.write_text('// Generated from reviewed native tables and skill graphs.\n' + '\n'.join(
        'export const '+k+'='+json.dumps(v, ensure_ascii=False, separators=(',', ':'))+';' for k,v in data.items())+'\n','utf8')
    outputs = [module]+sorted(assets.iterdir())
    proof = {'apk_sha256': APK_SHA, 'schemas': metadata['schemas'], 'inputs': list(inputs.values()),
        'reference': {'source': 'User-supplied community prerequisite diagram; version may differ from APK',
                      'sha256': sha(reference), 'dimensions': list(Image.open(reference).size)},
        'native_skill_count': len(rules), 'native_build_count': len(catalog),
        'condition_evidence': 'RandomBuildCmpt.CheckCondition RVA 0x122D66C: Type 2 = build count; Type 4 = persistent core level.',
        'outputs': [{'file': p.relative_to(public).as_posix(), 'sha256': sha(p), 'bytes': p.stat().st_size} for p in outputs]}
    (assets/'provenance.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2),'utf8')
    print(json.dumps({'native_skills':len(rules),'native_builds':len(catalog),'profiles':len(profiles)}))


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('export_dir',type=Path)
    p.add_argument('--public',type=Path,required=True);p.add_argument('--reference',type=Path,required=True)
    a=p.parse_args();build(a.export_dir,a.public,a.reference)
