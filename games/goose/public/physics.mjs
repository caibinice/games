import {rng} from './engine.mjs';

// Presentation only: changing these never changes item identities or inventory.
export const BIN=Object.freeze({innerHalf:2.88,outerHalf:3.15,floor:-6.05,rim:.62,depth:6.67});
export function binFor(count){const floor=count<=18?-1.55:count<110?-4.6:BIN.floor;return{...BIN,floor,depth:BIN.rim-floor};}
const scales={corn:1.7,carrot:1.7,skewer:1.65,sausage:1.72,steak:1.78,bread:1.75,banana:1.75,croissant:1.72,goose:1.72,duck:1.75};
export function modelScale(kind){return scales[kind]||1.72;}
// A deep rim must not hide the last few objects. Only tilt/focus the camera;
// never lift the floor, flatten the pile or mutate a saved physical pose.
export function cameraPose(total,remaining){const t=total<=18?0:Math.max(0,Math.min(1,(48-remaining)/42)),focus=.5*(1-t)+(binFor(total).floor+1.4)*t,tilt=total<=18?6.7:4.3;return{focus,y:focus+15.5,z:tilt*(1-t)+1.4*t};}
// Collision hulls are intentionally approximate. Their visual extremities must
// not poke through solid exterior walls below the lip, or become phantom picks.
export function pilePointVisible(p){return p.y>=BIN.rim+.035||Math.max(Math.abs(p.x),Math.abs(p.z))<=BIN.innerHalf+.035;}
export function spawnPoses(items,seed,shakes=0){
 const random=rng(seed+shakes*17),floor=binFor(items.length).floor;
 return items.map(item=>{const column=item.id%5,row=Math.floor(item.id/5)%5,layer=Math.floor(item.id/25);
  return[(column-2)*1.13+(random()-.5)*.14,floor+.9+layer*.93,(row-2)*1.13+(random()-.5)*.14,random()*Math.PI,random()*Math.PI*2,random()*Math.PI];});
}
export function shakePlan(seed,shakes,direction){
 const random=rng(seed+shakes*977),x=Number.isFinite(direction?.x)?direction.x:(random()>.5?1:-1),z=Number.isFinite(direction?.z)?direction.z:.5,
  length=Math.hypot(x,z)||1,dx=x/length,dz=z/length;
 return [0,190,410].map((at,phase)=>({at,impulses:()=>({x:dx*(phase===1?-3.3:phase===0?5:1.5)+(random()-.5)*2,z:dz*(phase===1?-3.3:phase===0?5:1.5)+(random()-.5)*2,y:phase===0?8.8+random()*2.2:phase===1?2.5:1.1,rx:(random()-.5)*22,ry:(random()-.5)*18,rz:(random()-.5)*22})}));
}
