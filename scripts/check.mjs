import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {ROOT,filesIn,validateRuntime} from './build.mjs';
import {newGame,gameArtwork,inventoryValid,serialize,restore} from '../public/games/pindou/engine.mjs';
validateRuntime(join(ROOT,'public'));
for(const file of [...filesIn(join(ROOT,'public')),...filesIn(join(ROOT,'scripts'))].filter(f=>/\.m?js$/.test(f))){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw Error('Syntax check failed: '+file+'\n'+r.stderr);
}
for(let id=1;id<=100;id++){
  const game=newGame(id),level=gameArtwork(game),saved=restore(serialize(game));
  if(!inventoryValid(game)||!saved||game.board.length!==level.target.length)throw Error('Invalid level '+id);
}
console.log('PASS: runtime/module syntax + 100-level inventory/cookie checks');
