import {createGame,start,step,stageInfo,LEVEL_COUNT} from './public/engine.mjs';
import {CAMPAIGN_ENTRIES,ELITE_ENTRIES} from './public/client-expanded.mjs';
import {existsSync} from 'node:fs';
export function check(){for(let n=1;n<=LEVEL_COUNT;n++){const g=createGame({level:n,seed:n});start(g);for(let i=0;i<90;i++)step(g,1/60);if(g.info.level!==n||!g.enemies.length||stageInfo(n).count<32)throw Error('Invalid zombie stage '+n);}if(CAMPAIGN_ENTRIES.length!==LEVEL_COUNT||ELITE_ENTRIES.length!==LEVEL_COUNT)throw Error('Client campaign count mismatch');for(const e of [...CAMPAIGN_ENTRIES,...ELITE_ENTRIES])if(!e.available||!existsSync(new URL('./public/'+e.file,import.meta.url)))throw Error('Missing client level '+e.LevelID);}
