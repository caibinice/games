"""Export verified APK particle sheets used by derived gem effects."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image
from build_skill_pack import APK_SHA

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('export_dir',type=Path)
p.add_argument('output_dir',type=Path)
a=p.parse_args();root=a.export_dir.resolve();out=a.output_dir.resolve();out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((root/'manifest.json').read_text('utf8'))
requests=[('drone-hit','assets_effect_skill_wurenjichongji.ab','wrjcj_seq_4x4_zj_Tex'),('airdrop-explosion','assets_effect_skill_kongtouhongzha.ab','kthz_seq_4x4_zj_Tex'),('fuel-burn','assets_effect_skill_ranyoudan.ab','seq_4x4_Tex')]
proof=[]
for name,bundle,texture in requests:
 r=next(r for r in manifest if r['type']=='Texture2D' and r['bundle']==bundle and r['name']==texture)
 o=r['outputs'][0];source=(root/o['file']).resolve()
 assert source.is_relative_to(root) and hashlib.sha256(source.read_bytes()).hexdigest()==o['sha256']
 target=out/(name+'.webp')
 with Image.open(source) as im:
  assert im.width%4==0 and im.height%4==0
  im.save(target,'WEBP',quality=94,method=6)
 proof.append({'bundle':bundle,'bundle_sha256':r['bundle_sha256'],'path_id':str(r['path_id']),'texture':texture,'input_sha256':o['sha256'],'output':target.name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'grid':[4,4]})
(out/'proc-provenance.json').write_text(json.dumps({'apk_sha256':APK_SHA,'screenshots_used':False,'sources':proof},ensure_ascii=False,indent=2),'utf8')
print(json.dumps({'textures':len(proof),'bytes':sum((out/r['output']).stat().st_size for r in proof)}))
