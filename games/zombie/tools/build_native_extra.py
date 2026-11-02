"""Strict, source-hash-verified native combat data export. Research outputs only."""
import sys,json,hashlib,re
from pathlib import Path
from collections import defaultdict,Counter
sys.path.insert(0,str(Path(__file__).resolve().parent))
from decode_client_config import decode
from build_skill_pack import normalize,APK_SHA
import argparse
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('export_dir',type=Path);parser.add_argument('output_dir',type=Path);parser.add_argument('--growth-dir',type=Path,required=True,help='Verified decoded ResDef growth table directory');args=parser.parse_args()
ROOT=args.export_dir.resolve();OUT=args.output_dir.resolve();TOOLS=Path(__file__).resolve().parent;GROWTH=args.growth_dir.resolve();OUT.mkdir(parents=True,exist_ok=True)
records=json.loads((ROOT/'manifest.json').read_text('utf8')); inputs={};schemas={}
for file in ['client-schemas','skill-schemas','gem-schemas','effect-schemas']:
 schemas.update(json.loads((TOOLS/(file+'.json')).read_text('utf8'))['schemas'])
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(r):
 o=r['outputs'][0];p=(ROOT/o['file']).resolve()
 assert p.is_relative_to(ROOT) and sha(p)==o['sha256']
 inputs[(r['bundle'],r['path_id'])]={'bundle':r['bundle'],'bundle_sha256':r['bundle_sha256'],'path_id':str(r['path_id']),'name':r['name'],'sha256':o['sha256']}
 return p
def table(name):
 ns,cls=name.split('.');bundle='assets_resources_config_resbin_'+('fp_' if ns=='BattleCore' else '')+cls.lower()+'.bytes.ab'
 r=next(x for x in records if x['type']=='TextAsset' and x['bundle']==bundle)
 return decode(read(r).read_bytes(),name,schemas)['rows']
bases={r['SkillID']:r for r in table('BattleCore.SkillBaseConfg')}
subs={r['SkillID']:r for r in table('BattleCore.SubSkillConfg')}
builds={r['BuildID']:r for r in table('ResDef.BuildConfig')}
groups=table('BattleCore.BuildGroupConfig');gems=table('BattleCore.GemBaseConfig')
attrs=defaultdict(list)
for r in table('BattleCore.BuffFuncSkillAttrConfig'):
 attrs[r['ID']].append({'skills':[x for x in r['SkillID'] if x],'values':[x for x in r['AttrData'] if x['DataType']],'gunAdd':r['GunAdd']})
buffconfig={r['BuffID']:r for r in table('BattleCore.BuffConfig')}
buffattrs={r['BuffID']:r for r in table('BattleCore.BuffAttrConfig')}
texts={r['ID']:re.sub('<[^>]*>','',r['Content']).replace('\x00','') for r in table('ResDef.TextConfig')}
selected={r['BuildID'] for r in groups if 1001<=r['GroupID']<=1014}|{r['BuildID'] for r in gems if r['BuildID']}
# Include the ordinary firearm build graph and all related roots/subskills.
selected|={k for k,v in builds.items() if v['SkillID']==100}
# Native progression build roots and companion/gun display graphs.
growth=json.loads(GROWTH.joinpath('ResDef.SkinLevelConfig.json').read_text('utf8'))['rows']
selected|={r[k] for r in growth for k in ['EntryID','EntryID2'] if r[k] in builds}
merc=json.loads(GROWTH.joinpath('ResDef.MercenarySkillConfig.json').read_text('utf8'))['rows']
extra_ids={x for r in merc for x in r['SkillId'] if x}
gunrows=json.loads(GROWTH.joinpath('ResDef.GunBaseConfig.json').read_text('utf8'))['rows']
extra_ids|={r['SkillID'] for r in gunrows}
selected|={r['BuildID'] for r in gunrows if r['BuildID'] in builds}
selected|={id for id,b in builds.items() if b['GunAdd']==1 or 3000000<=b['SkillID']<4000000}
# Follow source FuncAddBuild and FuncAddBuffs references reachable from real
# gems/skins; these are data links, not guessed descriptions.
buff_roots={r['BuffID'] for r in gems if r['BuffID']}
for table in ['MagicSkillLevelConfig','GunSkillConfig']:
 for row in json.loads(GROWTH.joinpath('ResDef.'+table+'.json').read_text('utf8'))['rows']:
  if row['BuildID'] in builds:selected.add(row['BuildID'])
for r in growth:
 for pair in r['RandBuild']:
  selected.update(v for v in pair.values() if v in builds)
seen_buffs=set()
while True:
 for id in list(selected):
  b=builds[id];buff_roots.update(v for v in [b['BuffID1'],b['BuffID2']] if v)
 pending=buff_roots-seen_buffs
 if not pending:break
 for id in pending:
  seen_buffs.add(id);f=buffattrs.get(id,{}).get('FuncData',{});p=f.get('FuncParam',[])
  if f.get('FuncId')==2 and p[0] in builds:selected.add(p[0])
  if f.get('FuncId')==67:buff_roots.update(v for v in p if v in buffattrs)
ids=set(range(1000,14001,1000));ids.add(100);ids|=extra_ids
for id in selected:
 b=builds[id];ids.add(b['SkillID']);ids.update(x for x in b['AddSubSkillID']+b['RmvSubSkillID'] if x)
for row in buffattrs.values():
 if row['FuncData']['FuncId']==3 and row['FuncData']['FuncParam'][0] in bases:ids.add(row['FuncData']['FuncParam'][0])

disp={r['name']:r for r in records if r['type']=='MonoBehaviour' and r['bundle']=='assets_resources_skilldisp.ab'}
def impact(h):
 return {'type':h.get('m_ImpactType',0),'damageIndex':h.get('m_damageIndex',0),'damageRatio':h.get('m_damageRatio',1),'knockback':h.get('m_backOffDist',0),'raw':h}
def baseNode(row):
 return {'index':row.get('m_elemIndex',0),'triggerType':row.get('m_triggerType',0),'start':row.get('m_triggleStart',{}),'stop':row.get('m_triggleStop',{}),'repeat':row.get('m_triggleRepeat',{})}
def bullet(row):
 b=row['m_bulletData'];h=row['m_impactData'];fg=b['m_fireGroup'];sp=row['m_bulletTestParam']
 return {**baseNode(row),'speed':b['m_initMoveSpeed'],'range':b['m_shootRange'],'through':b['m_hitThroughCount'],'radius':sp.get('m_radius',0),'width':sp.get('m_width',0),'length':sp.get('m_length',0),'damageIndex':h['m_damageIndex'],'knockback':h['m_backOffDist'] if h['m_ImpactType']==2 else 0,'count':fg['m_autoDegreeCount'],'parallelCount':fg.get('m_autoParallelBulletCount',1),'group':fg,'angle':fg['m_autoDegreeDelta'],'damageRatio':h['m_damageRatio'],'life':b.get('m_shootFlyTime',0),'interval':b.get('m_seqTimeBulletInterval',0),'sequenceCount':b.get('m_seqTimeBulletNum',1),'delay':b.get('m_delayMove',0),'effect':b.get('m_bulletEffect',{}),'hit':impact(h),'data':b,'test':sp}
def area(row):
 h=row['m_impactData'];rg=row['m_shootTestParam']['m_range'];life=row['m_shootPointLife'];fire=row['m_shootFireCount']
 return {**baseNode(row),'radius':rg['m_radiusOut'],'innerRadius':rg.get('m_radiusIn',0),'width':rg.get('m_width',0),'length':rg.get('m_length',0),'duration':life['m_lifeTime'],'interval':fire['m_fireInterval'],'delay':fire['m_delayStart'],'count':fire.get('m_fireCount',1),'damageIndex':h['m_damageIndex'],'damageRatio':h['m_damageRatio'],'hit':impact(h),'range':rg,'life':life,'fire':fire,'data':row}
graphs={};missing=[]
for id in sorted(ids):
 info=subs.get(id) or bases.get(id)
 if not info:missing.append(id);continue
 r=disp.get(str(info['SkillDispID']))
 if not r:missing.append(id);continue
 g=normalize(json.loads(read(r).read_text('utf8'))['m_skillDispData'])
 graphs[id]={'id':id,'dispId':info['SkillDispID'],'rootId':id if id in bases else None,'duration':info.get('SkillDurationTime',0),'bullets':[bullet(v) for v in g.get('m_allElemBullet',[])],'areas':[area(v) for v in g.get('m_allElemShootPoint',[])],'events':g.get('m_allRuleEvent',[]),'effects':g.get('m_allElemEffect',[]),'animations':g.get('m_allElemAnimation',[]),'focus':g.get('m_AllElemFocusLaser',[]),'chains':g.get('m_allElemLightChain',[]),'electrodes':g.get('AllElemElectrode',[]),'lines':g.get('m_allElemLineEffect',[]),'buffNodes':g.get('m_allElemBuff',[]),'colliders':g.get('m_AllElemElemCollider',[]),'translations':g.get('m_allElemTranslate',[]),'targetFinds':g.get('m_AllElemTargetFinds',[]),'summons':g.get('m_allElemSummonNpc',[])}
# Compact buff rows retain all nonzero attributes and complete trigger parameters.
buffs={}
for id in sorted(set(buffconfig)|set(buffattrs)):
 b={**buffconfig.get(id,{}),**buffattrs.get(id,{})}
 if 'AttrData'in b:b['AttrData']=[a for a in b['AttrData'] if a['DataType']]
 buffs[id]=b
libraryIds={builds[x]['AttrLibraryID'] for x in selected}|{r['AttrLibraryID'] for r in gems};libraryIds.discard(0)
exportbuilds={id:{**builds[id],'name':texts.get(builds[id]['Name'],''),'description':texts.get(builds[id]['Desc'],''),'attrs':attrs.get(builds[id]['AttrLibraryID'],[])} for id in sorted(selected)}
data={'CLIENT_NATIVE_GROUPS':[r for r in groups if r['BuildID'] in selected], 'CLIENT_NATIVE_GRAPHS':graphs,'CLIENT_NATIVE_BASES':{id:bases[id] for id in sorted(ids) if id in bases},'CLIENT_NATIVE_SUBS':{id:subs[id] for id in sorted(ids) if id in subs},'CLIENT_ATTR_LIBRARIES':{id:attrs[id] for id in sorted(libraryIds) if id in attrs},'CLIENT_NATIVE_BUFFS':buffs,'CLIENT_NATIVE_BUILDS':exportbuilds}
p=OUT/'native-skill-extra.mjs';p.write_text('// Generated from pinned APK; repeated attr-library rows are deliberately preserved.\n'+'\n'.join('export const '+k+'='+json.dumps(v,ensure_ascii=False,separators=(',',':'))+';' for k,v in data.items())+'\n','utf8')
proof={'apk_sha256':APK_SHA,'screenshots_used':False,'inputs':list(inputs.values()),'schemas':schemas,'counts':{k:len(v) for k,v in data.items()},'missing_graph_ids':missing,'attribute_library_rows':sum(len(v) for v in data['CLIENT_ATTR_LIBRARIES'].values()),'duplicate_attribute_library_ids':sum(len(v)>1 for v in data['CLIENT_ATTR_LIBRARIES'].values()),'outputs':[{'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size}]}
(OUT/'native-skill-extra.provenance.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2),'utf8')
print(json.dumps({'counts':proof['counts'],'missing_graphs':missing,'bytes':p.stat().st_size,'hash':sha(p)}))
