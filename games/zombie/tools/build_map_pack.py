"""Build a game-only native map pack from the verified Unity export and APK bundles.

Run with requirements-assets.txt. The two map schemas were checked against the
arm64 unpack routines (0x1788C10 / 0x11D15C8), including fixed array bounds 3 / 4.
No account, SDK, endpoint, or executable data is published.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re

from PIL import Image
import UnityPy

from decode_client_config import decode

APK_SHA = '7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6'
SCHEMAS = {
    'ResDef.MapConfig': {'header_bytes': 20, 'unpack_rva': '0x1788C10', 'fields': [
        ['MapID', 'uint'], ['BackgroundPaths', 'string', 3], ['MapBorderParam', 'float', 4]]},
    'BattleCore.MapConfig': {'header_bytes': 20, 'unpack_rva': '0x11D15C8', 'fields': [
        ['MapID', 'uint'], ['MapBorderParam', 'FP', 4]]},
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(export_dir, bundles, public):
    if UnityPy.__version__ != '1.25.4':
        raise ValueError('Use UnityPy==1.25.4')
    export_dir, bundles, public = [p.resolve() for p in (export_dir, bundles, public)]
    assets, module = public / 'assets/client-maps', public / 'client-map-data.mjs'
    if assets.exists() or module.exists():
        raise ValueError('Use a new output directory; preserve the earlier map pack')
    manifest = json.loads((export_dir / 'manifest.json').read_text('utf8'))
    inputs, geometries = {}, {}

    def read(record):
        output = record['outputs'][0]
        source = (export_dir / output['file']).resolve()
        if not source.is_relative_to(export_dir) or sha(source) != output['sha256']:
            raise ValueError('Export hash/path mismatch')
        inputs[(record['bundle'], record['path_id'])] = {
            'bundle': record['bundle'], 'bundle_sha256': record['bundle_sha256'],
            'path_id': str(record['path_id']), 'name': record.get('name'),
            'file_sha256': output['sha256']}
        return source

    def table(name, bundle, schemas):
        record = next(x for x in manifest if x['type'] == 'TextAsset' and x['bundle'] == bundle)
        return decode(read(record).read_bytes(), name, schemas)['rows']

    maps = table('ResDef.MapConfig', 'assets_resources_config_resbin_mapconfig.bytes.ab', SCHEMAS)
    fp = {x['MapID']: x for x in table('BattleCore.MapConfig',
          'assets_resources_config_resbin_fp_mapconfig.bytes.ab', SCHEMAS)}
    sprites = {x['name']: x for x in manifest if x['type'] == 'Sprite'
               and x['bundle'].startswith('assets_textures_map_')}
    map_items = {x['path_id']: x for x in manifest if x['type'] == 'Sprite'
                 and x['bundle'] == 'assets_textures_mapitem.ab'}
    visuals = {}
    assets.mkdir(parents=True)
    for row in maps:
        if row['MapBorderParam'] != fp[row['MapID']]['MapBorderParam'] or any(row['BackgroundPaths'][1:]):
            raise ValueError('Map needs another layer or a border conversion')
        prefab = row['BackgroundPaths'][0]
        if not re.fullmatch(r'Level/Map/level_ZDCJ_\d+', prefab):
            raise ValueError('Unreviewed map path')
        name = prefab.rsplit('level_', 1)[1]
        record = sprites.get(name)
        visual = {**row, 'file': None}
        visuals[str(row['MapID'])] = visual
        if not record:
            visual['missing'] = 'Reference APK has no exported sprite for this configured map'
            continue
        bundle_name = 'assets_resources_' + prefab.lower().replace('/', '_') + '.ab'
        bundle = bundles / bundle_name
        expected = next(x['bundle_sha256'] for x in manifest if x['bundle'] == bundle_name)
        if sha(bundle) != expected:
            raise ValueError('Prefab bundle hash mismatch')
        env = UnityPy.load(str(bundle))
        renderers = [obj.read_typetree() for obj in env.objects if obj.type.name == 'SpriteRenderer']
        transforms = {obj.read_typetree()['m_GameObject']['m_PathID']: obj.read_typetree()
                      for obj in env.objects if obj.type.name == 'Transform'}
        centers = [v for v in renderers if v['m_Sprite']['m_PathID'] == record['path_id']]
        if len(centers) != 1:
            raise ValueError('Map has no unique matching ground sprite')
        renderer = centers[0]
        center = transforms[renderer['m_GameObject']['m_PathID']]
        image = Image.open(read(record)).convert('RGBA')
        layers = []
        for layer in sorted(renderers, key=lambda v: (v['m_SortingLayer'], v['m_SortingOrder'])):
            transform = transforms[layer['m_GameObject']['m_PathID']]
            if (layer['m_FlipX'] or layer['m_FlipY'] or layer['m_DrawMode'] != 0
                    or transform['m_LocalRotation'] != {'x': 0., 'y': 0., 'z': 0., 'w': 1.}
                    or transform['m_Father'] != center['m_Father']
                    or layer['m_Color'] != {'r': 1., 'g': 1., 'b': 1., 'a': 1.}):
                raise ValueError('Unreviewed native layer transform/material')
            layers.append({'sprite_path_id': str(layer['m_Sprite']['m_PathID']),
                           'sprite_file_id': layer['m_Sprite']['m_FileID'],
                           'position': transform['m_LocalPosition'], 'scale': transform['m_LocalScale'],
                           'sorting_layer': layer['m_SortingLayer'], 'sorting_order': layer['m_SortingOrder']})
            if layer is renderer:
                continue
            item = map_items[layer['m_Sprite']['m_PathID']]
            overlay = Image.open(read(item)).convert('RGBA')
            ratio = record['m_PixelsToUnits'] / item['m_PixelsToUnits']
            w = round(overlay.width * ratio * transform['m_LocalScale']['x'])
            h = round(overlay.height * ratio * transform['m_LocalScale']['y'])
            x = image.width * record['m_Pivot']['x'] + (transform['m_LocalPosition']['x'] -
                center['m_LocalPosition']['x']) * record['m_PixelsToUnits'] - w * item['m_Pivot']['x']
            y = image.height * (1-record['m_Pivot']['y']) - (transform['m_LocalPosition']['y'] -
                center['m_LocalPosition']['y']) * record['m_PixelsToUnits'] - h * (1-item['m_Pivot']['y'])
            image.alpha_composite(overlay.resize((w, h), Image.Resampling.LANCZOS), (round(x), round(y)))
        filename = name + '.webp'
        image.save(assets / filename, 'WEBP', quality=90, method=6)
        visual.update(file='./assets/client-maps/' + filename, dimensions=list(image.size),
                      nativeSize=renderer['m_Size'], pivot=record['m_Pivot'],
                      pixelsToUnits=record['m_PixelsToUnits'])
        geometries[str(row['MapID'])] = {'bundle': bundle_name, 'bundle_sha256': expected,
            'sprite_path_id': str(record['path_id']), 'sprite_file_id': renderer['m_Sprite']['m_FileID'],
            'draw_mode': renderer['m_DrawMode'], 'size': renderer['m_Size'], 'layers': layers}

    # Full original LevelID -> MapID mapping also covers lazy activity stages.
    schemas = json.loads(Path(__file__).with_name('client-schemas.json').read_text('utf8'))
    if schemas['apk_sha256'] != APK_SHA:
        raise ValueError('Unreviewed source APK')
    levels = table('BattleCore.LevelBaseConfig',
                   'assets_resources_config_resbin_fp_levelbaseconfig.bytes.ab', schemas['schemas'])
    level_maps = {str(row['LevelID']): row['MapID'] for row in levels}
    for row in levels:
        if 1001 <= row['LevelID'] <= 1259 or 2001 <= row['LevelID'] <= 2259:
            if not visuals.get(str(row['MapID']), {}).get('file'):
                raise ValueError('Campaign map missing')
    module.write_text('// Generated by tools/build_map_pack.py from the verified v1.10 APK.\n' +
        'export const CLIENT_MAPS=' + json.dumps(visuals, ensure_ascii=False, separators=(',', ':')) + ';\n' +
        'export const CLIENT_LEVEL_MAPS=' + json.dumps(level_maps, separators=(',', ':')) + ';\n', 'utf8')
    files = [module] + sorted(assets.glob('*.webp'))
    proof = {'apk_sha256': APK_SHA, 'schemas': SCHEMAS, 'inputs': list(inputs.values()),
             'prefabs': geometries, 'configured_maps': len(visuals),
             'available_maps': sum(bool(x['file']) for x in visuals.values()),
             'missing_maps': [int(k) for k, v in visuals.items() if not v['file']],
             'level_mappings': len(level_maps),
             'outputs': [{'file': p.relative_to(public).as_posix(), 'bytes': p.stat().st_size,
                          'sha256': sha(p)} for p in files],
             'adapter': 'Native ground artwork and prefab edge layers, aspect preserved; independent web camera/wall remain.'}
    (assets / 'provenance.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2), 'utf8')
    print(json.dumps({k: proof[k] for k in ['configured_maps', 'available_maps', 'missing_maps', 'level_mappings']}))
    return proof


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export_dir', type=Path)
    parser.add_argument('--bundles', type=Path, required=True)
    parser.add_argument('--public', type=Path, required=True)
    args = parser.parse_args()
    build(args.export_dir, args.bundles, args.public)
