import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import WebSocket from '../local-protocol/vendor/ws/wrapper.mjs';
import {keyWords,encodeNativePacket,decodeNativePacket} from '../local-protocol/native-codec.mjs';
const [baseFile,platformFile,credentialsFile]=process.argv.slice(2),base=readFileSync(baseFile,'utf8').trim();
const key=keyWords(JSON.parse(readFileSync(platformFile,'utf8').replace(/^\uFEFF/,'' )).EncKey);
let token=null,account=null;
if(credentialsFile){const data=JSON.parse(readFileSync(credentialsFile,'utf8'));account=data.mobile;
 const login=await (await fetch(base+'/login/login_verify_mobile_passwd.php',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data),signal:AbortSignal.timeout(6000)})).json();
 if(login.ret!==0||!login.token)throw Error('Account SDK probe failed');token=login.token;
}
const auth=await (await fetch(base+'/auth/auth_sdk/auth.php',{method:token?'POST':'GET',...(token?{headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})}:{}),signal:AbortSignal.timeout(6000)})).json();
if(auth.ret!==0||typeof auth.loginkey!=='string')throw Error('Game authentication probe failed');
const ws=new WebSocket(base.replace('https:','wss:')+'/socket',{perMessageDeflate:false,handshakeTimeout:6000});
const timer=setTimeout(()=>ws.terminate(),10000);
try{
 await once(ws,'open');const body=Buffer.concat([Buffer.alloc(4),Buffer.from(auth.loginkey)]);body.writeUInt32BE(900000001);
 const next=once(ws,'message');ws.send(encodeNativePacket({cmd:2001,body,echo:88},key));const [data]=await next;
 const reply=decodeNativePacket(data,key);if(reply.cmd!==2002||reply.echo!==88)throw Error('Unexpected native WebSocket reply');
 console.log(JSON.stringify({httpsAuth:true,wssNativeLogin:true,account,replyCommand:reply.cmd,hasRole:reply.body[27]===1}));
}finally{clearTimeout(timer);ws.close();}
