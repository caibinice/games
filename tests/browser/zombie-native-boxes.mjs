async(page,phase='choice')=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')));
 const items=async()=>{if(!await page.locator('[data-activity-item-use]').count()){await page.locator('.op-items').click();await page.locator('[data-box-catalog="choice"]').waitFor();}};
 const use=async id=>{await page.locator(`[data-activity-item-use="${id}"]`).click();};
 const back=async()=>{await page.getByRole('button',{name:'返回活动道具',exact:true}).click();};
 if(phase==='choice'){
  const check=await page.context().newPage();await check.goto('chrome://version');const flags=await check.locator('#command_line').textContent();await check.close();if(!flags.includes('--mute-audio'))throw Error('Muted browser required');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{ensureNative}=await import('./native-progression.mjs'),{SAVE_KEY,defaultProfile}=await import('./profile.mjs');const p=createMeta(20);p.entered=true;p.seed=123;ensureNative(p).goods={200201:3,200701:1,201425:1};localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),sound:false,music:false}));});
  await page.reload();await page.locator('[data-operation="newyear"]').click();await page.locator('.op-items').waitFor();await items();
  const before=JSON.stringify(await read());await use(200201);await page.locator('.native-choice-box').waitFor();
  if(await page.locator('[data-choice-quantity]').count()!==3)throw Error('Source candidate rows');
  await page.locator('[data-choice-quantity="0"]').fill('1');await page.locator('[data-choice-quantity="2"]').fill('2');
  if(!await page.locator('.native-choice-tip').textContent().then(s=>s.includes('3/3')))throw Error('Multi-allocation total');
  await page.waitForFunction(()=>[...document.querySelectorAll('.native-choice-box img')].every(i=>i.complete&&i.naturalWidth),null,{timeout:10000});
  await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-select-box-20261030/choice-mobile.png'});
  await page.getByRole('button',{name:'关闭',exact:true}).click();if(JSON.stringify(await read())!==before)throw Error('Cancel spent or mutated save');
  await items();await use(200201);await page.locator('[data-choice-quantity="0"]').fill('1');await page.locator('[data-choice-quantity="2"]').fill('2');await page.locator('[data-choice-confirm]').click();
  const p=await read();if(p.native.goods[200201]!==0||p.native.goods[82001]!==1||p.native.goods[82004]!==2)throw Error('Wrong allocated rewards');
  await back();await use(82001);if((await read()).native.skins[82001]!==1)throw Error('Core form activation chain');
  if(errors.length)throw Error(errors.join(';'));return {muted:true,sourceRows:3,cancelNoCost:true,allocated:{82001:1,82004:2},coreActivated:true,pageErrors:errors};
 }
 if(phase==='mercenary'){
  await items();await use(200701);if(await page.locator('[data-choice-quantity]').count()!==5)throw Error('Mercenary source choices');await page.locator('[data-choice-quantity="2"]').fill('1');await page.locator('[data-choice-confirm]').click();
  let p=await read();if(p.native.goods[101108]!==50||p.native.goods[200701]!==0)throw Error('Expected 50 source mercenary pieces');await back();await use(101108);p=await read();if(!p.native.mercenaries[108]||p.native.goods[101108]!==0)throw Error('Mercenary recruitment chain');if(errors.length)throw Error(errors.join(';'));return {pieces:50,recruited:108,quality:p.native.mercenaries[108].quality,pageErrors:errors};
 }
 if(phase==='nested'){
  await items();await use(201425);await page.locator('[data-choice-quantity="0"]').fill('1');await page.locator('[data-choice-confirm]').click();if((await read()).native.goods[200304]!==1)throw Error('Nested box missing');await back();await use(200304);
  const p=await read(),id=Object.keys(p.native.goods).map(Number).find(id=>id>=81000&&id<81900&&p.native.goods[id]>0);if(!id||p.native.goods[200304]!==0)throw Error('Nested random reward missing');await page.getByRole('button',{name:'关闭',exact:true}).click();await items();await use(id);if(!(await read()).native.skins[id])throw Error('Outfit activation chain');
  await page.reload();const saved=await read();if(saved.native.skins[82001]!==1||!saved.native.mercenaries[108]||!saved.native.skins[id])throw Error('Box growth save lost');if(errors.length)throw Error(errors.join(';'));return {nestedBox:200304,outfit:id,activated:true,reload:true,pageErrors:errors};
 }
 if(phase==='catalog'){
  await page.locator('[data-operation="newyear"]').click();await page.locator('.op-items').waitFor();await items();await page.locator('[data-box-catalog="choice"]').click();if(await page.locator('.native-box-catalog article').count()!==19)throw Error('Choice supply catalog');
  await page.locator('[data-box-supply="201827"]').click();if((await read()).native.goods[201827]!==10)throw Error('Free supply missing');await page.locator('[data-activity-item-use="201827"]').click();
  const sizes=[{width:390,height:844},{width:844,height:390},{width:1366,height:768}];for(const size of sizes){await page.setViewportSize(size);await page.waitForFunction(()=>{const r=document.querySelector('[data-choice-confirm]')?.getBoundingClientRect(),l=document.querySelector('.native-choice-list')?.getBoundingClientRect();return r&&l&&r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&l.y>=0;},null,{timeout:3000});}
  await page.getByRole('button',{name:'关闭',exact:true}).click();await items();await page.locator('[data-box-catalog="choice"]').click();await page.locator('[data-box-catalog="random"]').click();if(await page.locator('.native-box-catalog article').count()!==162)throw Error('Random source catalog');
  await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-select-box-20261030/random-catalog.png'});if(errors.length)throw Error(errors.join(';'));return {choiceBoxes:19,randomBoxes:162,freeSupply:10,sizes,pageErrors:errors};
 }
 throw Error('Unknown phase');
}
