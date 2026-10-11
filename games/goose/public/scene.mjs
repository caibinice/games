import * as T from './vendor/three.module.js';
import * as C from './vendor/cannon-es.js';
import {makeModel,makeBowl} from './models.mjs';
import {rng} from './engine.mjs';
import {ITEMS,themeFor} from './catalog.mjs';
export class GooseScene{
 constructor(container,onPick,onShake){
  this.container=container;this.onPick=onPick;this.onShake=onShake;this.actors=new Map();this.flights=[];this.batches=new Map();this.active=true;this.last=0;
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-4.7,4.7,5.5,-5.5,.1,40);this.camera.position.set(0,10,7.8);this.camera.lookAt(0,.25,0);
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setClearColor(0,0);this.canvas=this.renderer.domElement;this.canvas.id='goose-canvas';this.canvas.dataset.renderMode='webgl';this.canvas.setAttribute('aria-label','3D 物品锅，点击物品收集，拖动可以颠锅');container.append(this.canvas);
  this.scene.add(new T.HemisphereLight('#fff9e9','#b3c3b2',2.3));const light=new T.DirectionalLight('#fff6df',3);light.position.set(-4,9,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:25});light.shadow.bias=-.0006;light.shadow.normalBias=.025;this.scene.add(light);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.11}));ground.rotation.x=-Math.PI/2;ground.position.y=-.31;ground.receiveShadow=true;this.scene.add(ground);
  this.world=new C.World({gravity:new C.Vec3(0,-18,0),allowSleep:true});this.world.broadphase=new C.SAPBroadphase(this.world);this.world.solver.iterations=8;this.world.defaultContactMaterial.friction=.32;this.world.defaultContactMaterial.restitution=.12;
  const floor=new C.Body({mass:0,shape:new C.Plane()});floor.quaternion.setFromEuler(-Math.PI/2,0,0);this.world.addBody(floor);
  for(let i=0;i<24;i++){const a=i*Math.PI*2/24,b=new C.Body({mass:0,shape:new C.Box(new C.Vec3(.52,5,.14)),position:new C.Vec3(Math.cos(a)*3.52,4.7,Math.sin(a)*3.52)});b.quaternion.setFromEuler(0,Math.PI/2-a,0);this.world.addBody(b);}
  this.ray=new T.Raycaster();this.resize=new ResizeObserver(()=>this.size());this.resize.observe(container);this.size();
  this.canvas.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);});
  this.canvas.addEventListener('pointerup',e=>{if(!this.down)return;const dx=e.clientX-this.down.x,dy=e.clientY-this.down.y;this.down=null;if(Math.hypot(dx,dy)>22)this.onShake({x:dx,z:dy});else{const hit=this.hit(e.clientX,e.clientY);if(hit!==null)this.onPick(hit);}});
  this.canvas.addEventListener('pointercancel',()=>this.down=null);this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.setActive(false);container.dispatchEvent(new CustomEvent('render-lost'));});this.frame=this.frame.bind(this);this.setActive(true);
 }
 size(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const half=4.65;this.camera.left=-half;this.camera.right=half;this.camera.top=half*h/w;this.camera.bottom=-half*h/w;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);}
 sync(game){
  this.game=game;const theme=themeFor(game.level);if(this.theme!==theme.id){if(this.bowl)this.scene.remove(this.bowl);this.bowl=makeBowl(theme.color);this.scene.add(this.bowl);this.theme=theme.id;}
  const posed=new Map((game.poses||[]).map(p=>[p[0],p])),random=rng(game.seed+game.shakes*17),positions=game.items.map(i=>{const a=random()*Math.PI*2,r=Math.sqrt(random())*2.7;return[Math.cos(a)*r,.7+Math.floor(i.id/17)*.86,Math.sin(a)*r,random()*.6,random()*6.28,random()*.6];});
  for(const[id,a]of this.actors)if(game.items[id]?.status!==0){this.world.removeBody(a.body);this.actors.delete(id);this.flights.push({...a,start:performance.now(),from:a.mesh.position.clone()});}
  for(const item of game.items){if(item.status!==0||this.actors.has(item.id))continue;const mesh=makeModel(item.kind,theme.color),radius=item.kind==='goose'?.49:item.kind==='carrot'||item.kind==='bottle'?.39:.4,p=posed.get(item.id)?.slice(1)||positions[item.id];mesh.userData.id=item.id;mesh.traverse(o=>o.userData.id=item.id);const body=new C.Body({mass:.65,shape:new C.Sphere(radius),position:new C.Vec3(p[0],Math.max(radius,p[1]),p[2]),linearDamping:.35,angularDamping:.4,sleepSpeedLimit:.15,sleepTimeLimit:.6});body.quaternion.setFromEuler(p[3],p[4],p[5]);mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);this.world.addBody(body);this.actors.set(item.id,{mesh,body,kind:item.kind});}
  this.renderProps();
  this.size();
 }
 clear(){for(const a of this.actors.values())this.world.removeBody(a.body);this.actors.clear();this.flights=[];for(const b of this.batches.values()){this.scene.remove(b);b.dispose();}this.batches.clear();}
 renderProps(){
  for(const b of this.batches.values())b.count=0;
  for(const actor of [...this.actors.values(),...this.flights]){actor.mesh.updateMatrixWorld(true);for(const part of actor.mesh.children){const key=part.geometry.uuid+part.material.uuid;let batch=this.batches.get(key);if(!batch){batch=new T.InstancedMesh(part.geometry,part.material,128);batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.castShadow=batch.receiveShadow=true;batch.frustumCulled=false;batch.count=0;this.scene.add(batch);this.batches.set(key,batch);}batch.setMatrixAt(batch.count++,part.matrixWorld);}}
  for(const[key,b]of this.batches)if(b.count===0){this.scene.remove(b);b.dispose();this.batches.delete(key);}else b.instanceMatrix.needsUpdate=true;
 }
 shake(){for(const a of this.actors.values()){a.body.wakeUp();a.body.applyImpulse(new C.Vec3((Math.random()-.5)*2.1,1.8+Math.random()*1.2,(Math.random()-.5)*2.1));a.body.angularVelocity.set(Math.random()*4,Math.random()*4,Math.random()*4);}this.container.classList.remove('toss');void this.container.offsetWidth;this.container.classList.add('toss');}
 hit(x,y){const r=this.canvas.getBoundingClientRect();for(const a of this.actors.values())a.mesh.updateMatrixWorld(true);this.scene.updateMatrixWorld(true);this.ray.setFromCamera(new T.Vector2((x-r.x)/r.width*2-1,-(y-r.y)/r.height*2+1),this.camera);const objects=[...this.actors.values()].map(a=>a.mesh);if(this.bowl)objects.push(this.bowl);const found=this.ray.intersectObjects(objects,true)[0];return found?.object.userData.id??null;}
 targets(){this.scene.updateMatrixWorld(true);const r=this.canvas.getBoundingClientRect();return[...this.actors].map(([id,a])=>{const p=a.mesh.position.clone().project(this.camera),x=r.x+(p.x+1)*r.width/2,y=r.y+(1-p.y)*r.height/2;return{id,kind:a.kind,x,y,visible:this.hit(x,y)===id};}).filter(t=>t.visible&&t.x>=r.left&&t.x<=r.right&&t.y>=r.top&&t.y<=r.bottom);}
 snapshot(){return[...this.actors].map(([id,a])=>{const e=new T.Euler().setFromQuaternion(a.mesh.quaternion);return[id,a.body.position.x,a.body.position.y,a.body.position.z,e.x,e.y,e.z];});}
 frame(now){if(!this.active)return;this.raf=requestAnimationFrame(this.frame);if(now-this.last<30)return;const dt=Math.min(.06,(now-this.last)/1000||.033);this.last=now;this.world.step(1/60,dt,3);for(const a of this.actors.values()){if(a.body.position.y<-1||Math.hypot(a.body.position.x,a.body.position.z)>4){a.body.position.set(0,2,0);a.body.velocity.set(0,0,0);}a.mesh.position.copy(a.body.position);a.mesh.quaternion.copy(a.body.quaternion);}for(const f of [...this.flights]){const t=Math.min(1,(now-f.start)/350);f.mesh.position.copy(f.from).add(new T.Vector3(0,t*2,0));f.mesh.scale.setScalar(1-t);if(t===1)this.flights.splice(this.flights.indexOf(f),1);}this.renderProps();this.renderer.render(this.scene,this.camera);}
 setActive(value){this.active=value;cancelAnimationFrame(this.raf);this.last=performance.now();if(value)this.raf=requestAnimationFrame(this.frame);}
 dispose(){this.setActive(false);this.resize.disconnect();this.clear();this.renderer.dispose();this.canvas.remove();}
}
export class CompatibleScene{
 constructor(container,onPick){this.container=container;this.onPick=onPick;this.element=document.createElement('div');this.element.className='compatible-pile';this.element.dataset.renderMode='compatible';container.append(this.element);}
 sync(g){this.game=g;this.element.replaceChildren();for(const i of g.items.filter(i=>i.status===0)){const b=document.createElement('button');b.textContent=ITEMS[i.kind].icon;b.title=ITEMS[i.kind].name;b.dataset.item=i.id;b.onclick=()=>this.onPick(i.id);this.element.append(b);}}
 clear(){this.element.replaceChildren();}shake(){this.sync(this.game);}setActive(){}snapshot(){return null;}targets(){return[...this.element.children].map(b=>{const r=b.getBoundingClientRect(),i=this.game.items[+b.dataset.item];return{id:i.id,kind:i.kind,x:r.x+r.width/2,y:r.y+r.height/2,visible:true};});}dispose(){this.element.remove();}
}
