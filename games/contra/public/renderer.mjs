const reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
const weaponColors={N:'#ffc577',M:'#ffe478',S:'#ff986f',F:'#ff7943',L:'#55e6ff',R:'#fff298',B:'#ffe190'};
const dot=(c,x,y,s,color)=>{c.fillStyle=color;c.fillRect(Math.round(x-s/2),Math.round(y-s/2),s,s);};
function muzzle(c,g,p){
 const age=g.clock-p.lastFire;
 if(age<0||age>=62||p.deadUntil>g.clock)return;
 const x=p.x+p.aimX*11,y=p.y-(p.prone?6:p.water?8:19)+p.aimY*8;
 const scale=p.weapon==='L'||p.weapon==='S'?1.4:1;
 c.save();c.translate(Math.round(x),Math.round(y));c.rotate(Math.atan2(p.aimY,p.aimX));c.globalAlpha=.9-age/100;
 c.fillStyle=weaponColors[p.weapon]||weaponColors.N;
 c.beginPath();c.moveTo(-3*scale,0);c.lineTo(0,-4*scale);c.lineTo(2*scale,-1);c.lineTo(8*scale,0);c.lineTo(2*scale,1);c.lineTo(0,4*scale);c.fill();
 dot(c,0,0,3,'#fff7c8');c.restore();
}
function trail(c,b){
 if(!b.vx&&!b.vy)return;
 c.save();c.translate(Math.round(b.x),Math.round(b.y));c.rotate(Math.atan2(b.vy,b.vx));
 const len=b.weapon==='L'?14:b.weapon==='M'?9:6;
 c.fillStyle=weaponColors[b.weapon]||weaponColors.N;c.globalAlpha=.50;c.fillRect(-len, -1,len,2);
 c.globalAlpha=.85;c.fillRect(-len*.55,-1,len*.6,2);c.restore();
}
function sparks(c,g,hit){
 const age=g.clock-hit.bornAt;if(age<0||age>=260)return;
 const {x,y,heavy}=hit,t=age/260;
 c.save();
 if(age<55){c.globalAlpha=.95-age/100;dot(c,x,y,heavy?9:6,heavy?'#ffc36c':'#f8a644');dot(c,x,y,heavy?4:3,'#fffce2');}
 if(!reducedMotion?.matches){
  c.globalAlpha=1-t;
  for(let i=0;i<(heavy?9:5);i++){
   const a=hit.angle+(i-(heavy?4:2))*(heavy?.54:.56),d=3+(11+i%3*8)*t;
   dot(c,x+Math.cos(a)*d,y+Math.sin(a)*d+t*t*10,i%3?2:3,i%3?'#ff9a48':'#fff1a3');
  }
 }
 c.restore();
}
function explosionDebris(c,g,e){
 const age=g.clock-e.bornAt;if(age<0||age>=520)return;
 const t=age/520, size=e.big?1.35:1;
 c.save();
 if(!reducedMotion?.matches){
  if(age<220){
   c.beginPath();c.arc(e.x,e.y,(5+age*.106)*size,0,Math.PI*2);c.globalAlpha=(1-age/220)*.77;c.strokeStyle='#ffcb79';c.lineWidth=1.5;c.stroke();
  }
  c.globalAlpha=(1-t)*.9;
  for(let i=0;i<(e.big?12:7);i++){
   const a=i*2.4+(e.id%13)*.18,d=size*(5+t*(22+i%4*10)),x=e.x+Math.cos(a)*d,y=e.y+Math.sin(a)*d+t*t*21;
   dot(c,x,y,i%4===0?4:2,t>.52?'#ad7259':i%3?'#ff9539':'#fff9ac');
  }
 }
 c.restore();
}
function image(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Asset load failed'));i.src=url;});}
export async function loadAssets(){
 const [atlas,rects,...maps]=await Promise.all([image('./assets/sprites.png'),fetch('./assets/sprites.json').then(r=>r.json()),...Array.from({length:8},(_,i)=>image(`./assets/backgrounds/stage-${i+1}.png`)),image('./assets/backgrounds/stage-1-objects.png')]);
 // Hue filtering every draw can force expensive canvas compositing on mobile GPUs.
 // Tint the tiny sprite sheet once, then use a plain drawImage for P2.
 const secondAtlas=document.createElement('canvas');secondAtlas.width=atlas.width;secondAtlas.height=atlas.height;
 const context=secondAtlas.getContext('2d');context.filter='hue-rotate(150deg)';context.drawImage(atlas,0,0);context.filter='none';
 return{atlas,rects,maps,second:{atlas:secondAtlas,rects}};
}
function stamp(c,a,key,x,bottom,flip=false,scale=1,flipY=false){
 if(typeof key!=='string')return;
 const r=a.rects[key.startsWith('sprite_')?key:'sprite_'+key];if(!r)return;
 c.save();c.translate(Math.round(x),Math.round(bottom));c.scale(flip?-scale:scale,flipY?-scale:scale);
 c.drawImage(a.atlas,r.x,r.y,r.w,r.h,-Math.floor(r.w/2),flipY?0:-r.h,r.w,r.h);c.restore();
}
function patch(c,a,key,x,y){
 const rects={turret:[1760,144,32,32],crate:[832,144,32,32]};const r=rects[key];
 c.drawImage(a.maps[8],...r,Math.round(x-r[2]/2),Math.round(y-r[3]),r[2],r[3]);
}
export function draw(canvas,g,a){
 if(!a)return;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#000';c.fillRect(0,0,256,224);
 const crop=g.stage.crop,sx=g.kind==='base'?crop.x+g.room*256:crop.x+Math.floor(g.cameraX),sy=crop.y+Math.floor(g.cameraY);
 c.drawImage(a.maps[g.level-1],sx,sy,256,224,0,0,256,224);
 c.save();c.translate(-Math.round(g.cameraX),-Math.round(g.cameraY));
 for(const platform of g.movingPlatforms||[])stamp(c,a,'48',platform.x+16,platform.y+31);
 for(const b of g.bridges)if(b.broken){c.fillStyle='#000';c.fillRect(b.x,b.y,b.w,b.h);}
 for(const h of g.hazards){
  if(h.type==='flame'){
   if(h.telegraph){c.fillStyle='#b53120';c.fillRect(h.x,h.y-4,10,4);}
   if(h.active)for(let i=0;i<5;i++)stamp(c,a,['82','83','84'][Math.floor(g.clock/80+i)%3],h.x+i*9,h.y-10-i%2*6,false,1.5);
  }else{
   c.fillStyle='#747474';c.fillRect(h.x-15,h.y-38,30,38);c.fillStyle='#bcbcbc';c.fillRect(h.x-12,h.y-35,24,6);c.fillStyle='#333';for(let j=0;j<5;j++)c.fillRect(h.x-14+j*6,h.y-4,3,5);
  }
 }
 for(const e of g.enemies){
  if(e.type==='turret')patch(c,a,'turret',e.x,e.y);
  else if(e.type==='alien')stamp(c,a,['b3','b4','b5'][Math.floor(g.clock/100)%3],e.x,e.y,e.dir>0);
  else stamp(c,a,['3b','3c','3d','3f','3c','3e'][Math.floor(g.clock/100)%6],e.x,e.y,e.dir>0);
 }
 for(const core of g.cores){
  if(core.hp<=0){c.fillStyle='#080808';c.fillRect(core.x-12,core.y-12,24,24);continue;}
  c.fillStyle=core.hitAt&&g.clock-core.hitAt>=0&&g.clock-core.hitAt<55?'#f2784e':'#a40000';c.fillRect(core.x-12,core.y-13,24,26);c.strokeStyle='#ffbcb0';c.strokeRect(core.x-12.5,core.y-13.5,25,27);stamp(c,a,['5d','5e','5f'][Math.floor(g.clock/180)%3],core.x,core.y+8);
 }
 if(g.kind==='base'&&g.roomOpen){c.fillStyle='#000';c.fillRect(112,59,32,45);c.fillStyle='#fff';c.font='8px monospace';c.textAlign='center';c.fillText('GO!',128,135);c.textAlign='left';}
 const b=g.boss;
 if(b&&b.hp>0){
  if(g.level===6)stamp(c,a,['b7','b8','b9','ba'][Math.floor(g.clock/180)%4],b.x,b.y+14,b.phase%5>2.5);
  else if(g.level===5)stamp(c,a,['7c','7d','7e'][Math.floor(g.clock/150)%3],b.x,b.y,false,2);
  else if(g.kind==='base')for(let i=-1;i<=1;i++)stamp(c,a,['5d','60','61','62'][Math.floor(g.clock/120)%4],b.x+i*27,b.y-12);
  else if(g.level===8)stamp(c,a,['ac','ad','ae','af'][Math.floor(g.clock/150)%4],b.x,b.y-10,false,1.5);
  else if(g.level===1){c.fillStyle=Math.floor(g.clock/180)%2?'#e40058':'#a40000';c.fillRect(b.x-9,b.y-28,18,24);c.fillStyle='#fcbcb0';c.fillRect(b.x-3,b.y-22,6,12);}

 }
 for(const capsule of g.capsules)if(!capsule.opened)stamp(c,a,'4d',capsule.x,capsule.y+Math.sin(capsule.phase*3)*8+7);
 for(const item of g.pickups)stamp(c,a,({S:'2f',B:'30',F:'31',L:'32',R:'33',M:'34'})[item.type],item.x,item.y);
 for(const bullet of g.bullets){
  trail(c,bullet);
  if(bullet.weapon==='L'){c.save();c.translate(Math.round(bullet.x),Math.round(bullet.y));c.rotate(Math.atan2(bullet.vy,bullet.vx));stamp(c,a,'24',0,3);c.restore();}
  else stamp(c,a,bullet.weapon==='F'?'22':bullet.weapon==='S'?['1f','20','21'][Math.floor(g.clock/60)%3]:bullet.weapon==='M'?'1f':'07',bullet.x,bullet.y+2);
 }
 for(const bullet of g.enemyBullets){
  if(g.cheats?.slowBullets){c.fillStyle='#ffdf00';c.fillRect(Math.round(bullet.x)-3,Math.round(bullet.y)-3,6,6);c.fillStyle='#fff';c.fillRect(Math.round(bullet.x)-1,Math.round(bullet.y)-1,2,2);}
  else stamp(c,a,'1e',bullet.x,bullet.y+2);
 }
 for(const p of [g.player,g.p2?.player].filter(Boolean)){
 if(p.out)continue;
 c.save();const playerAssets=p.slot===1&&a.second?a.second:a;
 const phase=Math.floor(g.clock/100),aiming=g.clock-p.lastFire<250;
 let sprite;
 if(p.deadUntil>g.clock)sprite=['0a','0b','0c'][Math.max(0,Math.min(2,Math.floor((g.clock-(p.deadUntil-900))/250)))];
 else if(p.water)sprite=p.prone?'19':aiming&&p.aimY<-.5?'1c':'1b';
 else if(p.prone)sprite=g.kind==='base'?'06':'17';
 else if(g.kind==='base'&&p.onGround)sprite='02';
 else if(!p.onGround)sprite=['08','09'][phase%2];
 else if(aiming&&p.aimY<-.9)sprite='16';
 else if(aiming&&p.aimY<-.2)sprite=['10','11','12'][p.vx?phase%3:0];
 else if(aiming&&p.aimY>.2)sprite=['13','14','15'][p.vx?phase%3:0];
 else sprite=p.vx?['0d','0e','0f'][phase%3]:'0f';
 if(p.deadUntil>g.clock||p.invulnerableUntil<=g.clock||Math.floor(g.clock/70)%2===0)stamp(c,playerAssets,sprite,p.x,p.y,p.dir<0,1,!p.onGround&&!p.deadUntil&&phase%4>=2);
 if(g.cheats?.invincible&&!p.deadUntil){c.strokeStyle='#8cf4ff';c.strokeRect(Math.round(p.x)-9,Math.round(p.y)-p.h-2,18,p.h+4);}
 muzzle(c,g,p);
 c.filter='none';if(g.multiplayer){c.fillStyle=p.slot===1?'#76eaff':'#ffd977';c.font='6px monospace';c.fillText(p.slot===1?'2P':'1P',p.x-5,p.y-p.h-4);}c.restore();
 }
 for(const hit of g.impacts||[])sparks(c,g,hit);
 for(const e of g.explosions){explosionDebris(c,g,e);const frame=Math.max(0,Math.min(4,Math.floor((g.clock-e.bornAt)/90)));stamp(c,a,['37','36','35','39','3a'][frame],e.x,e.y+12,false,e.big?1.4:1);}
 if(g.bossDefeatedAt&&!reducedMotion?.matches){const ex=g.boss.x,ey=g.boss.y;for(let i=0;i<7;i++)stamp(c,a,['37','36','35'][Math.floor(g.clock/100+i)%3],ex+Math.sin(i*7+g.clock/100)*28,ey-30+Math.cos(i*5+g.clock/140)*25);}
 c.restore();
 c.fillStyle='#0009';c.fillRect(0,0,256,14);c.font='bold 8px monospace';c.fillStyle='#fff';c.fillText('1P '+String(g.score).padStart(6,'0'),7,10);c.fillText('REST '+(g.cheats?.infiniteLives?'INF':String(g.lives).padStart(2,'0')),184,10);
 c.fillStyle='#e40058';c.fillText(g.player.weapon+(g.player.rapid?' R':''),137,10);
 if(g.bossActive&&b){c.fillStyle='#222';c.fillRect(64,17,128,4);c.fillStyle='#d82800';c.fillRect(64,17,128*Math.max(0,b.hp/b.maxHP),4);}
 if(g.transitionUntil>g.clock){c.fillStyle='#000b';c.fillRect(0,0,256,224);c.fillStyle='#fff';c.font='10px monospace';c.fillText('NEXT AREA',96,110);}
}
