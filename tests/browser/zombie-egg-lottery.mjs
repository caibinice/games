async(page)=>{
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(page.url()))throw Error('Local QA only');
 const proof=await page.context().newPage();await proof.goto('chrome://version');const flags=await proof.locator('#command_line').textContent();await proof.close();if(!flags.includes('--mute-audio'))throw Error('Muted launch required');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{defaultProfile,SAVE_KEY}=await import('./profile.mjs');const p=createMeta(20);p.entered=true;localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),music:false,sound:false}));});
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('[data-operation="egg"]').first().click();await page.locator('.egg-scroll').waitFor();
 if(await page.locator('[data-op-egg-preview]').count()!==28)throw Error('four choices per level');if(!await page.locator('[data-op-egg="claim"]').isDisabled())throw Error('fresh claim must be disabled');
 const visible=await page.locator('.egg-scroll').evaluate(list=>{const r=list.getBoundingClientRect(),c=list.querySelector('[data-egg-floor="0"]').getBoundingClientRect();return c.top>=r.top-1&&c.bottom<=r.bottom+1;});if(!visible)throw Error('current floor must be in view');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-goal-20261030/mobile-egg.png'});
 for(let i=0;i<3;i++)await page.locator('[data-op-egg="protect"]').click();await page.locator('[data-op-egg="claim"]').click();if(await page.locator('[data-op-egg-choose]').count()!==4)throw Error('choice dialog');await page.locator('[data-op-egg-choose="2"]').click();await page.locator('.op-reward-cards').waitFor();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')));const claimed=await read();if(claimed.native.operations.egg.round!==1||claimed.native.operations.egg.floor!==0)throw Error('claim must reset round');
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();
 await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('fish-zombie-meta-v1'));p.native.operations.festegg={floor:2,draws:4,claimReady:true,protect:0,round:0};localStorage.setItem('fish-zombie-meta-v1',JSON.stringify(p));});await page.reload();await page.locator('[data-operation="festegg"]').first().click();await page.locator('.egg-scroll').waitFor();
 if(!await page.locator('[data-op-egg="free"]').isDisabled()||!await page.locator('[data-op-egg="protect"]').isDisabled())throw Error('pending round must block more draws');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-goal-20261030/mobile-festival-egg.png'});
 const before=await read();await page.locator('[data-op-egg="claim"]').click();await page.locator('[data-op-egg-choose="2"]').click();await page.locator('.op-reward-cards').waitFor();const after=await read();if((after.native.goods[1001]||0)-(before.native.goods[1001]||0)!==12)throw Error('selected reagent reward');if(after.native.operations.egg.round!==1||after.native.operations.festegg.round!==1)throw Error('independent rounds');
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();if((await read()).native.operations.festegg.round!==1)throw Error('festival persistence');
 if(errors.length)throw Error(errors.join(';'));return {muted:true,mobile:true,choicesPerLevel:4,levels:7,independentRounds:true,selectedReward:12,pageErrors:errors};
}
