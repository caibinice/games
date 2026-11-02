import {createGame,start,step,stageInfo,plant,LEVEL_COUNT} from './public/engine.mjs';
export function check(){for(let n=1;n<=LEVEL_COUNT;n++){const g=start(createGame({level:n,seed:n}));if(!plant(g,'sunflower',0,0).ok||stageInfo(n).rows<5)throw Error('Invalid PVZ stage '+n);for(let i=0;i<30;i++)step(g,.05);}}
