import {it,expect} from 'vitest';
import {createLocalRole,roleSessionReply,localRoleData,validateLocalRole} from '../tools/local-protocol/role-session.mjs';
import {growthData,growthState,battleSkinData} from '../tools/local-protocol/growth-state.mjs';
import {CLIENT_GEMS} from '../public/client-gem-data.mjs';
import {NATIVE_GROWTH} from '../public/native-growth-data.mjs';
import {normalGem,hiddenGemIds,migrateHiddenGems} from '../tools/local-protocol/gem-policy.mjs';
const now=1793550000000,p={freeActions:true,level:30,gold:0,goods:{},gems:[]},base=createLocalRole({name:'round4',head:1000,sex:1,bodyType:1},now);
const req=(cmd,...v)=>{const body=Buffer.alloc(v.length*4);v.forEach((x,i)=>body.writeUInt32BE(x,i*4));return {cmd,body,echo:1};};
const act=(r,cmd,...v)=>roleSessionReply(req(cmd,...v),r,now,p);
it('keeps all 48 outfits and 48 cores separate and retains special ownership on reload',()=>{
 const state=growthState(base,p);state.skins=Object.fromEntries(NATIVE_GROWTH.tables.SkinBaseConfig.map(s=>[s.SkinID,1]));let r={...base,localGrowth:state};
 const d=growthData(r,p);for(const type of [1,2,4,5]){const row=d.SkinData.SkinList.find(x=>x.SkinType===type);expect(row.SkinList.every(x=>NATIVE_GROWTH.tables.SkinBaseConfig.find(s=>s.SkinID===x.SkinID).SkinType===type)).toBe(true);}
 expect(d.SkinData.SkinList.find(x=>x.SkinType===2).SkinList).toHaveLength(48);expect(battleSkinData(r,p).SkinList.find(x=>x.SkinType===2).SkinList).toHaveLength(49);
 expect(localRoleData(validateLocalRole(JSON.parse(JSON.stringify(r))),now,p).SkinData.SkinList.find(x=>x.SkinType===4).SkinList[0].SkinID).toBe(84001);
});
it('accepts advanced outfit and core effect slots addressed through their base category',()=>{
 let r=act(base,29302,84001,4).role;r=act(r,29302,85001,5).role;
 for(const [id,type]of [[84001,1],[85001,2]]){const o=act(r,29308,id,type,4,1,0);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;expect(battleSkinData(r,p).SkinList.find(x=>x.SkinType===type).SkinChooseInfo.ChooseExtraSkinList.find(x=>x.Slot===4).EffectSkinID).toBe(id);}
 expect(act(r,29308,84001,2,4,1,0).reply.body.readInt32BE()).toBe(1);
});
it('accepts the actual eight-byte mecha grade request without disconnecting and continues strengthening',()=>{
 let r=act(base,7301,1).role;r=act(r,7313,1,0).role;expect(r.localMechas.owned[1].star).toBe(2);let o=act(r,7307,1);expect(o.reply.body.readInt32BE()).toBe(0);expect(o.role.localMechas.owned[1].level).toBe(2);
});
it('upgrades equipment beyond the old level-31 role gate on the free server and supports grade changes',()=>{
 let r=base;const b=Buffer.alloc(5);b.writeUInt32BE(91001);b[4]=1;
 for(let n=0;n<4;n++)r=roleSessionReply({cmd:4217,body:b},r,now,p).role;
 expect(localRoleData(r,now,p).EquipData.EquipList[0].Detail.EquipDetail.Level).toBe(41);
 const o=act(r,4219,91001);expect(o.reply.cmd).toBe(4220);expect(o.reply.body.readInt32BE()).toBe(0);expect(localRoleData(o.role,now,p).EquipData.EquipList[0].Detail.EquipDetail.Quality).toBe(2);
});
it('excludes the six locked-9999 gems from ordinary rewards and migrates copies without losing layout or locks',()=>{
 expect(hiddenGemIds.size).toBe(6);expect(normalGem(CLIENT_GEMS.find(g=>g.id===900020199))).toBe(false);
 const r={localBag:{gems:[900020199,900020199,900020107],gemCounts:{900020199:2,900020107:1},locks:[900020199],lockCounts:{900020199:1}},localEquip:{data:{GemPageData:[{GemPageEquipData:[{GemList:[{OrderID:3,GemData:{ItemID:900020199}}]}]}]}}};
 migrateHiddenGems(r);expect(r.localBag.gems).toHaveLength(3);expect(r.localBag.gemCounts[900020107]).toBe(3);expect(r.localBag.lockCounts[900020107]).toBe(1);expect(r.localEquip.data.GemPageData[0].GemPageEquipData[0].GemList[0]).toMatchObject({OrderID:3,GemData:{ItemID:900020107}});expect(CLIENT_GEMS.find(g=>g.id===900020107).description).toBe('技能冷却-7%');
});
it('unlocks stage two from the persisted first clear independently of claimed chests',()=>{
 const r={...base,localCampaign:{version:1,sequence:1,levels:{1001:{wins:1,bestHp:100,claims:[1,2,3]}}}};const b=Buffer.alloc(13);b.writeUInt32BE(1002);const o=roleSessionReply({cmd:4251,body:b},r,now,p);expect(o.reply.body.readInt32BE()).toBe(0);expect(o.notifications.some(n=>n.cmd===4253)).toBe(true);
});
