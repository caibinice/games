"""Reviewed, compact source choice/random boxes; no live-server pool inference."""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import shutil
from PIL import Image
from decode_client_config import decode


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def build(exported, public, ui_export):
    manifest = json.loads((exported/'manifest.json').read_text('utf8'))
    pack = json.loads(Path(__file__).with_name('activity-box-schemas.json').read_text('utf8'))
    source = next(r for r in manifest if r['type']=='TextAsset' and r['bundle']=='assets_resources_config_resbin_bootyconfig.bytes.ab')
    record = source['outputs'][0]
    raw = exported/record['file']
    if sha(raw) != record['sha256']:
        raise ValueError('Booty table hash mismatch')
    decoded = decode(raw.read_bytes(), 'ResDef.BootyConfig', pack['schemas'])
    growth = public/'native-growth-data.mjs'
    goods = json.loads(growth.read_text('utf8').split('export const NATIVE_GROWTH=',1)[1].strip().rstrip(';'))['tables']['GoodsConfig']
    by_id = {r['ItemID']:r for r in goods}
    groups = defaultdict(list)
    for r in decoded['rows']:
        groups[r['BootyID']].append(r)
    def eligible(rows):
        return rows and len(rows)<=100 and all(r['BootyType']==2 and r['AwardCnt']==1 and r['ItemType']==1
            and r['ItemID'] in by_id and r['ItemCnt']>0 and r['RandParam']>0 and r['MinLevel']==r['MaxLevel']==0
            and r['ItemParam']==[0,0,0] for r in rows)
    choice, random = {}, {}
    used_groups, icons = {}, set()
    for r in goods:
        func = r['Func'];kind=func['FuncValue'];group=func['ArrFuncParam'][0]
        if kind==11:
            rows=groups[group]
            if not eligible(rows):
                raise ValueError('Unreviewed choice box: '+str(r['ItemID']))
            choice[r['ItemID']]=group
        elif kind==2 and func['ArrFuncParam'][1:]==[1,0] and eligible(groups[group]):
            rows=groups[group];random[r['ItemID']]=group
        else:
            continue
        used_groups[group]=[[x['ItemID'],x['ItemCnt'],x['RandParam']] for x in rows]
        if kind==11:
            icons.add(r['IconName'])
            icons.update(by_id[x['ItemID']]['IconName'] for x in rows)
    target=public/'assets/native-choice-box'
    if target.exists():
        raise ValueError('Preserve existing box pack before regeneration')
    target.mkdir()
    ui_proof=json.loads((ui_export/'provenance.json').read_text('utf8'))
    if ui_proof['apk_sha256']!=pack['apk_sha256'] or ui_proof['screenshots_used']:
        raise ValueError('Unexpected source UI')
    for r in ui_proof['outputs']:
        src=ui_export/r['file']
        if sha(src)!=r['sha256']:
            raise ValueError('UI sprite hash mismatch')
        dest=target/r['file'];dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
    shutil.copy2(ui_export/'native-page-layouts.json',target/'layouts.json')
    art, inputs, missing_icons={},[],[]
    reviewed_art=json.loads((public/'assets/native-operations/growth-art-provenance.json').read_text('utf8'))
    for icon in sorted(icons):
        rows=[r for r in manifest if r['type']=='Sprite' and r.get('name')==icon]
        # Duplicated sprites must contain the same exported image, never pick an arbitrary variant.
        if not rows:
            missing_icons.append(icon)
            continue
        if len({r['outputs'][0]['sha256'] for r in rows})!=1:
            reviewed=[r for r in reviewed_art if r.get('name')==icon]
            rows=[r for r in rows if any(a['bundle']==r['bundle'] and a['source']==r['outputs'][0]['sha256'] for a in reviewed)]
            if len(rows)!=1:
                raise ValueError('Ambiguous choice icon: '+str(icon))
        r=rows[0];src=exported/r['outputs'][0]['file']
        if sha(src)!=r['outputs'][0]['sha256']:
            raise ValueError('Item icon hash mismatch')
        dest=target/'items'/(icon+'.webp');dest.parent.mkdir(exist_ok=True);Image.open(src).save(dest,'WEBP',lossless=True,method=6)
        art[icon]='./assets/native-choice-box/items/'+dest.name
        inputs.append({'bundle':r['bundle'],'bundle_sha256':r['bundle_sha256'],'path_id':str(r['path_id']),'name':icon,'sha256':r['outputs'][0]['sha256']})
    data={'choices':choice,'random':random,'groups':used_groups,'art':art}
    module=public/'native-box-data.mjs'
    module.write_bytes(('export const NATIVE_BOX_DATA='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n').encode())
    (target/'source.json').write_text(json.dumps({'apk_sha256':pack['apk_sha256'],'screenshots_used':False,
        'booty':{'bundle':source['bundle'],'bundle_sha256':source['bundle_sha256'],'path_id':str(source['path_id']),
                 'sha256':record['sha256'],'decoded_rows':decoded['count'],'bytes':decoded['bytes'],'item_param_count':3},
        'growth_module_sha256':sha(growth),'choice_count':len(choice),'random_count':len(random),
        'module_sha256':sha(module),'inputs':inputs,'missing_icons':missing_icons,'ui':ui_proof,
        'outputs':[{'file':p.relative_to(public).as_posix(),'sha256':sha(p),'bytes':p.stat().st_size}
                   for p in [module,*sorted(target.rglob('*.webp')),target/'layouts.json']],
        'notes':['Only unconditional single-award goods groups are executable here; other source box semantics remain pending.',
                 'Source random RandParam weights are retained. Choice boxes allocate counts per source row without RNG.',
                 'Legacy live activity BootyIDs remain absent; these boxes do not resolve those server pools.']},indent=2),'utf8')
    print(json.dumps({'choices':len(choice),'random':len(random),'groups':len(used_groups),'moduleBytes':module.stat().st_size,'icons':len(art),'missingIcons':missing_icons}))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--exported',type=Path,required=True);p.add_argument('--public',type=Path,default=Path(__file__).resolve().parents[1]/'public');p.add_argument('--ui-export',type=Path,required=True)
    a=p.parse_args();build(a.exported.resolve(),a.public.resolve(),a.ui_export.resolve())
