import {describe,it,expect} from 'vitest';
import {createLocalRole,localRoleData,roleSessionReply} from '../tools/local-protocol/role-session.mjs';
import {parseGemCompose} from '../tools/local-protocol/gem-compose.mjs';
import {CLIENT_GEMS} from '../public/client-gem-data.mjs';
const NOW=1793200000000,role=createLocalRole({name:'本机合成测试',head:1000,sex:1,bodyType:1},NOW);
const profile={gems:Array(5).fill(900010101),reagent:99};
const req=(groups=[{quality:2,part:1,costs:[[900010101,5]]}])=>{const values=[groups.length];for(const g of groups)values.push(g.quality,g.part,g.costs.length,...g.costs.flat());const body=Buffer.alloc(values.length*4);values.forEach((n,i)=>body.writeInt32BE(n,i*4));return {cmd:4202,body,echo:93};};
const apply=(r=role,p=profile,q=req())=>roleSessionReply(q,r,NOW,p);
const gems=(r,p=profile)=>localRoleData(r,NOW,p).BagData.ItemData.filter(i=>i.ItemType===3);
describe('native gem composition protocol',()=>{
 it('consumes five same-part quality-one gems and grants one source-valid quality-two gem',()=>{const out=apply();expect(out.reply.cmd).toBe(4203);expect(out.reply.body.readInt32BE()).toBe(0);expect(out.reply.body.readInt32BE(5)).toBe(1);expect(out.notifications[0].cmd).toBe(2021);const bag=gems(out.role);expect(bag).toHaveLength(1);expect(CLIENT_GEMS.find(g=>g.id===bag[0].ItemID)).toMatchObject({quality:2,part:1});expect(localRoleData(out.role,NOW,profile).BagData.ItemData.find(i=>i.ItemID===1001).StackCnt).toBe(99);});
 it('supports multi-result batches without duplicating ownership',()=>{const p={...profile,gems:Array(10).fill(900010101)},out=apply(role,p,req([{quality:2,part:1,costs:[[900010101,10]]}]));expect(out.reply.body.readInt32BE(5)).toBe(2);expect(gems(out.role,p)).toHaveLength(2);});
 it('rejects wrong parts, qualities, non-multiples and excessive costs atomically',()=>{for(const group of [{quality:2,part:2,costs:[[900010101,5]]},{quality:3,part:1,costs:[[900010101,5]]},{quality:2,part:1,costs:[[900010101,4]]},{quality:2,part:1,costs:[[900010101,10]]}]){const out=apply(role,profile,req([group]));expect(out.reply.body.readInt32BE()).toBe(1);expect(out.role).toBe(role);expect(gems(out.role)).toHaveLength(5);}});
 it('rejects locked gems and gems referenced by inactive presets',()=>{const lock=Buffer.alloc(17);lock[0]=1;lock.writeUInt32BE(900010101,1);lock.writeUInt32BE(1,9);const locked=roleSessionReply({cmd:4210,body:lock},role,NOW,profile).role;expect(apply(locked).reply.body.readInt32BE()).toBe(1);const inlay=Buffer.alloc(16);[900010101,1,1,1].forEach((n,i)=>inlay.writeUInt32BE(n,i*4));let r=roleSessionReply({cmd:4200,body:inlay},role,NOW,profile).role;const page=Buffer.alloc(4);page.writeUInt32BE(2);r=roleSessionReply({cmd:4208,body:page},r,NOW,profile).role;expect(apply(r).reply.body.readInt32BE()).toBe(1);});
 it('validates the whole batch before committing any cost',()=>{const q=req([{quality:2,part:1,costs:[[900010101,5]]},{quality:2,part:2,costs:[[900010201,5]]}]),out=apply(role,profile,q);expect(out.role).toBe(role);expect(out.notifications).toHaveLength(0);});
 it('rejects truncated, empty and trailing protocol data',()=>{for(const body of [Buffer.alloc(0),Buffer.alloc(4),req().body.subarray(0,8),Buffer.concat([req().body,Buffer.alloc(1)])])expect(()=>parseGemCompose(body)).toThrow();});
});
