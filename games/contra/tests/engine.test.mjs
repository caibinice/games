import {describe,it,expect} from 'vitest';
import {newGame,start,pause,step,fire,damagePlayer,serialize,restore,snapshot,STAGES,LEVEL_COUNT,TICK_MS,WEAPONS,JUMP_SPEED,GRAVITY,RUN_SPEED} from '../public/engine.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const tick=(g,n=1,cmd={})=>{for(let i=0;i<n;i++)step(g,TICK_MS,cmd);return g;};
function play(level=1,options={}){const g=newGame({level,seed:123,...options});start(g);g.spawned=[];g.nextRunner=g.nextCapsule=1e9;g.player.invulnerableUntil=1e9;return g;}
describe('Contra single-player campaign',()=>{
 it('offers eight distinct stages, side/base/vertical modes and all classic weapons',()=>{
  expect(LEVEL_COUNT).toBe(8);expect(STAGES.map(s=>s.kind)).toEqual(['side','base','vertical','base','side','side','side','side']);
  expect(Object.keys(WEAPONS)).toEqual(['N','M','S','L','F']);expect(STAGES[1].rooms).toBe(6);expect(STAGES[3].rooms).toBe(9);
 });
 it.each(Array.from({length:8},(_,i)=>i+1))('stage %i has a traversable platform route to its boss',level=>{
  const g=newGame({level});const s=g.stage;if(s.kind==='base')return;
  const platforms=[...s.platforms,...g.movingPlatforms],seen=new Set(),queue=[];
  platforms.forEach((p,i)=>{if(g.player.x+6>p.x&&g.player.x-6<p.x+p.w&&Math.abs(g.player.y-p.y)<1){seen.add(i);queue.push(i);}});
  while(queue.length){const p=platforms[queue.shift()];platforms.forEach((q,j)=>{if(seen.has(j)||q.y-p.y>180)return;
   const d=JUMP_SPEED**2+2*GRAVITY*(q.y-p.y);if(d<0)return;
   const gap=Math.max(0,q.x-(p.x+p.w),p.x-(q.x+q.w));const air=(JUMP_SPEED+Math.sqrt(d))/GRAVITY;
   if(gap<=RUN_SPEED*air+10){seen.add(j);queue.push(j);}
  });}
  expect([...seen].some(i=>s.kind==='vertical'?platforms[i].y<=224:platforms[i].x+platforms[i].w>s.width-120)).toBe(true);
 });
 it.each(['pc','mobile'])('restores all eight %s stages with immutable authoritative maps',platform=>{
  for(let level=1;level<=8;level++){const g=play(level,{platform});tick(g,20,{fire:true});const saved=serialize(g),r=restore(saved,platform);expect(r).toBeTruthy();expect(r.stage).toBe(STAGES[level-1]);expect(snapshot(r)).toEqual(snapshot(g));expect(restore(saved,platform==='pc'?'mobile':'pc')).toBeNull();}
 });
 it('moves immediately at 90 native pixels/second and preserves facing',()=>{const g=play();tick(g,10,{right:true});expect(g.player.x).toBeCloseTo(47);expect(g.player.dir).toBe(1);tick(g,4,{left:true});expect(g.player.x).toBeCloseTo(41);expect(g.player.dir).toBe(-1);});
 it('jumps immediately, cannot double jump and short release cuts the jump',()=>{
  const g=play(),y=g.player.y;tick(g,1,{jump:true});expect(g.player.y).toBeLessThan(y);expect(g.player.vy).toBeLessThan(-300);
  tick(g,1,{});tick(g,1,{jump:true});expect(g.player.vy).toBeGreaterThan(-340);
  tick(g,20,{});const short=g.player.y;const held=play();tick(held,23,{jump:true});expect(held.player.y).toBeLessThan(short-10);
 });
 it('supports prone collision and eight-way normalized shots',()=>{
  const g=play();tick(g,1,{down:true,fire:true});expect(g.player.h).toBe(11);expect(g.player.prone).toBe(true);expect(g.bullets[0].vy).toBe(0);
  for(const cmd of [{up:true},{right:true,up:true},{left:true},{left:true,down:true}]){g.bullets=[];g.player.lastFire=-1000;g.player.onGround=false;expect(fire(g,cmd)).toBe(true);expect(Math.hypot(g.bullets[0].vx,g.bullets[0].vy)).toBeCloseTo(WEAPONS.N.speed);}
 });
 it.each(Object.keys(WEAPONS))('%s respects cooldown and simultaneous projectile cap',weapon=>{
  const g=play();g.player.weapon=weapon;expect(fire(g,{right:true})).toBe(true);expect(fire(g,{right:true})).toBe(false);
  const count=weapon==='S'?5:1;expect(g.bullets).toHaveLength(count);
  while(g.bullets.length+count<=WEAPONS[weapon].limit){g.clock+=1000;expect(fire(g,{right:true})).toBe(true);}
  g.clock+=1000;expect(fire(g,{right:true})).toBe(false);expect(g.bullets.length).toBeLessThanOrEqual(WEAPONS[weapon].limit);
 });
 it('a normal bullet hits only one overlapping enemy; laser pierces separate enemies',()=>{
  for(const weapon of ['N','L']){const g=play();g.capsules=[];g.player.weapon=weapon;
   g.enemies=[1,2].map(id=>({id,x:60,y:96,w:12,h:28,hp:1,type:'turret',lastFire:1e9,phase:0}));
   fire(g,{right:true});tick(g,7);expect(g.enemies.length).toBe(weapon==='L'?0:1);expect(g.score).toBe(weapon==='L'?1000:500);
  }
 });
 it('shoots open the first capsule and collects S without delay',()=>{
  const g=play();g.capsules[0].x=50;g.capsules[0].y=77;fire(g,{right:true});tick(g,3);expect(g.capsules).toHaveLength(0);expect(g.pickups[0].type).toBe('S');
  g.player.x=g.pickups[0].x;g.player.y=g.pickups[0].y+5;tick(g);expect(g.player.weapon).toBe('S');expect(g.score).toBe(500);
 });
 it('bridge explosion removes the real landing surface and water permits swimming',()=>{
  const g=play(),b=g.bridges[0];g.player.x=b.x-20;tick(g,35);expect(b.broken).toBe(true);
  const w=g.stage.water[0];g.player.x=w.x+w.w/2;g.player.y=w.y+6;g.player.vy=100;g.player.onGround=false;tick(g,10);expect(g.player.water).toBe(true);const x=g.player.x;tick(g,3,{right:true});expect(g.player.x-x).toBeCloseTo(55*3/60);
 });
 it('carries the player on the moving waterfall stepping stone',()=>{
  const g=play(3),p=g.movingPlatforms[0];Object.assign(g.player,{x:p.x+16,y:p.y,onGround:true,support:p.id});const before=g.player.x;tick(g,20);expect(g.player.x).toBeGreaterThan(before);expect(g.player.y).toBe(p.y);
 });
 it.each([2,4])('base %i requires live core destruction before moving to the next room',level=>{
  const g=play(level);tick(g,50,{up:true});expect(g.room).toBe(0);expect(g.roomOpen).toBe(false);
  for(const c of g.cores)c.hp=0;tick(g,44,{up:true});expect(g.room).toBe(1);expect(g.cores.some(c=>c.hp>0)).toBe(true);
  tick(g,1,{down:true});expect(g.player.prone).toBe(true);g.player.lastFire=-1000;g.bullets=[];fire(g,{right:true});expect(g.bullets[0].vx).toBeCloseTo(0);expect(g.bullets[0].vy).toBeLessThan(0);
 });
 it.each(Array.from({length:8},(_,i)=>i+1))('stage %i has a damageable boss and a single delayed stage-clear event',level=>{
  const g=play(level);if(g.kind==='base'){g.room=g.stage.rooms-2;for(const c of g.cores)c.hp=0;tick(g,44,{up:true});}
  else if(g.kind==='vertical'){g.player.y=210;g.player.x=128;g.cameraY=0;tick(g);}
  else{g.player.x=g.stage.width-150;tick(g);}
  expect(g.bossActive).toBe(true);expect(g.boss.hp).toBeGreaterThan(0);g.boss.hp=1;g.enemies=[];g.capsules=[];g.cores=[];
  const b=g.boss;g.bullets=[{id:999,x:b.x,y:b.y-b.h/2,vx:0,vy:0,ttl:1000,weapon:'N',damage:1,hitIds:[]}];tick(g);expect(b.hp).toBe(0);expect(g.bossDefeatedAt).toBeGreaterThan(0);expect(g.status).toBe('running');
  for(let i=0;i<112&&g.status==='running';i++)tick(g);expect(g.status).toBe('won');expect(g.events.filter(e=>e.type==='won')).toHaveLength(1);expect(restore(serialize(g),'pc')).toBeTruthy();const score=g.score;tick(g,60,{fire:true});expect(g.score).toBe(score);
 });
 it('death deducts once, respawns with shield and resets weapon; last death loses',()=>{
  const g=play();g.player.weapon='S';g.player.invulnerableUntil=0;damagePlayer(g);damagePlayer(g);expect(g.lives).toBe(2);tick(g,55);expect(g.player.weapon).toBe('N');expect(g.player.invulnerableUntil).toBeGreaterThan(g.clock);damagePlayer(g);expect(g.lives).toBe(2);
  g.lives=1;g.player.invulnerableUntil=0;damagePlayer(g);tick(g,55);expect(g.status).toBe('lost');expect(g.lives).toBe(0);
 });
 it('pause freezes simulation and seeded runs are deterministic',()=>{
  const a=play(),b=play();for(let i=0;i<180;i++){const c={right:i<40,fire:true,jump:i<16};tick(a,1,c);tick(b,1,c);}expect(serialize(a)).toBe(serialize(b));pause(a);const before=snapshot(a);tick(a,60,{fire:true});expect(snapshot(a)).toEqual(before);start(a);tick(a);expect(a.clock).toBeGreaterThan(before.clock);
 });
 it('does not award an extra life twice when carrying score to the next stage',()=>{const g=play(5,{carry:{score:40000,lives:4,weapon:'S'}});tick(g);expect(g.lives).toBe(4);expect(g.nextLife).toBe(100000);});
 it('rejects malformed and mismatched saves/options',()=>{
  for(const patch of [{version:2},{level:9},{mode:'coop'},{lives:-1},{lives:Infinity},{room:99},{cameraX:1e8},{bullets:null},{status:'won'},{player:{weapon:'bad'}}])expect(restore(JSON.stringify({...newGame(),...patch}),'pc')).toBeNull();
  for(const options of [{level:0},{level:9},{platform:'watch'},{mode:'coop'}])expect(()=>newGame(options)).toThrow();
 });
});
describe('Original local media integrity',()=>{
 it('keeps included original background and SFX bytes unchanged',()=>{
  const rows=JSON.parse(readFileSync(new URL('../docs/asset-sources.json',import.meta.url),'utf8')).filter(r=>r.file&&r.included);expect(rows.length).toBeGreaterThanOrEqual(17);
  for(const row of rows){const bytes=readFileSync(new URL('../public/'+row.file,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);}
 });
 it('includes all seven unmodified NES recordings with tracked SHA256',()=>{
  const rows=JSON.parse(readFileSync(new URL('../docs/bgm-sources.json',import.meta.url),'utf8'));expect(rows).toHaveLength(7);
  for(const row of rows){const bytes=readFileSync(new URL('../'+row.file,import.meta.url));expect(bytes.subarray(0,4).toString()).toBe('OggS');expect(bytes.length).toBe(row.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);}
 });
 it('has eight original backgrounds and a bounds-checked 186-sprite local atlas',()=>{
  const rects=JSON.parse(readFileSync(new URL('../public/assets/sprites.json',import.meta.url)));expect(Object.keys(rects)).toHaveLength(186);
  for(const r of Object.values(rects)){expect(r.x+r.w).toBeLessThanOrEqual(1280);expect(r.y+r.h).toBeLessThanOrEqual(960);expect(r.w*r.h).toBeGreaterThan(0);}
  for(let i=1;i<=8;i++)expect(existsSync(new URL(`../public/assets/backgrounds/stage-${i}.png`,import.meta.url))).toBe(true);
 });
});
