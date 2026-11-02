"""Control the local synthetic APK profile; no real account is contacted."""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_DATA = Path('E:/Documents/AI/codex/tmp/zombie-native-fixture') if os.name == 'nt' else Path.home() / '.local/share/zombie-native-fixture'


def main():
    parser = argparse.ArgumentParser(description='Inspect or modify the synthetic local APK profile')
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA)
    parser.add_argument('--admin-port', type=int, default=53176)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('status')
    sub.add_parser('profile')
    sub.add_parser('reset')
    sub.add_parser('shutdown')
    set_profile = sub.add_parser('set')
    for name in ('level', 'gold', 'diamonds', 'energy', 'attack', 'fight', 'reagent'):
        set_profile.add_argument('--' + name, type=int)
    set_profile.add_argument('--max-hp', dest='maxHp', type=int)
    set_profile.add_argument('--core-level', dest='coreLevel', type=int)
    for name in ('cores', 'goods'):
        set_profile.add_argument('--' + name, help='comma-separated ID:value entries')
    for name in ('gems', 'forms', 'outfits', 'mercs'):
        set_profile.add_argument('--' + name, help='comma-separated local APK IDs; empty value clears the list')
    for name, dest in (('equipped-form', 'equippedForm'), ('equipped-outfit', 'equippedOutfit'), ('active-merc', 'activeMerc')):
        set_profile.add_argument('--' + name, dest=dest, type=int)
    args = parser.parse_args()
    if not 1024 <= args.admin_port <= 65535:
        parser.error('admin port must be 1024..65535')
    token = (args.data_dir / 'control.token').read_text(encoding='ascii').strip()
    method, route, body = 'GET', '/v1/' + args.command, None
    if args.command == 'set':
        patch = {name: getattr(args, name) for name in ('level', 'gold', 'diamonds', 'energy', 'attack', 'maxHp', 'fight', 'reagent', 'coreLevel', 'equippedForm', 'equippedOutfit', 'activeMerc') if getattr(args, name) is not None}
        for name in ('cores', 'goods'):
            if getattr(args, name) is not None:
                try:
                    pairs = [x.strip().split(':') for x in getattr(args, name).split(',') if x.strip()]
                    patch[name] = {str(int(k)): int(v) for k, v in pairs}
                except ValueError:
                    parser.error(name + ' must be comma-separated ID:value entries')
        for name in ('gems', 'forms', 'outfits', 'mercs'):
            if getattr(args, name) is not None:
                try:
                    patch[name] = [int(x.strip()) for x in getattr(args, name).split(',') if x.strip()]
                except ValueError:
                    parser.error(name + ' must be comma-separated numeric IDs')
        if not patch:
            parser.error('set requires at least one field')
        method, route, body = 'POST', '/v1/profile', json.dumps(patch).encode('utf8')
    elif args.command in ('reset', 'shutdown'):
        method, route, body = 'POST', '/v1/' + args.command, b'{}'
    request = urllib.request.Request(f'http://127.0.0.1:{args.admin_port}{route}', data=body, method=method,
                                     headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=5) as response:
            print(json.dumps(json.load(response), ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as exc:
        raise SystemExit(exc.read().decode('utf8', 'replace')) from exc


if __name__ == '__main__':
    main()
