// A static game needs no transpiler: build the validated runtime, not the repo.
import {cpSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {LEVELS,PATTERNS} from '../public/games/pindou/artworks.mjs';

export const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const sha256=content=>createHash('sha256').update(content).digest('hex');
export function filesIn(root){
  return readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const path=join(root,e.name);if(e.isSymbolicLink())throw Error('Symlink in runtime tree: '+e.name);
    return e.isDirectory()?filesIn(path):[path];
  });
}
export function validateRuntime(root){
  const files=filesIn(root),allowed=new Set(['.html','.css','.mjs','.js','.json','.webmanifest','.svg','.png','.webp']);
  for(const file of files){const name=relative(root,file).replaceAll(sep,'/');
    if(!allowed.has(extname(file))||/(^|\/)(\.|credentials|config\.ini|.*\.(pem|key)$)/i.test(name))throw Error('Non-runtime file: '+name);
    if(!realpathSync(file).startsWith(realpathSync(root)+sep))throw Error('Runtime escaped public directory');
  }
  const game=join(root,'games/pindou');
  for(const required of ['index.html','app.mjs','engine.mjs','artworks.mjs','patterns.mjs','previous-simple-artworks.mjs','assets/scenes/manifest.json'])if(!existsSync(join(game,required)))throw Error('Missing runtime '+required);
  const scenes=JSON.parse(readFileSync(join(game,'assets/scenes/manifest.json'),'utf8'));
  if(scenes.length!==10||new Set(scenes.map(s=>s.key)).size!==10)throw Error('Scene manifest mismatch');
  for(const s of scenes)if(sha256(readFileSync(join(game,'assets/scenes',s.file)))!==s.sha256)throw Error('Scene hash mismatch: '+s.file);
  if(LEVELS.length!==100||PATTERNS.length!==40)throw Error('Catalogue differs from expected 100/40');
  return files;
}
export function build({output=join(ROOT,'dist')}={}){
  const source=join(ROOT,'public'),files=validateRuntime(source),out=resolve(output);
  // Explicit target check before cleaning the known build directory on Windows.
  if(out===ROOT||out===source||out===resolve(out, '..')||!['dist','test-dist'].includes(out.split(sep).at(-1)))throw Error('Invalid build target');
  if(existsSync(out)&&lstatSync(out).isSymbolicLink())throw Error('Build target is a symlink');
  rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
  const manifest={version:1,game:'pindou',base:'/games/pindou/',levels:LEVELS.length,patterns:PATTERNS.length,files:[]};
  for(const file of files){const name=relative(source,file).replaceAll(sep,'/'),dest=join(out,name),bytes=readFileSync(file);
    mkdirSync(resolve(dest,'..'),{recursive:true});cpSync(file,dest);manifest.files.push({path:name,bytes:bytes.length,sha256:sha256(bytes)});
    if(['.html','.css','.mjs','.js','.svg','.json','.webmanifest'].includes(extname(file)))writeFileSync(dest+'.gz',gzipSync(bytes,{level:9}));
  }
  writeFileSync(join(out,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manifest=build();console.log(`Built dist: ${manifest.files.length} runtime files, ${manifest.levels} levels, ${manifest.patterns} patterns; precompressed text.`);
}
