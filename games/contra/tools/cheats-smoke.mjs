// Covers the two independent classic-game assist menus via playwright-cli.
export async function cheatsSmoke(page){
 page.setDefaultTimeout(18000);const origin=new URL(page.url()).origin,results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));const assert=(v,m)=>{if(!v)throw Error(m);};
 const wait=(p,s)=>p.waitForFunction(s=>document.querySelector('canvas').dataset.status===s,s);
 const key=(id,platform)=>`${id==='tank'?'fish-tank':'fish-contra'}:${platform}:v1`;
 const envelope=(p,id,platform)=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key(id,platform));
 async function fixture(p,id,platform,kind='normal'){
  const base=origin+`/games/${id}/`;await p.goto(base+'assets/icon.svg');await p.evaluate(async({base,id,platform,kind,key})=>{
   const e=await import(base+'engine.mjs'),g=e.newGame({platform,level:kind==='jump'?2:1,seed:318});
   if(id==='contra'){
    g.spawned=[];g.nextRunner=g.nextCapsule=1e9;
    if(kind==='death'){g.lives=1;g.player.invulnerableUntil=0;e.setCheat(g,'infiniteLives',true);g.enemyBullets=[{x:g.player.x,y:g.player.y-14,vx:0,vy:0,gravity:0,ttl:4200}];}
    else g.player.invulnerableUntil=1e9;
    if(kind==='boss'){g.player.x=g.stage.width-160;g.player.y=192;g.cameraX=g.stage.width-256;e.start(g);e.step(g,1000/60);g.boss.hp=1;e.pause(g);e.setCheat(g,'infiniteLives',true);e.setCheat(g,'infiniteLives',false);}
   }
   localStorage.setItem(key,JSON.stringify({game:e.serialize(g),sound:false,best:1234,records:{3:true}}));
  },{base,id,platform,kind,key:key(id,platform)});
  await p.goto(base+platform+'.html');await p.waitForFunction(()=>document.querySelector('#load-status').textContent==='本地资源就绪');
 }
 await page.setViewportSize({width:1366,height:900});await fixture(page,'tank','pc');await page.locator('#overlay-content [data-action="start"]').click();await page.waitForFunction(()=>Number(document.querySelector('canvas').dataset.playerX)>0);
 await page.keyboard.press('c');assert(await page.locator('#cheats-dialog').isVisible(),'C opens cheat menu');assert(await page.locator('[data-cheat]').count()===3,'Tank options');await wait(page,'paused');
 const clock=await page.locator('canvas').getAttribute('data-clock');await page.waitForTimeout(200);assert(await page.locator('canvas').getAttribute('data-clock')===clock,'Menu pauses battle');
 for(const name of ['infiniteLives','rapidFire','autoPowerUps'])await page.locator(`[data-cheat="${name}"]`).check();
 const before=await page.locator('canvas').evaluate(c=>c.toDataURL());await page.locator('[data-action="spawn-powerup"]').click();await page.waitForTimeout(60);assert(await page.locator('canvas').evaluate(c=>c.toDataURL())!==before,'Random item actually drawn');assert(await page.locator('#toast').textContent().then(t=>t.includes('已生成')),'Spawn feedback');
 await page.locator('#cheats-dialog [data-close]').last().click();await wait(page,'running');assert(await page.locator('#lives').textContent()==='∞','Infinite HUD');
 await page.keyboard.down('j');await page.waitForTimeout(500);await page.keyboard.up('j');assert(Number(await page.locator('canvas').getAttribute('data-projectiles'))>=3,'Actual rapid-fire burst');await page.keyboard.press('p');
 let saved=await envelope(page,'tank','pc');assert(JSON.parse(saved.game).cheats.rapidFire&&JSON.parse(saved.game).assisted,'Tank flags saved');assert(saved.best===1234&&JSON.stringify(saved.records)==='{"3":true}','Tank classic scores untouched');
 await page.reload();await wait(page,'ready');await page.locator('[data-action="cheats"]').click();assert(await page.locator('[data-cheat="rapidFire"]').isChecked(),'Flags survive Tank checkpoint');await page.locator('[data-action="reset-cheats"]').click();await page.locator('#cheats-dialog [data-close]').last().click();assert(await page.locator('canvas').getAttribute('data-assisted')==='true','Assisted round remains tagged');await page.locator('[data-action="restart"]').click();assert(await page.locator('canvas').getAttribute('data-assisted')==='false','Restart after all off restores classic');
 await page.locator('#fullscreen-button').click();await page.locator('[data-action="cheats"]').click();assert(await page.locator('#cheats-dialog').isVisible(),'Cheat menu in fullscreen');await page.locator('#cheats-dialog [data-close]').last().click();await page.locator('#fullscreen-button').click();results.push({tankMenu:true,randomItem:true,rapidFire:true,infiniteHUD:true,checkpoint:true,classicIsolation:true,fullscreen:true});

 await fixture(page,'contra','pc','jump');await page.locator('#overlay-content [data-action="start"]').click();await page.locator('[data-action="cheats"]').click();assert(await page.locator('[data-cheat]').count()===4,'Contra options');for(const name of ['infiniteLives','airJump','slowBullets','invincible'])await page.locator(`[data-cheat="${name}"]`).check();await page.locator('#cheats-dialog [data-close]').last().click();await wait(page,'running');
 await page.keyboard.down('k');await page.waitForTimeout(90);await page.keyboard.up('k');await page.waitForTimeout(80);await page.keyboard.down('k');await page.waitForTimeout(40);await page.keyboard.up('k');await page.keyboard.press('p');saved=await envelope(page,'contra','pc');const jumped=JSON.parse(saved.game);assert(jumped.player.vy<-280,'Actual second airborne jump');assert(Object.values(jumped.cheats).every(Boolean),'Contra flags saved');await page.reload();await wait(page,'paused');assert((await envelope(page,'contra','pc')).game===saved.game,'Contra exact assist save');
 await fixture(page,'contra','pc','death');await page.locator('#overlay-content [data-action="start"]').click();await page.waitForTimeout(1250);await page.keyboard.press('p');const reborn=JSON.parse((await envelope(page,'contra','pc')).game);assert(reborn.lives===1&&!reborn.player.deadUntil&&reborn.status==='paused','Real enemy bullet and unlimited respawn');assert(await page.locator('#lives').textContent()==='∞','Contra infinite HUD');
 await fixture(page,'contra','pc','boss');await page.locator('#overlay-content [data-action="start"]').click();await page.keyboard.down('j');await wait(page,'won');await page.keyboard.up('j');saved=await envelope(page,'contra','pc');assert(saved.best===1234&&JSON.stringify(saved.records)==='{"3":true}','Classic completion unaffected by assisted win');assert(saved.assistedRecords[1]&&saved.assistedBest>=5000,'Assisted win recorded separately');await page.locator('[data-action="next"]').click();assert(JSON.parse((await envelope(page,'contra','pc')).game).assisted,'Next stage retains assisted attribution even after all off');results.push({contraAirJump:true,infiniteRespawn:true,saveResume:true,assistedWin:true,nextStage:true,classicIsolation:true});

 const context=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 try{const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));for(const id of ['tank','contra']){
   await fixture(phone,id,'mobile');await phone.locator('[data-action="cheats"]').tap();await phone.locator('[data-cheat="infiniteLives"]').check();if(id==='contra')await phone.locator('[data-cheat="airJump"]').check();await phone.locator('#cheats-dialog [data-close]').last().tap();
   const record=await envelope(phone,id,'mobile');assert(JSON.parse(record.game).cheats.infiniteLives,'Mobile cheat setting persisted');
   for(const [width,height]of[[320,658],[390,844],[430,932],[844,390]]){await phone.setViewportSize({width,height});assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' horizontal overflow');const button=await phone.locator('[data-action="cheats"]').boundingBox();assert(button.x>=0&&button.x+button.width<=width,'Cheat button onscreen');await phone.locator('[data-action="cheats"]').tap();const modal=await phone.locator('#cheats-dialog').boundingBox();assert(modal.y>=0&&modal.y+modal.height<=height,'Cheat modal fits viewport');await phone.locator('#cheats-dialog [data-close]').last().tap();}
   await phone.setViewportSize({width:390,height:844});await phone.reload();await phone.locator('[data-action="cheats"]').tap();assert(await phone.locator('[data-cheat="infiniteLives"]').isChecked(),'Mobile options survive refresh');await phone.locator('#cheats-dialog [data-close]').last().tap();
  }results.push({mobileTouchMenus:true,mobilePersistence:true,smallAndLandscapeLayouts:true});
 }finally{await context.close();}
 assert(errors.length===0,errors.join('; '));return{result:'PASS',results,pageErrors:errors};
}
