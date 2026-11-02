import {describe,it,expect} from 'vitest';
import {nativeString,accountLoginReply} from '../tools/local-protocol/native-codec.mjs';
import {LOCAL_ROLE_ID,createLocalRole,validateLocalRole,validateFixtureProfile,parseRoleCreate,packRoleStruct,packLocalRoleData,localRoleData,localCoreData,roleSessionReply} from '../tools/local-protocol/role-session.mjs';

const NOW=1793000000000;
function createRequest(){const head=Buffer.alloc(6);head.writeInt32BE(1000);head[4]=1;head[5]=1;return Buffer.concat([head,nativeString('本地测试员',64),Buffer.alloc(4)]);}
const role=createLocalRole(parseRoleCreate(createRequest()),NOW);
describe('native local role session',()=>{
 it('validates core levels/materials and sends the separate native core notification on login',()=>{
  const profile=validateFixtureProfile({coreLevel:1,cores:{1000:14},goods:{61001:10000}}),body=Buffer.alloc(12);body.writeBigUInt64BE(BigInt(LOCAL_ROLE_ID));
  const res=roleSessionReply({cmd:2005,body},role,NOW,profile);expect(res.notifications[0].cmd).toBe(29001);expect(res.notifications[0].body.readUInt32BE(0)).toBe(14);
  expect(localCoreData(role,profile).DataList.find(c=>c.ID===1000).Level).toBe(14);expect(localCoreData(role,profile).DataList.find(c=>c.ID===2000).Level).toBe(1);
  for(const p of [{cores:{999:1}},{cores:{1000:47}},{coreLevel:47},{goods:{123:1}},{goods:{61001:-1}}])expect(()=>validateFixtureProfile(p)).toThrow();
 });
 it('spends source-config costs, persists core upgrades and rejects insufficient funds without mutation',()=>{
  const profile={coreLevel:1,gold:10000,goods:{61001:1000}},body=Buffer.alloc(4);body.writeUInt32BE(1000);
  const out=roleSessionReply({cmd:29002,body,echo:70},role,NOW,profile);expect(out.reply.cmd).toBe(29003);expect(out.reply.body.readInt32BE(0)).toBe(0);
  expect(localCoreData(out.role,profile).DataList.find(c=>c.ID===1000).Level).toBe(2);const data=localRoleData(out.role,NOW,profile);expect(data.BaseData.Gold).toBe(9500);expect(data.BagData.ItemData.find(i=>i.ItemID===61001).StackCnt).toBe(925);
  expect(out.notifications.map(n=>n.cmd)).toEqual([29001,2021]);expect(localCoreData(out.role,{...profile,coreLevel:10}).DataList.find(c=>c.ID===2000).Level).toBe(10);
  for(const invalid of [{...profile,gold:1},{...profile,goods:{}},{...profile,coreLevel:46}]){const failed=roleSessionReply({cmd:29002,body},role,NOW,invalid);expect(failed.reply.body.readInt32BE(0)).not.toBe(0);expect(failed.role).toBe(role);}
 });
 it('encodes actual SkillLevel values in battle core entries, not the menu Level field',()=>{
  const body=Buffer.alloc(13);body.writeInt32BE(1001);
  const out=roleSessionReply({cmd:4251,body},role,NOW,{coreLevel:1,cores:{1000:14}});
  const skills=localCoreData(role,{coreLevel:1,cores:{1000:14}}).DataList.map(c=>({SkillID:c.ID,SkillLevel:c.Level}));
  const expected=packRoleStruct('CSMagicSkillData',{SkillList:skills});
  expect(expected.readInt32BE(0)).toBe(14);expect(expected.readUInt32BE(4)).toBe(1000);expect(expected.readInt32BE(8)).toBe(14);
  expect(out.notifications[0].body.includes(expected)).toBe(true);
  expect(()=>packRoleStruct('CSMagicSkillEntry',{SkillID:1000,Level:14})).toThrow('Unknown native role field CSMagicSkillEntry.Level');
  const empty=roleSessionReply({cmd:4251,body},role,NOW,{coreLevel:0});expect(empty.notifications[0].body.includes(expected)).toBe(false);
 });
 it('parses the native create request including its terminated byte-counted name',()=>expect(parseRoleCreate(createRequest())).toEqual({head:1000,sex:1,bodyType:1,name:'本地测试员',lang:0}));
 it('rejects missing terminators and mismatched name lengths',()=>{
  const request=createRequest();request[request.length-5]=1;expect(()=>parseRoleCreate(request)).toThrow();
  expect(()=>parseRoleCreate(Buffer.alloc(5))).toThrow();
 });
 it('keeps the test role bound to the synthetic account and fixed local role ID',()=>{
  expect(validateLocalRole(role)).toMatchObject({id:LOCAL_ROLE_ID,uin:900000001,createdAt:1793000000});
  expect(()=>validateLocalRole({...role,uin:123})).toThrow();
 });
 it('packs native integer widths and auto-counts only actual array entries',()=>{
  expect(packRoleStruct('CSGunData',{GunList:[{GunID:1,GunLevel:1}],GunSkillLevel:1,CurGunID:1})).toEqual(Buffer.from('0000000100000001000000010000000100000001','hex'));
  expect(()=>packRoleStruct('CSGunData',{GunCount:2,GunList:[]})).toThrow('count mismatch');
 });
 it('provides nonempty base data, initial level and gun while leaving H5 absent',()=>{
  const data=localRoleData(role,NOW);expect(data.BaseData).toMatchObject({RoleID:LOCAL_ROLE_ID,Level:1,IsFinGuide:1});
  expect(data.LevelData.UnlockLevelList[0].LevelID).toBe(1001);expect(data.GunData.CurGunID).toBe(1);expect(data.H5GameData).toBeNull();
  expect(data.LevelData.UnlockLevelList[0].LastMaxHpRate).toBe(0); // Native UI formats this value directly as percent.
  expect(data.EquipData.EquipList).toHaveLength(6);expect(data.EquipData.EquipList.every(e=>e.ItemID>800000000)).toBe(true);
  const packed=packLocalRoleData(role,NOW);expect(packed.length).toBeGreaterThan(800);expect(packed[0]).toBe(1);expect(packed.readBigUInt64BE(1)).toBe(BigInt(LOCAL_ROLE_ID));
 });
 it('acknowledges creation with the original requested name and a stable local ID',()=>{
  const out=roleSessionReply({cmd:2003,body:createRequest(),echo:5},null,NOW);
  expect(out.reply).toMatchObject({cmd:2004,echo:5});expect(out.reply.body.readInt32BE(0)).toBe(0);
  expect(out.reply.body.readBigUInt64BE(5)).toBe(BigInt(LOCAL_ROLE_ID));expect(out.reply.body.readUInt32BE(13)).toBe(1793000000);
 });
 it('answers only a matching role login and includes role data after its 22-byte prefix',()=>{
  const body=Buffer.alloc(12);body.writeBigUInt64BE(BigInt(LOCAL_ROLE_ID));
  const out=roleSessionReply({cmd:2005,body,echo:6},role,NOW);expect(out.reply.cmd).toBe(2006);
  expect(out.reply.body.subarray(22)).toEqual(packLocalRoleData(out.role,NOW));body.writeBigUInt64BE(1n);expect(()=>roleSessionReply({cmd:2005,body},role,NOW)).toThrow();
 });
 it('does not make arbitrary gameplay requests successful',()=>expect(roleSessionReply({cmd:4001,body:Buffer.alloc(0)},role,NOW)).toBeNull());
 it('answers the reviewed bootstrap queries with their distinct native result shapes',()=>{
  expect(roleSessionReply({cmd:2048,body:Buffer.alloc(8)},role,NOW).reply.body).toEqual(Buffer.alloc(5));
  expect(roleSessionReply({cmd:13001,body:Buffer.alloc(1)},role,NOW).reply.body).toEqual(Buffer.from('01000000000000','hex'));
  expect(roleSessionReply({cmd:13019,body:Buffer.alloc(1)},role,NOW).reply.body).toEqual(Buffer.from([1,0]));
 });
 it('permits only the first local reference level through the start-battle fixture',()=>{
  const body=Buffer.alloc(13);body.writeInt32BE(1001);
  const res=roleSessionReply({cmd:4251,body,echo:20},role,NOW).reply;expect(res.cmd).toBe(4252);expect(res.body.readInt32BE(5)).toBe(1001);
  const notification=roleSessionReply({cmd:4251,body,echo:20},role,NOW).notifications[0];
  expect(notification.cmd).toBe(4253);expect(notification.body.readInt32BE(5)).toBe(1001);expect(notification.body.readInt32BE(43)).toBe(1);
  body.writeInt32BE(99999);expect(roleSessionReply({cmd:4251,body},role,NOW).reply.body.readInt32BE()).toBe(1);
 });
 it('retains zero-valued mode structures consumed unconditionally by native unpack',()=>{
  const empty=packRoleStruct('CSNotifyEnterLevel',{LevelID:1001,PlayerData:[]});expect(empty.length).toBe(214);
  const maze=packRoleStruct('CSNotifyEnterLevel',{LevelID:9001,PlayerData:[],HasMessData:1,MessData:{Level:2,Type:1}});
  expect(maze[96]).toBe(1);expect(maze.readInt32BE(109)).toBe(2);
 });
 it('advertises persisted role existence in the native account response only when supplied',()=>{
  const body=Buffer.alloc(26);body.writeUInt32BE(900000001);Buffer.from('LOCAL_FIXTURE_GAME_KEY').copy(body,4);
  const reply=accountLoginReply({cmd:2001,body,echo:1},NOW,role);expect(reply.body[27]).toBe(1);expect(reply.body.readBigUInt64BE(4)).toBe(BigInt(LOCAL_ROLE_ID));
 });
 it('applies only validated local profile overrides to native role and battle data',()=>{
  const profile={level:30,gold:500000,diamonds:12345,energy:500,attack:250,maxHp:5000,fight:1000,reagent:99,gems:[900410207],forms:[82001],equippedForm:82001,outfits:[81001],equippedOutfit:81001,mercs:[101],activeMerc:101};
  const data=localRoleData(role,NOW,profile);expect(data.BaseData).toMatchObject({Level:30,Gold:500000,Diamond:12345,Stma:500,FightVal:1000});expect(data.AttrData).toMatchObject({Atk:250,MaxHp:5000});
  expect(data.BagData.ItemData.map(i=>i.ItemID)).toEqual([900410207,1001]);expect(data.SkinData.SkinList.find(s=>s.SkinType===2).SkinChooseInfo.CurSkinID).toBe(82001);expect(data.MercenaryData.Slot1).toBe(101);
  expect(packLocalRoleData(role,NOW,profile).length).toBeGreaterThan(500);const body=Buffer.alloc(13);body.writeInt32BE(1001);expect(roleSessionReply({cmd:4251,body},role,NOW,profile).notifications[0].cmd).toBe(4253);
 });
 it('rejects unknown fields, nonexistent items, invalid selections and out-of-range values',()=>{
  for(const profile of [{gold:-1},{attack:1e9},{gems:[123]}, {forms:[81001]},{mercs:[999]},{forms:[82001],equippedForm:82002},{arbitrary:1}])expect(()=>validateFixtureProfile(profile)).toThrow();
 });
 it('rolls only owned unequipped gems and persists matching-part, matching-quality replacements',()=>{
  const profile={gems:[900410207,900010107],reagent:99},body=Buffer.alloc(16);body.writeUInt32BE(900410207);body.writeUInt32BE(2,8);
  const out=roleSessionReply({cmd:4204,body,echo:55},role,NOW,profile);
  expect(out.reply.cmd).toBe(4205);expect(out.reply.body.readInt32BE(0)).toBe(0);expect(out.reply.echo).toBe(55);
  expect(out.role.localBag.reagent).toBe(79);expect(out.role.localBag.gems[0]).not.toBe(900410207);
  const bag=localRoleData(out.role,NOW,profile).BagData.ItemData;expect(bag[0].ItemID).toBe(out.role.localBag.gems[0]);expect(bag[2].StackCnt).toBe(79);
  expect(out.notifications[0].cmd).toBe(2021);expect([...out.notifications[0].body.subarray(0,2)]).toEqual([0,1]);
  expect(localRoleData(out.role,NOW,{...profile,reagent:100}).BagData.ItemData[0].ItemID).toBe(900410207);
 });
 it('rejects equipped, mismatched, unowned and unaffordable gem rolls without mutation',()=>{
  for(const [item,page,part,reagent]of [[900410207,1,2,99],[900410207,0,1,99],[900410207,0,2,19],[900010107,0,1,99]]){
   const body=Buffer.alloc(16);body.writeUInt32BE(item);body.writeUInt32BE(page,4);body.writeUInt32BE(part,8);
   const out=roleSessionReply({cmd:4204,body},role,NOW,{gems:[900410207],reagent});expect(out.reply.body.readInt32BE(0)).not.toBe(0);expect(out.role).toBe(role);expect(out.notifications).toBeUndefined();
  }
 });
});
