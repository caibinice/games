import {THEMES,SKINS,levelInfo} from './catalog.mjs';
import {WALL,CRATE,TRAP_MS,movementMs} from './engine.mjs';
const T=48;
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
  const fraction=(time-placedAt)/(explodeAt-placedAt),pulse=1+Math.sin(time/(fraction>.7?65:150))*.04;
  c.save();c.translate(x,y);c.scale(pulse,pulse);ellipse(c,0,13,14,4,'#5486a12e');
  const fill=c.createRadialGradient(-5,-6,2,0,0,16);fill.addColorStop(0,'#c7f2fc');fill.addColorStop(.5,'#80cceb');fill.addColorStop(1,'#559fcd');
  circle(c,0,0,15,fill);c.strokeStyle='#4a96c222';c.lineWidth=1;c.stroke();ellipse(c,-5,-5,4,6,'#e7fbfcaa');circle(c,7,7,2,'#b2e4f9');
  round(c,-4,-17,8,6,3,'#97bed0');line(c,0,-17,3,-22,'#d7b36e',2);star(c,3,-23,3+Math.sin(time/70),fraction>.7?'#ee9e79':'#f4d991');c.restore();
}
export function drawArena(canvas,game,visualTime=game.clock){
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
  for(const blast of game.blasts){
    const fraction=(blast.expiresAt-game.clock)/650;c.save();c.globalAlpha=Math.min(1,fraction*2)*.9;
    const set=new Set(blast.cells);
    for(const i of blast.cells){
      const x=i%game.cols*T+24,y=Math.floor(i/game.cols)*T+24;
      for(const delta of[1,game.cols])if(set.has(i+delta)){line(c,x,y,x+(delta===1?T:0),y+(delta===game.cols?T:0),'#6cc4e9',24);line(c,x,y,x+(delta===1?T:0),y+(delta===game.cols?T:0),'#a8e4f1',13);}
      circle(c,x,y,12,'#79cce8');circle(c,x,y,7,'#b4edf5');
      circle(c,x-6+Math.sin(visualTime/90+i)*3,y-7,2.2,'#ecfcf6');
    }
    c.restore();
  }
  for(const item of game.items)if(item.visibleAt<=game.clock)drawItem(c,item.x*T+24,item.y*T+24,item.type,visualTime);
  for(let y=0;y<game.rows;y++)for(let x=0;x<game.cols;x++){
    const value=game.board[y*game.cols+x];
    if(value===WALL)wall(c,x*T,y*T,theme,themeIndex,x===0||y===0||x===game.cols-1||y===game.rows-1);
    else if(value===CRATE)crate(c,x*T,y*T,theme,themeIndex);
  }
  for(const b of game.bombs)drawBomb(c,b.x*T+24,b.y*T+26,game.clock,b.placedAt,b.explodeAt);
  for(const p of [...game.players].sort((a,b)=>a.y-b.y)){
    if(p.status==='out')continue;
    const progress=Math.min(1,Math.max(0,(game.clock-p.movedAt)/(movementMs(p)*.72))),t=progress*(2-progress);
    const x=(p.fromX+(p.x-p.fromX)*t)*T+24,y=(p.fromY+(p.y-p.fromY)*t)*T+25;
    c.save();
    if(p.invulnerableUntil>game.clock&&Math.floor(visualTime/110)%2)c.globalAlpha=.55;
    drawAvatar(c,x,y,p.skin,{size:.86,dir:p.dir,trapped:p.status==='trapped',walk:progress<1?progress*Math.PI*2:0});
    if(p.shield){c.beginPath();c.arc(x,y-4,21,0,Math.PI*2);c.strokeStyle='#eace73a0';c.lineWidth=2;c.stroke();}
    c.restore();
    if(p.status==='trapped'){
      circle(c,x,y-6,24,'#a5e2f584');c.strokeStyle='#72bddd';c.lineWidth=2;c.stroke();ellipse(c,x-9,y-17,5,8,'#eafbfc9c');
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
