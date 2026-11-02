async (page) => {
 const base='http://127.0.0.1:55437/games/zombie/',qa='E:/Documents/AI/codex/tmp/zombie-apk-20261024/reports/';
 const assert=(v,m)=>{if(!v)throw Error(m);},errors=[],requests=[];
 const ready=p=>p.waitForFunction(()=>!document.querySelector('#page>[role="status"]'));
 // A real-time battle can level up while image assertions are running. Handle
 // the actual upgrade buttons instead of forcing taps through the modal.
 await page.addLocatorHandler(page.locator('[data-choice]').first(),async()=>{
  await page.locator('[data-choice]').first().tap();
 },{noWaitAfter:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/client-maps/')&&r.url().endsWith('.webp'))requests.push(r.url());});
 await page.setViewportSize({width:393,height:852});
 await page.addInitScript(()=>{Array.prototype.at=undefined;String.prototype.at=undefined;String.prototype.replaceAll=undefined;CanvasRenderingContext2D.prototype.roundRect=undefined;});
 await page.goto(base+'mobile.html');await ready(page);
 await page.evaluate(()=>{localStorage.removeItem('fish-zombie-v1');localStorage.removeItem('fish-zombie-meta-v1');localStorage.setItem('map-peer-qa','preserve');});await page.reload();await ready(page);
 await page.getByRole('button',{name:'开始游戏',exact:true}).tap();
 for(const tab of ['shop','character','core','battle','base','journey']){await page.locator('[data-tab="'+tab+'"]').tap();const image=page.locator('.nav-item.active img');assert((await image.getAttribute('src')).endsWith('nav-tile-'+tab+'.png'),'selected artwork '+tab);}
 assert(requests.length===0,'no map images before combat');
 await page.locator('[data-tab="battle"]').tap();await page.locator('[data-action="cheats"]').tap();
 for(const flag of ['gold','diamonds','unlockAll','invincible','firepower'])await page.locator('[data-cheat="'+flag+'"]').tap();await page.locator('.dialog-close').tap();
 const played=[];
 for(const [level,mode] of [[1,'normal'],[2,'normal'],[259,'normal'],[259,'elite']]){
  await page.locator('[data-action="levels"]').tap();await page.locator('[data-chapter="'+Math.floor((level-1)/10)+'"]').tap();await page.locator('[data-level="'+level+'"]').tap();await page.locator('[data-mode="'+mode+'"]').tap();await page.locator('[data-action="start"]').tap();
  await page.waitForFunction(()=>document.querySelector('#battlefield')?.dataset.mapSource==='client');
  const data=await page.locator('#battlefield').evaluate(c=>({...c.dataset}));
  const source=(mode==='elite'?2000:1000)+level;
  const expected=await page.evaluate(async id=>(await import('/games/zombie/client-map-data.mjs')).CLIENT_LEVEL_MAPS[id],source);
  assert(Number(data.sourceId)===source&&Number(data.mapId)===expected,'native source and MapID '+source);played.push(data);
  if(level===1||level===2)await page.screenshot({path:qa+'native-map-level-'+level+'.png'});
  await page.locator('[data-action="cheats"]').tap();await page.locator('[data-action="cheat-win"]').tap();await page.getByRole('heading',{name:'战斗胜利',exact:true}).waitFor();await page.getByRole('button',{name:'返回营地',exact:true}).tap();
 }
 assert(played[0].mapId!==played[1].mapId,'different authentic map between stages');
 assert(await page.evaluate(()=>localStorage.getItem('map-peer-qa'))==='preserve','other storage key intact');
 // Network failure must leave a playable screenshot fallback, not a black canvas.
 const browser=page.context().browser(),fallback=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 try{const p=await fallback.newPage();p.on('pageerror',e=>errors.push(e.message));await p.route('**/client-maps/*.webp',r=>r.abort());await p.goto(base+'mobile.html');await ready(p);await p.getByRole('button',{name:'开始游戏',exact:true}).tap();await p.locator('[data-action="start"]').tap();await p.waitForFunction(()=>document.querySelector('#battlefield')?.dataset.mapSource==='fallback');await p.waitForTimeout(600);assert(await p.locator('.battle-hud').isVisible(),'map failure keeps gameplay');}finally{await fallback.close();}
 // Bootstrap recovery executes before the scaled phone UI has been installed.
 const failed=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 try{const p=await failed.newPage();await p.route('**/original-app.mjs',r=>r.abort());await p.goto(base+'mobile.html');const alert=p.getByRole('alert');await alert.waitFor();for(const size of [{width:393,height:852},{width:1440,height:900}]){await p.setViewportSize(size);const box=await alert.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=size.width&&box.y+box.height<=size.height,'bootstrap retry within viewport');assert(await p.getByRole('button',{name:'刷新重试',exact:true}).isVisible(),'visible module retry');}await p.screenshot({path:qa+'module-recovery-desktop.png'});}finally{await failed.close();}
 assert(!errors.length,'runtime errors: '+errors.join(';'));
 return {result:'PASS',played,mapRequests:requests.length,lazyLoad:true,mapFailureFallback:true,visibleBootstrapRetry:true,legacyApisDisabled:true,errors};
}
