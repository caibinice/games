import {newGame,step,start,LEVEL_COUNT,stages,parseStage,expandBots,restore,serialize} from './public/engine.mjs';
export function check(){
 if(LEVEL_COUNT!==35||stages.length!==35)throw Error('Tank campaign mismatch');
 for(let level=1;level<=35;level++){
  const raw=stages[level-1],parsed=parseStage(raw),g=newGame({level,seed:level});
  if(!parsed.eagle||expandBots(parsed.bots).length!==20||g.session.players.length!==1||!restore(serialize(g),'pc'))throw Error('Invalid single-player tank stage');
  start(g);for(let i=0;i<180;i++)step(g,1000/60);
  if(!g.session.scene||!g.session.scene.tanks.some(t=>t.side==='player'))throw Error('Tank player did not spawn');
 }
}
