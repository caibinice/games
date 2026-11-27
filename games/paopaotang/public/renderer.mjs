import {THEMES,SKINS,levelInfo} from './catalog.mjs';
import {WALL,CRATE,TRAP_MS,playerPosition,blastDangerous,BLAST_MS} from './engine.mjs';
const T=48;
const reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
const ring=(c,x,y,r,color,width=2)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
const waves=new WeakMap();
function waterLayout(blast,cols){
 const stored=waves.get(blast);if(stored?.cols===cols)return stored;
 const cells=new Set(blast.cells),ends=[];
 const [origin]=blast.cells;
 if(!Number.isInteger(origin))return null;
 const x=origin%cols,y=Math.floor(origin/cols),cx=x*T+24,cy=y*T+24;
 const shape=new Path2D();
 for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
  let tx=x,ty=y;
  while(tx+dx>=0&&tx+dx<cols&&cells.has((ty+dy)*cols+tx+dx)){tx+=dx;ty+=dy;}
  if(tx===x&&ty===y)continue;
  const ex=tx*T+24,ey=ty*T+24;shape.moveTo(cx,cy);shape.lineTo(ex,ey);ends.push([ex,ey,dx,dy]);
 }
 const broken=(Array.isArray(blast.broken)?blast.broken:[]).filter(i=>cells.has(i)).slice(0,4);
 const data={cols,cx,cy,shape,ends,broken};waves.set(blast,data);return data;
}
function drawWater(c,game,blast,time,detail,box){
 const layout=waterLayout(blast,game.cols);if(!layout)return;
 const {shape,cx,cy,ends,broken}=layout;
 const t=Math.max(0,time-blast.bornAt), danger=blastDangerous(game,blast);
 const fade=1-Math.min(1,t/BLAST_MS);
 // The solid cyan jet is dangerous; after the damage window only thin, pale foam remains.
 const pressure=Math.max(0,1-t/230);
 c.save();c.lineCap='round';c.lineJoin='round';
 const base=danger?15+12*pressure:5+4*fade;
 if(danger&&detail&&!reducedMotion?.matches){
  // Irregular moving lobes break up the silhouette of the jet without changing its footprint.
  c.globalAlpha=.7;
  for(const [x,y,dx,dy] of ends){
   const length=Math.abs(x-cx)+Math.abs(y-cy);
   for(let d=14+(t*.39)%20;d<length+6;d+=20){
    const side=Math.floor(d/20)%2?1:-1,drift=base*.28*side;
    circle(c,cx+dx*d-dy*drift,cy+dy*d+dx*drift,base*(.37+.08*Math.sin(d*.23-t*.04)),'#1a82bd');
   }
  }
 }
 const layers=danger?[['#144E79',base,.82],['#21AFDB',base*.79,1],['#a5efff',base*.43,.95],['#fffef0',base*.17,.9]]:[['#e3fbff',base,fade*.54]];
 for(const [color,width,alpha] of layers){
  c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.stroke(shape);circle(c,cx,cy,width/2,color);
 }
 if(detail&&!reducedMotion?.matches){
  const kick=Math.min(1,t/280),opacity=Math.max(0,1-kick);
  c.globalAlpha=opacity*.80;
  ring(c,cx,cy,11+kick*30,'#d6faff',3*(1-kick)+.7);
  for(let i=0;i<10;i++){
   const a=i*2.39996+(blast.id%11)*.19,s=9+(i%4)*5+(25+i%3*7)*kick;
   ellipse(c,cx+Math.cos(a)*s,cy+Math.sin(a)*s+kick*kick*10,2.8-i%3*.54,3.4-i%4*.48,i%3?'#6bd8f3':'#fffdf1');
  }
  for(const [x,y,dx,dy] of ends){
   if(danger){
    const length=Math.abs(x-cx)+Math.abs(y-cy),head=Math.min(length,5+t*.74);
    const hx=cx+dx*head,hy=cy+dy*head;
    line(c,hx-dx*9,hy-dy*9,hx,hy,'#e1ffff',3.6);
    for(let d=9+(t*.48)%23;d<length;d+=46){
     const drift=Math.sin(d*.21-t*.05)*base*.32;
     circle(c,cx+dx*d-dy*drift,cy+dy*d+dx*drift,2.0,'#f4fffa');
    }
   }
   for(let i=-1;i<=1;i++){
   const drift=i*(6+kick*13),j=6+kick*(9-i*i*3);
    circle(c,x+dx*j-dy*drift,y+dy*j+dx*drift,2.6-i*i*.5,'#eafcff');
   }
  }
  c.globalAlpha=fade*.95;
  for(const i of broken){
   const x=i%game.cols*T+24,y=Math.floor(i/game.cols)*T+24;
   for(let k=0;k<5;k++){
    const a=k*1.26+.37,d=6+kick*(16+k*2);
    c.save();c.translate(x+Math.cos(a)*d,y+Math.sin(a)*d+13*kick*kick);c.rotate(a+kick*4);
    c.fillStyle=k%2?'#fff0be':box;c.fillRect(-3,-2,7-k%3,5);c.restore();
   }
  }
 }
 c.restore();
}
const circle=(c,x,y,r,fill)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();};
function round(c,x,y,w,h,r,fill){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();}
function line(c,x,y,X,Y,color,width=2){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
function star(c,x,y,r,color){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?r*.47:r;c.lineTo(x+Math.cos(a)*k,y+Math.sin(a)*k);}c.closePath();c.fillStyle=color;c.fill();}
export function drawAvatar(c,x,y,skin=0,{size=1,dir='down',trapped=false,walk=0}={}){
  const s=SKINS[skin];c.save();c.translate(x,y);c.scale(size,size);
  ellipse(c,0,19,16,5,'#53686a23');
  const offset=trapped?0:Math.sin(walk)*1.6;c.translate(0,offset);
  ellipse(c,-7,17+Math.sin(walk)*2,6,4,s.dark);ellipse(c,7,17-Math.sin(walk)*2,6,4,s.dark);
  round(c,-13,-1,26,23,12,s.color);ellipse(c,0,8,8,8,'#ffffff4a');
  circle(c,-14,7,4,'#fff3df');circle(c,14,7,4,'#fff3df');
  if(s.ear==='bunny'){ellipse(c,-10,-25,5,13,s.color);ellipse(c,10,-25,5,13,s.color);ellipse(c,-10,-26,2.3,8,'#f3c3cb');ellipse(c,10,-26,2.3,8,'#f3c3cb');}
  else if(s.ear==='cat'){c.fillStyle=s.color;for(const d of[-1,1]){c.beginPath();c.moveTo(d*5,-19);c.lineTo(d*15,-29);c.lineTo(d*18,-11);c.fill();}}
  else{circle(c,-12,-20,7,s.color);circle(c,12,-20,7,s.color);circle(c,-12,-20,3.5,'#ffffff4a');circle(c,12,-20,3.5,'#ffffff4a');}
  ellipse(c,0,-10,19,18,s.color);ellipse(c,0,-7,13.5,12,'#fff3df');
  const look=dir==='left'?-2:dir==='right'?2:0;
  if(trapped){line(c,-8,-9,-3,-6,'#536274',1.7);line(c,3,-6,8,-9,'#536274',1.7);ellipse(c,0,-1,2.8,3,'#cf8e96');}
  else{circle(c,-5+look,-8,1.8,'#4e5e69');circle(c,5+look,-8,1.8,'#4e5e69');line(c,-1,-3,1,-3,'#cc9291',1.8);circle(c,-9,-3,2.1,'#e9aaab88');circle(c,9,-3,2.1,'#e9aaab88');}
  ellipse(c,-8,-18,4,2,'#ffffff50');c.restore();
}
export function drawItem(c,x,y,type,time=0,scale=1){
  c.save();c.translate(x,y+Math.sin(time/220+x)*2);c.scale(scale,scale);
  round(c,-13,-13,26,26,8,'#fffaf0');round(c,-11,-11,22,22,6,type==='power'?'#dbf1f7':type==='capacity'?'#e1eff8':type==='speed'?'#fae4de':type==='needle'?'#f4e2ee':'#f6efce');
  if(type==='capacity'){circle(c,-3,0,5,'#7bb9e5');circle(c,4,-3,5,'#a7d8ee');line(c,0,6,7,6,'#5685ab',2);line(c,3.5,2.5,3.5,9.5,'#5685ab',2);}
  if(type==='power'){line(c,-7,0,7,0,'#62b6d2',4);line(c,0,-7,0,7,'#62b6d2',4);circle(c,0,0,4,'#8bd1e5');}
  if(type==='speed'){round(c,-8,-3,16,10,4,'#e6a088');line(c,-5,-4,-3,-8,'#e6a088',4);circle(c,-5,9,2,'#a27775');circle(c,5,9,2,'#a27775');line(c,-10,-4,-14,-4,'#e6a088',1.5);}
  if(type==='needle'){line(c,-6,6,5,-5,'#c78ba5',3);line(c,3,-8,8,-3,'#c78ba5',3);line(c,-9,9,-6,6,'#c78ba5',1.5);line(c,-1,0,3,4,'#e4bdd1',4);}
  if(type==='shield'){c.fillStyle='#d9b75f';c.beginPath();c.moveTo(0,-9);c.lineTo(8,-5);c.lineTo(6,5);c.lineTo(0,10);c.lineTo(-6,5);c.lineTo(-8,-5);c.closePath();c.fill();line(c,-3,0,-1,3,'#fff8d6',2);line(c,-1,3,4,-3,'#fff8d6',2);}
  c.restore();
}
function wall(c,x,y,theme,themeIndex,border){
  ellipse(c,x+24,y+39,20,6,'#6372671c');
  if(border){round(c,x+4,y+8,40,33,11,theme.wall);round(c,x+6,y+5,36,29,11,theme.wall);ellipse(c,x+19,y+13,11,6,'#ffffff18');circle(c,x+32,y+25,2,'#ffffff2c');return;}
  round(c,x+7,y+15,34,28,7,'#6c7f842a');
  round(c,x+7,y+9,34,29,7,theme.wall);round(c,x+7,y+5,34,24,7,themeIndex===3?'#eef9fc':theme.wall);
  line(c,x+12,y+10,x+30,y+10,'#ffffff30',3);
  if(themeIndex===0||themeIndex===4){circle(c,x+21,y+12,11,theme.wall);circle(c,x+31,y+18,9,theme.wall);circle(c,x+15,y+21,9,theme.wall);circle(c,x+23,y+15,2,'#c1d59b');}
  else if(themeIndex===1){round(c,x+15,y+13,18,12,5,'#f5d2d8');circle(c,x+24,y+12,2,'#e7a882');}
  else{round(c,x+15,y+12,18,13,4,'#ffffff35');line(c,x+24,y+12,x+24,y+25,'#ffffff40');}
}
function crate(c,x,y,theme,themeIndex){
  round(c,x+6,y+12,36,33,6,'#7e795820');round(c,x+6,y+6,36,35,6,theme.box);
  if(themeIndex===1){round(c,x+8,y+5,32,15,5,'#f8d4cb');line(c,x+10,y+16,x+38,y+16,'#edb2b0',2);circle(c,x+24,y+9,3,'#cb8b9b');}
  else if(themeIndex===3){round(c,x+9,y+7,30,12,4,'#d6cae5');line(c,x+14,y+12,x+19,y+12,'#efdbd2',2);line(c,x+28,y+10,x+31,y+14,'#accfcf',2);}
  else{round(c,x+9,y+10,30,27,3,'#ffffff13');line(c,x+11,y+12,x+36,y+35,'#b88b622f',4);line(c,x+36,y+12,x+11,y+35,'#b88b622f',4);line(c,x+10,y+9,x+38,y+9,'#f4cf9b80',3);}
  circle(c,x+11,y+13,1.2,'#91755370');circle(c,x+37,y+33,1.2,'#91755370');
}
function drawBomb(c,x,y,time,placedAt,explodeAt){
  const fraction=Math.max(0,Math.min(1,(time-placedAt)/(explodeAt-placedAt)));
  const ready=fraction>.72,pulse=reducedMotion?.matches?1:1+Math.sin(time/(ready?70:150))*(ready?.065:.027);
  c.save();c.translate(x,y);c.scale(pulse,pulse);ellipse(c,0,13,14,4,'#5486a12e');
  const fill=c.createRadialGradient(-5,-6,2,0,0,16);fill.addColorStop(0,'#c7f2fc');fill.addColorStop(.5,'#80cceb');fill.addColorStop(1,'#559fcd');
  circle(c,0,0,15,fill);c.strokeStyle='#4a96c222';c.lineWidth=1;c.stroke();ellipse(c,-5,-5,4,6,'#e7fbfcaa');circle(c,7,7,2,'#b2e4f9');
  c.beginPath();c.arc(0,0,19,-Math.PI/2,-Math.PI/2+Math.PI*2*fraction);c.strokeStyle=ready?'#e38b52':'#246fa9';c.lineWidth=2.2;c.stroke();
  round(c,-4,-17,8,6,3,'#97bed0');line(c,0,-17,3,-22,'#d7b36e',2);star(c,3,-23,3+Math.sin(time/70),fraction>.7?'#ee9e79':'#f4d991');c.restore();
}
export function drawArena(canvas,game,visualTime=game.clock,presentationTime=game.clock){
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
  if(rect.width<1)return;
  const width=Math.round(rect.width*ratio),height=Math.round(rect.width*game.rows/game.cols*ratio);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const c=canvas.getContext('2d');c.setTransform(width/(game.cols*T),0,0,height/(game.rows*T),0,0);
  const themeIndex=levelInfo(game.level).theme,theme=THEMES[themeIndex];
  c.clearRect(0,0,game.cols*T,game.rows*T);
  for(let y=0;y<game.rows;y++)for(let x=0;x<game.cols;x++){
    c.fillStyle=(x+y)%2?theme.alt:theme.floor;c.fillRect(x*T,y*T,T,T);
    if(game.board[y*game.cols+x]===0){
      if((x*7+y*3)%11===0){line(c,x*T+8,y*T+34,x*T+9,y*T+30,'#9aaa7430');line(c,x*T+10,y*T+34,x*T+12,y*T+32,'#9aaa7430');}
      if((x*11+y*7)%19===0){circle(c,x*T+35,y*T+13,2,'#ffffff3f');circle(c,x*T+36,y*T+14,1,'#ddc68860');}
    }
  }
  // Draw every danger lane; only the six latest bursts get extra droplets and fragments.
  for(let i=0;i<game.blasts.length;i++)drawWater(c,game,game.blasts[i],presentationTime,game.blasts.length-i<=6,theme.box);
  for(const item of game.items)if(item.visibleAt<=game.clock)drawItem(c,item.x*T+24,item.y*T+24,item.type,visualTime);
  for(let y=0;y<game.rows;y++)for(let x=0;x<game.cols;x++){
    const value=game.board[y*game.cols+x];
    if(value===WALL)wall(c,x*T,y*T,theme,themeIndex,x===0||y===0||x===game.cols-1||y===game.rows-1);
    else if(value===CRATE)crate(c,x*T,y*T,theme,themeIndex);
  }
  for(const b of game.bombs)drawBomb(c,b.x*T+24,b.y*T+26,game.clock,b.placedAt,b.explodeAt);
  for(const p of [...game.players].sort((a,b)=>a.y-b.y)){
    if(p.status==='out')continue;
    const position=playerPosition(game,p,presentationTime),progress=position.progress;
    const x=position.x*T+24,y=position.y*T+25;
    c.save();
    if(p.invulnerableUntil>game.clock&&Math.floor(visualTime/110)%2)c.globalAlpha=.55;
    drawAvatar(c,x,y,p.skin,{size:.86,dir:p.dir,trapped:p.status==='trapped',walk:progress<1?progress*Math.PI*2:0});
    if(p.shield){c.beginPath();c.arc(x,y-4,21,0,Math.PI*2);c.strokeStyle='#eace73a0';c.lineWidth=2;c.stroke();}
    c.restore();
    if(p.status==='trapped'){
      const age=Math.max(0,game.clock-p.trappedAt),r=24+(!reducedMotion?.matches&&age<220?Math.sin(age/220*Math.PI)*4:0);
      circle(c,x,y-6,r,'#87dcfa88');ring(c,x,y-6,r,'#197da8',2.5);ellipse(c,x-9,y-17,4,8,'#effcffdc');
      if(age<240&&!reducedMotion?.matches)ring(c,x,y-6,r+age*.05,'#ecffff',1.8);
      c.beginPath();c.arc(x,y-6,26,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-(game.clock-p.trappedAt)/TRAP_MS));c.strokeStyle='#d78b9b';c.lineWidth=2.5;c.stroke();
    }
    if(p.team===0){
      round(c,x-11,y-37,22,12,5,p.control==='p2'?'#e9acbb':'#83b7d6');c.fillStyle='#fff';c.font='bold 8px system-ui';c.textAlign='center';c.fillText(p.control==='p2'?'P2':'P1',x,y-28);
    }
  }
}
export function avatarSVG(skin=0){
  const s=SKINS[skin];
  const ears=s.ear==='bunny'?'<ellipse cx="23" cy="19" rx="6" ry="15"/><ellipse cx="57" cy="19" rx="6" ry="15"/>':'<circle cx="21" cy="27" r="9"/><circle cx="59" cy="27" r="9"/>';
  return `<svg viewBox="0 0 80 90" aria-hidden="true"><ellipse cx="40" cy="82" rx="25" ry="5" fill="#769bac20"/><g fill="${s.color}">${ears}<rect x="20" y="48" width="40" height="34" rx="18"/><ellipse cx="40" cy="39" rx="28" ry="25"/></g><ellipse cx="40" cy="45" rx="20" ry="17" fill="#fff3df"/><circle cx="33" cy="42" r="2.5" fill="#4e5e69"/><circle cx="47" cy="42" r="2.5" fill="#4e5e69"/><path d="M38 49h4" stroke="#ce9693" stroke-width="2.5" stroke-linecap="round"/><circle cx="26" cy="49" r="3" fill="#e8aaa8"/><circle cx="54" cy="49" r="3" fill="#e8aaa8"/><ellipse cx="29" cy="80" rx="8" ry="5" fill="${s.dark}"/><ellipse cx="51" cy="80" rx="8" ry="5" fill="${s.dark}"/><circle cx="19" cy="66" r="6" fill="#fff3df"/><circle cx="61" cy="66" r="6" fill="#fff3df"/><circle cx="67" cy="23" r="9" fill="#b1e4f480"/><ellipse cx="64" cy="20" rx="2" ry="3" fill="#fff"/></svg>`;
}
