import * as engine from './engine.mjs';
import {loadAssets,draw} from './renderer.mjs';
import {createAudio} from './audio.mjs';
import {setupFullscreen} from './fullscreen.mjs';
const $=id=>document.getElementById(id),platform=document.body.dataset.platform,id=document.body.dataset.game;
const KEY=`${engine.STORAGE}:${platform}:v1`,canvas=$('game-canvas');
let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
let game=engine.restore(stored.game,platform)||engine.newGame({platform}),sound=stored.sound!==false;
if(game.status==='running')engine.pause(game);
const records=stored.records&&typeof stored.records==='object'?stored.records:{};
let best=Number.isFinite(stored.best)?Math.max(0,stored.best):0;
const assistedRecords=stored.assistedRecords&&typeof stored.assistedRecords==='object'?stored.assistedRecords:{};
let assistedBest=Number.isFinite(stored.assistedBest)?Math.max(0,stored.assistedBest):0,cheatResume=false;
const recordBook=()=>engine.isAssisted(game)?assistedRecords:records;
const highScore=()=>engine.isAssisted(game)?assistedBest:best;
function recordScore(){if(engine.isAssisted(game))assistedBest=Math.max(assistedBest,game.score);else best=Math.max(best,game.score);}
let assets,loaded=false,last=performance.now(),accumulator=0,lastSave=0,lastHUD='',toastTimer,frameId,pending;
const held=new Map(),pointers=new Map(),taps=new Set(),audio=createAudio();audio.setEnabled(sound);
canvas.width=engine.WIDTH;canvas.height=engine.HEIGHT;
const icon=(name)=>({fullscreen:'⛶',minimize:'⛶',close:'×'}[name]||'⛶');
setupFullscreen({button:$('fullscreen-button'),icon,notice:toast,onChange:()=>{fit();if(game.status==='running')canvas.focus({preventScroll:true});}});
const cheatDialog=document.createElement('dialog');cheatDialog.id='cheats-dialog';cheatDialog.className='modal cheats-modal';
cheatDialog.innerHTML=`<button class="close" data-close="cheats-dialog" aria-label="关闭作弊菜单">×</button><span class="eyebrow">PLAY YOUR WAY</span><h2>作弊 / 辅助</h2><p id="cheats-status"></p><div class="cheat-options">${engine.CHEAT_OPTIONS.map(o=>`<label class="cheat-option"><input type="checkbox" data-cheat="${o.key}"><span><strong>${o.label}</strong><small>${o.description}</small></span></label>`).join('')}</div>${id==='tank'?'<button data-action="spawn-powerup" class="level-button">立即生成随机道具 <b>＋</b></button><p class="note" id="spawn-hint"></p>':''}<p class="note">选项立即生效并随进度保存。辅助局单独记分；本局用过辅助后，关闭全部并重开可恢复经典记录。</p><div class="dialog-actions"><button data-action="reset-cheats">关闭全部</button><button class="primary" data-close="cheats-dialog">完成</button></div>`;
document.body.append(cheatDialog);
function syncCheats(){
 cheatDialog.querySelectorAll('[data-cheat]').forEach(b=>b.checked=!!game.cheats[b.dataset.cheat]);
 $('cheats-status').textContent=engine.isAssisted(game)?'本局为辅助局，成绩独立保存。':'当前是经典规则，全部辅助默认关闭。';
 const spawn=cheatDialog.querySelector('[data-action="spawn-powerup"]');if(spawn){spawn.disabled=!['running','paused'].includes(game.status)||engine.summary(game).phase!=='playing';$('spawn-hint').textContent=spawn.disabled?'开始战斗、坦克出生后即可生成。':'在坦克附近空地生成，走过去拾取；场上最多保留 6 个。';}
}
function openCheats(){cheatResume=game.status==='running';if(cheatResume)pause();syncCheats();cheatDialog.showModal();}
cheatDialog.addEventListener('close',()=>{const resume=cheatResume;cheatResume=false;if(resume&&game.status==='paused')void begin();});
cheatDialog.addEventListener('change',e=>{if(!e.target.matches('[data-cheat]'))return;engine.setCheat(game,e.target.dataset.cheat,e.target.checked);syncCheats();hud(true);save();});
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2200);}
function clearInput(){held.clear();pointers.clear();taps.clear();document.querySelectorAll('[data-input]').forEach(b=>b.classList.remove('pressed'));}
function input(){const order=[...held.values(),...pointers.values(),...taps],active=new Set(order);return{...Object.fromEntries(['left','right','up','down','fire','jump'].map(k=>[k,active.has(k)])),order};}
function save(){try{localStorage.setItem(KEY,JSON.stringify({game:engine.serialize(game),records,best,assistedRecords,assistedBest,sound}));}catch{}lastSave=performance.now();}
function fit(){
 const cabinet=$('cabinet');cabinet.style.setProperty('--ratio',engine.WIDTH/engine.HEIGHT);
 const available=innerHeight-(platform==='mobile'?195:115),width=Math.min(innerWidth-24,Math.max(150,available)*engine.WIDTH/engine.HEIGHT);
 cabinet.style.setProperty('--full-width',`${width}px`);
}
function renderOverlay(){
 const overlay=$('overlay');overlay.hidden=game.status==='running';if(overlay.hidden)return;
 const info=engine.levelInfo(game.level),end=game.status==='won'||game.status==='lost';
 let heading=game.status==='ready'?engine.TITLE:game.status==='paused'?'PAUSE':game.status==='won'?(game.level===engine.LEVEL_COUNT?'MISSION COMPLETE':'STAGE CLEAR'):'GAME OVER';
 let detail=game.status==='ready'?`${info.name}<br>${info.description}`:game.status==='paused'?'战斗已暂停，准备好后继续。':game.status==='won'?`第 ${game.level} 关完成 · ${game.score.toLocaleString()} 分`:'这一次先到这里。重新出发，熟悉敌人的节奏。';
 const label=game.status==='ready'?'开始游戏':game.status==='paused'?'继续游戏':game.status==='won'&&game.level<engine.LEVEL_COUNT?'下一关':'再来一次';
 $('overlay-content').innerHTML=`<span class="eyebrow">${id==='tank'?'DEFEND YOUR BASE':'RUN · JUMP · SHOOT'}</span><h1>${heading}</h1><p>${detail}</p><button class="primary" data-action="${end?(game.status==='won'&&game.level<engine.LEVEL_COUNT?'next':'retry'):'start'}" ${loaded?'':'disabled'}>${loaded?label:'资源加载中…'}</button><small>${game.status==='ready'?(id==='tank'?'WASD / 方向键移动 · J / 空格开火':'WASD / 方向键 · J 开火 · K / 空格跳跃'):'单人战役 · 本机独立进度'}</small>`;
}
function hud(force=false){
 const telemetry=engine.view(game);canvas.dataset.playerX=telemetry.x;canvas.dataset.playerY=telemetry.y;canvas.dataset.projectiles=telemetry.projectiles;canvas.dataset.clock=game.clock;
 const s=engine.summary(game),info=engine.levelInfo(game.level),key=JSON.stringify([game.status,game.level,game.score,game.lives,s,sound,loaded,game.cheats,game.assisted]);
 if(!force&&key===lastHUD)return;lastHUD=key;
 audio.setScene?.(game.level,s.phase);
 $('score').textContent=String(game.score).padStart(6,'0');$('lives').textContent=game.cheats.infiniteLives?'∞':game.lives;$('stage').textContent=`${String(game.level).padStart(2,'0')} / ${engine.LEVEL_COUNT}`;
 $('weapon').textContent=({basic:'普通',fast:'★ 高速',power:'★★ 双发',armor:'★★★ 穿钢',N:'步枪 N',M:'机枪 M',S:'散弹 S',L:'激光 L',F:'火焰 F'})[s.weapon]||s.weapon;
 $('objective').textContent=(engine.isAssisted(game)?'辅助局 · ':'')+s.objective;$('map-name').textContent=info.name;$('best').textContent=highScore().toLocaleString();
 $('progress').textContent=`${engine.isAssisted(game)?'辅助':'经典'} · ${Object.keys(recordBook()).filter(n=>recordBook()[n]).length} / ${engine.LEVEL_COUNT} 已完成`;
 document.querySelectorAll('[data-action="cheats"]').forEach(b=>{b.textContent=engine.isAssisted(game)?'作弊 •':'作弊';b.setAttribute('aria-label','作弊 / 辅助设置');});
 $('sound-button').textContent=sound?'音效 开':'音效 关';$('sound-button').setAttribute('aria-pressed',String(sound));
 $('pause-button').textContent=game.status==='paused'?'继续':'暂停';$('pause-button').disabled=!['running','paused'].includes(game.status);
 if($('mode-select'))$('mode-select').value=game.mode;
 canvas.dataset.level=game.level;canvas.dataset.status=game.status;canvas.dataset.score=game.score;canvas.dataset.lives=game.lives;
 canvas.dataset.assisted=String(engine.isAssisted(game));canvas.dataset.cheats=JSON.stringify(game.cheats);
 renderOverlay();
}
function fresh(level=game.level,mode=game.mode,carry){clearInput();game=engine.newGame({platform,level,mode,carry,cheats:game.cheats,assisted:carry?.assisted});accumulator=0;last=performance.now();hud(true);save();if(loaded)draw(canvas,game,assets);}
async function begin(){if(!loaded||!['ready','paused'].includes(game.status))return;clearInput();await audio.unlock();engine.start(game);last=performance.now();accumulator=0;audio.setRunning(true);hud(true);save();canvas.focus({preventScroll:true});}
function pause(){if(game.status==='running'){engine.pause(game);clearInput();audio.setRunning(false);hud(true);save();}else if(game.status==='paused')void begin();}
function requestFresh(level=game.level,mode=game.mode){
 if(['running','paused'].includes(game.status)){if(game.status==='running')pause();pending=()=>fresh(level,mode);$('confirm-dialog').showModal();}
 else fresh(level,mode);
}
function openLevels(){if(game.status==='running')pause();$('level-grid').replaceChildren(...Array.from({length:engine.LEVEL_COUNT},(_,i)=>{const n=i+1,info=engine.levelInfo(n),b=document.createElement('button');b.dataset.level=n;b.className=n===game.level?'current':'';b.innerHTML=`<b>${String(n).padStart(2,'0')}</b><small>${info.name}</small><span>${recordBook()[n]?'★ 已完成':'进入作战'}</span>`;b.setAttribute('aria-label',`第 ${n} 关 ${info.name}`);return b;}));$('levels-dialog').showModal();}
function events(){for(const e of game.events||[]){
 if(e.type==='sound')audio.play(e.name);
 if(e.type==='levelclear'){recordBook()[e.level]=true;save();}
 if(e.type==='level'){save();toast(`进入第 ${e.level} 关`);}
 if(e.type==='won'||e.type==='lost'){if(e.type==='won')recordBook()[game.level]=true;recordScore();clearInput();audio.setRunning(false);hud(true);save();}
 }recordScore();}
function advance(now){
 const elapsed=Math.min(100,Math.max(0,now-last));last=now;
 if(game.status==='running'){accumulator+=elapsed;while(accumulator>=1000/60&&game.status==='running'){engine.step(game,1000/60,input());taps.clear();events();accumulator-=1000/60;}}
}
function loop(now){advance(now);if(loaded)draw(canvas,game,assets);hud();if(game.status==='running'&&now-lastSave>4000)save();frameId=requestAnimationFrame(loop);}
const actions={start:begin,pause,retry:()=>fresh(),restart:()=>requestFresh(),levels:openLevels,cheats:openCheats,'reset-cheats':()=>{for(const o of engine.CHEAT_OPTIONS)engine.setCheat(game,o.key,false);syncCheats();hud(true);save();},'spawn-powerup':()=>{game.events=[];const name=engine.spawnRandomPowerUp?.(game);if(name){events();game.events=[];hud(true);save();toast('已生成：'+({tank:'坦克加命',star:'星星升级',grenade:'手雷',timer:'时钟',helmet:'头盔',shovel:'铁锹'})[name]);}else toast('坦克出生、战斗进行中时可生成道具');},next:()=>{if(game.status==='won'&&game.level<engine.LEVEL_COUNT)fresh(game.level+1,game.mode,{lives:game.lives,score:game.score,weapon:engine.summary(game).weapon,assisted:engine.isAssisted(game)});},sound:()=>{sound=!sound;audio.setEnabled(sound);if(sound)void audio.unlock();hud(true);save();},help:()=>{if(game.status==='running')pause();$('help-dialog').showModal();},confirm:()=>{$('confirm-dialog').close();pending?.();pending=null;}};
document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}const a=e.target.closest('[data-action]');if(a&&!a.disabled){actions[a.dataset.action]?.();return;}const level=e.target.closest('[data-level]');if(level){const n=Number(level.dataset.level);$('levels-dialog').close();if(n!==game.level)requestFresh(n);}});
const directions={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',KeyJ:'fire',KeyZ:'fire',KeyK:'jump',KeyX:'jump',Space:id==='tank'?'fire':'jump'};
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.altKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;
 if(e.code==='KeyC'){e.preventDefault();if(!e.repeat)openCheats();return;}
 if(['KeyP','Escape'].includes(e.code)){if(!e.repeat){e.preventDefault();pause();}return;}
 if(e.code==='Enter'&&['ready','paused'].includes(game.status)){e.preventDefault();if(!e.repeat)void begin();return;}
 const action=directions[e.code];if(!action||game.status!=='running')return;
 e.preventDefault();if(!e.repeat){advance(performance.now());held.set(e.code,action);taps.add(action);}
});
document.addEventListener('keyup',e=>{held.delete(e.code);});
document.querySelectorAll('[data-input]').forEach(button=>{
 button.addEventListener('pointerdown',e=>{if(game.status!=='running')return;e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,button.dataset.input);taps.add(button.dataset.input);button.classList.add('pressed');void audio.unlock();});
 const release=e=>{pointers.delete(e.pointerId);button.classList.remove('pressed');};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
});
window.addEventListener('blur',()=>{clearInput();if(game.status==='running')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.status==='running')pause();last=performance.now();});
window.addEventListener('pagehide',()=>{if(game.status==='running')engine.pause(game);audio.setRunning(false);save();});
window.addEventListener('resize',fit);
if($('mode-select')){$('mode-select').replaceChildren(...engine.MODES.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));$('mode-select').addEventListener('change',e=>{const mode=e.target.value;e.target.value=game.mode;requestFresh(game.level,mode);});}
hud(true);fit();save();
Promise.all([loadAssets(),audio.load()]).then(([loadedAssets])=>{assets=loadedAssets;loaded=true;$('load-status').textContent='本地资源就绪';hud(true);draw(canvas,game,assets);}).catch(()=>{$('load-status').textContent='资源加载失败，请刷新重试';});
frameId=requestAnimationFrame(loop);
