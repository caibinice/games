import {newGame,start,step,restore,serialize,LEVEL_COUNT,STAGES} from './public/engine.mjs';
export function check(){
 if(LEVEL_COUNT!==8||STAGES.length!==8)throw Error('Contra campaign mismatch');
 for(const platform of ['pc','mobile'])for(let level=1;level<=8;level++){
  const g=newGame({level,platform,seed:1});if(!restore(serialize(g),platform)||!g.stage.platforms.length)throw Error('Invalid Contra stage');
  start(g);for(let i=0;i<120;i++)step(g,1000/60,{fire:true});
  if(!restore(serialize(g),platform)||g.bullets.length>25)throw Error('Invalid battle state');
 }
}
