import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CLIENT_STAGES,CLIENT_MONSTERS,CLIENT_VISUALS,CLIENT_SKILLS,CLIENT_ICONS} from '../public/client-data.mjs';
import {clientPlan,clientXp} from '../public/client-campaign.mjs';
import {createGame,start,step,chooseUpgrade,airstrike,togglePause} from '../public/engine.mjs';
import {createMeta,parseMeta,combatStats} from '../public/progression.mjs';
const path=file=>new URL('../public/'+file,import.meta.url);

describe('verified APK client pack',()=>{
 it('has fifty original levels, twenty wave labels and all referenced monsters',()=>{
  expect(CLIENT_STAGES).toHaveLength(50);expect(CLIENT_STAGES.reduce((n,s)=>n+s.waves.length,0)).toBe(2749);
  for(const [i,s] of CLIENT_STAGES.entries()){expect(s.LevelID).toBe(1001+i);expect(new Set(s.waves.map(w=>w.Wave)).size).toBe(20);for(const w of s.waves){expect(w.LevelID).toBe(s.LevelID);expect(w.TriggerType).toBe(1);expect(CLIENT_MONSTERS[w.MonsterID]).toBeTruthy();}}
 });
 it('matches native count-range calculation and native XP table',()=>{const s=CLIENT_STAGES[0],a=clientPlan(s,()=>0),b=clientPlan(s,()=>.999999);for(let i=0;i<a.length;i++){const c=s.waves[i];expect(a[i].total).toBe(Math.trunc(c.MonsterNum*(1-c.MonsterNumRangeRatio)));expect(b[i].total).toBeGreaterThanOrEqual(a[i].total);}expect([clientXp(1),clientXp(2),clientXp(3)]).toEqual([3,5,7]);});
 it('retains fourteen native names/icons and migrates old thirteen-core saves',()=>{expect(CLIENT_SKILLS).toHaveLength(14);expect(Object.keys(CLIENT_ICONS)).toHaveLength(14);const p=createMeta(1);delete p.skills.electric;const migrated=parseMeta(p);expect(migrated.skills.electric.level).toBe(1);expect(migrated.gear).toEqual(p.gear);expect(combatStats(migrated).nativeAttack).toBeGreaterThan(100);});
 it('uses real frame arrays and only existing local assets',()=>{expect(Object.keys(CLIENT_VISUALS)).toHaveLength(44);for(const v of Object.values(CLIENT_VISUALS)){expect(existsSync(path(v.file))).toBe(true);for(const a of Object.values(v.animations))for(const frame of a)expect(v.frames[frame]?.length).toBe(4);}for(const file of Object.values(CLIENT_ICONS))expect(existsSync(path(file))).toBe(true);});
 it('published derivatives match recorded hashes',()=>{const proof=JSON.parse(readFileSync(path('assets/client-v1/provenance.json'),'utf8'));expect(proof.apk_sha256).toBe('7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6');for(const output of proof.outputs){const hash=createHash('sha256').update(readFileSync(path(output.file))).digest('hex');expect(hash).toBe(output.sha256);}const sounds=JSON.parse(readFileSync(path('assets/client-v1/sounds-provenance.json'),'utf8'));for(const output of sounds)expect(createHash('sha256').update(readFileSync(path('assets/client-v1/'+output.file))).digest('hex')).toBe(output.sha256);});
});

describe('client schedule on independent web combat',()=>{
 it('starts original species/count at the original time and pauses every clock',()=>{const g=start(createGame({client:true,extended:true,seed:3}));step(g,.05);expect(g.enemies[0].clientId).toBe(10);expect(g.enemies[0].sourceHp).toBeGreaterThan(0);togglePause(g);const before=JSON.stringify(g);step(g,.05);expect(JSON.stringify(g)).toBe(before);});
 it.each(Array.from({length:50},(_,i)=>i+1))('original schedule stage %i terminates with every planned spawn accounted for',level=>{
  const g=start(createGame({level,client:true,extended:true,seed:level}));for(let i=0;i<22000&&!['won','lost'].includes(g.status);i++){if(g.status==='upgrade')chooseUpgrade(g,g.choices.find(c=>['power','grenade','frost','iceblast','airdrop'].includes(c.id))?.id||g.choices[0].id);if(g.energy>=100)airstrike(g);step(g,1/30);}
  expect(g.status).toBe('won');expect(g.wave).toBe(19);expect(g.spawned).toBe(g.info.count);expect(g.kills).toBe(g.info.count);expect(g.plan.every(p=>p.spawned===p.total)).toBe(true);expect(g.time).toBeLessThan(730);
 });
});
