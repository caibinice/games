// Generic player renderer from the APK Spine assets. Same pinned runtime as login.
import {Application,BaseTexture} from 'pixi.js';
import {TextureAtlas} from '@pixi-spine/base';
import {Spine,AtlasAttachmentLoader,SkeletonBinary} from '@pixi-spine/runtime-3.8';
export async function mountNativePlayer(canvas,base,{width=540,height=500,animation='idle_1',loop=true,scale=1,x=width/2,y=height*.9,auto=true}={}){
 const [atlasText,binary,image]=await Promise.all([
 fetch(base+'player-atlas.json').then(r=>{if(!r.ok)throw Error('player atlas');return r.json();}),
 fetch(base+'player-skeleton.json').then(r=>{if(!r.ok)throw Error('player skeleton');return r.json();}),
 new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=base+'player-texture.webp';})]);
 const app=new Application({view:canvas,width,height,resolution:1,backgroundAlpha:0,antialias:true,autoStart:false,sharedTicker:false,preserveDrawingBuffer:true});
 if(app.renderer.plugins.accessibility){app.renderer.plugins.accessibility.destroy();delete app.renderer.plugins.accessibility;}
 const tex=BaseTexture.from(image),atlas=await new Promise(resolve=>new TextureAtlas(atlasText,(_name,done)=>done(tex),resolve));
 const data=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(Uint8Array.from(atob(binary),c=>c.charCodeAt(0)));
 const actor=new Spine(data);actor.autoUpdate=false;actor.scale.set(scale);actor.position.set(x,y);
 const animations=data.animations.map(a=>a.name),idle=animations.includes(animation)?animation:animations.find(a=>/idle/i.test(a))||animations[0];
 actor.state.setAnimation(0,idle,loop);actor.update(.000001);app.stage.addChild(actor);app.renderer.render(app.stage);
 canvas.dataset.animation=idle;canvas.dataset.source='APK p_001_chushi_nan / Spine';canvas.dataset.animations=JSON.stringify(animations);
 let frame=0,last=0,disposed=false;
 function draw(now){if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!document.hidden)actor.update(dt);app.renderer.render(app.stage);frame=requestAnimationFrame(draw);}
 if(auto)frame=requestAnimationFrame(draw);
 return {animations,actor,app,update(dt=0){actor.update(dt);app.renderer.render(app.stage);},setAnimation(name,loop=true){if(!animations.includes(name))return false;actor.state.setAnimation(0,name,loop);canvas.dataset.animation=name;return true;},dispose(){disposed=true;cancelAnimationFrame(frame);app.destroy(false,{children:true,texture:true,baseTexture:true});}};
}
