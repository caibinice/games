import { LEVELS, CHAPTERS, TOTAL_LEVELS, getArtwork } from './artworks.mjs';
import { newGame, gameArtwork, correctCount, completedColors, selectBoard, selectTray, addRow, extend, undo, magnet, brush, serialize, restore } from './engine.mjs';
import { GUIDE_STEPS, inferGuideStep, advanceGuideStep, highlightedGuideCells } from './guide.mjs';
import { hiddenTapSequence, jumpLevelId } from './admin.mjs';
import { drawBead, completionFlash, COLOR_FLASH_MS, visibleTrayRange } from './beads.mjs';
import { LoopMusic, musicPreference } from './music.mjs';

const $=id=>document.getElementById(id),icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const COOKIE_PATH='/games/pindou';
function readCookie(name){try{const row=document.cookie.split('; ').find(v=>v.startsWith(`${name}=`));return row?decodeURIComponent(row.slice(name.length+1)):null;}catch{return null;}}
function cookie(name,value){document.cookie=`${name}=${encodeURIComponent(value)}; Path=${COOKIE_PATH}; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;}
function removeCookie(name){document.cookie=`${name}=; Path=${COOKIE_PATH}; Max-Age=0; SameSite=Lax`;}
const defaults={v:1,completed:{},unlocked:1,last:1,sound:true,music:true,autoFullscreen:true,numbers:false,tutorialDone:false};
function readProgress(){try{let p=JSON.parse(readCookie('pindou_progress'));if(p?.v!==1)throw 0;if(Array.isArray(p.c))p={v:1,completed:Object.fromEntries(p.c.filter(v=>Array.isArray(v)&&v.length===3).map(([id,moves,elapsed])=>[id,{moves,elapsed}])),last:p.l,sound:p.s,music:p.m,autoFullscreen:p.f,numbers:p.n,tutorialDone:p.g===2};const completed={};for(const [k,v]of Object.entries(p.completed||{}))if(Number.isInteger(+k)&&+k>=1&&+k<=TOTAL_LEVELS&&Number.isFinite(v.moves)&&v.moves>=0&&Number.isFinite(v.elapsed)&&v.elapsed>=0)completed[k]=v;const highest=Math.max(0,...Object.keys(completed).map(Number));return {...defaults,...p,completed,unlocked:Math.min(TOTAL_LEVELS,Math.max(1,highest+1)),last:Math.min(TOTAL_LEVELS,Math.max(1,Math.floor(p.last)||1)),sound:p.sound!==false,music:musicPreference(p.music,p.sound),autoFullscreen:p.autoFullscreen!==false,numbers:p.numbers===true,tutorialDone:p.tutorialDone===true||!!completed[1]};}catch{return {...defaults,completed:{}};}}
let progress=readProgress(),game=restore(readCookie('pindou_session')),screen='home',modalOpen=false,modalDismiss=null,toastTimer,boardHintTimer,single=false;
let zoom=1,panX=0,panY=0,geo={cell:1,left:0,top:0,width:1,height:1},keyboardCell=0,audio=null,lastTick=performance.now(),lastSave=0,saveTimer,confettiFrame;
let tutorial=null,trayOffset=0,flightFrame,flights=[];
const flightCanvas=document.createElement("canvas");flightCanvas.id="bead-effects";flightCanvas.setAttribute("aria-hidden","true");$("app").append(flightCanvas);const flightCtx=flightCanvas.getContext("2d");
let placement=null,effectsFrame,completed=new Set();
const colorFlashes=new Map();
const ctx=$('board').getContext('2d'),pointers=new Map();let gesture=null,suppressClick=false;
if(game?.status==='won')game=null;
const music=new LoopMusic(new URL('./assets/audio/music-loop.mp3?v=20261011-4',import.meta.url).href,{getContext:()=>audio??=new(window.AudioContext||window.webkitAudioContext)()});
function syncMusic(){music.setPlaying(progress.music&&screen==='play'&&!modalOpen&&!document.hidden&&game?.status==='playing');}
Object.defineProperty(window,'gameAudio',{value:Object.freeze({music:()=>music.state()})});
document.addEventListener('pointerdown',()=>music.retry(),{passive:true});
document.addEventListener('keydown',e=>{if(!e.repeat)music.retry();});
function persist(){cookie('pindou_progress',JSON.stringify({v:1,c:Object.entries(progress.completed).map(([id,v])=>[+id,v.moves,v.elapsed]),l:progress.last,s:progress.sound,m:progress.music,f:progress.autoFullscreen,n:progress.numbers,g:progress.tutorialDone?2:0}));if(game&&game.status!=='won')cookie('pindou_session',serialize(game));else removeCookie('pindou_session');}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(persist,150);}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,2400);}
function hint(text){clearTimeout(boardHintTimer);$('board-bubble').textContent=text;$('board-bubble').hidden=false;boardHintTimer=setTimeout(()=>$('board-bubble').hidden=true,1800);}
function sound(kind='pick'){
  if(!progress.sound)return;
  try{const Audio=window.AudioContext||window.webkitAudioContext;audio??=new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});const t=audio.currentTime;const notes=kind==='win'?[523.25,659.25,783.99,1046.5]:kind==='place'?[659.25,880]:[523.25];notes.forEach((freq,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,t+i*.11);gain.gain.linearRampToValueAtTime(.055,t+i*.11+.015);gain.gain.exponentialRampToValueAtTime(.001,t+i*.11+.22);osc.connect(gain);gain.connect(audio.destination);osc.start(t+i*.11);osc.stop(t+i*.11+.24);});}catch{}
}
function rounded(c,x,y,w,h,r){c.beginPath();r=Math.min(r,w/2,h/2);c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function contourPath(c,level,left,top,cell){
  c.beginPath();for(const loop of level.outline){loop.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](left+x*cell,top+y*cell));c.closePath();}
}
function contourBase(c,level,left,top,cell){
  c.save();contourPath(c,level,left,top,cell);c.fillStyle=level.palette[0];c.shadowColor='#72865b30';c.shadowBlur=4;c.shadowOffsetY=2;c.fill();c.restore();
}
function contourEdge(c,level,left,top,cell){
  c.save();contourPath(c,level,left,top,cell);c.strokeStyle='#fffdf2';c.lineWidth=2;c.lineJoin='round';c.stroke();c.restore();
}
function stopEffects(){cancelAnimationFrame(flightFrame);flightFrame=null;flights=[];flightCtx.clearRect(0,0,flightCanvas.width,flightCanvas.height);cancelAnimationFrame(effectsFrame);effectsFrame=null;placement=null;colorFlashes.clear();}
function stopPlacement(){placement=null;if(!colorFlashes.size){cancelAnimationFrame(effectsFrame);effectsFrame=null;}}
function animateEffects(){
  if(effectsFrame)return;
  const frame=now=>{
    effectsFrame=null;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){placement=null;colorFlashes.clear();}
    if(placement&&now-placement.start>=360)placement=null;
    for(const [color,start]of colorFlashes)if(now-start>=COLOR_FLASH_MS)colorFlashes.delete(color);
    draw();if(placement||colorFlashes.size)effectsFrame=requestAnimationFrame(frame);
  };
  effectsFrame=requestAnimationFrame(frame);
}
function syncCompletedColors(celebrate=false){
  const next=completedColors(game),newly=[...next].filter(color=>!completed.has(color));completed=next;
  for(const color of colorFlashes.keys())if(!completed.has(color))colorFlashes.delete(color);
  if(celebrate&&newly.length&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const now=performance.now();for(const color of newly)colorFlashes.set(color,now);animateEffects();
  }
  return newly;
}
function flashFor(color,now){const start=colorFlashes.get(color);return start===undefined?0:completionFlash(now-start);}
function animatePlacement(indices){
  stopPlacement();if(!indices?.length||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  placement={cells:new Set(indices),start:performance.now()};
  animateEffects();
}
function thumb(canvas,level,beads=false,celebrate=false){
  const c=canvas.getContext('2d'),s=Math.min((canvas.width-8)/level.width,(canvas.height-8)/level.height),ox=(canvas.width-level.width*s)/2,oy=(canvas.height-level.height*s)/2;c.clearRect(0,0,canvas.width,canvas.height);
  if(level.contoured)contourBase(c,level,ox,oy,s);else{c.fillStyle='#e9eddf';c.fillRect(0,0,canvas.width,canvas.height);}
  const now=performance.now();
  level.target.forEach((color,i)=>{if(color===null)return;const x=ox+i%level.width*s,y=oy+Math.floor(i/level.width)*s;if(beads)drawBead(c,x,y,s,level.palette[color],{completed:true,flash:celebrate?flashFor(color,now):0});else{c.fillStyle=level.palette[color];c.fillRect(x,y,Math.ceil(s),Math.ceil(s));}});
  if(level.contoured)contourEdge(c,level,ox,oy,s);
}
function draw(){
  if(!game||screen!=='play')return;
  // Keep the last-color pulse visible in the victory artwork; the covered board
  // does not need a second full repaint on every celebration frame.
  if($('win-art')){thumb($('win-art'),gameArtwork(game),true,true);return;}
  const level=gameArtwork(game),viewport=$('board-viewport'),w=viewport.clientWidth;if(!w)return;
  viewport.classList.toggle('contoured',!!level.contoured);
  const h=viewport.clientHeight;if(!h)return;
  const dpr=Math.min(devicePixelRatio||1,2),canvas=$('board');if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const base=Math.min((w-8)/level.width,(h-8)/level.height),cell=base*zoom,bw=cell*level.width,bh=cell*level.height;
  const maxX=Math.max(0,(bw-w)/2+12),maxY=Math.max(0,(bh-h)/2+12);panX=Math.min(maxX,Math.max(-maxX,panX));panY=Math.min(maxY,Math.max(-maxY,panY));
  const left=(w-bw)/2+panX,top=(h-bh)/2+panY;geo={cell,left,top,width:w,height:h};
  if(level.contoured)contourBase(ctx,level,left,top,cell);else{ctx.fillStyle='#dce5cd';rounded(ctx,left-2,top-2,bw+4,bh+4,5);ctx.fill();}
  const now=performance.now(),selected=new Set(game.selection?.source==='board'?game.selection.indices:[]),wanted=game.selection?.color??null,guided=new Set(tutorial?highlightedGuideCells(tutorial.step,game,level):[]);
  for(let i=0;i<game.board.length;i++){
    if(level.target[i]===null)continue;
    const x=left+i%level.width*cell,y=top+Math.floor(i/level.width)*cell;if(x+cell<0||x>w||y+cell<0||y>h)continue;
    const current=game.board[i],target=level.target[i];
    drawBead(ctx,x,y,cell,level.palette[current??target],{targetColor:level.palette[target],empty:current===null,selected:selected.has(i)||current===null&&target===wanted,number:progress.numbers?(current??target)+1:null,pop:placement?.cells.has(i)?Math.max(0,1-(now-placement.start)/360):0,completed:current===target&&completed.has(target),flash:flashFor(target,now)});
    if(guided.has(i)){ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(3,cell*.14);rounded(ctx,x+1,y+1,cell-2,cell-2,cell*.12);ctx.stroke();ctx.strokeStyle='#bc861e';ctx.lineWidth=Math.max(1.8,cell*.07);ctx.stroke();}
    if(document.activeElement===canvas&&i===keyboardCell){ctx.strokeStyle='#5b7d66';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,cell-2,cell-2);}
  }
  if(level.contoured)contourEdge(ctx,level,left,top,cell);
  $('zoom-text').textContent=`${Math.round(zoom*100)}%`;
}
function trayRange(){return visibleTrayRange(game.rows,trayOffset,Math.min(innerHeight,window.visualViewport?.height||innerHeight)<520?1:Math.min(innerHeight,window.visualViewport?.height||innerHeight)<740?2:3);}
function renderTray(){
  const level=gameArtwork(game),selection=game.selection?.source==='tray'?new Set(game.selection.indices):new Set(),tray=$('tray'),range=trayRange();trayOffset=range.offset;
  const used=game.tray.filter(c=>c!==null).length;$('tray-count').textContent=`${used} / ${game.rows*12}`;$('row-count').textContent=`${game.rows} 行空间`;
  tray.innerHTML=game.tray.slice(range.start,range.end).map((color,n)=>{const i=range.start+n;return `<button class="tray-slot${selection.has(i)?' selected':''}" data-slot="${i}" aria-label="暂存格 ${i+1}${color===null?'，空':`，颜色 ${color+1}`}" aria-pressed="${selection.has(i)}">${color===null?'':'<canvas class="bead" width="80" height="80" aria-hidden="true"></canvas>'}</button>`;}).join('');
  tray.querySelectorAll('canvas').forEach(canvas=>{const color=game.tray[+canvas.parentElement.dataset.slot];drawBead(canvas.getContext('2d'),0,0,80,level.palette[color],{targetColor:'#eeeef2',number:progress.numbers?color+1:null});});
  $('tray-pages').hidden=!range.maxOffset;$('tray-prev').disabled=!range.offset;$('tray-next').disabled=range.offset===range.maxOffset;$('tray-page-label').textContent=`${range.offset+1}–${range.offset+range.count} / ${game.rows} 行`;
  tray.classList.toggle('accepting',game.selection?.source==='board');
}
function captureMove(){return{board:[...game.board],tray:[...game.tray],selection:game.selection?structuredClone(game.selection):null,points:new Map(game.selection?.indices.map(i=>[i,movePoint(game.selection.source,i)])||[])};}
function movePoint(source,index){
  const r=(source==='board'?$('board'):$('tray')).getBoundingClientRect();if(source==='board'){const l=gameArtwork(game);return{x:r.x+geo.left+(index%l.width+.5)*geo.cell,y:r.y+geo.top+(Math.floor(index/l.width)+.5)*geo.cell,size:geo.cell};}
  const slot=$('tray').querySelector(`[data-slot="${index}"]`)?.getBoundingClientRect();return slot?{x:slot.x+slot.width/2,y:slot.y+slot.height/2,size:slot.width}:{x:r.x+r.width/2,y:r.y+r.height/2,size:geo.cell};
}
function animateMove(result,before){
  if(!before?.selection||!result.moved||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const selection=before.selection,color=selection.color,l=gameArtwork(game),sources=selection.indices.filter(i=>selection.source==='board'?before.board[i]!==null&&game.board[i]===null:before.tray[i]===color);
  if(selection.source==='board')sources.sort((a,b)=>(l.target[a]!==selection.priorityBackground)-(l.target[b]!==selection.priorityBackground));
  const destinations=result.route==='store'?game.tray.map((c,i)=>c===color?i:-1).filter(i=>i>=0).slice(-result.moved):result.placed||[];
  const now=performance.now();for(let n=0;n<Math.min(sources.length,destinations.length,96);n++)flights.push({from:before.points.get(sources[n])||movePoint(selection.source,sources[n]),to:movePoint(result.route==='store'?'tray':'board',destinations[n]),color:l.palette[color],start:now+Math.min(60,n*1.5)});
  if(flightFrame)return;
  const frame=time=>{flightFrame=null;const app=$('app'),r=app.getBoundingClientRect(),w=app.clientWidth,h=app.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(flightCanvas.width!==Math.round(w*dpr)||flightCanvas.height!==Math.round(h*dpr)){flightCanvas.width=Math.round(w*dpr);flightCanvas.height=Math.round(h*dpr);}flightCtx.setTransform(dpr,0,0,dpr,0,0);flightCtx.clearRect(0,0,w,h);
    flights=flights.filter(f=>time-f.start<320);for(const f of flights){const t=Math.max(0,Math.min(1,(time-f.start)/320)),e=1-Math.pow(1-t,2),size=f.from.size*(1-e)+f.to.size*e,x=f.from.x+(f.to.x-f.from.x)*e-r.x,y=f.from.y+(f.to.y-f.from.y)*e-r.y-Math.sin(Math.PI*t)*18;flightCtx.save();rounded(flightCtx,x-size/2,y-size/2,size,size,size*.16);flightCtx.clip();drawBead(flightCtx,x-size/2,y-size/2,size,f.color,{targetColor:f.color});flightCtx.restore();}if(flights.length)flightFrame=requestAnimationFrame(frame);};flightFrame=requestAnimationFrame(frame);
}
function renderInstruction(){
  const s=game.selection;$('instruction').classList.toggle('active',!!s);$('cancel-btn').hidden=!s;
  $('instruction').querySelector('.step-dot').textContent=s?(s.source==='board'?'2':'3'):'1';
  $('instruction-text').textContent=s?s.source==='board'?`待放 ${s.indices.length} 颗 · 起点底色优先 / 按空位暂存`:`待放 ${s.indices.length} 颗 · 可连续点同色空格`:'相邻同色错色豆连取 → 点同色空格归位，或先暂存';
}
function updateHUD(){
  if(!game)return;
  const level=gameArtwork(game),n=correctCount(game),pct=Math.floor(n/level.cellCount*100);$('level-number').textContent=String(game.level).padStart(2,'0');$('level-name').textContent=level.name;$('chapter-label').textContent=CHAPTERS[level.chapter].name+(game.level===1?' · 新手关':'');
  $('progress-text').textContent=`${pct}%`;$('progress-bar').style.width=`${pct}%`;$('progress-text').title=`${n} / ${level.cellCount} 颗已归位`;
  $('magnet-count').textContent=game.tools.magnet;$('brush-count').textContent=game.tools.brush;$('undo-btn').disabled=!game.history.length;
  const seconds=Math.max(0,Math.ceil(game.remaining));$('timer-text').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('timer-btn').classList.toggle('urgent',seconds<=30);
}
function renderAll(){syncCompletedColors();updateHUD();renderInstruction();renderTray();renderTutorial();draw();saveSoon();}
function resultFeedback(result,before=null){
  if(!result.ok){const messages={correct:'颜色已一致，这一格已经拼好了',full:'暂存盒满了，点「免费加一行」扩容',color:'小方块的颜色要和空格底色相同',occupied:'先选走这里的错色豆，让格子空出来',empty:'先选画板错色豆，再点空格暂存',select:'先选画板错色豆或暂存豆', 'no-holes':'先选走错色豆，空格就能接住暂存豆',tool:'点右上角 ＋ 免费领取道具',nothing:'每颗豆都已归位'};if(messages[result.reason])hint(messages[result.reason]);return;}
  if(tutorial)tutorial.step=advanceGuideStep(tutorial.step,result,game,gameArtwork(game));
  const newly=syncCompletedColors(!!result.moved);
  sound(result.moved?'place':'pick');if(result.route==='store'){const first=game.tray.indexOf(before?.selection?.color);if(first>=0)trayOffset=Math.floor(first/12);}animatePlacement(result.placed);renderAll();animateMove(result,before);if(result.won)win();
  else if(result.moved&&result.remaining>0)toast(`已放 ${result.moved} 颗，还剩 ${result.remaining} 颗 · 继续点空格`);
  else if(newly.length)hint(`${result.placed?.length>1?`啪嗒！一口气归位 ${result.moved} 颗 · `:''}${newly.length===1?'这一色':`${newly.length} 种颜色`}全部拼齐啦 ✦`);
  else if(result.placed?.length>1)hint(`啪嗒！一口气归位 ${result.moved} 颗`);
}
function syncTutorial(){if(tutorial)tutorial.step=inferGuideStep(game,gameArtwork(game));}
function boardTap(index){if(!game||modalOpen)return;if(game.selection?.source==='board'&&game.selection.indices.includes(index)){game.selection=null;syncTutorial();renderAll();return;}keyboardCell=index;const before=captureMove();resultFeedback(selectBoard(game,index,single),before);}
function trayTap(index){if(!game||modalOpen)return;if(game.selection?.source==='tray'&&game.selection.indices.includes(index)){game.selection=null;syncTutorial();renderAll();return;}const before=captureMove();resultFeedback(selectTray(game,index,single),before);}
function catalogueArtwork(id){return game?.level===id?gameArtwork(game):getArtwork(id);}
function updateHome(){const count=Object.keys(progress.completed).length,level=game?gameArtwork(game):getArtwork(progress.last||1);$('home-progress').textContent=`已收藏 ${count} / ${TOTAL_LEVELS}`;$('start-label').textContent=game?`继续第 ${String(game.level).padStart(2,'0')} 关`:count===TOTAL_LEVELS?'再来拼一幅':`开始第 ${String(progress.unlocked).padStart(2,'0')} 关`;thumb($('home-art'),level,true);if(screen==='home')$('scenery').style.backgroundImage=`url('./assets/${level.background}')`;}
function showHome(){dismiss(false);stopEffects();completed=new Set();tutorial=null;$('app').classList.remove('playing');$('app').scrollTop=0;renderTutorial();screen='home';syncMusic();$('home-screen').hidden=false;$('play-screen').hidden=true;$('scenery').style.backgroundImage="url('./assets/meadow.webp')";updateHome();persist();}
function enterLevel(id,existing=false,forceGuide=false){
  dismiss(false);stopEffects();tutorial=null;if(!existing||!game)game=newGame(id);completed=completedColors(game);if(forceGuide)progress.tutorialDone=false;progress.last=game.level;screen='play';trayOffset=0;$('app').classList.add('playing');fitViewport();$('app').scrollTop=0;$('home-screen').hidden=true;$('play-screen').hidden=false;zoom=1;panX=panY=0;keyboardCell=0;
  const level=gameArtwork(game);keyboardCell=level.target.findIndex(c=>c!==null);$('scenery').style.backgroundImage=`url('./assets/${level.background}')`;thumb($('reference-canvas'),level);lastTick=performance.now();requestAnimationFrame(()=>renderAll());persist();
  syncMusic();
  if(progress.autoFullscreen)fullscreen(false);
  if(game.status==='timeout')timeoutDialog();
  else if(game.level===1&&!progress.tutorialDone){if(existing&&game.moves>0){tutorial={step:inferGuideStep(game,level)};requestAnimationFrame(renderAll);}else tutorialIntro();}
  if(game.artworkMigrated){delete game.artworkMigrated;toast('已换成大格子简单图案，这一关重新开拼；收藏与道具保留');}
}
async function fullscreen(manual=true){
  const app=$('app');try{
    if(document.fullscreenElement){if(manual)await document.exitFullscreen();return;}
    if(app.requestFullscreen){await app.requestFullscreen({navigationUI:'hide'});try{await screenOrientationLock();}catch{}}
    else{app.classList.toggle('immersive',manual?!app.classList.contains('immersive'):true);if(manual)toast('沉浸模式已切换，竖屏拼豆更舒服');}
  }catch{if(manual){app.classList.toggle('immersive');toast('已切换沉浸模式');}}
}
function screenOrientationLock(){return window.screen.orientation?.lock?.('portrait');}
document.addEventListener('fullscreenchange',()=>{$('fullscreen-btn').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');requestAnimationFrame(draw);});
let previousFocus=null;
function modal(html,{close=true,onDismiss=null,className=''}={}){
  if(modalOpen)dismiss(false);tick();modalOpen=true;syncMusic();previousFocus=document.activeElement;modalDismiss=onDismiss;
  $('modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${close?`<button class="modal-close" aria-label="关闭">${icon('close')}</button>`:''}${html}</section></div>`;
  $('modal-root').querySelector('.modal-close')?.addEventListener('click',dismiss);
  $('modal-root').querySelector('.modal-backdrop').addEventListener('click',e=>{if(close&&e.target===e.currentTarget)dismiss();});
  requestAnimationFrame(()=>$('modal-root').querySelector('button:not(:disabled)')?.focus());
}
function dismiss(resumeMusic=true){const fn=modalDismiss;modalDismiss=null;modalOpen=false;$('modal-root').innerHTML='';cancelAnimationFrame(confettiFrame);$('confetti').style.display='none';lastTick=performance.now();previousFocus?.focus?.({preventScroll:true});fn?.();if(resumeMusic)syncMusic();}
document.addEventListener('keydown',e=>{if(!modalOpen)return;if(e.key==='Escape'&&$('modal-root').querySelector('.modal-close')){e.preventDefault();dismiss();}if(e.key==='Tab'){const focusables=[...$('modal-root').querySelectorAll('button:not(:disabled),a,input')];const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
function renderTutorial(){
  const active=!!tutorial&&screen==='play';$('tutorial-guide').hidden=!active;
  $('settings-btn').classList.toggle('guided-control',active&&tutorial.step===6);
  $('tray').classList.toggle('guided-control',active&&[1,4].includes(tutorial.step));
  if(!active)return;
  $('tutorial-step').textContent=`新手引导 ${tutorial.step+1} / ${GUIDE_STEPS.length}`;$('tutorial-text').textContent=GUIDE_STEPS[tutorial.step];
  $('tray').querySelectorAll('[data-slot]').forEach(slot=>slot.classList.toggle('tutorial-bead',tutorial.step===4&&game.tray[+slot.dataset.slot]===4));
}
function completeTutorial(){progress.tutorialDone=true;tutorial=null;persist();renderTutorial();if(game&&screen==='play')draw();}
function tutorialIntro(){
  modal(`<span class="overline">HELLO, LITTLE BEADS</span><h2 id="modal-title">跟小橘一起，试着拼</h2><p>第一关只有 120 格，先练习 20 颗错色豆。<br>跟着金色提示框，亲手试试两种归位方式。</p><div class="tutorial-example"><span class="legend-cell wrong" aria-hidden="true"></span><div><strong>周围是目标底色，凸起的是豆子颜色</strong><small>颜色不同就选走；相同颜色已经归位。</small></div></div><div class="tutorial-example"><span class="legend-cell hole" aria-hidden="true"></span><div><strong>凹下去的槽 = 空格，可以接豆</strong><small>画板错色豆、暂存豆都可以直接放进同色空格。</small></div></div><p class="guide-intro-note">暂存盒自动排齐、同色归并。接着还会介绍设置、全屏和免费工具，随时可以跳过。</p><button id="guide-start" class="primary-button">开始新手引导</button><button id="guide-freestyle" class="secondary-button">我先自己试试</button>`,{close:false});
  $('guide-start').onclick=()=>{dismiss();single=false;$('mode-btn').textContent='同色连取';$('mode-btn').setAttribute('aria-pressed',false);tutorial={step:inferGuideStep(game,gameArtwork(game))};renderAll();};
  $('guide-freestyle').onclick=()=>{dismiss();completeTutorial();renderAll();};
}
function replayTutorial(){modal(`<div class="center"><h2 id="modal-title">再跟小橘练习一次？</h2><p>当前未完成的画板会重新开始。<br>已收藏的关卡继续保留。</p><button class="primary-button" id="replay-guide-confirm">开始第一关教学</button><button class="secondary-button" id="replay-guide-cancel">继续当前关卡</button></div>`);$('replay-guide-confirm').onclick=()=>enterLevel(1,false,true);$('replay-guide-cancel').onclick=settings;}
function settings(){
  const graduated=tutorial?.step===6;if(graduated)completeTutorial();
  modal(`<span class="overline">TAKE IT SLOW</span><h2 id="modal-title">小镇设置</h2><p>${graduated?'新手引导完成！再认识几个好用的开关。':'按自己的节奏拼，快乐就好。'}</p>${[['music','录屏背景音乐','分离后的原录屏音乐，无缝循环'],['sound','轻轻的拼豆声','舒适的点击音效'],['autoFullscreen','开始时自动全屏','开始按钮尝试全屏，右上角手动切换'],['numbers','显示颜色编号','凸豆数字是豆色，凹槽数字是目标色']].map(([key,title,desc])=>`<div class="setting-row"><div>${title}<small>${desc}</small></div><button class="switch" role="switch" aria-label="${title}" aria-checked="${!!progress[key]}" data-setting="${key}"><span></span></button></div>`).join('')}${graduated?'<div class="help-note guide-tools">画板下方：同色连取 / 单颗切换，双指或 ＋ − 缩放。<br>暂存盒「加一行」、道具 ＋ 都免费，时钟每次加 3 分钟，不限次数。撤销可退回上次移动；打开弹窗会暂停计时。</div>':''}<div class="settings-actions"><button class="secondary-button" id="settings-help">玩法说明</button><button class="secondary-button" id="settings-home">回到小镇</button></div><button class="secondary-button" id="settings-guide">重玩新手教学</button>${game?'<button class="secondary-button" id="restart-level">重新拼这一关</button>':''}<p style="font-size:9px;margin-bottom:0">进度保存在当前浏览器 Cookie；清理站点数据会重新开始。</p>`);
  $('modal-root').querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{const key=b.dataset.setting;progress[key]=!progress[key];b.setAttribute('aria-checked',progress[key]);syncMusic();persist();if(game)renderAll();});
  $('settings-help').onclick=help;$('settings-home').onclick=showHome;$('settings-guide').onclick=replayTutorial;$('restart-level')?.addEventListener('click',()=>confirmRestart(game.level));
}
function confirmRestart(id){modal(`<div class="center"><div class="modal-icon">${icon('paw')}</div><h2 id="modal-title">重新拼这一幅？</h2><p>这一关的画板和暂存盒会重新开始。<br>已收藏的图案会好好保留。</p><button id="restart-confirm" class="primary-button">重新开始</button><button id="restart-cancel" class="secondary-button">接着慢慢拼</button></div>`);$('restart-confirm').onclick=()=>enterLevel(id);$('restart-cancel').onclick=dismiss;}
function help(){
  modal(`<span class="overline">A TINY GUIDE</span><h2 id="modal-title">两条路线，都能归位</h2><ol class="help-steps"><li><b>1</b><div><strong>看底色，选错色豆</strong><br>看凸起豆子的颜色，再看周围的目标底色。两种颜色不同才需要移动；豆色和底色一致就已归位。凹下去的格子是空槽。点错色豆，连选上下左右相邻且豆色相同的错色豆，跨底色也能连选，没有数量上限。正确豆和空槽不连选。</div></li><li><b>2</b><div><strong>有同色空格？直接放！</strong><br>选中画板错色豆，直接点相同底色的凹槽空格，不用经过暂存盒。一次填满点击处连续的同色空格。先搬最初点选豆子所在底色下的选中豆，再搬其它底色下的选中豆。没放完的豆保持选中，可接着点其它地方的同色空格。</div></li><li><b>3</b><div><strong>没有空格？先暂存</strong><br>点下方空格收豆，不限制单次颗数，按剩余空位尽量收下全部选中豆；空间不足时剩余豆继续选中；暂存盒会自动排齐并归并同色。再点暂存豆，放进画板同色空格。空间满了可免费加一行。</div></li></ol><div class="help-note">✧ 100% 已能看清全部格子；同色连取可以一片归位。点「同色连取」切换单颗操作；双指、滚轮或 ＋ − 缩放，放大后可拖动画板。<br>✧ 某一色全部归位时，整色轻闪一次，原有凸豆保留立体斜面与阴影，并持续带有静态炫光。<br>✧ 不规则关卡只显示图形轮廓，图形外的留白不是空槽；同底色的外沿可以连续连取。<br>✧ 新增暂存行自动显示；行数多时使用暂存盒底部左右箭头翻行，全部空间都可访问，不需要滚动整个画面。<br>✧ 小磁铁归位 10 颗；整理刷把暂存豆放回空格。<br>✧ 道具旁 ＋ 免费领取，时钟每次 ＋3 分钟，不限次数。<br>✧ 左上角设置音效、编号、自动全屏，右上角手动全屏。<br>✧ 打开弹窗或离开页面暂停计时，进度自动保存。</div><button class="primary-button" id="help-close">懂啦，接着拼</button>`);$('help-close').onclick=dismiss;
}
function levels(chapter=game?gameArtwork(game).chapter:Math.floor((progress.unlocked-1)/10)){
  modal(`<span class="overline">THE LITTLE COLLECTION</span><h2 id="modal-title">毛球图鉴 <small style="font-size:11px;color:#a0ab90">${Object.keys(progress.completed).length} / ${TOTAL_LEVELS}</small></h2><div class="chapter-tabs">${CHAPTERS.map((c,i)=>`<button data-chapter="${i}" class="${i===chapter?'active':''}">${c.name}</button>`).join('')}</div><div class="level-grid">${LEVELS.map(l=>catalogueArtwork(l.id)).filter(l=>l.chapter===chapter).map(l=>{const done=progress.completed[l.id],locked=l.id>progress.unlocked;return `<button class="level-tile${locked?' locked':''}${game?.level===l.id?' current':''}" data-level="${l.id}" aria-label="第 ${l.id} 关 ${l.name}${locked?'，尚未解锁':''}"${locked?' aria-disabled="true"':''}><canvas id="level-art-${l.id}" width="180" height="194"></canvas><span class="tile-badge">${done?'✓ 已收藏':locked?'未解锁':game?.level===l.id?'进行中':'可以开拼'}</span><strong>${String(l.id).padStart(2,'0')} · ${l.name}</strong><small>${l.width} × ${l.height} · ${l.cellCount} 颗${done?` · ${done.moves} 步`:''}</small></button>`;}).join('')}</div>`,{className:'level-modal'});
  LEVELS.map(l=>catalogueArtwork(l.id)).filter(l=>l.chapter===chapter).forEach(l=>thumb($(`level-art-${l.id}`),l));
  $('modal-root').querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>levels(+b.dataset.chapter));
  $('modal-root').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{const id=+b.dataset.level;if(id>progress.unlocked){toast('先完成前面的图案，就能解锁这幅啦');return;}if(game?.level===id){enterLevel(id,true);return;}if(game&&game.status!=='won'){modal(`<div class="center"><h2 id="modal-title">去拼另一幅图？</h2><p>当前第 ${game.level} 关尚未拼完。<br>切换图案后，这一关会重新开始。</p><button class="primary-button" id="switch-confirm">去第 ${id} 关</button><button class="secondary-button" id="switch-cancel">先拼完这一幅</button></div>`);$('switch-confirm').onclick=()=>enterLevel(id);$('switch-cancel').onclick=dismiss;}else enterLevel(id);});
}
function adminLevels(chapter=game?gameArtwork(game).chapter:0){
  modal(`<span class="overline">HIDDEN STUDIO</span><h2 id="modal-title">管理员 · 自由跳关</h2><p class="admin-note">直接体验任意关卡，不会自动通关或增加收藏。<br>切换前会确认，当前未完成的画板将重新开始。</p><form id="admin-jump-form" class="admin-jump"><label for="admin-level-input">关卡</label><input id="admin-level-input" type="number" inputmode="numeric" min="1" max="${TOTAL_LEVELS}" step="1" value="${game?.level||progress.last}" required aria-label="跳转关卡编号，1 至 ${TOTAL_LEVELS}"><button type="submit">去这一关 →</button></form><p id="admin-jump-error" class="admin-error" role="status" hidden>请输入 1～${TOTAL_LEVELS} 的整数关卡编号</p><div class="chapter-tabs">${CHAPTERS.map((c,i)=>`<button data-admin-chapter="${i}" class="${i===chapter?'active':''}">${c.name}</button>`).join('')}</div><div class="level-grid">${LEVELS.map(l=>catalogueArtwork(l.id)).filter(l=>l.chapter===chapter).map(l=>`<button class="level-tile${game?.level===l.id?' current':''}" data-admin-level="${l.id}" aria-label="跳转第 ${l.id} 关 ${l.name}"><canvas id="admin-art-${l.id}" width="180" height="194"></canvas><span class="tile-badge">${progress.completed[l.id]?'✓ 已收藏':game?.level===l.id?'进行中':'直接试关'}</span><strong>${String(l.id).padStart(2,'0')} · ${l.name}</strong><small>${l.width} × ${l.height} · ${l.cellCount} 颗</small></button>`).join('')}</div>`,{className:'level-modal admin-modal'});
  LEVELS.map(l=>catalogueArtwork(l.id)).filter(l=>l.chapter===chapter).forEach(l=>thumb($(`admin-art-${l.id}`),l));
  $('modal-root').querySelectorAll('[data-admin-chapter]').forEach(b=>b.onclick=()=>adminLevels(+b.dataset.adminChapter));
  $('modal-root').querySelectorAll('[data-admin-level]').forEach(b=>b.onclick=()=>adminJump(+b.dataset.adminLevel));
  $('admin-jump-form').onsubmit=e=>{e.preventDefault();adminJump($('admin-level-input').value);};
}
function adminJump(raw){
  const id=jumpLevelId(raw);if(id===null){$('admin-jump-error').hidden=false;return;}
  if(game?.level===id){enterLevel(id,true);return;}
  if(game&&game.status!=='won'){
    const old=game.level;modal(`<div class="center"><h2 id="modal-title">跳到第 ${id} 关？</h2><p>第 ${old} 关的未完成画板将重新开始。<br>已收藏图案和设置继续保留。</p><button class="primary-button" id="admin-switch-confirm">确认跳关</button><button class="secondary-button" id="admin-switch-cancel">返回跳关面板</button></div>`);
    $('admin-switch-confirm').onclick=()=>enterLevel(id);$('admin-switch-cancel').onclick=()=>adminLevels(LEVELS[id-1].chapter);
  }else enterLevel(id);
}
function preview(){
  const level=gameArtwork(game);
  modal(`<span class="overline">A PICTURE TO KEEP</span><h2 id="modal-title">${level.name}</h2><p style="margin-bottom:0">${CHAPTERS[level.chapter].name} · 第 ${level.id} 关 · ${level.width} × ${level.height}</p><canvas id="preview-art" class="preview-art" width="560" height="600"></canvas><div class="preview-palette">${[...new Set(level.target.filter(c=>c!==null))].sort((a,b)=>a-b).map(i=>`<span style="background:${level.palette[i]}" title="颜色 ${i+1}"></span>`).join('')}</div><p class="center" style="font-size:11px;margin-bottom:0">简单图案，大块同色，一片一片归位。</p>`);
  thumb($('preview-art'),level,true);
}
function freeTool(tool){if(!game)return;game.tools[tool]++;saveSoon();updateHUD();toast(`${tool==='magnet'?'小磁铁':'整理刷'} ＋1，免费领取成功`);sound();}
function addTime(){if(!game)return;extend(game);syncMusic();saveSoon();updateHUD();toast('又多了 3 分钟，继续慢慢拼');sound();}
function timeoutDialog(){
  if(!game||game.status!=='timeout')return;persist();
  modal(`<div class="center"><span class="overline">NO NEED TO HURRY</span><div class="modal-icon" style="margin-top:15px">${icon('clock')}</div><h2 id="modal-title">好时光，再来三分钟</h2><p>图案和暂存豆都留在原地。<br>免费续时，不看广告，不限次数。</p><button class="primary-button" id="extend-confirm">免费 ＋3 分钟，继续拼</button><button class="secondary-button" id="timeout-home">回小镇歇一会儿</button></div>`,{close:false});
  $('extend-confirm').onclick=()=>{dismiss();addTime();lastTick=performance.now();renderAll();};$('timeout-home').onclick=showHome;
}
function win(){
  if(tutorial)completeTutorial();
  const id=game.level,level=gameArtwork(game),previous=progress.completed[id],record={moves:game.moves,elapsed:Math.round(game.elapsed)};
  if(!previous||previous.moves>record.moves)progress.completed[id]=record;progress.unlocked=Math.min(TOTAL_LEVELS,Math.max(progress.unlocked,id+1));progress.last=Math.min(TOTAL_LEVELS,id+1);persist();sound('win');
  modal(`<div class="center"><span class="overline">ONE MORE LITTLE JOY</span><div class="win-stars">✦ ✦ ✦</div><h2 id="modal-title">${Object.keys(progress.completed).length===TOTAL_LEVELS?'整个小镇，都被你点亮啦！':'拼好啦，真好看！'}</h2><p style="margin:4px 0">「${level.name}」已加入毛球图鉴</p><canvas id="win-art" class="win-art" width="400" height="440"></canvas><div class="win-stats"><span><strong>${game.moves}</strong>次归位操作</span><span><strong>${Math.floor(game.elapsed/60)}分${Math.round(game.elapsed%60)}秒</strong>快乐时光</span><span><strong>${Object.keys(progress.completed).length}/${TOTAL_LEVELS}</strong>已收藏图案</span></div><button class="primary-button" id="next-btn">${id===TOTAL_LEVELS?'再去小镇逛逛':'下一幅，接着拼'} ${icon('arrow')}</button><div class="settings-actions"><button class="secondary-button" id="save-art">保存拼豆画</button><button class="secondary-button" id="win-home">回毛球小镇</button></div></div>`,{close:false});
  thumb($('win-art'),level,true);$('next-btn').onclick=()=>{if(id===TOTAL_LEVELS){game=null;showHome();}else enterLevel(id+1);};$('win-home').onclick=()=>{game=null;showHome();};$('save-art').onclick=()=>exportArtwork(level);confetti();
}
function exportArtwork(level){
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000;const c=canvas.getContext('2d');c.fillStyle='#fff9ec';c.fillRect(0,0,800,1000);const art=document.createElement('canvas');art.width=700;art.height=770;thumb(art,level,true);c.drawImage(art,50,90);c.textAlign='center';c.fillStyle='#657d5d';c.font='bold 30px sans-serif';c.fillText(`拼就完了 · ${level.name}`,400,920);c.fillStyle='#a3aa91';c.font='16px sans-serif';c.fillText(`毛球小镇 / 第 ${String(level.id).padStart(2,'0')} 幅小美好`,400,955);
  canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`毛球拼豆-${String(level.id).padStart(2,'0')}-${level.name}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('拼豆画已准备好保存');},'image/png');
}
function confetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const canvas=$('confetti'),c=canvas.getContext('2d'),w=$('app').clientWidth,h=$('app').clientHeight;canvas.width=w;canvas.height=h;canvas.style.display='block';const pieces=Array.from({length:70},()=>({x:Math.random()*w,y:-Math.random()*h*.7,vx:(Math.random()-.5)*1.6,vy:1.5+Math.random()*2,size:3+Math.random()*5,color:['#a5bd8c','#edb6b0','#d1b87b','#bfa7cb'][Math.floor(Math.random()*4)],r:Math.random()*6}));let t=0;
  const frame=()=>{c.clearRect(0,0,w,h);pieces.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=.035;c.save();c.translate(p.x,p.y);c.rotate(p.r);c.fillStyle=p.color;rounded(c,-p.size/2,-p.size/2,p.size,p.size*1.5,2);c.fill();c.restore();});if(++t<240)confettiFrame=requestAnimationFrame(frame);else{canvas.style.display='none';c.clearRect(0,0,w,h);}};frame();
}
function tick(){
  const now=performance.now(),delta=(now-lastTick)/1000;lastTick=now;if(!game||screen!=='play'||modalOpen||document.hidden||game.status!=='playing')return;
  game.remaining=Math.max(0,game.remaining-delta);game.elapsed+=delta;updateHUD();if(now-lastSave>5000){persist();lastSave=now;}if(game.remaining<=0){game.status='timeout';game.selection=null;syncTutorial();renderAll();timeoutDialog();}
}
setInterval(tick,250);
document.addEventListener('visibilitychange',()=>{tick();lastTick=performance.now();syncMusic();persist();});window.addEventListener('pagehide',()=>{music.setPlaying(false);persist();});window.addEventListener('pageshow',syncMusic);
window.addEventListener('beforeunload',persist);new ResizeObserver(()=>requestAnimationFrame(draw)).observe($('board-viewport'));
function indexAt(x,y){const level=gameArtwork(game),r=$('board').getBoundingClientRect(),cx=Math.floor((x-r.left-geo.left)/geo.cell),cy=Math.floor((y-r.top-geo.top)/geo.cell);const i=cx>=0&&cy>=0&&cx<level.width&&cy<level.height?cy*level.width+cx:-1;return i>=0&&level.target[i]!==null?i:-1;}
function pinchStart(){const [a,b]=[...pointers.values()];gesture={type:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,panX,panY,centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2};suppressClick=true;}
$('board').addEventListener('pointerdown',e=>{if(!game||modalOpen)return;e.preventDefault();$('board').setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){gesture={type:'pan',x:e.clientX,y:e.clientY,panX,panY,dragged:false};suppressClick=false;}else if(pointers.size===2)pinchStart();});
$('board').addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2&&gesture?.type==='pinch'){const [a,b]=[...pointers.values()],ratio=Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance);zoom=Math.min(3.2,Math.max(1,gesture.zoom*ratio));panX=gesture.panX+(a.x+b.x)/2-gesture.centerX;panY=gesture.panY+(a.y+b.y)/2-gesture.centerY;draw();}else if(gesture?.type==='pan'){const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>8)gesture.dragged=true;if(zoom>1){panX=gesture.panX+dx;panY=gesture.panY+dy;draw();}}});
function pointerEnd(e,cancel=false){if(!pointers.has(e.pointerId))return;const was=gesture;pointers.delete(e.pointerId);if(!cancel&&!suppressClick&&!was?.dragged&&pointers.size===0){const i=indexAt(e.clientX,e.clientY);if(i>=0)boardTap(i);}if(pointers.size===1){const p=[...pointers.values()][0];gesture={type:'pan',x:p.x,y:p.y,panX,panY,dragged:true};}if(!pointers.size)gesture=null;}
$('board').addEventListener('pointerup',e=>pointerEnd(e));$('board').addEventListener('pointercancel',e=>pointerEnd(e,true));
$('board').addEventListener('wheel',e=>{if(!game)return;e.preventDefault();zoom=Math.max(1,Math.min(3.2,zoom-e.deltaY*.002));draw();},{passive:false});
$('board').addEventListener('keydown',e=>{if(!game||modalOpen)return;const level=gameArtwork(game),directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(directions[e.key]){e.preventDefault();const [dx,dy]=directions[e.key];let x=keyboardCell%level.width,y=Math.floor(keyboardCell/level.width);while((x+=dx)>=0&&x<level.width&&(y+=dy)>=0&&y<level.height){const i=y*level.width+x;if(level.target[i]!==null){keyboardCell=i;break;}}draw();}if(e.key==='Enter'||e.key===' '){e.preventDefault();boardTap(keyboardCell);}});
$('board').addEventListener('focus',draw);$('board').addEventListener('blur',draw);
$('tray').onclick=e=>{const slot=e.target.closest('[data-slot]');if(slot)trayTap(+slot.dataset.slot);};
$('start-btn').onclick=()=>{sound();enterLevel(game?.level||progress.unlocked,!!game);};$('settings-btn').onclick=settings;$('fullscreen-btn').onclick=()=>fullscreen(true);$('levels-btn').onclick=()=>levels();$('home-levels-btn').onclick=()=>levels();$('help-btn').onclick=help;$('preview-btn').onclick=preview;
const hiddenTaps=hiddenTapSequence();
function brandTap(){if(!modalOpen&&hiddenTaps(performance.now()))adminLevels();}
$('brand-entry').onclick=brandTap;
$('brand-entry').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();brandTap();}};
$('tutorial-skip').onclick=()=>{completeTutorial();renderAll();toast('随时可在设置里重玩新手教学');};
$('cancel-btn').onclick=()=>{game.selection=null;syncTutorial();renderAll();};$('mode-btn').onclick=()=>{single=!single;$('mode-btn').textContent=single?'单颗操作':'同色连取';$('mode-btn').setAttribute('aria-pressed',single);if(game){game.selection=null;syncTutorial();renderAll();}toast(single?'现在一次只取一颗豆':'相邻同色错色豆连取，跨底色、不限数量');};
$('zoom-in').onclick=()=>{zoom=Math.min(3.2,zoom+.35);draw();};$('zoom-out').onclick=()=>{zoom=Math.max(1,zoom-.35);draw();};$('zoom-reset').onclick=()=>{zoom=1;panX=panY=0;draw();};
$('add-row-btn').onclick=()=>{if(!game)return;addRow(game);trayOffset=trayRange().maxOffset;renderAll();toast(`已扩展到 ${game.rows} 行，新的一行已显示`);};
$('tray-prev').onclick=()=>{trayOffset-=trayRange().count;renderTray();};$('tray-next').onclick=()=>{trayOffset+=trayRange().count;renderTray();};
$('magnet-btn').onclick=()=>resultFeedback(magnet(game));$('brush-btn').onclick=()=>resultFeedback(brush(game));document.querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>freeTool(b.dataset.claim));
$('time-tool-btn').onclick=addTime;$('timer-btn').onclick=addTime;$('undo-btn').onclick=()=>{if(undo(game)){stopEffects();syncTutorial();renderAll();sound();toast('已退回上一步');}};
function fitViewport(){const height=Math.round(Math.min(innerHeight,window.visualViewport?.height||innerHeight));document.documentElement.style.setProperty('--play-height',height+'px');if(game&&screen==='play'){window.scrollTo(0,0);$('app').scrollTop=0;requestAnimationFrame(()=>{renderTray();draw();});}}
window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);document.addEventListener('fullscreenchange',()=>{fitViewport();setTimeout(fitViewport,100);setTimeout(fitViewport,350);});fitViewport();
updateHome();
