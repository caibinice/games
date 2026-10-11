import { SCENES } from './artwork-data.mjs';
import { PATTERNS, GUIDE_PATTERN, patternPixels } from './patterns.mjs';
import { shapeTarget, outlineLoops, boundaryCells } from './shapes.mjs';
import { previousSimpleArtwork } from './previous-simple-artworks.mjs';
export { SCENES, PATTERNS };
export const TOTAL_LEVELS=100;
export const CHAPTERS=[
  {name:'轻巧开拼',subtitle:'一幅小图，大片归位',image:'scenes/yarn-kitten.webp',color:'#6e9a7d'},
  {name:'缤纷萌宠',subtitle:'小动物，大大的好心情',image:'scenes/balloon-corgi.webp',color:'#c18b60'},
  {name:'甜蜜小物',subtitle:'棒棒糖、水杯、照相机',image:'scenes/fishbowl-kitten.webp',color:'#ba7e73'},
  {name:'出发旅行',subtitle:'有趣的轮廓，一片片拼好',image:'scenes/mountain-lake.webp',color:'#748faa'},
  {name:'春日新衣',subtitle:'熟悉的小图，新的配色',image:'scenes/moon-kitten.webp',color:'#9684ad'},
  {name:'果冻午后',subtitle:'鲜亮的颜色，慢慢归位',image:'scenes/balloon-corgi.webp',color:'#6e9a7d'},
  {name:'彩糖收藏',subtitle:'更多颜色，更大色块',image:'scenes/yarn-kitten.webp',color:'#c18b60'},
  {name:'云朵漫游',subtitle:'第二轮的小镇好物',image:'scenes/mountain-lake.webp',color:'#748faa'},
  {name:'夏日调色',subtitle:'第三套配色，一点新鲜感',image:'scenes/balloon-corgi.webp',color:'#ba7e73'},
  {name:'快乐满格',subtitle:'一百幅，满满的好心情',image:'scenes/moon-kitten.webp',color:'#9684ad'},
];
const PALETTE_ROUNDS=[null,
  ['#b9dae9','#6ac8b5','#a6cf5a','#efa167','#fff0d4','#e897cb','#77aee8','#eeaa72','#b09fe6','#f1d169'],
  ['#e6c9df','#81c5aa','#b4d96d','#eeb368','#fff3d6','#ee99ad','#72cbd9','#e6a987','#c1a0e5','#e8cc78']];
export function makeArtwork(id){
  if(!Number.isInteger(id)||id<1||id>TOTAL_LEVELS)throw new Error('Invalid artwork');
  const chapter=Math.floor((id-1)/10),pattern=PATTERNS[(id-1)%PATTERNS.length],cycle=Math.floor((id-1)/PATTERNS.length);
  if(id===1)return {id,name:GUIDE_PATTERN.title,patternKey:pattern.key,chapter,width:10,height:12,palette:[...pattern.palette],target:[...pattern.pixels],background:'meadow.webp',artKey:'kitten-guide-v1',cycle,
    tutorialPairs:[[[41,42,51,52],[63,64,65,66]],[[0,1,10,11],[103,104,105,106]],[[53,56],[94,95]]]};
  const width=16+Math.floor((id-1)/20),height=width+2;
  return {id,name:pattern.title+(cycle?` · ${['Ⅰ','Ⅱ','Ⅲ'][cycle]}`:''),chapter,cycle,width,height,
    palette:[...(PALETTE_ROUNDS[cycle]||pattern.palette)],target:patternPixels(pattern,width,height),patternKey:pattern.key,
    background:SCENES[(id-2)%SCENES.length].image,artKey:`simple-v2:${pattern.key}:${width}x${height}:c${cycle}`};
}
export const LEVELS=Array.from({length:TOTAL_LEVELS},(_,i)=>{
  const level=makeArtwork(i+1);level.cellCount=level.target.length;
  // Most subjects use a silhouette. A few furniture postcards retain a rectangle.
  if(level.id!==1&&!['armchair','house'].includes(level.patternKey)){
    const target=shapeTarget(level.target,level.width,level.height);
    level.contour={...level,target,contoured:true,cellCount:target.filter(c=>c!==null).length,
      outline:outlineLoops(target,level.width,level.height),boundary:boundaryCells(target,level.width,level.height)};
  }
  return level;
});
// artKey selects the exact saved catalogue; unknown keys never reinterpret beans.
export function getArtwork(id,contour=true,artKey){
  const level=LEVELS[id-1];
  if(artKey&&artKey!==level?.artKey)return previousSimpleArtwork(id,artKey,contour);
  return contour&&level?.contour?level.contour:level;
}
