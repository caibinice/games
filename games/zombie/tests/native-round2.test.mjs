import {it,expect} from 'vitest';
import {createLocalRole,localRoleData,roleSessionReply,gemRollReply} from '../tools/local-protocol/role-session.mjs';
import {CLIENT_GEMS} from '../public/client-gem-data.mjs';
const now=1793450000000,initial=createLocalRole({name:'round2',head:1000,sex:1,bodyType:1},now),p={gold:10000,reagent:9999,gems:[900010107,900020107]};
const req=(cmd,...values)=>{const body=Buffer.alloc(values.length*4);values.forEach((v,i)=>body.writeUInt32BE(v,i*4));return {cmd,body,echo:88};};
const data=(r,profile=p)=>localRoleData(r,now,profile);
function rollTo(role,from,to){const source=CLIENT_GEMS.find(g=>g.id===from),pool=CLIENT_GEMS.filter(g=>g.part===source.part&&g.quality===source.quality&&g.id!==from&&g.id<999000000&&g.id%10===source.quality);return gemRollReply(req(4204,from,0,0,0),role,now,p,()=>pool.findIndex(g=>g.id===to));}
it('keeps the locked original separate when another gem rerolls into an identical effect',()=>{
 let role=roleSessionReply({cmd:4210,body:Buffer.concat([Buffer.from([1]),req(4210,900010107,0,1,0).body])},initial,now,p).role;
 let out=rollTo(role,900020107,900010107);expect(out.reply.body.readInt32BE()).toBe(0);role=out.role;
 const same=data(role).BagData.ItemData.filter(i=>i.ItemID===900010107);expect(same).toHaveLength(2);expect(same.map(i=>i.Detail.GemDetail.IsLock).sort()).toEqual([0,1]);
 out=rollTo(role,900010107,900020107);expect(out.reply.body.readInt32BE()).toBe(0);expect(data(out.role).BagData.ItemData.find(i=>i.ItemID===900010107).Detail.GemDetail.IsLock).toBe(1);
});
it('rerolls the extra unequipped copy without altering an identical equipped gem',()=>{
 let role=roleSessionReply(req(4200,900010107,1,1,1),initial,now,p).role;
 let out=rollTo(role,900020107,900010107);expect(out.reply.body.readInt32BE()).toBe(0);role=out.role;
 out=rollTo(role,900010107,900020107);expect(out.reply.body.readInt32BE()).toBe(0);
 expect(data(out.role).EquipData.GemPageData[0].GemPageEquipData[0].GemList[0].GemData.ItemID).toBe(900010107);
});
function start(role,id){const body=Buffer.alloc(13);body.writeInt32BE(id);return roleSessionReply({cmd:4251,body,echo:90},role,now,p);}
function finish(role,win=1,hp=100){const b=Buffer.alloc(16);b[0]=1;b[1]=win;b.writeFloatBE(hp,2);b.writeBigUInt64BE(BigInt(role.pendingBattle.id),6);return {cmd:4254,body:b,echo:91};}
it('grants a real settlement inventory update and opens the next normal and first elite stages',()=>{
 const started=start(initial,1001).role,out=roleSessionReply(finish(started),started,now+10000,p);expect(out.reply.cmd).toBe(4255);expect(out.role.pendingBattle).toBeNull();
 expect(data(out.role).LevelData.UnlockLevelList.filter(s=>s.LevelID<3000).map(s=>s.LevelID)).toEqual([1001,1002,2001]);
 expect(data(out.role).BaseData.Gold).toBeGreaterThan(p.gold);expect(data(out.role).BagData.ItemData.some(i=>i.ItemID===61001)).toBe(true);expect(out.notifications[0].cmd).toBe(2021);
 expect(start(out.role,1002).reply.body.readInt32BE()).toBe(0);expect(start(out.role,1003).reply.body.readInt32BE()).toBe(1);
});
it('does not grant rewards twice when the client repeats a settlement request',()=>{
 const started=start(initial,1001).role,q=finish(started),out=roleSessionReply(q,started,now+10000,p),retry=roleSessionReply(q,out.role,now+12000,p);
 expect(retry.role).toEqual(out.role);expect(retry.reply.body).toEqual(out.reply.body);expect(retry.role.battleWins).toBe(1);
});
it('migrates earlier victories to next-stage access without resetting inventory',()=>{
 const role={...initial,battleWins:2,bestHpRate:100};expect(data(role).LevelData.UnlockLevelList.some(r=>r.LevelID===1002)).toBe(true);expect(start(role,1002).reply.body.readInt32BE()).toBe(0);
});
const free={...p,freeActions:true};
const act=(r,cmd,...v)=>roleSessionReply(req(cmd,...v),r,now,free);
it('unlocks advanced outfits and core forms, including zero-cost source entries',()=>{
 let r=act(initial,29302,84001,4).role;r=act(r,29302,85001,5).role;
 expect(data(r,free).SkinData.SkinList.flatMap(s=>s.SkinList).map(s=>s.SkinID)).toEqual(expect.arrayContaining([84001,85001]));
});
it('persists outfit effects and core skill slots independently for every loadout page',()=>{
 let r=act(initial,29302,81001,1).role;r=act(r,29302,82001,2).role;
 for(const [id,type]of [[81001,1],[82001,2]]){let o=act(r,29308,id,type,1,1,1);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;}
 expect(data(r,free).SkinData.SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(82001);
 r=act(r,29310,2,2).role;expect(data(r,free).SkinData.SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(0);
 r=act(r,29310,2,1).role;expect(data(r,free).SkinData.SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(82001);
});
it('allows advanced effect entries on their matching normal outfit slots',()=>{
 let r=act(initial,29302,84001,4).role;const o=act(r,29308,84001,1,1,0,1);expect(o.reply.body.readInt32BE()).toBe(0);
});
it('unlocks, upgrades and uses a gun skin, preserving selection across role and battle state',()=>{
 let r=act(initial,29204,2).role;r=act(r,29210,2).role;r=act(r,29206,2).role;
 expect(data(r,free).GunData).toMatchObject({CurGunID:2,GunList:[{GunID:1,GunLevel:1},{GunID:2,GunLevel:2}]});
 const b=Buffer.alloc(13);b.writeInt32BE(1001);expect(roleSessionReply({cmd:4251,body:b},r,now,free).notifications[0].body.length).toBeGreaterThan(500);
});
it('uses actual mecha growth tables and a typed five-skill notification',()=>{
 let r=act(initial,7301,1).role;r=act(r,7307,1).role;r=act(r,7313,1,0).role;
 let o=act(r,7309,1,2);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;r=act(r,7311,1,2).role;
 expect(r.localMechas.owned[1]).toMatchObject({level:2,star:2,skills:{1:1,2:2}});
 o=act(r,7303,1,1,2);expect(o.role.localMechas.slots).toEqual([0,0,1]);expect(o.notifications.map(n=>n.cmd)).toEqual([7300,7315]);
});
it('quick patrol grants inventory and can repeat without a daily limit',()=>{
 let r=initial;for(let i=0;i<20;i++){const o=roleSessionReply({cmd:12323,body:Buffer.from([0]),echo:i},r,now,free);expect(o.reply.cmd).toBe(12324);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;}
 expect(r.localPatrol.count).toBe(20);expect(r.localXp).toBe(1100);expect(data(r,free).BaseData).toMatchObject({Level:21,Exp:35});expect(data(r,free).BagData.ItemData.find(i=>i.ItemID===61001).StackCnt).toBe(data(initial,free).BagData.ItemData.find(i=>i.ItemID===61001).StackCnt+200);
});
it('opens a personal guild with three bots and repeatable contribution requests',()=>{
 let r=initial;expect(data(r,free).GuildData.GuildUID).toBe('9100000001');
 const query=roleSessionReply({cmd:16001,body:Buffer.from([0])},r,now,free);expect(query.reply.cmd).toBe(16002);expect(query.reply.body.includes(Buffer.from('军团机器人1'))).toBe(true);
 for(let i=0;i<3;i++)r=roleSessionReply({cmd:16070,body:Buffer.from([1])},r,now,free).role;
 expect(r.localGuild.donations).toBe(300);
});
it('answers ad entitlement and logout with their own native schemas',()=>{
 expect(act(initial,12812,1).reply.body.readUInt32BE(4)).toBe(1);
 expect(roleSessionReply({cmd:2007,body:Buffer.from([0])},initial,now,free).reply.body.readInt32BE()).toBe(0);
});
it('grants the typed ad-completion patrol reward repeatedly without consuming a daily quota',()=>{
 let r=initial;const body=Buffer.alloc(13);body.writeInt32BE(3);for(let i=0;i<4;i++){const o=roleSessionReply({cmd:12802,body},r,now,free);expect(o.reply.cmd).toBe(12803);expect(o.reply.body.readInt32BE()).toBe(3);r=o.role;expect(o.notifications.map(n=>n.cmd)).toContain(12800);}expect(r.localPatrol.count).toBe(4);
});
it('claims each earned stage-star chest once and persists the native claimed flag',()=>{
 let r={...initial,battleWins:1,bestHpRate:100};let o=act(r,4286,1,1,3);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;expect(data(r,free).LevelData.UnlockLevelList[0].LevelAwardList[2].IsAward).toBe(1);expect(act(r,4286,1,1,3).reply.body.readInt32BE()).toBe(1);
});
it('opens world rescue with a million remaining attempts and source level IDs',()=>{
 const b=Buffer.alloc(13);b.writeInt32BE(4001);const o=roleSessionReply({cmd:4251,body:b},initial,now,free);expect(o.reply.body.readInt32BE()).toBe(0);expect(o.role.pendingBattle.level).toBe(4001);
});
it('opens native maze maps, starts a real source encounter and restores the map after settlement',()=>{
 let r=initial;expect(act(r,24500,1,1).reply.body.readInt32BE()).toBe(0);
 r=act(r,24502,1,1,1,1).role;const encounter=act(r,24502,1,1,2,1);expect(encounter.reply.body.readInt32BE()).toBe(0);expect(encounter.notifications.map(n=>n.cmd)).toContain(4253);r=encounter.role;expect(r.pendingBattle.level).toBe(9001);
 const ended=roleSessionReply(finish(r),r,now+10000,free);expect(ended.role.localMaze).toMatchObject({row:2,col:1,pending:null,score:100});
});
it('keeps maze resets unlimited while retaining a server-side audit counter',()=>{
 let r=initial;for(let i=0;i<10;i++)r=roleSessionReply({cmd:24515,body:Buffer.from([0])},r,now,free).role;
 expect(r.localMaze.resets).toBe(10);expect(act(r,24500,1,1).reply.cmd).toBe(24501);
});
