async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{localStorage.removeItem('fish-zombie-meta-v1');localStorage.removeItem('fish-zombie-v1');});await page.reload();await page.getByRole('button',{name:'开始游戏',exact:true}).click();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')));
 for(const id of ['wheel','armed','box','egg','spring','newyear','treasure','xunxing']){
  await page.locator('[data-operation="'+id+'"]').first().click();
  await page.locator('[data-operation-page="'+id+'"]').waitFor();
  check(await page.locator('[data-operation-close]').count()===1,'missing back '+id);
  await page.waitForFunction(()=>[...document.querySelectorAll('.operations-screen img')].every(i=>i.complete));
  const broken=await page.locator('.operations-screen img').evaluateAll(rows=>rows.filter(i=>!i.naturalWidth).map(i=>i.src));check(broken.length===0,'broken source art '+id+JSON.stringify(broken));
  await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-operations-20261026/'+id+'-qa.png'});
 }
 await page.locator('[data-operation="box"]').click();
 const before=await read();await page.locator('[data-op-draw="5"]').click();
 await page.getByRole('heading',{name:'恭喜获得'}).waitFor();
 const after=await read();check(after.diamonds===before.diamonds,'lottery charged diamonds');check(after.native.operations.box.draws===5,'lottery ledger');
 await page.getByRole('button',{name:'继续抽取'}).click();
 await page.locator('[data-operation-close]').click();
 await page.getByRole('button',{name:'畅玩控制台',exact:true}).click();
 await page.getByRole('button',{name:'领取全套补给'}).click();
 await page.getByRole('button',{name:'确定',exact:true}).click();
 await page.getByRole('button',{name:'角色',exact:true}).click();
 await page.getByRole('button',{name:'枪械',exact:true}).click();
 check(await page.locator('[data-growth-gun-view]').count()===50,'50 guns missing');
 await page.locator('[data-growth-gun-view="4"]').click();await page.locator('[data-growth-gun="4"]').click();
 await page.locator('[data-growth-talent]').click();check((await read()).native.gunSkillLevel===1,'talent not saved');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-operations-20261026/gun-qa.png'});
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'佣兵',exact:true}).click();
 check(await page.locator('[data-growth-merc-view]').count()===19,'19 mercs missing');
 await page.locator('[data-growth-merc="101"]').click();await page.locator('[data-growth-merc-up="101"]').click();
 await page.locator('[data-growth-merc-quality="101"]').click();check((await read()).native.mercenaries[101].level===2,'merc level');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-operations-20261026/mercenary-qa.png'});
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'时装',exact:true}).click();
 await page.locator('[data-growth-skin-up="81001"]').click();await page.locator('[data-growth-skin="81001"]').click();
 check((await read()).native.skinSlots[1]===81001,'skin not equipped');
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'核心',exact:true}).click();
 await page.locator('[data-skill="grenade"]').click();const skill=(await read()).skills.grenade.level;await page.locator('[data-upgrade-skill="grenade"]').click();check((await read()).skills.grenade.level===skill+1,'core upgrade failed');
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'战斗',exact:true}).click();await page.locator('[data-action="start"]').click();
 await page.locator('canvas#battlefield').waitFor();
 for(let i=0;i<2;i++){const choice=page.locator('[data-choice]').first();if(await choice.count())await choice.click();}
 await page.waitForTimeout(5000);
 const data=await page.locator('#battlefield').evaluate(e=>({...e.dataset}));
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-operations-20261026/combat-qa.png'});
 check(!errors.length,'page errors '+JSON.stringify(errors));
 return {ok:true,guns:50,mercenaries:19,operations:8,freeDraws:5,data,errors};
}
