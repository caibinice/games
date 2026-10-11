import { LEVELS, getArtwork } from './artworks.mjs';
import { LEGACY_COUNTS } from './legacy-artworks.mjs';
import { PREVIOUS_ARTWORKS } from './previous-artworks.mjs';
export const ROW_SIZE = 12;
export const START_SECONDS = 180;
export function gameArtwork(game){return getArtwork(game.level,game.contour===true,game.artKey);}
export function random(seed) { return () => { seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }
export function scramble(level,seed=level.id*9817) {
  if(level.tutorialPairs){
    const board=[...level.target];
    for(const [a,b]of level.tutorialPairs)for(let i=0;i<a.length;i++)[board[a[i]],board[b[i]]]=[board[b[i]],board[a[i]]];
    return board;
  }
  const rng=random(seed);let best=[...level.target],score=-1;
  // Large batches along a 2D serpentine path, not random individual pixels.
  // Adjacent rows share colors, creating genuinely collectable color islands.
  const counts=level.palette.map((_,c)=>level.target.filter(v=>v===c).length);
  for(let attempt=0;attempt<24;attempt++){
    const chunks=[];
    for(let color=0;color<counts.length;color++){
      const batches=level.chapter>=2?2:1;
      for(let left=counts[color],parts=Math.min(batches,Math.max(1,Math.floor(left/24)));left>0;parts--){const n=Math.ceil(left/parts);chunks.push(Array(n).fill(color));left-=n;}
    }
    for(let i=chunks.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[chunks[i],chunks[j]]=[chunks[j],chunks[i]];}
    const beads=chunks.flat(),candidate=Array(level.target.length).fill(null),horizontal=rng()>.5,flipX=rng()>.5,flipY=rng()>.5;
    if(level.contoured){
      // Fill connected background regions in BFS order. Prefixes stay connected,
      // so the silhouette rim does not become a checkerboard of lone beans.
      const seen=new Set(),order=[],seeds=[...(level.boundary||[]),...level.target.map((_,i)=>i)];
      for(const seed of seeds){if(level.target[seed]===null||seen.has(seed))continue;const q=[seed],background=level.target[seed];seen.add(seed);
        for(let n=0;n<q.length;n++){const i=q[n];order.push(i);for(const j of neighbors(i,level.width,level.height))if(!seen.has(j)&&level.target[j]===background){seen.add(j);q.push(j);}}
      }
      order.forEach((i,n)=>candidate[i]=beads[n]);
    }else{
    const major=horizontal?level.height:level.width,minor=horizontal?level.width:level.height;let cursor=0;
    for(let a=0;a<major;a++)for(let b=0;b<minor;b++){
      let x=horizontal?(a%2?minor-b-1:b):a,y=horizontal?a:(a%2?minor-b-1:b);
      if(flipX)x=level.width-x-1;if(flipY)y=level.height-y-1;candidate[y*level.width+x]=beads[cursor++];
    }
    }
    const wrong=i=>level.target[i]!==null&&candidate[i]!==level.target[i];
    const edge=new Set(level.boundary||[]);
    let s=0;
    for(let i=0;i<candidate.length;i++)if(wrong(i)){
      s++;
      if(!neighbors(i,level.width,level.height).some(j=>wrong(j)&&candidate[j]===candidate[i]))s-=edge.has(i)?12:5;
    }
    if(s>score){best=candidate;score=s;}
  }
  return best;
}
export function newGame(id,seed,{rectangular=false,artKey}={}) {
  const level=getArtwork(id,!rectangular,artKey); if(!level)throw new Error('Invalid level');
  return { level:id,artKey:level.artKey,contour:!!level.contoured, board:scramble(level,seed),tray:Array(24).fill(null),rows:2,remaining:START_SECONDS,elapsed:0,moves:0,extensions:0,tools:{magnet:1,brush:1},selection:null,history:[],status:'playing' };
}
export function correctCount(game) {const target=gameArtwork(game).target;return game.board.reduce((n,v,i)=>n+(target[i]!==null&&v===target[i]),0);}
// A color settles only after every one of its target sockets is filled correctly.
// Derive this from the board so undo and restored sessions need no extra state.
export function completedColors(game) {
  const target=gameArtwork(game).target,colors=new Set(target.filter(c=>c!==null));
  for(let i=0;i<target.length;i++)if(target[i]!==null&&game.board[i]!==target[i])colors.delete(target[i]);
  return colors;
}
export function isWon(game) {return correctCount(game)===gameArtwork(game).cellCount;}
export function neighbors(index,w,h) {const x=index%w,y=Math.floor(index/w);return [x>0?index-1:-1,x<w-1?index+1:-1,y>0?index-w:-1,y<h-1?index+w:-1].filter(i=>i>=0);}
export function connected(game,index,mode='bead',limit=Infinity) {
  const level=gameArtwork(game),color=mode==='hole'?level.target[index]:game.board[index];
  if(color===null||color===undefined)return [];
  const matches=i=>mode==='hole'?game.board[i]===null&&level.target[i]===color:level.target[i]!==null&&game.board[i]===color&&game.board[i]!==level.target[i];
  if(!matches(index))return [];
  const found=[],queue=[index],seen=new Set([index]);
  for(let q=0;q<queue.length&&found.length<limit;q++){const i=queue[q];if(!matches(i))continue;found.push(i);for(const n of neighbors(i,level.width,level.height))if(!seen.has(n)){seen.add(n);queue.push(n);}}
  return found;
}
export function selectBoard(game,index,single=false) {
  if(game.status!=='playing')return {ok:false,reason:'paused'};
  const level=gameArtwork(game);
  if(!Number.isInteger(index)||index<0||index>=game.board.length||level.target[index]===null)return {ok:false,reason:'outside'};
  if(game.board[index]===null)return place(game,index);
  if(game.board[index]===level.target[index])return {ok:false,reason:'correct'};
  const indices=connected(game,index,'bead',single?1:Infinity);
  game.selection={source:'board',color:game.board[index],priorityBackground:level.target[index],indices};return {ok:true,selected:indices.length};
}
export function selectTray(game,index,single=false) {
  if(game.status!=='playing')return {ok:false,reason:'paused'};
  if(!Number.isInteger(index)||index<0||index>=game.tray.length)return {ok:false,reason:'outside'};
  if(game.tray[index]===null){if(game.selection?.source==='board')return storeSelection(game,index);return {ok:false,reason:'empty'};}
  const color=game.tray[index],limit=single?1:Infinity;
  const indices=[index];for(let i=0;i<game.tray.length&&indices.length<limit;i++)if(i!==index&&game.tray[i]===color)indices.push(i);
  game.selection={source:'tray',color,indices};return {ok:true,selected:indices.length};
}
function remember(game) {
  game.history.push({board:[...game.board],tray:[...game.tray],moves:game.moves,tools:{...game.tools}});
  if(game.history.length>30)game.history.shift();
}
export function organizeTray(game) {
  const selected=game.selection?.source==='tray'?new Set(game.selection.indices):null;
  const beads=game.tray.map((color,index)=>({color,index})).filter(v=>v.color!==null).sort((a,b)=>a.color-b.color||a.index-b.index);
  game.tray=[...beads.map(v=>v.color),...Array(game.tray.length-beads.length).fill(null)];
  if(selected)game.selection.indices=beads.flatMap((v,i)=>selected.has(v.index)?[i]:[]);
  return game.tray;
}
function finishAction(game,n,selection=null) {
  game.moves++;game.selection=selection?.indices.length?selection:null;organizeTray(game);
  if(isWon(game)){game.status='won';game.selection=null;}
  return {ok:true,moved:n,remaining:game.selection?.indices.length||0,won:game.status==='won'};
}
export function storeSelection(game,start=0) {
  if(game.status!=='playing'||game.selection?.source!=='board')return {ok:false,reason:'select'};
  const available=[];for(let offset=0;offset<game.tray.length;offset++){const i=(start+offset)%game.tray.length;if(game.tray[i]===null)available.push(i);}
  if(!available.length)return {ok:false,reason:'full'};
  remember(game);const selection=game.selection,n=Math.min(available.length,selection.indices.length);
  for(let i=0;i<n;i++){game.tray[available[i]]=game.board[selection.indices[i]];game.board[selection.indices[i]]=null;}
  selection.indices=selection.indices.slice(n);
  return {...finishAction(game,n,selection),route:'store'};
}
export function place(game,index) {
  if(game.status!=='playing'||!['board','tray'].includes(game.selection?.source))return {ok:false,reason:'select'};
  const selection=game.selection,level=gameArtwork(game);
  if(!Number.isInteger(index)||index<0||index>=game.board.length||level.target[index]===null)return {ok:false,reason:'outside'};
  if(game.board[index]!==null)return {ok:false,reason:'occupied'};
  if(level.target[index]!==selection.color)return {ok:false,reason:'color'};
  const holes=connected(game,index,'hole',selection.indices.length);
  remember(game);
  if(selection.source==='board'){
    // Stable origin-background priority, retained across multiple destination clicks.
    const preferred=selection.indices.filter(i=>level.target[i]===selection.priorityBackground);
    const rest=selection.indices.filter(i=>level.target[i]!==selection.priorityBackground);
    selection.indices=[...preferred,...rest];
  }
  for(let i=0;i<holes.length;i++){game.board[holes[i]]=selection.color;if(selection.source==='board')game.board[selection.indices[i]]=null;else game.tray[selection.indices[i]]=null;}
  selection.indices=selection.indices.slice(holes.length);
  return {...finishAction(game,holes.length,selection),route:selection.source==='board'?'direct':'tray',color:selection.color,placed:holes};
}
export function addRow(game) {game.rows++;game.tray.push(...Array(ROW_SIZE).fill(null));organizeTray(game);return game.rows;}
export function extend(game) {game.remaining+=START_SECONDS;game.extensions++;if(game.status==='timeout')game.status='playing';}
export function undo(game) {
  const previous=game.history.pop();if(!previous)return false;
  const rows=Math.max(game.rows,previous.tray.length/ROW_SIZE);
  Object.assign(game,previous);game.rows=rows;game.tray.push(...Array(rows*ROW_SIZE-game.tray.length).fill(null));game.selection=null;organizeTray(game);game.status=game.remaining>0?'playing':'timeout';return true;
}
export function brush(game) {
  if(game.status!=='playing'||game.tools.brush<1)return {ok:false,reason:'tool'};
  const target=gameArtwork(game).target,changes=[];
  const available=new Map();game.board.forEach((v,i)=>{if(v===null&&target[i]!==null){if(!available.has(target[i]))available.set(target[i],[]);available.get(target[i]).push(i);}});
  game.tray.forEach((color,i)=>{if(color!==null&&available.get(color)?.length)changes.push([i,available.get(color).shift(),color]);});
  if(!changes.length)return {ok:false,reason:'no-holes'};
  remember(game);game.tools.brush--;for(const [ti,bi,color]of changes){game.tray[ti]=null;game.board[bi]=color;}return finishAction(game,changes.length);
}
export function magnet(game) {
  if(game.status!=='playing'||game.tools.magnet<1)return {ok:false,reason:'tool'};
  const target=gameArtwork(game).target;let moved=0;remember(game);
  for(let i=0;i<game.board.length&&moved<10;i++){
    if(target[i]===null||game.board[i]===target[i])continue;
    let source=game.board.findIndex((v,j)=>j!==i&&v===target[i]&&v!==target[j]);
    if(source>=0){[game.board[source],game.board[i]]=[game.board[i],game.board[source]];moved++;continue;}
    source=game.tray.findIndex(v=>v===target[i]);
    if(source>=0){[game.tray[source],game.board[i]]=[game.board[i],game.tray[source]];moved++;}
  }
  if(!moved){game.history.pop();return {ok:false,reason:'nothing'};}
  game.tools.magnet--;return finishAction(game,moved);
}
export function inventoryValid(game) {
  const level=gameArtwork(game);if(!level||game.board.length!==level.target.length)return false;
  if(level.target.some((c,i)=>c===null&&game.board[i]!==null))return false;
  const counts=Array(level.palette.length).fill(0);for(const c of level.target)if(c!==null)counts[c]++;
  for(const c of [...game.board,...game.tray]){if(c===null)continue;if(!Number.isInteger(c)||c<0||c>=counts.length)return false;counts[c]--;}
  return counts.every(n=>n===0);
}
export function serialize(game) {
  return JSON.stringify({v:4,q:game.contour?1:0,k:gameArtwork(game).artKey,l:game.level,b:game.board.map(v=>v===null?'x':v.toString(36)).join(''),t:game.tray.filter(v=>v!==null).sort((a,b)=>a-b).map(v=>v.toString(36)).join(''),r:game.rows,s:Math.ceil(game.remaining),e:Math.floor(game.elapsed),m:game.moves,a:game.extensions,p:game.tools});
}
export function restore(raw) {
  try{
    const v=JSON.parse(raw),current=LEVELS[v.l-1],level=v.v>=3?getArtwork(v.l,false,v.k):current;
    if(![1,2,3,4].includes(v.v)||!Number.isInteger(v.l)||!level||(v.v===4&&(![0,1].includes(v.q)||v.q===1&&!level.contour))||typeof v.b!=='string'||typeof v.t!=='string'||!/^[0-9x]+$/.test(v.b)||!/^[0-9]*$/.test(v.t)||v.t.length>v.b.length||!Number.isInteger(v.r)||v.r<2||v.r>1000000)return null;
    const board=[...v.b].map(c=>c==='x'?null:parseInt(c,36)),tray=[...v.t].map(c=>parseInt(c,36));
    if(tray.length>v.r*12||![v.s,v.e,v.m,v.a].every(n=>Number.isFinite(n)&&n>=0)||!['magnet','brush'].every(k=>Number.isInteger(v.p?.[k])&&v.p[k]>=0))return null;
    const previous=PREVIOUS_ARTWORKS[v.l-1];
    const oldCounts=v.v===1&&v.l!==1?LEGACY_COUNTS[v.l-1]:v.v===2&&v.k===previous?.k&&v.k!==level.artKey?previous.counts:null;
    if(v.v<=2&&v.l>50)return null;
    if(oldCounts){
      // Both previous generations can have different dimensions/inventories.
      // Validate before migrating; never reinterpret old beads as the new icon.
      const counts=[...oldCounts];if(v.b.length!==counts.reduce((a,b)=>a+b,0))return null;
      for(const c of [...board,...tray])if(c!==null)counts[c]--;
      if(!counts.every(n=>n===0))return null;
      const migrated=newGame(v.l);migrated.rows=v.r;migrated.tray=Array(v.r*ROW_SIZE).fill(null);migrated.tools={...v.p};migrated.artworkMigrated=true;return migrated;
    }
    if(v.b.length!==level.target.length||(v.v>=2&&v.k!==level.artKey))return null;
    tray.push(...Array(v.r*12-tray.length).fill(null));
    const game={level:v.l,artKey:level.artKey,contour:v.v===4&&v.q===1,board,tray,rows:v.r,remaining:v.s,elapsed:v.e,moves:v.m,extensions:v.a,tools:v.p,selection:null,history:[],status:'playing'};
    if(!inventoryValid(game))return null;organizeTray(game);game.status=isWon(game)?'won':v.s<=0?'timeout':'playing';return game;
  }catch{return null;}
}
