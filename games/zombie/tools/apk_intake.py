"""Read-only APK intake. Extract analysis inputs outside the web runtime tree."""
import argparse
import collections
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile

def safe_target(root, name):
    p = PurePosixPath(name)
    if not name or p.is_absolute() or '\\' in name or any(x in ('', '.', '..') for x in p.parts):
        raise ValueError('Unsafe ZIP path: ' + name)
    for part in p.parts:
        if re.search(r'[<>:"|?*\x00-\x1f]', part) or part.endswith((' ', '.')):
            raise ValueError('Unsupported Windows ZIP name: ' + name)
        if part.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]}:
            raise ValueError('Reserved Windows ZIP name: ' + name)
    dest = root.joinpath(*p.parts).resolve()
    if not dest.is_relative_to(root.resolve()):
        raise ValueError('ZIP path leaves output root')
    return dest

def analysis_input(name):
    return name.startswith('assets/ab/') or name.startswith('assets/bin/Data/Managed/Metadata/') or name in {
        'AndroidManifest.xml', 'resources.arsc', 'assets/Config.bytes', 'assets/SdkCfg.bytes',
        'assets/bin/Data/ScriptingAssemblies.json', 'assets/bin/Data/globalgamemanagers',
        'assets/bin/Data/globalgamemanagers.assets', 'lib/arm64-v8a/libil2cpp.so',
        'lib/arm64-v8a/libunity.so', 'lib/arm64-v8a/libmain.so',
    }

def intake(source, out, expected_md5=None):
    source, out = Path(source).resolve(), Path(out).resolve()
    if not source.is_file() or source.suffix.lower() != '.apk':
        raise ValueError('Supply one local APK file')
    if out.exists():
        raise ValueError('Use a new output directory; existing analysis is preserved')
    sha, md5 = hashlib.sha256(), hashlib.md5()
    with source.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            sha.update(block); md5.update(block)
    if expected_md5 and md5.hexdigest() != expected_md5.lower():
        raise ValueError('APK differs from the reference page MD5')
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 50000 or sum(i.file_size for i in entries) > 3 * 1024**3:
            raise ValueError('Archive budget exceeded')
        normalized = set()
        for info in entries:
            safe_target(out, info.filename)
            key = info.filename.casefold()
            if key in normalized:
                raise ValueError('Case-colliding ZIP entries: ' + info.filename)
            normalized.add(key)
            mode = (info.external_attr >> 16) & 0xffff
            if stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0, stat.S_IFREG, stat.S_IFDIR)):
                raise ValueError('Non-regular ZIP member: ' + info.filename)
            if info.file_size > 256 * 1024**2 or info.flag_bits & 1:
                raise ValueError('Unsupported member: ' + info.filename)
        out.mkdir(parents=True)
        inventory, extracted = [], []
        for info in entries:
            row = {'name': info.filename, 'size': info.file_size, 'compressed': info.compress_size,
                   'crc32': f'{info.CRC:08x}', 'method': info.compress_type, 'offset': info.header_offset}
            inventory.append(row)
            if info.is_dir() or not analysis_input(info.filename):
                continue
            data = archive.read(info)
            target = safe_target(out / 'unpacked', info.filename)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            extracted.append({**row, 'sha256': hashlib.sha256(data).hexdigest()})
        # Test all members, including SDK/code entries not extracted into the workspace.
        bad = archive.testzip()
        if bad:
            raise ValueError('ZIP CRC mismatch: ' + bad)
    report = {'source': str(source), 'bytes': source.stat().st_size, 'md5': md5.hexdigest(),
              'sha256': sha.hexdigest(), 'expected_md5': expected_md5, 'zip_crc': 'all matched',
              'entries': len(inventory), 'extracted_count': len(extracted), 'extracted': extracted,
              'extensions': dict(collections.Counter(PurePosixPath(i['name']).suffix.lower() for i in inventory)),
              'execution': 'none; ZIP parsing and hashing only'}
    (out / 'inventory.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding='utf8')
    (out / 'intake.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
    return {k: v for k, v in report.items() if k != 'extracted'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk'); parser.add_argument('--out', required=True); parser.add_argument('--expect-md5')
    a = parser.parse_args()
    print(json.dumps(intake(a.apk, a.out, a.expect_md5), ensure_ascii=False))
