import {it,expect} from 'vitest';
import {createLocalRole,roleSessionReply} from '../tools/local-protocol/role-session.mjs';
import {battleSkinData} from '../tools/local-protocol/growth-state.mjs';
import {mazeState,mazeRoleData,mazeGridData,mazeBattleData,settleMaze} from '../tools/local-protocol/maze-state.mjs';
import {MAZE_EVENTS as E} from '../tools/local-protocol/maze-source.mjs';
const now=1793550000000,p={freeActions:true,level:80,gold:1000},base=createLocalRole({name:'local-maze-loadout',head:1000,sex:1,bodyType:1},now);
function act(r,cmd,...values){const body=Buffer.alloc(values.length*4);values.forEach((v,i)=>body.writeInt32BE(v,i*4));return roleSessionReply({cmd,body,echo:1},r,now,p);}
it.each([[81001,84001,1,4],[82001,85001,2,5]])('replaces an advanced appearance with normal %s without the stale advanced selection winning in battle',(normal,advanced,type,advancedType)=>{
 let r=act(base,29302,normal,type).role;r=act(r,29302,advanced,advancedType).role;r=act(r,29306,advanced,advancedType).role;
 expect(battleSkinData(r,p).SkinList.find(s=>s.SkinType===type).SkinChooseInfo.CurSkinID).toBe(advanced);
 r=act(r,29306,normal,type).role;expect(r.localGrowth.selected[advancedType]).toBe(0);expect(battleSkinData(r,p).SkinList.find(s=>s.SkinType===type).SkinChooseInfo.CurSkinID).toBe(normal);
});
it('keeps dedicated advanced slots isolated across the shared three preset pages',()=>{
 let r=act(base,29302,85001,5).role;r=act(r,29308,85001,2,4,1,0).role;
 const slot=r=>battleSkinData(r,p).SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList.find(s=>s.Slot===4);
 expect(slot(r).EffectSkinID).toBe(85001);r=act(r,29310,2,1).role;expect(r.localGrowth.pages[5]).toBe(1);expect(slot(r).EffectSkinID).toBe(0);
 r=act(r,29310,5,0).role;expect(r.localGrowth.pages[2]).toBe(0);expect(slot(r).EffectSkinID).toBe(85001);
});
it('does not silently duplicate a legacy advanced effect into a normal slot',()=>{
 let r=act(base,29302,85001,5).role;r=act(r,29306,85001,5).role;
 const slots=battleSkinData(r,p).SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList;
 expect(slots.find(s=>s.Slot===1).EffectSkinID).toBe(0);expect(slots.find(s=>s.Slot===4).EffectSkinID).toBe(85001);
});
it('does not copy the worn effect into empty preset two or three',()=>{
 let r=act(base,29302,82001,2).role;r=act(r,29306,82001,2).role;
 for(const page of [1,2]){r=act(r,29310,2,page).role;expect(battleSkinData(r,p).SkinList.find(s=>s.SkinType===2).SkinChooseInfo.ChooseExtraSkinList.every(s=>!s.EffectSkinID)).toBe(true);}
});
it.each([1,2])('retains learned builds, wall health and energy when maze floor %s completes',level=>{
 const s={...mazeState(base),level,row:10,col:1,wins:5};const node=mazeGridData({...base,localMaze:s},level,1).MessGridData.find(n=>n.Row===11&&n.Clo===1);
 const carry={WallHpMax:5000,WallHp:3800,BuildList:[{BuildID:103,Count:4}],SkillMp:'4294967296',BianShenIndex:1,SelectBuildCnt:8,RecordGemList:[900010107],RecordRandBuildList:[700011]};
 const ended=settleMaze({...base,localMaze:{...s,pending:node}},true,carry);expect(ended.localMaze.level).toBe(level+1);expect(ended.localMaze.lastBattle).toEqual(carry);
 const next={...ended,localMaze:{...ended.localMaze,pending:{Row:2,Clo:1,FuncID:node.FuncID,NpcData:node.NpcData}}};const data=mazeBattleData(next,5000);expect(data.FirstAtk).toBe(0);expect(data.LastMessData).toEqual(carry);
});
it('consumes instantaneous event effects after the native carry includes their result',()=>{
 const s=mazeState(base),node=mazeGridData(base,1,1).MessGridData.find(n=>n.Row===2&&n.Clo===1);
 const carry={WallHpMax:5499,WallHp:5000,BuildList:[]},r=settleMaze({...base,localMaze:{...s,pending:node,effects:[1210011,1210021]}},true,carry);
 expect(r.localMaze.effects).toEqual([]);expect(r.localMaze.lastBattle.WallHpMax).toBe(5499);
 const next=mazeBattleData({...r,localMaze:{...r.localMaze,pending:node}},5000);
 expect(next.Effect.EffectData).toEqual([]);expect(next.LastMessData.WallHpMax).toBe(5499);
});
it('cancels an old maze battle on reset without cancelling a separate normal campaign',()=>{
 const entered=act(base,24502,1,1,2,1).role;expect(entered.pendingBattle).toBeTruthy();
 const q={cmd:24515,body:Buffer.from([0]),echo:1},reset=roleSessionReply(q,{...entered,localMaze:{...entered.localMaze,wins:7,reportError:'old'}},now,p).role;
 expect(reset.pendingBattle).toBeNull();expect(reset.localMaze.wins).toBe(0);expect(reset.localMaze.reportError).toBeUndefined();
 const normal={...entered,pendingBattle:{id:'9000001999',level:1001,started:1}},out=roleSessionReply(q,normal,now,p);expect(out.role.pendingBattle).toEqual(normal.pendingBattle);
});
it('resolves the real safe-area choice instead of rejecting its built-in event 1000',()=>{
 const r={...base,localMaze:{...mazeState(base),level:2,row:1,col:1}},grid=mazeGridData(r,2,1).MessGridData;
 const safe=grid.find(n=>n.Row===2&&n.FuncID===301);expect(safe).toBeTruthy();
 const moved=act(r,24502,2,1,safe.Row,safe.Clo);expect(moved.role.localMaze.rand).toMatchObject({IsEvent:1,EventID:1000});
 expect(mazeRoleData(moved.role)).toMatchObject({PreRow:1,PreClo:1,CurRow:2,CurClo:safe.Clo});
 const replay=act(JSON.parse(JSON.stringify(moved.role)),24502,2,1,safe.Row,safe.Clo);expect(replay.reply.body.readInt32BE()).toBe(0);expect(replay.role.localMaze).toEqual(moved.role.localMaze);
 const chosen=act(moved.role,24513,1001);expect(chosen.reply.body.readInt32BE()).toBe(0);expect(chosen.role.localMaze.effects).toContain(1210011);
 expect(act(chosen.role,24513,1001).reply.body.readInt32BE()).toBe(1);
 const legacy={...moved.role,localMaze:{...moved.role.localMaze,rand:{IsEvent:0,EventID:0,RandItem:[]}}};expect(act(legacy,24513,1002).reply.body.readInt32BE()).toBe(0);
});
function eventRole(choice,extra={}){const event=E.MessEventBaseConfig.find(e=>e.Chose.includes(choice));return {...base,localMaze:{...mazeState(base),...extra,rand:{IsEvent:1,EventID:event.EventID,RandItem:[]}}};}
const drugCount=r=>Object.values(r.localMaze.drugs).reduce((a,b)=>a+b,0);
it('grants random event drugs directly and removes one copy rather than an entire stack',()=>{
 const first=E.MessYaoJiConfig.find(d=>!d.PreID&&d.MaxCount>=3).YaoJiID;
 const r=act(eventRole(1051,{drugs:{[first]:3}}),24513,1051).role;
 expect(drugCount(r)).toBe(4);expect(r.localMaze.rand.RandItem).toEqual([]);expect(r.localMaze.drugs[first]).toBeGreaterThanOrEqual(2);
});
it('persists and completes both three-choice opportunities without losing the second one',()=>{
 let r=act(eventRole(1072),24513,1072).role;expect(r.localMaze.drugChoices).toBe(2);
 let pick=r.localMaze.rand.RandItem[0];r=act(JSON.parse(JSON.stringify(r)),24520,pick.ItemID,pick.Type).role;
 expect(r.localMaze.drugChoices).toBe(1);expect(r.localMaze.rand.RandItem).toHaveLength(3);
 pick=r.localMaze.rand.RandItem[0];r=act(r,24520,pick.ItemID,pick.Type).role;
 expect(drugCount(r)).toBe(2);expect(r.localMaze.drugChoices).toBe(0);expect(r.localMaze.rand.RandItem).toEqual([]);
});
it('uses the source random ranges for event currency and drug counts',()=>{
 const sums=new Set();for(let i=0;i<20;i++){
  const seeded={...eventRole(1031),createdAt:now+i},r=act(seeded,24513,1031).role,coins=r.localMaze.coin-seeded.localMaze.coin;
  expect(coins).toBeGreaterThanOrEqual(1);expect(coins).toBeLessThanOrEqual(180);sums.add(coins);
  const d=act({...eventRole(1042),createdAt:now+i},24513,1042).role;expect(drugCount(d)).toBeLessThanOrEqual(2);expect(d.localMaze.rand.RandItem).toEqual([]);
 }
 expect(sums.size).toBeGreaterThan(1);
 const fixed=act(eventRole(1012),24513,1012).role;expect(fixed.localMaze.coin-mazeState(base).coin).toBe(80);
});
it.each(E.MessEventChoseConfig.map(e=>e.ChoseID))('completes source maze event choice %s and drains every persisted reward opportunity',id=>{
 let r=act(eventRole(id,{drugs:{10010:2,10020:2},coin:1000000}),24513,id).role;
 expect(r.localMaze.eventClaims).toHaveLength(1);let choices=0;
 while(r.localMaze.rand.RandItem.length&&choices++<5){const item=r.localMaze.rand.RandItem[0],o=act(JSON.parse(JSON.stringify(r)),24520,item.ItemID,item.Type);expect(o.reply.body.readInt32BE()).toBe(0);r=o.role;}
 expect(choices).toBeLessThanOrEqual(4);expect(r.localMaze.rand).toEqual({IsEvent:0,EventID:0,RandItem:[]});expect(r.localMaze.drugChoices||0).toBe(0);
 for(const [key,count]of Object.entries(r.localMaze.drugs)){expect(count).toBeGreaterThan(0);expect(count).toBeLessThanOrEqual(E.MessYaoJiConfig.find(d=>d.YaoJiID===Number(key)).MaxCount);}
 expect(act(r,24513,id).reply.body.readInt32BE()).toBe(1);
});
