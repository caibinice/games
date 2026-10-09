// A local convenience entry, not a server authentication system.
import { TOTAL_LEVELS } from './artworks.mjs';
export function hiddenTapSequence(required=5,windowMs=2500){
  let first=null,count=0;
  return now=>{
    if(!Number.isFinite(now))return false;
    if(first===null||now<first||now-first>windowMs){first=now;count=0;}
    if(++count<required)return false;
    first=null;count=0;return true;
  };
}
export function jumpLevelId(raw){
  if(typeof raw!=='number'&&typeof raw!=='string')return null;
  const text=String(raw).trim();
  if(!/^\d{1,3}$/.test(text))return null;
  const id=Number(text);return id>=1&&id<=TOTAL_LEVELS?id:null;
}
