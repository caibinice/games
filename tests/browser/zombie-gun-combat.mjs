async(page)=>{
 if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(page.url()))throw Error('Local QA only');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result=await page.evaluate(async()=>{
  const {createMeta,combatStats}=await import('./progression.mjs'),{createGame,start}=await import('./engine.mjs'),{rebuildSubSkills}=await import('./client-builds.mjs'),{fireGun,tickGun,hitGun}=await import('./native-gun-combat.mjs'),{drawNativeBullet}=await import('./native-fx.mjs');
  const rows=[];
  for(const [build,element,state]of [[300113,3,'burn'],[300124,2,'paralysis'],[300128,4,'freeze']]){
   const g=start(createGame({client:true,extended:true,stats:combatStats(createMeta(8))}));Object.assign(g.nativeBuilds,{300109:1,300110:1,[build]:1});rebuildSubSkills(g);g.time=0;g.bullets=[];const target={id:999,x:270,y:300,r:15,hp:1e6,maxHp:1e6,dead:false};g.enemies=[target];
   const api={fire:(g,x,y,t,damage,opts)=>{const d=Math.hypot(t.x-x,t.y-y),b={x,y,vx:(t.x-x)/d*opts.speed,vy:(t.y-y)/d*opts.speed,damage,...opts};g.bullets.push(b);return b;},effect:()=>{},damage:()=>{},random:()=>0};
   fireGun(g,target,api);if(g.bullets.length!==2)throw Error('salvo lanes');g.time=.1;tickGun(g,api);if(g.bullets.length!==4)throw Error('delayed burst');hitGun(g,g.bullets[0],target,api);if(!(target[state]>0))throw Error('element state');
   const canvas=document.createElement('canvas');canvas.width=540;canvas.height=800;const c=canvas.getContext('2d');if(!drawNativeBullet(c,g.bullets[0],y=>y,.1))throw Error('projectile renderer');const pixels=c.getImageData(0,0,540,800).data;if(!pixels.some((v,i)=>i%4===3&&v))throw Error('empty projectile');rows.push({element,rounds:g.bullets.length,status:state,duration:target[state]});
  }return rows;
 });
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'战斗',exact:true}).click();await page.getByRole('button',{name:/^开始游戏/}).click();await page.locator('[data-choice]').first().click();
 await page.waitForTimeout(500);if(errors.length)throw Error(errors.join(';'));

 return {elements:result,pageErrors:errors,mobile:true};
}
