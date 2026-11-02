"""Bounded, read-only health monitor. Never runs indefinitely."""
import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
import urllib.error
import urllib.request
from control import DEFAULT_DATA


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA)
    parser.add_argument('--admin-port', type=int, default=53176)
    parser.add_argument('--seconds', type=int, default=12)
    parser.add_argument('--interval', type=int, default=2)
    args = parser.parse_args()
    if not 0 <= args.seconds <= 60 or not 1 <= args.interval <= 10 or not 1024 <= args.admin_port <= 65535:
        parser.error('seconds: 0..60; interval: 1..10; admin-port: 1024..65535')
    token = (args.data_dir / 'control.token').read_text(encoding='ascii').strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + args.seconds
    while True:
        request = urllib.request.Request(f'http://127.0.0.1:{args.admin_port}/v1/status', headers={'Authorization': 'Bearer ' + token})
        try:
            with opener.open(request, timeout=2) as response:
                data = json.load(response)
        except (OSError, ValueError, urllib.error.URLError):
            print(json.dumps({'healthy': False, 'reason': 'local control request failed or timed out'}), flush=True)
            return 1
        native = data.get('nativeHealth') or {}
        stamp = native.get('lastPacketAt')
        age = round((datetime.now(timezone.utc) - datetime.fromisoformat(stamp.replace('Z', '+00:00'))).total_seconds(), 1) if stamp else None
        healthy = bool(data.get('workerRunning') and data.get('workerResponding'))
        print(json.dumps({'healthy': healthy, 'connections': native.get('connections'), 'packets': native.get('packets'),
                          'lastCommand': native.get('lastCommand'), 'lastPacketAgeSeconds': age,
                          'lastUnhandled': native.get('lastUnhandled')}, ensure_ascii=False), flush=True)
        if not healthy:
            return 1
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return 0
        time.sleep(min(args.interval, remaining))


if __name__ == '__main__':
    raise SystemExit(main())
