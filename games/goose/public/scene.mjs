import * as T from './vendor/three.module.js';
import * as C from './vendor/cannon-es.js';
import {makeModel,makeBowl} from './models.mjs';
import {rng} from './engine.mjs';
import {ITEMS,themeFor} from './catalog.mjs';
export class GooseScene{
 constructor(container,onPick,onShake){
  this.container=container;this.onPick=onPick;this.onShake=onShake;this.actors=new Map();this.flights=[];this.batches=new Map();this.active=true;this.last=0;this.dirty=true;
  this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-4.7,4.7,5.5,-5.5,.1,40);this.camera.position.set(0,13,5.6);this.camera.lookAt(0,-.8,0);
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;this.renderer.setClearColor(0,0);this.canvas=this.renderer.domElement;this.canvas.id='goose-canvas';this.canvas.dataset.renderMode='webgl';this.canvas.setAttribute('aria-label','3D 物品锅，点击物品收集，拖动可以颠锅');container.append(this.canvas);
  this.scene.add(new T.HemisphereLight('#fff9e9','#b3c3b2',2.3));const light=new T.DirectionalLight('#fff6df',3);light.position.set(-4,9,5);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:25});light.shadow.bias=-.0006;light.shadow.normalBias=.025;this.scene.add(light);
  const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.045}));ground.rotation.x=-Math.PI/2;ground.position.y=-3.8;ground.receiveShadow=true;this.scene.add(ground);
  this.world=new C.World({gravity:new C.Vec3(0,-18,0),allowSleep:true});this.world.broadphase=new C.SAPBroadphase(this.world);this.world.solver.iterations=8;this.world.defaultContactMaterial.friction=.32;this.world.defaultContactMaterial.restitution=.12;
  const floor=new C.Body({mass:0,shape:new C.Plane()});floor.position.y=-3.5;floor.quaternion.setFromEuler(-Math.PI/2,0,0);this.world.addBody(floor);
  for(const [x,z,sx,sz]of [[-3.32,0,.14,3.5],[3.32,0,.14,3.5],[0,-3.32,3.5,.14],[0,3.32,3.5,.14]])this.world.addBody(new C.Body({mass:0,shape:new C.Box(new C.Vec3(sx,6,sz)),position:new C.Vec3(x,1.5,z)}));
  this.ray=new T.Raycaster();this.resize=new ResizeObserver(()=>this.size());this.resize.observe(container);this.size();
  this.canvas.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);});
  this.canvas.addEventListener('pointerup',e=>{if(!this.down)return;const dx=e.clientX-this.down.x,dy=e.clientY-this.down.y;this.down=null;if(Math.hypot(dx,dy)>22)this.onShake({x:dx,z:dy});else{const hit=this.hit(e.clientX,e.clientY);if(hit!==null)this.onPick(hit);}});
  this.canvas.addEventListener('pointercancel',()=>this.down=null);this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.setActive(false);container.dispatchEvent(new CustomEvent('render-lost'));});this.frame=this.frame.bind(this);this.setActive(true);
 }
 size(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const half=Math.max(4.15,4.05*w/Math.max(h,1));this.camera.left=-half;this.camera.right=half;this.camera.top=half*h/w;this.camera.bottom=-half*h/w;this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);}
 sync(game){
  this.game=game;const theme=themeFor(game.level);if(this.theme!==theme.id){if(this.bowl)this.scene.remove(this.bowl);this.bowl=makeBowl(theme.color);this.scene.add(this.bowl);this.theme=theme.id;}
  const posed=new Map((game.poses||[]).map(p=>[p[0],p])),random=rng(game.seed+game.shakes*17),positions=game.items.map(i=>{
   const column=i.id%6,row=Math.floor(i.id/6)%6,layer=Math.floor(i.id/36);
   return[(column-2.5)*.96+(random()-.5)*.16,-2.76+layer*.94,(row-2.5)*.96+(random()-.5)*.16,random()*Math.PI,random()*6.28,random()*Math.PI];});
  let removedPile=false;for(const[id,a]of this.actors)if(game.items[id]?.status!==0){this.world.removeBody(a.body);this.actors.delete(id);removedPile=true;}if(removedPile)for(const a of this.actors.values())a.body.wakeUp();this.dirty=true;
  for(const item of game.items){if(item.status!==0||this.actors.has(item.id))continue;const mesh=makeModel(item.kind,theme.color),scale=1.34;mesh.scale.setScalar(scale);
   const bounds=new T.Box3().setFromObject(mesh),size=bounds.getSize(new T.Vector3());
   const center=bounds.getCenter(new T.Vector3()),shape=['apple','orange','pumpkin','egg','lemon','pear','ball'].includes(item.kind)?new C.Sphere(Math.max(size.x,size.z)*.45):new C.Box(new C.Vec3(size.x*.43,size.y*.43,size.z*.43));
   const p=posed.get(item.id)?.slice(1)||positions[item.id];mesh.userData.id=item.id;mesh.traverse(o=>o.userData.id=item.id);
   const body=new C.Body({mass:.65,position:new C.Vec3(p[0],Math.max(-2.95,p[1]),p[2]),linearDamping:.42,angularDamping:.5,sleepSpeedLimit:.22,sleepTimeLimit:.7});body.addShape(shape,new C.Vec3(center.x,center.y,center.z));body.quaternion.setFromEuler(p[3],p[4],p[5]);mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);this.world.addBody(body);this.actors.set(item.id,{mesh,body,kind:item.kind});}
  this.renderProps();
  this.size();
 }
 clear(){for(const a of this.actors.values())this.world.removeBody(a.body);this.actors.clear();this.flights=[];for(const b of this.batches.values()){this.scene.remove(b);b.dispose();}this.batches.clear();}
 renderProps(){
  for(const b of this.batches.values())b.count=0;
  for(const actor of [...this.actors.values(),...this.flights]){actor.mesh.updateMatrixWorld(true);for(const part of actor.mesh.children){const key=part.geometry.uuid+part.material.uuid;let batch=this.batches.get(key);if(!batch){batch=new T.InstancedMesh(part.geometry,part.material,256);batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.castShadow=batch.receiveShadow=true;batch.frustumCulled=false;batch.count=0;this.scene.add(batch);this.batches.set(key,batch);}batch.setMatrixAt(batch.count++,part.matrixWorld);}}
  for(const[key,b]of this.batches)if(b.count===0){this.scene.remove(b);b.dispose();this.batches.delete(key);}else b.instanceMatrix.needsUpdate=true;
 }
 shake(){for(const a of this.actors.values()){a.body.wakeUp();a.body.applyImpulse(new C.Vec3((Math.random()-.5)*2.1,1.8+Math.random()*1.2,(Math.random()-.5)*2.1));a.body.angularVelocity.set(Math.random()*4,Math.random()*4,Math.random()*4);}this.container.classList.remove('toss');void this.container.offsetWidth;this.container.classList.add('toss');}
 hit(x,y){const r=this.canvas.getBoundingClientRect();for(const a of this.actors.values())a.mesh.updateMatrixWorld(true);this.scene.updateMatrixWorld(true);this.ray.setFromCamera(new T.Vector2((x-r.x)/r.width*2-1,-(y-r.y)/r.height*2+1),this.camera);const objects=[...this.actors.values()].map(a=>a.mesh);if(this.bowl)objects.push(this.bowl);const found=this.ray.intersectObjects(objects,true)[0];return found?.object.userData.id??null;}
 targets(){this.scene.updateMatrixWorld(true);const r=this.canvas.getBoundingClientRect();return[...this.actors].map(([id,a])=>{const p=a.mesh.position.clone().project(this.camera),x=r.x+(p.x+1)*r.width/2,y=r.y+(1-p.y)*r.height/2;return{id,kind:a.kind,x,y,visible:this.hit(x,y)===id};}).filter(t=>t.visible&&t.x>=r.left&&t.x<=r.right&&t.y>=r.top&&t.y<=r.bottom);}
 screenPose(id){const a=this.actors.get(id);if(!a)return null;const r=this.canvas.getBoundingClientRect(),box=new T.Box3().setFromObject(a.mesh),center=box.getCenter(new T.Vector3()).project(this.camera),points=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).project(this.camera));const width=(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*r.width/2,height=(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))*r.height/2;return{x:r.x+(center.x+1)*r.width/2,y:r.y+(1-center.y)*r.height/2,size:Math.max(width,height)*1.08,quaternion:this.camera.quaternion.clone().invert().multiply(a.mesh.quaternion)};}

 shuffle(){this.clear();this.sync(this.game);this.container.classList.remove('toss');void this.container.offsetWidth;this.container.classList.add('toss');}
 snapshot(){return[...this.actors].map(([id,a])=>{const e=new T.Euler().setFromQuaternion(a.mesh.quaternion);return[id,a.body.position.x,a.body.position.y,a.body.position.z,e.x,e.y,e.z];});}
 frame(now){if(!this.active)return;this.raf=requestAnimationFrame(this.frame);if(now-this.last<30)return;const dt=Math.min(.06,(now-this.last)/1000||.033);this.last=now;this.world.step(1/60,dt,3);if(!this.dirty&&![...this.actors.values()].some(a=>a.body.sleepState!==C.Body.SLEEPING))return;for(const a of this.actors.values()){if(a.body.position.y<-4.4||Math.max(Math.abs(a.body.position.x),Math.abs(a.body.position.z))>3.8){a.body.position.set(0,1.4,0);a.body.velocity.set(0,0,0);}a.mesh.position.copy(a.body.position);a.mesh.quaternion.copy(a.body.quaternion);}this.renderProps();this.renderer.render(this.scene,this.camera);this.dirty=false;}
 setActive(value){this.active=value;cancelAnimationFrame(this.raf);this.last=performance.now();if(value)this.raf=requestAnimationFrame(this.frame);}
 dispose(){this.setActive(false);this.resize.disconnect();this.clear();this.renderer.dispose();this.canvas.remove();}
}
export class CompatibleScene{
 constructor(container,onPick){this.container=container;this.onPick=onPick;this.element=document.createElement('div');this.element.className='compatible-pile';this.element.dataset.renderMode='compatible';container.append(this.element);}
 sync(g){this.game=g;this.element.replaceChildren();for(const i of g.items.filter(i=>i.status===0)){const b=document.createElement('button');b.textContent=ITEMS[i.kind].icon;b.title=ITEMS[i.kind].name;b.dataset.item=i.id;b.onclick=()=>this.onPick(i.id);this.element.append(b);}}
 screenPose(id){const t=this.targets().find(t=>t.id===id);return t?{...t,size:40}:null;}clear(){this.element.replaceChildren();}shuffle(){this.sync(this.game);}shake(){this.sync(this.game);}setActive(){}snapshot(){return null;}targets(){return[...this.element.children].map(b=>{const r=b.getBoundingClientRect(),i=this.game.items[+b.dataset.item];return{id:i.id,kind:i.kind,x:r.x+r.width/2,y:r.y+r.height/2,visible:true};});}dispose(){this.element.remove();}
}
// One transparent overlay renders both the collection models and their flights.
// Items reuse the very same 3D geometry as the pile; there are no emoji sprites
// in WebGL mode. DOM slots retain names and touch targets for accessibility.
export class CollectionScene{
 constructor(host){
  this.host=host;this.scene=new T.Scene();this.camera=new T.OrthographicCamera(0,1,0,-1,.1,2000);this.camera.position.z=1000;
  this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
  this.canvas=this.renderer.domElement;this.canvas.id='collection-canvas';this.canvas.setAttribute('aria-hidden','true');host.append(this.canvas);
  this.scene.add(new T.HemisphereLight('#fff9e8','#8a947e',2.8));const light=new T.DirectionalLight('#fff6e7',3);light.position.set(-150,300,700);this.scene.add(light);
  this.cloudGeometry=new T.SphereGeometry(1,8,6);this.ringGeometry=new T.TorusGeometry(.56,.025,5,32);this.extents=new Map();this.objects=new T.Group();this.scene.add(this.objects);this.jobs=[];this.enabled=false;this.observer=new ResizeObserver(()=>this.render());this.observer.observe(host);this.observer.observe(document.getElementById('tray'));this.frame=this.frame.bind(this);
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();host.dispatchEvent(new CustomEvent('collection-lost'));});
 }
 rect(index,reserve=false){const el=document.getElementById(reserve?'reserve':'tray').children[index];return el?.getBoundingClientRect();}
 position(rect){const h=this.host.getBoundingClientRect();return{x:rect.x+rect.width/2-h.x,y:-(rect.y+rect.height/2-h.y),size:rect.width*.84};}
 model(item,rect){const m=makeModel(item.kind,themeFor(this.game.level).color);if(!this.extents.has(item.kind)){const box=new T.Box3().setFromObject(m),size=box.getSize(new T.Vector3());this.extents.set(item.kind,{max:Math.max(size.x,size.y,size.z),center:box.getCenter(new T.Vector3())});}const {max,center}=this.extents.get(item.kind);
  for(const part of m.children)part.position.sub(center);const p=this.position(rect);m.scale.setScalar(p.size/max);m.rotation.set(-.28,.42,.03);m.position.set(p.x,p.y,20);this.objects.add(m);return m;
 }
 setEnabled(value){this.enabled=value;this.canvas.hidden=!value;if(value)this.render();else this.reset();}
 sync(game){this.game=game;if(!this.job&&!this.jobs.length){this.displayTray=[...game.tray];this.displayReserve=[...game.reserve];this.render();}}
 reset(game=this.game){cancelAnimationFrame(this.raf);this.raf=null;this.jobs=[];this.job=null;this.game=game;if(game){this.displayTray=[...game.tray];this.displayReserve=[...game.reserve];}this.render();}
 animate(game,{id,from,beforeTray,removed}){
  this.game=game;const order=Object.keys(ITEMS),insertion=[...beforeTray,id].sort((a,b)=>order.indexOf(game.items[a].kind)-order.indexOf(game.items[b].kind));
  this.jobs.push({id,from,insertion,removed:[...removed],tray:[...game.tray],reserve:[...game.reserve]});if(!this.job)this.next();
 }
 next(){this.job=this.jobs.shift();if(!this.job){this.render();return;}this.job.start=performance.now();this.displayTray=this.job.insertion.filter(id=>id!==this.job.id);this.displayReserve=this.job.reserve;this.raf=requestAnimationFrame(this.frame);}
 render(now=performance.now()){
  if(!this.game||!this.enabled)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;if(this.width!==w||this.height!==h){this.renderer.setSize(w,h,false);this.width=w;this.height=h;}Object.assign(this.camera,{left:0,right:w,top:0,bottom:-h});this.camera.updateProjectionMatrix();this.objects.clear();
  const j=this.job,t=j?(now-j.start):0,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const insert=j?.insertion||this.displayTray||this.game.tray;
  const ids=j&&t<310?insert.filter(id=>id!==j.id):j&&t<650?insert:this.displayTray||this.game.tray;
  for(const id of ids){const index=insert.indexOf(id),r=this.rect(index);if(!r)continue;const m=this.model(this.game.items[id],r);if(j?.removed.includes(id)&&t>310){const k=Math.min(1,(t-310)/220);m.scale.multiplyScalar(1-k);m.rotation.z+=k*.8;}}
  for(const[id,index]of (this.displayReserve||[]).map((id,i)=>[id,i])){const r=this.rect(index,true);if(r)this.model(this.game.items[id],r);}
  if(j&&t<310){const r=this.rect(j.insertion.indexOf(j.id));if(r){const m=this.model(this.game.items[j.id],r),dest=this.position(r),host=this.host.getBoundingClientRect(),from=j.from||{x:r.x+r.width/2,y:r.y+r.height/2,size:r.width},p=Math.min(1,t/310),travel=p<.2?0:1-Math.pow(1-(p-.2)/.8,3),start={x:from.x-host.x,y:-(from.y-host.y)};
   m.position.set(start.x+(dest.x-start.x)*travel,start.y+(dest.y-start.y)*travel+Math.sin(Math.PI*p)*35,80);
   const startScale=from.size/this.extents.get(this.game.items[j.id].kind).max,endScale=m.scale.x;m.scale.setScalar(startScale*(1-travel)+endScale*travel);if(from.quaternion)m.quaternion.copy(from.quaternion).slerp(new T.Quaternion().setFromEuler(new T.Euler(-.28,.42,.03)),travel);
   // Bright pick halo around the lifted 3D item, then a quick slot landing pulse.
   const ring=new T.Mesh(this.ringGeometry,new T.MeshBasicMaterial({color:'#ffe98c',transparent:true,opacity:(1-travel)*.85,depthTest:false}));ring.scale.setScalar(from.size);ring.position.copy(m.position);ring.position.z=90;this.objects.add(ring);this.transient??=[];this.transient.push(ring);
  }}
  if(j?.removed.length&&t>=310&&t<720&&!reduced){const k=(t-310)/410;for(const id of j.removed){const r=this.rect(j.insertion.indexOf(id));if(!r)continue;const p=this.position(r);for(let n=0;n<5;n++){const a=n*2.4,cloud=new T.Mesh(this.cloudGeometry,new T.MeshStandardMaterial({color:n%2?'#fffdf3':'#f2f6ee',roughness:1,transparent:true,opacity:Math.pow(Math.max(0,1-k),.65),depthTest:false}));cloud.scale.setScalar(r.width*(.16+.32*Math.sin(Math.PI*k)));cloud.position.set(p.x+Math.cos(a)*k*r.width*.65,p.y+Math.sin(a)*k*r.width*.55+k*55,100);this.objects.add(cloud);this.transient??=[];this.transient.push(cloud);}}}
  this.canvas.dataset.flights=j&&t<310?'1':'0';this.canvas.dataset.matching=j?.removed.length&&t>=310&&t<720?'true':'false';this.canvas.dataset.models=String(ids.length+(this.displayReserve||[]).length);
  this.renderer.render(this.scene,this.camera);for(const m of this.transient||[]){m.material.dispose();}this.transient=[];
 }
 frame(now){this.raf=null;if(!this.enabled||!this.job)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?80:this.job.removed.length?720:330;this.render(now);if(now-this.job.start>=duration){this.displayTray=this.job.tray;this.displayReserve=this.job.reserve;this.job=null;this.next();}else this.raf=requestAnimationFrame(this.frame);}
 dispose(){this.enabled=false;cancelAnimationFrame(this.raf);this.observer.disconnect();this.cloudGeometry.dispose();this.ringGeometry.dispose();this.renderer.dispose();this.canvas.remove();}
}
