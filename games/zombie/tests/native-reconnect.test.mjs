import {it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createAccountConfig,personalAccounts,accountRoleStore} from '../tools/local-protocol/personal-accounts.mjs';
import {createLocalRole,validateLocalRole} from '../tools/local-protocol/role-session.mjs';
import {keyWords,encodeNativePacket,decodeNativePacket,nativeString,nativeFrameLength} from '../tools/local-protocol/native-codec.mjs';
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
it('reconnects with a cached 30-minute-old account key and retains an authenticated idle socket beyond ten seconds',async()=>{
 const root=existsSync('E:/Documents/AI/codex/tmp')?'E:/Documents/AI/codex/tmp':tmpdir();mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'reconnect-integration-'));
 const secret=Buffer.alloc(32,17),config=createAccountConfig('reconnect-fixture-password'),accounts=personalAccounts(config,secret),key=keyWords('reconnect-only-key'),port=await freePort(),tcpPort=await freePort();
 for(const [name,data]of Object.entries({'secret':secret,'accounts.json':JSON.stringify(config),'platform.json':JSON.stringify({EncKey:'reconnect-only-key'})}))writeFileSync(join(dir,name),data);
 const role=createLocalRole({name:'persisted-reconnect',head:1000,sex:1,bodyType:1});accountRoleStore(join(dir,'roles'),validateLocalRole).save('admin1',role);
 const child=spawn(process.execPath,['games/zombie/tools/local-protocol/server.mjs','--port',String(port),'--tcp-port',String(tcpPort),'--session-secret-file',join(dir,'secret'),'--accounts-file',join(dir,'accounts.json'),'--accounts-dir',join(dir,'roles'),'--directory','--native-account','--platform-info',join(dir,'platform.json')],{cwd:resolve('.'),windowsHide:true,stdio:['ignore','pipe','pipe']});let socket;
 try{
  await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server startup deadline')),3000))]);
  socket=net.connect(tcpPort,'127.0.0.1');await once(socket,'connect');let pending=Buffer.alloc(0);const queue=[];let waiter;
  socket.on('data',b=>{pending=Buffer.concat([pending,b]);while(pending.length>=6&&pending.length>=nativeFrameLength(pending)){const len=nativeFrameLength(pending);queue.push(decodeNativePacket(pending.subarray(0,len),key));pending=pending.subarray(len);}waiter?.();});
  const next=async cmd=>{const until=Date.now()+2500;while(Date.now()<until){const i=queue.findIndex(p=>p.cmd===cmd);if(i>=0)return queue.splice(i,1)[0];await new Promise(r=>{waiter=r;setTimeout(r,25);});}throw Error('Native reply deadline '+cmd);};
  const token=accounts.issueNative('admin1',Date.now()-1800000),head=Buffer.alloc(12);head.writeUInt32BE(900000001);
  socket.write(encodeNativePacket({cmd:2001,body:Buffer.concat([head,nativeString('dodsdk',64),nativeString(token,128),Buffer.from([1,1]),Buffer.alloc(4)]),echo:71},key));
  const login=await next(2002);expect(login.body[21]).toBe(1);expect(login.body.readBigUInt64BE(4)).toBe(BigInt(role.id));
  await new Promise(r=>setTimeout(r,11000));expect(socket.destroyed).toBe(false);
  socket.write(encodeNativePacket({cmd:2009,body:Buffer.alloc(4),echo:72},key));expect((await next(2010)).echo).toBe(72);
  const body=Buffer.alloc(12);body.writeBigUInt64BE(BigInt(role.id));socket.write(encodeNativePacket({cmd:2005,body,echo:73},key));expect((await next(2006)).echo).toBe(73);
 }finally{socket?.destroy();child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,2000))]);if(resolve(dir).startsWith(resolve(root)+'\\')||resolve(dir).startsWith(resolve(root)+'/'))rmSync(dir,{recursive:true,force:true});}
},18000);
