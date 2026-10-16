import {STAGES,LEVEL_COUNT,levelInfo} from './levels.mjs';
export {STAGES,LEVEL_COUNT,levelInfo};
export const WIDTH=256,HEIGHT=224,TICK_MS=1000/60,TITLE='魂斗罗',STORAGE='fish-contra';
export const JUMP_SPEED=360,GRAVITY=680,RUN_SPEED=90;
export const MODES=[['classic','经典 · 3 条生命'],['practice','30 命练习']];
export const CHEAT_OPTIONS=[
 {key:'infiniteLives',label:'无限生命',description:'受击 / 坠落后继续重生，不消耗生命。'},
 {key:'airJump',label:'空中连跳',description:'空中松开后再次按跳跃，可无限接跳；长按仍只跳一次。'},
 {key:'slowBullets',label:'慢速高亮敌弹',description:'敌弹速度降至 55%，亮色放大显示；不减慢角色和自己的子弹。'},
 {key:'invincible',label:'无敌护盾',description:'免疫敌弹、碰撞和机关；坠落仍回安全点重生。'},
];
export const normalizeCheats=(raw={})=>Object.fromEntries(CHEAT_OPTIONS.map(o=>[o.key,raw?.[o.key]===true]));
export const isAssisted=g=>g.assisted===true;
export function setCheat(g,key,enabled){if(!CHEAT_OPTIONS.some(o=>o.key===key)||typeof enabled!=='boolean')return false;g.cheats[key]=enabled;if(enabled)g.assisted=true;if(key==='infiniteLives'&&enabled&&g.status!=='lost')g.lives=Math.max(1,g.lives);return true;}
export const WEAPONS={N:{interval:240,speed:270,limit:4},M:{interval:100,speed:330,limit:10},S:{interval:200,speed:280,limit:25},L:{interval:350,speed:480,limit:5},F:{interval:180,speed:220,limit:8}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(g){let t=g.seed+=0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);g.seed>>>=0;return((t^t>>>14)>>>0)/4294967296;}
const sound=(g,name)=>g.events.push({type:'sound',name});
export const body=p=>({x:p.x-p.w/2,y:p.y-p.h,w:p.w,h:p.h});
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function supporting(stage,x,min=0){return stage.platforms.filter(p=>x>=p.x-2&&x<=p.x+p.w+2&&p.y>=min).sort((a,b)=>a.y-b.y)[0];}
export function newGame({level=1,platform='pc',mode='classic',seed=Date.now(),carry,cheats={},assisted=false}={}){
 if(!Number.isInteger(level)||level<1||level>LEVEL_COUNT||!['pc','mobile'].includes(platform)||!MODES.some(([v])=>v===mode))throw Error('Invalid contra options');
 const stage=STAGES[level-1],x=stage.kind==='base'?128:32;
 const surface=stage.kind==='vertical'?stage.platforms.filter(p=>p.y>stage.height-200&&p.x<=x&&p.x+p.w>=x).sort((a,b)=>b.y-a.y)[0]:supporting(stage,x);
 const y=stage.kind==='base'?204:surface?.y??(stage.kind==='vertical'?stage.height-48:192);
 const options=normalizeCheats(cheats);
 const g={version:1,platform,mode,level,kind:stage.kind,stage,seed:Number(seed)>>>0,status:'ready',clock:0,score:carry?.score||0,lives:carry?.lives||(mode==='practice'?30:3),cheats:options,assisted:assisted===true||Object.values(options).some(Boolean),
  player:{x,y,w:12,h:28,vx:0,vy:0,dir:1,aimX:1,aimY:0,weapon:carry?.weapon||'N',rapid:false,onGround:true,water:false,prone:false,invulnerableUntil:2000,deadUntil:0,lastFire:-1000,lastGround:0,jumpAt:-1000},
  cameraX:0,cameraY:stage.kind==='vertical'?stage.height-HEIGHT:0,checkpoint:{x,y},bullets:[],enemyBullets:[],enemies:[],pickups:[],capsules:[],explosions:[],bridges:stage.bridges.map(b=>({...b,triggerAt:0,broken:false})),
  hazards:[],movingPlatforms:stage.kind==='vertical'?[{id:1,x:112,y:605,w:32,h:8,baseX:112,previousX:112,phase:0}]:[],events:[],nextId:1,nextRunner:3600,nextCapsule:7500,room:0,cores:[],roomOpen:false,advanceTime:0,transitionUntil:0,boss:null,bossActive:false,bossDefeatedAt:0,spawned:[],jumpHeld:false,jumpBufferUntil:0,dropUntil:0,nextLife:(carry?.score||0)<30000?30000:(Math.floor((carry?.score||0)/100000)+1)*100000};
 if(stage.kind==='base')setupRoom(g);
 else{
  const count=Math.floor((stage.kind==='vertical'?stage.height:stage.width)/180);
  for(let i=1;i<count;i++){
   const vertical=stage.kind==='vertical',px=vertical?(i%2?192:64):i*180+100;
   const baseY=vertical?stage.height-i*180:0,ground=supporting(stage,px,vertical?baseY-70:64);
   g.spawned.push({id:i,x:px,y:ground?.y??(vertical?baseY:192),type:i%3===0?'turret':'soldier',active:false});
  }
  g.capsules.push({id:g.nextId++,x:240,y:stage.kind==='vertical'?y-75:76,hp:1,opened:false,phase:0});
 }
 if(level===6)for(const x of [600,1060,1450,1970,2450])g.hazards.push({type:'flame',x,y:supporting(stage,x)?.y??203,phase:x%2800});
 if(level===7)for(const x of [640,1230,1770,2320,2850])g.hazards.push({type:'crusher',x,y:0,phase:x%3000});
 return g;
}
export function start(g){if(['ready','paused'].includes(g.status))g.status='running';}
export function pause(g){if(g.status==='running')g.status='paused';}
function setupRoom(g){
 g.cores=[];g.roomOpen=false;g.advanceTime=0;g.enemyBullets=[];g.enemies=[];g.player.x=128;g.player.y=204;g.player.vy=0;g.player.onGround=true;
 if(g.room===g.stage.rooms-1){activateBoss(g);return;}
 const count=Math.min(3,1+Math.floor(g.room/2));
 for(let i=0;i<count;i++)g.cores.push({id:g.nextId++,x:128+(i-(count-1)/2)*54,y:88-(i%2)*28,w:18,h:22,hp:4+g.room,maxHP:4+g.room,lastFire:0});
}
function effect(g,x,y,big=false){g.explosions.push({id:g.nextId++,x,y,bornAt:g.clock,big});}
function addEnemy(g,entry){
 if(g.enemies.length>=14)return;const turret=entry.type==='turret';
 g.enemies.push({id:g.nextId++,type:entry.type,x:entry.x,y:entry.y,w:turret?26:12,h:turret?26:28,vx:0,vy:0,dir:entry.x>g.player.x?-1:1,hp:turret?6:1,lastFire:g.clock+500+random(g)*700,onGround:false,phase:random(g)*6});
}
function landing(g,actor,oldY,nextY){
 if(actor.vy<0||g.clock<g.dropUntil&&actor===g.player)return false;
 const p=[...g.stage.platforms,...g.movingPlatforms].filter(p=>oldY<=p.y+.2&&nextY>=p.y&&actor.x+actor.w/2>p.x&&actor.x-actor.w/2<p.x+p.w&&
  !g.bridges.some(b=>b.broken&&p.bridge&&p.x>=b.x&&p.x<b.x+b.w)).sort((a,b)=>a.y-b.y)[0];
 if(!p)return false;actor.y=p.y;actor.vy=0;actor.onGround=true;actor.support=p.id||0;return true;
}
function physics(g,p,dt){
 const old=p.y;p.vy=Math.min(450,p.vy+GRAVITY*dt);p.y+=p.vy*dt;p.onGround=false;landing(g,p,old,p.y);
 if(p===g.player&&g.level===1&&!p.onGround&&p.vy>=0){const water=g.stage.water.find(w=>p.x>=w.x&&p.x<w.x+w.w&&p.y>=w.y+7&&old<=w.y+16);if(water){p.y=water.y+10;p.vy=0;p.onGround=true;p.water=true;}}
}
export function fire(g,command={}){
 const p=g.player,w=WEAPONS[p.weapon];
 if(g.status!=='running'||p.deadUntil>g.clock||g.clock-p.lastFire<w.interval*(p.rapid?.72:1)||g.bullets.length+(p.weapon==='S'?5:1)>w.limit)return false;
 let dx=(command.right?1:0)-(command.left?1:0),dy=(command.down?1:0)-(command.up?1:0);
 if(g.kind==='base'){dx=0;dy=-1;}else{if(!dx&&!dy)dx=p.dir;if(p.onGround&&dy>0&&!dx){dx=p.dir;dy=0;}}
 const length=Math.hypot(dx,dy)||1;dx/=length;dy/=length;p.aimX=dx;p.aimY=dy;p.lastFire=g.clock;
 const angles=p.weapon==='S'?[-.24,-.12,0,.12,.24]:[0],base=Math.atan2(dy,dx);
 for(const offset of angles){const angle=base+offset;g.bullets.push({id:g.nextId++,x:p.x+dx*10,y:p.y-(p.prone?6:p.water?8:19)+dy*7,vx:Math.cos(angle)*w.speed,vy:Math.sin(angle)*w.speed,weapon:p.weapon,ttl:1800,damage:p.weapon==='L'?3:1,hitIds:[]});}
 sound(g,'shot');return true;
}
function hit(g,fall=false){
 const p=g.player;if(g.status!=='running'||g.bossDefeatedAt||p.deadUntil>g.clock||!fall&&(p.invulnerableUntil>g.clock||g.cheats.invincible))return;
 if(!g.cheats.infiniteLives)g.lives=Math.max(0,g.lives-1);p.deadUntil=g.clock+900;p.vx=0;p.vy=-80;sound(g,'dead');effect(g,p.x,p.y-12);
}
export function damagePlayer(g){hit(g);}
function respawn(g){
 const p=g.player;if(!p.deadUntil||p.deadUntil>g.clock)return;
 if(g.lives===0&&!g.cheats.infiniteLives){g.status='lost';sound(g,'lose');g.events.push({type:'lost'});return;}
 Object.assign(p,{x:clamp(g.checkpoint.x,g.cameraX+10,g.stage.width-10),y:g.checkpoint.y,vy:0,vx:0,h:28,onGround:false,water:false,prone:false,weapon:'N',rapid:false,deadUntil:0,invulnerableUntil:g.clock+2300});
 g.enemyBullets=[];g.jumpHeld=false;
}
function pickup(g,type,x,y){g.pickups.push({id:g.nextId++,type,x,y,vx:0,vy:-85,ttl:15000});}
function collect(g,item){const p=g.player;if(WEAPONS[item.type])p.weapon=item.type;if(item.type==='R')p.rapid=true;if(item.type==='B')p.invulnerableUntil=g.clock+15000;g.score+=500;item.ttl=0;sound(g,'pickup');}
function shot(g,x,y,angle,speed=105,arc=0){if(g.enemyBullets.length>=100)return;g.enemyBullets.push({id:g.nextId++,x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,gravity:arc,ttl:4200});}
function aim(g,x,y){return Math.atan2(g.player.y-17-y,g.player.x-x);}
function activateBoss(g){
 if(g.bossActive)return;g.bossActive=true;const base=g.kind==='base',vertical=g.kind==='vertical';
 const hp=({1:40,2:48,3:60,4:70,5:80,6:85,7:95,8:110})[g.level];
 const x=base?128:vertical?128:g.stage.width-48,y=base?98:vertical?95:g.level===5?128:174;
 g.boss={x,y,w:base?82:vertical?85:g.level===6?46:52,h:base?64:vertical?90:62,hp,maxHP:hp,lastFire:g.clock+800,phase:0};
 g.events.push({type:'boss'});
}
function updateBoss(g,dt){
 const b=g.boss;if(!g.bossActive||!b||b.hp<=0)return;b.phase+=dt;
 if(g.level===5)b.y=120+Math.sin(b.phase*1.3)*35;
 if(g.level===6)b.x=g.stage.width-110+Math.sin(b.phase*.8)*50;
 if(g.clock<b.lastFire)return;b.lastFire=g.clock+Math.max(700,1700-g.level*80);
 const a=aim(g,b.x,b.y-20),count=g.level>=4?5:3;
 for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*.16;shot(g,b.x-10,b.y-20,a+offset,g.kind==='base'?85:95+g.level*3);}
 if(g.level===8&&g.enemies.length<6)addEnemy(g,{type:'alien',x:g.stage.width-110,y:185});
}
function updateEnemies(g,dt){
 const p=g.player;
 for(const entry of g.spawned){if(!entry.active&&Math.abs(entry.x-(g.cameraX+128))<210&&Math.abs(entry.y-(g.cameraY+112))<200){entry.active=true;addEnemy(g,entry);}}
 if(g.kind!=='base'&&!g.bossActive&&g.clock>g.nextRunner){
  g.nextRunner=g.clock+3200+random(g)*1200;const x=Math.min(g.stage.width-24,g.cameraX+WIDTH+18),surface=supporting(g.stage,x,g.kind==='vertical'?g.cameraY+30:64);
  if(surface)addEnemy(g,{type:g.level===8?'alien':'soldier',x,y:surface.y});
 }
 for(const e of g.enemies){
  e.phase+=dt;if(e.type!=='turret'){
   e.vx=e.dir*(e.type==='alien'?60:35);e.x+=e.vx*dt;physics(g,e,dt);
   if(e.x<8||e.x>g.stage.width-8)e.dir*=-1;
  }
  if(g.clock>e.lastFire&&Math.abs(e.x-p.x)<260&&Math.abs(e.y-p.y)<180){e.lastFire=g.clock+1600+random(g)*1000;shot(g,e.x,e.y-18,aim(g,e.x,e.y-18),100);}
  if(e.hp>0&&overlaps(body(e),body(p)))hit(g);
 }
 g.enemies=g.enemies.filter(e=>e.hp>0&&e.y<g.stage.height+50&&e.x>g.cameraX-80&&e.x<g.stage.width+50&&e.y<g.cameraY+HEIGHT+100);
}
function updateBullets(g,dt){
 const p=g.player;
 for(const b of g.bullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.ttl-=dt*1000;
  const r={x:b.x-3,y:b.y-3,w:b.weapon==='L'?15:6,h:6};
  for(const e of g.enemies)if(e.hp>0&&!b.hitIds.includes(e.id)&&overlaps(r,body(e))){e.hp-=b.damage;b.hitIds.push(e.id);if(b.weapon!=='L')b.ttl=0;if(e.hp<=0){g.score+=e.type==='turret'?500:100;effect(g,e.x,e.y-12,true);sound(g,'explosion');}break;}
  if(b.ttl<=0)continue;
  for(const capsule of g.capsules)if(!capsule.opened&&overlaps(r,{x:capsule.x-12,y:capsule.y-7,w:24,h:14})){
   capsule.opened=true;b.ttl=0;pickup(g,['S','M','R','F','L','B'][(capsule.id+g.level-2)%6],capsule.x,capsule.y);effect(g,capsule.x,capsule.y);break;
  }
  if(b.ttl<=0)continue;
  for(const core of g.cores)if(core.hp>0&&overlaps(r,{x:core.x-core.w/2,y:core.y-core.h/2,w:core.w,h:core.h})){
   core.hp-=b.damage;b.ttl=0;if(core.hp<=0){g.score+=500;effect(g,core.x,core.y,true);sound(g,'explosion');}break;
  }
  if(b.ttl<=0)continue;
  const boss=g.boss;if(boss&&boss.hp>0&&overlaps(r,{x:boss.x-boss.w/2,y:boss.y-boss.h,w:boss.w,h:boss.h})){
   boss.hp=Math.max(0,boss.hp-b.damage);b.ttl=0;boss.hitAt=g.clock;
   if(boss.hp===0){g.bossDefeatedAt=g.clock||1;g.score+=5000;g.enemyBullets=[];g.enemies=[];effect(g,boss.x,boss.y-24,true);sound(g,'boss');}
  }
 }
 const enemyDt=dt*(g.cheats.slowBullets?.55:1);
 for(const b of g.enemyBullets){b.vy+=b.gravity*enemyDt;b.x+=b.vx*enemyDt;b.y+=b.vy*enemyDt;b.ttl-=enemyDt*1000;if(overlaps({x:b.x-2,y:b.y-2,w:4,h:4},body(p))){hit(g);b.ttl=0;}}
 const visible=b=>b.ttl>0&&b.x>=g.cameraX-40&&b.x<=g.cameraX+WIDTH+40&&b.y>=g.cameraY-40&&b.y<=g.cameraY+HEIGHT+60;
 g.bullets=g.bullets.filter(visible);g.enemyBullets=g.enemyBullets.filter(visible);
}
function baseStep(g,dt,command){
 const p=g.player;p.x=clamp(p.x+p.vx*dt,24,232);
 const old=p.y;p.vy+=GRAVITY*dt;p.y=Math.min(204,p.y+p.vy*dt);p.onGround=p.y>=204;if(p.onGround)p.vy=0;
 if(g.bossActive){updateBoss(g,dt);return;}
 const live=g.cores.filter(c=>c.hp>0);
 if(!live.length){g.roomOpen=true;if(command.up){g.advanceTime+=dt*1000;if(g.advanceTime>=700){g.room++;g.transitionUntil=g.clock+500;setupRoom(g);sound(g,'bridge');}}}
 else for(const core of live)if(g.clock>core.lastFire){core.lastFire=g.clock+1600+random(g)*500;shot(g,core.x,core.y+14,aim(g,core.x,core.y+14),80+g.room*3);}
 if(g.clock>g.nextRunner&&!g.roomOpen){g.nextRunner=g.clock+3400;addEnemy(g,{type:'soldier',x:random(g)<.5?35:220,y:204});}
}
export function step(g,milliseconds,command={}){
 g.events=[];if(g.status!=='running'||!Number.isFinite(milliseconds)||milliseconds<=0)return;
 // Bound catch-up and subdivide for swept platform/projectile collision.
 let remaining=Math.min(100,milliseconds);while(remaining>1e-7&&g.status==='running'){
  const ms=Math.min(TICK_MS,remaining),dt=ms/1000;remaining-=ms;g.clock+=ms;
  const p=g.player;
  for(const platform of g.movingPlatforms){platform.previousX=platform.x;platform.phase+=dt;platform.x=platform.baseX+Math.sin(platform.phase*.8)*24;if(p.onGround&&p.support===platform.id)p.x+=platform.x-platform.previousX;}
  if(g.bossDefeatedAt&&g.clock-g.bossDefeatedAt>1800){g.status='won';sound(g,'win');g.events.push({type:'levelclear',level:g.level},{type:'won'});break;}
  if(g.bossDefeatedAt){p.vx=0;p.vy=0;g.explosions=g.explosions.filter(e=>g.clock-e.bornAt<600);continue;}
  if(p.deadUntil){respawn(g);if(g.status!=='running')break;}
  if(command.jump&&!g.jumpHeld)g.jumpBufferUntil=g.clock+100;g.jumpHeld=!!command.jump;
  p.prone=!!command.down&&p.onGround&&!p.water;p.h=p.prone?11:p.water?14:28;
  if(p.deadUntil>g.clock){p.vy+=350*dt;p.y=Math.min(g.stage.height+80,p.y+p.vy*dt);}else{
   const direction=(command.right?1:0)-(command.left?1:0);if(direction)p.dir=direction;p.vx=p.prone?0:direction*(p.water?55:RUN_SPEED);
   if(p.onGround)p.lastGround=g.clock;
   if(g.jumpBufferUntil>=g.clock&&(g.clock-p.lastGround<=80||g.cheats.airJump)){
    if(command.down&&g.kind!=='base'&&(!g.cheats.airJump||p.onGround)){g.dropUntil=g.clock+220;p.y+=3;p.onGround=false;}
    else{p.vy=-JUMP_SPEED;p.onGround=false;p.water=false;p.jumpAt=g.clock;}
    g.jumpBufferUntil=0;p.lastGround=g.clock-1000;
   }
   if(!command.jump&&p.vy<-180&&g.clock-p.jumpAt>120)p.vy=-180;
   if(g.kind==='base')baseStep(g,dt,command);
   else{p.x=clamp(p.x+p.vx*dt,g.cameraX+7,g.stage.width-8);p.water=false;physics(g,p,dt);}
   if(g.cheats.airJump&&p.y<28){p.y=28;p.vy=Math.max(0,p.vy);}
   if(command.fire)fire(g,command);
   if((g.kind==='vertical'&&p.y>g.cameraY+HEIGHT+30)||p.y>g.stage.height+24){p.invulnerableUntil=0;hit(g,true);}
   if(p.onGround&&!g.hazards.some(h=>Math.abs(h.x-p.x)<40)){g.checkpoint={x:p.x,y:p.y};}
  }
  if(g.kind==='vertical'){g.cameraY=Math.min(g.cameraY,clamp(p.y-145,0,g.stage.height-HEIGHT));if(g.cameraY<75)activateBoss(g);}
  else if(g.kind!=='base'){g.cameraX=Math.max(g.cameraX,clamp(p.x-100,0,g.stage.width-WIDTH));if(p.x>g.stage.width-300)activateBoss(g);}
  if(g.kind!=='base')updateBoss(g,dt);
  updateEnemies(g,dt);updateBullets(g,dt);
  for(const b of g.bridges){if(!b.triggerAt&&p.x>b.x-40)b.triggerAt=g.clock+500;if(b.triggerAt&&g.clock>b.triggerAt&&!b.broken){b.broken=true;effect(g,b.x+16,b.y+8,true);sound(g,'bridge');}}
  for(const h of g.hazards){const phase=(g.clock+h.phase)%3200;h.active=phase>1900;h.telegraph=phase>1400&&phase<=1900;
   if(h.type==='flame'&&h.active&&overlaps(body(p),{x:h.x,y:h.y-30,w:48,h:30}))hit(g);
   if(h.type==='crusher'){h.y=phase>1400&&phase<2400?180:30;if(h.y>100&&overlaps(body(p),{x:h.x-15,y:h.y-38,w:30,h:38}))hit(g);}
  }
  for(const item of g.pickups){item.ttl-=ms;const old=item.y;item.vy+=450*dt;item.y+=item.vy*dt;item.w=18;landing(g,item,old,item.y);if(item.y>g.stage.height-20){item.y=g.stage.height-20;item.vy=0;}if(overlaps(body(p),{x:item.x-12,y:item.y-15,w:24,h:15})&&p.deadUntil<=g.clock)collect(g,item);}
  g.pickups=g.pickups.filter(i=>i.ttl>0);
  for(const c of g.capsules){c.phase+=dt;if(!c.opened&&c.id>1)c.x-=35*dt;}
  if(g.kind!=='base'&&g.clock>g.nextCapsule&&!g.bossActive){g.nextCapsule=g.clock+17000;g.capsules.push({id:g.nextId++,x:g.cameraX+270,y:g.cameraY+65,hp:1,opened:false,phase:0});}
  g.capsules=g.capsules.filter(c=>!c.opened&&c.x>g.cameraX-30);g.explosions=g.explosions.filter(e=>g.clock-e.bornAt<600);
  if(g.score>=g.nextLife){g.lives++;g.nextLife=g.nextLife===30000?100000:g.nextLife+100000;sound(g,'pickup');}
 }
}
export const serialize=g=>JSON.stringify({...g,stage:undefined,events:[]});
export function restore(raw,platform){try{
 const g=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);const stage=STAGES[g.level-1];
 if(!g||g.version!==1||!stage||!Number.isInteger(g.level)||g.kind!==stage.kind||!['pc','mobile'].includes(g.platform)||(platform&&platform!==g.platform)||!MODES.some(([v])=>v===g.mode)||!['ready','running','paused','won','lost'].includes(g.status))return null;
 for(const key of ['clock','score','lives','seed','nextId','cameraX','cameraY','room','nextLife','nextRunner','nextCapsule','jumpBufferUntil','dropUntil','bossDefeatedAt'])if(!Number.isFinite(g[key])||g[key]<0||g[key]>1e10)return null;
 if(!Number.isInteger(g.lives)||g.lives>99||!Number.isInteger(g.room)||g.room>Math.max(0,stage.rooms-1)||g.cameraX>stage.width-WIDTH||g.cameraY>stage.height-HEIGHT)return null;
 const p=g.player;if(!p||!WEAPONS[p.weapon]||!['x','y','w','h','vx','vy','invulnerableUntil','deadUntil','lastFire','lastGround','jumpAt','dir','aimX','aimY'].every(k=>Number.isFinite(p[k]))||p.x<0||p.x>stage.width||p.y<-200||p.y>stage.height+100)return null;
 g.movingPlatforms??=[];
 for(const[key,max]of[['bullets',30],['enemyBullets',100],['enemies',16],['pickups',20],['capsules',10],['explosions',40],['cores',3],['bridges',8],['hazards',10],['movingPlatforms',4],['spawned',40]]){
  if(!Array.isArray(g[key])||g[key].length>max||g[key].some(o=>!o||!Number.isFinite(o.x)||!Number.isFinite(o.y)))return null;
 }
 for(const b of [...g.bullets,...g.enemyBullets])if(!Number.isFinite(b.vx)||!Number.isFinite(b.vy)||!Number.isFinite(b.ttl))return null;
 if(g.boss&&(!Number.isFinite(g.boss.hp)||g.boss.hp<0||g.boss.hp>200))return null;
 if(g.status==='won'&&(!g.boss||g.boss.hp!==0)||g.status==='lost'&&g.lives!==0)return null;
 g.cheats=normalizeCheats(g.cheats);g.assisted=g.assisted===true||Object.values(g.cheats).some(Boolean);
 g.stage=stage;g.events=[];return g;
 }catch{return null;}}
export function snapshot(g){return{level:g.level,status:g.status,clock:g.clock,player:{...g.player},bullets:g.bullets.map(b=>({...b})),cameraX:g.cameraX,cameraY:g.cameraY,boss:g.boss?{...g.boss}:null,room:g.room};}
export function view(g){return{x:g.player.x,y:g.player.y,projectiles:g.bullets.length};}
export function summary(g){return{weapon:g.player.weapon,enemies:g.enemies.length,objective:g.bossActive?`${g.stage.boss} · ${g.boss?.hp||0}/${g.boss?.maxHP||0}`:g.kind==='base'?`房间 ${g.room+1}/${g.stage.rooms} · ${g.roomOpen?'核心击破，按 ↑ 前进':'击破红色核心'}`:g.kind==='vertical'?'向上突破瀑布':'向右推进，消灭关底 Boss',phase:g.bossActive?'boss':g.kind};}
