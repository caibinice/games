async(page)=>{
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(page.url()))throw Error('Local QA only');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const proof=await page.context().newPage();await proof.goto('chrome://version');const command=await proof.locator('#command_line').textContent();await proof.close();
 if(!command.includes('--mute-audio'))throw Error('Browser must be muted before UI testing');
 await page.evaluate(async()=>{const {createMeta,META_KEY}=await import('./progression.mjs'),{defaultProfile,SAVE_KEY}=await import('./profile.mjs'),{ensureNative}=await import('./native-progression.mjs');const p=createMeta(20);p.entered=true;ensureNative(p).goods[70007]=4;localStorage.setItem(META_KEY,JSON.stringify(p));localStorage.setItem(SAVE_KEY,JSON.stringify({...defaultProfile(),music:false,sound:false}));});
 await page.reload();await page.locator('.operation-entry[data-operation="newyear"]').click();
 await page.locator('.op-wheel-prize').first().waitFor();if(await page.locator('.op-wheel-prize').count()!==10)throw Error('seasonal slot count');
 await page.getByRole('button',{name:'增加指针',exact:true}).click();await page.getByRole('button',{name:'增加指针',exact:true}).click();
 if(!(await page.getByRole('button',{name:'增加指针',exact:true}).isDisabled()))throw Error('pointer cap');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fish-zombie-meta-v1')));
 await page.getByRole('button',{name:'免费转动',exact:true}).click();await page.locator('.op-reward-cards').waitFor();
 const drawn=await read();if(drawn.native.operations.newyear.draws!==3)throw Error('draw persistence');
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.locator('#toast.visible').waitFor({state:'hidden'});
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-goal-20261030/mobile-seasonal.png'});
 const bounds=await page.locator('.op-buttons').boundingBox();if(!bounds||bounds.y<0||bounds.y+bounds.height>844)throw Error('mobile action clipping');
 await page.getByRole('button',{name:'返回主页',exact:true}).click();await page.getByRole('button',{name:'菜单',exact:true}).click();await page.getByRole('button',{name:'活动道具',exact:true}).click();
 await page.locator('[data-activity-item-use="70007"]').first().click();await page.locator('.op-reward-cards').waitFor();const used=await read();if(used.native.goods[70007]!==3)throw Error('item not consumed');if(!Object.keys(used.inventory).some(k=>k.startsWith('gem-native:')))throw Error('gem not granted');
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();if((await read()).native.goods[70007]!==3)throw Error('item state lost');
 if(errors.length)throw Error(errors.join(';'));return {muted:true,seasonalSlots:10,pointers:3,draws:3,itemPersisted:true,pageErrors:errors};
}
