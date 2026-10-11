import * as T from './vendor/three.module.js';
const mats=new Map(),geos=new Map(),models=new Map();
function mat(color,metal=0){const key=color+metal;if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,roughness:.48,metalness:metal}));return mats.get(key);}
function geo(key,create){if(!geos.has(key))geos.set(key,create());return geos.get(key);}
const sphere=()=>geo('sphere',()=>new T.SphereGeometry(1,12,9));
const box=()=>geo('box',()=>new T.BoxGeometry(1,1,1));
function cylinder(top=1,bottom=1){return geo('cylinder'+top+bottom,()=>new T.CylinderGeometry(top,bottom,1,14));}
function torus(radius,tube){return geo('torus'+radius+tube,()=>new T.TorusGeometry(radius,tube,8,24));}
function part(group,geometry,color,scale,pos,rotation=[0,0,0],metal=0){const mesh=new T.Mesh(geometry,mat(color,metal));mesh.scale.set(...scale);mesh.position.set(...pos);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
function ball(g,c,s,p){return part(g,sphere(),c,s,p);}
function tube(g,c,s,p,r=[0,0,0]){return part(g,cylinder(),c,s,p,r);}
function leaf(g,p,rot=0,color='#7bab54'){return part(g,sphere(),color,[.12,.27,.06],p,[.2,0,rot]);}
// Bake each original model into shared, material-grouped geometry. Repeated items
// can then be rendered as instances rather than hundreds of separate primitives.
function compact(group){
 group.updateMatrixWorld(true);const buckets=new Map(),result=new T.Group();
 for(const mesh of group.children){const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),flat=geometry.index?geometry.toNonIndexed():geometry;
  if(flat!==geometry)geometry.dispose();if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(flat);}
 for(const[material,parts]of buckets){const geometry=new T.BufferGeometry();for(const name of ['position','normal']){const length=parts.reduce((n,p)=>n+p.getAttribute(name).array.length,0),data=new Float32Array(length);let offset=0;for(const p of parts){data.set(p.getAttribute(name).array,offset);offset+=p.getAttribute(name).array.length;}geometry.setAttribute(name,new T.BufferAttribute(data,3));}
  for(const p of parts)p.dispose();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;result.add(mesh);}
 result.userData.kind=group.userData.kind;return result;
}
export function makeModel(kind,accent='#90b895'){
 const key=kind+accent;if(models.has(key))return models.get(key).clone(true);
 const g=new T.Group();g.userData.kind=kind;const brown='#9e6744',cream='#fff3d5',green='#80ab59';
 if(kind==='goose'||kind==='duck'){
  const goose=kind==='goose',white=goose?'#fff9e9':'#f6d363';
  ball(g,white,[.48,.34,.32],[.09,-.06,0]);ball(g,goose?'#f0eada':'#edd05f',[.34,.19,.08],[.11,.02,.28]);
  if(goose)tube(g,white,[.15,.48,.15],[-.25,.29,0],[0,0,-.2]);
  ball(g,white,[.25,.25,.24],[-.28,goose?.59:.32,0]);
  part(g,cylinder(0,1),'#efa343',[.17,.3,.11],[-.58,goose?.55:.28,0],[0,0,Math.PI/2]);
  for(const z of [-.205,.205]){ball(g,'#464c4a',[.037,.041,.024],[-.39,goose?.66:.39,z]);ball(g,'#ffffff',[.012,.012,.012],[-.398,goose?.68:.41,z]);ball(g,'#e9a54a',[.17,.055,.13],[.02,-.36,z]);}
  part(g,cylinder(0,1),white,[.17,.26,.17],[.56,.02,0],[0,0,-Math.PI/2]);
  if(goose){part(g,torus(.155,.04),accent,[1,1,1],[-.255,.36,0],[Math.PI/2,0,.2]);part(g,box(),accent,[.12,.22,.04],[-.23,.23,.16],[0,0,-.18]);}
 }else if(kind==='apple'){
  ball(g,'#ec666d',[.39,.38,.36],[0,0,0]);ball(g,'#f48688',[.21,.31,.26],[-.18,.01,.04]);tube(g,brown,[.045,.19,.045],[0,.4,0],[0,0,-.2]);leaf(g,[.13,.43,0],-1.1);
 }else if(kind==='orange'){
  ball(g,'#ffa83f',[.4,.39,.4],[0,0,0]);tube(g,brown,[.035,.09,.035],[0,.41,0]);leaf(g,[.13,.43,0],-1.2);
 }else if(kind==='carrot'){
  part(g,cylinder(1,.04),'#f79542',[.24,.92,.24],[0,-.08,0],[0,0,-.2]);for(const[a,x]of[[-.45,-.08],[0,0],[.45,.08]])leaf(g,[x,.46,0],a);
  for(let i=0;i<3;i++)part(g,box(),'#d97630',[.16-i*.025,.022,.018],[.06,-.14+i*.21,.205],[0,0,-.2]);
 }else if(kind==='corn'){
  ball(g,'#f5ce50',[.27,.5,.26],[0,0,0]);for(const x of [-.2,.2])part(g,sphere(),green,[.12,.45,.11],[x,-.15,.04],[0,0,x]);for(let y=-.28;y<.4;y+=.18)for(const x of [-.12,.12])ball(g,'#ffe38a',[.065,.062,.042],[x,y,.23]);
 }else if(kind==='pumpkin'){
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ball(g,i%2?'#ee9c48':'#e98938',[.24,.34,.24],[Math.cos(a)*.22,0,Math.sin(a)*.22]);}tube(g,green,[.065,.18,.065],[0,.39,0],[0,0,.2]);
 }else if(kind==='mushroom'){
  tube(g,cream,[.14,.45,.14],[0,-.12,0]);part(g,geo('cap',()=>new T.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI/2)),'#df6d61',[.45,.29,.45],[0,.13,0]);tube(g,'#f9dfb5',[.43,.03,.43],[0,.13,0]);for(const[x,z]of[[0,.25],[-.24,-.07],[.19,-.14]])ball(g,cream,[.067,.03,.067],[x,.37,z]);
 }else if(kind==='bread'){
  part(g,box(),'#ce965c',[.74,.67,.32],[0,-.06,0]);ball(g,'#ce965c',[.43,.29,.17],[0,.26,0]);part(g,box(),cream,[.6,.56,.035],[0,-.03,.174]);ball(g,cream,[.33,.2,.023],[0,.24,.178]);for(const[x,y]of[[-.13,.15],[.13,-.05],[-.12,-.17]])ball(g,'#ecd7ad',[.032,.032,.012],[x,y,.2]);
 }else if(kind==='donut'){
  part(g,torus(.29,.15),'#c59160',[1,1,1],[0,0,0],[Math.PI/2,0,0]);part(g,torus(.29,.11),'#ed94b2',[1,1,1],[0,.095,0],[Math.PI/2,0,0]);for(let i=0;i<7;i++){const a=i*.91;part(g,box(),['#fff2d6','#a8c8a5','#a999db'][i%3],[.075,.028,.025],[Math.cos(a)*.3,.2,Math.sin(a)*.3],[0,a,0]);}
 }else if(kind==='cup'){
  tube(g,'#9bc7bf',[.33,.46,.33],[0,-.06,0]);part(g,torus(.285,.05),'#d8ebe1',[1,1,1],[0,.18,0],[Math.PI/2,0,0]);tube(g,'#a67954',[.25,.012,.25],[0,.18,0]);part(g,torus(.18,.065),'#9bc7bf',[1,1,1],[.38,-.04,0],[0,Math.PI/2,0]);
 }else if(kind==='bottle'){
  tube(g,'#94cdd9',[.24,.59,.24],[0,-.03,0]);ball(g,'#94cdd9',[.24,.16,.24],[0,.25,0]);tube(g,'#b5dfe3',[.12,.21,.12],[0,.4,0]);tube(g,'#efbb69',[.15,.1,.15],[0,.52,0]);part(g,box(),'#fff5db',[.31,.22,.022],[0,-.03,.235]);part(g,box(),'#89b2a5',[.15,.04,.024],[0,-.03,.249]);
 }else if(kind==='fish'){
  ball(g,'#80b8d0',[.44,.27,.21],[0,0,0]);part(g,cylinder(0,1),'#609bb8',[.24,.3,.18],[.49,0,0],[0,0,-Math.PI/2]);part(g,cylinder(0,1),'#9acbdc',[.15,.2,.06],[.01,.3,0]);for(const z of [-.19,.19])ball(g,'#414e55',[.041,.041,.017],[-.24,.08,z]);
 }else if(kind==='strawberry'){
  part(g,cylinder(1,.18),'#e77082',[.35,.56,.34],[0,-.05,0]);ball(g,'#e77082',[.35,.14,.34],[0,.23,0]);for(let i=0;i<5;i++){const a=i*1.25;leaf(g,[Math.cos(a)*.13,.32,Math.sin(a)*.13],Math.cos(a)*.7);}for(const[x,y]of[[-.13,.15],[.13,.03],[0,-.15]])ball(g,cream,[.023,.037,.012],[x,y,.3-Math.abs(y)*.3]);
 }else if(kind==='egg'){
  ball(g,'#faf1da',[.29,.4,.29],[0,0,0]);
 }else if(kind==='candy'){
  tube(g,'#b69cdb',[.24,.52,.24],[0,0,0],[0,0,Math.PI/2]);for(const x of [-.38,.38])part(g,cylinder(1,.2),'#e3d2ee',[.23,.25,.23],[x,0,0],[0,0,x<0?-Math.PI/2:Math.PI/2]);part(g,box(),'#fff1d4',[.095,.44,.04],[0,0,.24]);
 }else if(kind==='peas'){
  ball(g,green,[.54,.2,.2],[0,0,0]);for(const x of [-.25,0,.25])ball(g,'#b8d783',[.16,.16,.16],[x,.12,.08]);
 }else if(kind==='soap'){
  part(g,box(),'#b79dcf',[.69,.25,.44],[0,0,0]);ball(g,'#b79dcf',[.37,.13,.25],[0,.01,0]);part(g,box(),'#e1cfe9',[.26,.018,.14],[0,.15,0]);
 }
 const model=compact(g);models.set(key,model);return model.clone(true);
}
export function makeBowl(accent){
 const g=new T.Group();part(g,cylinder(),'#f0dbc0',[3.48,.12,3.48],[0,-.16,0]);
 part(g,geo('bowl-wall',()=>new T.CylinderGeometry(3.68,3.42,.72,64,1,true)),accent,[1,1,1],[0,.2,0]);g.children.at(-1).material=mat(accent).clone();g.children.at(-1).material.side=T.DoubleSide;
 part(g,torus(3.67,.13),accent,[1,1,1],[0,.57,0],[Math.PI/2,0,0]);
 part(g,torus(3.42,.08),'#fff7dd',[1,1,1],[0,-.08,0],[Math.PI/2,0,0]);
 for(const x of [-3.98,3.98])part(g,torus(.36,.1),accent,[1,1,.9],[x,.36,0],[Math.PI/2,0,0]);
 return g;
}
