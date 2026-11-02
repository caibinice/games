async (page) => {
 const base='http://127.0.0.1:55437/games/zombie/',out='E:/Documents/AI/codex/tmp/zombie-apk-20261024/reports/',browser=page.context().browser().browserType().name(),errors=[],sounds=[];
 const assert=(v,m)=>{if(!v)throw Error(m);};page.on('pageerror',e=>errors.push(e.message));

 await page.setViewportSize({width:393,height:852});
 await page.addInitScript(()=>{Array.prototype.at=undefined;String.prototype.at=undefined;String.prototype.replaceAll=undefined;CanvasRenderingContext2D.prototype.roundRect=undefined;window.__qaMedia=[];const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){const row={src:this.src,result:'pending',gesture:navigator.userActivation?.isActive};window.__qaMedia.push(row);const result=originalPlay.apply(this,args);result?.then(()=>row.result='played',e=>row.result=e.name);return result;};});
 await page.goto(base+'mobile.html');await page.waitForFunction(()=>!document.querySelector('#page>[role="status"]'));
 await page.evaluate(()=>{localStorage.removeItem('fish-zombie-v1');localStorage.removeItem('fish-zombie-meta-v1');localStorage.setItem('native-interface-peer','retained');});
 let release,blocked;const gate=new Promise(r=>release=r),reached=new Promise(r=>blocked=r);
 const hold=async route=>{blocked();await gate;await route.continue();};await page.route('**/client-gem-data.mjs',hold);
 await page.reload({waitUntil:'domcontentloaded'});await reached;
 await page.waitForFunction(()=>{const b=document.querySelector('#client-entry [role="progressbar"]'),n=Number(b?.getAttribute('aria-valuenow'));return n>0&&n<95;});
 const intermediate=Number(await page.getByRole('progressbar').getAttribute('aria-valuenow'));
 assert(!await page.getByRole('button',{name:'开始游戏',exact:true}).isVisible(),'start is hidden until actual resources complete');
 await page.waitForFunction(()=>document.querySelector('.login-actors')?.dataset.source?.includes('APK'));await page.screenshot({path:out+'native-loading-'+browser+'.png'});release();
 await page.getByRole('button',{name:'开始游戏',exact:true}).waitFor();await page.unroute('**/client-gem-data.mjs',hold);
 await page.waitForFunction(()=>document.querySelector('.login-actors')?.dataset.source?.includes('APK'));
 const actors=page.locator('.login-actors'),first=await actors.screenshot();await page.waitForTimeout(900);const second=await actors.screenshot();
 assert(!first.equals(second),'native idle skeleton animates, not a flattened screenshot');
 assert(await page.getByRole('progressbar').count()===0,'progress bar is not a decorative start button');
 assert(await page.getByRole('button',{name:'select to enable accessibility for this content'}).count()===0,'decorative canvas adds no extra accessibility prompt');
 await page.screenshot({path:out+'native-login-'+browser+'.png'});
 await page.getByRole('button',{name:'开始游戏',exact:true}).tap();await page.locator('[data-tab="character"]').tap();
 assert(await page.locator('[data-gem^="gem-native:"]').count()>20,'new inventory uses original gem IDs');
 await page.locator('[data-gem="gem-native:900020107"]').tap();assert((await page.locator('#dialog').innerText()).includes('技能冷却-7%'),'native gem description is not a generic six-affix approximation');
 await page.locator('[data-equip-gem="gem-native:900020107"][data-index="0"]').tap();
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')).gear.helmet.gems[0])==='gem-native:900020107','native gem equipped and saved');
 await page.locator('.dialog-close').tap();await page.locator('[data-action="menu"]').first().tap();await page.locator('[data-action="gem-codex"]').tap();
 assert((await page.locator('#dialog').innerText()).includes('2023'),'complete source catalog count');
 await page.locator('[data-gem-codex-part="helmet"]').tap();const row=page.locator('[data-native-gem="900010101"]');
 assert((await row.innerText()).includes('攻击+10'),'source flat attack units retained');await row.locator('[data-native-gem-grant]').tap();
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')).inventory['gem-native:900010101'])>0,'free original gem enters inventory');
 await page.screenshot({path:out+'native-gems-'+browser+'.png'});await page.locator('#dialog').evaluate(e=>e.scrollTop=e.scrollHeight);assert(await page.locator('.dialog-close').isVisible(),'gem codex close stays visible after scrolling');await page.locator('.dialog-close').tap();
 await page.locator('[data-tab="shop"]').tap();await page.locator('[data-draw="normal"][data-count="10"]').tap();assert(await page.locator('.loot-card').count()===10,'free draws render native items');await page.locator('.dialog-close').tap();
 for(const tab of ['character','core','battle']){await page.locator('[data-tab="'+tab+'"]').tap();assert(await page.locator('.screen').isVisible(),'main page '+tab);}
 await page.waitForFunction(()=>['click.mp3','close.mp3','page.mp3','reward.mp3'].every(n=>window.__qaMedia.some(r=>r.result==='played'&&r.src.endsWith('/client-interface/'+n))));sounds.push(...await page.evaluate(()=>window.__qaMedia.filter(r=>r.result==='played'&&r.src.includes('/client-interface/')).map(r=>r.src.split('/').pop())));
 // Essential resource failure is visible and retryable even before the game modules load.
 const fail=route=>route.fulfill({status:503,body:'fixture'});await page.route('**/client-gem-data.mjs',fail);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'刷新重试',exact:true}).waitFor();
 const box=await page.locator('.module-entry-error').boundingBox();assert(box.x>=0&&box.x+box.width<=394&&box.y>=0&&box.y+box.height<=853,'loading failure retry visible on phone');
 await page.unroute('**/client-gem-data.mjs',fail);await page.getByRole('button',{name:'刷新重试',exact:true}).tap();await page.locator('[data-tab="battle"]').waitFor();
 assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')).gear.helmet.gems[0])==='gem-native:900020107','retry retains equipped original gem');
 const corrupt=route=>route.fulfill({status:200,body:'fixture'});await page.route('**/client-gem-data.mjs',corrupt);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'刷新重试',exact:true}).waitFor();await page.unroute('**/client-gem-data.mjs',corrupt);await page.getByRole('button',{name:'刷新重试',exact:true}).tap();await page.locator('[data-tab="battle"]').waitFor();
 assert(await page.evaluate(()=>localStorage.getItem('native-interface-peer'))==='retained','other game storage preserved');

 assert(['click.mp3','close.mp3','page.mp3','reward.mp3'].every(n=>sounds.includes(n)),'native UI sounds requested after actual taps: '+sounds);
 assert(errors.length===0,'unhandled runtime errors: '+errors.join(';'));
 return {result:'PASS',browser,realProgressIntermediate:intermediate,nativeSpineAnimation:true,nativeGemCatalog:2023,nativeGemEquip:true,freeDraw:true,visibleRetry:true,corruptResourceRetry:true,nativeUiSounds:[...new Set(sounds)],errors};
}
