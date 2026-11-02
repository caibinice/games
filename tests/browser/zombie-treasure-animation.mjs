async(page)=>{
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(page.url()))throw Error('Local QA only');
 const proof=await page.context().newPage();await proof.goto('chrome://version');const flags=await proof.locator('#command_line').textContent();await proof.close();if(!flags.includes('--mute-audio'))throw Error('Muted browser required');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{defaultProfile,SAVE_KEY}=await import('./profile.mjs');const p=createMeta(20);p.entered=true;localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),sound:false,music:false}));});
 await page.reload();await page.locator('[data-operation="treasure"]').first().click();
 const actor=page.locator('.treasure-player[data-ready="true"]');await actor.waitFor({timeout:10000});
 if(await actor.getAttribute('data-animation')!=='idle2')throw Error('native sleep animation');
 await page.locator('[data-op-draw="1"]').click();await page.waitForFunction(()=>document.querySelector('.treasure-player')?.dataset.animation.startsWith('run'),null,{timeout:5000});
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-native-boards-20261030/web/treasure-running.png'});
 await page.locator('#overlay:not([hidden]) .op-reward-cards').waitFor({timeout:10000});await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('.treasure-player[data-ready="true"]').waitFor({timeout:10000});
 await page.locator('[data-treasure-skip]').click();if(await page.locator('[data-treasure-skip]').getAttribute('aria-pressed')!=='true')throw Error('skip preference');
 const start=Date.now();await page.locator('[data-op-draw="1"]').click();await page.locator('#overlay:not([hidden]) .op-reward-cards').waitFor({timeout:5000});const skippedMs=Date.now()-start;
 if(skippedMs>3000)throw Error('skip still ran full animation');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('[data-treasure-rewards]').click();if(await page.locator('.treasure-progress-row').count()!==20)throw Error('vertical twenty-layer overview');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-native-boards-20261030/web/treasure-overview.png'});
 const scroll=page.locator('.treasure-progress-list');await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);if(!await page.locator('[data-treasure-select="20"]').isVisible())throw Error('last layer inaccessible');
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'返回主页',exact:true}).click();
 if(await page.locator('.treasure-player').count())throw Error('treasure actor leaked after leaving');
 if(errors.length)throw Error(errors.join(';'));
 return {muted:true,sourceSpine:true,sleep:true,run:true,landing:true,skip:true,skippedMs,overviewLayers:20,pageErrors:errors};
}
