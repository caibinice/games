import GameSession from './vendor/engine/GameSession';
import InputManager from './vendor/input/InputManager';
import {PLAYER1_CONTROL} from './vendor/input/bindings';
import {PLAYER_SPAWN_POS} from './vendor/engine/constants';
import {seededRandom} from './vendor/engine/random';
import {stages} from './vendor/stages';
export {stages,GameSession,InputManager,PLAYER1_CONTROL,seededRandom};
export {default as TerrainMap} from './vendor/engine/map/TerrainMap';
export {parseStage,expandBots} from './vendor/engine/map/parseStage';
export {default as Tank} from './vendor/engine/entities/Tank';
export {default as Bullet} from './vendor/engine/entities/Bullet';
export {default as PowerUp} from './vendor/engine/entities/PowerUp';
export const LEVEL_COUNT=35,WIDTH=256,HEIGHT=240,TICK_MS=1000/60;
export const TITLE='坦克大战',STORAGE='fish-tank',MODES=[['classic','经典 · 3 辆坦克']];
export const levelInfo=(level:number)=>({name:`STAGE ${String(level).padStart(2,'0')}`,kind:'base-defense',description:'守卫老鹰 · 击退 20 辆敌军'});
export function newGame({level=1,seed=Date.now(),platform='pc',mode='classic'}={}){
  if(!Number.isInteger(level)||level<1||level>LEVEL_COUNT||!['pc','mobile'].includes(platform)||mode!=='classic')throw Error('Invalid tank options');
  let g:any;
  const session=new GameSession(stages,level-1,[{control:PLAYER1_CONTROL,color:'yellow',spawnPos:PLAYER_SPAWN_POS.player1}],
    {play:name=>g?.events.push({type:'sound',name})},{autopilot:false,random:seededRandom(seed)});
  g={version:1,level,seed,platform,mode,status:'ready',clock:0,score:0,lives:3,events:[],session,input:new InputManager([PLAYER1_CONTROL]),accumulator:0,lastVictory:0};
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
    g.session.step(TICK_MS,g.input);g.input.endTick();g.clock+=TICK_MS;g.accumulator=Math.max(0,g.accumulator-TICK_MS);
    const s=g.session,scene=s.scene;
    g.score=s.players[0].score;g.lives=s.players[0].lives+(scene?.tanks.some((t:any)=>t.side==='player'&&t.alive)||scene?.flickers.some((f:any)=>f.tank.side==='player')?1:0);
    if(scene?.status==='won'&&g.lastVictory!==g.level){g.lastVictory=g.level;g.events.push({type:'levelclear',level:g.level});}
    if(g.level!==s.stageIndex+1){g.level=s.stageIndex+1;g.events.push({type:'level',level:g.level});}
    if(s.phase==='ended'){g.status=s.cleared?'won':'lost';g.events.push({type:g.status});}
  }
}
// Cartridge-style checkpoints: keep stage progress; re-enter the current stage.
export const serialize=(g:any)=>JSON.stringify({version:1,level:g.level,seed:g.seed,platform:g.platform,mode:g.mode,status:'ready'});
export function restore(raw:any,platform?:string){try{const d=typeof raw==='string'?JSON.parse(raw):raw;if(d.version!==1||(platform&&platform!==d.platform))return null;return newGame(d);}catch{return null;}}
export function snapshot(g:any){return{level:g.level,status:g.status,clock:g.clock,score:g.score,lives:g.lives,...g.session.snapshot()};}
export function view(g:any){const p=g.session.scene?.tanks.find((t:any)=>t.side==='player');return{x:p?.x||0,y:p?.y||0,projectiles:g.session.scene?.bullets.length||0};}
export function summary(g:any){const scene=g.session.scene;return{weapon:scene?.tanks.find((t:any)=>t.side==='player')?.level||'basic',enemies:scene?.remainingBotCount??20,objective:'保护老鹰基地',phase:g.session.phase};}
