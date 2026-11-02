import {it,expect} from 'vitest';
import {createLocalRole,localRoleData,localCoreData,roleSessionReply,packRoleStruct} from '../tools/local-protocol/role-session.mjs';
import {lotteryNotifications,lotteryAction,premiumLotteryChoices} from '../tools/local-protocol/lottery-state.mjs';
const now=1793400000000,initial=createLocalRole({name:'phone regression',head:1000,sex:1,bodyType:1},now);
const p={freeActions:true,level:30,reagent:0,gold:0,gems:[900010107],mercs:[101]};
function req(cmd,...numbers){const body=Buffer.alloc(numbers.length*4);numbers.forEach((n,i)=>body.writeInt32BE(n,i*4));return {cmd,body,echo:81};}
it('starts with source-valid positive core levels and migrates earned levels without resetting them',()=>{
 expect(localCoreData(initial).DataList).toHaveLength(14);expect(localCoreData(initial).DataList.every(s=>s.Level>=1)).toBe(true);
 const old={...initial,localCores:{fingerprint:'old',levels:Object.fromEntries(localCoreData(initial).DataList.map((s,i)=>[s.ID,i?0:17]))}};
 const data=localCoreData(old,p).DataList;expect(data[0].Level).toBe(17);expect(data.slice(1).every(s=>s.Level===1)).toBe(true);
});
it('rerolls gems 120 consecutive times without exhausting reagents or losing earned items',()=>{
 let role=initial;for(let i=0;i<120;i++){
  const data=localRoleData(role,now,p),gem=data.BagData.ItemData.find(g=>g.ItemType===3);
  const out=roleSessionReply(req(4204,gem.ItemID,0,i?0:1,0),role,now,p);expect(out.reply.body.readInt32BE()).toBe(0);role=out.role;
 }
 const data=localRoleData(role,now,p);expect(data.BagData.ItemData.find(i=>i.ItemID===1001).StackCnt).toBeGreaterThanOrEqual(9999);expect(data.BagData.ItemData.filter(i=>i.ItemType===3).reduce((n,g)=>n+g.StackCnt,0)).toBe(1);expect(data.BaseData.Gold).toBe(1e9);
});
it('upgrades mercenaries repeatedly without requiring a paid material refill, retaining max-level rules',()=>{
 let role=initial;for(let i=0;i<30;i++){const out=roleSessionReply(req(5801,101),role,now,p);expect(out.reply.body.readInt32BE()).toBe(0);role=out.role;}
 expect(localRoleData(role,now,p).MercenaryData.MercenaryList[0].Level).toBe(31);
});
it('accepts repeated skill refresh only for the active battle and returns a positive native refresh quota',()=>{
 const body=Buffer.alloc(13);body.writeInt32BE(1001);let role=roleSessionReply({cmd:4251,body},initial,now,p).role;
 for(let i=0;i<20;i++){const out=roleSessionReply(req(4278,1001),role,now,p);expect(out.reply.cmd).toBe(4279);expect(out.reply.body.equals(packRoleStruct('CSReRandLearnedSkillRes',{Result:{Ret:0},ReRandNum:i+1}))).toBe(true);role=out.role;}
 expect(roleSessionReply(req(4278,1001),initial,now,p).reply.body.readInt32BE()).not.toBe(0);
});
it('configures both right-hand batch buttons to ten draws and keeps each native packet below 64 KB',()=>{
 const all=lotteryNotifications(initial);for(const [cmd,key]of [[10211,'XianJun'],[11972,'BiHai']])expect(all.find(n=>n.cmd===cmd).data[key+'ActParamCfgList'].find(n=>n.FuncID===107).FuncValue).toBe(10);
 for(const n of all)expect(packRoleStruct(n.type,n.data).length).toBeLessThan(65000);
});
it('offers all source-valid premium outfits/forms/mercenaries and honors selection/claim ownership',()=>{
 const premium=premiumLotteryChoices();expect(premium.length).toBeGreaterThan(100);
 const offered=new Set();for(let round=0;round<3;round++){const role={...initial,localLotteries:{newyear:{round}}};for(const cfg of lotteryNotifications(role).find(n=>n.cmd===10912).data.LuckWheelBootyConfig.CfgList){expect(cfg.BootyAwardChooseList).toHaveLength(5);for(const c of cfg.BootyAwardChooseList)offered.add(c.BootyID);}}
 for(const row of premium)expect(offered.has(row.booty)).toBe(true);
 const chosen=premium[2],set=lotteryAction(req(10918,1,chosen.booty),initial,()=>0);expect(set.ret).toBe(0);
 const draw=lotteryAction(req(10914,1),set.role,()=>0);expect(draw.ret).toBe(0);expect(draw.awards).toContainEqual(chosen.award);
});
