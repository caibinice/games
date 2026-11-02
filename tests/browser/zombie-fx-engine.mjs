async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const report=await page.evaluate(async()=>{
  const {createGame,start,step}=await import('./engine.mjs'),{drawNativeEffect,preloadNativeFx}=await import('./native-fx.mjs');await preloadNativeFx();
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=640;canvas.id='fx-engine-qa';Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:9999});document.body.append(canvas);const c=canvas.getContext('2d');c.fillStyle='#183344';c.fillRect(0,0,900,640);
  const cases={laser:'laser',guided:'guided',electron:'electron',vortex:'vortex',lightning:'magnet-strike'},proof=[];
  for(const [skill,type] of Object.entries(cases)){
   const g=start(createGame({client:true,extended:true,loadout:skill,seed:17,coreLevels:{[skill]:60},stats:{nativeAttack:100}}));g.plan=[];g.info.count=100000;g.nextXp=1e8;g.spawnClock=100000;
   for(const id of Object.keys(g.weapons)){g.weapons[id]=id===skill?1:0;g.cooldowns[id]=id===skill?0:100000;}
   g.enemies=Array.from({length:12},(_,i)=>({id:900+i,type:'walker',x:150+i%3*120,y:280+Math.floor(i/3)*90,r:18,hp:1e8,maxHp:1e8,speed:0,damage:0,xp:0,slow:0,freeze:0,burn:0,flash:0,attack:100000,phase:0,dead:false}));
   let captured=null;for(let i=0;i<360;i++){step(g,1/60);const f=g.effects.find(f=>f.type===type);if(!captured&&f&&g.time-f.bornAt>=.1)captured={time:g.time,effects:structuredClone(g.effects.filter(f=>f.type===type))};}
   if(!captured)throw Error('No actual core effect '+skill);const damage=g.damageBySkill[skill]||0;if(!(damage>0))throw Error('No actual core damage '+skill);
   const index=proof.length,left=index%3*300,top=Math.floor(index/3)*320;c.save();c.beginPath();c.rect(left,top,300,300);c.clip();c.translate(left+15,top);c.scale(.5,.38);for(const f of captured.effects)drawNativeEffect(c,f,v=>v,captured.time);c.restore();c.fillStyle='white';c.font='18px sans-serif';c.fillText(`${skill}: ${Math.round(damage)}`,left+20,top+310);
   proof.push({skill,type,damage,effects:captured.effects.length,time:captured.time});
  }
  return {actualEngineCasts:proof};
 });
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-fx-material-20261030/actual-engine-casts.png'});await page.evaluate(()=>document.querySelector('#fx-engine-qa').remove());if(errors.length)throw Error(errors.join(';'));return {...report,pageErrors:errors};
}
