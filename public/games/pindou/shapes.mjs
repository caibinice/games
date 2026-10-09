// Logical holes in a rectangular canvas make a genuinely non-rectangular board.
// A continuous background rim keeps stair-step edges orthogonally connected.
export function shapeTarget(target,width,height,rim=1){
  const colors=[...target],mask=Array(target.length).fill(false);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;if(!x||!y||x===width-1||y===height-1)colors[i]=0;
  }
  for(let i=0;i<colors.length;i++)if(colors[i]!==0){
    const x=i%width,y=Math.floor(i/width);
    for(let dy=-rim;dy<=rim;dy++)for(let dx=-rim;dx<=rim;dx++){
      const px=x+dx,py=y+dy;if(px>=0&&py>=0&&px<width&&py<height)mask[py*width+px]=true;
    }
  }
  // Keep enclosed areas playable, rather than punching tiny holes into an icon.
  const outside=new Set(),queue=[];
  const push=i=>{if(!mask[i]&&!outside.has(i)){outside.add(i);queue.push(i);}};
  for(let x=0;x<width;x++){push(x);push((height-1)*width+x);}
  for(let y=0;y<height;y++){push(y*width);push(y*width+width-1);}
  for(let q=0;q<queue.length;q++){const i=queue[q],x=i%width,y=Math.floor(i/width);if(x)push(i-1);if(x<width-1)push(i+1);if(y)push(i-width);if(y<height-1)push(i+width);}
  return colors.map((c,i)=>mask[i]||!outside.has(i)?c:null);
}
export function boundaryCells(target,width,height){
  return target.flatMap((c,i)=>{if(c===null)return [];const x=i%width,y=Math.floor(i/width);
    return !x||!y||x===width-1||y===height-1||[i-1,i+1,i-width,i+width].some(n=>target[n]===null)?[i]:[];
  });
}
// Trace the union of cells once, not one separate border around every cell.
export function outlineLoops(target,width,height){
  const edges=new Map(),key=(x,y)=>`${x},${y}`,add=(x,y,nx,ny)=>edges.set(key(x,y),[nx,ny]);
  for(let i=0;i<target.length;i++)if(target[i]!==null){
    const x=i%width,y=Math.floor(i/width);
    if(!y||target[i-width]===null)add(x,y,x+1,y);
    if(x===width-1||target[i+1]===null)add(x+1,y,x+1,y+1);
    if(y===height-1||target[i+width]===null)add(x+1,y+1,x,y+1);
    if(!x||target[i-1]===null)add(x,y+1,x,y);
  }
  const loops=[];
  while(edges.size){const start=edges.keys().next().value,points=[start.split(',').map(Number)];let at=start;
    do{const next=edges.get(at);if(!next)throw new Error('Disconnected board outline');edges.delete(at);points.push(next);at=key(...next);}while(at!==start);
    loops.push(points);
  }
  return loops;
}
