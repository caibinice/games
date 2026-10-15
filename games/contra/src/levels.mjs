import first from '../public/assets/stage1.json';
import geometry from '../public/assets/geometry.json';
import crops from '../public/assets/map-crops.json';
export const LEVEL_COUNT=8;
const names=['丛林','基地一','瀑布','基地二','雪原','能源区','机库','异形巢穴'];
const kinds=['side','base','vertical','base','side','side','side','side'];
const bosses=['警戒碉堡','加鲁加核心','恶兽神头','阴兽魔神像','高速悬浮要塞','装甲巨人','最终防御门','异形心脏'];
export const STAGES=names.map((name,i)=>{
 const level=i+1,crop=crops[i],data=level===1?first:geometry[level];
 let platforms=data?.platforms.map(p=>({...p}))||[];
 if(kinds[i]==='base')platforms=[{x:0,y:204,w:256,h:16}];
 // The last map screen is the boss arena. Its solid floor is part of the map.
 if(kinds[i]==='side'&&level!==1&&!platforms.some(p=>p.x+p.w>=crop.width-32&&p.y>150))platforms.push({x:crop.width-256,y:208,w:256,h:8});
 return {level,name,kind:kinds[i],boss:bosses[i],crop,width:kinds[i]==='base'?256:crop.width,height:crop.height,
  platforms,water:level===1?first.water:[],bridges:level===1?first.bridges:[],objects:level===1?first.objects:[],rooms:level===2?6:level===4?9:0};
});
export function levelInfo(level){if(!Number.isInteger(level)||level<1||level>LEVEL_COUNT)throw Error('Invalid operation');const s=STAGES[level-1];return{name:`${String(level).padStart(2,'0')} · ${s.name}`,kind:s.kind,description:s.kind==='base'?'纵深基地 · 击破控制核心后按 ↑ 前进':s.kind==='vertical'?'向上攀登 · 击破山顶魔神':'八向射击 · 突破封锁并消灭关底 Boss'};}
