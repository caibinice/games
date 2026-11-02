"""Remove reviewed third-party startup hooks from the pinned reference DEX."""
import hashlib
import struct
import zlib
from dex_review import Dex

APP='Lcom/dmlt/thirdPlatform/GDTApplication;'
SHELL='Lcom/ltzy/xnmkp/ePUTNnzqAoAPwK;'
ANDROID='Landroid/app/Application;'
ACTIVITY='Lcom/dmlt/unityplayer/DodUnityPlayerActivity;'


def clean(raw,account_login=False):
    dex=Dex(raw);out=bytearray(raw);changes=[]
    app_type=next(i for i in range(dex.nt) if dex.type(i)==ANDROID)
    found=False
    for i in range(dex.nc):
        off=dex.oc+32*i
        if dex.type(dex.u32(off))==APP:
            if dex.type(dex.u32(off+8))!=SHELL:raise ValueError('Unexpected Application superclass')
            struct.pack_into('<I',out,off+8,app_type);found=True;changes.append('Application superclass -> android.app.Application')
    if not found:raise ValueError('Reference Application missing')
    for name in ['<init>','onCreate']:
        method=next(m for m in dex.methods(APP) if m['name']==APP+'->'+name)
        first=next(dex.instructions(method['code']))
        if first.get('invoke')!=SHELL+'->'+name:raise ValueError('Unexpected Application entry')
        target=next(i for i in range(dex.nm) if dex.method(i)==ANDROID+'->'+name)
        struct.pack_into('<H',out,first['offset']+2,target);changes.append('Application '+name+' parent call restored')
    count=0
    for method in dex.methods(ACTIVITY):
        if method['name']!=ACTIVITY+'->onCreate':continue
        for insn in dex.instructions(method['code']):
            if insn.get('invoke')==ACTIVITY+'->ydl5gz':
                if len(bytes.fromhex(insn['hex']))!=6:raise ValueError('Unexpected injected invoke width')
                out[insn['offset']:insn['offset']+6]=bytes(6);count+=1
    if count!=1:raise ValueError('Unexpected floating promotion entry count')
    changes.append('Injected Activity floating promotion entry removed')
    config='Lcom/dodjoy/dodsdk/api/DodCoreConfig;'
    expected={'LoginTypeGuest':(0,0 if account_login else 1),'LoginTypeFlash':(1,0),'LoginTypeMobile':(1,1 if account_login else 0)};patched=0
    for item in dex.static_values(config):
        name=item['field'].split('->')[1]
        if name in expected:
            before,after=expected[name]
            if item['kind']!=31 or item['value']!=before:raise ValueError('Unexpected SDK login option')
            out[item['offset']]=31|(after<<5);patched+=1
    if patched!=3:raise ValueError('Missing SDK login defaults')
    changes.append('Self-hosted login UI: account/password only' if account_login else 'Self-hosted login UI: guest enabled, carrier/mobile entry disabled')
    login_class='Lcom/dodjoy/dodsdk/view/fragment/DodSYLoginFragment;'
    click=next(m for m in dex.methods(login_class) if m['name']==login_class+'->AccountLogin')
    instructions=list(dex.instructions(click['code']));get,move=instructions[:2]
    if get.get('invoke')!='Lcom/dodjoy/dodsdk/api/DodUserManager;->getInstance' or move['hex']!='0c00' or dex.u16(click['code']+6)!=0:raise ValueError('Unexpected native login entry')
    if not account_login:
        guest=next(i for i in range(dex.nm) if dex.method(i)=='Lcom/dodjoy/dodsdk/api/DodUserManager;->guestLogin' and dex.signature(i)=='()V')
        code=bytes.fromhex(get['hex']+move['hex'])+bytes([0x6e,0x10])+struct.pack('<H',guest)+bytes([0,0,0x0e,0])
        start=click['code']+16;length=dex.u32(click['code']+12)*2
        if length<len(code):raise ValueError('Login entry too short')
        out[start:start+length]=code+bytes(length-len(code))
        changes.append('Primary login button uses native guestLogin; no phone input')
    else:
        password_class='Lcom/dodjoy/dodsdk/view/fragment/DodMobileVerifyPwdFragment;'
        factory=next(i for i in range(dex.nm) if dex.method(i)==password_class+'->newInstanec')
        target_type=next(i for i in range(dex.nt) if dex.type(i)==password_class)
        for insn in instructions:
            if insn.get('invoke')=='Lcom/dodjoy/dodsdk/view/fragment/DodMobileLoginFragment;->newInstance':struct.pack_into('<H',out,insn['offset']+2,factory)
            if insn['opcode']==0x1c:struct.pack_into('<H',out,insn['offset']+2,target_type)
        count=0
        for method in dex.methods(password_class):
            ins=list(dex.instructions(method['code']))
            if method['name'].endswith('->onClick'):
                for i,one in enumerate(ins):
                    if one.get('invoke')=='Lcom/dodjoy/dodsdk/util/DodSdkUtils;->isPhoneNumberValid':
                        following=ins[i+1]
                        if following['hex']!='0a05':raise ValueError('Unexpected username-validation result register')
                        out[one['offset']:following['offset']+2]=bytes.fromhex('1215')+bytes(6);count+=1
            if method['name'].endswith('->init'):
                one=next(x for x in ins if x['relative']==588)
                if one.get('invoke')!='Landroid/widget/EditText;->setInputType':raise ValueError('Unexpected account keyboard setup')
                out[one['offset']:one['offset']+6]=bytes(6)
        if count!=1:raise ValueError('Unexpected account validation call count')
        changes.append('Primary button opens account/password form; names validated by self-hosted whitelist')
    # Optional external customer-service initialization is unrelated to game login.
    for method in dex.methods(APP):
        for insn in dex.instructions(method['code']):
            if insn.get('invoke')=='Lcom/dodjoy/dodsdk/DodSDKApi;->QiYuInit':
                out[insn['offset']:insn['offset']+6]=bytes(6);changes.append('Optional QiYu startup removed')
    # No relocation or generic byte scan: class and method identities above gate every edit.
    out[12:32]=hashlib.sha1(out[32:]).digest()
    struct.pack_into('<I',out,8,zlib.adler32(out[12:])&0xffffffff)
    check=Dex(bytes(out))
    for method in check.methods(APP):list(check.instructions(method['code']))
    return bytes(out),changes
