"""Repair reviewed packaging mismatches; keep available source visuals unchanged."""
import copy
import json
import re
from pathlib import Path
import struct
import sys
import UnityPy

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from decode_client_config import Reader,decode,PRIMITIVES

MODEL_BUNDLE='assets/ab/assets_resources_config_resbin_modelconfig.bytes.ab'

def patch_skin_slot_sprite_names(z):
    # These are three missing status images, not damaged Chinese characters.
    # Repoint their IL2CPP string-literal entries to existing source star sprites.
    # No string data is enlarged, and native filled/empty selection is retained.
    name='assets/bin/Data/Managed/Metadata/global-metadata.dat';raw=z.read(name);out=bytearray(raw)
    magic,version,start,size,data_start=struct.unpack_from('<5I',raw)
    if magic!=0xfab11baf or size%8:raise ValueError('Unexpected metadata string header')
    literals={}
    for at in range(start,start+size,8):
        length,offset=struct.unpack_from('<2I',raw,at);value=raw[data_start+offset:data_start+offset+length]
        literals.setdefault(value,[]).append((at,length,offset))
    proof={}
    for old,new in [('zmzg_zb_zhuneng01','zmzg_com_icon_star1'),('zmzg_zb_zhuneng02','zmzg_com_icon_star3')]:
        source=literals.get(old.encode(),[]);target=literals.get(new.encode(),[])
        if len(source)!=1 or not target:raise ValueError('Unexpected missing slot sprite literal')
        struct.pack_into('<2I',out,source[0][0],target[0][1],target[0][2]);proof[old]=new
    return {name:bytes(out)},proof

def patch_invalid_optional_model_params(z):
    # The pinned bundle contains seven unrelated effect-file records (613 bytes)
    # under a table whose actual native schema has 13-byte parameter records.
    # An empty optional table uses the engine's existing default orientation path.
    path='assets/ab/assets_resources_config_resbin_mecheffectparamconfig.bytes.ab';env=UnityPy.load(z.read(path));obj=next(o for o in env.objects if o.type.name=='TextAsset');asset=obj.parse_as_object();raw=asset.m_Script.encode('utf-8','surrogateescape')
    if len(raw)!=613 or struct.unpack_from('>I',raw,12)[0]!=7:raise ValueError('Unexpected malformed model parameter bundle')
    data=bytearray(raw[:20]);struct.pack_into('>I',data,4,20);struct.pack_into('>I',data,12,0)
    asset.m_Script=bytes(data).decode('utf-8','surrogateescape');asset.save()
    return {path:env.file.save(packer='lz4')},{'invalidRowsRemoved':7,'optionalDefaultOrientation':True}

def patch_missing_skin_levels(z):
    text=(Path(__file__).resolve().parents[1]/'local-protocol/skin-catalog.mjs').read_text('utf-8')
    mapping=json.loads(re.search(r'export const SKIN_LEVEL_FALLBACKS=(\{[^;]+\});',text)[1])
    schemas={
      'ResDef.ResAttrImpactData':{'fields':[['DataType','short'],['AddType','byte'],['Value','float']]},
      'BattleCore.ResAttrImpactData':{'fields':[['DataType','short'],['AddType','byte'],['Value','FP']]},
      'Cost':{'fields':[['ItemID','int'],['ItemCnt','int']]},
      'Rand':{'fields':[['Build1','int'],['Build2','int']]}}
    schemas['ResDef.SkinLevelConfig']={'header_bytes':20,'fields':[[k,'int'] for k in ['SkinID','SkinLevel','Name','Desc','EntryID','EntryID2','SkillName']]+[['SkillIcon','string'],['CostItem','Cost',2],['ImpactData','ResDef.ResAttrImpactData',3],['RandBuildCount','int'],['RandBuild','Rand',3]]}
    schemas['BattleCore.SkinLevelConfig']={'header_bytes':20,'fields':[[k,'int'] for k in ['SkinID','SkinLevel','EntryID','EntryID2']]+[['ImpactData','BattleCore.ResAttrImpactData',3],['RandBuildCount','int'],['RandBuild','Rand',3]]}
    changes={};proof={}
    for ns,prefix in [('ResDef',''),('BattleCore','fp_')]:
        path=f'assets/ab/assets_resources_config_resbin_{prefix}skinlevelconfig.bytes.ab';env=UnityPy.load(z.read(path));obj=next(o for o in env.objects if o.type.name=='TextAsset');asset=obj.parse_as_object();raw=asset.m_Script.encode('utf-8','surrogateescape');typ=ns+'.SkinLevelConfig';rows=decode(raw,typ,schemas)['rows'];original=copy.deepcopy(rows)
        for target,template in mapping.items():
            if any(r['SkinID']==int(target) for r in rows):raise ValueError('Missing skin fallback no longer matches source')
            selected=[r for r in original if r['SkinID']==template]
            if len(selected)!=5:raise ValueError('Unexpected fallback skin levels')
            for r in selected:
                r=copy.deepcopy(r);r['SkinID']=int(target)
                for c in r.get('CostItem',[]):
                    if c['ItemID']==template:c['ItemID']=int(target)
                rows.append(r)
        data=bytearray(raw[:20]+b''.join(encode_value(typ,r,schemas) for r in rows));struct.pack_into('>I',data,4,len(data));struct.pack_into('>I',data,12,len(rows))
        if decode(bytes(data),typ,schemas)['rows']!=rows:raise ValueError('Skin level roundtrip mismatch')
        asset.m_Script=bytes(data).decode('utf-8','surrogateescape');asset.save();changes[path]=env.file.save(packer='lz4');proof[ns]={'added':len(rows)-len(original),'fallbacks':mapping}
    return changes,proof

def patch_skin_sprite_catalog(z):
    # The source config contains two stale Sprite IDs and omits six real ones.
    # CacheSprites aborts at stale index 9, leaving skill labels as white blocks.
    name='assets/ab/assets_resources_config_spriteconfig_uiraw_skin.prefab.ab'
    atlas=UnityPy.load(z.read('assets/ab/assets_uiraw_skin.ab'))
    ids=[o.path_id for o in atlas.objects if o.type.name=='Sprite']
    env=UnityPy.load(z.read(name));obj=next(o for o in env.objects if o.type.name=='MonoBehaviour' and 'Sprites' in o.read_typetree())
    tree=obj.read_typetree();old=tree['Sprites'];valid=set(ids)
    missing=[p['m_PathID'] for p in old if p['m_PathID'] not in valid]
    if len(ids)!=15 or len(missing)!=2:raise ValueError('Unexpected skin sprite catalog')
    file_id=old[0]['m_FileID']
    tree['Sprites']=[p for p in old if p['m_PathID'] in valid]
    present={p['m_PathID'] for p in tree['Sprites']}
    tree['Sprites'].extend({'m_FileID':file_id,'m_PathID':pid} for pid in ids if pid not in present)
    obj.save_typetree(tree);out=env.file.save(packer='lz4')
    check=UnityPy.load(out);result=next(o.read_typetree()['Sprites'] for o in check.objects if o.type.name=='MonoBehaviour' and 'Sprites' in o.read_typetree())
    if {p['m_PathID'] for p in result}!=valid:raise ValueError('Skin sprite roundtrip mismatch')
    return {name:out},{'removedStale':len(missing),'validSprites':len(ids)}

def patch_dependencies(z):
    name='assets/ab/deps.bytes'
    deps=json.loads(z.read(name))
    names={p.rsplit('/',1)[-1][:-3] for p in z.namelist() if p.startswith('assets/ab/') and p.endswith('.ab')}
    aliases={};edges={}
    for old in {v for values in deps.values() for v in values if v not in names}:
        if not old.startswith('assets_uiraw_'):continue
        references=[key for key,values in deps.items() if old in values and key in names]
        if not references:continue
        candidates=[old.replace('assets_uiraw_','assets_uiraw_t5',1)]
        prefix='assets_resources_config_spriteconfig_'
        candidates.extend('assets_'+key[len(prefix):-len('.prefab')] for key in references if key.startswith(prefix) and key.endswith('.prefab'))
        # A filename similarity alone is insufficient. Match original external
        # CAB IDs before changing a dependency edge.
        for target in dict.fromkeys(candidates):
            if target not in names:continue
            replacement=UnityPy.load(z.read('assets/ab/'+target+'.ab'))
            cabs={f.name for f in replacement.assets}
            for key in references:
                env=UnityPy.load(z.read('assets/ab/'+key+'.ab'))
                external={e.path.rsplit('/',1)[-1] for f in env.assets for e in f.externals}
                if external.intersection(cabs):edges[(key,old)]=target;aliases[old]=target
    if len(aliases)<20:raise ValueError('Unexpected source dependency inventory')
    updated={key:[edges.get((key,v),v) for v in values] for key,values in deps.items()}
    return {name:json.dumps(updated,separators=(',',':')).encode()},aliases

def encode_value(kind,value,schemas):
    if kind in PRIMITIVES:
        if kind=='FP':value=round(value*4294967296)
        return struct.pack('>'+PRIMITIVES[kind],value)
    if kind=='string':
        b=value.encode('utf8')+b'\0';return struct.pack('>I',len(b))+b
    pieces=[]
    for name,typ,*count in schemas[kind]['fields']:
        values=value[name] if count else [value[name]]
        if count and len(values)!=count[0]:raise ValueError('Invalid visual table array')
        pieces.extend(encode_value(typ,v,schemas) for v in values)
    return b''.join(pieces)

def patch_missing_models(z):
    schemas=json.loads((Path(__file__).resolve().parents[1]/'client-schemas.json').read_text('utf8'))['schemas']
    env=UnityPy.load(z.read(MODEL_BUNDLE));asset=next(o for o in env.objects if o.type.name=='TextAsset' and o.peek_name()=='ModelConfig');item=asset.parse_as_object()
    raw=item.m_Script.encode('utf8','surrogateescape');result=decode(raw,'ResDef.ModelConfig',schemas);rows=result['rows'];by_id={r['ModelID']:r for r in rows}
    names=set(z.namelist());fallbacks={}
    for mid in [11046,21046,11047,21047,11048,21048,2046,2047,2048]:
        row=by_id[mid];path='assets/ab/assets_resources_'+row['UIShowModelFile'].lower().replace('/','_')+'.prefab.ab'
        if path in names:continue
        source=by_id[2003 if mid<10000 else 21003 if mid>=20000 else 11003]
        for field in ['ModelFile','UIShowModelFile','ModelScale','UIScale','SweepScale','GunModelBaseParam','UIGunModelBaseParam','SelfEffectID']:
            row[field]=copy.deepcopy(source[field])
        fallbacks[mid]=source['ModelID']
    if not fallbacks:raise ValueError('Unexpected source model inventory')
    body=b''.join(encode_value('ResDef.ModelConfig',row,schemas) for row in rows)
    data=bytearray(raw[:20]+body);struct.pack_into('>I',data,4,len(data))
    if decode(bytes(data),'ResDef.ModelConfig',schemas)['rows']!=rows:raise ValueError('Visual table roundtrip mismatch')
    item.m_Script=bytes(data).decode('utf8','surrogateescape');item.save();out=env.file.save(packer='lz4')
    check=UnityPy.load(out);again=next(o for o in check.objects if o.type.name=='TextAsset' and o.peek_name()=='ModelConfig').parse_as_object().m_Script.encode('utf8','surrogateescape')
    if again!=data:raise ValueError('Visual asset roundtrip mismatch')
    return {MODEL_BUNDLE:out},fallbacks
