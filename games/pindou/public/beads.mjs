// The target stays visible around every bean. Empty and occupied cells use the
// same rounded-square footprint: a recessed socket, or a raised faceted bean.
// Entirely finished colors keep their raised shape, with a fixed glossy glint.
export const COLOR_FLASH_MS=720;
export function completionFlash(elapsed){
  return elapsed>=0&&elapsed<COLOR_FLASH_MS?Math.sin(Math.PI*elapsed/COLOR_FLASH_MS):0;
}
export function tint(hex,amount){
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  return '#'+channels.map(v=>Math.round(amount>=0?v+(255-v)*amount:v*(1+amount)).toString(16).padStart(2,'0')).join('');
}
export function beadGeometry(size){
  return {inset:size*.14,span:size*.72,radius:size*.14,lift:size*.085};
}
// A fixed-height game can expose an unlimited tray through contiguous row pages
// rather than a nested scrollbar or an ever-growing document.
export function visibleTrayRange(rows,offset=0,visibleRows=3){
  const count=Math.min(rows,Math.max(1,visibleRows)),maxOffset=Math.max(0,rows-count);
  offset=Math.min(maxOffset,Math.max(0,Math.floor(offset)||0));
  return {start:offset*12,end:(offset+count)*12,offset,maxOffset,count};
}
function rounded(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
export function drawBead(c,x,y,size,color,{empty=false,selected=false,number=null,targetColor=color,pop=0,completed=false,flash=0}={}){
  completed=completed&&!empty&&color===targetColor;
  const {inset,span,radius,lift}=beadGeometry(size),bx=x+inset,by=y+inset;
  c.save();
  // A continuous colored backplate, without white seams or decorative holes.
  c.fillStyle=targetColor;c.fillRect(x-.1,y-.1,size+.2,size+.2);
  if(empty){
    const recess=c.createLinearGradient(bx,by,bx+span*.2,by+span);
    recess.addColorStop(0,tint(targetColor,-.38));recess.addColorStop(.14,tint(targetColor,-.23));recess.addColorStop(.42,tint(targetColor,-.12));recess.addColorStop(1,tint(targetColor,-.04));
    c.fillStyle=recess;rounded(c,bx,by,span,span,radius);c.fill();
    c.strokeStyle=tint(targetColor,-.22);c.lineWidth=Math.max(.55,size*.025);c.stroke();
    c.beginPath();c.moveTo(bx+radius*.6,by+span-.3);c.lineTo(bx+span-radius,by+span-.3);c.quadraticCurveTo(bx+span,by+span,bx+span,by+span-radius);c.strokeStyle=tint(targetColor,.48);c.lineWidth=Math.max(.7,size*.04);c.stroke();
  }else{
    // Colored undersides and opposing facets supply depth, not extra symbols.
    c.save();c.shadowColor=tint(targetColor,-.35)+'66';c.shadowBlur=size*.045;c.shadowOffsetY=size*.04;
    c.fillStyle=tint(color,-.34);rounded(c,bx,by+lift,span,span,radius);c.fill();c.restore();
    const top=by-lift*.55,face=c.createLinearGradient(bx,top,bx,top+span);
    face.addColorStop(0,tint(color,.38));face.addColorStop(.22,tint(color,.12));face.addColorStop(1,tint(color,-.13));
    c.fillStyle=face;rounded(c,bx,top,span,span,radius);c.fill();
    c.save();c.clip();const cx=bx+span/2,cy=top+span/2;
    const facets=[[[bx,top],[bx+span,top],.27],[[bx+span,top],[bx+span,top+span],-.02],[[bx+span,top+span],[bx,top+span],-.17],[[bx,top+span],[bx,top],.11]];
    for(const [a,b,amount]of facets){c.fillStyle=tint(color,amount);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.lineTo(cx,cy);c.closePath();c.fill();}
    if(completed){
      // A static reflection laid over the original facets: no flattening,
      // recoloring, or perpetual animation, including in reduced-motion mode.
      const gloss=c.createLinearGradient(bx,top,bx+span,top+span);
      for(const [stop,color]of [[0,'#ffffff00'],[.16,'#ffffff00'],[.29,'#ffffff99'],[.39,'#ffffff18'],[.52,'#ffffff00'],[1,'#ffffff00']])gloss.addColorStop(stop,color);
      c.fillStyle=gloss;c.fillRect(bx,top,span,span);
    }
    c.restore();rounded(c,bx,top,span,span,radius);c.strokeStyle=tint(color,-.25);c.lineWidth=Math.max(.65,size*.035);c.stroke();
    c.beginPath();c.moveTo(bx+1,top+span*.6);c.lineTo(bx+1,top+radius);c.quadraticCurveTo(bx+1,top+1,bx+radius,top+1);c.lineTo(bx+span-radius,top+1);c.strokeStyle=tint(color,.55);c.lineWidth=Math.max(.65,size*.035);c.stroke();
  }
  // A single synchronized light pulse covers all cells of a newly finished color.
  if(completed&&flash>0){c.globalAlpha=Math.min(1,flash)*.65;c.fillStyle='#fffdf4';rounded(c,x+size*.035,y+size*.035,size*.93,size*.93,size*.12);c.fill();c.globalAlpha=1;}
  if(selected){
    rounded(c,x+size*.045,y+size*.045,size*.91,size*.91,size*.12);
    c.strokeStyle='#fffdf4';c.lineWidth=Math.max(2,size*.12);c.stroke();
    // Solid outlines mean picked-up beans; dashed outlines mean destinations.
    c.setLineDash(empty?[Math.max(2,size*.2),Math.max(1.5,size*.13)]:[]);
    c.strokeStyle=empty?'#315e9b':'#224f87';c.lineWidth=empty?Math.max(1.2,size*.06):Math.max(1.8,size*.08);c.stroke();c.setLineDash([]);
  }
  if(pop>0){c.globalAlpha=pop;rounded(c,x+size*.04,y+size*.04,size*.92,size*.92,size*.12);c.strokeStyle='#fff6a2';c.lineWidth=Math.max(1.5,size*.11);c.stroke();c.globalAlpha=1;}
  if(number!==null&&size>=13){c.font=`800 ${size*.38}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.strokeStyle='#59637b';c.lineWidth=Math.max(2,size*.09);c.strokeText(String(number),x+size/2,y+size/2);c.fillStyle='#fffdf4';c.fillText(String(number),x+size/2,y+size/2);}
  c.restore();
}
