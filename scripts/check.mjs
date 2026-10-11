import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,filesIn,validateRuntime} from './build.mjs';
import {listGames} from './catalog.mjs';
const games=listGames();
for(const game of games){validateRuntime(join(ROOT,'games',game.id,'public'));const module=await import(pathToFileURL(join(ROOT,'games',game.id,'check.mjs')));module.check();}
for(const file of [...filesIn(join(ROOT,'games')),...filesIn(join(ROOT,'site')),...filesIn(join(ROOT,'scripts'))].filter(f=>/\.m?js$/.test(f))){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw Error('Syntax check failed: '+file+'\n'+r.stderr);}
console.log('PASS: per-game checks + module syntax: '+games.map(g=>g.id).join(', '));
