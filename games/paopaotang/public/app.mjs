import {newGame,start,pause,step,getPlayer,enemiesLeft,livingTeam,stars,serialize,restore,TRAP_MS,applyInput,movementMs,SIMULATION_MS} from './engine.mjs';
import {LEVEL_COUNT,THEMES,SKINS,DIFFICULTIES,levelInfo,arenaSpec} from './catalog.mjs';
import {drawArena,avatarSVG} from './renderer.mjs';
import {icon} from './icons.mjs';
import {setupFullscreen} from './fullscreen.mjs';
const $=id=>document.getElementById(id),platform=document.body.dataset.platform;
const KEY=`fish-bubble-town:${platform}:v1`,pad=n=>String(n).padStart(2,'0');
let stored={};try{stored=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
let game=restore(stored.game,platform)||newGame({platform});if(game.status==='running')pause(game);
const records=stored.records&&typeof stored.records==='object'&&!Array.isArray(stored.records)?stored.records:{};
let best=Number.isFinite(stored.best)&&stored.best>=0?stored.best:0,sound=stored.sound!==false;
let lastFrame=performance.now(),accumulator=0,lastHud=0,lastSave=0,audioContext,lastBurstSound=0,nextMusic=0,noteIndex=0;
let pendingAction=null,resumeAfterDialog=false,toastTimeout,touchDirection=null,touchPointer=null;
const keys=new Set(),queued={p1:{},p2:{}};
const canvas=$('game-canvas');
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('help-avatars').innerHTML=avatarSVG(0)+avatarSVG(1)+avatarSVG(3);
setupFullscreen({button:$('fullscreen-button'),icon,notice:toast,onChange:()=>{
 fitImmersiveArena();if(game.status==='running'&&platform==='pc')canvas.focus({preventScroll:true});
}});
function fitImmersiveArena(){
 const frame=$('arena-frame');
 if(!document.body.classList.contains('immersive')){frame.style.removeProperty('--immersive-arena-width');return;}
 const card=frame.closest('.arena-card'),available=card.clientHeight-card.querySelector('.arena-heading').offsetHeight-card.querySelector('.arena-caption').offsetHeight;
 const width=Math.min(card.clientWidth-24,(available-2)*game.cols/game.rows+2);
 frame.style.setProperty('--immersive-arena-width',`${Math.max(120,width)}px`);
}
if($('fullscreen-button'))new ResizeObserver(fitImmersiveArena).observe($('arena-frame').closest('.arena-card'));
function recordKey(){return`${game.mode}:${game.difficulty}`;}
function record(){const r=records[recordKey()]||{};return{unlocked:Number.isInteger(r.unlocked)?Math.max(1,Math.min(LEVEL_COUNT,r.unlocked)):1,stars:r.stars&&typeof r.stars==='object'?r.stars:{}};}
function save(){try{localStorage.setItem(KEY,JSON.stringify({game:serialize(game),records,best,sound}));}catch{}lastSave=performance.now();}
function clearInput(){keys.clear();touchDirection=null;touchPointer=null;queued.p1={};queued.p2={};document.querySelectorAll('.dpad button').forEach(b=>b.classList.remove('pressed'));}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),2300);}
function tone(frequency,time,duration=.13,volume=.035,type='sine'){
 const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type=type;oscillator.frequency.value=frequency;
 gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
 oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(time);oscillator.stop(time+duration+.01);
}
function audioReady(){
 if(!sound)return false;try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return false;audioContext||=new Context();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});return true;}catch{return false;}
}
function sfx(type){
 if(!audioReady())return;try{
 const notes=type==='win'?[523,659,784,1047]:type==='burst'?[190,310,440]:type==='pickup'?[660,880]:type==='trap'?[440,330,220]:type==='rescue'?[440,660,880]:type==='lose'?[392,330,262]:[520,720];
 notes.forEach((frequency,i)=>tone(frequency,audioContext.currentTime+i*.055,.12,type==='burst'?.018:.027));
 }catch{}
}
function music(time){
 if(!sound||!audioContext||audioContext.state!=='running'||game.status!=='running'||time<nextMusic)return;
 nextMusic=time+310;const notes=[523,0,659,784,659,0,587,659,523,0,440,523,587,0,659,0];
 const note=notes[noteIndex++%notes.length];if(note)try{tone(note,audioContext.currentTime,.21,.006);}catch{}
}
function renderSkin(){
 if($('character-showcase'))$('character-showcase').innerHTML=avatarSVG(game.skin);
 if($('skin-name'))$('skin-name').textContent=SKINS[game.skin].name;
 if($('mobile-skin-name'))$('mobile-skin-name').textContent=SKINS[game.skin].name;
 $('skin-picker').replaceChildren(...SKINS.map((skin,i)=>{
  const button=document.createElement('button');button.dataset.skin=i;button.style.setProperty('--skin',skin.color);button.className=i===game.skin?'active':'';
  button.setAttribute('aria-label',`选择${skin.name}`);button.setAttribute('aria-pressed',String(i===game.skin));
  if(platform==='mobile')button.innerHTML=avatarSVG(i);return button;
 }));
}
function renderSettings(){
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===game.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===game.mode));});
 $('difficulty-select').value=game.difficulty;
 if($('p2-guide'))$('p2-guide').hidden=game.mode!=='duo';
 if($('level-tag'))$('level-tag').textContent=`ROUND ${pad(game.level)}`;
 if($('map-name'))$('map-name').textContent=`${levelInfo(game.level).name} · ${game.cols}×${game.rows}`;
 if($('mobile-map'))$('mobile-map').textContent=`第 ${pad(game.level)} 关 · ${THEMES[levelInfo(game.level).theme].name}`;
 if($('level-progress'))$('level-progress').textContent=`${pad(record().unlocked)} / ${LEVEL_COUNT}`;
 $('mode-badge').textContent=game.mode==='duo'?'双人 · 协作闯关':platform==='pc'?'单人 · AI 对战':'AI 对战';
 $('arena-frame').style.setProperty('--arena-ratio',game.cols/game.rows);
 canvas.style.setProperty('--arena-ratio',game.cols/game.rows);
 $('sound-button').innerHTML=icon(sound?'sound':'mute');$('sound-button').setAttribute('aria-label',sound?'关闭音效':'开启音效');$('sound-button').setAttribute('aria-pressed',String(sound));
 renderSkin();
}
function renderHud(){
 const p=getPlayer(game,'p1'),seconds=Math.ceil(game.remainingMs/1000);
 for(const player of game.players.filter(p=>p.team===0)){
  canvas.dataset[`${player.id}X`]=player.x;canvas.dataset[`${player.id}Y`]=player.y;canvas.dataset[`${player.id}Status`]=player.status;
 }
 canvas.dataset.bombs=game.bombs.filter(b=>b.team===0).length;canvas.dataset.clock=game.clock;
 $('score').textContent=game.score.toLocaleString('zh-CN');$('enemies').innerHTML=`${enemiesLeft(game)}<small> 位</small>`;
 $('timer').textContent=`${pad(Math.floor(seconds/60))}:${pad(seconds%60)}`;
 document.querySelector('.scoreboard>div:last-child').classList.toggle('warning',seconds<=30&&game.status==='running');
 $('best-score').textContent=Math.max(best,game.score).toLocaleString('zh-CN');
 $('capacity').textContent=p.capacity;$('power').textContent=p.power;$('speed').textContent=p.speed;$('needle-count').textContent=p.needles;
 $('needle-button').disabled=game.status!=='running'||p.status!=='trapped'||!p.needles;
 $('needle-button').classList.toggle('rescue-ready',game.status==='running'&&p.status==='trapped'&&p.needles>0);
 if($('needle-note'))$('needle-note').textContent=p.status==='trapped'?`${Math.ceil((TRAP_MS-(game.clock-p.trappedAt))/1000)} 秒内自救`:'困住时使用 E';
 if($('mobile-status'))$('mobile-status').textContent=p.status==='trapped'?`被困住了！${Math.ceil((TRAP_MS-(game.clock-p.trappedAt))/1000)} 秒内用救援针`:
   p.status==='out'?'这次先休息一下':`${SKINS[p.skin].name}，${p.shield?'护盾保护中':'躲开水柱，收获快乐'}`;
 if($('bomb-button'))$('bomb-button').disabled=game.status!=='running'||p.status!=='active'||game.bombs.filter(b=>b.owner==='p1').length>=p.capacity;
 document.querySelectorAll('[data-direction]').forEach(b=>b.disabled=game.status!=='running'||p.status!=='active');
 $('pause-button').innerHTML=icon(game.status==='paused'?'play':'pause');$('pause-button').setAttribute('aria-label',game.status==='paused'?'继续游戏':'暂停游戏');$('pause-button').disabled=!['running','paused'].includes(game.status);
 if($('team-status'))$('team-status').innerHTML=game.players.filter(p=>p.team===0).map(p=>`<span class="${p.status}"><i></i>${p.control.toUpperCase()} · ${SKINS[p.skin].name} · ${p.status==='active'?'出发中':p.status==='trapped'?'等待救援':'已淘汰'}</span>`).join('');
}
function renderOverlay(){
 const overlay=$('arena-overlay'),content=$('overlay-content');overlay.hidden=game.status==='running';if(overlay.hidden)return;
 const avatar=`<div class="overlay-avatar">${avatarSVG(game.skin)}</div>`;
 if(game.status==='ready')content.innerHTML=`${avatar}<span class="eyebrow">WELCOME TO THE WATER PARTY</span><h2>一起，玩出一点水花。</h2><p>${THEMES[levelInfo(game.level).theme].name} · 第 ${pad(game.level)} 关<br>${DIFFICULTIES[game.difficulty].name}难度 · ${game.mode==='duo'?'双人协作':'单人闯关'} · ${enemiesLeft(game)} 位 AI 对手<br>${game.cols}×${game.rows} 地图 · ${game.version===1?5:levelInfo(game.level).itemTypes.length} 类掉落道具</p><button class="primary" data-action="start">开始派对 ${icon('arrow')}</button><small class="overlay-note">${platform==='mobile'?'左手方向，右手水泡。':'WASD 移动，空格放水泡。'}<br>点击开始后才计时，不用着急。</small>`;
 else if(game.status==='paused')content.innerHTML=`${avatar}<span class="eyebrow">TAKE A LITTLE BREATH</span><h2>水花等等，好心情还在。</h2><p>游戏已暂停，倒计时和水泡都停住了。<br>准备好了，再一起出发。</p><button class="primary" data-action="start">继续派对 ${icon('play')}</button><button class="overlay-text-button" data-action="restart">重新开始这一关</button>`;
 else if(game.status==='won')content.innerHTML=`${avatar}<span class="eyebrow">A SPLASHING LITTLE VICTORY</span><h2>${game.level===LEVEL_COUNT?'整座小镇，都点亮啦！':'水花派对，大获全胜！'}</h2><div class="result-stars" aria-label="${stars(game)} 星">${'★'.repeat(stars(game))}${'☆'.repeat(3-stars(game))}</div><strong class="result-score">${game.score.toLocaleString('zh-CN')}</strong><p>击败 ${game.enemiesOut} 位 AI · 剩余 ${Math.ceil(game.remainingMs/1000)} 秒</p><button class="primary" data-action="${game.level===LEVEL_COUNT?'levels':'next'}">${game.level===LEVEL_COUNT?'看看我的旅行地图':'下一场小冒险'} ${icon('arrow')}</button><button class="overlay-text-button" data-action="restart">再玩一局</button>`;
 else content.innerHTML=`${avatar}<span class="eyebrow">EVERY SPLASH IS A NEW START</span><h2>下一朵水花，会更漂亮。</h2><p>${game.remainingMs<=0?'时间到了，派对先休息一下。':'这次被困住了，下次记得留条退路。'}<br>已经冲开 ${game.cratesBroken} 个箱子，获得 ${game.score} 分。</p><button class="primary" data-action="restart">再来一场 ${icon('restart')}</button><button class="overlay-text-button" data-action="easy">试试轻松难度</button>`;
}
function render(){renderSettings();renderHud();renderOverlay();fitImmersiveArena();drawArena(canvas,game,performance.now());}
function rememberWin(){
 best=Math.max(best,game.score);if(game.status!=='won')return;
 const r=record();r.unlocked=Math.max(r.unlocked,Math.min(LEVEL_COUNT,game.level+1));r.stars[game.level]=Math.max(Number(r.stars[game.level])||0,stars(game));records[recordKey()]=r;
}
function fresh(options={}){
 clearInput();game=newGame({platform,mode:game.mode,difficulty:game.difficulty,level:game.level,skin:game.skin,...options});
 accumulator=0;lastFrame=performance.now();$('game-message').textContent='放下水泡，记得留一条退路哦。';render();save();
}
function begin(){if(!['ready','paused'].includes(game.status))return;clearInput();start(game);accumulator=0;lastFrame=performance.now();render();save();sfx('start');if(platform==='pc')canvas.focus({preventScroll:true});}
function togglePause(){if(game.status==='running'){pause(game);clearInput();render();save();}else if(game.status==='paused')begin();}
function openDialog(id){resumeAfterDialog=game.status==='running';if(resumeAfterDialog){pause(game);clearInput();render();save();}$(id).showModal();}
function requestFresh(options={}){
 if(['running','paused'].includes(game.status)){pendingAction=()=>fresh(options);openDialog('confirm-dialog');}
 else fresh(options);
}
function chooseLevels(){
 const r=record();$('level-grid').replaceChildren(...Array.from({length:LEVEL_COUNT},(_,i)=>{
 const level=i+1,b=document.createElement('button');b.dataset.level=level;b.disabled=level>r.unlocked;b.className=level===game.level?'current':'';
 const spec=arenaSpec(level,platform,game.difficulty);
 const earned=Math.max(0,Math.min(3,Number(r.stars[level])||0));
 b.innerHTML=`${pad(level)}<small>${THEMES[levelInfo(level).theme].name}<span class="level-detail">${spec.cols}×${spec.rows} · ${spec.itemTypes.length}类道具</span></small><b>${earned?'★'.repeat(earned):level>r.unlocked?'· · ·':'START'}</b>`;
 b.setAttribute('aria-label',`第 ${level} 关，${levelInfo(level).name}，${spec.cols} 列 ${spec.rows} 行，${spec.itemTypes.length} 类道具，${level>r.unlocked?'尚未解锁':'可进入'}`);return b;
 }));openDialog('levels-dialog');
}
function handleEvents(){
 for(const e of game.events){
 if(e.type==='plant'&&e.player.startsWith('p'))sfx('plant');
 if(e.type==='burst'&&performance.now()-lastBurstSound>130){sfx('burst');lastBurstSound=performance.now();}
 if(e.type==='pickup'&&e.player.startsWith('p')){sfx('pickup');const names={capacity:'水泡数量 +1',power:'水柱长度 +1',speed:'跑鞋速度 +1',needle:'救援针 +1',shield:'获得护盾'};$('game-message').textContent=names[e.item];}
 if(e.type==='trap'&&e.player.startsWith('p')){sfx('trap');$('game-message').textContent=`${e.player.toUpperCase()} 被困住了，快用救援针或让队友帮忙！`;toast(platform==='mobile'?'快点救援针，4.5 秒内自救！':`${e.player.toUpperCase()} 被困住了！用救援针自救，或等队友来救援`);save();}
 if(e.type==='rescue'&&e.player.startsWith('p')){sfx('rescue');$('game-message').textContent='获救啦！短暂保护中，快离开水柱';save();}
 if(e.type==='out'){if(e.team===1)$('game-message').textContent=`少一位对手啦！还有 ${enemiesLeft(game)} 位`;else $('game-message').textContent='伙伴先休息一下，继续加油！';}
 if(e.type==='win'||e.type==='lose'){sfx(e.type);rememberWin();clearInput();render();save();}
 }
 if(game.events.length)renderHud();
}
const actions={
 start:begin,pause:togglePause,restart:()=>requestFresh(),next:()=>{if(game.status==='won'&&game.level<LEVEL_COUNT)fresh({level:game.level+1});},
 help:()=>openDialog('help-dialog'),levels:chooseLevels,skins:()=>openDialog('skins-dialog'),
 bomb:()=>dispatchInput('p1',{bomb:true}),needle:()=>dispatchInput('p1',{needle:true}),
 easy:()=>requestFresh({difficulty:'easy',level:1}),
 sound:()=>{sound=!sound;renderSettings();save();if(sound)sfx('start');},
 confirm:()=>{resumeAfterDialog=false;$('confirm-dialog').close();pendingAction?.();pendingAction=null;},
};
document.addEventListener('click',event=>{
 const close=event.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
 const action=event.target.closest('[data-action]');if(action&&!action.disabled){actions[action.dataset.action]?.();return;}
 const mode=event.target.closest('[data-mode]');if(mode&&mode.dataset.mode!==game.mode){requestFresh({mode:mode.dataset.mode,level:1});return;}
 const skin=event.target.closest('[data-skin]');if(skin&&Number(skin.dataset.skin)!==game.skin){
  if($('skins-dialog')?.open){resumeAfterDialog=false;$('skins-dialog').close();}requestFresh({skin:Number(skin.dataset.skin)});return;
 }
 const level=event.target.closest('[data-level]');if(level&&!level.disabled){
  const number=Number(level.dataset.level);if(number>record().unlocked)return;
  const resume=resumeAfterDialog;resumeAfterDialog=false;$('levels-dialog').close();
  if(number===game.level){if(resume)begin();return;}requestFresh({level:number});
 }
});
$('difficulty-select').addEventListener('change',event=>{const difficulty=event.target.value;if(difficulty!==game.difficulty)requestFresh({difficulty,level:1});event.target.value=game.difficulty;});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{
 if(resumeAfterDialog&&game.status==='paused'&&!document.querySelector('dialog[open]')){resumeAfterDialog=false;begin();}
 if(!document.querySelector('dialog[open]'))resumeAfterDialog=false;
}));
const keyDirections={KeyW:'up',KeyA:'left',KeyS:'down',KeyD:'right',ArrowUp:'up',ArrowLeft:'left',ArrowDown:'down',ArrowRight:'right'};
document.addEventListener('keydown',event=>{
 if(document.querySelector('dialog[open]')||event.ctrlKey||event.altKey||event.metaKey||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
 if(event.code==='KeyP'||event.code==='Escape'){if(!event.repeat){event.preventDefault();togglePause();}return;}
 if(game.status!=='running'||event.target.closest?.('button,a'))return;
 if(keyDirections[event.code]){
  event.preventDefault();if(!event.repeat){
   advanceSimulation(performance.now());keys.delete(event.code);keys.add(event.code);
   dispatchInput(game.mode==='duo'&&event.code.startsWith('Arrow')?'p2':'p1',{direction:keyDirections[event.code]});
  }
 }
 if(event.code==='Space'){event.preventDefault();if(!event.repeat)dispatchInput('p1',{bomb:true});}
 if(event.code==='KeyE'){event.preventDefault();if(!event.repeat)dispatchInput('p1',{needle:true});}
 if(game.mode==='duo'&&event.code==='Enter'){event.preventDefault();if(!event.repeat)dispatchInput('p2',{bomb:true});}
 if(game.mode==='duo'&&['ShiftLeft','ShiftRight'].includes(event.code)){event.preventDefault();if(!event.repeat)dispatchInput('p2',{needle:true});}
});
document.addEventListener('keyup',event=>{advanceSimulation(performance.now());keys.delete(event.code);});
document.querySelectorAll('[data-direction]').forEach(button=>{
 button.addEventListener('pointerdown',event=>{
  if(game.status!=='running'||button.disabled)return;event.preventDefault();button.setPointerCapture(event.pointerId);
  advanceSimulation(performance.now());touchPointer=event.pointerId;touchDirection=button.dataset.direction;
  dispatchInput('p1',{direction:touchDirection});document.querySelectorAll('.dpad button').forEach(b=>b.classList.remove('pressed'));button.classList.add('pressed');
 });
 button.addEventListener('contextmenu',event=>event.preventDefault());
});
function releasePointer(event){if(event.pointerId===touchPointer){advanceSimulation(performance.now());touchDirection=null;touchPointer=null;document.querySelectorAll('.dpad button').forEach(b=>b.classList.remove('pressed'));}}
document.addEventListener('pointerup',releasePointer);document.addEventListener('pointercancel',releasePointer);
function commandFor(control){
 const p=getPlayer(game,control);if(!p)return{};
 if(queued[control].until<game.clock)queued[control]={};
 const command={};
 if(queued[control].direction){command.direction=queued[control].direction;if(game.clock>=p.nextMove)queued[control]={};}
 else if(control==='p1'&&touchDirection)command.direction=touchDirection;
 else{const candidates=[...keys].reverse().filter(key=>control==='p1'?key.startsWith('Key')||game.mode==='solo'&&key.startsWith('Arrow'):key.startsWith('Arrow'));if(candidates.length)command.direction=keyDirections[candidates[0]];}
 return command;
}
function dispatchInput(control,command){
 if(game.status!=='running')return;
 advanceSimulation(performance.now());if(game.status!=='running')return;
 game.events=[];const result=applyInput(game,control,command);
 if(command.direction)queued[control]=result.moved?{}:{direction:command.direction,until:game.clock+movementMs(getPlayer(game,control))};
 handleEvents();renderHud();drawArena(canvas,game,performance.now(),game.clock+accumulator);
}
function advanceSimulation(time){
 time=Math.max(time,lastFrame);const delta=Math.min(100,Math.max(0,time-lastFrame));lastFrame=time;
 if(game.status==='running'&&!document.hidden){
  accumulator+=delta;
  while(accumulator>=SIMULATION_MS&&game.status==='running'){
   step(game,SIMULATION_MS,{p1:commandFor('p1'),p2:commandFor('p2')});handleEvents();accumulator-=SIMULATION_MS;
  }
 }else accumulator=0;
}
function leave(){if(game.status==='running'){pause(game);clearInput();render();}save();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)leave();else lastFrame=performance.now();});
window.addEventListener('pagehide',leave);window.addEventListener('blur',clearInput);
function frame(time){
 advanceSimulation(time);
 if(game.status==='running'&&!document.hidden){
  if(time-lastSave>1200)save();music(time);
 }
 if(time-lastHud>75){renderHud();lastHud=time;}
 drawArena(canvas,game,time,game.clock+(game.status==='running'?accumulator:0));requestAnimationFrame(frame);
}
rememberWin();render();save();requestAnimationFrame(frame);
