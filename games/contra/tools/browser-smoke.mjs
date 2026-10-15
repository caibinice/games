// Run through playwright-cli run-code in an isolated browser session.
export async function browserSmoke(page){
 page.setDefaultTimeout(15000);
 const base=new URL('/games/contra/',page.url()).href,errors=[],results=[];
 const assert=(v,m)=>{if(!v)throw Error(m);};page.on('pageerror',e=>errors.push(e.message));
 const wait=(p,s)=>p.waitForFunction(s=>document.querySelector('canvas').dataset.status===s,s);
 const state=(p,platform)=>p.evaluate(platform=>JSON.parse(JSON.parse(localStorage.getItem(`fish-contra:${platform}:v1`)).game),platform);
 async function fixture(p,platform,level=1,boss=false){
  await p.goto(base+'assets/icon.svg');await p.evaluate(async({base,platform,level,boss})=>{
   const e=await import(base+'engine.mjs'),g=e.newGame({platform,level,seed:123});g.player.invulnerableUntil=1e9;g.spawned=[];g.nextRunner=g.nextCapsule=1e9;
   if(boss){g.player.x=g.stage.width-160;g.player.y=192;g.player.onGround=true;g.cameraX=g.stage.width-256;e.start(g);e.step(g,1000/60);g.boss.hp=1;e.pause(g);}
   localStorage.setItem(`fish-contra:${platform}:v1`,JSON.stringify({game:e.serialize(g),sound:false}));
  },{base,platform,level,boss});await p.goto(base+platform+'.html');await p.waitForFunction(()=>document.querySelector('#load-status').textContent==='本地资源就绪');
 }
 await page.setViewportSize({width:1366,height:900});await fixture(page,'pc');
 await page.locator('#overlay-content [data-action="start"]').click();await wait(page,'running');
 await page.keyboard.down('d');await page.keyboard.down('j');await page.keyboard.down('k');await page.waitForTimeout(220);await page.keyboard.up('k');await page.keyboard.up('j');await page.keyboard.up('d');await page.keyboard.press('p');await wait(page,'paused');
 const played=await state(page,'pc');assert(played.player.x>44&&played.player.y<80&&played.bullets.length>0,'Keyboard run + jump + shooting');
 const clock=played.clock;await page.waitForTimeout(350);assert(Number(await page.locator('canvas').getAttribute('data-clock'))===clock,'Paused clock');await page.reload();await wait(page,'paused');assert((await state(page,'pc')).player.x===played.player.x,'Saved exact live position');
 await page.locator('#fullscreen-button').click();assert(await page.evaluate(()=>!!document.fullscreenElement&&document.body.classList.contains('immersive')),'Native fullscreen');
 const size=await page.locator('canvas').boundingBox();assert(size.height>650&&size.width>700,'Large fullscreen viewport');
 await page.locator('#fullscreen-button').click();
 await page.evaluate(()=>document.documentElement.requestFullscreen=()=>Promise.reject(Error('fixture')));await page.keyboard.press('f');assert(await page.evaluate(()=>document.body.classList.contains('immersive')&&!document.fullscreenElement),'Fallback theatre');await page.keyboard.press('Escape');assert(!await page.evaluate(()=>document.body.classList.contains('immersive')),'Exit fallback');
 results.push({PC:true,runJumpFire:true,pause:true,dynamicSave:true,nativeFullscreen:true,theatreFallback:true});
 for(let level=1;level<=8;level++){await fixture(page,'pc',level);await page.locator('#overlay-content [data-action="start"]').click();await page.keyboard.down('j');await page.waitForTimeout(120);await page.keyboard.up('j');await page.keyboard.press('p');const s=await state(page,'pc');assert(s.level===level&&s.bullets.length>0,`Stage ${level} renderer/shooting`);results.push({level,kind:s.kind,rendered:true});}
 await fixture(page,'pc',1,true);await page.locator('#overlay-content [data-action="start"]').click();await page.keyboard.down('j');await wait(page,'won');await page.keyboard.up('j');assert((await state(page,'pc')).boss.hp===0,'Actual shot kills boss');await page.locator('[data-action="next"]').click();await wait(page,'ready');assert(Number(await page.locator('canvas').getAttribute('data-level'))===2,'Next level');results.push({actualBossKill:true,nextStage:true});
 const pcBefore=await page.evaluate(()=>localStorage.getItem('fish-contra:pc:v1'));
 await page.setViewportSize({width:390,height:844});await fixture(page,'mobile');await page.locator('#overlay-content [data-action="start"]').click();await page.locator('[data-input="jump"]').click();await page.waitForTimeout(100);await page.locator('#pause-button').click();assert((await state(page,'mobile')).player.y<96,'Short touch jump buffer');assert(await page.evaluate(()=>localStorage.getItem('fish-contra:pc:v1'))===pcBefore,'Isolated PC save');
 for(const [width,height] of [[320,658],[390,844],[430,932],[844,390]]){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');const b=await page.locator('.touch-controls').boundingBox();assert(b.y>=0&&b.y+b.height<=height,`Controls visible ${width}x${height}`);}
 const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 try{const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));await fixture(phone,'mobile');await phone.locator('#overlay-content [data-action="start"]').tap();
  const points=[];for(const [i,input]of ['right','fire','jump'].entries()){const b=await phone.locator(`[data-input="${input}"]`).boundingBox();points.push({id:i+1,x:b.x+b.width/2,y:b.y+b.height/2});}
  const cdp=await context.newCDPSession(phone);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await phone.waitForTimeout(220);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await phone.locator('#pause-button').tap();const s=await state(phone,'mobile');assert(s.player.x>44&&s.player.y<80&&s.bullets.length>0,'Three-finger real touch run/jump/fire');results.push({mobileTap:true,threeFingerTouch:true,isolatedSaves:true,responsive:true});
 }finally{await context.close();}
 await page.setViewportSize({width:1366,height:900});await fixture(page,'pc');assert(errors.length===0,errors.join(';'));return{result:'PASS',results,pageErrors:errors};
}
