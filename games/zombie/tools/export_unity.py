"""Export original Unity sprites, textures, text/config, audio, fonts and optional UI trees.

Requires the pinned requirements-assets.txt in an isolated Python environment.
Outputs are analysis artifacts, never an automatically published web directory.
"""
import argparse
import collections
import gc
import hashlib
import json
from pathlib import Path
import re
import time
import UnityPy

def slug(value):
    return re.sub(r'[^\w.\-]', '_', str(value))[:85].strip('. ') or 'unnamed'

def export(source, out, pattern=None, trees=False):
    if UnityPy.__version__ != '1.25.4':
        raise ValueError('Use UnityPy==1.25.4 for reproducible extraction')
    source, out = Path(source).resolve(), Path(out).resolve()
    if out.exists():
        raise ValueError('Use a new output directory; earlier exports are preserved')
    runtime = Path(__file__).resolve().parents[1] / 'public'
    if out.is_relative_to(runtime):
        raise ValueError('Keep analysis outputs outside the web runtime tree')
    files = sorted(source.rglob('*.ab')) if source.is_dir() else [source]
    if pattern:
        files = [p for p in files if re.search(pattern, p.name, re.I)]
    if not files:
        raise ValueError('No matching Unity bundles')
    out.mkdir(parents=True)
    manifest, failures, skipped, bundle_reports = [], [], [], []
    counts = collections.Counter(); start = time.monotonic()
    def write(kind, stem, ext, data):
        dest = out / kind / (stem + ext); dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return {'file': dest.relative_to(out).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    for index, bundle in enumerate(files):
        digest = hashlib.sha256(bundle.read_bytes()).hexdigest()
        report = {'bundle': str(bundle.relative_to(source)) if source.is_dir() else bundle.name,
                  'sha256': digest, 'objects': 0, 'exports': 0, 'errors': 0}
        try:
            env = UnityPy.load(str(bundle)); report['unity_versions'] = sorted({f.unity_version for f in env.assets})
            for obj in env.objects:
                kind = obj.type.name; counts[kind] += 1; report['objects'] += 1
                record = {'bundle': report['bundle'], 'bundle_sha256': digest, 'path_id': obj.path_id, 'type': kind}
                try:
                    try: record['name'] = obj.peek_name()
                    except Exception: record['name'] = ''
                    stem = slug(record['name']) + '-' + digest[:10] + '-' + str(obj.path_id)
                    outputs = []
                    if kind in ('Sprite', 'Texture2D'):
                        import io
                        data = obj.parse_as_object()
                        if kind == 'Texture2D' and data.m_Width == 0 and data.m_Height == 0 and not data.image_data and data.m_StreamData.size == 0:
                            skipped.append({**record, 'reason': 'zero-sized runtime-generated texture; no stored pixels'})
                            continue
                        image = data.image; encoded = io.BytesIO(); image.save(encoded, format='PNG')
                        record['dimensions'] = list(image.size)
                        if kind == 'Sprite':
                            for attr in ('m_Rect', 'm_Pivot', 'm_Border', 'm_PixelsToUnits'):
                                value = getattr(data, attr, None)
                                if isinstance(value, (int, float)): record[attr] = value
                                elif value is not None: record[attr] = {k: getattr(value, k) for k in ('x','y','z','w','width','height') if hasattr(value,k)}
                        outputs.append(write('sprites' if kind == 'Sprite' else 'textures', stem, '.png', encoded.getvalue()))
                    elif kind == 'TextAsset':
                        data = obj.parse_as_object(); raw = data.m_Script
                        raw = raw.encode('utf8', 'surrogateescape') if isinstance(raw, str) else bytes(raw)
                        outputs.append(write('text', stem, '.bytes', raw)); record['prefix_hex'] = raw[:24].hex()
                    elif kind == 'Font':
                        data = obj.parse_as_object(); raw = bytes(data.m_FontData)
                        if raw: outputs.append(write('fonts', stem, '.ttf', raw))
                    elif kind == 'AudioClip':
                        data = obj.parse_as_object()
                        for name, sample in data.samples.items():
                            extension = Path(name).suffix or '.wav'
                            outputs.append(write('audio', stem + '-' + slug(Path(name).stem), extension, sample))
                    elif kind == 'Mesh':
                        data = obj.parse_as_object(); raw = data.export()
                        if raw: outputs.append(write('meshes', stem, '.obj', raw.encode('utf8') if isinstance(raw, str) else bytes(raw)))
                    elif trees and kind in ('GameObject','Transform','RectTransform','MonoBehaviour','MonoScript','SpriteAtlas','Animator','AnimatorController','AnimationClip','Canvas','CanvasRenderer','Material','ParticleSystem','ParticleSystemRenderer','MeshRenderer','MeshFilter','TrailRenderer','SortingGroup'):
                        tree = obj.parse_as_dict(); raw = json.dumps(tree, ensure_ascii=True, indent=2, default=str).encode('utf8')
                        outputs.append(write('trees', stem, '.json', raw))
                    if outputs:
                        record['outputs'] = outputs; manifest.append(record); report['exports'] += len(outputs)
                except Exception as e:
                    report['errors'] += 1; failures.append({**record, 'error': str(e)[:2000]})
            del env
        except Exception as e:
            report['errors'] += 1; failures.append({'bundle': report['bundle'], 'bundle_sha256': digest, 'error': repr(e)[:2000]})
        bundle_reports.append(report)
        if index % 50 == 0:
            gc.collect(); print(json.dumps({'bundles_done': index+1, 'bundles_total': len(files), 'exports': len(manifest), 'errors': len(failures)}), flush=True)
    summary = {'source': str(source), 'UnityPy': UnityPy.__version__, 'bundles': len(files), 'exports': len(manifest), 'errors': len(failures), 'skipped': len(skipped), 'object_types': dict(counts), 'seconds': round(time.monotonic()-start,2)}
    for name, value in [('manifest.json',manifest),('failures.json',failures),('skipped.json',skipped),('bundles.json',bundle_reports),('summary.json',summary)]:
        (out/name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    return summary

if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('source');p.add_argument('--out',required=True);p.add_argument('--include');p.add_argument('--trees',action='store_true')
    a=p.parse_args();export(a.source,a.out,a.include,a.trees)
