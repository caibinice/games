import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
export function listGames(root=ROOT){
  return readdirSync(join(root,'games'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>{
    if(!/^[a-z][a-z0-9-]*$/.test(e.name))throw Error('Invalid game directory');
    const config=JSON.parse(readFileSync(join(root,'games',e.name,'game.json'),'utf8'));
    if(config.id!==e.name||!config.name||!config.version||!existsSync(join(root,'games',e.name,'public/index.html')))throw Error('Invalid game metadata: '+e.name);
    if((config.vendors||[]).some(v=>!['three','cannon-es'].includes(v)))throw Error('Unregistered vendor');
    return {...config,base:`/games/${e.name}/`};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
export function selectGames(value='all',catalog=listGames()){
  const ids=value==='all'?catalog.map(g=>g.id):[...new Set(value.split(',').map(v=>v.trim()).filter(Boolean))];
  if(!ids.length||ids.some(id=>!catalog.some(g=>g.id===id)))throw Error('Unknown/empty game selection: '+value);
  return ids.map(id=>catalog.find(g=>g.id===id));
}
export function gameArgument(argv=process.argv){const i=argv.findIndex(v=>v==='--games'||v==='--game');return i<0?'all':argv[i+1]||'';}
