import {describe,it,expect} from 'vitest';
import {newGame,start,pause,step,movePlayer,plantBomb,useNeedle,blastCells,dangerMap,escapeDirection,
  decideAI,canWalk,restore,serialize,getPlayer,enemiesLeft,stars,EMPTY,WALL,CRATE,FUSE_MS,BLAST_MS,TRAP_MS,indexOf} from '../public/engine.mjs';
function arena(options={}){const g=newGame({seed:8,...options});g.board=g.board.map(v=>v===CRATE?EMPTY:v);g.players.forEach(p=>p.invulnerableUntil=0);start(g);return g;}
function advance(g,ms,inputs={},ai=false){for(let remaining=ms;remaining>0;remaining-=50)step(g,Math.min(50,remaining),inputs,{ai});}
function relocate(p,x,y){Object.assign(p,{x,y,fromX:x,fromY:y,nextMove:0});}
describe('Independent arenas and safe spawn zones',()=>{
 it.each(['pc','mobile'])('generates all thirty valid %s arenas for three difficulty levels',platform=>{
  for(const difficulty of ['easy','normal','hard'])for(let level=1;level<=30;level++){
   const g=newGame({platform,difficulty,level,seed:level});expect(restore(serialize(g),platform)).not.toBeNull();
   for(const p of g.players){expect(g.board[indexOf(g,p.x,p.y)]).toBe(EMPTY);expect(Object.values([[1,0],[-1,0],[0,1],[0,-1]]).filter(([dx,dy])=>g.board[indexOf(g,p.x+dx,p.y+dy)]===EMPTY).length).toBeGreaterThanOrEqual(2);}
   for(const p of g.players)expect(escapeDirection(g,p,{id:-1,owner:p.id,team:p.team,x:p.x,y:p.y,power:p.power,explodeAt:FUSE_MS})).not.toBeNull();
  }
 });
 it('has separate PC/mobile sizes, deterministic maps and local cooperative teams',()=>{
  expect(newGame({seed:12}).board).toEqual(newGame({seed:12}).board);expect(newGame({seed:13}).board).not.toEqual(newGame({seed:12}).board);
  expect(newGame().cols).toBe(13);expect(newGame({platform:'mobile'}).cols).toBe(11);
  const duo=newGame({mode:'duo'});expect(duo.players.filter(p=>p.team===0).map(p=>p.control)).toEqual(['p1','p2']);expect(enemiesLeft(duo)).toBe(2);
  for(const options of [{platform:'other'},{mode:'online'},{platform:'mobile',mode:'duo'},{difficulty:'other'},{level:31},{skin:8}])expect(()=>newGame(options)).toThrow();
 });
 it('does not advance time or accept actions until started, or while paused',()=>{
  const g=newGame(),raw=serialize(g);step(g,50);expect(serialize(g)).toBe(raw);expect(plantBomb(g,'p1')).toBe(false);
  start(g);pause(g);const paused=serialize(g);step(g,50,{p1:{direction:'right',bomb:true}});expect(serialize(g)).toBe(paused);expect(movePlayer(g,'p1','right')).toBe(false);
 });
});
describe('Movement, water bubbles and bounded cross explosions',()=>{
 it('respects grid walls, boxes, players and movement cooldowns',()=>{
  const g=arena(),p=getPlayer(g,'p1');expect(movePlayer(g,'p1','right')).toBe(true);expect(p.x).toBe(2);expect(movePlayer(g,'p1','right')).toBe(false);
  advance(g,200);expect(movePlayer(g,'p1','down')).toBe(false);expect(p.y).toBe(1);
  g.board[indexOf(g,3,1)]=CRATE;expect(movePlayer(g,'p1','right')).toBe(false);g.board[indexOf(g,3,1)]=EMPTY;
  relocate(g.players[1],3,1);expect(movePlayer(g,'p1','right')).toBe(false);expect(canWalk(g,p,-1,1)).toBe(false);
 });
 it('limits bomb inventory, forbids duplicate bubbles and allows leaving but not re-entering',()=>{
  const g=arena();expect(plantBomb(g,'p1')).toBe(true);expect(plantBomb(g,'p1')).toBe(false);
  expect(movePlayer(g,'p1','right')).toBe(true);advance(g,200);expect(movePlayer(g,'p1','left')).toBe(false);expect(plantBomb(g,'p1')).toBe(false);
  getPlayer(g,'p1').capacity=2;expect(plantBomb(g,'p1')).toBe(true);expect(g.bombs).toHaveLength(2);
 });
 it('stops at solid walls and at the first destructible crate',()=>{
  const g=arena();g.board[indexOf(g,7,5)]=CRATE;g.board[indexOf(g,5,4)]=WALL;
  const cells=blastCells(g,{id:8,x:5,y:5,power:3});
  expect(cells).toContain(indexOf(g,7,5));expect(cells).not.toContain(indexOf(g,8,5));expect(cells).not.toContain(indexOf(g,5,4));expect(cells).toContain(indexOf(g,2,5));
  expect(cells.every(i=>i>=0&&i<g.board.length&&g.board[i]!==WALL)).toBe(true);
 });
 it('fires exactly at the fuse deadline, opens boxes and expires water columns',()=>{
  const g=arena(),p=getPlayer(g,'p1');g.board[indexOf(g,3,1)]=CRATE;p.invulnerableUntil=1e8;
  plantBomb(g,'p1');advance(g,FUSE_MS-50);expect(g.bombs).toHaveLength(1);expect(g.board[indexOf(g,3,1)]).toBe(CRATE);
  advance(g,50);expect(g.bombs).toHaveLength(0);expect(g.board[indexOf(g,3,1)]).toBe(EMPTY);expect(g.cratesBroken).toBe(1);expect(g.score).toBe(20);expect(g.blasts).toHaveLength(1);
  advance(g,BLAST_MS);expect(g.blasts).toHaveLength(0);
 });
 it('chain-detonates younger bubbles immediately, with each bubble firing once',()=>{
  const g=arena();g.bombs=[{id:1,owner:'p1',team:0,x:3,y:3,power:3,placedAt:0,explodeAt:100},{id:2,owner:'bot1',team:1,x:5,y:3,power:2,placedAt:0,explodeAt:2400}];g.nextId=3;
  advance(g,100);expect(g.bombs).toHaveLength(0);expect(g.blasts).toHaveLength(2);expect(g.blasts.some(b=>b.cells.includes(indexOf(g,5,5)))).toBe(true);
 });
 it('propagates the earliest chain deadline through the AI danger map',()=>{
  const g=arena();g.bombs=[{id:1,owner:'p1',team:0,x:3,y:3,power:3,placedAt:0,explodeAt:800},{id:2,owner:'bot1',team:1,x:5,y:3,power:2,placedAt:0,explodeAt:2400}];
  expect(dangerMap(g).get(indexOf(g,5,5))).toBe(800);
 });
});
describe('Traps, rescue, pickups and round outcomes',()=>{
 it('traps players for 4.5 seconds and allows one initial needle rescue',()=>{
  const g=arena(),p=getPlayer(g,'p1');plantBomb(g,'p1');advance(g,FUSE_MS);
  expect(p.status).toBe('trapped');expect(useNeedle(g,'p1')).toBe(true);expect(p.status).toBe('active');expect(p.needles).toBe(0);expect(p.invulnerableUntil).toBeGreaterThan(g.clock);
  expect(useNeedle(g,'p1')).toBe(false);advance(g,BLAST_MS);expect(p.status).toBe('active');
 });
 it('expires a trapped player and loses when the human team is eliminated',()=>{
  const g=arena(),p=getPlayer(g,'p1');p.status='trapped';p.trappedAt=0;
  advance(g,TRAP_MS-50);expect(p.status).toBe('trapped');advance(g,50);expect(p.status).toBe('out');expect(g.status).toBe('lost');
 });
 it('protects a shielded player once without trapping, and grants brief immunity',()=>{
  const g=arena(),p=getPlayer(g,'p1');p.shield=1;plantBomb(g,'p1');advance(g,FUSE_MS);
  expect(p.status).toBe('active');expect(p.shield).toBe(0);advance(g,500);expect(p.status).toBe('active');
 });
 it('lets a cooperative teammate touch a trapped friend to rescue for free',()=>{
  const g=arena({mode:'duo'}),p2=getPlayer(g,'p2');relocate(p2,2,1);p2.status='trapped';p2.trappedAt=g.clock;
  expect(movePlayer(g,'p1','right')).toBe(true);expect(p2.status).toBe('active');expect(p2.needles).toBe(1);expect(p2.invulnerableUntil).toBeGreaterThan(g.clock);
 });
 it('pops a trapped opponent on contact and keeps a surviving cooperative teammate in play',()=>{
  const g=arena({mode:'duo'}),bot=getPlayer(g,'bot1');relocate(bot,2,1);bot.status='trapped';expect(movePlayer(g,'p1','right')).toBe(true);expect(bot.status).toBe('out');expect(g.score).toBe(300);
  getPlayer(g,'p1').status='trapped';getPlayer(g,'p1').trappedAt=g.clock;advance(g,TRAP_MS);expect(getPlayer(g,'p1').status).toBe('out');expect(g.status).toBe('running');
 });
 it.each([['capacity',5],['power',5],['speed',3],['needle',3],['shield',2]])('collects %s without exceeding its cap', (type,cap)=>{
  const g=arena(),p=getPlayer(g,'p1'),key=type==='needle'?'needles':type;p[key]=cap;
  g.items=[{id:9,x:2,y:1,type,visibleAt:0}];expect(movePlayer(g,'p1','right')).toBe(true);expect(p[key]).toBe(cap);expect(g.items).toHaveLength(0);expect(g.score).toBe(30);
 });
 it('does not collect invisible drops until the blast has passed',()=>{
  const g=arena(),p=getPlayer(g,'p1');g.items=[{id:9,x:2,y:1,type:'capacity',visibleAt:500}];movePlayer(g,'p1','right');expect(p.capacity).toBe(1);expect(g.items).toHaveLength(1);
  advance(g,500);movePlayer(g,'p1','right');advance(g,200);movePlayer(g,'p1','left');expect(p.capacity).toBe(2);
 });
 it('wins after all AI leave, awards time bonus only once and unlocks a star rating',()=>{
  const g=arena();g.players.filter(p=>p.team===1).forEach(p=>p.status='out');step(g,50,{}, {ai:false});
  expect(g.status).toBe('won');expect(stars(g)).toBe(3);const score=g.score;step(g,50);expect(g.score).toBe(score);expect(restore(serialize(g))).not.toBeNull();
 });
 it('loses at zero time and freezes all subsequent simulation',()=>{
  const g=arena();g.remainingMs=50;step(g,50);expect(g.status).toBe('lost');expect(g.remainingMs).toBe(0);const raw=serialize(g);step(g,50);expect(serialize(g)).toBe(raw);
 });
});
describe('Escape-aware AI and bounded saved state',()=>{
 it('finds a legal escape before placing a water bubble',()=>{
  const g=arena(),p=getPlayer(g,'bot1');relocate(p,3,3);
  const bomb={id:-1,owner:p.id,team:p.team,x:3,y:3,power:2,placedAt:0,explodeAt:FUSE_MS};const dir=escapeDirection(g,p,bomb);
  expect(dir).not.toBeNull();expect(['up','down','left','right']).toContain(dir);
 });
 it('refuses suicidal planting in a corner with no escape corridor',()=>{
  const g=arena(),p=getPlayer(g,'bot1');relocate(p,1,1);g.board[indexOf(g,2,1)]=CRATE;g.board[indexOf(g,1,2)]=CRATE;
  expect(escapeDirection(g,p,{id:-1,owner:p.id,team:1,x:1,y:1,power:2,placedAt:0,explodeAt:FUSE_MS})).toBeNull();
  for(let i=0;i<25;i++)expect(decideAI(g,p).bomb).not.toBe(true);
 });
 it('runs a seeded thirty-second AI simulation without escaping bounds or duplicating bombs',()=>{
  const g=newGame({difficulty:'hard',level:6,seed:199});start(g);getPlayer(g,'p1').invulnerableUntil=1e8;
  advance(g,30000,{},true);expect(g.clock).toBeGreaterThan(0);
  expect(g.cratesBroken).toBeGreaterThan(0);
  for(const p of g.players){expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(g.cols-1);expect(g.board[indexOf(g,p.x,p.y)]).toBe(EMPTY);}
  expect(new Set(g.bombs.map(b=>`${b.x},${b.y}`)).size).toBe(g.bombs.length);expect(restore(serialize(g),'pc')).not.toBeNull();
 });
 it('keeps per-page saves separate and restores dynamic bubbles, blasts and pickups',()=>{
  const g=arena({platform:'mobile'});plantBomb(g,'p1');advance(g,100);pause(g);
  expect(restore(serialize(g),'mobile')).toEqual(g);expect(restore(serialize(g),'pc')).toBeNull();
 });
 it('rejects corrupt terrain, dimensions, players, coordinates, item types and oversized effects',()=>{
  const g=arena();const mutations=[g=>g.board.pop(),g=>g.board[0]=EMPTY,g=>g.players[0].x=99,g=>g.players[0].capacity=99,
   g=>g.players[0].team=1,g=>g.players[0].control='ai',g=>g.clock=Infinity,g=>g.cols=99,g=>g.level=31,g=>g.mode='online',g=>g.status='won',
   g=>g.items=[{id:5,x:1,y:1,type:'other',visibleAt:0}],g=>g.blasts=[{cells:[0],expiresAt:500}],g=>g.bombs=Array(21).fill({})];
  for(const mutate of mutations){const clone=structuredClone(g);mutate(clone);expect(restore(clone)).toBeNull();}
  expect(restore('not json')).toBeNull();
 });
});
