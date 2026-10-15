import './dom-fixture.mjs';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {newGame,start,pause,step,serialize,restore,view,summary,stages,parseStage,LEVEL_COUNT,TICK_MS} from '../public/engine.mjs';
const tick=(g,n=1,cmd={})=>{for(let i=0;i<n;i++)step(g,TICK_MS,cmd);};
describe('Single-player 35-stage cartridge adapter',()=>{
 it('keeps all twelve pinned sound samples unchanged',()=>{const rows=JSON.parse(readFileSync(new URL('../docs/audio-sources.json',import.meta.url)));expect(rows).toHaveLength(12);for(const r of rows)expect(createHash('sha256').update(readFileSync(new URL('../'+r.file,import.meta.url))).digest('hex')).toBe(r.sha256);});
 it.each(Array.from({length:35},(_,i)=>i+1))('stage %i enters combat with one human and twenty enemies',level=>{
  expect(LEVEL_COUNT).toBe(35);const g=newGame({level,seed:123});start(g);tick(g,180);const s=g.session.scene;expect(g.session.players).toHaveLength(1);expect(g.session.phase).toBe('playing');expect(s.remainingBotCount+s.tanks.filter(t=>t.side==='bot').length+s.flickers.filter(f=>f.tank.side==='bot').length).toBe(20);expect(s.tanks.filter(t=>t.side==='player')).toHaveLength(1);expect(g.lives).toBe(3);expect(stages[level-1]).toBeTruthy();expect(parseStage(stages[level-1])).toBeTruthy();
 });
 it('fire/movement respond to held input and pause clears input',()=>{
  const g=newGame({seed:7});start(g);tick(g,180);g.session.scene.map.bricks.fill(false);g.session.scene.map.steels.fill(false);const before=view(g);tick(g,10,{up:true,fire:true,order:['up','fire']});expect(view(g).y).toBeLessThan(before.y);expect(view(g).projectiles).toBeGreaterThan(0);pause(g);const clock=g.clock;tick(g,30,{left:true});expect(g.clock).toBe(clock);expect(summary(g).phase).toBe('playing');start(g);tick(g);expect(g.clock).toBeGreaterThan(clock);
 });
 it('stores a stage checkpoint, not opaque upstream objects or keyboard state',()=>{
  const g=newGame({level:35,seed:42,platform:'mobile'});start(g);tick(g,180,{fire:true});const raw=serialize(g),r=restore(raw,'mobile');expect(r.level).toBe(35);expect(r.status).toBe('ready');expect(r.clock).toBe(0);expect(raw).not.toContain('session');expect(restore(raw,'pc')).toBeNull();
 });
 it('rejects invalid or stale saved options',()=>{for(const options of [{level:0},{level:36},{mode:'coop'},{platform:'tv'}])expect(()=>newGame(options)).toThrow();expect(restore('{bad')).toBeNull();expect(restore({version:2})).toBeNull();});
});
