import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {CAMPAIGN_ENTRIES,ELITE_ENTRIES,EXTRA_MONSTERS,EXTRA_VISUALS} from '../public/client-expanded.mjs';
import {CAMPAIGN_LEVEL_COUNT} from '../public/campaign-limits.mjs';
import {createGame,start,step,chooseUpgrade,airstrike} from '../public/engine.mjs';
import {createMeta,parseMeta,claimStage} from '../public/progression.mjs';
import {defaultProfile,parseProfile,recordWin} from '../public/profile.mjs';
import {applyCheats,parseCheats,grantGuildReward} from '../public/cheats.mjs';
const cached=new Map(),path=f=>new URL('../public/'+f,import.meta.url),json=f=>{if(!cached.has(f))cached.set(f,JSON.parse(readFileSync(path(f),'utf8')));return cached.get(f);};
const stage=entry=>{const d=json(entry.file)[entry.LevelID];return {...d,waves:d.waveRows.map(row=>Object.fromEntries(d.waveFields.map((k,i)=>[k,row[i]])))};};

describe('complete reference campaign and permanent activities',()=>{
 it('derives 259 normal and 259 elite levels, with no missing battle data',()=>{expect(CAMPAIGN_LEVEL_COUNT).toBe(259);expect(CAMPAIGN_ENTRIES).toHaveLength(259);expect(ELITE_ENTRIES).toHaveLength(259);for(const [i,e] of CAMPAIGN_ENTRIES.entries())expect(e.LevelID).toBe(1001+i);for(const [i,e] of ELITE_ENTRIES.entries())expect(e.LevelID).toBe(2001+i);});
 it.each([...CAMPAIGN_ENTRIES,...ELITE_ENTRIES])('$LevelID has native waves and resolves every original monster',entry=>{const d=stage(entry);expect(d.waves.length).toBeGreaterThan(0);expect(new Set(d.waves.map(w=>w.Wave)).size).toBe(20);expect(d.waves.every(w=>w.LevelID===entry.LevelID&&w.TriggerType===1&&EXTRA_MONSTERS[w.MonsterID])).toBe(true);});
 it('keeps the full activity catalog always available without weekday gates',()=>{const activities=json('assets/client-campaign/activities.json');expect(activities).toHaveLength(5736);expect(activities.filter(a=>a.available)).toHaveLength(5716);expect(new Set(activities.map(a=>a.LevelType)).size).toBeGreaterThan(20);for(const a of activities)if(a.available){const d=json(a.file)[a.LevelID];expect(d.LevelID).toBe(a.LevelID);expect(d.waveRows.length).toBeGreaterThan(0);}for(const a of Object.values(EXTRA_VISUALS))expect(existsSync(path(a.file))).toBe(true);});
 it.each([51,100,150,200,259])('late campaign %i runs with optional invincibility and firepower, no missing-spawn stall',level=>{for(const entry of [CAMPAIGN_ENTRIES[level-1],ELITE_ENTRIES[level-1]]){const d=stage(entry),g=start(createGame({level,client:true,extended:true,clientStageData:d,seed:level,cheats:{invincible:true,firepower:true}}));for(let i=0;i<24000&&!['won','lost'].includes(g.status);i++){if(g.status==='upgrade')chooseUpgrade(g,g.choices[0].id);if(g.energy>=100)airstrike(g);step(g,1/30);}expect(g.status).toBe('won');expect(g.wave).toBe(19);expect(g.spawned).toBe(g.info.count);}});
 it('old saves migrate past level fifty and late-stage rewards persist',()=>{const p=parseProfile({...defaultProfile(),unlocked:259,selected:259,stars:{50:3,258:2,260:3}});expect(p.selected).toBe(259);expect(p.stars[258]).toBe(2);expect(p.stars[260]).toBeUndefined();const m=createMeta();m.bestHealth[259]=100;expect(claimStage(m,259,2)).toBeTruthy();expect(parseMeta(m).stageClaims[259]).toBe(4);const g={status:'won',settled:false,info:{level:50,reward:1},hp:1,maxHp:1,score:1};const q=defaultProfile();recordWin(q,g);expect(q.unlocked).toBe(51);});
});
describe('game-only play controls',()=>{
 it('resources remain unlimited across spending and save boundaries',()=>{const m=createMeta(),p=defaultProfile();m.cheats=parseCheats({gold:true,diamonds:true,energy:true,unlockAll:true,unknown:true});applyCheats(m,p);expect(m.gold).toBe(1e9);expect(m.diamonds).toBe(1e9);m.gold-=999999;applyCheats(m,p);expect(m.gold).toBe(1e9);expect(p.unlocked).toBe(259);expect(m.cheats.unknown).toBeUndefined();expect(parseMeta(m).cheats.gold).toBe(true);});
 it('guild rewards accept only bounded positive game currency',()=>{const m=createMeta(),p=defaultProfile(),before=m.gold;grantGuildReward(m,{gold:10000,diamonds:100,enterpriseBalance:99});expect(m.gold).toBe(before+10000);expect(m.diamonds).toBe(10100);grantGuildReward(m,{gold:Infinity,diamonds:-1});expect(m.diamonds).toBe(10100);expect(p).toEqual(defaultProfile());});
 it('activity wins do not consume campaign claim slots',()=>{const m=createMeta();m.activityWins[90001]=4;expect(parseMeta(m).activityWins[90001]).toBe(4);expect(m.bestHealth).toEqual({});});
});
