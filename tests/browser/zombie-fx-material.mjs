async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const proof=await page.context().newPage();await proof.goto('chrome://version');const flags=await proof.locator('#command_line').textContent();await proof.close();if(!flags.includes('--mute-audio'))throw Error('Muted browser required');
 await page.waitForFunction(()=>document.documentElement.dataset.fxPrewarm==='24/24',null,{timeout:20000});
 const report=await page.evaluate(async()=>{
  const {drawNativeEffect,preloadNativeFx}=await import('./native-fx.mjs'),{sampleNativeSprite}=await import('./native-fx-sampling.mjs');
  const loaded=await preloadNativeFx();if(loaded.loaded!==24||loaded.total!==24)throw Error('Incomplete native textures');
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=640;canvas.id='fx-material-qa';Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:9999});document.body.append(canvas);const c=canvas.getContext('2d');c.fillStyle='#183344';c.fillRect(0,0,900,640);
  const types=['laser','guided','vortex','magnet-strike','electron','unlimited-fire'],pixels={};
  for(let i=0;i<types.length;i++){
   const x=150+i%3*300,y=155+Math.floor(i/3)*320,age=types[i]==='vortex'?.4:.12;
   const f={type:types[i],x:types[i]==='laser'||types[i]==='guided'?x-90:x,y,bornAt:0,life:1-age,duration:1,r:types[i]==='laser'||types[i]==='guided'?5:36,tx:x+90,ty:y-30,path:[{x:x-90,y:y+30},{x:x+90,y:y-30}]};
   if(!drawNativeEffect(c,f,v=>v,age))throw Error('Missing renderer '+types[i]);
   const data=c.getImageData(i%3*300,Math.floor(i/3)*320,300,290).data;let changed=0,blue=0,orange=0;
   for(let k=0;k<data.length;k+=4){const r=data[k],g=data[k+1],b=data[k+2];if(r>35||g>62||b>80)changed++;if(b>r*1.3&&b>85)blue++;if(r>b*1.3&&r>75)orange++;}
   pixels[types[i]]={changed,blue,orange};c.fillStyle='#fff';c.font='20px sans-serif';c.fillText(types[i],x-90,y+110);
  }
  if(pixels.guided.orange<30)throw Error('Guided beam lost source orange vertex tint');
  if(pixels.laser.blue<30)throw Error('Laser lost source blue tint');
  if(pixels['magnet-strike'].changed<30||pixels.vortex.changed<30||pixels.electron.changed<30)throw Error('Invisible core effect');
  const frames=[.4,.84,5.4].map(t=>sampleNativeSprite('vortex-body',t).frame);if(frames.join(',')!=='5,0,5')throw Error('Vortex source cycles');
  return {muted:true,homePrewarm:true,loaded,pixels,vortexFrames:frames};
 });
 await page.screenshot({path:'E:/Documents/AI/codex/tmp/zombie-fx-material-20261030/source-material-grid.png'});await page.evaluate(()=>document.querySelector('#fx-material-qa').remove());
 if(errors.length)throw Error(errors.join(';'));return {...report,pageErrors:errors};
}
