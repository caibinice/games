import {it,expect} from 'vitest';
import {SKIN_CATALOG as T,SKIN_LEVEL_FALLBACKS} from '../tools/local-protocol/skin-catalog.mjs';
import {createLocalRole,roleSessionReply,localRoleData,validateLocalRole} from '../tools/local-protocol/role-session.mjs';
import {battleSkinData,growthState} from '../tools/local-protocol/growth-state.mjs';
const now=1793570000000,p={freeActions:true,level:80,gold:1000},base=createLocalRole({name:'highstar',head:1000,sex:1,bodyType:1},now);
function act(r,c,...v){const body=Buffer.alloc(v.length*4);v.forEach((x,i)=>body.writeUInt32BE(x,i*4));return roleSessionReply({cmd:c,body,echo:1},r,now,p);}
it.each(T.SkinBaseConfig.filter(s=>[1,2,4,5].includes(s.SkinType)).map(s=>[s.SkinID,s.SkinType]))('unlocks, upgrades to source cap, wears and reloads appearance %s / %s',(id,type)=>{
 let out=act(base,29302,id,type);expect(out.reply.body.readInt32BE()).toBe(0);let r=out.role;
 const cap=Math.max(...T.SkinLevelConfig.filter(l=>l.SkinID===id).map(l=>l.SkinLevel));expect(Number.isFinite(cap)).toBe(true);
 for(let level=2;level<=cap;level++){out=act(r,29304,id,type);expect(out.reply.body.readInt32BE()).toBe(0);r=out.role;expect(r.localGrowth.skins[id]).toBe(level);}
 expect(act(r,29304,id,type).reply.body.readInt32BE()).toBe(1);
 r=act(r,29306,id,type).role;r=validateLocalRole(JSON.parse(JSON.stringify(r)));
 const battle=battleSkinData(r,p).SkinList.find(s=>s.SkinType===(type>=4?type-3:type));
 expect(battle.SkinChooseInfo.CurSkinID).toBe(id);expect(battle.SkinList).toContainEqual({SkinID:id,SkinLevel:cap});expect(localRoleData(r,now,p).SkinData.SkinList.find(s=>s.SkinType===type).SkinList).toContainEqual({SkinID:id,SkinLevel:cap});
 if(type>=4)expect(localRoleData(r,now,p).SkinData.SkinList.find(s=>s.SkinType===type-3).SkinChooseInfo.CurSkinID).toBe(id);
});
it('uses only same-category and same-skill-family source rows for ten missing appearances',()=>{
 expect(Object.keys(SKIN_LEVEL_FALLBACKS)).toHaveLength(10);
 for(const [id,source]of Object.entries(SKIN_LEVEL_FALLBACKS)){const a=T.SkinBaseConfig.find(s=>s.SkinID===Number(id)),b=T.SkinBaseConfig.find(s=>s.SkinID===source);expect([a.SkinType,a.GroupID]).toEqual([b.SkinType,b.GroupID]);for(let level=1;level<=5;level++){const row=T.SkinLevelConfig.find(s=>s.SkinID===Number(id)&&s.SkinLevel===level),original=T.SkinLevelConfig.find(s=>s.SkinID===source&&s.SkinLevel===level);for(const key of ['EntryID','EntryID2','ImpactData','RandBuild','RandBuildCount'])expect(row[key]).toEqual(original[key]);}}
});
it.each([1,2])('preserves nine five-star family effects plus the advanced dedicated slot across all three presets for category %s',type=>{
 const s=growthState(base,p);s.skins=Object.fromEntries(T.SkinBaseConfig.map(s=>[s.SkinID,Math.max(...T.SkinLevelConfig.filter(l=>l.SkinID===s.SkinID).map(l=>l.SkinLevel))]));let r={...base,localGrowth:s};
 for(let page=0;page<3;page++){
  r=act(r,29310,type,page).role;
  for(let slot=1;slot<=3;slot++){const ids=[[1,15,31],[2,18,40],[4,16,33]][(slot+page-1)%3].map(n=>(type===1?81000:82000)+n);for(let sub=1;sub<=3;sub++){const o=act(r,29308,ids[sub-1],type,slot,sub,page);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;}}
  const o=act(r,29308,type===1?84001:85001,type,4,1,page);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;
 }
 r=validateLocalRole(JSON.parse(JSON.stringify(r)));
 for(let page=0;page<3;page++){r=act(r,29310,type,page).role;const slots=battleSkinData(r,p).SkinList.find(s=>s.SkinType===type).SkinChooseInfo.ChooseExtraSkinList;expect(slots).toHaveLength(4);for(let slot=1;slot<=3;slot++){const ids=[[1,15,31],[2,18,40],[4,16,33]][(slot+page-1)%3].map(n=>(type===1?81000:82000)+n);expect(slots.find(s=>s.Slot===slot).SubSlotEntry.map(s=>s.SlotSkinID)).toEqual(ids);}}
});
