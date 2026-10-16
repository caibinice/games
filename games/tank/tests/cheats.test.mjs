import {describe,it,expect} from 'vitest';
import {newGame,start,pause,step,TICK_MS,setCheat,isAssisted,serialize,restore,spawnRandomPowerUp,Bullet,CHEAT_OPTIONS} from '../public/engine.mjs';
const tick=(g,n=1,command={})=>{for(let i=0;i<n;i++)step(g,TICK_MS,command);};
function battle(){const g=newGame({seed:312});start(g);tick(g,180);g.session.scene.botFreezeTicks=1e8;return g;}
function hit(g){const s=g.session.scene,t=s.tanks.find(t=>t.side==='player'&&t.alive);expect(t).toBeTruthy();t.helmetDuration=0;s.bullets.length=0;s.bullets.push(new Bullet({side:'bot',tankId:99999,x:t.x+6,y:t.y-4,direction:'down',speed:180,power:1}));tick(g,4);expect(s.tanks.some(t=>t.side==='player'&&t.alive)).toBe(false);}
describe('Optional Tank cheats',()=>{
 it('defaults to classic and rejects unknown/nonboolean options',()=>{const g=newGame({cheats:{rapidFire:'true',unknown:true}});expect(Object.values(g.cheats).some(Boolean)).toBe(false);expect(isAssisted(g)).toBe(false);expect(setCheat(g,'unknown',true)).toBe(false);expect(setCheat(g,'rapidFire',1)).toBe(false);});
 it('refunds actual enemy-bullet deaths indefinitely, but switching off restores finite lives',()=>{
  const g=battle();g.session.players[0].lives=0;setCheat(g,'infiniteLives',true);
  for(let i=0;i<4;i++){hit(g);tick(g,100);expect(g.session.phase).toBe('playing');expect(g.session.scene.status).toBe('playing');expect(g.session.scene.tanks.some(t=>t.side==='player'&&t.alive)).toBe(true);expect(g.lives).toBe(1);}
  setCheat(g,'infiniteLives',false);hit(g);tick(g,100);expect(g.session.scene.loseReason).toBe('dead');
 });
 it('unlimited tanks do not protect the eagle or resurrect an ended round',()=>{const g=battle();setCheat(g,'infiniteLives',true);g.session.scene.map.eagleBroken=true;tick(g);expect(g.session.scene.status).toBe('lost');expect(g.session.scene.loseReason).toBe('eagle');});
 it('rapid fire is faster, capped at eight and reverts after disabling',()=>{
  const totals=[];for(const enabled of [false,true]){const g=battle(),s=g.session.scene;s.map.bricks.fill(false);s.map.steels.fill(false);s.map.eagle=null;s.tanks.find(t=>t.side==='player').direction='up';setCheat(g,'rapidFire',enabled);let shots=0,max=0;
   for(let i=0;i<120;i++){tick(g,1,{fire:true});shots+=g.events.filter(e=>e.name==='bullet_shot').length;max=Math.max(max,s.bullets.filter(b=>b.side==='player').length);}
   totals.push(shots);expect(max).toBeLessThanOrEqual(enabled?8:1);if(enabled){setCheat(g,'rapidFire',false);tick(g);expect(s.tanks.find(t=>t.side==='player').rapidFire).toBe(false);}
  }expect(totals[1]).toBeGreaterThan(totals[0]*3);
 });
 it.each([1,10,20,35])('stage %i generates real collectible items only on nearby walkable cells',level=>{
  const g=newGame({level,seed:14});expect(spawnRandomPowerUp(g)).toBeNull();expect(isAssisted(g)).toBe(false);start(g);tick(g,180);pause(g);
  for(let i=0;i<12;i++)expect(['tank','star','grenade','timer','helmet','shovel']).toContain(spawnRandomPowerUp(g));
  const s=g.session.scene;expect(s.powerUps.length).toBeLessThanOrEqual(6);for(const p of s.powerUps){const rect={x:p.x,y:p.y,width:16,height:16};expect(s.map.collideBrick(rect,-.01)).toBe(false);expect(s.map.collideSteel(rect,-.01)).toBe(false);expect(s.map.collideRiver(rect,-.01)).toBe(false);}
  expect(isAssisted(g)).toBe(true);const item=s.powerUps.at(-1),t=s.tanks.find(t=>t.side==='player');s.powerUps.splice(0,s.powerUps.length,item);Object.assign(t,{x:item.x,y:item.y,rx:item.x,ry:item.y});start(g);tick(g);expect(item.dead).toBe(true);expect(g.events.some(e=>e.name==='powerup_pick')).toBe(true);
 });
 it('auto drops use simulation time, stop during pause and do not grow without bound',()=>{const g=battle();setCheat(g,'autoPowerUps',true);tick(g,481);expect(g.session.scene.powerUps.length).toBeGreaterThan(0);pause(g);const time=g.clock,count=g.session.scene.powerUps.length;tick(g,600);expect(g.clock).toBe(time);expect(g.session.scene.powerUps.length).toBe(count);start(g);tick(g,500);expect(g.session.scene.powerUps.length).toBeGreaterThan(0);expect(g.session.scene.powerUps.length).toBeLessThanOrEqual(6);});
 it('persists options and sticky assisted attribution through checkpoint restore',()=>{const g=battle();for(const o of CHEAT_OPTIONS)setCheat(g,o.key,true);const r=restore(serialize(g),'pc');expect(r.cheats).toEqual(g.cheats);expect(isAssisted(r)).toBe(true);for(const o of CHEAT_OPTIONS)setCheat(r,o.key,false);expect(isAssisted(r)).toBe(true);expect(restore(serialize(r),'pc').assisted).toBe(true);expect(newGame({cheats:r.cheats}).assisted).toBe(false);});
 it('migrates the original v1 checkpoint without changing level or enabling cheats',()=>{const g=restore(JSON.stringify({version:1,level:35,seed:15,platform:'mobile',mode:'classic',status:'ready'}),'mobile');expect(g.level).toBe(35);expect(Object.values(g.cheats).some(Boolean)).toBe(false);expect(isAssisted(g)).toBe(false);});
});
