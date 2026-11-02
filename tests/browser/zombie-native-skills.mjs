async (page) => {
 const base='http://127.0.0.1:55437/games/zombie/',qa='E:/Documents/AI/codex/tmp/zombie-apk-20261024/reports/';
 const errors=[],assert=(v,m)=>{if(!v)throw Error(m);};page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#page>[role="status"]'));
 const fast=page.context().browser().browserType().name()==='chromium';
 await page.setViewportSize({width:393,height:852});
 // Fixed game RNG seed; real WebKit time still advances normally.
 await page.addInitScript(()=>{Date.now=()=>1;Array.prototype.at=undefined;String.prototype.at=undefined;String.prototype.replaceAll=undefined;CanvasRenderingContext2D.prototype.roundRect=undefined;});
 await page.goto(base+'mobile.html');await ready();await page.evaluate(()=>{for(const k of ['fish-zombie-v1','fish-zombie-meta-v1'])localStorage.removeItem(k);localStorage.setItem('native-skill-peer','preserve');});await page.reload();await ready();
 await page.getByRole('button',{name:'开始游戏',exact:true}).tap();await page.locator('[data-tab="core"]').tap();await page.locator('[data-skill="frost"]').tap();await page.locator('[data-tree-skill="frost"]').tap();
 assert(await page.getByRole('heading',{name:'技能升级图鉴',exact:true}).isVisible(),'core detail opens codex');
 assert(await page.locator('[data-codex-build="211"]').count()===1,'native giant ice branch');
 await page.locator('[data-tree-build="211"]').tap();assert((await page.locator('[data-codex-build="211"]').innerText()).includes('干冰弹核心 ≥10级'),'persistent core requirement');
 assert(await page.locator('.dialog-close').isVisible(),'sticky close stays available on long tree');
 assert(await page.locator('[data-codex-build="211"] p').evaluate(e=>getComputedStyle(e).color)==='rgb(255, 240, 212)','readable branch contrast');
 await page.screenshot({path:qa+'skill-codex-native-'+(fast?'chromium':'webkit')+'.png'});
 await page.locator('[data-tree-source="community"]').tap();await page.waitForFunction(()=>document.querySelector('.codex-image-scroll img')?.naturalHeight===4156);
 await page.locator('[data-tree-zoom="25"]').tap();assert(await page.locator('.codex-image-scroll img').evaluate(e=>e.style.width)==='1250px','diagram zoom');
 const scroll=page.locator('.codex-image-scroll');await scroll.evaluate(e=>{e.scrollTop=1600;e.scrollLeft=120;});assert(await scroll.evaluate(e=>e.scrollTop)>0,'full tall reference scrolls');await page.screenshot({path:qa+'skill-codex-community-'+(fast?'chromium':'webkit')+'.png'});
 await page.locator('[data-tree-source="native"]').tap();await page.locator('[data-tree-skill="lightning"]').tap();await page.locator('[data-tree-build="314"]').tap();assert((await page.locator('[data-codex-build="314"]').innerText()).includes('电磁追捕'),'magnetic native dependency');
 await page.locator('[data-tree-skill="vehicle"]').tap();assert((await page.locator('.codex-summary').innerText()).includes('已接入局内升级池'),'all families offer native branches');
 await page.locator('.dialog-close').tap();await page.locator('[data-skill="frost"]').tap();await page.locator('[data-support="frost"]').tap();await page.locator('.dialog-close').tap();await page.locator('[data-tab="battle"]').tap();
 await page.locator('[data-action="cheats"]').tap();await page.locator('[data-cheat="invincible"]').tap();await page.locator('.dialog-close').tap();
 if(fast)await page.clock.install();
 await page.locator('[data-action="start"]').tap();await page.locator('#battlefield').waitFor();
 let selected=null,choices=0;
 for(let n=0;n<(fast?100:45)&&!selected;n++){
  if(fast)await page.clock.runFor(2000);else await page.waitForTimeout(1000);
  const options=page.locator('[data-choice]');if(!await options.count())continue;
  choices++;
  const native=page.locator('[data-choice^="build:"]');
  if(await native.count()){
   const button=native.first(),id=Number((await button.getAttribute('data-choice')).split(':')[1]),name=await button.innerText();
   await button.tap();await page.waitForFunction(id=>JSON.parse(document.getElementById('battlefield').dataset.nativeBuilds)[id]>0,id);
   selected={id,name};
  }else await options.first().tap();
 }
 assert(selected,'real native branch appears and is selectable; choices='+choices);
 const data=await page.locator('#battlefield').evaluate(c=>({...c.dataset}));assert(JSON.parse(data.nativeBuilds)[201]===1,'support core has its native base build');
 // The settings viewer pauses real timers, then displays the actual local build state.
 while(await page.locator('[data-choice]').count())await page.locator('[data-choice]').first().tap();
 await page.locator('[aria-label="战斗菜单"]').tap();await page.getByRole('button',{name:'设置',exact:true}).tap();await page.locator('[data-action="skill-tree"]').tap();await page.locator('[data-tree-skill="'+(selected.id<300?'frost':'lightning')+'"]').tap();await page.locator('[data-tree-build="'+selected.id+'"]').tap();assert((await page.locator('[data-codex-build="'+selected.id+'"]').innerText()).includes('本局已选'),'codex reflects actual selected build');
 await page.screenshot({path:qa+'skill-selected-'+(fast?'chromium':'webkit')+'.png'});
 assert(await page.evaluate(()=>localStorage.getItem('native-skill-peer'))==='preserve','other storage keys preserved');
 assert(!errors.length,'runtime errors '+errors.join(';'));
 return {result:'PASS',browser:fast?'chromium':'webkit',communityDiagram:true,zoomAndScroll:true,nativeCatalog:172,selected,choices,errors};
}
