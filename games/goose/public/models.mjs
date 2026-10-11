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
 }else if(kind==='skewer'){
  tube(g,'#bc9566',[.035,1.7,.035],[0,0,0]);for(let i=0;i<4;i++){part(g,box(),i%2?'#a1b763':'#e69b68',[.37,.24,.32],[0,-.4+i*.29,0],[0,.15*i,.1]);}
 }else if(kind==='sausage'){
  tube(g,'#df8168',[.22,1,.22],[0,0,0]);for(const y of [-.5,.5])ball(g,'#df8168',[.22,.22,.22],[0,y,0]);for(let i=0;i<3;i++)part(g,box(),'#bc6558',[.28,.035,.035],[0,-.22+i*.22,.2],[0,0,.25]);
 }else if(kind==='steak'){
  ball(g,'#c68075',[.57,.15,.39],[0,0,0]);ball(g,'#ecc5a5',[.43,.035,.28],[0,.155,0]);ball(g,'#c47b70',[.38,.045,.24],[0,.18,0]);for(let i=0;i<3;i++)part(g,box(),'#a7645d',[.75,.018,.045],[0,.22,-.17+i*.17],[0,.35,0]);
 }else if(kind==='eggplant'){
  ball(g,'#9d85b6',[.24,.54,.23],[0,-.06,0]);tube(g,green,[.12,.18,.12],[0,.49,0],[0,0,-.3]);for(let i=0;i<3;i++)leaf(g,[(i-1)*.1,.4,0],(i-1)*.65);
 }else if(kind==='pepper'){
  for(let i=0;i<4;i++){const a=i*Math.PI/2;ball(g,'#91b75c',[.23,.36,.23],[Math.cos(a)*.15,0,Math.sin(a)*.15]);}tube(g,'#678c4d',[.065,.2,.065],[0,.42,0],[0,0,.2]);
 }else if(kind==='banana'||kind==='croissant'){
  const banana=kind==='banana',c=banana?'#f4d568':'#d9a36b';for(let i=0;i<6;i++){const a=-.85+i*.34;ball(g,c,[.16,.18,.17],[Math.sin(a)*.55,Math.cos(a)*.48-.32,0]);}for(const x of [-.46,.46])tube(g,banana?'#ae8d50':'#c38e57',[.07,.12,.07],[x,-.01,0],[0,0,x>0?-1:1]);
 }else if(kind==='watermelon'){
  part(g,cylinder(0,1),'#80b578',[.53,.8,.2],[0,0,0],[0,0,Math.PI]);part(g,cylinder(0,1),'#f09b9f',[.45,.69,.215],[0,.005,0],[0,0,Math.PI]);for(const x of [-.2,0,.2])ball(g,'#9a7272',[.026,.035,.014],[x,.07,.216]);
 }else if(kind==='lemon'||kind==='pear'){
  ball(g,kind==='lemon'?'#edd25d':'#bed171',[.35,.43,.33],[0,0,0]);if(kind==='lemon')for(const y of [-.4,.4])ball(g,'#edd25d',[.11,.12,.11],[0,y,0]);else{ball(g,'#bed171',[.22,.25,.22],[0,.3,0]);tube(g,brown,[.034,.16,.034],[0,.57,0]);leaf(g,[.13,.54,0],-1.1);}
 }else if(kind==='cookie'){
  tube(g,'#d5aa73',[.43,.18,.43],[0,0,0]);for(let i=0;i<6;i++){const a=i*2.4;ball(g,'#98734f',[.05,.025,.05],[Math.sin(a)*.29,.096,Math.cos(a)*.29]);}
 }else if(kind==='cake'){
  part(g,box(),'#fff0d6',[.65,.45,.45],[0,0,0]);for(const y of [-.12,.12])part(g,box(),'#eaa2bb',[.67,.05,.47],[0,y,0]);ball(g,'#ed8290',[.12,.15,.12],[0,.32,0]);
 }else if(kind==='popsicle'){
  part(g,box(),'#e3c9a4',[.13,.65,.055],[0,-.3,0]);part(g,box(),'#9eced3',[.49,.72,.22],[0,.14,0]);ball(g,'#9eced3',[.245,.2,.11],[0,.5,0]);part(g,box(),'#c6e6e3',[.045,.48,.02],[-.09,.16,.12]);
 }else if(kind==='toothbrush'){
  part(g,box(),'#9cc7c1',[.1,1.2,.09],[0,-.05,0]);part(g,box(),'#9cc7c1',[.23,.35,.15],[0,.61,0]);for(let i=0;i<4;i++)part(g,box(),cream,[.18,.055,.12],[0,.5+i*.08,.12]);
 }else if(kind==='ball'){
  ball(g,'#a9bedf',[.43,.43,.43],[0,0,0]);for(let i=0;i<5;i++){const a=i*1.25;ball(g,cream,[.17,.06,.17],[Math.sin(a)*.32,Math.cos(a)*.32,.23]);}
 }else if(kind==='shell'){
  for(let i=0;i<7;i++){const a=(i-3)*.22;ball(g,i%2?'#e9c5b9':'#f1dacf',[.085,.4,.18],[Math.sin(a)*.27,Math.cos(a)*.12,0]);}
 }else if(kind==='soap'){
  part(g,box(),'#b79dcf',[.69,.25,.44],[0,0,0]);ball(g,'#b79dcf',[.37,.13,.25],[0,.01,0]);part(g,box(),'#e1cfe9',[.26,.018,.14],[0,.15,0]);
 }
 const model=compact(g);models.set(key,model);return model.clone(true);
}
// Deep rounded-square bin with a bevelled lip and a recessed patterned floor.
function roundedPath(path,half,r){path.moveTo(-half+r,-half);path.lineTo(half-r,-half);path.quadraticCurveTo(half,-half,half,-half+r);path.lineTo(half,half-r);path.quadraticCurveTo(half,half,half-r,half);path.lineTo(-half+r,half);path.quadraticCurveTo(-half,half,-half,half-r);path.lineTo(-half,-half+r);path.quadraticCurveTo(-half,-half,-half+r,-half);path.closePath();return path;}
function binRing(depth){return geo('bin-ring-'+depth,()=>{const shape=roundedPath(new T.Shape(),3.46,.33);shape.holes.push(roundedPath(new T.Path(),3.19,.24));return new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:.055,bevelThickness:.055,bevelSegments:2,curveSegments:5});});}
export function makeBowl(accent){
 const key='bin:'+accent;if(models.has(key))return models.get(key).clone(true);const g=new T.Group();part(g,box(),'#b0b49c',[6.75,.2,6.75],[0,-3.6,0]);
 part(g,binRing(4.1),accent,[1,1,1],[0,.61,0],[Math.PI/2,0,0]);
 part(g,binRing(.14),'#f8edce',[1,1,1],[0,.77,0],[Math.PI/2,0,0]);
 for(let i=-3;i<=3;i++){part(g,box(),'#bdc3a8',[.025,.025,6.32],[i,-3.485,0]);part(g,box(),'#bdc3a8',[6.32,.025,.025],[0,-3.485,i]);}
 const model=compact(g);models.set(key,model);return model.clone(true);
}
