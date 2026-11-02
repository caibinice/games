// Bundled with pinned Pixi 7.4.3 / pixi-spine 3.8 runtime 4.0.6.
import {Application,BaseTexture} from 'pixi.js';
import {TextureAtlas} from '@pixi-spine/base';
import {Spine,AtlasAttachmentLoader,SkeletonBinary} from '@pixi-spine/runtime-3.8';

export async function mountLoginActors(canvas,base){
 const [atlasText,binary,image]=await Promise.all([
  fetch(base+'login-atlas.json').then(r=>{if(!r.ok)throw Error('atlas');return r.json();}),
  fetch(base+'login-skeleton.json').then(r=>{if(!r.ok)throw Error('skeleton');return r.json();}),
  new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=base+'login-actors.webp';})
 ]);
 if(!canvas.isConnected)return ()=>{};
 const app=new Application({view:canvas,width:1080,height:2400,resolution:1,backgroundAlpha:0,antialias:true,autoStart:false,sharedTicker:false});
 if(app.renderer.plugins.accessibility){app.renderer.plugins.accessibility.destroy();delete app.renderer.plugins.accessibility;}
 const tex=BaseTexture.from(image),atlas=await new Promise(resolve=>new TextureAtlas(atlasText,(_name,done)=>done(tex),resolve));
 const data=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(Uint8Array.from(atob(binary),c=>c.charCodeAt(0)));
 const actor=new Spine(data);actor.autoUpdate=false;
 // MainLoginUI / m_goAnimation: bottom-center anchored, native localScale 1.5;
 // source reference canvas 750 wide -> browser's existing 1080-wide root.
 actor.scale.set(1.5*1080/750);actor.position.set(540,2400);
 actor.state.setAnimation(0,'idle',true);actor.update(.000001);app.stage.addChild(actor);
 canvas.dataset.animation='idle';canvas.dataset.source='APK ui_005_denglutu / Spine 3.8.99';
 let frame=0,last=0,disposed=false;
 function draw(now){if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!document.hidden)actor.update(dt);app.renderer.render(app.stage);frame=requestAnimationFrame(draw);}
 frame=requestAnimationFrame(draw);
 return ()=>{disposed=true;cancelAnimationFrame(frame);app.destroy(false,{children:true,texture:true,baseTexture:true});};
}
