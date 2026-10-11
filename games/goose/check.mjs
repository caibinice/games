import {LEVELS} from './public/catalog.mjs';
import {newGame,inventoryValid,serialize,restore} from './public/engine.mjs';
export function check(){if(LEVELS.length!==60)throw Error('Goose catalogue mismatch');for(const l of LEVELS){const g=newGame(l.id,119+l.id);if(!inventoryValid(g)||!restore(serialize(g))||l.total%3)throw Error('Invalid goose level '+l.id);}}
