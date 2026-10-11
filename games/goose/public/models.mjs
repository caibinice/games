import * as T from './vendor/three.module.js';
import {BIN,binFor} from './physics.mjs';
const mats=new Map(),geos=new Map(),models=new Map(),textures=new Map();
// Small deterministic PBR maps are generated locally, not fetched from a CDN.
function surfaceTexture(style,bump=false){
 const key=style+':'+bump;if(textures.has(key))return textures.get(key);const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const hash=((x*374761393+y*668265263)^(x*y*1274126177))>>>0,n=(hash%1000)/1000,u=x/size,v=y/size;
  let light=.9+n*.1;
  if(style==='peel'||style==='skin')light=.82+n*.18+(style==='skin'?Math.sin(u*65+v*8)*.035:0);
  if(style==='baked')light=.62+n*.33-Math.max(0,Math.sin(u*21+v*13)*Math.cos(v*27-u*9))*.1;
  if(style==='meat')light=.55+n*.25+Math.pow(Math.max(0,Math.sin(u*30+Math.sin(v*19)*3)),14)*.2;
  if(style==='wood')light=.65+n*.08+Math.sin(u*50+Math.sin(v*8)*2)*.1;
  if(style==='leaf')light=.78+n*.12+Math.sin(u*90)*.06;
  const val=Math.max(0,Math.min(255,Math.round(light*255))),i=(y*size+x)*4;data.set([val,val,val,255],i);
 }
 const tex=new T.DataTexture(data,size,size,T.RGBAFormat);tex.colorSpace=bump?T.NoColorSpace:T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;textures.set(key,tex);return tex;
}
function mat(color,metal=0,style='plain'){
 if(color?.isMaterial)return color;const key=color+':'+metal+':'+style;
 if(!mats.has(key)){const roughness={skin:.3,peel:.58,baked:.82,meat:.37,wood:.75,leaf:.65,ceramic:.18,plastic:.23,metal:.27,plain:.48}[style];
  const m=new T.MeshStandardMaterial({color,roughness,metalness:metal,envMapIntensity:.65});m.userData.surface=style;
  if(['skin','peel','baked','meat','wood','leaf'].includes(style)){m.map=surfaceTexture(style);m.bumpMap=surfaceTexture(style,true);m.bumpScale=style==='peel'?.035:style==='baked'?.025:.012;}mats.set(key,m);
 }return mats.get(key);
}
const finish=(color,style,metal=0)=>mat(color,metal,style);
export function makeEnvironment(){
 if(textures.has('studio'))return textures.get('studio');const w=256,h=128,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,softbox=Math.exp(-((u-.22)**2/.007+(v-.3)**2/.018))*.45+Math.exp(-((u-.72)**2/.006+(v-.38)**2/.04))*.3,l=.18+.38*(1-v)+softbox,i=(y*w+x)*4;data.set([l*255,l*253,l*247,255],i);}
 const tex=new T.DataTexture(data,w,h);tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.LinearSRGBColorSpace;tex.needsUpdate=true;textures.set('studio',tex);return tex;
}
function geo(key,create){if(!geos.has(key))geos.set(key,create());return geos.get(key);}
const sphere=()=>geo('sphere',()=>new T.SphereGeometry(1,18,12));
const box=()=>geo('box',()=>new T.BoxGeometry(1,1,1));
function cylinder(top=1,bottom=1){return geo('cylinder'+top+bottom,()=>new T.CylinderGeometry(top,bottom,1,14));}
function torus(radius,tube){return geo('torus'+radius+tube,()=>new T.TorusGeometry(radius,tube,8,24));}
function part(group,geometry,color,scale,pos,rotation=[0,0,0],metal=0){const mesh=new T.Mesh(geometry,mat(color,metal));mesh.scale.set(...scale);mesh.position.set(...pos);mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
function ball(g,c,s,p){return part(g,sphere(),c,s,p);}
function tube(g,c,s,p,r=[0,0,0]){return part(g,cylinder(),c,s,p,r);}
function leaf(g,p,rot=0,color='#527d37'){return part(g,geo('leaf',()=>{const s=new T.Shape();s.moveTo(0,-.5);s.quadraticCurveTo(-.32,-.05,0,.5);s.quadraticCurveTo(.3,.02,0,-.5);return new T.ExtrudeGeometry(s,{depth:.024,bevelEnabled:false,curveSegments:5});}),finish(color,'leaf'),[.65,.68,1],p,[.3,.2,rot]);}
function lathe(name,profile){return geo(name,()=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),20));}
function roundedBox(){return geo('rounded-box',()=>{const s=new T.Shape(),r=.13;s.moveTo(-.5+r,-.5);s.lineTo(.5-r,-.5);s.quadraticCurveTo(.5,-.5,.5,-.5+r);s.lineTo(.5,.5-r);s.quadraticCurveTo(.5,.5,.5-r,.5);s.lineTo(-.5+r,.5);s.quadraticCurveTo(-.5,.5,-.5,.5-r);s.lineTo(-.5,-.5+r);s.quadraticCurveTo(-.5,-.5,-.5+r,-.5);const g=new T.ExtrudeGeometry(s,{depth:.8,bevelEnabled:true,bevelThickness:.1,bevelSize:.055,bevelSegments:2,curveSegments:4});g.translate(0,0,-.4);return g;});}
function curvedTube(name,points,radius,taper=true){return geo(name,()=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,18,radius,10,false),pos=g.attributes.position;
  if(taper)for(let i=0;i<pos.count;i++){const t=Math.floor(i/11)/18,c=curve.getPointAt(t),f=.25+.75*Math.sin(Math.PI*t)**.4;pos.setXYZ(i,c.x+(pos.getX(i)-c.x)*f,c.y+(pos.getY(i)-c.y)*f,c.z+(pos.getZ(i)-c.z)*f);}g.computeVertexNormals();return g;});}
// Bake each original model into shared, material-grouped geometry. Repeated items
// can then be rendered as instances rather than hundreds of separate primitives.
function compact(group){
 group.updateMatrixWorld(true);const buckets=new Map(),result=new T.Group();
 for(const mesh of group.children){const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),flat=geometry.index?geometry.toNonIndexed():geometry;
  if(flat!==geometry)geometry.dispose();if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);buckets.get(mesh.material).push(flat);}
 for(const[material,parts]of buckets){const geometry=new T.BufferGeometry();for(const name of ['position','normal','uv']){const components=name==='uv'?2:3,length=parts.reduce((n,p)=>n+p.getAttribute('position').count*components,0),data=new Float32Array(length);let offset=0;for(const p of parts){const a=p.getAttribute(name)?.array||new Float32Array(p.getAttribute('position').count*components);data.set(a,offset);offset+=a.length;}geometry.setAttribute(name,new T.BufferAttribute(data,components));}
  for(const p of parts)p.dispose();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;result.add(mesh);}
 result.userData.kind=group.userData.kind;return result;
}
export function makeModel(kind,accent='#90b895'){
 const key=kind+accent;if(models.has(key))return models.get(key).clone(true);
 const g=new T.Group();g.userData.kind=kind;const brown=finish('#855634','wood'),cream=finish('#f4dfaf','baked'),green=finish('#598138','leaf');
 if(kind==='goose'||kind==='duck'){
  const goose=kind==='goose',white=finish(goose?'#f5f3e9':'#edb632',goose?'plain':'plastic');
  ball(g,white,[.61,.3,.32],[.13,-.06,0]);
  for(const side of [-1,1]){ball(g,white,[.42,.2,.08],[.13,-.015,side*.29]);for(let i=0;i<3;i++)part(g,sphere(),goose?'#d8d6ca':'#c99129',[.28,.018,.023],[.18-i*.03,-.025-i*.06,side*.355],[0,0,-.1]);}
  if(goose)part(g,curvedTube('goose-neck',[[-.23,.13,0],[-.37,.43,0],[-.43,.76,0],[-.39,.94,0]],.11,false),white,[1,1,1],[0,0,0]);
  const hx=goose?-.41:-.34,hy=goose?.98:.29;ball(g,white,[.205,.17,.18],[hx,hy,0]);
  part(g,roundedBox(),finish('#d88925','plastic'),[.29,.065,.13],[hx-.22,hy-.025,0],[0,0,.04]);
  for(const z of [-.162,.162]){ball(g,'#30352d',[.018,.02,.011],[hx-.065,hy+.045,z]);part(g,roundedBox(),'#bd792d',[.22,.035,.19],[.04,-.34,z],[0,0,.08]);}
  part(g,cylinder(0,1),white,[.17,.27,.16],[.73,-.005,0],[0,0,-Math.PI/2]);
 }else if(kind==='apple'){
  part(g,lathe('apple-body',[[0,-.46],[.18,-.43],[.36,-.34],[.47,-.12],[.47,.14],[.37,.35],[.19,.4],[.045,.32],[0,.32]]),finish('#c8352b','skin'),[1,1,1],[0,0,0]);tube(g,brown,[.038,.23,.038],[0,.46,0],[0,0,-.15]);leaf(g,[.14,.53,0],-1.1);
 }else if(kind==='orange'){
  ball(g,finish('#ef8f19','peel'),[.47,.45,.47],[0,0,0]);tube(g,green,[.045,.035,.045],[0,.45,0]);leaf(g,[.13,.49,0],-1.2);
 }else if(kind==='carrot'){
  part(g,lathe('carrot-root',[[0,-.92],[.04,-.85],[.1,-.56],[.17,-.22],[.24,.22],[.25,.43],[.16,.53],[0,.55]]),finish('#e67317','skin'),[1,1,1],[0,-.03,0]);
  for(let i=0;i<5;i++)leaf(g,[(i-2)*.055,.73,(i%2)*.05],(i-2)*.32);for(let i=0;i<5;i++)part(g,torus(.21-i*.026,.009),'#bf671d',[1,1,1],[0,.3-i*.2,0],[Math.PI/2,0,0]);
 }else if(kind==='corn'){
  part(g,lathe('corn-core',[[0,-.85],[.12,-.8],[.21,-.62],[.24,-.2],[.24,.28],[.2,.68],[.1,.81],[0,.85]]),finish('#cd9b24','baked'),[1,1,1],[0,0,0]);
  const kernel=geo('corn-kernel',()=>new T.SphereGeometry(1,7,5));for(let row=0;row<11;row++){const y=-.69+row*.135,r=.2+.055*Math.sin((row+.5)/11*Math.PI);for(let n=0;n<11;n++){const a=(n+(row%2)*.15)*Math.PI*2/11;part(g,kernel,finish(n%3?'#edb82a':'#f4ce51','skin'),[.064,.062,.075],[Math.cos(a)*r,y,Math.sin(a)*r],[0,-a,0]);}}
  tube(g,finish('#bdaf7b','wood'),[.095,.17,.095],[0,-.9,0]);
 }else if(kind==='pumpkin'){
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ball(g,i%2?'#ee9c48':'#e98938',[.24,.34,.24],[Math.cos(a)*.22,0,Math.sin(a)*.22]);}tube(g,green,[.065,.18,.065],[0,.39,0],[0,0,.2]);
 }else if(kind==='mushroom'){
  tube(g,cream,[.14,.45,.14],[0,-.12,0]);part(g,geo('cap',()=>new T.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI/2)),'#df6d61',[.45,.29,.45],[0,.13,0]);tube(g,'#f9dfb5',[.43,.03,.43],[0,.13,0]);for(const[x,z]of[[0,.25],[-.24,-.07],[.19,-.14]])ball(g,cream,[.067,.03,.067],[x,.37,z]);
 }else if(kind==='bread'){
  const toast=geo('toast',()=>{const s=new T.Shape();s.moveTo(-.52,-.5);s.lineTo(.52,-.5);s.lineTo(.52,.22);s.bezierCurveTo(.72,.68,-.72,.68,-.52,.22);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.23,bevelEnabled:true,bevelThickness:.04,bevelSize:.045,bevelSegments:2,curveSegments:8});g.translate(0,0,-.115);return g;});
  part(g,toast,finish('#a76b2e','baked'),[1,1,1],[0,0,0]);for(const z of [-.164,.164])part(g,toast,finish('#efc989','baked'),[.85,.88,.075],[0,.005,z]);
 }else if(kind==='donut'){
  part(g,torus(.29,.15),'#c59160',[1,1,1],[0,0,0],[Math.PI/2,0,0]);part(g,torus(.29,.11),'#ed94b2',[1,1,1],[0,.095,0],[Math.PI/2,0,0]);for(let i=0;i<7;i++){const a=i*.91;part(g,box(),['#fff2d6','#a8c8a5','#a999db'][i%3],[.075,.028,.025],[Math.cos(a)*.3,.2,Math.sin(a)*.3],[0,a,0]);}
 }else if(kind==='cup'){
  part(g,lathe('cup-body',[[.22,-.34],[.32,-.31],[.36,.3],[.34,.34],[.3,.34],[.28,-.23],[0,-.24]]),finish('#e9e3d1','ceramic'),[1,1,1],[0,0,0]);tube(g,finish('#693e20','plain'),[.29,.012,.29],[0,.17,0]);part(g,torus(.22,.058),finish('#e9e3d1','ceramic'),[1,1,1],[.4,.02,0],[0,Math.PI/2,0]);
 }else if(kind==='bottle'){
  part(g,lathe('bottle-body',[[0,-.7],[.2,-.7],[.27,-.62],[.27,.22],[.24,.34],[.12,.48],[.12,.71],[0,.72]]),finish('#679c89','plastic'),[1,1,1],[0,0,0]);tube(g,finish('#f4ebca','plain'),[.273,.38,.273],[0,-.15,0]);tube(g,finish('#c47730','metal',.45),[.135,.14,.135],[0,.7,0]);for(const y of [-.29,-.02])part(g,torus(.275,.016),'#b49b61',[1,1,1],[0,y,0],[Math.PI/2,0,0]);
 }else if(kind==='fish'){
  ball(g,finish('#748e8c','skin',.16),[.68,.25,.16],[0,0,0]);ball(g,finish('#c8cdc0','skin',.12),[.53,.11,.13],[-.02,-.12,0]);
  const fin=geo('fish-fin',()=>{const s=new T.Shape();s.moveTo(0,0);s.lineTo(.34,.25);s.lineTo(.28,0);s.lineTo(.34,-.25);s.closePath();return new T.ExtrudeGeometry(s,{depth:.035,bevelEnabled:false});});
  part(g,fin,finish('#657b76','skin'),[1,1,1],[.58,0,-.018]);part(g,fin,finish('#778b7b','skin'),[.5,.65,1],[-.14,.2,0],[0,0,Math.PI/2]);
  for(const z of [-.154,.154]){ball(g,'#d7c787',[.04,.04,.008],[-.43,.065,z]);ball(g,'#262e2e',[.021,.021,.01],[-.43,.065,z*1.02]);for(let i=0;i<4;i++)part(g,torus(.13,.008),'#657d78',[.6,1,1],[-.27+i*.14,0,z*.8],[0,Math.PI/2,.08]);}
 }else if(kind==='strawberry'){
  part(g,lathe('berry',[[0,-.5],[.07,-.45],[.19,-.3],[.31,-.06],[.36,.16],[.3,.28],[.12,.29],[0,.26]]),finish('#c93e35','skin'),[1,1,1],[0,0,0]);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;leaf(g,[Math.cos(a)*.13,.3,Math.sin(a)*.13],a-.8);}
  for(let row=0;row<4;row++){const y=-.31+row*.15,r=[.18,.26,.32,.34][row];for(let i=0;i<9;i++){const a=(i+(row%2)*.5)*Math.PI*2/9;part(g,sphere(),finish('#d8b677','plain'),[.012,.024,.01],[Math.cos(a)*r,y,Math.sin(a)*r],[0,-a,0]);}}
 }else if(kind==='egg'){
  ball(g,'#faf1da',[.29,.4,.29],[0,0,0]);
 }else if(kind==='candy'){
  tube(g,'#b69cdb',[.24,.52,.24],[0,0,0],[0,0,Math.PI/2]);for(const x of [-.38,.38])part(g,cylinder(1,.2),'#e3d2ee',[.23,.25,.23],[x,0,0],[0,0,x<0?-Math.PI/2:Math.PI/2]);part(g,box(),'#fff1d4',[.095,.44,.04],[0,0,.24]);
 }else if(kind==='peas'){
  ball(g,green,[.54,.2,.2],[0,0,0]);for(const x of [-.25,0,.25])ball(g,'#b8d783',[.16,.16,.16],[x,.12,.08]);
 }else if(kind==='skewer'){
  tube(g,brown,[.028,2.1,.028],[0,0,0]);for(let i=0;i<5;i++)part(g,roundedBox(),finish(i%2?'#689039':'#b46132',i%2?'leaf':'meat'),[.43,.28,.39],[0,-.56+i*.3,0],[.07*i,.15*i,.1]);
 }else if(kind==='sausage'){
  part(g,curvedTube('sausage',[[-.04,-.8,0],[.03,-.43,0],[.09,.12,0],[.02,.8,0]],.2,false),finish('#b54c28','meat'),[1,1,1],[0,0,0]);for(const y of [-.8,.8])ball(g,finish('#b54c28','meat'),[.2,.2,.2],[y>0?.02:-.04,y,0]);for(let i=0;i<4;i++)part(g,roundedBox(),'#7f4325',[.24,.018,.018],[.035,-.44+i*.27,.193],[0,0,.45]);
 }else if(kind==='steak'){
  const slab=geo('steak',()=>{const s=new T.Shape();s.moveTo(-.73,-.24);s.bezierCurveTo(-.81,.38,-.35,.53,.27,.46);s.bezierCurveTo(.65,.46,.81,.2,.64,-.28);s.bezierCurveTo(.31,-.6,-.48,-.63,-.73,-.24);const g=new T.ExtrudeGeometry(s,{depth:.2,bevelEnabled:true,bevelSize:.045,bevelThickness:.045,bevelSegments:2,curveSegments:8});g.translate(0,0,-.1);return g;});
  part(g,slab,finish('#ba7652','meat'),[1,1,1],[0,0,0]);for(const z of [-.16,.16]){part(g,slab,finish('#e9c4a0','meat'),[.93,.91,.08],[0,0,z]);part(g,slab,finish('#935039','meat'),[.84,.8,.09],[0,0,z*1.06]);for(let i=0;i<4;i++)part(g,roundedBox(),'#6d492a',[.9,.02,.017],[0,-.27+i*.18,z*1.2],[0,0,.4]);}
 }else if(kind==='eggplant'){
  part(g,lathe('aubergine',[[0,-.73],[.22,-.64],[.29,-.38],[.26,.1],[.18,.49],[.09,.63],[0,.63]]),finish('#695880','skin'),[1,1,1],[0,0,0]);tube(g,green,[.07,.21,.07],[0,.71,0],[0,0,-.3]);for(let i=0;i<3;i++)leaf(g,[(i-1)*.08,.55,0],(i-1)*.65);
 }else if(kind==='pepper'){
  for(let i=0;i<4;i++){const a=i*Math.PI/2;ball(g,'#91b75c',[.23,.36,.23],[Math.cos(a)*.15,0,Math.sin(a)*.15]);}tube(g,'#678c4d',[.065,.2,.065],[0,.42,0],[0,0,.2]);
 }else if(kind==='banana'||kind==='croissant'){
  const banana=kind==='banana',shape=curvedTube(banana?'banana':'croissant',[[-.77,-.18,0],[-.46,.16,0],[0,.31,0],[.46,.16,0],[.77,-.18,0]],banana?.16:.25);
  part(g,shape,finish(banana?'#e2bc31':'#ad6729',banana?'peel':'baked'),[1,1,1],[0,0,0]);
  if(banana){for(const x of [-.78,.78])tube(g,brown,[.038,.13,.038],[x,-.18,0],[0,0,x>0?-.55:.55]);part(g,curvedTube('banana-ridge',[[-.72,-.16,.1],[-.35,.24,.13],[.35,.24,.13],[.72,-.16,.1]],.012,false),'#ba9629',[1,1,1],[0,0,0]);}
  else for(let i=0;i<7;i++){const a=(i-3)*.22;part(g,torus(.23,.028),finish('#d3964a','baked'),[1-Math.abs(a)*.6,1-Math.abs(a)*.6,.7],[Math.sin(a)*.85,Math.cos(a)*.59-.29,0],[0,Math.PI/2,0]);}
 }else if(kind==='watermelon'){
  const wedge=geo('melon-wedge',()=>{const s=new T.Shape();s.moveTo(0,.53);s.lineTo(-.67,-.33);s.quadraticCurveTo(0,-.74,.67,-.33);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.2,bevelEnabled:true,bevelSize:.018,bevelThickness:.02,bevelSegments:1,curveSegments:12});g.translate(0,0,-.1);return g;});
  part(g,wedge,finish('#3f7842','skin'),[1,1,1],[0,0,0]);for(const z of [-.13,.13]){part(g,wedge,'#ebd5a0',[.93,.94,.075],[0,.022,z]);part(g,wedge,finish('#ce443d','skin'),[.85,.84,.08],[0,.065,z*1.03]);for(const [x,y]of[[-.25,-.21],[.23,-.17],[0,.15],[0,-.34]])ball(g,'#48372c',[.018,.036,.009],[x,y,z*1.11]);}
 }else if(kind==='lemon'||kind==='pear'){
  if(kind==='lemon'){ball(g,finish('#dbb51c','peel'),[.38,.5,.36],[0,0,0]);for(const y of [-.48,.48])ball(g,finish('#dbb51c','peel'),[.08,.1,.08],[0,y,0]);}
  else{part(g,lathe('pear',[[0,-.48],[.2,-.45],[.4,-.25],[.4,-.02],[.29,.23],[.17,.51],[.12,.57],[0,.56]]),finish('#acaa45','skin'),[1,1,1],[0,0,0]);tube(g,brown,[.03,.2,.03],[0,.64,0]);leaf(g,[.12,.63,0],-1.1);}
 }else if(kind==='cookie'){
  tube(g,'#d5aa73',[.43,.18,.43],[0,0,0]);for(let i=0;i<6;i++){const a=i*2.4;ball(g,'#98734f',[.05,.025,.05],[Math.sin(a)*.29,.096,Math.cos(a)*.29]);}
 }else if(kind==='cake'){
  part(g,box(),'#fff0d6',[.65,.45,.45],[0,0,0]);for(const y of [-.12,.12])part(g,box(),'#eaa2bb',[.67,.05,.47],[0,y,0]);ball(g,'#ed8290',[.12,.15,.12],[0,.32,0]);
 }else if(kind==='popsicle'){
  part(g,box(),'#e3c9a4',[.13,.65,.055],[0,-.3,0]);part(g,box(),'#9eced3',[.49,.72,.22],[0,.14,0]);ball(g,'#9eced3',[.245,.2,.11],[0,.5,0]);part(g,box(),'#c6e6e3',[.045,.48,.02],[-.09,.16,.12]);
 }else if(kind==='toothbrush'){
  part(g,roundedBox(),finish('#348d8a','plastic'),[.11,1.65,.075],[0,-.2,0],[0,0,.05]);part(g,roundedBox(),finish('#348d8a','plastic'),[.28,.46,.12],[0,.82,0]);for(let y=0;y<5;y++)for(let x=0;x<3;x++)part(g,cylinder(),finish('#efefdf','plain'),[.019,.14,.019],[(x-1)*.066,.68+y*.066,.125],[Math.PI/2,0,0]);
 }else if(kind==='ball'){
  // Flush spherical panels, rather than blobs glued to a toy ball.
  ball(g,finish('#e7ded0','plastic'),[.45,.45,.45],[0,0,0]);const panel=geo('ball-panel',()=>new T.SphereGeometry(.454,16,8,0,Math.PI*2,0,.42));
  for(const direction of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]){const p=part(g,panel,finish('#42636c','plastic'),[1,1,1],[0,0,0]);p.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...direction));}
 }else if(kind==='shell'){
  const scallop=geo('scallop',()=>{const s=new T.Shape();s.moveTo(-.14,-.37);s.lineTo(-.24,-.32);s.lineTo(-.22,-.14);for(let i=0;i<=12;i++){const a=Math.PI-i*Math.PI/12,r=i%2?.49:.54;s.lineTo(Math.cos(a)*r,Math.sin(a)*r-.12);}s.lineTo(.22,-.14);s.lineTo(.24,-.32);s.lineTo(.14,-.37);s.closePath();return new T.ExtrudeGeometry(s,{depth:.08,bevelEnabled:true,bevelSize:.035,bevelThickness:.045,bevelSegments:2});});
  part(g,scallop,finish('#d4ad99','peel'),[1,1,1],[0,0,-.045]);for(let i=0;i<9;i++){const a=(i-4)*.2;part(g,roundedBox(),finish('#efd6c1','peel'),[.019,.51,.025],[Math.sin(a)*.19,.035, .087],[0,0,-a]);}
 }else if(kind==='soap'){
  part(g,roundedBox(),finish('#bcaf95','plain'),[.93,.28,.6],[0,0,0],[Math.PI/2,0,0]);part(g,roundedBox(),'#d9ccb6',[.32,.015,.16],[0,.17,0],[Math.PI/2,0,0]);
 }
 // Less toy-like surfaces on the remaining legacy families as well.
 const style={pumpkin:'skin',mushroom:'plain',donut:'baked',fish:'skin',strawberry:'skin',egg:'peel',candy:'plastic',peas:'skin',pepper:'skin',cookie:'baked',cake:'baked',popsicle:'plastic',ball:'plastic',shell:'plain'}[kind];
 if(style)for(const mesh of g.children)if(mesh.material.userData.surface==='plain')mesh.material=mat('#'+mesh.material.color.getHexString(),mesh.material.metalness,style);
 const model=compact(g);models.set(key,model);return model.clone(true);
}
// Deep rounded-square bin with a bevelled lip and a recessed patterned floor.
function roundedPath(path,half,r){path.moveTo(-half+r,-half);path.lineTo(half-r,-half);path.quadraticCurveTo(half,-half,half,-half+r);path.lineTo(half,half-r);path.quadraticCurveTo(half,half,half-r,half);path.lineTo(-half+r,half);path.quadraticCurveTo(-half,half,-half,half-r);path.lineTo(-half,-half+r);path.quadraticCurveTo(-half,-half,-half+r,-half);path.closePath();return path;}
function binRing(depth){return geo('bin-ring-'+depth,()=>{const shape=roundedPath(new T.Shape(),BIN.outerHalf,.22);shape.holes.push(roundedPath(new T.Path(),BIN.innerHalf,.15));return new T.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,curveSegments:5});});}
export function makeBowl(accent,count=123){
 const bin=binFor(count),key='bin:'+accent+':'+bin.floor;if(models.has(key))return models.get(key).clone(true);const g=new T.Group();part(g,box(),finish('#717879','metal',.42),[6.22,.18,6.22],[0,bin.floor-.12,0]);
 part(g,binRing(bin.depth),finish('#a1a9a8','metal',.38),[1,1,1],[0,BIN.rim,0],[Math.PI/2,0,0]);
 part(g,binRing(.12),finish('#d9dfd9','metal',.4),[1,1,1],[0,BIN.rim+.1,0],[Math.PI/2,0,0]);
 for(let i=-2.7;i<=2.7;i+=.45){part(g,box(),'#555f60',[.022,.025,5.7],[i,bin.floor+.018,0]);part(g,box(),'#555f60',[5.7,.025,.022],[0,bin.floor+.018,i]);}
 const model=compact(g);models.set(key,model);return model.clone(true);
}
