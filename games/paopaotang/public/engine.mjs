import {LEVEL_COUNT, DIFFICULTIES, levelInfo, arenaSpec, aiProfile} from './catalog.mjs';
export const EMPTY=0, WALL=1, CRATE=2;
export const FUSE_MS=2400, DAMAGE_MS=220, BLAST_MS=360, TRAP_MS=4500;
export const HUMAN_MOVE_MS=165, SIMULATION_MS=10;
export const DIRECTIONS={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
const DIRECTIONS_LIST=Object.keys(DIRECTIONS);
export const indexOf=(game,x,y)=>y*game.cols+x;
export const inBounds=(game,x,y)=>x>=0&&y>=0&&x<game.cols&&y<game.rows;
function rng(game) {
  let t=game.seed+=0x6d2b79f5;
  t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);
  game.seed>>>=0;return((t^t>>>14)>>>0)/4294967296;
}
function actor(id,team,control,x,y,skin,game) {
  return {id,team,control,x,y,fromX:x,fromY:y,movedAt:0,nextMove:0,nextThink:0,skin,dir:'down',status:'active',
    capacity:1,power:2,speed:1,needles:1,shield:0,trappedAt:0,invulnerableUntil:1000,
    moveMs:control==='ai'?(game.version===1?DIFFICULTIES[game.difficulty].botMove:arenaSpec(game.level,game.platform,game.difficulty).botMove):HUMAN_MOVE_MS,
    lastBombAt:-10000,reactAt:0,threatUntil:0};
}
export const newGame=options=>createGame(options);
function createGame({platform='pc',mode='solo',difficulty='normal',level=1,skin=0,seed=Date.now()}={},legacy=false) {
  if(!['pc','mobile'].includes(platform)||!['solo','duo'].includes(mode)||(platform==='mobile'&&mode==='duo')||
     !DIFFICULTIES[difficulty]||!Number.isInteger(level)||level<1||level>LEVEL_COUNT||!Number.isInteger(skin)||skin<0||skin>4)throw Error('Invalid arena options');
  if(legacy&&level>12)throw Error('Invalid legacy level');
  const spec=arenaSpec(level,platform,difficulty),cols=legacy?(platform==='pc'?13:11):spec.cols,rows=legacy?11:spec.rows;
  const game={version:legacy?1:2,motionVersion:2,platform,mode,difficulty,level,skin,cols,rows,seed:Number(seed)>>>0,clock:0,
    remainingMs:(legacy?DIFFICULTIES[difficulty].seconds:spec.seconds)*1000,status:'ready',board:Array(cols*rows).fill(EMPTY),
    players:[],bombs:[],blasts:[],items:[],events:[],score:0,nextId:1,cratesBroken:0,enemiesOut:0};
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const solid=x===0||y===0||x===cols-1||y===rows-1||(x%2===0&&y%2===0);
    game.board[indexOf(game,x,y)]=solid?WALL:rng(game)<(legacy?DIFFICULTIES[difficulty].density:spec.density)?CRATE:EMPTY;
  }
  const spawns=[[1,1],[cols-2,rows-2],[cols-2,1],[1,rows-2]];
  // Each spawn needs a complete L-shaped retreat, not just an empty neighbor:
  // an initial two-cell water column otherwise seals a player into a corner.
  for(const[x,y]of spawns){
    const dx=x===1?1:-1,dy=y===1?1:-1;
    for(const[X,Y]of[[x,y],[x+dx,y],[x+dx*2,y],[x,y+dy],[x,y+dy*2],[x+dx*2,y+dy],[x+dx,y+dy*2]]){
      const i=indexOf(game,X,Y);if(inBounds(game,X,Y)&&game.board[i]!==WALL)game.board[i]=EMPTY;
    }
  }
  game.players.push(actor('p1',0,'p1',1,1,skin,game));
  if(mode==='duo')game.players.push(actor('p2',0,'p2',1,rows-2,(skin+1)%5,game));
  const enemies=mode==='duo'?2:difficulty==='hard'?3:legacy?(level<4?2:3):spec.enemies;
  for(let i=0;i<enemies;i++){
    const[x,y]=spawns[i+1],bot=actor('bot'+(i+1),1,'ai',x,y,(skin+i+2)%5,game);
    if(!legacy){bot.capacity=spec.stage>=3?2:1;bot.power=spec.stage>=4?3:2;}
    game.players.push(bot);
  }
  return game;
}
export function start(game){if(['ready','paused'].includes(game.status))game.status='running';}
export function pause(game){if(game.status==='running')game.status='paused';}
export const enemiesLeft=game=>game.players.filter(p=>p.team===1&&p.status!=='out').length;
export const livingTeam=game=>game.players.filter(p=>p.team===0&&p.status!=='out');
export const getPlayer=(game,id)=>game.players.find(p=>p.id===id);
export const movementMs=p=>Math.max(p.control==='ai'?180:115,p.moveMs-(p.speed-1)*25);
export function playerPosition(game,p,time=game.clock){
  const progress=Math.min(1,Math.max(0,(time-p.movedAt)/movementMs(p)));
  return{x:p.fromX+(p.x-p.fromX)*progress,y:p.fromY+(p.y-p.fromY)*progress,progress};
}
export const blastDangerous=(game,blast)=>game.clock<(blast.damageUntil??blast.expiresAt);
export function blastCells(game,bomb,board=game.board,bombs=game.bombs) {
  const cells=[indexOf(game,bomb.x,bomb.y)];
  for(const[dx,dy]of Object.values(DIRECTIONS))for(let distance=1;distance<=bomb.power;distance++){
    const x=bomb.x+dx*distance,y=bomb.y+dy*distance;
    if(!inBounds(game,x,y)||board[indexOf(game,x,y)]===WALL)break;
    const i=indexOf(game,x,y);cells.push(i);
    if(board[i]===CRATE||bombs.some(b=>b.id!==bomb.id&&b.x===x&&b.y===y))break;
  }
  return cells;
}
export function dangerMap(game,extraBomb=null) {
  const bombs=extraBomb?[...game.bombs,extraBomb]:game.bombs;
  const effective=new Map(bombs.map(b=>[b.id,b.explodeAt]));
  const areas=new Map(bombs.map(b=>[b.id,blastCells(game,b,game.board,bombs)]));
  for(let pass=0;pass<bombs.length;pass++)for(const a of bombs)for(const b of bombs){
    if(a.id!==b.id&&areas.get(a.id).includes(indexOf(game,b.x,b.y))&&effective.get(a.id)<effective.get(b.id))effective.set(b.id,effective.get(a.id));
  }
  const danger=new Map();
  for(const b of bombs)for(const i of areas.get(b.id))danger.set(i,Math.min(danger.get(i)??Infinity,effective.get(b.id)));
  for(const blast of game.blasts)if(blastDangerous(game,blast))for(const i of blast.cells)danger.set(i,game.clock);
  return danger;
}
function event(game,type,details={}){game.events.push({type,...details});}
export function plantBomb(game,id) {
  const p=getPlayer(game,id);
  if(game.status!=='running'||!p||p.status!=='active'||game.bombs.some(b=>b.x===p.x&&b.y===p.y)||
     game.bombs.filter(b=>b.owner===id).length>=p.capacity)return false;
  game.bombs.push({id:game.nextId++,owner:id,team:p.team,x:p.x,y:p.y,power:p.power,placedAt:game.clock,explodeAt:game.clock+FUSE_MS});
  p.lastBombAt=game.clock;event(game,'plant',{player:id});return true;
}
export function useNeedle(game,id) {
  const p=getPlayer(game,id);
  if(game.status!=='running'||!p||p.status!=='trapped'||p.needles<=0)return false;
  p.needles--;p.status='active';p.invulnerableUntil=game.clock+1400;event(game,'rescue',{player:id});return true;
}
function collect(game,p) {
  const item=game.items.find(i=>i.x===p.x&&i.y===p.y&&i.visibleAt<=game.clock);
  if(!item)return;
  game.items=game.items.filter(i=>i.id!==item.id);
  if(item.type==='capacity')p.capacity=Math.min(5,p.capacity+1);
  if(item.type==='power')p.power=Math.min(5,p.power+1);
  if(item.type==='speed')p.speed=Math.min(3,p.speed+1);
  if(item.type==='needle')p.needles=Math.min(3,p.needles+1);
  if(item.type==='shield')p.shield=Math.min(2,p.shield+1);
  if(p.team===0)game.score+=30;
  event(game,'pickup',{player:p.id,item:item.type});
}
function removePlayer(game,p,by=null) {
  if(p.status==='out')return;
  p.status='out';event(game,'out',{player:p.id,team:p.team});
  if(p.team===1){game.enemiesOut++;game.score+=250;}
  if(by?.team===0&&p.team===1)game.score+=50;
}
function finish(game) {
  if(game.status!=='running')return;
  if(!livingTeam(game).length){game.status='lost';event(game,'lose');}
  else if(enemiesLeft(game)===0){game.status='won';game.score+=Math.floor(game.remainingMs/1000)*5;event(game,'win');}
  else if(game.remainingMs<=0){game.status='lost';event(game,'lose');}
}
export function canWalk(game,p,x,y,{ignoreActors=false}={}) {
  if(!inBounds(game,x,y)||game.board[indexOf(game,x,y)]!==EMPTY||game.bombs.some(b=>b.x===x&&b.y===y))return false;
  return ignoreActors||!game.players.some(other=>other.id!==p.id&&other.status==='active'&&other.x===x&&other.y===y);
}
export function movePlayer(game,id,direction) {
  const p=getPlayer(game,id),delta=DIRECTIONS[direction];
  if(game.status!=='running'||!p||p.status!=='active'||!delta||game.clock<p.nextMove)return false;
  p.dir=direction;
  const x=p.x+delta[0],y=p.y+delta[1];
  if(!canWalk(game,p,x,y))return false;
  p.fromX=p.x;p.fromY=p.y;p.x=x;p.y=y;p.movedAt=game.clock;p.nextMove=game.clock+movementMs(p);
  for(const other of game.players.filter(other=>other.status==='trapped'&&other.x===x&&other.y===y)){
    if(other.team===p.team){other.status='active';other.invulnerableUntil=game.clock+1400;event(game,'rescue',{player:other.id,by:p.id});}
    else removePlayer(game,other,p);
  }
  collect(game,p);hitPlayers(game);finish(game);return true;
}
function hitPlayers(game) {
  for(const p of game.players){
    if(p.status!=='active'||p.invulnerableUntil>game.clock)continue;
    // Use the same interpolated centre as rendering. A logical destination
    // is reserved immediately, but it must not be hit before the sprite arrives.
    const position=playerPosition(game,p),cell=indexOf(game,Math.round(position.x),Math.round(position.y));
    const hit=game.blasts.find(b=>blastDangerous(game,b)&&b.cells.includes(cell));
    if(!hit)continue;
    if(p.shield){p.shield--;p.invulnerableUntil=game.clock+1400;event(game,'shield',{player:p.id});}
    else{p.status='trapped';p.trappedAt=game.clock;event(game,'trap',{player:p.id});}
  }
}
function detonate(game,ids) {
  const queue=[...ids],done=new Set(),originalBoard=[...game.board],originalBombs=[...game.bombs];
  while(queue.length){
    const id=queue.shift();if(done.has(id))continue;
    const bomb=originalBombs.find(b=>b.id===id);if(!bomb)continue;
    done.add(id);
    const cells=blastCells(game,bomb,originalBoard,originalBombs);
    for(const other of originalBombs)if(cells.includes(indexOf(game,other.x,other.y))&&!done.has(other.id))queue.push(other.id);
    game.blasts.push({id:game.nextId++,cells,owner:bomb.owner,team:bomb.team,bornAt:game.clock,damageUntil:game.clock+DAMAGE_MS,expiresAt:game.clock+BLAST_MS});
    for(const i of cells){
      game.items=game.items.filter(item=>indexOf(game,item.x,item.y)!==i||item.visibleAt>game.clock);
      if(game.board[i]!==CRATE)continue;
      game.board[i]=EMPTY;game.cratesBroken++;if(bomb.team===0)game.score+=20;
      if(rng(game)<.54){
        const types=game.version===1?['capacity','power','speed','needle','shield']:levelInfo(game.level).itemTypes;
        // New drops are visible only once the water column has passed.
        game.items.push({id:game.nextId++,x:i%game.cols,y:Math.floor(i/game.cols),type:types[Math.floor(rng(game)*types.length)],visibleAt:game.clock+BLAST_MS});
      }
    }
    event(game,'burst',{x:bomb.x,y:bomb.y});
  }
  game.bombs=game.bombs.filter(b=>!done.has(b.id));hitPlayers(game);
}
function route(game,p,target,{danger=dangerMap(game),extraBomb=null,escape=false}={}) {
  const start=indexOf(game,p.x,p.y),queue=[{x:p.x,y:p.y,first:null,depth:0}],visited=new Set([start]);
  for(let n=0;n<queue.length;n++){
    const node=queue[n],i=indexOf(game,node.x,node.y);
    if(node.depth&&target(i,node))return node.first;
    // Limit costly planning and avoid a route whose travel time exceeds a fuse.
    if(escape&&node.depth>9)continue;
    for(const direction of DIRECTIONS_LIST){
      const[dx,dy]=DIRECTIONS[direction],x=node.x+dx,y=node.y+dy,cell=indexOf(game,x,y);
      if(visited.has(cell)||!canWalk(game,p,x,y)||extraBomb&&extraBomb.x===x&&extraBomb.y===y)continue;
      const arrives=game.clock+(node.depth+1)*movementMs(p);
      if(danger.has(cell)&&danger.get(cell)<arrives+450)continue;
      visited.add(cell);queue.push({x,y,first:node.first||direction,depth:node.depth+1});
    }
  }
  return null;
}
export function escapeDirection(game,p,extraBomb=null) {
  const danger=dangerMap(game,extraBomb);
  return route(game,p,i=>!danger.has(i),{danger,extraBomb,escape:true});
}
function adjacentCrate(game,p){return Object.values(DIRECTIONS).some(([dx,dy])=>game.board[indexOf(game,p.x+dx,p.y+dy)]===CRATE);}
export function decideAI(game,p) {
  if(p.status!=='active'||game.clock<p.nextMove||game.clock<(p.nextThink||0))return {};
  p.nextThink=game.clock+80;
  const danger=dangerMap(game),here=indexOf(game,p.x,p.y);
  if(danger.has(here)){
    if(!p.threatUntil||game.clock>=p.threatUntil){
      const profile=aiProfile(game.level,game.difficulty),deadline=danger.get(here);
      // Roll once per threat, never every simulation tick. A bot can hesitate
      // until close to impact, but still checks an exit before its own bomb.
      const ownBomb=game.bombs.some(b=>b.owner===p.id&&b.x===p.x&&b.y===p.y);
      const mistaken=!ownBomb&&rng(game)<profile.mistake;
      const delay=mistaken?Math.max(profile.reaction,deadline-game.clock-120-rng(game)*180):profile.reaction+rng(game)*80;
      p.reactAt=game.clock+delay;p.threatUntil=deadline+DAMAGE_MS;
    }
    if(game.clock<p.reactAt)return {};
    return {direction:escapeDirection(game,p)};
  }
  p.threatUntil=0;p.reactAt=0;
  const friends=game.players.filter(o=>o.team===p.team&&o.status==='trapped');
  if(friends.length){const targets=new Set(friends.map(f=>indexOf(game,f.x,f.y)));const dir=route(game,p,i=>targets.has(i));if(dir)return{direction:dir};}
  const phantom={id:-1,owner:p.id,team:p.team,x:p.x,y:p.y,power:p.power,placedAt:game.clock,explodeAt:game.clock+FUSE_MS};
  const enemyInRange=game.players.some(o=>o.team!==p.team&&o.status!=='out'&&blastCells(game,phantom).includes(indexOf(game,o.x,o.y)));
  if((enemyInRange||adjacentCrate(game,p))&&game.clock-p.lastBombAt>1500&&rng(game)<DIFFICULTIES[game.difficulty].botBomb){
    const direction=escapeDirection(game,p,phantom);
    if(direction&&game.bombs.filter(b=>b.owner===p.id).length<p.capacity)return {bomb:true,direction};
  }
  const items=game.items.filter(i=>i.visibleAt<=game.clock);
  if(items.length){const targets=new Set(items.map(i=>indexOf(game,i.x,i.y)));const direction=route(game,p,i=>targets.has(i));if(direction)return{direction};}
  const targets=game.players.filter(o=>o.team!==p.team&&o.status!=='out');
  let direction=route(game,p,(i,node)=>targets.some(o=>Math.abs(o.x-node.x)+Math.abs(o.y-node.y)<=1));
  if(!direction)direction=route(game,p,(i,node)=>adjacentCrate(game,node));
  if(!direction){const choices=DIRECTIONS_LIST.filter(d=>{const[dx,dy]=DIRECTIONS[d];return canWalk(game,p,p.x+dx,p.y+dy)&&!danger.has(indexOf(game,p.x+dx,p.y+dy));});direction=choices[Math.floor(rng(game)*choices.length)];}
  return {direction};
}
export function applyInput(game,id,command={}){
  if(game.status!=='running')return{moved:false,bomb:false,needle:false};
  const needle=!!command.needle&&useNeedle(game,id);
  const bomb=!!command.bomb&&plantBomb(game,id);
  const moved=!!command.direction&&movePlayer(game,id,command.direction);
  return{moved,bomb,needle};
}
export function step(game,milliseconds,inputs={},{ai=true}={}) {
  game.events=[];
  if(game.status!=='running'||!Number.isFinite(milliseconds)||milliseconds<=0)return;
  const delta=Math.min(100,milliseconds);game.clock+=delta;game.remainingMs=Math.max(0,game.remainingMs-delta);
  game.blasts=game.blasts.filter(b=>b.expiresAt>game.clock);
  const due=game.bombs.filter(b=>b.explodeAt<=game.clock).map(b=>b.id);if(due.length)detonate(game,due);
  hitPlayers(game);
  for(const p of game.players){
    if(p.status==='trapped'&&game.clock-p.trappedAt>=TRAP_MS)removePlayer(game,p);
  }
  finish(game);if(game.status!=='running')return;
  for(const p of game.players){
    const command=p.control==='ai'?(ai?decideAI(game,p):{}):inputs[p.control]||{};
    applyInput(game,p.id,command);
  }
  hitPlayers(game);finish(game);
}
export function stars(game){
  if(game.status!=='won')return 0;
  const allAlive=livingTeam(game).length===(game.mode==='duo'?2:1);
  return allAlive&&game.remainingMs>45000?3:game.remainingMs>15000?2:1;
}
export const serialize=game=>JSON.stringify({...game,events:[]});
export function restore(raw,platform) {
  try{
    const g=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);
    const original=createGame({platform:g.platform,mode:g.mode,difficulty:g.difficulty,level:g.level,skin:g.skin,seed:0},g.version===1);
    if(![1,2].includes(g.version)||(platform&&g.platform!==platform)||g.cols!==original.cols||g.rows!==original.rows||
       !['ready','running','paused','won','lost'].includes(g.status)||!Array.isArray(g.board)||g.board.length!==g.cols*g.rows||
       g.board.some(v=>![EMPTY,WALL,CRATE].includes(v)))return null;
    for(let i=0;i<g.board.length;i++)if((g.board[i]===WALL)!==(original.board[i]===WALL))return null;
    for(const key of ['clock','remainingMs','seed','score','nextId','cratesBroken','enemiesOut'])if(!Number.isFinite(g[key])||g[key]<0||g[key]>1e10)return null;
    if(!Array.isArray(g.players)||g.players.length!==original.players.length||!Array.isArray(g.bombs)||g.bombs.length>20||
       !Array.isArray(g.blasts)||g.blasts.length>30||!Array.isArray(g.items)||g.items.length>g.board.length)return null;
    const location=o=>Number.isInteger(o.x)&&Number.isInteger(o.y)&&inBounds(g,o.x,o.y)&&g.board[indexOf(g,o.x,o.y)]===EMPTY;
    const legacyTiming=g.players.some(p=>p.control!=='ai'&&p.moveMs===190);
    for(let i=0;i<g.players.length;i++){
      const p=g.players[i],expected=original.players[i];
      p.nextThink??=0;p.reactAt??=0;p.threatUntil??=0;
      if(p.id!==expected.id||p.team!==expected.team||p.control!==expected.control||!location(p)||
         !['active','trapped','out'].includes(p.status)||!DIRECTIONS[p.dir]||!Number.isInteger(p.skin)||p.skin<0||p.skin>4)return null;
      for(const[key,max]of[['capacity',5],['power',5],['speed',3],['needles',3],['shield',2]])if(!Number.isInteger(p[key])||p[key]<(key==='needles'||key==='shield'?0:1)||p[key]>max)return null;
      for(const key of ['fromX','fromY','movedAt','nextMove','nextThink','trappedAt','invulnerableUntil','moveMs','lastBombAt','reactAt','threatUntil'])if(!Number.isFinite(p[key]))return null;
      if(p.control!=='ai'&&[125,190].includes(p.moveMs)){
        // Keep old rounds, but migrate their speed and the unconsumed part of
        // an in-flight move instead of retaining the old 190ms cooldown.
        const eased=p.moveMs===190,oldDuration=eased?Math.max(95,190-(p.speed-1)*32):Math.max(75,125-(p.speed-1)*25);
        const oldProgress=Math.min(1,Math.max(0,(g.clock-p.movedAt)/(oldDuration*(eased?.72:1))));
        const progress=eased?oldProgress*(2-oldProgress):oldProgress;
        p.moveMs=HUMAN_MOVE_MS;p.movedAt=g.clock-progress*movementMs(p);
        p.nextMove=p.movedAt+movementMs(p);
      }
      if(p.control==='ai'&&g.version===1&&g.motionVersion!==2){
        const oldDuration=Math.max(95,p.moveMs-(p.speed-1)*32);
        const oldProgress=Math.min(1,Math.max(0,(g.clock-p.movedAt)/(oldDuration*.72)));
        // v1 with 125ms humans used linear motion; the original 190ms build eased it.
        const progress=legacyTiming?oldProgress*(2-oldProgress):Math.min(1,Math.max(0,(g.clock-p.movedAt)/oldDuration));
        p.movedAt=g.clock-progress*movementMs(p);p.nextMove=p.movedAt+movementMs(p);
      }
      if(p.moveMs!==expected.moveMs||!inBounds(g,p.fromX,p.fromY))return null;
    }
    const ids=new Set();
    for(const b of g.bombs){
      if(!location(b)||!Number.isInteger(b.id)||ids.has(b.id)||!getPlayer(g,b.owner)||b.team!==getPlayer(g,b.owner).team||
         !Number.isInteger(b.power)||b.power<1||b.power>5||!Number.isFinite(b.explodeAt)||b.explodeAt<g.clock||
         !Number.isFinite(b.placedAt)||b.placedAt>g.clock)return null;ids.add(b.id);
    }
    for(const b of g.blasts){
      if(!Array.isArray(b.cells)||b.cells.length>21||b.cells.some(i=>!Number.isInteger(i)||i<0||i>=g.board.length||g.board[i]===WALL)||!Number.isFinite(b.expiresAt)||b.expiresAt<g.clock)return null;
      if(b.damageUntil===undefined){b.bornAt=b.expiresAt-650;b.damageUntil=b.bornAt+DAMAGE_MS;b.expiresAt=b.bornAt+BLAST_MS;}
      if(!Number.isFinite(b.bornAt)||!Number.isFinite(b.damageUntil)||b.bornAt>g.clock||b.damageUntil<b.bornAt||b.damageUntil>b.expiresAt)return null;
    }
    g.blasts=g.blasts.filter(b=>b.expiresAt>g.clock);
    for(const item of g.items){
      if(!location(item)||!['capacity','power','speed','needle','shield'].includes(item.type)||!Number.isFinite(item.visibleAt))return null;
      if(legacyTiming&&item.visibleAt>g.clock)item.visibleAt=Math.max(g.clock,item.visibleAt-(650-BLAST_MS));
    }
    if(g.status==='won'&&enemiesLeft(g)>0||g.status==='running'&&(!livingTeam(g).length||!enemiesLeft(g)||g.remainingMs<=0))return null;
    g.motionVersion=2;g.events=[];return g;
  }catch{return null;}
}
