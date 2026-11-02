import {describe,it,expect} from 'vitest';
import {nativeApiGate,boundedRateLimit} from '../tools/local-protocol/native-http-access.mjs';
const prefix='/'+ 'a'.repeat(64);
describe('private native HTTP gateway',()=>{
 it('requires an explicit 256-bit installation capability',()=>{for(const p of ['', '/', '/abc', 'a'.repeat(64),'/'+ 'A'.repeat(64)])expect(()=>nativeApiGate(p)).toThrow();});
 it('strips only the exact private prefix and preserves native query data',()=>{const gate=nativeApiGate(prefix+'\n');expect(gate(prefix+'/auth/auth_sdk/auth.php?uin=1')).toBe('/auth/auth_sdk/auth.php?uin=1');expect(gate('/auth/auth_sdk/auth.php')).toBeNull();expect(gate(prefix+'b/ver/new_ver.php')).toBeNull();});
 it('rejects management, absolute, encoded and traversal paths',()=>{const gate=nativeApiGate(prefix);for(const p of ['/__fixture/status','/../auth/auth.php','/a/./b','//dir/new_dir.php','/%2e%2e/auth','/%2fauth','/a\\b'])expect(gate(prefix+p)).toBeNull();expect(gate('http://host'+prefix+'/auth/auth.php')).toBeNull();expect(gate(prefix+'/x?'+ 'a'.repeat(8192))).toBeNull();});
 it('bounds request volume and expires windows without trusting forwarded headers',()=>{const allow=boundedRateLimit({limit:2,windowMs:1000,maxClients:2});expect(allow('one',0)).toBe(true);expect(allow('one',1)).toBe(true);expect(allow('one',2)).toBe(false);expect(allow('two',2)).toBe(true);expect(allow('three',2)).toBe(false);expect(allow('three',1002)).toBe(true);expect(allow('one',1002)).toBe(true);});
 it('rejects invalid bounds',()=>{for(const options of [{limit:0},{windowMs:-1},{maxClients:1.5}])expect(()=>boundedRateLimit(options)).toThrow();});
});
