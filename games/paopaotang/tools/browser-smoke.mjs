// Use playwright-cli run-code in a dedicated browser session. Saved fixtures
// are installed on a non-game page so pagehide cannot overwrite them.
export async function browserSmoke(page) {
 const base=new URL('/games/paopaotang/',page.url()).href,results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const state=async(p,platform)=>p.evaluate(platform=>{const envelope=JSON.parse(localStorage.getItem(`fish-bubble-town:${platform}:v1`));return {game:JSON.parse(envelope.game),envelope};},platform);
 const waitStatus=async(p,status)=>p.waitForFunction(status=>JSON.parse(JSON.parse(localStorage.getItem(`fish-bubble-town:${document.body.dataset.platform}:v1`)).game).status===status,status,{timeout:15000});
 async function fixture(p,platform,kind='normal'){
  await p.goto(base+'assets/icon.svg');
  await p.evaluate(async({base,platform,kind})=>{
   const {newGame,serialize,CRATE,EMPTY}=await import(base+'engine.mjs');
   const g=newGame({platform,seed:802,mode:kind.startsWith('duo')?'duo':'solo'});
   g.board=g.board.map(v=>v===CRATE?EMPTY:v);
   g.players.filter(p=>p.control==='ai').forEach(p=>{p.nextMove=1e8;p.invulnerableUntil=0;});
   const relocate=(p,x,y)=>Object.assign(p,{x,y,fromX:x,fromY:y});
   if(kind==='win'){
    g.players[0].power=3;relocate(g.players[1],4,1);relocate(g.players[2],1,4);
   }
   if(kind==='trap'){g.players[0].status='trapped';g.players[0].trappedAt=0;}
   if(kind==='duo-rescue'){relocate(g.players[1],3,1);g.players[1].status='trapped';g.players[1].trappedAt=0;}
   localStorage.setItem(`fish-bubble-town:${platform}:v1`,JSON.stringify({game:serialize(g),sound:false}));
  },{base,platform,kind});
  await p.goto(base+platform+'.html');
 }
 await page.setViewportSize({width:1366,height:900});
 await fixture(page,'pc','win');
 await page.locator('#overlay-content [data-action="start"]').click();
 await page.keyboard.press('Space');
 await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');
 await page.keyboard.down('s');await page.waitForTimeout(240);await page.keyboard.up('s');
 await waitStatus(page,'won');await page.waitForTimeout(100);
 const won=await state(page,'pc');
 assert(won.game.enemiesOut===2&&won.game.players[0].status==='active','Water-column victory');
 assert(won.envelope.records['solo:normal'].unlocked===2,'Map unlock');
 assert(await page.locator('#overlay-content [data-action="next"]').isVisible(),'Victory action');
 await page.locator('#overlay-content [data-action="next"]').click();await waitStatus(page,'ready');
 assert((await state(page,'pc')).game.level===2,'Next round');
 results.push({PC:true,keyboardMovement:true,waterBomb:true,fullVictory:true,stars:true,nextLevel:true});

 await fixture(page,'pc','duo');
 await page.locator('#overlay-content [data-action="start"]').click();
 await page.keyboard.down('d');await page.waitForTimeout(120);await page.keyboard.up('d');
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(120);await page.keyboard.up('ArrowUp');
 await page.keyboard.press('Space');await page.keyboard.press('Enter');await page.waitForTimeout(100);
 await page.keyboard.press('p');await waitStatus(page,'paused');
 const duo=(await state(page,'pc')).game;
 assert(duo.players[0].x===2&&duo.players[1].y===8,'Two keyboard players');
 assert(duo.bombs.some(b=>b.owner==='p1')&&duo.bombs.some(b=>b.owner==='p2'),'Independent bomb inputs');
 const beforePause=JSON.stringify(duo),timer=await page.locator('#timer').textContent();
 await page.waitForTimeout(700);
 assert(await page.locator('#timer').textContent()===timer,'Paused clock');
 await page.reload();await waitStatus(page,'paused');
 assert(JSON.stringify((await state(page,'pc')).game)===beforePause,'Dynamic saved round');
 await page.locator('#overlay-content [data-action="start"]').click();
 await page.getByRole('button',{name:'重新开始',exact:true}).click();
 assert(await page.locator('#confirm-dialog').isVisible(),'Restart confirmation');
 await page.getByRole('button',{name:'继续本局',exact:true}).click();await waitStatus(page,'running');
 assert((await state(page,'pc')).game.bombs.length===2,'Cancel restart preserves round');
 await page.locator('#difficulty-select').selectOption('hard');
 await page.getByRole('button',{name:'开启新一局',exact:true}).click();await waitStatus(page,'ready');
 assert((await state(page,'pc')).game.difficulty==='hard','Difficulty change');
 results.push({cooperativeKeyboard:true,pause:true,saveResume:true,confirm:true,difficulty:true});

 await fixture(page,'pc','duo-rescue');
 await page.locator('#overlay-content [data-action="start"]').click();
 await page.keyboard.down('d');await page.waitForTimeout(360);await page.keyboard.up('d');await page.keyboard.press('p');
 const rescue=(await state(page,'pc')).game;
 assert(rescue.players[1].status==='active'&&rescue.players[1].needles===1,'Free teammate rescue');
 results.push({teammateRescue:true});

 const pcBefore=await page.evaluate(()=>localStorage.getItem('fish-bubble-town:pc:v1'));
 await page.setViewportSize({width:390,height:844});await fixture(page,'mobile');
 await page.locator('#overlay-content [data-action="start"]').click();
 await page.getByRole('button',{name:'向右移动',exact:true}).click();await page.waitForTimeout(120);
 await page.locator('#pause-button').click();
 assert((await state(page,'mobile')).game.players[0].x===2,'Short direction tap');
 assert(await page.evaluate(()=>localStorage.getItem('fish-bubble-town:pc:v1'))===pcBefore,'Mobile touched PC storage');
 results.push({mobileShortTap:true,isolatedSaves:true});
 for(const[width,height]of[[320,658],[375,812],[390,844],[430,932],[768,1024]]){
  await page.setViewportSize({width,height});
  const sizes=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controlBottom:document.querySelector('.touch-controls').getBoundingClientRect().bottom}));
  assert(sizes.scrollWidth<=sizes.width,'Mobile horizontal overflow');
  if(height>=812)assert(sizes.controlBottom<=height,'Touch controls below fold');
  results.push({viewport:`${width}x${height}`,overflow:false});
 }

 const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 try{
  const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));
  await fixture(phone,'mobile');await phone.locator('#overlay-content [data-action="start"]').tap();
  await phone.getByRole('button',{name:'向右移动',exact:true}).tap();await phone.waitForTimeout(120);
  await phone.getByRole('button',{name:'放置水泡',exact:true}).tap();await phone.waitForTimeout(100);await phone.locator('#pause-button').tap();
  const played=(await state(phone,'mobile')).game;
  assert(played.players[0].x===2&&played.bombs.length===1,'Real touch movement and planting');
  await fixture(phone,'mobile','trap');await phone.locator('#overlay-content [data-action="start"]').tap();
  await phone.getByRole('button',{name:'使用救援针',exact:true}).tap();await phone.waitForTimeout(100);await phone.locator('#pause-button').tap();
  const rescued=(await state(phone,'mobile')).game;
  assert(rescued.players[0].status==='active'&&rescued.players[0].needles===0,'Touch needle rescue');
  results.push({realTouch:true,touchWaterBomb:true,needleRescue:true});
 }finally{await context.close();}
 await page.setViewportSize({width:1366,height:900});await page.goto(base);
 await page.waitForURL('**/pc.html');
 const desktop=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bottom:document.querySelector('.abilities').getBoundingClientRect().bottom,height:innerHeight}));
 assert(desktop.scrollWidth<=desktop.width&&desktop.bottom<=desktop.height,'Desktop first-screen layout');
 assert(errors.length===0,errors.join('; '));
 return {result:'PASS',results,pageErrors:errors};
}
