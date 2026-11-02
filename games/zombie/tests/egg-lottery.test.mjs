import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createMeta,parseMeta} from '../public/progression.mjs';
import {operationState,operationPool,eggOptions,playEgg,claimEgg} from '../public/operations.mjs';
import {loadOperationLayouts,operationScreen} from '../public/operations-ui.mjs';
import {lotteryNotifications} from '../tools/local-protocol/lottery-state.mjs';

describe('APK egg lottery choice and round state',()=>{
 it.each(['egg','festegg'])('%s exposes four prizes per source floor, aligned with the fixture',id=>{
  const config=lotteryNotifications({}).find(r=>r.cmd===(id==='egg'?14806:14813)).data;
  for(let floor=0;floor<=6;floor++){
   const choices=eggOptions(floor,id);expect(choices).toHaveLength(4);expect(new Set(choices.map(r=>r.slot)).size).toBe(4);
   expect(config.LevelCfgList[floor].BootyList).toHaveLength(4);
   expect(choices.map(r=>operationPool(id).findIndex(x=>x.slot===r.slot))).toEqual(config.LevelCfgList[floor].BootyList.map(r=>r.BootyID%1000-1));
  }
 });
 it('rejects zero-floor fresh and repeated claims without granting anything',()=>{
  const p=createMeta(),s=operationState(p,'egg');const before=JSON.stringify(p);expect(claimEgg(p).ok).toBe(false);expect(JSON.stringify(p)).toBe(before);
  playEgg(p,true,()=>0);expect(claimEgg(p,3).ok).toBe(true);const after=JSON.stringify(p);expect(claimEgg(p,3).ok).toBe(false);expect(JSON.stringify(p)).toBe(after);expect(s.round).toBe(1);
 });
 it('free demotion saves a pending choice, blocks additional draws, and grants only after selection',()=>{
  let p=createMeta();playEgg(p,false,()=>0);playEgg(p,false,()=>0);const prior=JSON.stringify(p.native.goods),r=playEgg(p,false,()=>.99);
  expect(r).toMatchObject({ok:true,success:false,floor:1,claimReady:true});expect(JSON.stringify(p.native.goods)).toBe(prior);
  p=parseMeta(p);const s=operationState(p,'egg');const draws=s.draws;expect(playEgg(p,true,()=>0).ok).toBe(false);expect(s.draws).toBe(draws);
  const reward=eggOptions(1)[0];expect(claimEgg(p,0).reward.slot).toBe(reward.slot);expect(s).toMatchObject({floor:0,protect:0,claimReady:false,round:1});
 });
 it('failed free draw at level zero grants a single valid zero-floor choice',()=>{
  const p=createMeta();expect(playEgg(p,false,()=>.8).claimReady).toBe(true);expect(claimEgg(p,2).ok).toBe(true);expect(claimEgg(p,2).ok).toBe(false);
 });
 it('third protected attempt guarantees promotion and resets protection; final level blocks draws',()=>{
  const p=createMeta();for(let floor=0;floor<6;floor++){expect(playEgg(p,true,()=>.9).success).toBe(false);expect(playEgg(p,true,()=>.9).success).toBe(false);expect(playEgg(p,true,()=>.9).success).toBe(true);expect(operationState(p,'egg').protect).toBe(0);}
  expect(operationState(p,'egg').floor).toBe(6);expect(playEgg(p,true,()=>0).ok).toBe(false);expect(claimEgg(p,1).ok).toBe(true);
 });
 it('invalid reward selections do not consume a round or mutate inventory',()=>{
  const p=createMeta();playEgg(p,true,()=>0);for(const choice of [-1,4,1.5,NaN]){const before=JSON.stringify(p);expect(claimEgg(p,choice).ok).toBe(false);expect(JSON.stringify(p)).toBe(before);}
 });
 it('ordinary and festival activities keep independent choices and rounds across reload',()=>{
  const p=createMeta();playEgg(p,false,()=>0);playEgg(p,false,()=>.99,'festegg');claimEgg(p,2,'festegg');const c=parseMeta(p);expect(operationState(c,'egg')).toMatchObject({floor:1,round:0,draws:1});expect(operationState(c,'festegg')).toMatchObject({floor:0,round:1,draws:1});
 });
 it.each(['egg','festegg'])('%s renders pinned final level, scrollable shelves and four reward buttons per level',async id=>{
  const layouts=JSON.parse(readFileSync(new URL('../public/assets/native-operations/layouts-compact.json',import.meta.url),'utf8'));
  vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>layouts}));try{await loadOperationLayouts();const html=operationScreen(createMeta(),id);expect((html.match(/data-op-egg-preview=/g)||[])).toHaveLength(28);expect(html).toContain('egg-scroll');expect(html).toContain('egg-native-final');expect(html).toContain('data-op-egg="claim" disabled');expect(html).toContain(id==='festegg'?'zmzg_dw_wy_02.webp':'zmzg_ndgf_gachamachine.webp');}finally{vi.unstubAllGlobals();}
 });
});
