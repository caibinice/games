// Code-native pixel icons: one subject, one quiet background, broad color areas.
// The logical canvas is intentionally tiny; no photograph/illustration sampling.
export const PATTERN_PALETTE=['#c9b8eb','#69c39e','#92ce54','#f0a440','#fff0ca','#ed85b5','#59bfd3','#ee8e7a','#aa8bdd','#eed14b'];
function painter(){
  const width=16,height=18,pixels=Array(width*height).fill(0);
  const set=(x,y,c)=>{if(x>=0&&x<width&&y>=0&&y<height)pixels[y*width+x]=c;};
  const rect=(x,y,w,h,c)=>{for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)set(px,py,c);};
  const ellipse=(x,y,rx,ry,c)=>{for(let py=0;py<height;py++)for(let px=0;px<width;px++)if(((px-x)/rx)**2+((py-y)/ry)**2<=1)set(px,py,c);};
  const poly=(points,c)=>{for(let y=0;y<height;y++)for(let x=0;x<width;x++){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [ax,ay]=points[i],[bx,by]=points[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}if(inside)set(x,y,c);}};
  const roundRect=(x,y,w,h,c)=>{rect(x+1,y,w-2,h,c);rect(x,y+1,w,h-2,c);};
  return {width,height,pixels,set,rect,ellipse,poly,roundRect};
}
const definitions=[
  ['butterfly','奶糖蝴蝶','昆虫',p=>{
    p.poly([[1,4],[4,2],[7,4],[7,10],[3,11],[1,8]],6);p.poly([[9,4],[12,2],[15,4],[15,8],[13,11],[9,10]],6);
    p.poly([[1,11],[4,9],[7,10],[7,14],[5,16],[2,15]],6);p.poly([[9,10],[12,9],[15,11],[14,15],[11,16],[9,14]],6);
    p.poly([[3,4],[5,4],[6,6],[6,10],[3,9],[2,7]],9);p.poly([[10,6],[11,4],[13,4],[14,7],[13,9],[10,10]],9);
    p.poly([[3,11],[6,11],[6,14],[4,15],[2,13]],9);p.poly([[10,11],[13,11],[14,13],[12,15],[10,14]],9);
    p.rect(7,5,2,9,5);p.rect(6,3,1,3,5);p.rect(9,3,1,3,5);
  }],
  ['peach','软软桃子','水果',p=>{
    p.ellipse(5,8,4,4,7);p.ellipse(10,8,4,4,5);p.poly([[1,8],[14,8],[13,12],[8,16],[3,12]],7);
    p.poly([[8,6],[12,6],[14,9],[12,12],[8,15]],5);p.rect(3,6,2,4,4);
    p.poly([[7,4],[8,2],[12,1],[11,4],[8,5]],2);p.rect(7,3,1,2,3);
  }],
  ['strawberry','草莓甜心','水果',p=>{
    p.poly([[4,4],[12,4],[14,7],[13,11],[8,16],[3,11],[2,7]],5);
    p.poly([[3,5],[5,3],[7,4],[8,2],[9,4],[11,3],[13,5],[10,7],[8,5],[6,7]],2);
    for(const [x,y] of [[4,8],[10,8],[7,12]])p.rect(x,y,2,2,4);
  }],
  ['watermelon','西瓜一片','水果',p=>{
    p.ellipse(8,7,7,7,2);p.ellipse(8,7,6,6,4);p.ellipse(8,7,5,5,5);p.rect(0,0,16,7,0);
    p.rect(2,7,13,1,5);for(const [x,y]of[[5,8],[10,8],[8,11]])p.rect(x,y,1,2,8);
  }],
  ['cherries','双份樱桃','水果',p=>{
    p.poly([[4,9],[8,2],[9,2],[11,9],[10,9],[8,4],[5,9]],1);p.poly([[8,3],[9,1],[13,2],[11,4]],2);
    p.ellipse(4,12,3.5,4,5);p.ellipse(11,12,3.5,4,7);p.rect(2,10,2,2,4);p.rect(9,10,2,2,4);
  }],
  ['pear','甜梨小胖','水果',p=>{
    p.ellipse(8,11,5.5,5,9);p.poly([[5,8],[6,4],[10,4],[11,8]],9);p.rect(5,9,2,4,4);p.rect(8,2,1,3,3);p.poly([[9,3],[10,1],[14,2],[12,4]],2);
  }],
  ['apple','苹果红了','水果',p=>{
    p.ellipse(5,9,4,5,7);p.ellipse(10,9,4,5,7);p.roundRect(4,8,9,7,7);p.rect(3,7,2,4,4);p.rect(7,2,2,4,3);p.poly([[9,4],[10,1],[14,2],[12,5]],2);
  }],
  ['pineapple','菠萝假日','水果',p=>{
    p.ellipse(8,11,5,5.5,9);p.rect(5,6,7,4,9);p.poly([[4,7],[3,2],[6,4],[8,1],[10,4],[13,2],[12,7]],2);
    p.poly([[3,10],[4,9],[12,13],[12,15]],3);p.poly([[4,13],[5,12],[10,15],[9,16]],3);
  }],
  ['lemon','柠檬汽水','水果',p=>{
    p.ellipse(8,9,6,5,9);p.poly([[1,9],[4,5],[12,5],[15,9],[12,13],[4,13]],9);p.rect(4,6,2,5,4);p.rect(6,5,3,1,4);p.poly([[10,4],[11,1],[15,2],[13,5]],2);
  }],
  ['banana','香蕉弯弯','水果',p=>{
    p.ellipse(8,8,6,7,9);p.ellipse(5,4,6,6,0);p.poly([[3,11],[6,13],[11,12],[13,9],[12,13],[8,15],[4,14]],9);p.rect(13,5,1,3,3);p.rect(2,10,2,2,3);
  }],
  ['kitten','小橘眨眼','动物',p=>{
    p.poly([[2,8],[2,2],[6,5]],3);p.poly([[10,5],[14,2],[14,8]],3);p.ellipse(8,10,6,5,3);
    p.poly([[3,6],[3,4],[5,6]],5);p.poly([[11,6],[13,4],[13,6]],5);
    p.ellipse(8,12,4,2.5,4);p.rect(4,8,2,2,6);p.rect(10,8,2,2,6);p.rect(7,11,2,1,5);
  }],
  ['puppy','小狗吐舌','动物',p=>{
    p.ellipse(8,9,5,5.5,4);p.ellipse(3,9,2.5,5,3);p.ellipse(13,9,2.5,5,3);
    p.rect(5,7,2,2,6);p.rect(10,7,2,2,6);p.rect(7,10,2,2,7);p.rect(7,12,2,3,5);
  }],
  ['bunny','奶油兔兔','动物',p=>{
    p.roundRect(3,1,4,9,4);p.roundRect(9,1,4,9,4);p.rect(4,2,2,5,5);p.rect(10,2,2,5,5);
    p.ellipse(8,11,6,5,4);p.rect(4,10,2,2,6);p.rect(10,10,2,2,6);p.rect(7,12,2,2,5);
  }],
  ['duck','小鸭游呀','动物',p=>{
    p.ellipse(6,5,3.5,3.5,9);p.rect(2,9,4,3,9);p.ellipse(8,11,6,4,9);p.poly([[11,9],[15,7],[14,13]],9);p.ellipse(8,11,3.5,2,4);p.rect(1,5,3,2,3);p.rect(6,4,1,2,6);
  }],
  ['fish','泡泡小鱼','动物',p=>{
    p.poly([[10,9],[15,5],[15,14],[10,11]],5);p.ellipse(7,9,5.5,4.5,6);p.poly([[5,5],[8,2],[10,6]],5);p.poly([[6,12],[9,15],[10,11]],5);p.rect(3,8,2,2,4);p.rect(4,8,1,1,8);
  }],
  ['armchair','软软沙发','家具',p=>{
    p.roundRect(3,3,10,11,8);p.roundRect(1,7,4,8,8);p.roundRect(11,7,4,8,8);p.rect(4,5,8,4,4);p.rect(4,10,8,3,5);p.rect(3,15,2,2,3);p.rect(11,15,2,2,3);
  }],
  ['lamp','床头小灯','家具',p=>{
    p.roundRect(3,14,11,2,6);p.rect(7,7,2,7,3);p.poly([[5,2],[11,2],[14,8],[2,8]],9);p.poly([[5,3],[7,3],[6,7],[3,7]],4);
  }],
  ['teacup','一杯暖茶','家具',p=>{
    p.roundRect(10,6,5,7,6);p.rect(11,8,2,3,0);p.roundRect(2,4,10,11,6);p.rect(3,4,8,3,4);p.rect(4,5,6,1,3);p.rect(3,8,3,4,4);p.rect(1,15,13,1,5);
  }],
  ['tulip','郁金香开','植物',p=>{
    p.rect(7,7,2,9,2);p.poly([[7,14],[2,9],[2,12],[5,16],[9,16]],2);p.poly([[9,13],[14,8],[14,12],[11,15],[8,16]],2);
    p.poly([[3,3],[6,5],[8,2],[10,5],[13,3],[13,8],[10,11],[6,11],[3,8]],5);
  }],
  ['house','糖果小屋','家具',p=>{
    p.rect(3,7,11,9,4);p.poly([[1,8],[8,2],[15,8]],7);p.rect(5,10,2,3,6);p.rect(10,10,2,3,6);p.rect(7,12,3,4,2);
  }],
  ['lollipop','彩虹棒棒糖','甜点',p=>{
    p.rect(7,10,2,7,4);p.ellipse(8,6,6,5,5);p.ellipse(8,6,4.5,3.5,9);p.ellipse(8,6,3,2.5,6);p.rect(7,5,3,3,4);
  }],
  ['tumbler','橘子水杯','日常',p=>{
    p.rect(9,1,2,5,5);p.roundRect(3,5,10,11,6);p.rect(2,4,12,2,4);p.rect(4,9,8,6,3);p.rect(4,7,3,2,4);p.rect(9,7,2,2,9);
  }],
  ['camera','咔嚓照相机','日常',p=>{
    p.rect(4,3,7,3,8);p.rect(11,4,3,2,5);p.roundRect(1,6,14,9,6);p.rect(2,7,3,7,8);p.rect(11,7,3,2,9);
    p.ellipse(8,10,4,4,4);p.ellipse(8,10,3,3,5);p.ellipse(8,10,2,2,8);p.rect(7,8,2,2,6);
  }],
  ['icecream','冰淇淋云朵','甜点',p=>{
    p.poly([[3,9],[13,9],[8,17]],3);p.poly([[5,10],[8,10],[8,15]],9);p.ellipse(5,7,3.5,3.5,5);p.ellipse(10,7,3.5,3.5,4);p.ellipse(8,4,3.5,3,6);
  }],
  ['cake','草莓小蛋糕','甜点',p=>{
    p.rect(2,8,12,8,4);p.rect(2,10,12,2,5);p.rect(2,14,12,2,5);p.roundRect(1,6,14,3,6);p.roundRect(6,2,4,4,7);p.rect(7,1,2,2,2);
  }],
  ['cupcake','奶油纸杯糕','甜点',p=>{
    p.poly([[3,10],[13,10],[11,16],[5,16]],5);p.rect(5,12,2,3,7);p.rect(9,12,2,3,7);
    p.roundRect(2,7,12,4,4);p.roundRect(4,4,8,4,4);p.roundRect(6,2,4,3,4);p.rect(7,1,2,2,7);
  }],
  ['rocket','星际小火箭','旅行',p=>{
    p.poly([[4,11],[2,15],[6,14],[10,14],[14,15],[12,11]],5);p.poly([[6,13],[10,13],[10,15],[8,17],[6,15]],3);
    p.poly([[5,7],[5,13],[11,13],[11,7],[8,1]],4);p.poly([[5,7],[11,7],[8,1]],7);p.roundRect(6,8,4,4,6);
  }],
  ['balloon','云上热气球','旅行',p=>{
    p.rect(5,10,2,5,4);p.rect(10,10,2,5,4);p.roundRect(5,14,7,3,3);p.ellipse(8,6,6,5.5,5);p.ellipse(8,6,3,5.5,9);p.rect(7,2,2,9,6);
  }],
  ['sailboat','海风小帆船','旅行',p=>{
    p.rect(7,2,2,12,3);p.poly([[6,2],[6,11],[1,11]],4);p.poly([[9,3],[14,11],[9,11]],5);
    p.poly([[1,12],[15,12],[12,16],[4,16]],6);p.rect(3,12,10,2,9);
  }],
  ['umbrella','晴雨小伞','日常',p=>{
    p.rect(7,7,2,8,4);p.rect(5,14,4,3,3);p.rect(4,13,2,3,3);p.ellipse(8,8,7,6,5);p.rect(0,9,16,9,0);
    p.poly([[8,2],[4,8],[12,8]],9);p.rect(7,1,2,2,4);
  }],
  ['mushroom','森林小蘑菇','植物',p=>{
    p.roundRect(5,7,6,10,4);p.rect(8,10,2,5,9);p.ellipse(8,8,7,6,7);p.rect(1,8,14,3,7);
    p.rect(3,6,3,3,4);p.rect(9,4,3,3,4);p.rect(9,8,3,2,4);
  }],
  ['turtle','慢慢小乌龟','动物',p=>{
    p.roundRect(3,3,3,3,2);p.roundRect(9,3,3,3,2);p.roundRect(3,13,3,3,2);p.roundRect(9,13,3,3,2);
    p.ellipse(8,9,6,5.5,2);p.ellipse(8,9,4.5,4,9);p.roundRect(6,7,5,5,1);p.roundRect(1,7,3,4,2);p.rect(1,8,2,2,4);
  }],
  ['fox','橘光小狐狸','动物',p=>{
    p.poly([[2,8],[2,1],[7,5],[10,5],[14,1],[14,8],[13,12],[8,16],[3,12]],3);
    p.poly([[3,8],[8,12],[13,8],[12,13],[8,16],[4,13]],4);p.rect(4,7,2,2,8);p.rect(10,7,2,2,8);p.rect(7,12,2,2,5);
  }],
  ['panda','薰衣草熊猫','动物',p=>{
    p.ellipse(4,4,3,3,8);p.ellipse(12,4,3,3,8);p.ellipse(8,10,6,6,4);p.roundRect(3,7,4,4,8);p.roundRect(9,7,4,4,8);
    p.rect(4,8,2,2,6);p.rect(10,8,2,2,6);p.rect(7,12,2,2,5);
  }],
  ['owl','晚安小猫头鹰','动物',p=>{
    p.poly([[3,6],[2,2],[6,4],[10,4],[14,2],[13,6]],8);p.ellipse(8,10,6,6,8);p.ellipse(8,12,4,3.5,4);
    p.roundRect(3,6,4,4,9);p.roundRect(9,6,4,4,9);p.rect(4,7,2,2,6);p.rect(10,7,2,2,6);p.rect(7,10,2,2,3);p.rect(4,16,3,1,3);p.rect(10,16,3,1,3);
  }],
  ['dinosaur','薄荷小恐龙','动物',p=>{
    p.roundRect(7,2,7,6,2);p.rect(6,5,4,8,2);p.ellipse(6,11,4.5,4,2);p.poly([[3,10],[1,7],[1,13],[5,14]],2);
    p.rect(4,13,3,4,2);p.rect(9,12,3,5,2);p.rect(5,9,4,4,4);p.rect(10,3,2,2,6);p.rect(11,7,3,2,9);
  }],
  ['elephant','蓝天小象','动物',p=>{
    p.roundRect(3,3,10,12,6);p.rect(11,8,3,8,6);p.rect(9,14,5,3,6);p.ellipse(4,8,3,4.5,8);p.ellipse(4,8,2,3,5);
    p.rect(4,14,3,3,6);p.rect(8,14,3,3,6);p.rect(9,5,2,2,4);p.rect(9,10,2,3,4);
  }],
  ['train','糖果小火车','旅行',p=>{
    p.rect(3,3,3,4,3);p.rect(2,6,7,8,7);p.roundRect(8,4,6,10,6);p.rect(9,5,4,4,4);p.rect(1,11,14,3,9);
    p.roundRect(2,14,4,3,8);p.roundRect(10,14,4,3,8);p.rect(3,14,2,2,5);p.rect(11,14,2,2,5);
  }],
  ['backpack','出发小书包','日常',p=>{
    p.roundRect(5,1,6,4,3);p.rect(6,2,4,2,0);p.roundRect(3,4,10,13,5);p.rect(2,8,2,7,8);p.rect(12,8,2,7,8);
    p.roundRect(4,5,8,5,6);p.roundRect(4,11,8,5,9);p.rect(6,12,4,2,4);p.rect(7,7,2,2,4);
  }],
];
export const GUIDE_PATTERN={key:'kitten-guide',title:'小橘报到',category:'动物',width:10,height:12,
  pixels:['0000000000','0033003300','0034334300','0033333300','0333333330','0337337330','0334444330','0034454300','0004444000','0003663000','0013333100','0014444100'].join('').split('').map(Number),
  palette:['#bcdfba','#53b795','#8bc957','#f29a32','#fff0c9','#ed6190','#359bd4','#f18772','#ae85de','#f0d02e']};
export const PATTERNS=[GUIDE_PATTERN,...definitions.map(([key,title,category,paint],i)=>{
  const p=painter();paint(p);
  // Drop one-cell speckles (e.g. a tiny pupil), not single-bead confetti.
  const original=[...p.pixels];
  for(let n=0;n<original.length;n++){
    const x=n%p.width,y=Math.floor(n/p.width),adjacent=[x?n-1:-1,x<p.width-1?n+1:-1,y?n-p.width:-1,y<p.height-1?n+p.width:-1].filter(j=>j>=0);
    if(adjacent.every(j=>original[j]!==original[n])){
      const counts=new Map();for(const j of adjacent)counts.set(original[j],(counts.get(original[j])||0)+1);
      p.pixels[n]=[...counts].sort((a,b)=>b[1]-a[1])[0][0];
    }
  }
  const palette=[...PATTERN_PALETTE];
  // Backgrounds are deliberately uniform, so they are one generous color island.
  palette[0]=['#c9b8eb','#efb2d0','#b6dce8','#c6deae'][i%4];
  if(key==='peach')palette[0]='#b6dce8';
  if(key==='watermelon')palette[0]='#c9b8eb';
  return {key,title,category,width:p.width,height:p.height,pixels:p.pixels,palette};
})];
export function patternPixels(pattern,width,height){
  return Array.from({length:width*height},(_,i)=>{
    const x=Math.min(pattern.width-1,Math.floor((i%width+.5)*pattern.width/width));
    const y=Math.min(pattern.height-1,Math.floor((Math.floor(i/width)+.5)*pattern.height/height));
    return pattern.pixels[y*pattern.width+x];
  });
}
