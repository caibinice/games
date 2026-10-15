import {newGame,restore,serialize,WALL} from './public/engine.mjs';
import {THEMES,LEVEL_COUNT} from './public/catalog.mjs';
export function check(){
  if(THEMES.length!==6||LEVEL_COUNT!==30)throw Error('Bubble Town catalogue mismatch');
  for(const platform of ['pc','mobile'])for(const difficulty of ['easy','normal','hard'])for(let level=1;level<=LEVEL_COUNT;level++){
    const g=newGame({platform,difficulty,level,seed:100+level});
    if(!restore(serialize(g),platform)||g.players.some(p=>g.board[p.y*g.cols+p.x]===WALL))throw Error('Invalid Bubble Town arena');
  }
  if(!restore(serialize(newGame({mode:'duo'})),'pc'))throw Error('Invalid cooperative arena');
}
