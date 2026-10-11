// Serve only public or dist. Never expose repository files/credentials.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {ROOT,build} from './build.mjs';
if(!process.argv.includes('--dist'))build();
const root=resolve(ROOT,'dist');
const flag=process.argv.indexOf('--port'),port=flag>=0?Number(process.argv[flag+1]):4176;
const mime={'.html':'text/html; charset=utf-8','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname),file=resolve(root,'.'+name);
    if(file!==root&&!file.startsWith(root+sep))throw Error('Outside root');
    const info=await stat(file);
    if(info.isDirectory()&&!name.endsWith('/')){res.writeHead(301,{Location:name+'/'+url.search});res.end();return;}
    const target=info.isDirectory()?resolve(file,'index.html'):file;
    const content=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Games preview: http://127.0.0.1:${port}/games/ (${root})`));
