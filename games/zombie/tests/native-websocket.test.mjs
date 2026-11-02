import {it,expect} from 'vitest';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {attachNativeWebSocket,websocketWorld} from '../tools/local-protocol/native-websocket.mjs';
import {nativeApiGate} from '../tools/local-protocol/native-http-access.mjs';
import WebSocket from '../tools/local-protocol/vendor/ws/wrapper.mjs';
it('advertises a native WSS path on 443 without exposing raw TCP',()=>{
 expect(websocketWorld('wss://example.test/private/socket')).toEqual({host:'wss://example.test/private/socket',port:443,name:'个人自建服'});
 for(const url of ['ws://example.test/socket','wss://example.test:55074/socket','wss://a:b@example.test/socket','wss://example.test/socket?x=y','wss://example.test/not-game'])expect(()=>websocketWorld(url)).toThrow();
});
it('bridges binary frames to native TCP and rejects unprefixed upgrades and text',async()=>{
 const tcp=net.createServer(s=>s.on('data',b=>s.write(b))),server=http.createServer();tcp.listen(0,'127.0.0.1');server.listen(0,'127.0.0.1');await Promise.all([once(tcp,'listening'),once(server,'listening')]);
 const prefix='/'+ 'c'.repeat(64),close=attachNativeWebSocket(server,{gate:nativeApiGate(prefix),tcpPort:tcp.address().port}),base='ws://127.0.0.1:'+server.address().port;
 let ws;
 try{
  const bad=new WebSocket(base+'/socket');const error=once(bad,'error');await error;expect(bad.readyState).toBeGreaterThan(1);
  ws=new WebSocket(base+prefix+'/socket');await once(ws,'open');const response=once(ws,'message');ws.send(Buffer.from('native-wire'),{binary:true});const [data,binary]=await response;expect(binary).toBe(true);expect(data.toString()).toBe('native-wire');
  const closed=once(ws,'close');ws.send('text is not native');await closed;
 }finally{ws?.terminate();close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>tcp.close(r))]);}
},5000);
it('keeps idle bridges alive with protocol pings and reaps a half-open client',async()=>{
 const tcp=net.createServer(s=>s.on('data',b=>s.write(b))),server=http.createServer();tcp.listen(0,'127.0.0.1');server.listen(0,'127.0.0.1');await Promise.all([once(tcp,'listening'),once(server,'listening')]);
 const prefix='/'+ 'd'.repeat(64),close=attachNativeWebSocket(server,{gate:nativeApiGate(prefix),tcpPort:tcp.address().port,heartbeatMs:100}),base='ws://127.0.0.1:'+server.address().port+prefix+'/socket';
 let live,stale;
 try{
  live=new WebSocket(base);await once(live,'open');let pings=0;live.on('ping',()=>pings++);
  await new Promise(r=>setTimeout(r,350));expect(pings).toBeGreaterThan(0);expect(live.readyState).toBe(1);
  const response=once(live,'message');live.send(Buffer.from('after-idle'));expect((await response)[0].toString()).toBe('after-idle');
  stale=new WebSocket(base,{autoPong:false});await once(stale,'open');await Promise.race([once(stale,'close'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Missing stale-bridge timeout')),600))]);
  expect(live.readyState).toBe(1);
 }finally{live?.terminate();stale?.terminate();close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>tcp.close(r))]);}
},3000);
