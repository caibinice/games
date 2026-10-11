import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {ROOT,listGames,selectGames,gameArgument} from './catalog.mjs';
export {ROOT};
export const sha256=content=>createHash('sha256').update(content).digest('hex');
export const EXTENSIONS=new Set(['.html','.css','.mjs','.js','.json','.webmanifest','.svg','.png','.webp','.jpg','.jpeg','.ico','.glb','.gltf','.mp3','.ogg','.wav','.woff2']);
export function filesIn(root){return readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{const path=join(root,e.name);if(e.isSymbolicLink())throw Error('Symlink in runtime tree');return e.isDirectory()?filesIn(path):[path];});}
export function validateRuntime(root){const files=filesIn(root);for(const file of files){const name=relative(root,file).replaceAll(sep,'/');if(!EXTENSIONS.has(extname(file))||/(^|\/)(\.|credentials|config\.ini|.*\.(pem|key)$)/i.test(name))throw Error('Non-runtime file: '+name);if(!realpathSync(file).startsWith(realpathSync(root)+sep))throw Error('Runtime escaped source');}return files;}
export const VENDORS={three:[['build/three.module.js','three.module.js'],['build/three.core.js','three.core.js'],['LICENSE','three.LICENSE.txt']],'cannon-es':[['dist/cannon-es.js','cannon-es.js'],['LICENSE','cannon-es.LICENSE.txt']]};
export function runtimeEntries(games=selectGames('all'),catalog=listGames()){
 const entries=new Map();
 for(const g of games){const source=join(ROOT,'games',g.id,'public');for(const file of validateRuntime(source))entries.set(`games/${g.id}/`+relative(source,file).replaceAll(sep,'/'),readFileSync(file));for(const vendor of g.vendors||[])for(const[from,to]of VENDORS[vendor])entries.set(`games/${g.id}/vendor/${to}`,readFileSync(join(ROOT,'node_modules',vendor,from)));}
 for(const file of validateRuntime(join(ROOT,'site')))entries.set('games/'+relative(join(ROOT,'site'),file).replaceAll(sep,'/'),readFileSync(file));
 entries.set('games/catalog.json',Buffer.from(JSON.stringify(catalog,null,2)+'\n'));return entries;
}
export function build({output=join(ROOT,'dist'),games='all'}={}){
 const catalog=listGames(),selected=selectGames(games,catalog),entries=runtimeEntries(selected,catalog),out=resolve(output);
 if(out===ROOT||out===resolve(out,'..')||!['dist','test-dist'].includes(out.split(sep).at(-1)))throw Error('Invalid build target');
 if(existsSync(out)&&lstatSync(out).isSymbolicLink())throw Error('Build target is a symlink');
 rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
 const manifest={version:2,base:'/games/',games:selected,files:[]};
 for(const[name,bytes]of [...entries].sort(([a],[b])=>a.localeCompare(b))){const dest=join(out,name);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,bytes);manifest.files.push({path:name,bytes:bytes.length,sha256:sha256(bytes)});if(['.html','.css','.mjs','.js','.svg','.json','.webmanifest','.txt'].includes(extname(name)))writeFileSync(dest+'.gz',gzipSync(bytes,{level:9}));}
 writeFileSync(join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const m=build({games:gameArgument()});console.log(`Built ${m.games.map(g=>g.id).join(', ')}: ${m.files.length} files + gzip; manifest v2.`);}
