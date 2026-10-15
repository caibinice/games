import {describe,it,expect} from 'vitest';
import {LEVEL_COUNT,levelInfo,arenaSpec,aiProfile,DIFFICULTIES} from '../public/catalog.mjs';
import {newGame,start,step,decideAI,getPlayer,restore,serialize,EMPTY,CRATE,movementMs,playerPosition} from '../public/engine.mjs';

function threat(seed=1){
  const g=newGame({seed});g.board=g.board.map(v=>v===CRATE?EMPTY:v);g.seed=seed;start(g);
  Object.assign(getPlayer(g,'p1'),{x:9,y:9,fromX:9,fromY:9,invulnerableUntil:1e8});
  const p=getPlayer(g,'bot1');Object.assign(p,{x:2,y:1,fromX:2,fromY:1,invulnerableUntil:0});
  g.players.filter(p=>p.id==='bot2').forEach(p=>p.status='out');
  g.bombs=[{id:1,owner:'p1',team:0,x:1,y:1,power:4,placedAt:0,explodeAt:2400}];g.nextId=2;
  return g;
}
describe('Thirty expanding water parties',()=>{
  it('has six five-round themes, growing maps, richer drops and bounded imperfect AI',()=>{
    expect(LEVEL_COUNT).toBe(30);
    for(const platform of ['pc','mobile'])for(const difficulty of Object.keys(DIFFICULTIES)){
      let area=0,types=0;
      for(let level=1;level<=30;level++){
        const s=arenaSpec(level,platform,difficulty),p=aiProfile(level,difficulty);
        expect(s.cols*s.rows).toBeGreaterThanOrEqual(area);expect(s.itemTypes.length).toBeGreaterThanOrEqual(types);
        expect(s.theme).toBe(Math.floor((level-1)/5));expect(s.seconds).toBeGreaterThanOrEqual(DIFFICULTIES[difficulty].seconds);
        expect(p.mistake).toBeGreaterThanOrEqual(.1);expect(p.mistake).toBeLessThanOrEqual(.35);
        const g=newGame({level,platform,difficulty,mode:platform==='pc'?'duo':'solo',seed:level});
        expect(restore(serialize(g),platform)).toEqual(g);
        area=s.cols*s.rows;types=s.itemTypes.length;
      }
      expect(area).toBeGreaterThan(arenaSpec(1,platform,difficulty).cols*11);expect(types).toBe(5);
    }
    expect(levelInfo(30).theme).toBe(5);expect(()=>levelInfo(31)).toThrow();
  });
  it('preserves v1 arenas, linear in-flight motion, scores and timing on repeated restore',()=>{
    for(const platform of ['pc','mobile']){
      const g=newGame({platform,level:1,seed:9});g.version=1;g.level=12;delete g.motionVersion;
      g.status='paused';g.clock=50;g.score=1234;
      for(const p of g.players){p.moveMs=p.control==='ai'?285:125;delete p.reactAt;delete p.threatUntil;}
      // Old level 12 has three opponents. Use a valid old corner actor.
      const third=structuredClone(g.players[2]);Object.assign(third,{id:'bot3',x:1,y:9,fromX:1,fromY:9});g.players.push(third);
      const p=g.players[0];Object.assign(p,{x:2,fromX:1,movedAt:0,nextMove:125});
      const fixed=restore(serialize(g),platform);expect(fixed).not.toBeNull();
      expect(fixed.board).toEqual(g.board);expect(fixed.score).toBe(1234);expect(fixed.players).toHaveLength(4);
      expect(fixed.players[0].moveMs).toBe(165);expect(playerPosition(fixed,fixed.players[0]).progress).toBeCloseTo(.4);
      expect(restore(serialize(fixed),platform)).toEqual(fixed);
    }
  });
  it('keeps upgraded humans and bots within a controllable pace',()=>{
    for(const difficulty of Object.keys(DIFFICULTIES))for(const level of [1,15,30]){
      const g=newGame({difficulty,level}),human=g.players[0],bot=g.players[1];human.speed=bot.speed=3;
      expect(movementMs(human)).toBe(115);expect(movementMs(bot)).toBeGreaterThanOrEqual(180);
    }
  });
  it('migrates the original eased AI motion exactly once, including upgraded shoes',()=>{
    const g=newGame({seed:9});g.version=1;delete g.motionVersion;g.clock=100;g.status='paused';
    g.players[0].moveMs=190;
    const bot=g.players[1];Object.assign(bot,{x:10,y:9,fromX:11,fromY:9,movedAt:0,nextMove:221,speed:3});
    const fixed=restore(serialize(g));expect(fixed).not.toBeNull();
    const progress=100/(221*.72);
    expect(playerPosition(fixed,fixed.players[1]).progress).toBeCloseTo(progress*(2-progress));
    expect(restore(serialize(fixed))).toEqual(fixed);
    g.level=13;expect(restore(serialize(g))).toBeNull();
  });
});
describe('Fallible but purposeful opponents',()=>{
  it('rolls once for a threat rather than rolling every tick, and saves its reaction window',()=>{
    const g=threat(3),p=g.players[1];decideAI(g,p);
    const seed=g.seed,react=p.reactAt;expect(react).toBeGreaterThan(g.clock);
    g.clock+=80;decideAI(g,p);expect(p.reactAt).toBe(react);expect(g.seed).toBe(seed);
    expect(restore(serialize(g)).players[1].reactAt).toBe(react);
  });
  it('can be caught in a bomb corridor, while most seeded opponents still escape',()=>{
    let caught=0;
    for(let seed=1;seed<=100;seed++){
      const g=threat(seed);for(let t=0;t<2700;t+=10)step(g,10);
      if(g.players[1].status!=='active')caught++;
    }
    expect(caught).toBeGreaterThanOrEqual(12);expect(caught).toBeLessThanOrEqual(42);
  });
  it('is deterministic for replay, not dependent on wall-clock luck',()=>{
    const a=threat(42),b=threat(42);
    for(let i=0;i<270;i++){step(a,10);step(b,10);}expect(serialize(a)).toBe(serialize(b));
  });
});
