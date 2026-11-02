"""No APK secrets or real services are used by these tests."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('fixture_profile', HERE / 'profile.py')
profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profile)
BASE = Path('E:/Documents/AI/codex/tmp') if os.name == 'nt' else Path(tempfile.gettempdir())


class ProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = profile.known_catalog()

    def test_catalog_is_from_pinned_apk(self):
        self.assertEqual(len(self.catalog['gems']), 2023)
        self.assertEqual(len(self.catalog['mercs']), 19)
        self.assertIn(82001, self.catalog['forms'])
        self.assertNotIn(81001, self.catalog['forms'])

    def test_valid_selection_and_bounds(self):
        data = {'level': 30, 'diamonds': 1000000000, 'gems': [900410207], 'forms': [82001], 'equippedForm': 82001}
        self.assertEqual(profile.validate_profile(data, self.catalog), data)

    def test_core_and_material_maps_match_the_apk(self):
        data = {'coreLevel': 1, 'cores': {'1000': 14, '2000': 10}, 'goods': {'61001': 10000, '50001': 50}}
        self.assertEqual(profile.validate_profile(data, self.catalog), data)
        for patch in [{'cores': {'1000': 47}}, {'cores': {'999': 1}}, {'goods': {'61001': -1}}, {'goods': {'123': 1}}, {'coreLevel': 47}]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                profile.validate_profile(patch, self.catalog)

    def test_rejects_invalid_fields_types_and_ownership(self):
        for data in [{'gold': -1}, {'gold': True}, {'level': 1000}, {'unknown': 1}, {'forms': [81001]},
                     {'gems': [123]}, {'equippedForm': 82001}, {'mercs': [999]}, {'gems': [900410207] * 61}]:
            with self.subTest(data=data), self.assertRaises(ValueError):
                profile.validate_profile(data, self.catalog)

    def test_atomic_write_and_no_leftover_temp(self):
        with tempfile.TemporaryDirectory(prefix='zombie-profile-test-', dir=BASE) as tmp:
            dest = Path(tmp) / 'profile.json'
            profile.atomic_json(dest, {'level': 30})
            self.assertEqual(json.loads(dest.read_text()), {'level': 30})
            self.assertEqual([p.name for p in Path(tmp).iterdir()], ['profile.json'])


class ServerTests(unittest.TestCase):
    def test_loopback_auth_validation_no_forwarding_and_graceful_shutdown(self):
        sockets = []
        for _ in range(4):
            sock = socket.socket()
            sock.bind(('127.0.0.1', 0))
            sockets.append(sock)
        ports = [s.getsockname()[1] for s in sockets]
        for sock in sockets:
            sock.close()
        with tempfile.TemporaryDirectory(prefix='zombie-server-test-', dir=BASE) as tmp:
            root = Path(tmp)
            (root / 'version.json').write_text('{}')
            (root / 'platform.json').write_text(json.dumps({'EncKey': 'synthetic-test-key'}))
            env = os.environ | {'PYTHONPYCACHEPREFIX': str(root / 'pycache')}
            command = [sys.executable, str(HERE / 'server.py'), '--version-file', str(root / 'version.json'),
                       '--platform-info', str(root / 'platform.json'), '--data-dir', str(root / 'data')]
            for flag, port in zip(['http-port', 'tcp-port', 'worker-http-port', 'admin-port'], ports):
                command += ['--' + flag, str(port)]
            proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            token_path = root / 'data/control.token'
            try:
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline:
                    if proc.poll() is not None:
                        self.fail(proc.stderr.read().decode())
                    if token_path.exists():
                        try:
                            with socket.create_connection(('127.0.0.1', ports[3]), .1):
                                break
                        except OSError:
                            pass
                    time.sleep(.1)
                token = token_path.read_text()

                def request(path, data=None, auth=True, port=ports[3]):
                    headers = {'Content-Type': 'application/json'}
                    if auth:
                        headers['Authorization'] = 'Bearer ' + token
                    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}',
                          data=None if data is None else json.dumps(data).encode(), headers=headers)
                    return opener.open(req, timeout=5)

                with self.assertRaises(urllib.error.HTTPError) as error:
                    request('/v1/status', auth=False)
                self.assertEqual(error.exception.code, 401)
                error.exception.close()
                with request('/v1/profile', {'gold': 12345, 'forms': [82001], 'equippedForm': 82001}) as response:
                    self.assertEqual(json.load(response)['profile']['gold'], 12345)
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request('/v1/profile', {'gems': [123]})
                self.assertEqual(error.exception.code, 400)
                error.exception.close()
                with request('/v1/status') as response:
                    state = json.load(response)
                    self.assertEqual(state['profile']['gold'], 12345)
                    self.assertTrue(state['workerResponding'])
                    self.assertEqual(state['nativeHealth']['connections'], 0)
                    self.assertIn('limit-box-free-draw', state['implemented'])
                    self.assertIn('skin-activate-equip-star', state['implemented'])
                    self.assertIn('mercenary-recruit-level-quality-deploy', state['implemented'])
                    self.assertIn('eight-lottery-protocol-families', state['implemented'])
                    self.assertIn('counted-gem-inventory', state['implemented'])
                    self.assertIn('remaining-activities', state['pending'])
                    self.assertIn('complete-settlement', state['pending'])
                monitor = subprocess.run([sys.executable, str(HERE / 'monitor.py'), '--data-dir', str(root / 'data'), '--admin-port', str(ports[3]), '--seconds', '0'], env=env, capture_output=True, timeout=5)
                self.assertEqual(monitor.returncode, 0, monitor.stderr.decode())
                self.assertTrue(json.loads(monitor.stdout)['healthy'])
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request('/not-a-reviewed-fixture', auth=False, port=ports[0])
                self.assertEqual(error.exception.code, 502)
                error.exception.close()
                with request('/v1/shutdown', {}) as response:
                    self.assertTrue(json.load(response)['stopping'])
                proc.wait(timeout=10)
                self.assertEqual(proc.returncode, 0)
                self.assertFalse(token_path.exists())
                self.assertFalse((root / 'data/fixture.lock').exists())
                for port in ports:
                    with self.assertRaises(OSError):
                        socket.create_connection(('127.0.0.1', port), .2)
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    proc.wait(timeout=10)
                proc.stdout.close()
                proc.stderr.close()


if __name__ == '__main__':
    unittest.main()
