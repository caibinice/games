import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {LEVELS,PATTERNS} from './public/artworks.mjs';
import {newGame,gameArtwork,inventoryValid,serialize,restore} from './public/engine.mjs';
export function check(){
  const scenes=JSON.parse(readFileSync(new URL('./public/assets/scenes/manifest.json',import.meta.url),'utf8'));
  if(scenes.length!==10||LEVELS.length!==100||PATTERNS.length!==40)throw Error('Pindou catalogue mismatch');
  for(const s of scenes)if(createHash('sha256').update(readFileSync(new URL('./public/assets/scenes/'+s.file,import.meta.url))).digest('hex')!==s.sha256)throw Error('Scene hash mismatch');
  for(let id=1;id<=100;id++){const g=newGame(id);if(!inventoryValid(g)||!restore(serialize(g))||g.board.length!==gameArtwork(g).target.length)throw Error('Invalid pindou level '+id);}
}
