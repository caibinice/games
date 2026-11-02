"""Create an unsigned, separately installable APK copy targeting a self-hosted API.

The pinned original remains unchanged. Signing and device acceptance are separate
steps; a rewritten ZIP alone is never reported as an installable working APK.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
from urllib.parse import urlsplit
import zipfile
import uuid
import UnityPy
from audit_apk import axml_nodes
from clean_reference_dex import clean as clean_reference_dex
from native_phone_fixes import patch_native
from native_visual_fixes import patch_dependencies,patch_missing_models,patch_skin_sprite_catalog,patch_skin_slot_sprite_names,patch_missing_skin_levels,patch_invalid_optional_model_params

APK_SHA='7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6'
PLATFORM='assets/ab/assets_resources_config_platforminfo.bytes.ab'

def metadata_cache_key(metadata):
    return str(uuid.UUID(bytes=hashlib.sha256(metadata).digest()[:16])).encode()


def privacy_config(base):
    content='请阅读《用户协议》和《隐私政策》。这是个人测试版本，使用自建角色游玩，游戏进度保存在自建服务器。无需手机号、身份证或支付信息。此版本不提供充值、短信注册或第三方账号绑定。'
    # PrivacyImpl.startDialog uses indexOf on both exact strings for clickable spans.
    if any(term not in content for term in ['《用户协议》','《隐私政策》']):raise ValueError('Native privacy span labels missing')
    return {'PrivacyTitle':'个人自建服说明','PrivacyContent':content,'Privacyrl':base+'/help/notice/privacy.html','serviceUrl':base+'/help/notice/service.html'}


def api_base(value):
    u=urlsplit(value)
    if u.username or u.password or u.query or u.fragment or not u.hostname:
        raise ValueError('API base must not contain credentials/query/fragment')
    if u.scheme!='https' and not (u.scheme=='http' and u.hostname in ('127.0.0.1','localhost')):
        raise ValueError('Use HTTPS, except for explicit loopback emulator tests')
    if '..' in u.path.split('/') or not re.fullmatch(r'[A-Za-z0-9/_-]*',u.path):
        raise ValueError('Invalid API path prefix')
    return value.rstrip('/')


def rewrite_urls(value,base):
    if isinstance(value,str) and value.startswith(('http://','https://')):
        u=urlsplit(value);path=u.path
        if path.startswith('/t5game/'):path=path[len('/t5game'):]
        return base+path
    if isinstance(value,dict):return {k:rewrite_urls(v,base) for k,v in value.items()}
    if isinstance(value,list):return [rewrite_urls(v,base) for v in value]
    return value


def fixed_replace(raw,old,new):
    if len(old)!=len(new):raise ValueError('Fixed-width replacement size differs')
    return raw.replace(old,new)


def patch_platform(raw,base):
    env=UnityPy.load(raw);asset=next(o for o in env.objects if o.type.name=='TextAsset' and o.peek_name()=='PlatformInfo')
    item=asset.parse_as_object();original=json.loads(item.m_Script)
    updated=rewrite_urls(original,base)
    if updated['EncKey']!=original['EncKey']:raise ValueError('Native protocol key must be preserved')
    item.m_Script=json.dumps(updated,ensure_ascii=False,separators=(',',':'));item.save();out=env.file.save(packer='lz4')
    check=UnityPy.load(out);loaded=json.loads(next(o for o in check.objects if o.type.name=='TextAsset' and o.peek_name()=='PlatformInfo').parse_as_object().m_Script)
    if loaded!=updated:raise ValueError('Unity PlatformInfo roundtrip failed')
    return out


def prepare(source,out,base,package='com.cbai.xnmkp',websocket=False,account_login=False,phone_fixes=False):
    base=api_base(base);source,out=source.resolve(),out.resolve()
    if source==out or out.exists():raise ValueError('Use a new APK output; originals are never overwritten')
    with source.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
    if digest!=APK_SHA:raise ValueError('Unreviewed source APK')
    if not re.fullmatch(r'[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+',package):raise ValueError('Invalid Android package ID')
    with zipfile.ZipFile(source) as z:
        original_manifest=z.read('AndroidManifest.xml');nodes=axml_nodes(original_manifest)
        old=next(n['attributes']['package'] for n in nodes if n['tag']=='manifest')
        if len(package.encode())!=len(old.encode()):raise ValueError('This reviewed build uses equal-width package rewriting')
        if any(str(n['attributes'].get('name','')).startswith(old+'.') for n in nodes if n['tag'] in ['application','activity','service','provider','receiver']):
            raise ValueError('Package-specific component class requires a reviewed manifest rebuild')
        changes={}
        changes['classes.dex'],dex_changes=clean_reference_dex(z.read('classes.dex'),account_login)
        native_changes=[]
        if phone_fixes:
            print('Applying reviewed native and visual fixes',flush=True)
            changes['lib/arm64-v8a/libil2cpp.so'],native_changes=patch_native(z.read('lib/arm64-v8a/libil2cpp.so'))
            repaired,aliases=patch_dependencies(z);changes.update(repaired)
            repaired,skin_catalog=patch_skin_sprite_catalog(z);changes.update(repaired)
            native_changes.append('Skin UI sprite catalog repaired: '+str(skin_catalog))
            repaired,fallbacks=patch_missing_models(z);changes.update(repaired)
            native_changes.append({'dependencyAliases':aliases,'missingModelFallbacks':fallbacks})
            repaired,slots=patch_skin_slot_sprite_names(z);changes.update(repaired);native_changes.append({'skinSlotSpriteAliases':slots})
            # Unity caches extracted IL2CPP metadata by this application GUID.
            # Changing metadata without its cache key leaves old literals active
            # after an in-place APK update. Account/SDK preferences stay intact.
            meta=changes['assets/bin/Data/Managed/Metadata/global-metadata.dat']
            changes['assets/bin/Data/unity_app_guid']=metadata_cache_key(meta)
            native_changes.append('Unity metadata cache key updated for in-place APK upgrades')
            repaired,params=patch_invalid_optional_model_params(z);changes.update(repaired);native_changes.append({'optionalModelParams':params})
            print('Repairing missing appearance level tables',flush=True)
            repaired,levels=patch_missing_skin_levels(z);changes.update(repaired);native_changes.append({'skinLevelFallbacks':levels})
        if websocket:
            name='lib/arm64-v8a/libil2cpp.so';raw=bytearray(changes.get(name,z.read(name)));offset=0x1155db4
            if raw[offset:offset+4]!=bytes.fromhex('68010034'):raise ValueError('Unexpected native socket factory branch')
            raw[offset:offset+4]=bytes.fromhex('1f2003d5');changes[name]=bytes(raw)
        for name in z.namelist():
            if re.fullmatch(r'assets/Config(?:_[A-Za-z0-9]+)?\.bytes',name):
                text=z.read(name).decode('utf-8-sig')
                if name=='assets/Config_global.bytes':text=re.sub(r',\s*}\s*$', '}',text)
                d=json.loads(text);d['verurl']=base+'/ver/new_ver.php';d['disable_bugly']=True;changes[name]=json.dumps(d,separators=(',',':')).encode()
        cfg=json.loads(z.read('assets/urlConfig.json'));changes['assets/urlConfig.json']=json.dumps(rewrite_urls(cfg,base),separators=(',',':')).encode()
        sdk=json.loads(z.read('assets/SdkCfg.bytes'));sdk['PkgName']=package;changes['assets/SdkCfg.bytes']=json.dumps(sdk,separators=(',',':')).encode()
        changes['assets/PrivacyConfig.json']=json.dumps(privacy_config(base),ensure_ascii=False,separators=(',',':')).encode()
        changes[PLATFORM]=patch_platform(z.read(PLATFORM),base)
        for name in ['AndroidManifest.xml','resources.arsc']:
            raw=z.read(name)
            for encoding in ['utf8','utf-16le']:raw=fixed_replace(raw,old.encode(encoding),package.encode(encoding))
            if name=='resources.arsc':
                for title in ['向牛马开炮','向僵尸开炮']:
                    for encoding in ['utf8','utf-16le']:raw=fixed_replace(raw,title.encode(encoding),'僵尸自建服'.encode(encoding))
                for old_label,new_label in [('注册账号','用户协议'),('GM后台','隐私  '),('密码登录','账号登录' if account_login else '游客登录')]+([('请输入11位手机号','请输入账号名称  '),('请输入手机号','请输入账号名'),('手机号','账号名')] if account_login else []):
                    for encoding in ['utf8','utf-16le']:raw=fixed_replace(raw,old_label.encode(encoding),new_label.encode(encoding))
            changes[name]=raw
        if account_login:
            for name in ['res/layout/dod_mobile_login_verify_password_layout.xml','res/layout-land/dod_mobile_login_verify_password_layout.xml']:
                raw=bytearray(z.read(name));node=next(n for n in axml_nodes(raw,True) if n['tag']=='EditText' and n['attributes'].get('id')==2131165370)
                struct.pack_into('<I',raw,node['attributeOffsets']['inputType']+16,1);changes[name]=bytes(raw)
        if phone_fixes:
            raw=bytearray(changes['AndroidManifest.xml']);node=next(n for n in axml_nodes(raw,True) if n['tag']=='manifest')
            struct.pack_into('<I',raw,node['attributeOffsets']['versionCode']+16,16);changes['AndroidManifest.xml']=bytes(raw)
        if next(n['attributes']['package'] for n in axml_nodes(changes['AndroidManifest.xml']) if n['tag']=='manifest')!=package:
            raise ValueError('Manifest package verification failed')
        out.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(out,'w',allowZip64=True) as dest:
            for i,info in enumerate(z.infolist()):
                if info.filename.upper().startswith('META-INF/') and (info.filename.upper().endswith(('.RSA','.DSA','.EC','.SF')) or info.filename.upper()=='META-INF/MANIFEST.MF'):continue
                dest.writestr(info,changes.get(info.filename) if info.filename in changes else z.read(info.filename))
                if i%1000==0:print('Repacked',i,'/',len(z.infolist()),flush=True)
    with out.open('rb') as f:output_hash=hashlib.file_digest(f,'sha256').hexdigest()
    u=urlsplit(base)
    proof={'source_sha256':digest,'unsigned_apk_sha256':output_hash,'package':package,'label':'僵尸自建服','apiOrigin':u.scheme+'://'+u.netloc,
           'apiPrefixSha256':hashlib.sha256(u.path.encode()).hexdigest(),'modifiedEntries':{k:hashlib.sha256(v).hexdigest() for k,v in changes.items()},
           'nativeKeyPreserved':True,'nativeWebSocketEnabled':websocket,'accountLogin':account_login,'nativeChanges':native_changes,'dexChanges':dex_changes,'signed':False,'deviceVerified':False,'backendComplete':False}
    out.with_suffix('.build.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding='utf-8');print('Unsigned APK prepared; signing and device tests remain',flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('--out',type=Path,required=True)
    g=p.add_mutually_exclusive_group(required=True);g.add_argument('--api-base');g.add_argument('--api-base-file',type=Path)
    p.add_argument('--package',default='com.cbai.xnmkp');p.add_argument('--websocket',action='store_true');p.add_argument('--account-login',action='store_true');p.add_argument('--phone-fixes',action='store_true');a=p.parse_args();base=a.api_base_file.read_text(encoding='utf-8').strip() if a.api_base_file else a.api_base
    prepare(a.source,a.out,base,a.package,a.websocket,a.account_login,a.phone_fixes)
