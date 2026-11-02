import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('apk_intake', Path(__file__).with_name('apk_intake.py'))
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)

class IntakeTests(unittest.TestCase):
    def test_rejects_traversal_windows_devices_and_ambiguous_names(self):
        for name in ['../outside', '/root', 'C:/outside', 'assets\\bad', 'assets/NUL.txt', 'assets/end.']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                module.safe_target(Path('E:/Documents/AI/codex/tmp/fixture'), name)
    def test_rejects_wrong_reference_digest_before_creating_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); apk=root/'fixture.apk'
            with zipfile.ZipFile(apk,'w') as z:z.writestr('assets/ab/sample.ab',b'fixture')
            with self.assertRaises(ValueError):module.intake(apk,root/'out','0'*32)
            self.assertFalse((root/'out').exists())
    def test_preserves_original_and_extracts_only_analysis_inputs(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); apk=root/'fixture.apk'
            with zipfile.ZipFile(apk,'w') as z:
                z.writestr('assets/ab/sample.ab',b'fixture');z.writestr('classes.dex',b'code')
            before=apk.read_bytes();r=module.intake(apk,root/'out')
            self.assertEqual(apk.read_bytes(),before);self.assertEqual(r['extracted_count'],1)
            self.assertEqual((root/'out/unpacked/assets/ab/sample.ab').read_bytes(),b'fixture')
            self.assertFalse((root/'out/unpacked/classes.dex').exists())
            with self.assertRaises(ValueError):module.intake(apk,root/'out')

if __name__ == '__main__':unittest.main()
