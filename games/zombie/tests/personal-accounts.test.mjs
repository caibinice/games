import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAccountConfig,personalAccounts,accountRoleStore} from '../tools/local-protocol/personal-accounts.mjs';
import {createLocalRole,validateLocalRole} from '../tools/local-protocol/role-session.mjs';
const now=1793400000000,password='fixture-password-8',config=createAccountConfig(password),secret=Buffer.alloc(32,19);
const accounts=personalAccounts(config,secret);
it('accepts only the three named accounts, verifies passwords and stores no plaintext',()=>{
 expect(JSON.stringify(config)).not.toContain(password);
 for(const name of ['admin1','admin2','admin3'])expect(accounts.credentials(name,password)).toBe(true);
 for(const name of ['admin','ADMIN1','admin4','__proto__','../admin1'])expect(accounts.credentials(name,password)).toBe(false);
 expect(accounts.credentials('admin1','wrong')).toBe(false);
});
it('binds SDK and native session MACs to the account and rejects tampering and expiry',()=>{
 for(const name of ['admin1','admin2','admin3']){
  const sdk=accounts.issueSdk(name,now),native=accounts.issueNative(name,now);
  expect(accounts.sdkAccount(sdk,now)).toBe(name);expect(accounts.nativeAccount(native,now)).toBe(name);expect(native).toHaveLength(22);
  expect(accounts.packetAccount(Buffer.concat([Buffer.alloc(4),Buffer.from(native),Buffer.alloc(3)]),now)).toBe(name);
  expect(accounts.nativeAccount(native,now+901000)).toBe(name);expect(accounts.nativeAccount(native,now+31*86400000)).toBeNull();expect(accounts.sdkAccount(sdk,now+31*86400000)).toBeNull();
  expect(accounts.sdkAccount(sdk.replace(name,'admin4'),now)).toBeNull();expect(accounts.nativeAccount(native.slice(0,6)+'9'+native.slice(7),now)).toBeNull();
 }
});
it('uses the native SDK password route, rejects guest and validates auth tokens',()=>{
 const request=(path,data)=>JSON.parse(accounts.route('POST',path,new URLSearchParams(data).toString(),'application/x-www-form-urlencoded',now).body);
 expect(request('/login/login_guest.php',{}).ret).not.toBe(0);
 expect(request('/login/login_verify_mobile_passwd.php',{mobile:'admin1',passwd:'wrong'}).ret).not.toBe(0);
 const login=request('/login/login_verify_mobile_passwd.php',{mobile:'admin2',passwd:password});expect(login.ret).toBe(0);expect(login.account_name).toBe('admin2');
 expect(request('/login/check_login.php',{token:login.token}).account_name).toBe('admin2');
 const auth=request('/auth/auth_sdk/auth.php',{token:login.token});expect(auth.ret).toBe(0);expect(accounts.nativeAccount(auth.loginkey,now)).toBe('admin2');
 expect(request('/auth/auth_sdk/auth.php',{token:'LOCAL_FIXTURE_ONLY'}).ret).not.toBe(0);
});
it('accepts a cached signed native key after backgrounding but still enforces its bounded lifetime',()=>{
 const limited=personalAccounts(config,secret,{nativeTtlSeconds:3600});const token=limited.issueNative('admin1',now);
 expect(limited.nativeAccount(token,now+1800000)).toBe('admin1');expect(limited.nativeAccount(token,now+3601000)).toBeNull();
 expect(limited.nativeAccount(token.slice(0,-1)+'!',now)).toBeNull();
 for(const nativeTtlSeconds of [0,Infinity,-1,31*86400])expect(()=>personalAccounts(config,secret,{nativeTtlSeconds})).toThrow('lifetime');
});
it('persists independent account progress across store/client restarts',()=>{
 const root=existsSync('E:/Documents/AI/codex/tmp')?'E:/Documents/AI/codex/tmp':tmpdir();mkdirSync(root,{recursive:true});const dir=mkdtempSync(join(root,'personal-accounts-'));
 try{
  let store=accountRoleStore(dir,validateLocalRole);for(const [i,name]of ['admin1','admin2','admin3'].entries())store.save(name,{...createLocalRole({name,head:1000,sex:1,bodyType:1},now),battleWins:i+7});
  store=accountRoleStore(dir,validateLocalRole);for(const [i,name]of ['admin1','admin2','admin3'].entries())expect(store.load(name)).toMatchObject({name,battleWins:i+7});
  expect(()=>store.load('../admin1')).toThrow();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
