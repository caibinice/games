async(page)=>{
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(page.url()))throw Error('Local QA only');
 const check=await page.context().newPage();await check.goto('chrome://version');const flags=await check.locator('#command_line').textContent();await check.close();if(!flags.includes('--mute-audio'))throw Error('Muted browser required');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')));
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{defaultProfile,SAVE_KEY}=await import('./profile.mjs');const p=createMeta(20);p.entered=true;localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),sound:false,music:false}));});
 await page.reload();await page.locator('[data-operation="bihai"]').click();await page.locator('.bihai-mode').waitFor({timeout:10000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.bihai-mode img')].every(i=>i.complete&&i.naturalWidth));
 if(await page.locator('[data-bihai-cell]').count()!==12||await page.locator('.bihai-grand img').count()!==3)throw Error('Native shell/float layers missing');
 if(await page.locator('.op-wheel-hub,.op-tabs').count())throw Error('Generic wheel/footer leaked');
 await page.locator('[data-op-draw="1"]').click();await page.waitForFunction(()=>!!document.querySelector('.bihai-active'));await page.locator('#overlay:not([hidden]) .op-reward-cards').waitFor({timeout:7000});
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 if((await read()).native.operations.bihai.draws!==1)throw Error('Single draw ledger');
 await page.locator('[data-bihai-skip]').click();
 for(let i=0;i<2;i++){await page.locator('[data-op-draw="10"]').click();await page.locator('#overlay:not([hidden]) .op-reward-cards').waitFor({timeout:3000});await page.getByRole('button',{name:'关闭',exact:true}).click();}
 const before=await read(),supplement=before.native.goods[100002]||0;
 await page.locator('[data-bihai-milestone="20"]').click();await page.locator('#overlay:not([hidden]) .op-reward-cards').waitFor();
 if((await read()).native.goods[100002]-supplement!==5)throw Error('Cumulative inventory grant');
 await page.getByRole('button',{name:'关闭',exact:true}).click();if(!await page.locator('[data-bihai-milestone="20"]').isDisabled())throw Error('Duplicate claim not disabled');
 await page.locator('[data-op-exchange]').click();if(await page.locator('[data-op-exchange-buy]').count()!==6)throw Error('Independent exchange offers');
 const offer=await page.locator('[data-op-exchange-buy]').first().getAttribute('data-op-exchange-buy');
 for(let i=0;i<2;i++)await page.locator(`[data-op-exchange-buy="${offer}"]`).click();
 const purchased=await read();if(purchased.native.operations.bihai.shopCounts[offer]!==2)throw Error('Purchase count not saved');
 if(purchased.gold!==before.gold||purchased.diamonds!==before.diamonds)throw Error('Free exchange charged currency');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-bihai-20261030/web/bihai-exchange.png'});await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.reload();const saved=await read();if(saved.native.operations.bihai.draws!==21||saved.native.operations.bihai.shopCounts[offer]!==2||!saved.native.operations.bihai.skipAnimation||!saved.native.operations.bihai.cumulativeClaimed.includes(20))throw Error('Reload lost activity state');
 await page.locator('[data-operation="bihai"]').click();
 const sizes=[{width:390,height:844},{width:844,height:390},{width:1366,height:768}];
 for(const size of sizes){await page.setViewportSize(size);await page.waitForFunction(()=>['.op-buttons','.bihai-exchange','.op-back'].every(selector=>{const b=document.querySelector(selector)?.getBoundingClientRect();return b&&b.x>=-.5&&b.y>=-.5&&b.right<=innerWidth+.5&&b.bottom<=innerHeight+.5;}),null,{timeout:3000});for(const selector of ['.op-buttons','.bihai-exchange','.op-back']){const b=await page.locator(selector).boundingBox();if(!b||b.x<-.5||b.y<-.5||b.x+b.width>size.width+.5||b.y+b.height>size.height+.5)throw Error('Clipped '+selector+' at '+JSON.stringify(size));}}
 if(errors.length)throw Error(errors.join(';'));
 return {muted:true,draws:21,shellLayers:3,slots:12,milestoneGranted:5,exchanges:2,reload:true,sizes,pageErrors:errors};
}
