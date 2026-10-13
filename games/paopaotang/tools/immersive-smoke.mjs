// Real browser checks for both games. Run only in a dedicated test session.
export async function immersiveSmoke(page){
 const origin=new URL(page.url()).origin,results=[],errors=[];
 const assert=(value,message)=>{if(!value)throw Error(message);};
 page.on('pageerror',e=>errors.push(e.message));
 const wait=async()=>page.waitForTimeout(80);
 for(const id of ['lianliankan','paopaotang']){
  const base=`${origin}/games/${id}/`;await page.setViewportSize({width:1366,height:900});
  await page.goto(base+'assets/icon.svg');
  await page.evaluate(id=>localStorage.removeItem(`${id==='lianliankan'?'fish-lianliankan':'fish-bubble-town'}:pc:v1`),id);
  await page.goto(base+'pc.html');
  const selector=id==='lianliankan'?'.tile':'#game-canvas';
  const normal=await page.locator(selector).first().evaluate(e=>e.getBoundingClientRect().width);
  await page.getByRole('button',{name:'全屏游玩',exact:true}).click();await wait();
  assert(await page.evaluate(()=>document.fullscreenElement===document.documentElement),'Native fullscreen');
  const full=await page.locator(selector).first().evaluate(e=>e.getBoundingClientRect().width);
  assert(full>normal*1.4,`${id} not enlarged`);
  await page.locator('#overlay-content [data-action="start"]').click();
  if(id==='lianliankan'){
   const move=await page.evaluate(async()=>{
    const {findMove}=await import('./engine.mjs');return findMove(JSON.parse(JSON.parse(localStorage.getItem('fish-lianliankan:pc:v1')).game));
   });
   await page.locator(`.tile[data-index="${move.a}"]`).click();await page.locator(`.tile[data-index="${move.b}"]`).click();await page.waitForTimeout(320);
   assert(await page.locator('.tile.empty').count()===2,'Fullscreen tile match');
  }else{
   await page.keyboard.down('d');await page.waitForTimeout(35);await page.keyboard.up('d');
   assert(Number(await page.locator('#game-canvas').getAttribute('data-p1-x'))>=2,'Fullscreen keyboard focus');
  }
  for(const[width,height]of[[1366,768],[1920,1080],[1366,900]]){
   await page.setViewportSize({width,height});await wait();
   const bounds=await page.evaluate(id=>{
    const board=document.querySelector(id==='lianliankan'?'#board-frame':'#arena-frame').getBoundingClientRect();
    const tools=document.querySelector(id==='lianliankan'?'.toolbelt':'.abilities').getBoundingClientRect();
    return{overflow:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,boardBottom:board.bottom,toolsBottom:tools.bottom,height:innerHeight};
   },id);
   assert(!bounds.overflow&&bounds.boardBottom<=bounds.height&&bounds.toolsBottom<=bounds.height,`${id} fullscreen clipped at ${width}x${height}`);
  }
  await page.keyboard.press('Escape');await wait();
  assert(await page.evaluate(()=>!document.fullscreenElement&&!document.body.classList.contains('immersive')),'Esc exit');
  const status=await page.evaluate(id=>JSON.parse(JSON.parse(localStorage.getItem(`${id==='lianliankan'?'fish-lianliankan':'fish-bubble-town'}:pc:v1`)).game).status,id);
  assert(status==='running','Fullscreen exit paused/reset the round');
  await page.keyboard.press('f');await wait();await page.keyboard.press('f');await wait();
  assert(await page.evaluate(()=>!document.body.classList.contains('immersive')),'F toggle');
  // Browsers that reject native fullscreen retain the same enlarged layout.
  await page.evaluate(()=>document.documentElement.requestFullscreen=async()=>{throw Error('test denial');});
  await page.getByRole('button',{name:'全屏游玩',exact:true}).click();await wait();
  assert(await page.evaluate(()=>document.body.classList.contains('immersive')&&!document.fullscreenElement),'Theatre fallback');
  await page.keyboard.press('Escape');await wait();await page.evaluate(()=>delete document.documentElement.requestFullscreen);
  results.push({game:id,nativeFullscreen:true,scale:Number((full/normal).toFixed(2)),resize:true,exitPreservesRound:true,fallback:true});
 }
 const base=origin+'/games/paopaotang/';
 async function fixture(kind){
  await page.goto(base+'assets/icon.svg');
  await page.evaluate(async({base,kind})=>{
   const {newGame,serialize,CRATE,EMPTY,indexOf}=await import(base+'engine.mjs');
   const g=newGame({seed:55});g.board=g.board.map(v=>v===CRATE?EMPTY:v);
   g.players.filter(p=>p.control==='ai').forEach(p=>p.nextMove=1e8);
   const p=g.players[0];p.invulnerableUntil=0;
   if(kind==='water'||kind==='trail'){
    Object.assign(p,{x:3,y:2,fromX:3,fromY:2});g.nextId=30;
    g.blasts=[{id:20,cells:[indexOf(g,3,1)],owner:'bot1',team:1,bornAt:0,damageUntil:220,expiresAt:360}];
    if(kind==='trail'){g.clock=240;g.remainingMs-=240;}
   }
   if(kind==='repeat')Object.assign(p,{x:3,y:3,fromX:3,fromY:3});
   localStorage.setItem('fish-bubble-town:pc:v1',JSON.stringify({game:serialize(g),sound:false}));
  },{base,kind});
  await page.goto(base+'pc.html');await page.locator('#overlay-content [data-action="start"]').click();
 }
 await fixture('input');
 await page.evaluate(()=>{
  window.measuredInputs=[];let pending=null;
  document.addEventListener('keydown',e=>{if(!e.repeat&&['KeyD','Space'].includes(e.code))pending={code:e.code,time:performance.now()};},true);
  new MutationObserver(()=>{
   if(!pending)return;const c=document.querySelector('#game-canvas');
   if(pending.code==='KeyD'&&Number(c.dataset.p1X)>1||pending.code==='Space'&&Number(c.dataset.bombs)>0){window.measuredInputs.push({code:pending.code,ms:performance.now()-pending.time});pending=null;}
  }).observe(document.querySelector('#game-canvas'),{attributes:true});
 });
 await page.keyboard.down('d');await page.keyboard.up('d');await page.keyboard.press('Space');await wait();
 const inputTiming=await page.evaluate(()=>window.measuredInputs);
 assert(inputTiming.length===2&&inputTiming.every(t=>t.ms<25),'Input still waits for the old simulation quantum');
 results.push({immediateInputs:inputTiming});
 await fixture('repeat');await page.keyboard.down('d');await page.keyboard.down('w');
 await page.evaluate(()=>document.querySelector('#game-canvas').dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',key:'d',repeat:true,bubbles:true})));
 await page.waitForTimeout(180);await page.keyboard.up('w');await page.keyboard.up('d');
 assert(Number(await page.locator('#game-canvas').getAttribute('data-p1-x'))===4,'Autorepeat replaced the newest turn');
 await fixture('trail');await page.keyboard.down('w');await page.keyboard.up('w');await page.waitForTimeout(100);await page.keyboard.press('p');
 const trail=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('fish-bubble-town:pc:v1')).game));
 assert(trail.players[0].y===1&&trail.players[0].status==='active','Faded water still caused damage');
 await fixture('water');await page.keyboard.down('w');await page.keyboard.up('w');await page.waitForTimeout(100);
 assert(await page.locator('#game-canvas').getAttribute('data-p1-status')==='trapped','Active water never caught the player');
 await page.keyboard.press('e');await wait();
 assert(await page.locator('#game-canvas').getAttribute('data-p1-status')==='active','Immediate self-rescue');
 results.push({autoRepeatPriority:true,visualTrailHarmless:true,activeWater:true,needle:true});
 assert(errors.length===0,errors.join('; '));return{result:'PASS',results,pageErrors:errors};
}
