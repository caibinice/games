"""Export reviewed particle/line profiles from the pinned APK, never screenshots.

Run with the isolated UnityPy 1.25.4 environment. The original texture pack is
preserved; guided-beam is the actual base LineRenderer texture, not absorption.
"""
import argparse
import hashlib
import json
from pathlib import Path
import UnityPy
from PIL import Image

SELECT = {
    'vortex-body': ('xuanfengjianong', '6854354511984034027'),
    'vortex-light': ('xuanfengjianong', '-9099952081629098397'),
    'vortex-ring': ('xuanfengjianong', '1034395144085013167'),
    'lightning-bolt': ('diancichuanci', '-1774917065596760657'),
    'laser-line': ('chaodaojiguang', '-4069053161144814036'),
    'laser-glow': ('chaodaojiguang', '6724884963281694130'),
    'electron-chain': ('yuedaodianzi', '-6952102027477141786'),
    'guided-beam': ('zhidaojiguang', '5800752435779519614'),
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rgba(c):
    return [c[k] for k in ('r', 'g', 'b', 'a')]


def gradient(g):
    return {'rgb': [[g['ctime'+str(i)]/65535, *rgba(g['key'+str(i)])[:3]]
                    for i in range(g['m_NumColorKeys'])],
            'alpha': [[g['atime'+str(i)]/65535, g['key'+str(i)]['a']]
                      for i in range(g['m_NumAlphaKeys'])], 'mode': g.get('m_Mode', 0)}


def build(source, exported, public):
    if UnityPy.__version__ != '1.25.4':
        raise ValueError('Pinned UnityPy==1.25.4 required')
    old = json.loads((public/'assets/native-fx/provenance.json').read_text('utf8'))
    manifest = json.loads((exported/'manifest.json').read_text('utf8'))
    paths = {p.name: p for p in source.rglob('*.ab')}
    cache, evidence, profiles = {}, {}, {}

    def bundle(name):
        if name not in cache:
            p = paths[name]
            expected = {x['bundle_sha256'] for e in old['entries'].values()
                        for x in [e['source'], *e.get('particleUses', [])] if x['bundle'] == name}
            if len(expected) != 1 or digest(p) not in expected:
                raise ValueError('Unreviewed bundle: '+name)
            env = UnityPy.load(str(p))
            cache[name] = {o.path_id: o for o in env.objects}
            evidence[name] = digest(p)
        return cache[name]

    for alias, (skill, id) in SELECT.items():
        objects = bundle('assets_resources_effect_skill_'+skill+'.ab')
        obj = objects[int(id)]
        tree = obj.parse_as_dict()
        go = objects[tree['m_GameObject']['m_PathID']].parse_as_dict()
        transforms = {o.path_id: o.parse_as_dict() for o in objects.values() if o.type.name == 'Transform'}
        t = next(t for t in transforms.values() if t['m_GameObject']['m_PathID'] == tree['m_GameObject']['m_PathID'])
        names = [go['m_Name']]
        while t['m_Father']['m_PathID'] in transforms:
            t = transforms[t['m_Father']['m_PathID']]
            names.append(objects[t['m_GameObject']['m_PathID']].parse_as_dict()['m_Name'])
        hierarchy = '/'.join(reversed(names))
        if obj.type.name == 'LineRenderer':
            renderer = tree
        else:
            renderer = next(objects[c['component']['m_PathID']].parse_as_dict() for c in go['m_Component']
                            if objects[c['component']['m_PathID']].type.name == 'ParticleSystemRenderer')
        mid = renderer['m_Materials'][0]['m_PathID']
        materials = bundle('assets_effect_skill_'+skill+'.ab')
        material = materials[mid].parse_as_dict()
        props = material['m_SavedProperties']
        colors = dict(props['m_Colors'])
        tex = next(v for k, v in props['m_TexEnvs'] if k in ('_MainTex', '_Textures'))
        texture_id = tex['m_Texture']['m_PathID']
        texture_rows = [r for r in manifest if r['type'] == 'Texture2D' and int(r['path_id']) == texture_id]
        if len(texture_rows) != 1:
            raise ValueError('Ambiguous source texture')
        texture = texture_rows[0]
        if alias != 'guided-beam':
            reference = old['entries'][alias].get('texture', old['entries'][alias]['source'])
            if str(texture_id) != str(reference['path_id']):
                raise ValueError('Alias texture differs: '+alias)
        else:
            record = texture['outputs'][0]
            png = exported/record['file']
            if digest(png) != record['sha256']:
                raise ValueError('Texture export hash mismatch')
            dest = public/'assets/native-fx/guided-beam.webp'
            Image.open(png).save(dest, 'WEBP', lossless=True, method=6)
        profile = {'materialColor': rgba(colors.get('_Color', colors.get('_TintColor', dict(r=1,g=1,b=1,a=1)))),
                   'materialFloats': dict(props['m_Floats']), 'textureScale': tex['m_Scale'],
                   'textureOffset': tex['m_Offset']}
        if obj.type.name == 'LineRenderer':
            profile.update({'startColor': [1,1,1,1], 'lineColor': gradient(renderer['m_Parameters']['colorGradient']),
                            'lineWidth': renderer['m_Parameters']['widthMultiplier']})
            if alias == 'electron-chain':
                profile.update({'tiles': [1,6], 'fps': 12, 'cycles': 1, 'lifetime': .5, 'loop': True})
        else:
            initial, uv = tree['InitialModule'], tree['UVModule']
            color = initial['startColor']
            start = rgba(color['maxColor'])
            if color['minMaxState'] == 2:
                start = [(a+b)/2 for a,b in zip(start, rgba(color['minColor']))]
            profile.update({'startColor': start, 'lifetime': initial['startLifetime']['scalar'],
                            'tiles': [uv['tilesX'], uv['tilesY']] if uv['enabled'] else [1,1],
                            'cycles': uv['cycles'] if uv['enabled'] else 1,
                            'loop': alias == 'vortex-body'})
            if tree['ColorModule']['enabled']:
                profile['colorOverLife'] = gradient(tree['ColorModule']['gradient']['maxGradient'])
        profiles[alias] = profile
        evidence[alias] = {'bundle': 'assets_resources_effect_skill_'+skill+'.ab', 'path_id': id,
                           'hierarchy': hierarchy, 'material_path_id': str(mid), 'material': material['m_Name'],
                           'texture': {'bundle':texture['bundle'], 'path_id':str(texture_id), 'name':texture['name'],
                                       'sha256':texture['outputs'][0]['sha256']}}
        print(alias, hierarchy, flush=True)
    data = 'export const NATIVE_FX_PROFILES='+json.dumps(profiles, separators=(',', ':'))+';\n'
    (public/'native-fx-profile-data.mjs').write_bytes(data.encode('utf8'))
    (public/'assets/native-fx/profiles-source.json').write_text(json.dumps({
        'apk_sha256': old['apk_sha256'], 'screenshots_used': False, 'selection': evidence,
        'profiles_sha256': hashlib.sha256(data.encode()).hexdigest(),
        'guided_beam_sha256': digest(public/'assets/native-fx/guided-beam.webp'),
        'notes': ['Canvas adapts source tint/UV/alpha; HDR bloom and full Unity particle motion remain separate.',
                  'vortex-light uses source prepare3 air-flow layer; branch-specific prefab switching remains pending.',
                  'electron-chain sampling remains reviewed native LineRenderer 1x6 at 12fps, not shared particle UV.']
    }, indent=2), 'utf8')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--exported', type=Path, required=True)
    p.add_argument('--public', type=Path, default=Path(__file__).resolve().parents[1]/'public')
    a = p.parse_args()
    build(a.source.resolve(), a.exported.resolve(), a.public.resolve())
