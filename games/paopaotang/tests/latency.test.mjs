import {describe,it,expect} from 'vitest';
import {newGame,start,pause,step,applyInput,movePlayer,getPlayer,playerPosition,movementMs,
  dangerMap,serialize,restore,indexOf,EMPTY,CRATE,DAMAGE_MS,BLAST_MS,HUMAN_MOVE_MS,SIMULATION_MS,FUSE_MS} from '../public/engine.mjs';
function arena(){const g=newGame({seed:9});g.board=g.board.map(v=>v===CRATE?EMPTY:v);g.players.forEach(p=>p.invulnerableUntil=0);start(g);return g;}
function tick(g,ms){for(let left=ms;left>0;left-=SIMULATION_MS)step(g,Math.min(left,SIMULATION_MS),{},{ai:false});}
function water(g,cell){g.blasts=[{id:1,cells:[cell],owner:'bot1',team:1,bornAt:0,damageUntil:DAMAGE_MS,expiresAt:BLAST_MS}];}
describe('Immediate input and smooth movement',()=>{
 it('moves and plants on the input call without waiting for a simulation tick',()=>{
  const g=arena(),p=getPlayer(g,'p1');
  const result=applyInput(g,'p1',{direction:'right',bomb:true});
  expect(result).toEqual({moved:true,bomb:true,needle:false});expect(g.clock).toBe(0);
  expect(p.x).toBe(2);expect(g.bombs[0]).toMatchObject({x:1,y:1,explodeAt:FUSE_MS});
 });
 it('has a 10ms simulation quantum and a faster human movement interval',()=>{
  const g=arena(),p=getPlayer(g,'p1');expect(SIMULATION_MS).toBe(10);expect(HUMAN_MOVE_MS).toBe(125);
  expect(movementMs(p)).toBe(125);p.speed=2;expect(movementMs(p)).toBe(100);p.speed=3;expect(movementMs(p)).toBe(75);
  expect(getPlayer(g,'bot1').moveMs).toBe(285);
 });
 it('uses a linear position for the entire tile rather than stopping between eased hops',()=>{
  const g=arena(),p=getPlayer(g,'p1');applyInput(g,'p1',{direction:'right'});
  expect(playerPosition(g,p,0)).toMatchObject({x:1,y:1,progress:0});
  expect(playerPosition(g,p,62.5)).toMatchObject({x:1.5,y:1,progress:.5});
  expect(playerPosition(g,p,125)).toMatchObject({x:2,y:1,progress:1});
  expect(playerPosition(g,p,150).x).toBe(2);
 });
 it('does not execute direct input while paused or after the round ends',()=>{
  const g=arena();pause(g);const raw=serialize(g);
  expect(applyInput(g,'p1',{direction:'right',bomb:true})).toEqual({moved:false,bomb:false,needle:false});expect(serialize(g)).toBe(raw);
 });
});
describe('Short, visible collision window',()=>{
 it('does not hit the reserved destination before the visible character centre gets there',()=>{
  const g=arena(),p=getPlayer(g,'p1');water(g,indexOf(g,2,1));
  expect(movePlayer(g,'p1','right')).toBe(true);expect(p.status).toBe('active');
  tick(g,50);expect(playerPosition(g,p).x).toBeCloseTo(1.4);expect(p.status).toBe('active');
  tick(g,20);expect(p.status).toBe('trapped');expect(p.trappedAt).toBe(70);
 });
 it('lets a player cross the fading water after 220ms, before the visual trail disappears',()=>{
  const g=arena(),p=getPlayer(g,'p1');water(g,indexOf(g,2,1));
  tick(g,DAMAGE_MS);expect(g.blasts).toHaveLength(1);expect(dangerMap(g).has(indexOf(g,2,1))).toBe(false);
  expect(movePlayer(g,'p1','right')).toBe(true);tick(g,100);
  expect(playerPosition(g,p).x).toBeGreaterThan(1.5);expect(p.status).toBe('active');expect(g.blasts).toHaveLength(1);
  tick(g,BLAST_MS-DAMAGE_MS-100);expect(g.blasts).toHaveLength(0);expect(p.status).toBe('active');
 });
 it('still catches someone who enters the solid water during the active interval',()=>{
  const g=arena(),p=getPlayer(g,'p1');water(g,indexOf(g,2,1));
  tick(g,100);movePlayer(g,'p1','right');tick(g,70);expect(p.status).toBe('trapped');
 });
 it('migrates legacy speed and 650ms blasts while preserving the round',()=>{
  const g=arena(),p=getPlayer(g,'p1');g.clock=300;g.remainingMs-=300;p.moveMs=190;p.movedAt=250;p.nextMove=440;
  g.blasts=[{id:5,cells:[indexOf(g,4,1)],owner:'bot1',team:1,expiresAt:650}];delete p.nextThink;pause(g);
  const restored=restore(serialize(g),'pc');expect(restored).not.toBeNull();
  expect(restored.players[0].moveMs).toBe(125);expect(restored.players[0].nextMove).toBeLessThan(440);
  const oldProgress=50/(190*.72);
  expect((restored.clock-restored.players[0].movedAt)/movementMs(restored.players[0])).toBeCloseTo(oldProgress*(2-oldProgress));
  expect(restored.blasts[0]).toMatchObject({bornAt:0,damageUntil:220,expiresAt:360});
  expect(dangerMap(restored).has(indexOf(g,4,1))).toBe(false);
  expect(restored.board).toEqual(g.board);expect(restored.remainingMs).toBe(g.remainingMs);
  g.clock=400;expect(restore(serialize(g),'pc').blasts).toHaveLength(0);
 });
});
