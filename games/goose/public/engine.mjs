import {level,ITEMS} from './catalog.mjs';
export const CAPACITY=7,RESERVE=3;
export function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
export function makeItems(id,seed){const random=rng(seed),kinds=[];for(const[k,n]of Object.entries(level(id).counts))for(let i=0;i<n;i++)kinds.push(k);for(let i=kinds.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[kinds[i],kinds[j]]=[kinds[j],kinds[i]];}return kinds.map((kind,id)=>({id,kind,status:0}));}
export function newGame(id=1,seed=Date.now()>>>0){const l=level(id);return{v:1,level:id,seed:seed>>>0,items:makeItems(id,seed),tray:[],reserve:[],status:'playing',remaining:l.seconds,elapsed:0,moves:0,matches:0,shakes:0,extensions:0,history:[],poses:null};}
function capture(g){return{states:g.items.map(i=>i.status),tray:[...g.tray],reserve:[...g.reserve],status:g.status,moves:g.moves,matches:g.matches};}
function remember(g){g.history.push(capture(g));if(g.history.length>20)g.history.shift();}
export function remainingCount(g){return g.items.filter(i=>i.status!==3).length;}
export function inventoryValid(g){
 if(!g||!Number.isInteger(g.level)||!Number.isInteger(g.seed))return false;
 let expected;try{expected=makeItems(g.level,g.seed);}catch{return false;}
 if(g.items.length!==expected.length||g.tray.length>CAPACITY||g.reserve.length>RESERVE||new Set([...g.tray,...g.reserve]).size!==g.tray.length+g.reserve.length)return false;
 for(let i=0;i<expected.length;i++){const item=g.items[i];if(item.id!==i||item.kind!==expected[i].kind||![0,1,2,3].includes(item.status))return false;if((item.status===1)!==g.tray.includes(i)||(item.status===2)!==g.reserve.includes(i))return false;}
 for(const kind of Object.keys(level(g.level).counts))if(g.items.filter(i=>i.kind===kind&&i.status===3).length%3)return false;
 return g.tray.every(i=>g.items[i]?.status===1)&&g.reserve.every(i=>g.items[i]?.status===2);
}
function grouped(g){g.tray.sort((a,b)=>Object.keys(ITEMS).indexOf(g.items[a].kind)-Object.keys(ITEMS).indexOf(g.items[b].kind));}
function settle(g){
 const removed=[];for(const kind of Object.keys(ITEMS)){const ids=g.tray.filter(id=>g.items[id].kind===kind);if(ids.length>=3){for(const id of ids.slice(0,3)){g.items[id].status=3;removed.push(id);}g.tray=g.tray.filter(id=>!removed.includes(id));g.matches++;}}
 grouped(g);g.status=remainingCount(g)===0?'won':g.tray.length===CAPACITY?'full':'playing';return removed;
}
export function pick(g,id){if(g.status!=='playing'||g.tray.length>=CAPACITY||!Number.isInteger(id)||!g.items[id]||![0,2].includes(g.items[id].status))return{ok:false,removed:[]};remember(g);g.items[id].status=1;g.reserve=g.reserve.filter(i=>i!==id);g.tray.push(id);g.moves++;return{ok:true,removed:settle(g)};}
export function undo(g){if(!g.history.length||g.status==='won'||g.status==='timeout')return false;const s=g.history.pop();for(let i=0;i<g.items.length;i++)g.items[i].status=s.states[i];Object.assign(g,{tray:s.tray,reserve:s.reserve,status:s.status,moves:s.moves,matches:s.matches,poses:null});return true;}
export function moveOut(g){if(!['playing','full'].includes(g.status))return 0;const amount=Math.min(RESERVE-g.reserve.length,g.tray.length);if(!amount)return 0;remember(g);const ids=g.tray.splice(0,amount);for(const id of ids){g.items[id].status=2;g.reserve.push(id);}g.status='playing';g.moves++;return amount;}
export function magnet(g){if(!['playing','full'].includes(g.status))return[];const kinds=Object.keys(ITEMS).filter(k=>g.items.filter(i=>i.kind===k&&i.status!==3).length>=3).sort((a,b)=>g.tray.filter(id=>g.items[id].kind===b).length-g.tray.filter(id=>g.items[id].kind===a).length);if(!kinds.length)return[];remember(g);const ids=g.items.filter(i=>i.kind===kinds[0]&&i.status!==3).sort((a,b)=>(a.status===1?-1:0)-(b.status===1?-1:0)).slice(0,3).map(i=>i.id);for(const id of ids)g.items[id].status=3;g.tray=g.tray.filter(id=>!ids.includes(id));g.reserve=g.reserve.filter(id=>!ids.includes(id));g.matches++;g.moves++;settle(g);return ids;}
export function revive(g){if(g.status!=='full')return false;remember(g);for(const id of g.tray.splice(0,Math.min(3,g.tray.length)))g.items[id].status=0;g.status='playing';g.poses=null;return true;}
export function shake(g){if(g.status!=='playing')return false;g.shakes++;g.poses=null;return true;}
export function tick(g,seconds){if(g.status!=='playing'||!Number.isFinite(seconds)||seconds<=0)return false;const d=Math.min(seconds,g.remaining);g.remaining=Math.max(0,g.remaining-d);g.elapsed+=d;if(g.remaining<=0)g.status='timeout';return true;}
export function extend(g){if(g.status==='won')return false;g.remaining+=180;g.extensions++;if(g.status==='timeout')g.status=g.tray.length===CAPACITY?'full':'playing';return true;}
export function packPoses(poses){if(!Array.isArray(poses))return null;const rows=poses.filter(row=>Array.isArray(row)&&row.length===7&&row.every(Number.isFinite)&&row[0]>=0&&row[0]<108);const bytes=[];for(const[id,x,y,z,rx,ry,rz]of rows)bytes.push(id,...[x,y,z,rx,ry,rz].map((n,i)=>Math.max(-127,Math.min(127,Math.round(n*(i<3?16:32))))+128));return btoa(String.fromCharCode(...bytes));}
export function unpackPoses(text){try{const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(bytes.length%7||bytes.length>108*7)return null;const rows=[];for(let i=0;i<bytes.length;i+=7)rows.push([bytes[i],...Array.from(bytes.slice(i+1,i+7),(n,j)=>(n-128)/(j<3?16:32))]);if(new Set(rows.map(r=>r[0])).size!==rows.length)return null;return rows;}catch{return null;}}
export function serialize(g){return JSON.stringify({v:1,l:g.level,s:g.seed,a:g.items.map(i=>i.status).join(''),t:g.tray,b:g.reserve,r:Math.round(g.remaining*10)/10,e:Math.round(g.elapsed*10)/10,m:g.moves,c:g.matches,h:g.shakes,x:g.extensions,q:g.status,p:packPoses(g.poses)});}
export function restore(raw){try{const s=JSON.parse(raw);if(s.v!==1||!Number.isInteger(s.s)||s.s<0||s.s>4294967295||!Number.isFinite(s.r)||s.r<0||!Number.isFinite(s.e)||s.e<0||!Array.isArray(s.t)||!Array.isArray(s.b))return null;const g=newGame(s.l,s.s);if(typeof s.a!=='string'||s.a.length!==g.items.length||!/^[0123]+$/.test(s.a))return null;g.items.forEach((i,n)=>i.status=+s.a[n]);g.tray=s.t;g.reserve=s.b;g.remaining=s.r;g.elapsed=s.e;for(const[field,key]of[['moves','m'],['matches','c'],['shakes','h'],['extensions','x']]){if(!Number.isInteger(s[key])||s[key]<0)return null;g[field]=s[key];}if(!inventoryValid(g))return null;g.status=remainingCount(g)===0?'won':g.remaining===0?'timeout':g.tray.length===CAPACITY?'full':'playing';g.poses=unpackPoses(s.p);return g;}catch{return null;}}
