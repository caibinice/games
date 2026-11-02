// Keep build tooling isolated; do not install or mutate global/repository packages.
import {readFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const args=process.argv.slice(2),index=args.indexOf('--dependencies');
if(index<0||!args[index+1])throw Error('Pass --dependencies <isolated node_modules directory>');
const dependencies=resolve(args[index+1]),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const [name,version] of [['pixi.js','7.4.3'],['@pixi-spine/runtime-3.8','4.0.6'],['@pixi-spine/base','4.0.6'],['esbuild','0.25.11']]){
 const p=JSON.parse(readFileSync(join(dependencies,name,'package.json'),'utf8'));if(p.version!==version)throw Error('Pinned runtime mismatch: '+name);
}
const {build}=await import(pathToFileURL(join(dependencies,'esbuild/lib/main.js')).href);
await build({entryPoints:[join(root,'tools/login-spine-source.mjs')],outfile:join(root,'public/assets/client-interface/login-runtime.mjs'),
 bundle:true,format:'esm',target:'es2017',minify:true,legalComments:'inline',nodePaths:[dependencies]});
console.log('Built pinned, self-hosted Spine 3.8 login runtime. Refresh entry-resources.json next.');
