async(page)=>{
 const check=(v,m)=>{if(!v)throw Error(m)},errors=[];
 if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(page.url()))throw Error('This fixture is local-preview only');
 page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(async()=>{
  const {createMeta,META_KEY,equipGem}=await import('./progression.mjs');
  const {defaultProfile,SAVE_KEY}=await import('./profile.mjs');
  const {nativeSupply,upgradeNativeSkin,equipNativeSkin}=await import('./native-progression.mjs');
  const p=createMeta(8);p.entered=true;nativeSupply(p);upgradeNativeSkin(p,82001);equipNativeSkin(p,82001);
  p.inventory={'gem-native:900410207':1,'gem-native:901080107':1};equipGem(p,'gem-native:901080107','helmet',0);
  localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify(defaultProfile()));
 });
 await page.reload();
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')));
 await page.getByRole('button',{name:'核心',exact:true}).click();
 await page.getByRole('button',{name:'幻形',exact:true}).click();
 await page.locator('.native-form-portrait[data-loaded="true"]').waitFor();
 check(await page.locator('.native-form-view [data-native-form="82001"]').count()===1,'actual selected model');
 await page.locator('[data-growth-skin-unset="82001"]').click();check((await read()).native.skinSlots[2]===0,'unset persists');
 await page.locator('[data-growth-skin="82001"]').click();check((await read()).native.skinSlots[2]===82001,'equip persists');
 await page.locator('[data-growth-skin-up="82001"]').click();check((await read()).native.skins[82001]===2,'star action');
 await page.setViewportSize({width:390,height:844});
 const inside=await page.locator('.native-form-footer').boundingBox();check(inside.y+inside.height<=845,'mobile footer visible');
 await page.getByRole('button',{name:'返回核心',exact:true}).click();
 await page.getByRole('button',{name:'菜单',exact:true}).click();await page.getByRole('button',{name:'技能合成公式',exact:true}).click();
 await page.locator('[data-tree-skill="grenade"]').click();check((await page.locator('#dialog').textContent()).includes('温压弹核心 ≥14级'),'source fusion gate');
 await page.locator('[data-tree-skill="gun"]').click();check(await page.locator('.codex-formula').count()>0,'gun formulas');
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'角色',exact:true}).click();await page.locator('[data-gem]').first().click();await page.locator('[data-gem-refine]').first().click();
 const before=(await read()).native.goods[1001];await page.locator('[data-refine-start]').click();
 const rolled=await read();check(before-rolled.native.goods[1001]===20,'supreme roll cost');check(!rolled.native.gemRefine,'direct replacement');check(await page.locator('[data-refine-finish]').count()===0,'no second choice');
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'战斗',exact:true}).click();await page.getByRole('button',{name:/^开始游戏/}).click();
 await page.locator('[data-choice]').first().waitFor();await page.getByRole('button',{name:'查看合成公式',exact:true}).click();
 await page.getByRole('button',{name:'关闭',exact:true}).click();check(await page.locator('[data-choice]').count()>0,'closing recipes restores upgrade choices');
 await page.locator('[data-choice]').first().click();check(errors.length===0,errors.join(';'));
 await page.reload();
 return {forms:true,mobile:true,sourceFormulas:true,directRoll:true,upgradeReturn:true,pageErrors:errors};
}
