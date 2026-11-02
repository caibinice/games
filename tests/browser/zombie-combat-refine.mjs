async(page,phase='refine')=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(phase==='refine'){
  const proof=await page.context().newPage();await proof.goto('chrome://version');const flags=await proof.locator('#command_line').textContent();await proof.close();if(!flags.includes('--mute-audio'))throw Error('Muted browser required');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{ensureNative}=await import('./native-progression.mjs'),{DROP_GEMS}=await import('./native-gems.mjs'),{defaultProfile,SAVE_KEY}=await import('./profile.mjs');const p=createMeta(8);p.entered=true;p.inventory={};p.locked={};for(const [q,part,count] of [[7,2,2],[5,1,1]])p.inventory['gem-native:'+DROP_GEMS.find(g=>g.quality===q&&g.part===part).id]=count;ensureNative(p).goods[1001]=60;localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),sound:false,music:false}));});
  await page.reload();await page.getByRole('button',{name:'角色',exact:true}).click();
  await page.getByRole('button',{name:'宝石洗练',exact:true}).click();await page.locator('.refine-gem-list').waitFor();
  if(await page.locator('.refine-gem-list article').count()!==2)throw Error('Refine inventory list');
  await page.locator('.refine-gem-list [data-gem-refine]').first().click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1'))),before=await read(),total=Object.values(before.inventory).reduce((a,b)=>a+b,0);
  for(let n=0;n<3;n++){
   await page.locator('[data-refine-start]').click();const p=await read();if(p.native.goods[1001]!==40-n*20||p.native.gemRefine)throw Error('Direct native roll transaction');
   if(Object.values(p.inventory).reduce((a,b)=>a+b,0)!==total)throw Error('Stack duplication');
   if(await page.locator('[data-refine-finish]').count())throw Error('Unexpected result confirmation');
  }
  const empty=JSON.stringify(await read());await page.locator('[data-refine-start]').click();if(JSON.stringify(await read())!==empty)throw Error('Insufficient reagent changed inventory');
  await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-combat-refine-20261030/refine-mobile.png'});
  await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();if((await read()).native.goods[1001]!==0)throw Error('Refine save lost');
  if(errors.length)throw Error(errors.join(';'));
  return {muted:true,visibleEntry:true,rolls:3,reagentSpent:60,stackPreserved:true,noSecondChoice:true,reload:true,pageErrors:errors};
 }
 if(phase==='combat'){
  if(!await page.locator('#battlefield').count()){await page.getByRole('button',{name:'战斗',exact:true}).click();await page.getByRole('button',{name:/^开始游戏/}).click();await page.locator('[data-choice]').first().waitFor({timeout:10000});}
  const deadline=Date.now()+12000;let choicesAccepted=0;
  while(Date.now()<deadline){if(await page.locator('[data-choice]').count()){await page.locator('[data-choice]').first().click();choicesAccepted++;}if(await page.locator('#battlefield').evaluate(c=>Number(c.dataset.feedbackCount)>0))break;await page.waitForTimeout(100);}
  if(!await page.locator('#battlefield').evaluate(c=>Number(c.dataset.feedbackCount)>0))throw Error('No hit feedback after active combat');
  await page.waitForFunction(()=>Number(document.querySelector('#battlefield')?.dataset.nativeFxLoaded)===Number(document.querySelector('#battlefield')?.dataset.nativeFxTotal)&&Number(document.querySelector('#battlefield')?.dataset.nativeFxTotal)>=24,null,{timeout:8000});
  await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-combat-refine-20261030/combat-mobile.png'});
  const state=await page.locator('#battlefield').evaluate(c=>({...c.dataset}));if(errors.length)throw Error(errors.join(';'));
  await page.reload();return {muted:true,liveBattle:true,choicesAccepted,feedbackCount:state.feedbackCount,sourceTextures:state.nativeFxLoaded,pageErrors:errors};
 }
 if(phase==='fx'){
  const report=await page.evaluate(async()=>{const {preloadNativeFx,drawNativeEffect}=await import('./native-fx.mjs');await preloadNativeFx();const canvas=document.createElement('canvas');canvas.width=900;canvas.height=700;canvas.id='fx-qa';Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',zIndex:9999,background:'#183344'});document.body.append(canvas);const c=canvas.getContext('2d');c.fillStyle='#183344';c.fillRect(0,0,900,700);const types=['hit-impact','frost-launch','magnet-strike','magnet-splash','magnet-matrix','grenade','airdrop','fuel','iceblast','vortex','wind','electron','electric','guided','laser'];let drawn=0;for(let i=0;i<types.length;i++){const x=90+i%5*180,y=100+Math.floor(i/5)*220,f={type:types[i],x,y,life:.25,duration:1,r:42,element:3,color:'#ffc05c',tx:x+60,ty:y-60,path:[{x:x-50,y:y+25},{x:x+50,y:y-25}],points:[{x:x-35,y},{x:x+35,y}]};c.save();if(drawNativeEffect(c,f,v=>v,2))drawn++;c.restore();c.fillStyle='white';c.font='15px sans-serif';c.fillText(types[i],x-65,y+75);}return {drawn,total:types.length};});
  if(report.drawn!==report.total)throw Error('Missing skill effect renderer '+JSON.stringify(report));await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-combat-refine-20261030/fx-grid.png'});await page.evaluate(()=>document.querySelector('#fx-qa').remove());return report;
 }
 throw Error('Unknown phase');
}
