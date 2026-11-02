"""Loopback-only Python control plane for the pinned APK's local protocol fixture.

HTTP routes and the binary TCP codec are delegated to the existing reviewed
Node worker. There is no forwarding to a real game service.
"""
from __future__ import annotations

import argparse
import hmac
import http.client
import json
import os
import secrets
import shutil
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from profile import atomic_json, known_catalog, validate_profile

ROOT = Path(__file__).resolve().parents[2]
WORKER = ROOT / 'tools' / 'local-protocol' / 'server.mjs'
DEFAULT_DATA = Path('E:/Documents/AI/codex/tmp/zombie-native-fixture') if os.name == 'nt' else Path.home() / '.local/share/zombie-native-fixture'
MAX_BODY = 65536


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False


class QuietHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_args):
        pass  # The worker records sanitized paths and key names only.

    def reply(self, status, body, content_type='application/json; charset=utf-8'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
        self.close_connection = True

    def json_reply(self, status, data):
        self.reply(status, json.dumps(data, ensure_ascii=False).encode('utf8'))

    def read_body(self, max_size=MAX_BODY):
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise ValueError('invalid content length')
        if size < 0 or size > max_size:
            raise ValueError('body too large')
        return self.rfile.read(size)


class ProxyHandler(QuietHandler):
    def do_CONNECT(self):
        self.reply(502, b'Local fixture does not forward TLS', 'text/plain; charset=utf-8')

    def forward(self):
        try:
            body = self.read_body()
            # The internal worker accepts absolute proxy URLs, but never forwards
            # them to the supplied host; it matches reviewed fixture paths only.
            conn = http.client.HTTPConnection('127.0.0.1', self.server.worker_port, timeout=10)
            headers = {'Content-Type': self.headers.get('Content-Type', ''), 'Connection': 'close'}
            conn.request(self.command, self.path, body=body, headers=headers)
            response = conn.getresponse()
            data = response.read(MAX_BODY + 1)
            if len(data) > MAX_BODY:
                raise ValueError('worker response too large')
            self.reply(response.status, data, response.getheader('Content-Type', 'application/json; charset=utf-8'))
            conn.close()
        except ValueError as exc:
            self.json_reply(413, {'error': str(exc)})
        except (OSError, http.client.HTTPException):
            self.json_reply(503, {'error': 'local protocol worker unavailable'})

    do_GET = forward
    do_POST = forward


class AdminHandler(QuietHandler):
    def authorized(self):
        value = self.headers.get('Authorization', '')
        return hmac.compare_digest(value, 'Bearer ' + self.server.token)

    def do_GET(self):
        if not self.authorized():
            self.json_reply(401, {'error': 'local control token required'})
            return
        if self.path == '/v1/status':
            worker_health = None
            try:
                connection = http.client.HTTPConnection('127.0.0.1', self.server.worker_port, timeout=1)
                connection.request('GET', '/__fixture/status')
                response = connection.getresponse()
                worker_health = json.loads(response.read(16384)) if response.status == 200 else None
            except (OSError, ValueError, http.client.HTTPException):
                pass
            finally:
                if 'connection' in locals():
                    connection.close()
            self.json_reply(200, {'localFixture': True, 'workerRunning': self.server.worker.poll() is None,
                                  'workerResponding': worker_health is not None, 'nativeHealth': worker_health,
                                  'profile': self.server.read_profile(), 'reloginRequired': True,
                                  'implemented': ['sdk', 'auth', 'directory', 'native-account', 'role', 'level-1001', 'profile-assets', 'owned-appearance', 'owned-mercenary', 'bag-gem-roll', 'gem-compose', 'core-level-data', 'core-upgrade', 'gem-inlay-remove-lock-pages', 'equipment-level-upgrade', 'equipment-onekey-upgrade', 'operating-text', 'limit-box-activity', 'limit-box-free-draw', 'skin-activate-equip-star', 'mercenary-recruit-level-quality-deploy', 'eight-lottery-protocol-families', 'lottery-independent-history', 'auto-use-random-gems', 'counted-gem-inventory'],
                                  'pending': ['all-menu-actions', 'remaining-activities', 'activity-native-ui-parity', 'all-levels', 'complete-settlement', 'equipment-reforge', 'colorful-skin-and-form-special-actions']})
        elif self.path == '/v1/profile':
            self.json_reply(200, self.server.read_profile())
        else:
            self.json_reply(404, {'error': 'unknown local control route'})

    def do_POST(self):
        if not self.authorized():
            self.json_reply(401, {'error': 'local control token required'})
            return
        try:
            if self.path == '/v1/shutdown':
                self.read_body(8192)
                self.json_reply(200, {'stopping': True})
                self.server.stop_event.set()
                return
            if self.path == '/v1/reset':
                self.read_body(8192)
                patch = None
            elif self.path == '/v1/profile':
                if not self.headers.get('Content-Type', '').lower().startswith('application/json'):
                    raise ValueError('JSON content type required')
                patch = json.loads(self.read_body(8192).decode('utf8'))
                if not isinstance(patch, dict):
                    raise ValueError('profile patch must be an object')
            else:
                self.json_reply(404, {'error': 'unknown local control route'})
                return
            with self.server.profile_lock:
                updated = {} if patch is None else self.server.read_profile() | patch
                updated = validate_profile(updated, self.server.gems)
                atomic_json(self.server.profile_path, updated)
            self.json_reply(200, {'profile': updated, 'reloginRequired': True})
        except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
            self.json_reply(400, {'error': str(exc)})


def free_port(value):
    try:
        port = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError('invalid port') from exc
    if not 1024 <= port <= 65535:
        raise argparse.ArgumentTypeError('port must be 1024..65535')
    return port


def run(args):
    ports = [args.http_port, args.tcp_port, args.worker_http_port, args.admin_port]
    if len(set(ports)) != 4:
        raise ValueError('fixture ports must be distinct')
    for path in (args.version_file, args.platform_info):
        if not path.is_file():
            raise FileNotFoundError(path)
    json.loads(args.version_file.read_text(encoding='utf-8-sig'))
    platform = json.loads(args.platform_info.read_text(encoding='utf-8-sig'))
    if not isinstance(platform.get('EncKey'), str) or not platform['EncKey']:
        raise ValueError('platform info lacks the local sample key')
    del platform
    node = shutil.which(args.node)
    if not node:
        raise FileNotFoundError('Node.js is required for the existing native codec worker')
    args.data_dir.mkdir(parents=True, exist_ok=True)
    profile_path = args.data_dir / 'profile.json'
    ids = known_catalog()
    if profile_path.exists():
        validate_profile(json.loads(profile_path.read_text(encoding='utf-8-sig')), ids)
    else:
        atomic_json(profile_path, {})
    token = secrets.token_urlsafe(32)
    token_path = args.data_dir / 'control.token'
    token_path.write_text(token, encoding='ascii')
    try:
        token_path.chmod(0o600)
    except OSError:
        pass
    role_path = args.data_dir / 'role-state.json'
    worker_args = [node, str(WORKER), '--port', str(args.worker_http_port), '--tcp-port', str(args.tcp_port),
                   '--log', str(args.data_dir / 'worker-requests.jsonl'), '--version', str(args.version_file),
                   '--sdk-path', '/login/login_verify_passwd.php', '--sdk-path', '/login/login_verify_mobile_passwd.php',
                   '--sdk-path', '/login/check_login.php', '--game-auth', '--directory', '--native-account',
                   '--platform-info', str(args.platform_info), '--role-state', str(role_path), '--profile-file', str(profile_path)]
    worker_out = (args.data_dir / 'worker.stdout.log').open('ab')
    worker_err = (args.data_dir / 'worker.stderr.log').open('ab')
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    worker = None
    servers = []
    try:
        worker = subprocess.Popen(worker_args, cwd=ROOT, stdout=worker_out, stderr=worker_err, creationflags=flags)
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if worker.poll() is not None:
                raise RuntimeError('native protocol worker stopped during startup; check worker.stderr.log')
            try:
                conn = http.client.HTTPConnection('127.0.0.1', args.worker_http_port, timeout=.5)
                conn.request('GET', '/__fixture/status')
                res = conn.getresponse()
                ok = res.status == 200
                res.read()
                conn.close()
                if ok:
                    break
            except OSError:
                pass
            time.sleep(.1)
        else:
            raise TimeoutError('native protocol worker did not become ready')
        stopped = threading.Event()
        proxy = LocalServer(('127.0.0.1', args.http_port), ProxyHandler)
        proxy.worker_port = args.worker_http_port
        servers.append(proxy)
        threading.Thread(target=proxy.serve_forever, daemon=True).start()
        admin = LocalServer(('127.0.0.1', args.admin_port), AdminHandler)
        admin.token, admin.worker, admin.gems, admin.profile_path = token, worker, ids, profile_path
        admin.worker_port = args.worker_http_port
        admin.stop_event = stopped
        admin.profile_lock = threading.Lock()
        admin.read_profile = lambda: validate_profile(json.loads(profile_path.read_text(encoding='utf-8-sig')), ids)
        servers.append(admin)
        threading.Thread(target=admin.serve_forever, daemon=True).start()
        print(json.dumps({'localFixture': True, 'http': args.http_port, 'tcp': args.tcp_port,
                          'admin': args.admin_port, 'dataDir': str(args.data_dir),
                          'worker': 'reviewed-node-codec', 'addresses': '127.0.0.1 only'}), flush=True)
        def stop(_signum, _frame):
            stopped.set()
        signal.signal(signal.SIGINT, stop)
        if hasattr(signal, 'SIGTERM'):
            signal.signal(signal.SIGTERM, stop)
        while not stopped.wait(.3):
            if worker.poll() is not None:
                raise RuntimeError('native protocol worker exited; check worker.stderr.log')
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()
        if worker and worker.poll() is None:
            worker.terminate()
            try:
                worker.wait(timeout=5)
            except subprocess.TimeoutExpired:
                worker.kill()
                worker.wait(timeout=5)
        worker_out.close()
        worker_err.close()
        token_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description='Local-only APK HTTP and binary protocol fixture')
    parser.add_argument('--version-file', required=True, type=Path)
    parser.add_argument('--platform-info', required=True, type=Path)
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA)
    parser.add_argument('--http-port', type=free_port, default=53173)
    parser.add_argument('--tcp-port', type=free_port, default=53174)
    parser.add_argument('--worker-http-port', type=free_port, default=53175)
    parser.add_argument('--admin-port', type=free_port, default=53176)
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True)
    lock = args.data_dir / 'fixture.lock'
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise SystemExit('fixture.lock already exists; inspect the recorded process before removing a stale lock') from exc
    try:
        os.write(fd, str(os.getpid()).encode('ascii'))
        os.close(fd)
        run(args)
    finally:
        lock.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
