import {it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {keyWords,encodeNativePacket,decodeNativePacket} from '../tools/local-protocol/native-codec.mjs';
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));return port;}
it('enforces the private prefix on real HTTP and session MACs on real native TCP',async()=>{
 const root=existsSync('E:/Documents/AI/codex/tmp')?'E:/Documents/AI/codex/tmp':tmpdir();mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'native-access-test-'));
 const prefix='/'+ 'b'.repeat(64),key=keyWords('test-only-native-key'),port=await freePort(),tcpPort=await freePort();
 for(const [name,data]of Object.entries({'prefix':prefix,'secret':Buffer.alloc(32,13),'platform.json':JSON.stringify({EncKey:'test-only-native-key'}),'version.json':JSON.stringify({version:'1.10.100.232',update:0})}))writeFileSync(join(dir,name),data);
 const args=['games/zombie/tools/local-protocol/server.mjs','--port',String(port),'--tcp-port',String(tcpPort),'--api-prefix-file',join(dir,'prefix'),'--session-secret-file',join(dir,'secret'),'--version',join(dir,'version.json'),'--game-auth','--directory','--native-account','--platform-info',join(dir,'platform.json'),'--log',join(dir,'requests.jsonl')];
 const child=spawn(process.execPath,args,{cwd:resolve('.'),stdio:['ignore','pipe','pipe'],windowsHide:true});let errors='';child.stderr.on('data',b=>errors+=b);
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Server exited: '+errors);}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server start timeout')),3000))]);
  const base='http://127.0.0.1:'+port;
  expect((await fetch(base+'/auth/auth_sdk/auth.php')).status).toBe(404);
  expect((await fetch(base+'/__fixture/status')).status).toBe(404);
  expect((await fetch(base+prefix+'/__fixture/status')).status).toBe(404);
  expect((await fetch(base+prefix+'/ver/new_ver.php')).status).toBe(200);
  expect((await fetch(base+prefix+'/ver/new_ver.php',{method:'DELETE'})).status).toBe(405);
  const auth=await (await fetch(base+prefix+'/auth/auth_sdk/auth.php')).json();expect(auth.loginkey).toHaveLength(22);
  const transact=async token=>{
   const socket=net.connect(tcpPort,'127.0.0.1');socket.setTimeout(2000,()=>socket.destroy(Error('Native response timeout')));await once(socket,'connect');
   const body=Buffer.concat([Buffer.alloc(4),Buffer.from(token)]);body.writeUInt32BE(900000001);
   const result=new Promise((resolve,reject)=>{socket.once('data',resolve);socket.once('end',()=>resolve(null));socket.once('error',reject);});
   socket.write(encodeNativePacket({cmd:2001,body,echo:41},key));try{return await result;}finally{socket.destroy();}
  };
  const reply=decodeNativePacket(await transact(auth.loginkey),key);expect(reply).toMatchObject({cmd:2002,echo:41});
  expect(await transact('LOCAL_FIXTURE_GAME_KEY')).toBeNull();
  expect((await fetch(base+prefix+'/ver/new_ver.php')).status).toBe(200);
  const log=readFileSync(join(dir,'requests.jsonl'),'utf8');expect(log).not.toContain(prefix);expect(log).not.toContain(auth.loginkey);expect(log).toContain('"event":"invalid"');
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,2000))]);rmSync(dir,{recursive:true,force:true});}
},10000);
