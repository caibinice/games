// Dedicated Playwright session only: fixtures touch these two games' saves.
export async function progressionSmoke(page,{screenshotDir}={}){
  const origin=new URL(page.url()).origin,results=[],errors=[];
  const assert=(value,message)=>{if(!value)throw Error(message);};
  page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['lianliankan','paopaotang'])for(const platform of ['pc','mobile']){
    const fruit=id==='lianliankan',base=`${origin}/games/${id}/`,key=`${fruit?'fish-lianliankan':'fish-bubble-town'}:${platform}:v1`;
    const recordKey=fruit?'normal:timed':'solo:normal';
    await page.setViewportSize(platform==='pc'?{width:1366,height:900}:{width:390,height:844});
    await page.goto(base+'assets/icon.svg');
    await page.evaluate(async({base,key,platform,recordKey})=>{
      const {newGame,serialize}=await import(base+'engine.mjs');
      localStorage.setItem(key,JSON.stringify({game:serialize(newGame({platform,seed:802})),sound:false,
        records:{[recordKey]:{unlocked:30,stars:{1:3,12:2}}},best:555,bestScore:555}));
    },{base,key,platform,recordKey});
    await page.goto(base+platform+'.html');
    const sizes=[];
    for(const level of [1,15,30]){
      if(platform==='pc'&&await page.locator('body').evaluate(e=>e.classList.contains('immersive')))await page.locator('#fullscreen-button').click();
      await page.locator('[data-action="levels"]').first().click();
      assert(await page.locator('#level-grid button').count()===30,'Thirty selectable levels');
      await page.locator(`#level-grid [data-level="${level}"]`).click();
      if(platform==='pc'){await page.locator('#fullscreen-button').click();await page.waitForTimeout(100);}
      const state=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).game),key);
      assert(state.level===level&&state.status==='ready','Level selection');
      const bounds=await page.evaluate(fruit=>{
        const rect=document.querySelector(fruit?'#board-frame':'#arena-frame').getBoundingClientRect();
        const cell=fruit?document.querySelector('.tile').getBoundingClientRect().width:0;
        return{width:rect.width,height:rect.height,bottom:rect.bottom,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,cell};
      },fruit);
      assert(!bounds.overflow,`${id}/${platform}: horizontal overflow`);
      if(platform==='pc')assert(bounds.bottom<=900,'Fullscreen map below fold');
      sizes.push({level,cols:state.cols,rows:state.rows,tile:Math.round(bounds.cell)});
    }
    assert(sizes[2].cols*sizes[2].rows>sizes[0].cols*sizes[0].rows,'Map did not grow');
    await page.locator('#overlay-content [data-action="start"]').click();
    if(fruit){
      const move=await page.evaluate(async({base,key})=>{
        const {findMove}=await import(base+'engine.mjs');return findMove(JSON.parse(JSON.parse(localStorage.getItem(key)).game));
      },{base,key});
      await page.locator(`.tile[data-index="${move.a}"]`).click();await page.locator(`.tile[data-index="${move.b}"]`).click();
      await page.waitForTimeout(330);assert(await page.locator('.tile.empty').count()===2,'Large board match');
    }else if(platform==='pc'){
      await page.keyboard.down('d');await page.keyboard.up('d');await page.keyboard.press('Space');
    }else{
      await page.locator('[data-direction="right"]').click();await page.locator('#bomb-button').click();
    }
    if(screenshotDir)await page.screenshot({path:`${screenshotDir}/${id}-${platform}-30.png`,fullPage:true});
    await page.locator('#pause-button').click();
    const before=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).game),key);
    if(platform==='pc')await page.locator('#fullscreen-button').click();
    await page.reload();
    const saved=await page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem(key)).game),key);
    assert(saved.level===30&&saved.status==='paused'&&saved.cols===before.cols&&JSON.stringify(saved.board)===JSON.stringify(before.board),'Large saved round');
    if(platform==='mobile')for(const width of [320,375,430]){
      await page.setViewportSize({width,height:844});
      const metric=await page.evaluate(fruit=>({overflow:document.documentElement.scrollWidth>innerWidth,
        tile:fruit?document.querySelector('.tile').getBoundingClientRect().width:0,
        controls:fruit?0:document.querySelector('.touch-controls').getBoundingClientRect().bottom}),fruit);
      assert(!metric.overflow,'Large mobile map overflow');
      if(fruit)assert(metric.tile>=28,'Large mobile targets too small');else assert(metric.controls<=844,'Large mobile controls below fold');
    }
    // Terminal round has a map action, never a nonexistent level 31.
    await page.goto(base+'assets/icon.svg');
    await page.evaluate(({key,fruit})=>{
      const envelope=JSON.parse(localStorage.getItem(key)),g=JSON.parse(envelope.game);g.status='won';
      if(fruit){g.board.fill(0);g.removed=g.board.length;}else{g.players.filter(p=>p.team===1).forEach(p=>p.status='out');g.bombs=[];g.blasts=[];}
      envelope.game=JSON.stringify(g);localStorage.setItem(key,JSON.stringify(envelope));
    },{key,fruit});
    await page.goto(base+platform+'.html');
    assert(await page.locator('#overlay-content [data-action="levels"]').count()===1,'Round 30 terminal action');
    assert(await page.locator('#overlay-content [data-action="next"]').count()===0,'Round 31 exposed');
    const record=await page.evaluate(({key,recordKey})=>JSON.parse(localStorage.getItem(key)).records[recordKey],{key,recordKey});
    assert(record.unlocked===30&&record.stars[12]===2,'Existing stars lost');
    results.push({id,platform,sizes,matchOrInput:true,save:true,lastLevel:true});
  }
  // An existing level-12 record naturally advances to the new level 13.
  const base=origin+'/games/paopaotang/';await page.goto(base+'assets/icon.svg');
  await page.evaluate(async base=>{
    const {newGame,serialize}=await import(base+'engine.mjs');const g=newGame({level:12,seed:1});g.status='won';
    g.players.filter(p=>p.team===1).forEach(p=>p.status='out');
    localStorage.setItem('fish-bubble-town:pc:v1',JSON.stringify({game:serialize(g),sound:false,records:{'solo:normal':{unlocked:12,stars:{1:3,12:2}}}}));
  },base);
  await page.goto(base+'pc.html');await page.locator('#overlay-content [data-action="next"]').click();
  assert(await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('fish-bubble-town:pc:v1')).game).level)===13,'Level 12 did not unlock 13');
  assert(!errors.length,errors.join('; '));return{result:'PASS',results,oldProgressContinues:true,pageErrors:errors};
}
