import {it,expect} from 'vitest';
import {createLocalRole,roleSessionReply,localRoleData,packRoleStruct} from '../tools/local-protocol/role-session.mjs';
import {growthData,battleSkinData,growthState,skinSlots} from '../tools/local-protocol/growth-state.mjs';
import {mazeState,mazeRoleData,mazeGridData,mazeBattleData,mazeScoreData} from '../tools/local-protocol/maze-state.mjs';
import {MAZE_SOURCE as S,MAZE_EVENTS as E} from '../tools/local-protocol/maze-source.mjs';
import {roleTypes} from '../tools/local-protocol/role-schema.mjs';
import {battleReportTypes} from '../tools/local-protocol/battle-report-schema.mjs';
import {readBattleReport} from '../tools/local-protocol/battle-report.mjs';
Object.assign(roleTypes,battleReportTypes);
const now=1793500000000,p={freeActions:true,gold:1000,forms:[82001],outfits:[81001],equippedForm:82001,equippedOutfit:81001},initial=createLocalRole({name:'round3',head:1000,sex:1,bodyType:1},now);
function request(cmd,...values){const body=Buffer.alloc(values.length*4);values.forEach((v,i)=>body.writeInt32BE(v,i*4));return {cmd,body,echo:9};}
const apply=(r,c,...v)=>roleSessionReply(request(c,...v),r,now,p),byte=(r,c)=>roleSessionReply({cmd:c,body:Buffer.from([0]),echo:9},r,now,p);
it('starts and migrates maze runs on a real source tile so native CanMoveCell has outgoing paths',()=>{
 for(const r of [initial,{...initial,localMaze:{level:1,type:1,row:0,col:0}}]){const s=mazeState(r),data=mazeRoleData(r),tile=S.MessMapConfig.find(n=>n.Level===s.level&&n.Type===s.type&&n.Row===data.PreRow&&n.Clo===data.PreClo);expect(tile.NextGrid.some(n=>n.Row===2)).toBe(true);const o=apply(r,24502,1,1,2,1);expect(o.reply.body.readInt32BE()).toBe(0);const retry=apply(o.role,24502,1,1,2,1);expect(retry.role.pendingBattle.id).toBe(o.role.pendingBattle.id);expect(retry.notifications.some(n=>n.cmd===4253)).toBe(true);expect(mazeRoleData(o.role)).toMatchObject({CurRow:2,PreRow:1});expect(o.role.localMaze.pending.NpcData.every(n=>S.MessMonsterLibraryConfig.some(r=>r.ID===n.ID))).toBe(true);}
});
function fin(r,tail=Buffer.alloc(0)){const b=Buffer.alloc(16);b[0]=b[1]=1;b.writeFloatBE(70,2);b.writeBigUInt64BE(BigInt(r.pendingBattle.id),6);return roleSessionReply({cmd:4254,body:Buffer.concat([b,tail]),echo:9},r,now+1000,p);}
it('migrates worn legacy outfits and cores into usable primary skill slots',()=>{
 for(const type of [1,2]){const raw=growthData(initial,p).SkinData.SkinList.find(s=>s.SkinType===type),battle=battleSkinData(initial,p).SkinList.find(s=>s.SkinType===type),id=type===1?81001:82001;
  expect(raw.SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(id);expect(battle.SkinList).toContainEqual({SkinID:id,SkinLevel:1});expect(battle.SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(id);
 }
});
it('preserves explicitly emptied loadouts instead of re-equipping them on relog',()=>{
 const s=growthState(initial,p);s.extra={2:{0:skinSlots(2)}};const r={...initial,localGrowth:s};expect(battleSkinData(r,p).SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(0);
});
it('includes advanced ownership levels in the engine type used by the selected slot',()=>{
 let r=apply(initial,29302,85001,5).role;r=apply(r,29308,85001,2,1,0,1).role;const core=battleSkinData(r,p).SkinList.find(s=>s.SkinType===2);
 expect(core.SkinList).toContainEqual({SkinID:85001,SkinLevel:1});expect(core.SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(85001);expect(growthData(r,p).SkinData.SkinList.find(s=>s.SkinType===5).SkinList[0].SkinID).toBe(85001);
});
it('supports maze purchases, unlimited free refresh and persistent run inventory',()=>{
 let r=initial;let o=byte(r,24507);expect(o.reply.cmd).toBe(24508);const first=shopFrom(o.reply.body);
 o=apply(r,24509,first);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;expect(Object.keys(mazeState(r).drugs).length+mazeState(r).capsules.length).toBe(1);expect(apply(r,24509,first).reply.body.readInt32BE()).toBe(1);r=byte(r,24511).role;expect(r.localMaze.shopRefreshes).toBe(1);expect(r.localMaze.shopBought).toEqual([]);
});
function shopFrom(b){return b.readInt32BE(13);}
it('grants exact pinned maze score rewards to the real bag once per claim',()=>{
 const r={...initial,localMaze:{...mazeState(initial),score:100}},before=localRoleData(r,now,p).BagData.ItemData.find(i=>i.ItemID===201201)?.StackCnt||0,o=apply(r,24518,1);
 expect(o.reply.body.readInt32BE()).toBe(0);expect(localRoleData(o.role,now,p).BagData.ItemData.find(i=>i.ItemID===201201).StackCnt).toBe(before+10);expect(mazeScoreData(o.role).AwardList[0].IsAward).toBe(1);expect(apply(o.role,24518,1).reply.body.readInt32BE()).toBe(1);expect(apply(o.role,24518,2).reply.body.readInt32BE()).toBe(1);
});
it('plays valid paths through all three maze layers, resolves events and collects all score rewards',()=>{
 let r=initial,steps=0,battles=0,events=0;
 while(!mazeState(r).completed&&steps++<100){let s=mazeState(r);
  if(s.rand.IsEvent){const e=E.MessEventBaseConfig.find(e=>e.EventID===s.rand.EventID);expect(e).toBeTruthy();const o=apply(r,24513,e.Chose.find(Boolean));expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;events++;continue;}
  if(s.rand.RandItem.length){const item=s.rand.RandItem[0],o=apply(r,24520,item.ItemID,item.Type);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;continue;}
  const row=S.MessMapConfig.find(n=>n.Level===s.level&&n.Type===s.type&&n.Row===s.row&&n.Clo===s.col),next=s.row===0?{Row:1,Clo:1}:row.NextGrid.find(n=>n.Row);
  expect(next).toBeTruthy();const o=apply(r,24502,s.level,s.type,next.Row,next.Clo);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;
  if(r.pendingBattle){r=fin(r).role;battles++;}
 }
 expect(mazeState(r).completed).toBe(true);expect(battles).toBeGreaterThan(5);expect(steps).toBeLessThan(100);expect(mazeState(r).level).toBe(3);expect(mazeState(r).score).toBeGreaterThanOrEqual(1800);
 for(const a of E.MessScoreBootyConfig){const o=apply(r,24518,a.Level);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;}expect(r.localMaze.claims).toHaveLength(5);
});
it('reads the native full battle report and carries learned builds, wall HP and core effects to the next encounter',()=>{
 let r=apply(initial,24502,1,1,1,1).role;r=apply(r,24502,1,1,2,1).role;expect(r.pendingBattle).toBeTruthy();const d=localRoleData(r,now,p),core=battleSkinData(r,p).SkinList.find(s=>s.SkinType===2),mess=mazeBattleData(r,1000,core);
 const last={WallHpMax:1000,WallHp:700,BuildList:[{BuildID:103,Count:1}],SkillMp:'4294967296',BianShenIndex:0,SelectBuildCnt:2,RecordGemList:[900010107],RecordRandBuildList:[700011]};
 const report={StartParam:{LevelID:r.pendingBattle.level,BattleGID:r.pendingBattle.id,PlayerData:[{PlayerData:{BaseData:{RoleID:r.id,RoleName:r.name,BattleEquipGemData:{EquipList:d.EquipData.EquipList}},ActorRunData:{},AttrData:{}},ActorLevel:1}],HasMessData:1,MessData:mess},InputData:{Data:Array(5000).fill(0)},PlayerRunCheckData:{IsBattleFinish:1,IsWin:1,PlayerRunData:[{RoleID:r.id,HP:700,MessFinalData:{LastMessData:last}}]},SkillData:[]};
 const raw=packRoleStruct('CSLevelFinStageClientData',report);expect(readBattleReport(raw).PlayerRunCheckData.PlayerRunData[0].MessFinalData.LastMessData.BuildList).toEqual(last.BuildList);
 const ended=fin(r,raw);expect(ended.role.localMaze.lastBattle).toMatchObject(last);expect(ended.role.localMaze.reportError).toBeUndefined();
 r=ended.role;let option=mazeState(r).rand.RandItem[0];r=apply(r,24520,option.ItemID,option.Type).role;const s=mazeState(r),row=S.MessMapConfig.find(n=>n.Level===s.level&&n.Type===s.type&&n.Row===s.row&&n.Clo===s.col),next=row.NextGrid.find(n=>n.Row);r=apply(r,24502,s.level,s.type,next.Row,next.Clo).role;
 if(r.pendingBattle){const nextData=mazeBattleData(r,1000,core);expect(nextData.FirstAtk).toBe(0);expect(nextData.LastMessData.BuildList).toEqual(last.BuildList);expect(nextData.TechSkinData.SkinChooseInfo.ChooseExtraSkinList[0].SubSlotEntry[0].SlotSkinID).toBe(82001);}
});

it('accepts native zero-based preset switching and carries the advanced dedicated slot into combat',()=>{
 let r=apply(initial,29302,85001,5).role;let o=apply(r,29310,2,0);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;o=apply(r,29308,85001,5,4,1,0);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;const core=battleSkinData(r,p).SkinList.find(s=>s.SkinType===2);expect(core.SkinChooseInfo.PageIdx).toBe(0);expect(core.SkinChooseInfo.ChooseExtraSkinList.find(s=>s.Slot===4).SubSlotEntry[0].SlotSkinID).toBe(85001);
});
