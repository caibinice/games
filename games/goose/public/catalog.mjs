export const ITEMS={
 apple:{name:'红苹果',icon:'🍎',color:'#ec626a'},orange:{name:'橘子',icon:'🍊',color:'#ffa63c'},carrot:{name:'胡萝卜',icon:'🥕',color:'#f89140'},corn:{name:'玉米',icon:'🌽',color:'#f6cc4c'},pumpkin:{name:'南瓜',icon:'🎃',color:'#ed923d'},mushroom:{name:'蘑菇',icon:'🍄',color:'#df675e'},bread:{name:'吐司',icon:'🍞',color:'#deb17b'},donut:{name:'甜甜圈',icon:'🍩',color:'#eb88aa'},cup:{name:'茶杯',icon:'☕',color:'#9ac8c2'},bottle:{name:'汽水瓶',icon:'🧴',color:'#83c6da'},fish:{name:'小鱼',icon:'🐟',color:'#78bbd6'},duck:{name:'小黄鸭',icon:'🐤',color:'#f5d05b'},strawberry:{name:'草莓',icon:'🍓',color:'#e76c7b'},egg:{name:'鸡蛋',icon:'🥚',color:'#eee6cd'},candy:{name:'糖果',icon:'🍬',color:'#ab98da'},peas:{name:'豌豆',icon:'🫛',color:'#91bf69'},soap:{name:'香皂',icon:'🧼',color:'#b398d1'},goose:{name:'大白鹅',icon:'🪿',color:'#fff9e9'}
};
export const THEMES=[
 {id:'farm',name:'田园早市',tag:'新鲜出炉的好心情',color:'#c3d7b2',goose:'田园鹅',pool:['apple','carrot','corn','pumpkin','egg','mushroom','peas']},
 {id:'fruit',name:'水果派对',tag:'今天也要甜甜的',color:'#efd5b0',goose:'蜜桃鹅',pool:['apple','orange','strawberry','candy','peas','bottle','cup']},
 {id:'bakery',name:'面包小屋',tag:'把香气装进篮子',color:'#ebcbbb',goose:'吐司鹅',pool:['bread','donut','egg','cup','candy','strawberry','apple']},
 {id:'bath',name:'泡泡浴室',tag:'鹅鹅也爱泡泡澡',color:'#bfdad8',goose:'泡泡鹅',pool:['duck','soap','bottle','cup','candy','egg','fish']},
 {id:'picnic',name:'野餐时光',tag:'和鹅鹅一起放个假',color:'#c7d5bc',goose:'野餐鹅',pool:['bread','apple','orange','bottle','egg','carrot','cup']},
 {id:'kitchen',name:'暖暖厨房',tag:'锅里藏着小惊喜',color:'#ecd7a5',goose:'大厨鹅',pool:['corn','carrot','mushroom','pumpkin','peas','fish','egg']},
 {id:'sweets',name:'糖果乐园',tag:'不止一点点甜',color:'#d9c6dd',goose:'糖果鹅',pool:['candy','donut','strawberry','orange','cup','soap','bread']},
 {id:'harbor',name:'海边杂货',tag:'海风吹来了好运',color:'#b8d4e3',goose:'水手鹅',pool:['fish','bottle','duck','cup','soap','orange','peas']}
];
export const LEVELS=Array.from({length:60},(_,i)=>{
 const id=i+1,theme=THEMES[i%THEMES.length],pool=id===1?['apple','carrot','corn']:theme.pool.slice(0,Math.min(7,4+Math.floor(id/8)));
 const triples=id===1?4:Math.min(36,14+Math.floor(id*.4)),kinds=[...pool,'goose'];
 const counts=Object.fromEntries(kinds.map(k=>[k,0]));counts.goose=3;
 for(let n=0;n<triples-1;n++)counts[pool[n%pool.length]]+=3;
 return{id,theme:theme.id,name:theme.name,counts,total:triples*3,seconds:180};
});
export function level(id){if(!Number.isInteger(id)||id<1||id>LEVELS.length)throw Error('Invalid goose level');return LEVELS[id-1];}
export function themeFor(id){return THEMES.find(t=>t.id===level(id).theme);}
