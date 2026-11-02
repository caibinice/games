import json
import hashlib
from pathlib import Path
import struct
import unittest
import zipfile
import zlib
from clean_reference_dex import clean,APP,ACTIVITY,ANDROID,SHELL
from dex_review import Dex
from prepare_apk import api_base,privacy_config,APK_SHA,metadata_cache_key
from package_backend import dependency_files
from native_phone_fixes import patch_native,branch

APK=Path(r'E:\Documents\AI\codex\tmp\zombie-apk-20261024\downloads\com.ltzy.xnmkp.v1.10.apk')


class PreparationTests(unittest.TestCase):
    def test_privacy_clickable_spans_and_local_links(self):
        config=privacy_config('https://example.test/private')
        for term in ['《用户协议》','《隐私政策》']:self.assertGreaterEqual(config['PrivacyContent'].find(term),0)
        self.assertTrue(config['Privacyrl'].startswith('https://example.test/private/'))
        self.assertNotIn('ht2.cn',str(config))
    def test_only_https_or_explicit_loopback(self):
        self.assertEqual(api_base('https://example.test/x/'),'https://example.test/x')
        for url in ['http://example.test','https://user:pass@example.test','https://example.test/../x','file:///x','https://example.test/x?token=y']:
            with self.assertRaises(ValueError):api_base(url)
    def test_metadata_cache_key_is_stable_and_changes_with_content(self):
        self.assertEqual(metadata_cache_key(b'new metadata'),metadata_cache_key(b'new metadata'))
        self.assertNotEqual(metadata_cache_key(b'old metadata'),metadata_cache_key(b'new metadata'))
        self.assertEqual(len(metadata_cache_key(b'new metadata')),36)
    def test_backend_bundle_has_code_only(self):
        files=dependency_files();self.assertTrue(files)
        self.assertTrue(all(f.suffix=='.mjs' or 'vendor/ws/' in f.as_posix() for f in files))
        self.assertFalse(any('android-signing' in str(f) or 'credentials' in str(f) for f in files))


@unittest.skipUnless(APK.is_file(),'Pinned local reference not present')
class ReferenceDexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with zipfile.ZipFile(APK) as z:cls.original=z.read('classes.dex')
        cls.raw,cls.proof=clean(cls.original);cls.dex=Dex(cls.raw)
    def test_header_integrity(self):
        self.assertEqual(self.raw[12:32],hashlib.sha1(self.raw[32:]).digest())
        self.assertEqual(struct.unpack_from('<I',self.raw,8)[0],zlib.adler32(self.raw[12:])&0xffffffff)
        self.assertEqual(len(self.raw),len(self.original))
    def test_parent_calls_restore_android_application(self):
        calls=[x.get('invoke','') for m in self.dex.methods(APP) for x in self.dex.instructions(m['code'])]
        self.assertIn(ANDROID+'-><init>',calls);self.assertIn(ANDROID+'->onCreate',calls)
        self.assertFalse(any(x.startswith(SHELL) for x in calls))
    def test_primary_button_uses_native_guest_login(self):
        c='Lcom/dodjoy/dodsdk/view/fragment/DodSYLoginFragment;'
        ins=[x for m in self.dex.methods(c) if m['name']==c+'->AccountLogin' for x in self.dex.instructions(m['code'])]
        self.assertTrue(any(x.get('invoke')=='Lcom/dodjoy/dodsdk/api/DodUserManager;->guestLogin' for x in ins))
        self.assertFalse(any(x.get('string')=='dod_event_sdk_account_login_click' for x in ins))
    def test_no_promotion_entry_and_guest_option_enabled(self):
        ins=[x for m in self.dex.methods(ACTIVITY) if m['name']==ACTIVITY+'->onCreate' for x in self.dex.instructions(m['code'])]
        self.assertFalse(any(x.get('invoke')==ACTIVITY+'->ydl5gz' for x in ins))
        options={v['field'].split('->')[1]:v['value'] for v in self.dex.static_values('Lcom/dodjoy/dodsdk/api/DodCoreConfig;')}
        self.assertEqual(options['LoginTypeGuest'],1);self.assertEqual(options['LoginTypeMobile'],0)
    def test_account_mode_has_password_form_without_guest_shortcut(self):
        raw,proof=clean(self.original,account_login=True);dex=Dex(raw)
        c='Lcom/dodjoy/dodsdk/view/fragment/DodSYLoginFragment;'
        calls=[x.get('invoke') for m in dex.methods(c) if m['name'].endswith('->AccountLogin') for x in dex.instructions(m['code'])]
        self.assertIn('Lcom/dodjoy/dodsdk/view/fragment/DodMobileVerifyPwdFragment;->newInstanec',calls)
        self.assertNotIn('Lcom/dodjoy/dodsdk/api/DodUserManager;->guestLogin',calls)
        options={v['field'].split('->')[1]:v['value'] for v in dex.static_values('Lcom/dodjoy/dodsdk/api/DodCoreConfig;')}
        self.assertEqual(options['LoginTypeGuest'],0);self.assertEqual(options['LoginTypeMobile'],1)
        self.assertEqual(raw[12:32],hashlib.sha1(raw[32:]).digest())
    def test_reviewed_native_refresh_patch(self):
        with zipfile.ZipFile(APK) as z:raw=z.read('lib/arm64-v8a/libil2cpp.so')
        result,proof=patch_native(raw);self.assertEqual(len(raw),len(result));self.assertEqual(len(proof),16)
        for address in [0x14A0000,0x14A0048]:
            instruction=int.from_bytes(result[address:address+4],'little')
            self.assertEqual(instruction & 0xff00001f,0xb4000000)
            self.assertEqual(address+((instruction>>5)&0x7ffff)*4,0x14A008C)
        self.assertEqual(result[0x15ED664:0x15ED668],branch(0x15ED664,0x15ED610))
        for address,expected in [(0x185D260,'01108052'),(0x185D2D8,'3f0302f1'),(0x185D35C,'1f010271'),(0x185D3B4,'1f010271'),(0x185D484,'1f010271')]:
            self.assertEqual(result[address:address+4],bytes.fromhex(expected))
        self.assertEqual(result[0x16A683C:0x16A6848],bytes.fromhex('81008052e2031faa')+branch(0x16A6844,0x16A6F5C))
        self.assertEqual(result[0x173676C:0x1736774],bytes.fromhex('20008052c0035fd6'))
        self.assertEqual(result[0x13FE0D8:0x13FE0E0],bytes.fromhex('20008052c0035fd6'))
        for start in [0x162CBD8,0x162AC1C,0x165CA28]:
            self.assertEqual(result[start:start+8],bytes.fromhex('20008052c0035fd6'))
        self.assertEqual(result[0x137BE04:0x137BE0C],bytes.fromhex('20008052c0035fd6'))
        self.assertEqual(result[0x137BE34:0x137BE3C],bytes.fromhex('20008052c0035fd6'))
        self.assertEqual(result[0x158B9A4:0x158B9A8],bytes.fromhex('00102f1e'))
        self.assertEqual(result[0x16B6040:0x16B6044],bytes.fromhex('1f2003d5'))
        self.assertEqual(result[0x13C0A6C:0x13C0A84],bytes.fromhex('1fa000391fa40039e2031f2ae3031faae4031faa')+branch(0x13C0A80,0x13C263C))
    def test_visual_dependency_aliases_match_embedded_cab_identifiers(self):
        from native_visual_fixes import patch_dependencies
        with zipfile.ZipFile(APK) as z:changes,aliases=patch_dependencies(z)
        self.assertGreaterEqual(len(aliases),50)
        deps=json.loads(changes['assets/ab/deps.bytes'])
        self.assertIn('assets_uiraw_t5guild',deps['assets_resources_config_spriteconfig_uiraw_t5guild.prefab'])
        self.assertIn('assets_uiraw_t5head',deps['assets_resources_config_spriteconfig_uiraw_t5head.prefab'])
        self.assertIn('assets_uiraw_activity_society',deps['assets_resources_config_spriteconfig_uiraw_activity_society.prefab'])
    def test_missing_ultraman_models_have_roundtripped_existing_model_fallbacks(self):
        from native_visual_fixes import patch_missing_models,MODEL_BUNDLE
        with zipfile.ZipFile(APK) as z:changes,models=patch_missing_models(z)
        self.assertEqual(len(models),9)
        self.assertEqual(models[11046],11003)
        self.assertEqual(models[21048],21003)
        self.assertEqual(models[2048],2003)
        self.assertGreater(len(changes[MODEL_BUNDLE]),1000)
    def test_skin_sprite_catalog_has_no_stale_pointers(self):
        from native_visual_fixes import patch_skin_sprite_catalog
        with zipfile.ZipFile(APK) as z:changes,proof=patch_skin_sprite_catalog(z)
        self.assertEqual(proof,{'removedStale':2,'validSprites':15})
        self.assertTrue(changes)
    def test_skin_slot_indicators_reuse_existing_native_sprites(self):
        from native_visual_fixes import patch_skin_slot_sprite_names
        with zipfile.ZipFile(APK) as z:changes,proof=patch_skin_slot_sprite_names(z)
        self.assertEqual(proof,{'zmzg_zb_zhuneng01':'zmzg_com_icon_star1','zmzg_zb_zhuneng02':'zmzg_com_icon_star3'})
        self.assertEqual(len(next(iter(changes.values()))),len(zipfile.ZipFile(APK).read(next(iter(changes)))))
    def test_missing_skin_levels_are_added_to_both_ui_and_engine(self):
        from native_visual_fixes import patch_missing_skin_levels
        with zipfile.ZipFile(APK) as z:changes,proof=patch_missing_skin_levels(z)
        self.assertEqual(len(changes),2)
        for table in ['ResDef','BattleCore']:self.assertEqual(proof[table]['added'],50)
    def test_optional_model_parameter_schema_mismatch_uses_native_defaults(self):
        from native_visual_fixes import patch_invalid_optional_model_params
        with zipfile.ZipFile(APK) as z:changes,proof=patch_invalid_optional_model_params(z)
        self.assertEqual(proof,{'invalidRowsRemoved':7,'optionalDefaultOrientation':True})
        self.assertEqual(len(changes),1)


if __name__=='__main__':unittest.main()
