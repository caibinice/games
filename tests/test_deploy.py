from __future__ import annotations
import gzip
import hashlib
import json
import os
import shutil
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts'))
import deploy
import config


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        base = config.work_root() / 'tmp'
        base.mkdir(parents=True, exist_ok=True)
        self.context = tempfile.TemporaryDirectory(prefix='games-deploy-test-', dir=base)
        self.root = Path(self.context.name)
        self.assertTrue(self.root.resolve().is_relative_to(base.resolve()))
        self.patch = patch.object(deploy, 'ROOT', self.root)
        self.patch.start()
        shutil.copytree(REPO / 'games', self.root / 'games')
        shutil.copytree(REPO / 'site', self.root / 'site')
        self.dist = self.root / 'dist'
        self.dist.mkdir()
        catalog=deploy.catalogue()
        game=next(g for g in catalog if g['id']=='pindou')
        for name,content in deploy.source_files([game]).items():
            file=self.dist/name;file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(content)
        (self.dist/'games/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf-8')
        self.manifest = {'version': 2, 'base': '/games/', 'games': [game], 'files': []}
        for file in sorted(self.dist.rglob('*')):
            if not file.is_file():
                continue
            content = file.read_bytes()
            self.manifest['files'].append({'path': file.relative_to(self.dist).as_posix(), 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
            if file.suffix in {'.html', '.mjs', '.css', '.svg', '.json', '.webmanifest'}:
                Path(str(file) + '.gz').write_bytes(gzip.compress(content, mtime=0))
        self.save_manifest()

    def tearDown(self):
        self.patch.stop()
        self.context.cleanup()

    def save_manifest(self):
        (self.dist / 'release-manifest.json').write_text(json.dumps(self.manifest), encoding='utf-8')

    def test_built_package_only_and_credentials_excluded(self):
        (self.root / 'credentials').mkdir()
        (self.root / 'credentials/config.ini').write_text('TOKEN_FIXTURE', encoding='utf-8')
        archive = self.root / 'package.tar.gz'
        self.assertEqual(len(deploy.package_dist(self.dist, archive)['files']), len(self.manifest['files']))
        with tarfile.open(archive) as tar:
            names = tar.getnames()
        self.assertIn('www/games/pindou/index.html', names)
        self.assertIn('www/release-manifest.json', names)
        self.assertTrue(all(name.startswith('www/') and 'credentials' not in name for name in names))

    def test_rejects_dist_tampering(self):
        (self.dist / 'games/pindou/engine.mjs').write_text('changed', encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'hash mismatch'):
            deploy.validate_dist(self.dist)

    def test_rejects_stale_build_after_source_changes(self):
        (self.root / 'games/pindou/public/engine.mjs').write_text('new source', encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'stale'):
            deploy.validate_dist(self.dist)

    def test_rejects_undeclared_files_and_private_credentials(self):
        file = self.dist / 'credentials.txt'
        file.write_text('TOKEN_FIXTURE', encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'Unexpected/missing'):
            deploy.validate_dist(self.dist)

    def test_rejects_path_traversal_and_duplicate_paths(self):
        old = self.manifest['files'][0]['path']
        for name in ['../credentials/config.ini', 'games/pindou/../../config.ini', 'games/pindou/credentials.json']:
            self.manifest['files'][0]['path'] = name
            self.save_manifest()
            with self.assertRaisesRegex(RuntimeError, 'Unexpected runtime'):
                deploy.validate_dist(self.dist)
        self.manifest['files'][0]['path'] = old
        self.manifest['files'].append(self.manifest['files'][0])
        self.save_manifest()
        with self.assertRaisesRegex(RuntimeError, 'Unexpected/missing'):
            deploy.validate_dist(self.dist)

    def test_rejects_corrupt_gzip(self):
        (self.dist / 'games/pindou/index.html.gz').write_bytes(gzip.compress(b'wrong'))
        with self.assertRaisesRegex(RuntimeError, 'Precompressed file differs'):
            deploy.validate_dist(self.dist)

    def test_route_merge_preserves_other_projects_and_is_idempotent(self):
        fragment = (REPO / 'deploy/nginx/games.conf').read_text(encoding='utf-8')
        before = '# blog\nlocation / { root /opt/ai-blog; }\n\n' + fragment + '\n# another project\nlocation /other { root /opt/other; }\n'
        self.assertEqual(deploy.merge_routes(before, fragment), before)
        merged = deploy.merge_routes('# blog\n', fragment)
        self.assertEqual(deploy.merge_routes(merged, fragment), merged)
        with self.assertRaisesRegex(RuntimeError, 'Duplicate'):
            deploy.merge_routes(fragment + '\n' + fragment, fragment)

    def test_legacy_pindou_route_upgrades_without_changing_blog(self):
        legacy=(REPO/'deploy/nginx/pindou.conf').read_text(encoding='utf-8')
        fragment=(REPO/'deploy/nginx/games.conf').read_text(encoding='utf-8')
        before='# before\n'+legacy+'\n# after\n'
        merged=deploy.merge_routes(before,fragment)
        self.assertTrue(merged.startswith('# before\n'))
        self.assertTrue(merged.endswith('\n# after\n'))
        self.assertNotIn('begin-pindou-static-game',merged)
        self.assertEqual(deploy.merge_routes(merged,fragment),merged)

    def test_rejects_stale_game_metadata_and_missing_gzip(self):
        self.manifest['games'][0]['version']='stale'
        self.save_manifest()
        with self.assertRaisesRegex(RuntimeError,'stale'):
            deploy.validate_dist(self.dist)
        self.manifest['games'][0]=next(g for g in deploy.catalogue() if g['id']=='pindou')
        self.save_manifest()
        (self.dist/'games/pindou/index.html.gz').unlink()
        with self.assertRaisesRegex(RuntimeError,'Precompressed'):
            deploy.validate_dist(self.dist)

    def test_reads_only_explicit_local_credentials_not_sibling_config(self):
        file = self.root / 'local.ini'
        file.write_text('[github]\ntoken=TOKEN_FIXTURE\n', encoding='utf-8')
        with patch.dict(os.environ, {'GAMES_CREDENTIALS_FILE': str(file)}):
            self.assertEqual(config.read_credentials()['github']['token'], 'TOKEN_FIXTURE')
        with patch.dict(os.environ, {'GAMES_CREDENTIALS_FILE': str(self.root / 'missing.ini')}):
            with self.assertRaisesRegex(RuntimeError, 'Missing credentials'):
                config.read_credentials()


if __name__ == '__main__':
    unittest.main()
