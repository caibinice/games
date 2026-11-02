import {describe,it,expect} from 'vitest';
import {keyWords,xxtea,crc32,encodeNativePacket,decodeNativePacket,nativeFrameLength,accountLoginReply,nativeString,accountAuxReply} from '../tools/local-protocol/native-codec.mjs';

const key=keyWords('fixture-key-1234');
describe('native APK local wire codec',()=>{
 it('uses the independently known CRC32 check value',()=>expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926));
 it('converts UTF8 key bytes into little-endian words and pads short keys',()=>expect(keyWords('abc')).toEqual([0x00636261,0,0,0]));
 it('round-trips aligned XXTEA data without inventing a length word',()=>{
  const input=Buffer.from('0123456789abcdef0123456789abcdef');
  const encrypted=xxtea(input,key);expect(encrypted).not.toEqual(input);expect(xxtea(encrypted,key,true)).toEqual(input);
  expect(()=>xxtea(Buffer.alloc(17),key)).toThrow();
 });
 it('encodes an outer six-byte header and recovers all inner fields',()=>{
  const packet={cmd:2001,body:Buffer.from('local payload'),echo:73,serverTime:1792934000,sequence:12};
  const wire=encodeNativePacket(packet,key);expect(wire.readUInt16BE(0)).toBe(0x3245);
  expect(wire.readUInt32BE(2)).toBe(wire.length);expect((wire.length-6)%16).toBe(0);
  expect(decodeNativePacket(wire,key)).toEqual({...packet,version:1});
 });
 it('supports TCP fragmentation and rejects malformed framing',()=>{
  const wire=encodeNativePacket({cmd:2001,body:Buffer.alloc(0)},key);
  expect(nativeFrameLength(wire.subarray(0,5))).toBeNull();expect(nativeFrameLength(wire.subarray(0,6))).toBe(wire.length);
  expect(()=>decodeNativePacket(wire.subarray(0,wire.length-1),key)).toThrow();
  expect(()=>nativeFrameLength(Buffer.from('123456'))).toThrow();
 });
 it('rejects tampered inner bytes through the CRC even when framing is valid',()=>{
  const wire=encodeNativePacket({cmd:2001,body:Buffer.from('local payload')},key);
  const plain=xxtea(wire.subarray(6),key,true);plain[24]^=1;xxtea(plain,key).copy(wire,6);
  expect(()=>decodeNativePacket(wire,key)).toThrow('CRC');
 });
 it('answers only the synthetic account and explicitly reports no role',()=>{
  const body=Buffer.alloc(4+22);body.writeUInt32BE(900000001);Buffer.from('LOCAL_FIXTURE_GAME_KEY').copy(body,4);
  const reply=accountLoginReply({cmd:2001,body,echo:18},1792934000000);
  expect(reply).toMatchObject({cmd:2002,echo:18,serverTime:1792934000});expect(reply.body.length).toBe(32);
  expect(reply.body.readUInt32BE(0)).toBe(900000001);expect(reply.body.readBigUInt64BE(4)).toBe(0n);
  expect(reply.body.readInt32BE(12)).toBe(0);expect(reply.body[16]).toBe(0);expect(reply.body[27]).toBe(0);
  body.writeUInt32BE(42);expect(()=>accountLoginReply({cmd:2001,body})).toThrow('synthetic');
 });
 it('uses a byte length including the zero terminator for native strings',()=>{
  expect(nativeString('abc',4)).toEqual(Buffer.from('0000000461626300','hex'));expect(()=>nativeString('abc',3)).toThrow();
 });
 it('acknowledges the canonical reconnect flag while retaining role identity and wire layout',()=>{
  for(const reconnect of [0,1]){
   const head=Buffer.alloc(12);head.writeUInt32BE(900000001);
   const body=Buffer.concat([head,nativeString('dodsdk',64),nativeString('LOCAL_FIXTURE_GAME_KEY',128),Buffer.from([reconnect,1]),Buffer.alloc(4)]);
   const out=accountLoginReply({cmd:2001,body,echo:29},1792934000000,{id:'9000000001'});
   expect(out.body).toHaveLength(32);expect(out.body[21]).toBe(reconnect);expect(out.body[27]).toBe(1);expect(out.body.readBigUInt64BE(4)).toBe(9000000001n);
  }
 });
 it('echoes heartbeat bytes and answers the observed random-name query only',()=>{
  const body=Buffer.from('3f800000','hex');
  expect(accountAuxReply({cmd:2009,body,echo:7},1792934000000)).toMatchObject({cmd:2010,echo:7,serverTime:1792934000});
  expect(accountAuxReply({cmd:2009,body}).body.subarray(0,4)).toEqual(body);
  expect(accountAuxReply({cmd:2014,body:Buffer.alloc(5)}).cmd).toBe(2015);
  expect(accountAuxReply({cmd:2003,body:Buffer.alloc(0)})).toBeNull();
 });
});
