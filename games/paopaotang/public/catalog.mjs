export const LEVEL_COUNT = 12;
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
  const theme=THEMES[Math.floor((level-1)/2)];
  return {id:level,theme:Math.floor((level-1)/2),name:theme.name+(level%2?' · 初见':' · 派对'),enemies:level<4?2:3};
}
