import {drawBrick,drawSteel,drawRiver,drawForest,drawSnow,drawEagleInitial,drawEagleBroken} from './vendor/render/sprites/terrain';
import {drawTank} from './vendor/render/sprites/tank';
import {drawHelmet} from './vendor/render/sprites/helmet';
import {drawFlicker} from './vendor/render/sprites/flicker';
import {drawPowerUp} from './vendor/render/sprites/powerup';
import {drawExplosion,explosionSize} from './vendor/render/sprites/explosion';
import {tankColor} from './vendor/render/tankColor';
const spriteCache=new Map<string,HTMLCanvasElement>();
function sprite(ctx:CanvasRenderingContext2D,key:string,w:number,h:number,x:number,y:number,paint:(c:CanvasRenderingContext2D)=>void){
  let canvas=spriteCache.get(key);if(!canvas){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d')!);spriteCache.set(key,canvas);}
  ctx.drawImage(canvas,Math.round(x),Math.round(y));
}
export async function loadAssets(){return{};}
export function draw(canvas:HTMLCanvasElement,g:any){
 const c=canvas.getContext('2d')!;c.imageSmoothingEnabled=false;c.fillStyle='#636363';c.fillRect(0,0,256,240);
 c.save();c.translate(8,16);c.fillStyle='#000';c.fillRect(0,0,208,208);
 const s=g.session,scene=s.scene;
 if(scene){const m=scene.map,time=scene.time;
  m.forEachBrick((x:number,y:number)=>sprite(c,'brick'+((x+y)/4%2),4,4,x,y,a=>drawBrick(a,((x+y)/4)%2===0)));
  m.forEachSteel((x:number,y:number)=>sprite(c,'steel',8,8,x,y,drawSteel));
  m.forEachSnow((x:number,y:number)=>sprite(c,'snow',16,16,x,y,drawSnow));
  const water=Math.floor(time/600)%2 as 0|1;
  m.forEachRiver((x:number,y:number)=>sprite(c,'river'+water,16,16,x,y,a=>drawRiver(a,water)));
  if(m.eagle)sprite(c,'eagle'+m.eagleBroken,16,16,m.eagle.x,m.eagle.y,m.eagleBroken?drawEagleBroken:drawEagleInitial);
  for(const p of scene.powerUps)if(p.visible)sprite(c,'item'+p.name,16,16,p.x,p.y,a=>drawPowerUp(a,p.name));
  for(const t of scene.tanks){if(!t.alive||!t.visible)continue;
   const color=tankColor(t,time),shape=t.moving?Math.floor(time/80)%2:0;
   c.save();c.translate(Math.round(t.x)+8,Math.round(t.y)+8);c.rotate(({up:0,right:1,down:2,left:3}as any)[t.direction]*Math.PI/2);
   sprite(c,`tank/${t.side}/${t.level}/${color}/${shape}`,16,16,-8,-8,a=>drawTank(a,t.side,t.level,color,shape as 0|1));c.restore();
   if(t.helmetDuration>0){const h=Math.floor(time/(1000/30))%2 as 0|1;sprite(c,'helmet'+h,16,16,t.x,t.y,a=>drawHelmet(a,h));}
  }
  for(const b of scene.bullets){c.fillStyle='#fff';c.fillRect(Math.round(b.x),Math.round(b.y),3,3);}
  for(const f of scene.flickers){const shape=f.shape();sprite(c,'spawn'+shape,16,16,f.x,f.y,a=>drawFlicker(a,shape));}
  m.forEachForest((x:number,y:number)=>sprite(c,'forest',16,16,x,y,drawForest));
  for(const e of scene.explosions){const shape=e.shape(),size=explosionSize(shape);sprite(c,'explosion'+shape,size,size,e.cx-size/2,e.cy-size/2,a=>drawExplosion(a,shape));}
  c.font='7px monospace';c.fillStyle='#fff';for(const p of scene.scorePopups)if(p.visible)c.fillText(String(p.score),p.x,p.y+6);
 }
 c.restore();c.font='bold 9px monospace';c.fillStyle='#000';c.fillText('IP',225,150);c.fillText(String(Math.max(0,g.lives-1)),237,161);
 const remaining=scene?.remainingBotCount??20;for(let i=0;i<remaining;i++){const x=225+i%2*9,y=18+Math.floor(i/2)*10;c.fillStyle='#000';c.fillRect(x,y,6,7);c.fillRect(x+2,y-2,2,4);c.fillStyle='#636363';c.fillRect(x+2,y+3,2,2);}
 c.fillStyle='#000';c.fillRect(226,184,2,17);c.fillStyle='#000';c.fillRect(228,184,12,8);c.fillStyle='#636363';c.fillRect(231,186,7,4);c.fillStyle='#000';c.fillText(String(g.level).padStart(2,'0'),229,213);
 if(s.phase==='enter'){const h=s.curtain*104;c.fillStyle='#636363';c.fillRect(8,16,208,h);c.fillRect(8,224-h,208,h);if(s.curtain>.95){c.fillStyle='#000';c.font='bold 12px monospace';c.textAlign='center';c.fillText(`STAGE ${g.level}`,112,124);c.textAlign='left';}}
 if(s.phase==='statistics'){c.fillStyle='#000';c.fillRect(0,0,256,240);c.textAlign='center';c.font='bold 12px monospace';c.fillStyle='#e79c21';c.fillText('STAGE '+g.level,128,35);c.fillStyle='#fff';c.fillText('BATTLE REPORT',128,60);c.fillStyle='#e79c21';c.fillText(String(g.score).padStart(6,'0'),128,85);
  const kills=scene?.killInfo[0]||{};['basic','fast','power','armor'].forEach((type,i)=>{sprite(c,'report'+type,16,16,65,105+i*24,a=>drawTank(a,'bot',type as any,'silver',0));c.fillStyle='#fff';c.fillText(String(kills[type]||0).padStart(2,'0')+'  HITS',151,118+i*24);});c.textAlign='left';}
 if(s.phase==='gameover'){c.fillStyle='#d64b36';c.textAlign='center';c.font='bold 14px monospace';c.fillText('GAME',112,218-s.gameoverProgress*96);c.fillText('OVER',112,234-s.gameoverProgress*96);c.textAlign='left';}
}
