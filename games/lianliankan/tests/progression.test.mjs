import {describe,it,expect} from 'vitest';
import {newGame,levelSpec,LEVEL_COUNT,DIFFICULTIES,generateBoard,findPath,restore,serialize} from '../public/engine.mjs';

describe('Thirty growing orchards',()=>{
  for(const platform of ['pc','mobile'])for(const difficulty of Object.keys(DIFFICULTIES)){
    it(`${platform}/${difficulty}: grows area and varieties with solvable boards in all 30 rounds`,()=>{
      let area=0,fruits=0;
      for(let level=1;level<=LEVEL_COUNT;level++){
        const spec=levelSpec(level,platform,difficulty),g=newGame({platform,difficulty,level,seed:100+level});
        expect(g.cols*g.rows).toBeGreaterThanOrEqual(area);expect(spec.fruits).toBeGreaterThanOrEqual(fruits);
        expect(new Set(g.board).size).toBe(spec.fruits);expect(g.durationMs).toBe(spec.seconds*1000);
        expect(g.durationMs/g.board.length).toBeGreaterThan(1000);expect(restore(serialize(g),platform)).toEqual(g);
        const {board,solution}=generateBoard(spec.cols,spec.rows,spec.fruits,100+level);
        expect(board).toEqual(g.board);
        for(const[a,b]of solution){expect(findPath({board,cols:g.cols,rows:g.rows},a,b)).not.toBeNull();board[a]=board[b]=0;}
        expect(board.every(v=>v===0)).toBe(true);area=g.board.length;fruits=spec.fruits;
      }
      const first=levelSpec(1,platform,difficulty),last=levelSpec(30,platform,difficulty);
      expect(last.cols*last.rows).toBeGreaterThan(first.cols*first.rows);expect(last.fruits).toBe(16);
      if(platform==='mobile')expect(last.cols).toBeLessThanOrEqual(8);
    });
    it(`${platform}/${difficulty}: preserves a v1 level-30 board instead of discarding it`,()=>{
      const g=newGame({platform,difficulty,level:30,seed:88}),[cols,rows]=DIFFICULTIES[difficulty][platform];
      Object.assign(g,{version:1,cols,rows,board:generateBoard(cols,rows,16,88).board,status:'paused',score:1200});
      expect(restore(serialize(g),platform)).toEqual(g);
      const corrupt=structuredClone(g);corrupt.version=2;expect(restore(corrupt)).toBeNull();
    });
  }
  it('rejects invalid levels and layouts',()=>{
    for(const level of [0,31,1.5,NaN])expect(()=>levelSpec(level)).toThrow();
    expect(()=>levelSpec(1,'other')).toThrow();expect(()=>levelSpec(1,'pc','other')).toThrow();
  });
});
