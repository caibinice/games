"""Read-only APK transport, manifest and ARM64 page-alignment inventory."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile


def axml_nodes(raw,with_offsets=False):
    strings=[];nodes=[];offset=8
    def length8(pos):
        n=raw[pos];return (((n&127)<<8)|raw[pos+1],pos+2) if n&128 else (n,pos+1)
    def length16(pos):
        n=struct.unpack_from('<H',raw,pos)[0]
        return (((n&32767)<<16)|struct.unpack_from('<H',raw,pos+2)[0],pos+4) if n&32768 else (n,pos+2)
    while offset+8<=len(raw):
        kind,header,size=struct.unpack_from('<HHI',raw,offset)
        if size<header or size<8 or offset+size>len(raw):raise ValueError('Invalid Android XML chunk')
        if kind==1:
            count,styles,flags,start,_=struct.unpack_from('<5I',raw,offset+8)
            if count>100000:raise ValueError('Android XML string budget')
            for i in range(count):
                pos=offset+start+struct.unpack_from('<I',raw,offset+header+i*4)[0]
                if flags&256:
                    _,pos=length8(pos);n,pos=length8(pos);text=raw[pos:pos+n].decode('utf8')
                else:
                    n,pos=length16(pos);text=raw[pos:pos+n*2].decode('utf-16le')
                strings.append(text)
        elif kind==0x102:
            _,name,attr_start,attr_size,count=struct.unpack_from('<IIHHH',raw,offset+16)
            attrs={};positions={}
            for i in range(count):
                pos=offset+16+attr_start+i*attr_size
                _,key,raw_id,_,_,typ,data=struct.unpack_from('<IIIHBBI',raw,pos)
                value=strings[raw_id] if raw_id!=0xffffffff else strings[data] if typ==3 else bool(data) if typ==18 else data
                attrs[strings[key]]=value
                positions[strings[key]]=pos
            node={'tag':strings[name],'attributes':attrs}
            if with_offsets:node['attributeOffsets']=positions
            nodes.append(node)
        offset+=size
    return nodes


def elf_load_alignment(raw):
    if raw[:4]!=b'\x7fELF' or raw[5]!=1 or raw[4] not in (1,2):raise ValueError('Expected little-endian ELF')
    if raw[4]==2:
        ph=struct.unpack_from('<Q',raw,32)[0];entry,count=struct.unpack_from('<HH',raw,54);fmt,align='<Q',48
    else:
        ph=struct.unpack_from('<I',raw,28)[0];entry,count=struct.unpack_from('<HH',raw,42);fmt,align='<I',28
    return [struct.unpack_from(fmt,raw,ph+i*entry+align)[0] for i in range(count) if struct.unpack_from('<I',raw,ph+i*entry)[0]==1]


def audit(path):
    with zipfile.ZipFile(path) as z:
        nodes=axml_nodes(z.read('AndroidManifest.xml'))
        manifest=next(n['attributes'] for n in nodes if n['tag']=='manifest')
        sdk=next(n['attributes'] for n in nodes if n['tag']=='uses-sdk')
        app=next(n['attributes'] for n in nodes if n['tag']=='application')
        libs={};mismatches=[]
        for name in z.namelist():
            if name.startswith('lib/arm64-v8a/') and name.endswith('.so'):
                raw=z.read(name);libs[name]=elf_load_alignment(raw)
                if raw[4]!=2 or struct.unpack_from('<H',raw,18)[0]!=183:mismatches.append(name)
        assets={}
        for name in ['assets/Config.bytes','assets/Config_dodsdk.bytes','assets/urlConfig.json','assets/SdkCfg.bytes']:
            obj=json.loads(z.read(name).decode('utf-8-sig'))
            assets[name]={k:v for k,v in obj.items() if k in ['channel','version','verurl','PkgName'] or k.endswith('Url')}
    return {'apk':str(path.resolve()),'bytes':path.stat().st_size,'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest(),
            'package':manifest.get('package'),'versionName':manifest.get('versionName'),'sdk':sdk,
            'application':{k:app.get(k) for k in ['name','label','extractNativeLibs','usesCleartextTraffic','debuggable']},
            'components':[n for n in nodes if n['tag'] in ['activity','provider','service','receiver']],
            'nativeLoadAlignment':libs,'arm64DirectoryAbiMismatches':mismatches,'requires16kbCompatibilityMode':any(v<16384 for a in libs.values() for v in a),
            'config':assets}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('apk',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    result=audit(a.apk);a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k in ['package','versionName','sdk','requires16kbCompatibilityMode','bytes']},ensure_ascii=False))
