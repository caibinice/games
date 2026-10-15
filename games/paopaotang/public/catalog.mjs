export const LEVEL_COUNT = 30;
export const THEMES = [
  {name:'晴天草坪',tag:'SUNNY MEADOW',floor:'#e5edc8',alt:'#deE8bd',wall:'#91b477',box:'#d8a775',sky:'#e9f4f7',accent:'#719c68'},
  {name:'糖果街区',tag:'CANDY AVENUE',floor:'#f7e1d9',alt:'#f1d7d0',wall:'#baa6c7',box:'#e49e9a',sky:'#fcf0ea',accent:'#c1879e'},
  {name:'海风沙滩',tag:'SEASIDE HOLIDAY',floor:'#f0e4b9',alt:'#eaddac',wall:'#83bdc6',box:'#d8b182',sky:'#e5f4f5',accent:'#6faeb5'},
  {name:'雪糕广场',tag:'ICE CREAM PLAZA',floor:'#e5eff2',alt:'#dbe7ee',wall:'#a9bed1',box:'#b5a2c9',sky:'#f0f6fa',accent:'#8cabc4'},
  {name:'薄荷花园',tag:'MINTY GARDEN',floor:'#dcecd9',alt:'#d1e3ce',wall:'#82ad99',box:'#dda184',sky:'#edf5eb',accent:'#7ca594'},
  {name:'星光码头',tag:'STARLIGHT HARBOR',floor:'#deddeb',alt:'#d2d3e4',wall:'#a0a5c8',box:'#bfacc9',sky:'#eeedf7',accent:'#9499bc'},
];
export const SKINS = [
  {name:'蓝泡泡',color:'#65a9dc',dark:'#3d82b8',ear:'bear'},
  {name:'粉团团',color:'#e3a0ad',dark:'#bf758b',ear:'bunny'},
  {name:'小布丁',color:'#e5c46f',dark:'#bda05a',ear:'cat'},
  {name:'青芽芽',color:'#8cc6ae',dark:'#60a289',ear:'bear'},
  {name:'紫米米',color:'#b4a2d1',dark:'#8d7eb4',ear:'bunny'},
];
export const DIFFICULTIES = {
  easy:{name:'轻松',density:.36,botMove:340,botBomb:.34,seconds:210},
  normal:{name:'经典',density:.48,botMove:285,botBomb:.55,seconds:180},
  hard:{name:'高手',density:.58,botMove:235,botBomb:.8,seconds:150},
};
export function levelInfo(level) {
  if(!Number.isInteger(level)||level<1||level>LEVEL_COUNT)throw Error('Invalid level');
  const stage=Math.floor((level-1)/5),round=(level-1)%5;
  return {id:level,theme:stage,stage,round,name:THEMES[stage].name+' · '+['初见','寻宝','绕行','交锋','派对'][round],
    enemies:level<6?2:3,itemTypes:['capacity','power','needle','speed','shield'].slice(0,Math.min(5,stage+2))};
}
const MAPS={pc:[[13,11],[13,11],[15,11],[15,13],[17,13],[17,15]],mobile:[[11,11],[11,11],[13,11],[13,11],[13,13],[13,13]]};
export function arenaSpec(level,platform='pc',difficulty='normal'){
  const info=levelInfo(level),d=DIFFICULTIES[difficulty];
  if(!MAPS[platform]||!d)throw Error('Invalid arena');
  const[cols,rows]=MAPS[platform][info.stage];
  return{...info,cols,rows,density:Math.min(.68,d.density+info.stage*.018+info.round*.004),
    seconds:d.seconds+Math.round((cols*rows-MAPS[platform][0][0]*11)*.45),botMove:d.botMove-info.stage*4};
}
export function aiProfile(level,difficulty='normal'){
  const stage=levelInfo(level).stage;
  if(!DIFFICULTIES[difficulty])throw Error('Invalid difficulty');
  return{mistake:({easy:.34,normal:.27,hard:.21})[difficulty]-stage*.018,
    reaction:({easy:230,normal:180,hard:140})[difficulty]-stage*8};
}
