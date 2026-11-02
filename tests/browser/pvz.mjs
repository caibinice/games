async (page) => {
 const assert=(v,m)=>{if(!v)throw Error(m);},errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/pvz/'))errors.push(r.status()+' '+r.url());});
 await page.clock.install();await page.addInitScript(()=>{const n=Number(new URLSearchParams(location.search).get('qa-level'));if(n){localStorage.setItem('fish-pvz-v1',JSON.stringify({version:1,unlocked:n===1?1:50,selected:n,stars:{},music:true,sound:true,autoCollect:false}));if(n===1)localStorage.setItem('fish-zombie-v1','QA_PEER_SENTINEL');}});await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:55438/games/pvz/pc.html?qa-level=1');await page.clock.runFor(50);
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/pvz-20261023/qa/desktop-home.png'});
 await page.getByRole('button',{name:'开始冒险 ↗',exact:true}).click();await page.clock.runFor(100);
 const sun=async()=>Number(await page.locator('#garden').getAttribute('data-sun'));
 const put=async(id,row,col)=>{const b=page.locator('[data-seed='+id+']'),cost=Number(await b.locator('b').textContent());let ready=false;for(let i=0;i<80;i++){await page.clock.runFor(500);if(!await b.evaluate(e=>e.classList.contains('cooling'))&&await sun()>=cost){ready=true;break;}assert(await page.locator('#garden').getAttribute('data-status')==='running','game still running while waiting for sun');}assert(ready,'seed affordable '+id);await b.click();await page.locator('[data-row="'+row+'"][data-col="'+col+'"]').click();await page.clock.runFor(100);};
 await put('sunflower',0,0);await page.clock.runFor(3100);
 const before=await sun(),s=await page.locator('.entity.sun').first().boundingBox();assert(s,'falling sun exists');await page.mouse.click(s.x+s.width/2,s.y+s.height/2);await page.clock.runFor(100);assert(await sun()===before+25,'manual sun collection adds 25');
 await page.getByRole('button',{name:'自动收集阳光',exact:true}).click();
 for(let row=1;row<5;row++)await put('sunflower',row,0);
 for(let row=0;row<5;row++)await put('peashooter',row,1);
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/pvz-20261023/qa/desktop-combat.png'});
 const count=Number(await page.locator('#garden').getAttribute('data-plants'));assert(count>=9,'real seed-card planting');
 await page.getByRole('button',{name:'暂停游戏',exact:true}).click();await page.clock.runFor(100);const paused=await page.locator('#garden').evaluate(c=>({...c.dataset}));await page.clock.runFor(5000);assert(await page.locator('#garden').getAttribute('data-status')==='paused','pause state');assert(await page.locator('#garden').getAttribute('data-sun')===paused.sun,'pause freezes sun');await page.getByRole('button',{name:'继续守护',exact:true}).click();
 for(let i=0;i<150;i++){await page.clock.runFor(1500);if(await page.locator('#garden').getAttribute('data-status')==='won')break;}
 const finished=await page.locator('#garden').evaluate(c=>({...c.dataset}));assert(finished.status==='won','real UI first-level victory');const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('fish-pvz-v1')));assert(save.unlocked===2,'next level saved');assert(await page.evaluate(()=>localStorage.getItem('fish-zombie-v1'))==='QA_PEER_SENTINEL','peer save untouched');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/pvz-20261023/qa/desktop-victory.png'});
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:55438/games/pvz/mobile.html?qa-level=21');await page.clock.runFor(100);
 const portrait=await page.locator('#garden').boundingBox();assert(portrait.x>=0&&portrait.y>=0&&portrait.x+portrait.width<=391&&portrait.y+portrait.height<=845,'rotated portrait canvas visible');
 await page.getByRole('button',{name:'玩法说明',exact:true}).click();const helpBox=await page.locator('#modal').boundingBox();assert(helpBox.width<=390&&helpBox.height<=844&&helpBox.x>=0,'portrait dialog fits');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.evaluate(()=>{document.documentElement.requestFullscreen=async()=>{throw Error('QA fallback');};});await page.getByRole('button',{name:'切换全屏',exact:true}).click();assert(await page.locator('body').evaluate(e=>e.classList.contains('is-full')),'fullscreen fallback');
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/pvz-20261023/qa/mobile-home.png'});await page.getByRole('button',{name:'开始冒险 ↗',exact:true}).click();await page.clock.runFor(100);assert(await page.locator('.cell').count()===54,'pool has six rows');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
 const tap=async(row,col)=>{const b=await page.locator('[data-row="'+row+'"][data-col="'+col+'"]').boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0,radiusX:5,radiusY:5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.clock.runFor(150);};
 await page.locator('[data-seed=lilypad]').click();await tap(2,0);await page.locator('[data-seed=peashooter]').click();await tap(2,0);assert(await page.locator('#garden').getAttribute('data-plants')==='1','rotated touch plants on lily pad');
 await page.getByRole('button',{name:'铲子',exact:true}).click();await tap(2,0);assert(await page.locator('#garden').getAttribute('data-plants')==='0','rotated touch shovel');
 await page.setViewportSize({width:844,height:390});await page.clock.runFor(150);const landscape=await page.locator('#garden').boundingBox();assert(landscape.x>=0&&landscape.y>=0&&landscape.x+landscape.width<=845&&landscape.y+landscape.height<=391,'landscape canvas visible');await page.screenshot({path:'E:/Documents/AI/codex/tmp/pvz-20261023/qa/mobile-landscape.png'});
 assert(!errors.length,'runtime/assets '+errors.join(';'));return {result:'PASS',finished,save,portrait,helpBox,landscape,errors};
}
