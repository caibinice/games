import {it,expect} from 'vitest';
import {createLocalRole,roleSessionReply,localRoleData} from '../tools/local-protocol/role-session.mjs';
const now=1793550000000,p={freeActions:true,gold:1000},base=createLocalRole({name:'playability',head:1000,sex:1,bodyType:1},now);
function finish(id){const body=Buffer.alloc(16);body[0]=body[1]=1;body.writeFloatBE(100,2);body.writeBigUInt64BE(BigInt(id),6);return {cmd:4254,body,echo:7};}
it('does not settle a new maze node when an old successful battle report is retransmitted',()=>{
 const prior={...base,pendingBattle:{id:'9000001001',level:1001,started:now/1000}};
 const ended=roleSessionReply(finish(prior.pendingBattle.id),prior,now+1000,p).role;
 const next={...ended,pendingBattle:{id:'9000001002',level:9001,started:now/1000+1},localMaze:{level:1,type:1,row:1,col:1,score:0,coin:0,wins:0,pending:{Row:2,Clo:1,FuncID:1}}};
 const replay=roleSessionReply(finish(prior.pendingBattle.id),next,now+2000,p);
 expect(replay.role).toEqual(next);
 expect(replay.role.pendingBattle.id).toBe('9000001002');
 expect(replay.role.localMaze.score).toBe(0);
});
it('keeps an unfinished maze separate from normal campaign entry and settlement',()=>{
 const localMaze={level:1,type:1,row:1,col:1,score:0,coin:0,wins:0,pending:{Row:2,Clo:1,FuncID:1}};
 const body=Buffer.alloc(13);body.writeInt32BE(1001);const q={cmd:4251,body,echo:3};
 const clean=roleSessionReply(q,base,now,p),started=roleSessionReply(q,{...base,localMaze},now,p);
 expect(started.notifications.find(n=>n.cmd===4253).body).toEqual(clean.notifications.find(n=>n.cmd===4253).body);
 const ended=roleSessionReply(finish(started.role.pendingBattle.id),started.role,now+1000,p);
 expect(ended.role.localMaze).toEqual(localMaze);
 expect(ended.role.localCampaign.levels[1001].wins).toBe(1);
});
it('repeatedly grants real inventory for the native quick-patrol ad type 8',()=>{
 let r=base;const body=Buffer.alloc(13);body.writeInt32BE(8);
 for(let n=0;n<5;n++){
  const before=localRoleData(r,now,p).BagData.ItemData.find(i=>i.ItemID===1001)?.StackCnt||0;
  const out=roleSessionReply({cmd:12802,body,echo:n},r,now+n*1000,p);
  expect(out.reply.cmd).toBe(12803);expect(out.reply.body.readInt32BE()).toBe(8);
  expect(out.notifications.some(n=>n.cmd===4288)).toBe(true);
  expect(localRoleData(out.role,now,p).BagData.ItemData.find(i=>i.ItemID===1001).StackCnt).toBeGreaterThan(before);r=out.role;
 }
 expect(r.localPatrol.count).toBe(5);
});
