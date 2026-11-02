// A reproducible player strategy: no state edits, free currency or skipped waves.
import {plant,plantInfo,collectSun,isWater,shovel} from '../public/engine.mjs';
export function playBot(g){
 for(const s of [...g.suns])collectSun(g,s.id);
 const has=(row,col)=>g.plants.some(p=>p.row===row&&p.col===col);
 const place=(id,row,col)=>{
   if(g.sun<plantInfo(id).cost||g.cooldowns[id]>.001)return false;
   if(isWater(g,row)&&!g.bases.some(b=>b.row===row&&b.col===col))return plant(g,'lilypad',row,col).ok;
   if(g.info.theme.roof&&!g.bases.some(b=>b.row===row&&b.col===col))return plant(g,'flowerpot',row,col).ok;
   return plant(g,id,row,col).ok;
 };
 const threats=[...g.zombies].sort((a,b)=>a.x-b.x),fire=g.info.theme.roof?'cabbage':'peashooter';
 for(const z of threats)if(z.x<600&&(z.hp>240||z.x<430)&&g.info.level>=16&&g.sun>=50&&g.cooldowns.squash<=.001){const col=Math.max(0,Math.min(8,Math.floor((z.x-150)/88-.5)));if(has(z.row,col))shovel(g,z.row,col);if(place('squash',z.row,col))return;}
 for(const z of threats)if(z.x<440&&g.info.level>=2&&g.sun>=150&&g.cooldowns.cherrybomb<=.001){const col=Math.max(0,Math.min(8,Math.round((z.x-150)/88-.5)));if(has(z.row,col))shovel(g,z.row,col);if(place('cherrybomb',z.row,col))return;}
 if(g.info.theme.night)for(let row=0;row<g.info.rows;row++)if(!has(row,5)&&place('puffshroom',row,5))return;
 for(const z of threats)if(z.x<790&&!has(z.row,6)&&place('wallnut',z.row,6))return;
 for(const z of threats){if(z.x<940&&!g.plants.some(p=>p.row===z.row&&['peashooter','repeater','cabbage','snowpea'].includes(p.kind))){if(place(fire,z.row,2))return;}}
 for(let row=0;row<g.info.rows;row++)if(!has(row,0)&&place('sunflower',row,0))return;
 for(const z of threats)if(z.x<590&&g.info.level>=2){const col=Math.max(3,Math.min(8,Math.round((z.x-150)/88-.5)));if(!has(z.row,col)&&place('cherrybomb',z.row,col))return;}
 for(let row=0;row<g.info.rows;row++)if(!has(row,1)&&place('sunflower',row,1))return;
 for(let col=2;col<=4;col++)for(let row=0;row<g.info.rows;row++)if(!has(row,col)&&place(col===3&&g.info.level>=5?'snowpea':fire,row,col))return;
 for(const z of threats)if(!has(z.row,6)&&place('wallnut',z.row,6))return;
}
