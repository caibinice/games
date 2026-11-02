"""Validated, synthetic-only local profile used by the APK fixture."""
from __future__ import annotations

import json
import os
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOUNDS = {
    'level': (1, 999), 'gold': (0, 1_000_000_000),
    'diamonds': (0, 1_000_000_000), 'energy': (0, 1_000_000),
    'attack': (1, 1_000_000), 'maxHp': (1, 100_000_000),
    'fight': (0, 1_000_000_000), 'reagent': (0, 9999),
    'coreLevel': (0, 46),
}


def source_json(file: str, prefix: str):
    for line in (ROOT / 'public' / file).read_text(encoding='utf8').splitlines():
        if line.startswith(prefix) and line.endswith(';'):
            return json.loads(line[len(prefix):-1])
    raise ValueError('APK catalogue missing: ' + file)


def known_catalog() -> dict[str, set[int]]:
    gems = source_json('client-gem-data.mjs', 'export const CLIENT_GEMS=')
    tables = source_json('native-growth-data.mjs', 'export const NATIVE_GROWTH=')['tables']
    activatable = {row['SkinID'] for row in tables['SkinLevelConfig'] if row['SkinLevel'] == 1}
    return {
        'gems': {row['id'] for row in gems},
        'forms': {row['SkinID'] for row in tables['SkinBaseConfig'] if row['SkinType'] == 2 and row['SkinID'] in activatable},
        'outfits': {row['SkinID'] for row in tables['SkinBaseConfig'] if row['SkinType'] == 1 and row['SkinID'] in activatable},
        'mercs': {row['ID'] for row in tables['MercenaryBaseConfig']},
        'coreIds': {row['ID'] for row in tables['MagicSkillConfig']},
        'goodIds': {row['ItemID'] for row in tables['GoodsConfig'] if row['ItemID'] > 3},
    }


def validate_profile(value: object, catalog: dict[str, set[int]]) -> dict:
    if not isinstance(value, dict):
        raise ValueError('profile must be an object')
    result = {}
    for key, item in value.items():
        if key in ('cores', 'goods'):
            allowed = catalog['coreIds' if key == 'cores' else 'goodIds']
            limit = 46 if key == 'cores' else 1_000_000_000
            if not isinstance(item, dict) or len(item) > (14 if key == 'cores' else 500):
                raise ValueError('invalid local map: ' + key)
            if any(not isinstance(k, str) or not k.isdigit() or str(int(k)) != k or int(k) not in allowed
                   or type(v) is not int or not 0 <= v <= limit for k, v in item.items()):
                raise ValueError('invalid local map entry: ' + key)
            result[key] = dict(item)
            continue
        if key in ('gems', 'forms', 'outfits', 'mercs'):
            if not isinstance(item, list) or len(item) > 60 or any(type(x) is not int or x not in catalog[key] for x in item):
                raise ValueError(f'{key} must contain at most 60 IDs from the local APK catalogue')
            result[key] = list(item)
            continue
        if key in ('equippedForm', 'equippedOutfit', 'activeMerc'):
            if type(item) is not int or item < 0:
                raise ValueError(f'invalid selection: {key}')
            result[key] = item
            continue
        if key not in BOUNDS or type(item) is not int or not BOUNDS[key][0] <= item <= BOUNDS[key][1]:
            raise ValueError(f'invalid profile field: {key}')
        result[key] = item
    for key, listing in (('equippedForm', 'forms'), ('equippedOutfit', 'outfits'), ('activeMerc', 'mercs')):
        if result.get(key) and result[key] not in result.get(listing, []):
            raise ValueError(f'{key} must be in {listing}')
    return result


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + '.' + secrets.token_hex(6) + '.tmp')
    try:
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()
