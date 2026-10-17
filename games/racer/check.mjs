import {newGame,levelInfo,LEVEL_COUNT,start,step,serialize,restore} from './public/engine.mjs';
export function check(){for(let n=1;n<=LEVEL_COUNT;n++){const g=newGame({level:n,seed:n});start(g);step(g,1/60);if(levelInfo(n).distance<800||!restore(serialize(g)))throw Error('Invalid racer stage');}}
