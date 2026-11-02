import {describe,it,expect} from 'vitest';
import {sdkIdentity,gameIdentity,worldDirectory,routeFixture,requestEvidence,FIXTURE_UIN} from '../tools/local-protocol/fixture.mjs';

describe('isolated native APK protocol fixture',()=>{
 it('supplies every mandatory SDK parser field with a synthetic identity',()=>{
  expect(sdkIdentity(1792934000000)).toMatchObject({ret:0,uin:FIXTURE_UIN,create_time:1792934000,login_time:1792934000,account_type:1,token:'LOCAL_FIXTURE_ONLY'});
 });
 it('returns the exact captured version bytes without live forwarding',()=>{
  const version=Buffer.from('{"version":"1.10.100.232","update":0}');
  expect(routeFixture('GET','http://fixture.invalid:85/ver/new_ver.php?pid=0',{version}).body).toBe(version);
 });
 it('fails visibly if no version fixture is present',()=>expect(routeFixture('GET','/ver/new_ver.php').status).toBe(503));
 it('implements the SDK configuration fields recovered from its callbacks',()=>{
  const fcm=JSON.parse(routeFixture('GET','/login/fcm_config.php').body),login=JSON.parse(routeFixture('GET','/login/login_config.php').body);
  expect(fcm).toMatchObject({ret:0,nppa_real_name:0,guest_total_time:0,not_adult_service_interval:[]});
  expect(login).toMatchObject({ret:0,block_login_type:[],enable_qiyu:0,captcha_url:''});
  expect(routeFixture('DELETE','/login/login_config.php').status).toBe(502);
  expect(routeFixture('GET','/reg').contentType).toContain('text/html');
  expect(routeFixture('GET','/reg').body.toString()).not.toContain('http');
 });
 it('keeps identity substitution limited to the observed SDK route and method',()=>{
  expect(routeFixture('POST','/login/login_guest.php').layer).toBe('sdk-identity');
  expect(routeFixture('GET','/login/login_guest.php').status).toBe(200);
  expect(routeFixture('DELETE','/login/login_guest.php').status).toBe(502);
  expect(routeFixture('POST','/login/anything.php').status).toBe(502);
 });
 it('supports a separately reviewed account route only when explicitly enabled',()=>{
  expect(routeFixture('POST','/login/account-fixture.php',{sdkPaths:['/login/account-fixture.php']}).status).toBe(200);
 });
 it('does not pretend game authentication or a directory has been implemented',()=>{
  expect(routeFixture('POST','/auth/auth_sdk/auth.php').layer).toBe('game-auth-pending');
  expect(routeFixture('GET','/dir/new_dir.php').status).toBe(503);
 });
 it('enables game-auth independently, with the recovered native field types',()=>{
  const data=gameIdentity(1792934000000);
  expect(data).toMatchObject({ret:0,uin:900000001,authtime:1792934000,createtime:'1792934000',loginkey:'LOCAL_FIXTURE_GAME_KEY',channelname:'dodsdk',channeltype:0});
  expect(routeFixture('GET','/auth/auth_sdk/auth.php',{gameAuth:true}).layer).toBe('game-auth');
  expect(routeFixture('GET','/dir/new_dir.php',{gameAuth:true}).status).toBe(503);
 });
 it('advertises only a loopback world and keeps role state separate',()=>{
  const directory=worldDirectory(1792934000000,53174);
  expect(directory.world_list[0]).toMatchObject({world_id:1,state:'open|run',conn_ip:'127.0.0.1',conn_port:53174});
  expect(directory.role_world_ids).toEqual([]);
  expect(directory.last_vist_worlds).toEqual(['1']); // GetStringDataByIndex -> Int32.Parse
  expect(routeFixture('GET','/dir/new_dir.php',{directory:true}).layer).toBe('directory');
  expect(JSON.parse(routeFixture('GET','/__fixture/status',{directory:true}).body).pending).toContain('role-session');
 });
 it('records only request field names, never identifiers or secrets',()=>{
  const report=requestEvidence('POST','http://sdk.invalid/login/login_guest.php?token=secret','uin=private-id&password=private-password','application/x-www-form-urlencoded');
  expect(report).toEqual({method:'POST',host:'sdk.invalid',path:'/login/login_guest.php',queryKeys:['token'],bodyKeys:['password','uin']});
  expect(JSON.stringify(report)).not.toMatch(/secret|private-id|private-password/);
 });
 it('rejects malformed and non-HTTP targets',()=>{
  expect(routeFixture('GET','http://[').status).toBe(400);
  expect(routeFixture('GET','file:///private').status).toBe(400);
 });
 it('does not turn mislabeled encrypted payloads into logged form field names',()=>{
  expect(requestEvidence('POST','/report','\u0001encrypted-secret-value\ufffd=ignored','application/x-www-form-urlencoded').bodyKeys).toEqual([]);
 });
 it('distinguishes the minimal role/battle fixture from full game completion',()=>{
  const status=JSON.parse(routeFixture('GET','/__fixture/status',{nativeAccount:true,roleFixture:true}).body);
  expect(status.implemented).toContain('reference-battle-1001');expect(status.pending).toContain('battle-settlement');expect(status.pending).toContain('gems-and-events');
 });
});
