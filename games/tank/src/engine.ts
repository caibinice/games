import GameSession from './vendor/engine/GameSession';
import InputManager from './vendor/input/InputManager';
import {PLAYER1_CONTROL} from './vendor/input/bindings';
import {PLAYER_SPAWN_POS} from './vendor/engine/constants';
import {seededRandom} from './vendor/engine/random';
import {stages} from './vendor/stages';
import PowerUp from './vendor/engine/entities/PowerUp';
import {canTankMove} from './vendor/engine/physics/collision';
export {stages,GameSession,InputManager,PLAYER1_CONTROL,seededRandom};
export {default as TerrainMap} from './vendor/engine/map/TerrainMap';
export {parseStage,expandBots} from './vendor/engine/map/parseStage';
export {default as Tank} from './vendor/engine/entities/Tank';
export {default as Bullet} from './vendor/engine/entities/Bullet';
export {default as PowerUp} from './vendor/engine/entities/PowerUp';
export const LEVEL_COUNT=35,WIDTH=256,HEIGHT=240,TICK_MS=1000/60;
export const TITLE='坦克大战',STORAGE='fish-tank',MODES=[['classic','经典 · 3 辆坦克']];
export const CHEAT_OPTIONS=[
 {key:'infiniteLives',label:'无限坦克',description:'阵亡后持续重生；老鹰基地仍需保护。'},
 {key:'rapidFire',label:'超级连发',description:'按住开火高速发射，最多同时 8 发玩家子弹。'},
 {key:'autoPowerUps',label:'自动随机道具',description:'战斗中每 8 秒在身边空地生成随机道具。'},
];
export const normalizeCheats=(raw:any={})=>Object.fromEntries(CHEAT_OPTIONS.map(o=>[o.key,raw?.[o.key]===true]));
export const isAssisted=(g:any)=>g.assisted===true;
export function setCheat(g:any,key:string,enabled:boolean){if(!CHEAT_OPTIONS.some(o=>o.key===key)||typeof enabled!=='boolean')return false;g.cheats[key]=enabled;if(enabled)g.assisted=true;if(key==='autoPowerUps')g.nextCheatDrop=g.clock+8000;return true;}
export function spawnRandomPowerUp(g:any){
 const scene=g.session.scene,player=scene?.tanks.find((t:any)=>t.side==='player'&&t.alive);
 if(!['running','paused'].includes(g.status)||g.session.phase!=='playing'||scene?.status!=='playing'||!player)return null;
 const positions:any[]=[];const world={map:scene.map,tanks:[],restrictedAreas:[]};
 // Only fully walkable nearby cells; never put a cheat item inside a wall/river/base.
 for(let y=0;y<=192;y+=8)for(let x=0;x<=192;x+=8){const d=Math.hypot(x-player.x,y-player.y);if(d<20||d>56||scene.powerUps.some((p:any)=>!p.dead&&Math.hypot(p.x-x,p.y-y)<16))continue;
  if(canTankMove(world,{rect:()=>({x,y,width:16,height:16})} as any))positions.push({x,y});}
 const pos=positions.length?positions[Math.floor(g.cheatRandom()*positions.length)]:{x:player.x,y:player.y};
 const names=['tank','star','grenade','timer','helmet','shovel'] as const,name=names[Math.floor(g.cheatRandom()*names.length)];
 if(scene.powerUps.length>=6)scene.powerUps.splice(0,scene.powerUps.length-5);
 scene.powerUps.push(new PowerUp(name,pos.x,pos.y));g.assisted=true;g.events.push({type:'sound',name:'powerup_appear'});return name;
}
export const levelInfo=(level:number)=>({name:`STAGE ${String(level).padStart(2,'0')}`,kind:'base-defense',description:'守卫老鹰 · 击退 20 辆敌军'});
export function newGame({level=1,seed=Date.now(),platform='pc',mode='classic',cheats={},assisted=false}={}){
  if(!Number.isInteger(level)||level<1||level>LEVEL_COUNT||!['pc','mobile'].includes(platform)||mode!=='classic')throw Error('Invalid tank options');
  let g:any;
  const session=new GameSession(stages,level-1,[{control:PLAYER1_CONTROL,color:'yellow',spawnPos:PLAYER_SPAWN_POS.player1}],
    {play:name=>g?.events.push({type:'sound',name})},{autopilot:false,random:seededRandom(seed)});
  const options=normalizeCheats(cheats);
  g={version:1,level,seed,platform,mode,status:'ready',clock:0,score:0,lives:3,events:[],session,input:new InputManager([PLAYER1_CONTROL]),accumulator:0,lastVictory:0,cheats:options,assisted:assisted===true||Object.values(options).some(Boolean),cheatRandom:seededRandom((Number(seed)>>>0)^0x614f39b2),nextCheatDrop:8000};
  return g;
}
export function start(g:any){if(['ready','paused'].includes(g.status))g.status='running';}
export function pause(g:any){if(g.status==='running'){g.status='paused';for(const key of Object.values(PLAYER1_CONTROL))g.input.keyUp(key);}}
export function step(g:any,milliseconds:number,command:any={}){
  g.events=[];
  if(g.status!=='running'||!Number.isFinite(milliseconds)||milliseconds<=0)return;
  for(const [action,code]of Object.entries(PLAYER1_CONTROL))if(!command[action])g.input.keyUp(code);
  for(const action of command.order||Object.keys(PLAYER1_CONTROL))if(command[action]&&action in PLAYER1_CONTROL)g.input.keyDown((PLAYER1_CONTROL as any)[action]);
  g.accumulator+=Math.min(100,milliseconds);
  while(g.accumulator+1e-8>=TICK_MS&&g.status==='running'){
    const before=g.session.scene;
    g.session.players[0].infiniteLives=g.cheats.infiniteLives;
    if(g.cheats.infiniteLives&&before?.status==='playing'&&!before.tanks.some((t:any)=>t.side==='player'&&t.alive)&&!before.flickers.some((f:any)=>f.tank.side==='player'))g.session.players[0].lives=Math.max(1,g.session.players[0].lives);
    for(const t of before?.tanks||[])if(t.side==='player'){t.rapidFire=g.cheats.rapidFire;if(t.rapidFire)t.cooldown=Math.min(t.cooldown,75);}
    g.session.step(TICK_MS,g.input);g.input.endTick();g.clock+=TICK_MS;g.accumulator=Math.max(0,g.accumulator-TICK_MS);
    const s=g.session,scene=s.scene;
    g.score=s.players[0].score;g.lives=s.players[0].lives+(scene?.tanks.some((t:any)=>t.side==='player'&&t.alive)||scene?.flickers.some((f:any)=>f.tank.side==='player')?1:0);
    if(scene?.status==='won'&&g.lastVictory!==g.level){g.lastVictory=g.level;g.events.push({type:'levelclear',level:g.level});}
    if(g.level!==s.stageIndex+1){g.level=s.stageIndex+1;g.events.push({type:'level',level:g.level});}
    if(s.phase==='ended'){g.status=s.cleared?'won':'lost';g.events.push({type:g.status});}
    if(!g.cheats.autoPowerUps)g.nextCheatDrop=g.clock+8000;
    else if(s.phase==='playing'&&scene?.status==='playing'&&g.clock>=g.nextCheatDrop){spawnRandomPowerUp(g);g.nextCheatDrop=g.clock+8000;}
  }
}
// Cartridge-style checkpoints: keep stage progress; re-enter the current stage.
export const serialize=(g:any)=>JSON.stringify({version:1,level:g.level,seed:g.seed,platform:g.platform,mode:g.mode,status:'ready',cheats:g.cheats,assisted:g.assisted});
export function restore(raw:any,platform?:string){try{const d=typeof raw==='string'?JSON.parse(raw):raw;if(d.version!==1||(platform&&platform!==d.platform))return null;return newGame(d);}catch{return null;}}
export function snapshot(g:any){return{level:g.level,status:g.status,clock:g.clock,score:g.score,lives:g.lives,...g.session.snapshot()};}
export function view(g:any){const p=g.session.scene?.tanks.find((t:any)=>t.side==='player');return{x:p?.x||0,y:p?.y||0,projectiles:g.session.scene?.bullets.length||0};}
export function summary(g:any){const scene=g.session.scene;return{weapon:scene?.tanks.find((t:any)=>t.side==='player')?.level||'basic',enemies:scene?.remainingBotCount??20,objective:'保护老鹰基地',phase:g.session.phase};}
