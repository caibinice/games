import { describe, it, expect } from 'vitest';
import { LEVELS, SCENES, PATTERNS, getArtwork } from '../public/artworks.mjs';
import { beadGeometry, tint, drawBead, completionFlash, COLOR_FLASH_MS } from '../public/beads.mjs';
import { patternPixels } from '../public/patterns.mjs';
import { PREVIOUS_SIMPLE_LEVELS } from '../public/previous-simple-artworks.mjs';
import { PREVIOUS_ARTWORKS } from '../public/previous-artworks.mjs';
import { LEGACY_COUNTS } from '../public/legacy-artworks.mjs';
import { hiddenTapSequence, jumpLevelId } from '../public/admin.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { newGame as createGame, gameArtwork, isWon, selectBoard, selectTray, storeSelection, place, correctCount, completedColors, inventoryValid, serialize, restore, addRow, extend, undo, magnet, brush, organizeTray, connected, neighbors } from '../public/engine.mjs';
import { inferGuideStep, advanceGuideStep, highlightedGuideCells } from '../public/guide.mjs';
// Keep exercising original rectangular sessions as well as new silhouettes.
const newGame=(id,seed)=>createGame(id,seed,{rectangular:true});

function expectOrganized(game){const beads=game.tray.filter(v=>v!==null);expect(game.tray).toEqual([...beads.toSorted((a,b)=>a-b),...Array(game.tray.length-beads.length).fill(null)]);}
function recordingCanvas(){
  let dash=[];const strokes=[],fills=[],plates=[],gradients=[],paths=[];
  const c=Object.fromEntries(['save','restore','beginPath','moveTo','arcTo','closePath','fillRect','fill','lineTo','quadraticCurveTo','clip'].map(k=>[k,()=>{}]));
  for(const method of ['moveTo','arcTo','lineTo','quadraticCurveTo'])c[method]=(...args)=>paths.push([method,...args]);
  c.createLinearGradient=(...args)=>{const stops=[];gradients.push({args,stops});return {addColorStop(...v){stops.push(v);}};};c.setLineDash=value=>dash=[...value];c.getLineDash=()=>dash;
  c.stroke=()=>strokes.push({color:c.strokeStyle,dash:[...dash],width:c.lineWidth});
  c.fill=()=>fills.push({color:c.fillStyle,alpha:c.globalAlpha??1});c.fillRect=()=>plates.push(c.fillStyle);
  return {c,strokes,fills,plates,gradients,paths};
}

// A real same-background region, with a large connected wrong-color group.
function largeGroup(count=50){
  const level=PREVIOUS_SIMPLE_LEVELS[13],g=createGame(14,undefined,{rectangular:true,artKey:level.artKey}),t=level.target;let source=[];
  for(let start=0;start<t.length&&source.length<count;start++){
    if(t[start]!==4)continue;const queue=[start],seen=new Set([start]),region=[];
    for(let j=0;j<queue.length&&region.length<count;j++){const i=queue[j];if(t[i]!==4)continue;region.push(i);for(const n of neighbors(i,level.width,level.height))if(!seen.has(n)){seen.add(n);queue.push(n);}}
    if(region.length>=count)source=region;
  }
  expect(source).toHaveLength(count);const donors=t.flatMap((v,i)=>v===0?[i]:[]).filter((_,i)=>i%2===0).slice(0,count);expect(donors).toHaveLength(count);
  g.board=[...t];source.forEach((i,n)=>{g.board[donors[n]]=t[i];g.board[i]=0;});expect(inventoryValid(g)).toBe(true);
  return {g,level,source,donors};
}

describe('毛球拼豆 · 100关规则',()=>{
  it('十张原有插画保留为淡化背景，资源格式与哈希有效',()=>{
    expect(SCENES).toHaveLength(10);expect(new Set(SCENES.map(s=>s.key)).size).toBe(10);
    const manifest=JSON.parse(readFileSync(new URL('../public/assets/scenes/manifest.json',import.meta.url),'utf8'));
    expect(manifest).toHaveLength(10);
    for(const scene of SCENES){
      const image=readFileSync(new URL(`../public/assets/${scene.image}`,import.meta.url));
      expect(image.subarray(0,4).toString()).toBe('RIFF');expect(image.subarray(8,12).toString()).toBe('WEBP');
      expect(createHash('sha256').update(image).digest('hex')).toBe(manifest.find(s=>s.key===scene.key).sha256);
    }
    for(const l of LEVELS.slice(1))expect(l.background).toBe(SCENES[(l.id-2)%10].image);
  });
  it('40种独立图案按40关轮换，100关每图最多三次，三轮是真正换色',()=>{
    expect(PATTERNS).toHaveLength(40);expect(new Set(PATTERNS.map(p=>p.key)).size).toBe(40);
    const normalize=target=>{const ids=new Map();return target.map(c=>{if(!ids.has(c))ids.set(c,ids.size);return ids.get(c);}).join('');};
    expect(new Set(PATTERNS.map(p=>normalize(p.pixels))).size).toBe(40);
    for(const p of PATTERNS.slice(1)){expect(p.width).toBe(16);expect(p.height).toBe(18);expect(p.pixels).toHaveLength(288);expect(new Set(p.pixels).size).toBeGreaterThanOrEqual(3);expect(new Set(p.pixels).size).toBeLessThanOrEqual(8);}
    const uses=new Map();for(const l of LEVELS){
      const p=PATTERNS[(l.id-1)%40];expect(l.patternKey).toBe(p.key);expect(l.target).toEqual(patternPixels(p,l.width,l.height));uses.set(p.key,(uses.get(p.key)||0)+1);
      if(l.id>1){expect(l.width).toBe(16+Math.floor((l.id-1)/20));expect(l.height).toBe(l.width+2);}
      if(l.cycle===0)expect(l.palette).toEqual(p.palette);else expect(l.palette).not.toEqual(p.palette);
      expect(l.chapter).toBe(Math.floor((l.id-1)/10));expect(l.sourceArt).toBeUndefined();
    }
    expect(new Set(LEVELS.slice(0,40).map(l=>l.patternKey)).size).toBe(40);
    expect(LEVELS.slice(40,80).map(l=>l.patternKey)).toEqual(LEVELS.slice(0,40).map(l=>l.patternKey));
    expect(LEVELS.slice(80).map(l=>l.patternKey)).toEqual(LEVELS.slice(0,20).map(l=>l.patternKey));
    for(const n of uses.values())expect([2,3]).toContain(n);
    expect(LEVELS[1].palette).not.toEqual(LEVELS[41].palette);expect(LEVELS[41].palette).not.toEqual(LEVELS[81].palette);
    for(const key of ['lollipop','tumbler','camera'])expect(getArtwork(LEVELS.find(l=>l.patternKey===key).id).contoured).toBe(true);
    expect(Math.max(...PATTERNS.map(p=>new Set(p.pixels).size))).toBeGreaterThanOrEqual(7);
  });
  it('凹槽和凸豆保持相同足迹，底色在周围可见，色彩阴影没有改变色相',()=>{
    for(const s of [14,18,22,28,80]){const g=beadGeometry(s);expect(g.span+2*g.inset).toBeCloseTo(s);expect(g.span/s).toBeCloseTo(.78);expect(g.lift).toBeGreaterThan(0);expect(g.radius).toBeLessThan(g.span/2);}
    expect(tint('#59bfd3',0)).toBe('#59bfd3');expect(tint('#59bfd3',1)).toBe('#ffffff');expect(tint('#59bfd3',-.2)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('选中的画板错色豆使用与暂存盒一致的蓝色实线框',()=>{
    const {c,strokes}=recordingCanvas();drawBead(c,0,0,22,'#59bfd3',{selected:true,targetColor:'#eed14b'});
    const outline=strokes.findLast(s=>s.color==='#224f87');expect(outline).toBeDefined();expect(outline.dash).toEqual([]);expect(outline.width).toBeGreaterThanOrEqual(1.8);expect(c.getLineDash()).toEqual([]);
    expect(readFileSync(new URL('../public/readability.css',import.meta.url),'utf8')).toContain('.tray-slot.selected{outline-color:#224f87;');
  });
  it('只有选中颜色匹配的空槽提示使用虚线，普通空槽保持凹槽样式',()=>{
    const {c,strokes}=recordingCanvas();drawBead(c,0,0,22,'#59bfd3',{empty:true,selected:true});
    expect(strokes.findLast(s=>s.color==='#315e9b').dash).toEqual([22*.2,22*.13]);expect(c.getLineDash()).toEqual([]);
    const plain=recordingCanvas();drawBead(plain.c,0,0,22,'#59bfd3',{empty:true});expect(plain.strokes.some(s=>s.color==='#315e9b')).toBe(false);
  });
  it('整色完成只叠加静态斜向炫光，原凸豆几何、色彩斜面与底影完全保留',()=>{
    const color='#59bfd3',plain=recordingCanvas(),done=recordingCanvas();
    drawBead(plain.c,0,0,22,color);drawBead(done.c,0,0,22,color,{completed:true});
    expect(plain.plates[0]).toBe(color);expect(done.plates[0]).toBe(color);
    expect(plain.strokes.some(s=>s.color===tint(color,-.25))).toBe(true);
    expect(done.strokes).toEqual(plain.strokes);expect(done.paths).toEqual(plain.paths);
    expect(done.fills.filter(f=>typeof f.color==='string')).toEqual(plain.fills.filter(f=>typeof f.color==='string'));
    expect(done.gradients.slice(0,1)).toEqual(plain.gradients);expect(done.gradients).toHaveLength(2);
    expect(done.gradients[1].stops).toContainEqual([.29,'#ffffff99']);
    for(const flags of [{empty:true,completed:true},{completed:true,targetColor:'#eed14b'}]){
      const before=recordingCanvas(),after=recordingCanvas();drawBead(before.c,0,0,22,color,{...flags,completed:false});drawBead(after.c,0,0,22,color,flags);
      expect(after.plates).toEqual(before.plates);expect(after.strokes).toEqual(before.strokes);expect(after.paths).toEqual(before.paths);expect(after.gradients).toEqual(before.gradients);
    }
  });
  it('整色闪光只有一轮720ms脉冲，结束后恢复稳定完成态',()=>{
    expect(COLOR_FLASH_MS).toBe(720);expect(completionFlash(-1)).toBe(0);expect(completionFlash(0)).toBe(0);expect(completionFlash(360)).toBe(1);expect(completionFlash(720)).toBe(0);expect(completionFlash(2000)).toBe(0);
    for(let t=0;t<720;t+=15)expect(completionFlash(t)).toBeGreaterThanOrEqual(0);
    const done=recordingCanvas();drawBead(done.c,0,0,22,'#59bfd3',{completed:true,flash:completionFlash(360)});
    expect(done.fills.find(f=>f.color==='#fffdf4').alpha).toBeCloseTo(.65);expect(done.c.globalAlpha).toBe(1);
    const settled=recordingCanvas();drawBead(settled.c,0,0,22,'#59bfd3',{completed:true,flash:completionFlash(720)});expect(settled.fills.some(f=>f.color==='#fffdf4')).toBe(false);
  });
  it('颜色完成要求所有目标格归位，暂存中剩余一颗或只局部正确均不算完成',()=>{
    for(const level of LEVELS){
      const g=newGame(level.id);g.board=[...level.target];const all=new Set(level.target);expect(completedColors(g)).toEqual(all);
      const index=level.target.findIndex(c=>c===0);g.board[index]=null;g.tray[0]=0;
      expect(inventoryValid(g)).toBe(true);expect(completedColors(g)).toEqual(new Set([...all].filter(c=>c!==0)));
      expect(completedColors(restore(serialize(g)))).toEqual(completedColors(g));
    }
  });
  it('画板直接归位最后一颗即完成整色，撤销后恢复未完成并可再次完成',()=>{
    const g=newGame(2),target=LEVELS[1].target,hole=target.findIndex(c=>c===0),source=target.findIndex(c=>c!==0),other=target.findIndex(c=>c!==0&&c!==target[source]);
    g.board=[...target];g.board[hole]=null;g.board[source]=0;g.board[other]=null;g.tray[0]=target[source];g.tray[1]=target[other];organizeTray(g);
    expect(inventoryValid(g)).toBe(true);expect(completedColors(g).has(0)).toBe(false);
    selectBoard(g,source);expect(place(g,hole).route).toBe('direct');expect(completedColors(g).has(0)).toBe(true);expect(completedColors(g).has(target[source])).toBe(false);
    expect(undo(g)).toBe(true);expect(completedColors(g).has(0)).toBe(false);selectBoard(g,source);place(g,hole);expect(completedColors(g).has(0)).toBe(true);expect(inventoryValid(g)).toBe(true);
  });
  it('暂存豆跨空区放入时只有最后一片完成整色，道具也立即更新颜色完成状态',()=>{
    const target=LEVELS[1].target,holes=[target.findIndex(c=>c===0),target.findLastIndex(c=>c===0)],g=newGame(2);
    g.board=[...target];holes.forEach(i=>g.board[i]=null);g.tray[0]=g.tray[1]=0;selectTray(g,0);
    expect(place(g,holes[0]).moved).toBe(1);expect(completedColors(g).has(0)).toBe(false);expect(g.selection.indices).toHaveLength(1);
    expect(place(g,holes[1]).moved).toBe(1);expect(completedColors(g).has(0)).toBe(true);expect(undo(g)).toBe(true);expect(completedColors(g).has(0)).toBe(false);
    for(const tool of [magnet,brush]){
      const s=newGame(2);s.board=[...target];s.board[holes[0]]=null;s.tray[0]=0;
      expect(completedColors(s).has(0)).toBe(false);expect(tool(s).ok).toBe(true);expect(completedColors(s)).toEqual(new Set(target));expect(inventoryValid(s)).toBe(true);
    }
  });
  it('暂存盒取消独立滚动与固定高度，全屏扩容同样随整页展开',()=>{
    const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8'),tray=css.match(/\.tray-grid\{([^}]+)\}/)[1];
    expect(tray).toContain('overflow:visible;');expect(tray).not.toContain('max-height:');expect(tray).not.toContain('overflow-y:auto');
    expect(readFileSync(new URL('../public/readability.css',import.meta.url),'utf8')).toContain('.playing:fullscreen>.play-screen{max-height:none}');
  });
  it('旧画作Cookie逐关验证后迁移，只重开换图画板，保留关卡、空间与道具',()=>{
    for(let id=2;id<=50;id++){
      const b=LEGACY_COUNTS[id-1].flatMap((n,c)=>Array(n).fill(String(c))).join('');
      const v={v:1,l:id,b,t:'',r:6,s:12,e:200,m:89,a:3,p:{magnet:8,brush:12}};
      const g=restore(JSON.stringify(v));expect(g).not.toBeNull();expect(g.level).toBe(id);expect(g.artworkMigrated).toBe(true);expect(g.rows).toBe(6);expect(g.tray).toEqual(Array(72).fill(null));expect(g.tools).toEqual(v.p);expect(g.remaining).toBe(180);expect(g.elapsed).toBe(0);expect(g.moves).toBe(0);expect(inventoryValid(g)).toBe(true);
      const saved=JSON.parse(serialize(g));expect(saved.v).toBe(4);expect(saved.k).toBe(LEVELS[id-1].artKey);expect(restore(JSON.stringify(saved)).board).toEqual(g.board);
      v.b='0'.repeat(b.length);expect(restore(JSON.stringify(v))).toBeNull();
    }
    const first=newGame(1);selectBoard(first,41);storeSelection(first);first.remaining=35;
    const v=JSON.parse(serialize(first));v.v=1;delete v.k;const g=restore(JSON.stringify(v));expect(g.board).toEqual(first.board);expect(g.tray).toEqual(first.tray);expect(g.remaining).toBe(35);expect(g.artworkMigrated).toBeUndefined();
    const current=JSON.parse(serialize(newGame(2)));current.k='another-picture';expect(restore(JSON.stringify(current))).toBeNull();current.k=LEVELS[1].artKey;current.l='2';expect(restore(JSON.stringify(current))).toBeNull();
  });
  it('上版v2复杂插画存档验证库存后重开简单图，旧第一关原样恢复',()=>{
    for(const old of PREVIOUS_ARTWORKS.slice(1)){
      const board=old.counts.flatMap((n,c)=>Array(n).fill(String(c))),tray=board.splice(0,17);board.unshift(...Array(17).fill('x'));
      const v={v:2,k:old.k,l:old.id,b:board.join(''),t:tray.join(''),r:8,s:66,e:144,m:72,a:2,p:{magnet:5,brush:6}},g=restore(JSON.stringify(v));
      expect(g).not.toBeNull();expect(g.artworkMigrated).toBe(true);expect(g.level).toBe(old.id);expect(g.rows).toBe(8);expect(g.tools).toEqual(v.p);expect(g.remaining).toBe(180);expect(g.board).toHaveLength(LEVELS[old.id-1].target.length);expect(inventoryValid(g)).toBe(true);
      v.t='';expect(restore(JSON.stringify(v))).toBeNull();v.t=tray.join('');v.k='unknown-previous-art';expect(restore(JSON.stringify(v))).toBeNull();
    }
    const first=newGame(1);selectBoard(first,41);storeSelection(first);first.remaining=44;const v=JSON.parse(serialize(first));v.v=2;
    const g=restore(JSON.stringify(v));expect(g.board).toEqual(first.board);expect(g.tray).toEqual(first.tray);expect(g.remaining).toBe(44);expect(g.artworkMigrated).toBeUndefined();
  });
  it('隐藏入口需2.5秒内点击五次，跳关只接受1～100的整数',()=>{
    const taps=hiddenTapSequence();expect([0,400,800,1200,1600].map(taps)).toEqual([false,false,false,false,true]);
    expect([2000,2400,2800,3200].map(taps)).toEqual([false,false,false,false]);expect(taps(4701)).toBe(false);expect([4800,4900,5000,5100].map(taps)).toEqual([false,false,false,true]);
    expect(taps(NaN)).toBe(false);expect(taps(Infinity)).toBe(false);
    for(const raw of [1,50,100,'1','50','100',' 03 '])expect(jumpLevelId(raw)).toBe(Number(raw));
    for(const raw of [0,101,-1,1.5,'','1.5','1e1','50x',null,true,[],{},NaN])expect(jumpLevelId(raw)).toBeNull();
  });
  it('100个关卡按尺寸递增，所有图案有完整颜色库存',()=>{
    expect(LEVELS).toHaveLength(100);expect(new Set(LEVELS.map(l=>l.artKey)).size).toBe(100);
    for(const level of LEVELS){const game=newGame(level.id);expect(level.target).toHaveLength(level.width*level.height);expect(inventoryValid(game)).toBe(true);if(level.id>1){expect((game.board.length-correctCount(game))/game.board.length).toBeGreaterThanOrEqual(.45);expect(Math.max(...game.board.map((_,i)=>connected(game,i).length))).toBeGreaterThanOrEqual(40);}expect(game.rows).toBe(2);expect(game.tray).toHaveLength(24);expect(game.remaining).toBe(180);}
    expect(LEVELS[0].target.length).toBe(120);expect(120-correctCount(newGame(1))).toBe(20);expect(LEVELS[1].target.length).toBe(288);expect(LEVELS[99].target.length).toBe(440);
  });
  it('取出、暂存、归位和撤销保持每种豆数量，不取走正确豆',()=>{
    const g=newGame(1),t=LEVELS[0].target,i=g.board.findIndex((v,i)=>v!==t[i]),initial=[...g.board];
    const result=selectBoard(g,i);expect(result.ok).toBe(true);expect(result.selected).toBe(connected(g,i).length);
    const color=g.selection.color,indices=[...g.selection.indices];expect(storeSelection(g).ok).toBe(true);expect(indices.every(i=>g.board[i]===null)).toBe(true);expect(inventoryValid(g)).toBe(true);
    expect(undo(g)).toBe(true);expect(g.board).toEqual(initial);expect(g.tray.every(v=>v===null)).toBe(true);
    const correct=g.board.findIndex((v,i)=>v===t[i]);expect(selectBoard(g,correct).reason).toBe('correct');
    selectBoard(g,i);storeSelection(g);expect(selectTray(g,g.tray.findIndex(v=>v===color)).ok).toBe(true);
    const wrongHole=g.board.findIndex((v,i)=>v===null&&t[i]!==color);if(wrongHole>=0)expect(place(g,wrongHole).reason).toBe('color');
    expect(inventoryValid(g)).toBe(true);
  });
  it('满盒时保留选中豆；无限扩容，撤销不收回新增空间',()=>{
    const g=newGame(2),t=LEVELS[1].target;
    while(g.tray.includes(null)){const i=g.board.findIndex((v,i)=>v!==null&&v!==t[i]);selectBoard(g,i);storeSelection(g);}
    const i=g.board.findIndex((v,i)=>v!==null&&v!==t[i]);selectBoard(g,i);const before=[...g.board];expect(storeSelection(g).reason).toBe('full');expect(g.board).toEqual(before);expect(g.selection).not.toBe(null);
    addRow(g);expect(storeSelection(g).ok).toBe(true);addRow(g);undo(g);expect(g.rows).toBe(4);expect(g.tray).toHaveLength(48);expect(inventoryValid(g)).toBe(true);
    for(let i=0;i<100;i++)addRow(g);expect(g.rows).toBe(104);expect(restore(serialize(g)).rows).toBe(104);
  });
  it('续时每次180秒，不限次数，过期后保留棋盘',()=>{
    const g=newGame(1),before=[...g.board];g.remaining=0;g.status='timeout';extend(g);expect(g.status).toBe('playing');expect(g.remaining).toBe(180);for(let i=0;i<99;i++)extend(g);expect(g.remaining).toBe(18000);expect(g.extensions).toBe(100);expect(g.board).toEqual(before);
  });
  it('Cookie紧凑保存、复原并拒绝损坏或库存不符的状态',()=>{
    for(const level of LEVELS){const g=newGame(level.id),i=g.board.findIndex((v,i)=>v!==level.target[i]);selectBoard(g,i);storeSelection(g);addRow(g);g.remaining=91;g.tools.magnet=15;const raw=serialize(g),restored=restore(raw);expect(encodeURIComponent(raw).length).toBeLessThan(3500);expect(restored.board).toEqual(g.board);expect(restored.tray.filter(v=>v!==null)).toEqual(g.tray.filter(v=>v!==null));expect(restored.remaining).toBe(91);expect(restored.tools.magnet).toBe(15);expect(inventoryValid(restored)).toBe(true);}
    expect(restore('bad')).toBe(null);expect(restore(null)).toBe(null);const v=JSON.parse(serialize(newGame(1)));v.b='0'.repeat(120);expect(restore(JSON.stringify(v))).toBe(null);v.r=-1;expect(restore(JSON.stringify(v))).toBe(null);
  });
  it('100关全部收藏记录仍在单个Cookie预算内，最后一关与各入口共用关卡总数',()=>{
    const compact={v:1,c:LEVELS.map(l=>[l.id,999999,999999]),l:100,s:false,f:false,n:false,g:2};
    expect(encodeURIComponent(JSON.stringify(compact)).length+'pindou_progress='.length).toBeLessThan(4096);
    const app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
    expect(app).toContain('id===TOTAL_LEVELS');expect(app).toContain('Math.min(TOTAL_LEVELS,');expect(app).not.toContain('id===50');expect(app).not.toContain('Math.min(50,');expect(app).not.toContain('+k<=50');
  });
  it('磁铁和整理刷保持库存，次数耗尽时待免费领取',()=>{
    const g=newGame(3),before=correctCount(g);expect(magnet(g).moved).toBe(10);expect(correctCount(g)).toBeGreaterThanOrEqual(before+10);expect(g.tools.magnet).toBe(0);expect(magnet(g).reason).toBe('tool');expect(inventoryValid(g)).toBe(true);undo(g);expect(correctCount(g)).toBe(before);expect(g.tools.magnet).toBe(1);
    expect(brush(g).reason).toBe('no-holes');expect(g.tools.brush).toBe(1);
    while(g.rows*12<g.board.length)addRow(g);
    const target=LEVELS[2].target;for(let i=0;i<g.board.length;i++)if(g.board[i]!==null&&g.board[i]!==target[i]){selectBoard(g,i);storeSelection(g);}
    expect(brush(g).won).toBe(true);expect(g.tools.brush).toBe(0);expect(inventoryValid(g)).toBe(true);
  });
  it('50关都能用普通取放完成，不依赖道具；测试死锁与通关判定',()=>{
    for(const level of LEVELS){const g=newGame(level.id);while(g.rows*12<level.target.length)addRow(g);
      for(let i=0;i<g.board.length;i++)if(g.board[i]!==null&&g.board[i]!==level.target[i]){expect(selectBoard(g,i).ok).toBe(true);expect(storeSelection(g).ok).toBe(true);}
      while(g.status!=='won'){const i=g.board.findIndex(v=>v===null),color=level.target[i],slot=g.tray.findIndex(v=>v===color);expect(slot).toBeGreaterThanOrEqual(0);expect(selectTray(g,slot).ok).toBe(true);expect(place(g,i).ok).toBe(true);expect(inventoryValid(g)).toBe(true);}
      expect(g.board).toEqual(level.target);expect(g.tray.every(v=>v===null)).toBe(true);expect(g.moves).toBeGreaterThan(5);
    }
  });
  it('50关都能反复免费补磁铁通关，空孔与暂存豆也能正确交换',()=>{
    for(const l of LEVELS){const g=newGame(l.id);selectBoard(g,g.board.findIndex((v,i)=>v!==l.target[i]));storeSelection(g);let actions=0;while(g.status!=='won'&&actions++<l.target.length){g.tools.magnet++;expect(magnet(g).ok).toBe(true);expect(inventoryValid(g)).toBe(true);}expect(g.status).toBe('won');}
  });
  it('画板错色豆直接放入同色空格，不经过暂存；可撤销并保持库存',()=>{
    const g=newGame(1),[a,b]=LEVELS[0].tutorialPairs[0];selectBoard(g,a[0]);storeSelection(g);
    const before=[...g.board],tray=[...g.tray],moves=g.moves;selectBoard(g,b[0]);
    expect(selectBoard(g,a[0])).toMatchObject({ok:true,moved:4,route:'direct',color:3,placed:a});
    expect(a.every(i=>g.board[i]===3)).toBe(true);expect(b.every(i=>g.board[i]===null)).toBe(true);expect(g.tray).toEqual(tray);expect(g.moves).toBe(moves+1);expect(g.selection).toBe(null);expect(inventoryValid(g)).toBe(true);
    expect(undo(g)).toBe(true);expect(g.board).toEqual(before);expect(g.tray).toEqual(tray);expect(inventoryValid(g)).toBe(true);
  });
  it('直接归位只移动可容纳的豆，错色/占用/越界目标不改变画板或选择',()=>{
    const g=newGame(1),[a,b]=LEVELS[0].tutorialPairs[0];selectBoard(g,a[0],true);storeSelection(g);selectBoard(g,53,true);storeSelection(g);selectBoard(g,b[0]);
    const before=structuredClone(g);expect(place(g,53).reason).toBe('color');expect(place(g,b[0]).reason).toBe('occupied');expect(place(g,-1).reason).toBe('outside');expect(place(g,120).reason).toBe('outside');expect(g).toEqual(before);
    expect(place(g,a[0])).toMatchObject({ok:true,moved:1,route:'direct'});expect(b.filter(i=>g.board[i]===null)).toHaveLength(1);expect(b.filter(i=>g.board[i]===3)).toHaveLength(3);expect(g.tray).toEqual(before.tray);expect(inventoryValid(g)).toBe(true);
  });
  it('暂存盒每次取放、刷子、磁铁、撤销后都紧凑同色归并',()=>{
    const g=newGame(1),l=LEVELS[0];
    for(const [a,b] of l.tutorialPairs){selectBoard(g,a[0]);storeSelection(g,23);selectBoard(g,b[0]);storeSelection(g,23);expectOrganized(g);expect(inventoryValid(g)).toBe(true);}
    selectTray(g,g.tray.findIndex(v=>v===3),true);place(g,41);expectOrganized(g);undo(g);expectOrganized(g);magnet(g);expectOrganized(g);expect(inventoryValid(g)).toBe(true);undo(g);expectOrganized(g);brush(g);expectOrganized(g);expect(inventoryValid(g)).toBe(true);
  });
  it('自动排齐保留当前选中豆身份，旧Cookie散色也按颜色归并',()=>{
    const g=newGame(1);selectBoard(g,41);storeSelection(g);selectBoard(g,0);storeSelection(g);
    const occupied=g.tray.filter(v=>v!==null).reverse();g.tray=Array(24).fill(null);occupied.forEach((v,i)=>g.tray[i*2]=v);const indices=g.tray.flatMap((c,i)=>c===4?[i]:[]);g.selection={source:'tray',color:4,indices};organizeTray(g);expect(g.selection.indices).toEqual([4,5,6,7]);expect(g.selection.indices.every(i=>g.tray[i]===4)).toBe(true);addRow(g);expect(g.selection.indices).toEqual([4,5,6,7]);expectOrganized(g);expect(inventoryValid(g)).toBe(true);
    const v=JSON.parse(serialize(g));v.t=occupied.join('');const restored=restore(JSON.stringify(v));expectOrganized(restored);expect(inventoryValid(restored)).toBe(true);expect(restored.tray.filter(c=>c!==null)).toEqual([3,3,3,3,4,4,4,4]);
  });
  it('七步新手教学实际演练暂存、直接归位、暂存豆归位与设置入口',()=>{
    const g=newGame(1),l=LEVELS[0],[a,b]=l.tutorialPairs[0];let step=inferGuideStep(g,l);expect(step).toBe(0);expect(highlightedGuideCells(step,g,l)).toEqual(a);
    const act=(fn,expected)=>{const result=fn();step=advanceGuideStep(step,result,g,l);expect(step).toBe(expected);expect(inferGuideStep(g,l)).toBe(expected);expect(inventoryValid(g)).toBe(true);expectOrganized(g);};
    act(()=>selectBoard(g,a[0]),1);act(()=>selectTray(g,0),2);expect(inferGuideStep(restore(serialize(g)),l)).toBe(2);expect(highlightedGuideCells(step,g,l)).toEqual(b);
    act(()=>selectBoard(g,b[0]),3);act(()=>selectBoard(g,a[0]),4);expect(inferGuideStep(restore(serialize(g)),l)).toBe(4);
    act(()=>selectTray(g,g.tray.findIndex(v=>v===4)),5);act(()=>selectBoard(g,b[0]),6);expect(inferGuideStep(restore(serialize(g)),l)).toBe(6);expect(g.status).toBe('playing');expect(correctCount(g)).toBe(108);
    undo(g);expect(inferGuideStep(g,l)).toBe(4);undo(g);expect(inferGuideStep(g,l)).toBe(2);undo(g);expect(inferGuideStep(g,l)).toBe(0);
  });
  it('新手单颗操作、道具提前归位也能重新定位引导阶段',()=>{
    const g=newGame(1),l=LEVELS[0],[a,b]=l.tutorialPairs[0];let step=0;
    for(const fn of [()=>selectBoard(g,a[0],true),()=>storeSelection(g),()=>selectBoard(g,b[0]),()=>place(g,a[0])])step=advanceGuideStep(step,fn(),g,l);
    expect(step).not.toBe(6);expect(highlightedGuideCells(0,g,l)).toHaveLength(3);magnet(g);step=advanceGuideStep(step,{ok:true},g,l);expect(step).toBe(inferGuideStep(g,l));expect(inventoryValid(g)).toBe(true);
  });
  it('相邻同色错色豆可全选50颗，单颗模式仍只选一颗',()=>{
    const {g,source}=largeGroup();expect(selectBoard(g,source[0]).selected).toBe(50);expect(new Set(g.selection.indices)).toEqual(new Set(source));expect(selectBoard(g,source[0],true).selected).toBe(1);expect(inventoryValid(g)).toBe(true);
  });
  it('同豆色跨背景连取，不穿过正确豆或不相邻区域',()=>{
    const g=newGame(1),t=LEVELS[0].target;g.board=[...t];
    expect(t[22]).toBe(3);expect(t[23]).toBe(4);
    for(const [a,b]of [[22,0],[23,1],[33,10]])[g.board[a],g.board[b]]=[g.board[b],g.board[a]];
    expect(g.board[22]).toBe(0);expect(g.board[23]).toBe(0);expect(g.board[33]).toBe(0);
    expect(selectBoard(g,22).selected).toBe(3);expect(new Set(g.selection.indices)).toEqual(new Set([22,23,33]));
    expect(selectBoard(g,23).selected).toBe(3);expect(selectBoard(g,33).selected).toBe(3);expect(inventoryValid(g)).toBe(true);
    const {g:large,source}=largeGroup(80);expect(selectBoard(large,source[0]).selected).toBe(80);
    expect(new Set(large.selection.indices.map(i=>gameArtwork(large).target[i]))).toEqual(new Set([4]));
  });
  it('跨底色选中后优先搬起点底色下的豆，余豆可继续归位且库存与撤销正确',()=>{
    const g=newGame(1),t=gameArtwork(g).target;g.board=[...t];
    for(const [a,b]of [[22,0],[23,1],[33,110]])[g.board[a],g.board[b]]=[g.board[b],g.board[a]];
    for(const [slot,i]of [0,1,110].entries()){g.tray[slot]=g.board[i];g.board[i]=null;}organizeTray(g);
    expect(inventoryValid(g)).toBe(true);expect(t[22]).toBe(3);expect(t[23]).toBe(4);expect(t[33]).toBe(3);
    expect(selectBoard(g,22).selected).toBe(3);expect(g.selection.indices).toEqual([22,23,33]);expect(g.selection.priorityBackground).toBe(3);
    const before=structuredClone(g),tray=[...g.tray];
    expect(place(g,0)).toMatchObject({route:'direct',moved:2,remaining:1});
    expect(g.board[22]).toBeNull();expect(g.board[33]).toBeNull();expect(g.board[23]).toBe(0);expect(g.selection.indices).toEqual([23]);expect(g.selection.priorityBackground).toBe(3);expect(g.tray).toEqual(tray);expect(inventoryValid(g)).toBe(true);
    const partial=structuredClone(g);expect(place(g,22).reason).toBe('color');expect(place(g,23).reason).toBe('occupied');expect(g).toEqual(partial);
    expect(place(g,110)).toMatchObject({route:'direct',moved:1,remaining:0});expect(g.board[23]).toBeNull();expect(g.selection).toBeNull();expect(inventoryValid(g)).toBe(true);
    expect(undo(g)).toBe(true);expect(g.board).toEqual(partial.board);expect(undo(g)).toBe(true);expect(g.board).toEqual(before.board);expect(g.tray).toEqual(before.tray);
    // Clicking the cream background first changes which source is consumed first.
    selectBoard(g,23);expect(place(g,0).moved).toBe(2);expect(g.board[23]).toBeNull();expect(g.board[22]).toBeNull();expect(g.board[33]).toBe(0);expect(inventoryValid(g)).toBe(true);
  });
  it('正常图案没有一格一色的碎点，同色区域以成片格子为主',()=>{
    for(const base of LEVELS.slice(1)){
      const l=getArtwork(base.id);
      const singles=l.target.filter((c,i)=>c!==null&&neighbors(i,l.width,l.height).every(j=>l.target[j]!==c));
      expect(singles.length/l.cellCount).toBeLessThan(.02);
      const biggest=new Map(),seen=new Set();
      for(let i=0;i<l.target.length;i++)if(l.target[i]!==null&&!seen.has(i)){
        const color=l.target[i],q=[i];seen.add(i);for(let n=0;n<q.length;n++)for(const j of neighbors(q[n],l.width,l.height))if(!seen.has(j)&&l.target[j]===color){seen.add(j);q.push(j);}
        biggest.set(color,Math.max(biggest.get(color)||0,q.length));
      }
      expect([...biggest.values()].filter(n=>n>=12).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('扩到六行可以一次暂存全部50颗，取消单次两行上限，撤销与存档正常',()=>{
    const {g,source}=largeGroup(),before=[...g.board];for(let i=0;i<4;i++)addRow(g);selectBoard(g,source[0]);
    expect(storeSelection(g)).toMatchObject({moved:50,remaining:0,route:'store'});expect(g.selection).toBe(null);expect(g.moves).toBe(1);expect(g.tray.filter(v=>v===0)).toHaveLength(50);expect(source.every(i=>g.board[i]===null)).toBe(true);expect(inventoryValid(g)).toBe(true);expectOrganized(g);
    const restored=restore(serialize(g));expect(restored.board).toEqual(g.board);expect(restored.tray).toEqual(g.tray);expect(restored.rows).toBe(6);
    expect(undo(g)).toBe(true);expect(g.board).toEqual(before);expect(g.tray.every(v=>v===null)).toBe(true);expect(g.rows).toBe(6);expect(g.moves).toBe(0);expect(inventoryValid(g)).toBe(true);
  });
  it('一次能填满全部72个空位，80颗选择中剩余8颗扩行后继续暂存',()=>{
    const {g,source}=largeGroup(80);for(let i=0;i<4;i++)addRow(g);selectBoard(g,source[0]);
    expect(storeSelection(g,65)).toMatchObject({moved:72,remaining:8});expect(g.selection.indices).toHaveLength(8);expect(g.selection.indices.every(i=>g.board[i]===0)).toBe(true);expect(g.tray.filter(v=>v!==null)).toHaveLength(72);expectOrganized(g);expect(inventoryValid(g)).toBe(true);
    const before=structuredClone(g);expect(storeSelection(g).reason).toBe('full');expect(g).toEqual(before);addRow(g);expect(storeSelection(g)).toMatchObject({moved:8,remaining:0});expect(g.selection).toBe(null);expect(g.tray.filter(v=>v===0)).toHaveLength(80);expect(inventoryValid(g)).toBe(true);
  });
  it('实际轮廓关卡同样一次暂存超过两行，并按真实空位而非总行数决定数量',()=>{
    const g=createGame(2),l=gameArtwork(g),source=g.board.map((_,i)=>i).reduce((a,i)=>connected(g,i).length>connected(g,a).length?i:a,0),indices=connected(g,source);
    expect(indices.length).toBeGreaterThan(24);while(g.tray.length<indices.length)addRow(g);selectBoard(g,source);expect(storeSelection(g).moved).toBe(indices.length);expect(g.selection).toBe(null);expect(inventoryValid(g)).toBe(true);expectOrganized(g);
    const {g:partial,source:group}=largeGroup();for(let i=0;i<2;i++)addRow(partial);const t=gameArtwork(partial).target,other=t.flatMap((v,i)=>v===0&&partial.board[i]===0&&!group.includes(i)?[i]:[]).slice(0,7);for(const i of other){partial.board[i]=null;partial.tray[other.indexOf(i)]=0;}organizeTray(partial);selectBoard(partial,group[0]);
    expect(storeSelection(partial)).toMatchObject({moved:41,remaining:9});expect(partial.tray.filter(c=>c!==null)).toHaveLength(48);expect(inventoryValid(partial)).toBe(true);
  });
  it('空位不足只暂存可容纳数量，满盒不丢剩余选择，扩行后继续放',()=>{
    const {g,source}=largeGroup();selectBoard(g,source[0]);expect(storeSelection(g).remaining).toBe(26);const before=structuredClone(g);expect(storeSelection(g).reason).toBe('full');expect(g).toEqual(before);
    addRow(g);expect(g.selection.indices).toHaveLength(26);expect(storeSelection(g)).toMatchObject({moved:12,remaining:14});addRow(g);addRow(g);expect(storeSelection(g)).toMatchObject({moved:14,remaining:0});expect(g.selection).toBe(null);expect(inventoryValid(g)).toBe(true);expectOrganized(g);
  });
  it('画板大组连续填多个分离空区，每次只填点击处连通空区',()=>{
    const {g,source,donors}=largeGroup();for(let n=0;n<4;n++)addRow(g);
    for(const i of donors){selectBoard(g,i,true);expect(storeSelection(g).moved).toBe(1);}
    const tray=[...g.tray];expect(selectBoard(g,source[0]).selected).toBe(50);let regions=0,remaining=50;
    while(g.selection){const hole=donors.find(i=>g.board[i]===null),region=connected(g,hole,'hole'),other=donors.filter(i=>g.board[i]===null&&!region.includes(i));const result=selectBoard(g,hole);remaining-=region.length;expect(result).toMatchObject({route:'direct',moved:region.length,remaining});expect(other.every(i=>g.board[i]===null)).toBe(true);if(remaining)expect(g.selection.indices).toHaveLength(remaining);expect(g.tray).toEqual(tray);expect(inventoryValid(g)).toBe(true);regions++;}
    expect(regions).toBeGreaterThan(1);expect(donors.every(i=>g.board[i]===0)).toBe(true);expect(source.every(i=>g.board[i]===null)).toBe(true);expect(g.status).toBe('playing');
  });
  it('暂存大组跨空区连续放入，自动归并正确重映射剩余选中索引',()=>{
    const g=newGame(14),t=LEVELS[13].target,holes=t.flatMap((v,i)=>v===4?[i]:[]).filter((_,i)=>i%2===0).slice(0,35),other=t.flatMap((v,i)=>v===0?[i]:[]).slice(0,5);expect(holes).toHaveLength(35);
    g.board=[...t];for(const i of [...holes,...other])g.board[i]=null;g.rows=4;g.tray=[...Array(35).fill(4),...Array(5).fill(0),...Array(8).fill(null)];organizeTray(g);expect(selectTray(g,5).selected).toBe(35);let remaining=35,regions=0;
    while(g.selection){const hole=holes.find(i=>g.board[i]===null),region=connected(g,hole,'hole');remaining-=region.length;expect(place(g,hole)).toMatchObject({route:'tray',moved:region.length,remaining});if(remaining){expect(g.selection.indices).toEqual(Array.from({length:remaining},(_,i)=>i+5));expect(g.selection.indices.every(i=>g.tray[i]===4)).toBe(true);}expectOrganized(g);expect(inventoryValid(g)).toBe(true);regions++;}
    expect(regions).toBeGreaterThan(1);expect(g.tray.filter(v=>v!==null)).toEqual(Array(5).fill(0));expect(restore(serialize(g)).board).toEqual(g.board);
  });
  it('连续归位中点错色空格或占用格，保留剩余豆和完整状态',()=>{
    const g=newGame(1),[a,b]=LEVELS[0].tutorialPairs[0];selectBoard(g,a[0],true);storeSelection(g);selectBoard(g,53,true);storeSelection(g);selectBoard(g,b[0]);place(g,a[0]);expect(g.selection.indices).toHaveLength(3);const before=structuredClone(g);expect(place(g,53).reason).toBe('color');expect(place(g,a[0]).reason).toBe('occupied');expect(g).toEqual(before);expect(inventoryValid(g)).toBe(true);
  });
  it('画板与暂存豆归位均能一次填满50个连续同色空格',()=>{
    const {g,source,level}=largeGroup(),t=level.target;let holes=[];
    for(let start=0;start<t.length&&holes.length<50;start++){if(t[start]!==0)continue;const queue=[start],seen=new Set([start]),region=[];
      for(let j=0;j<queue.length&&region.length<50;j++){const i=queue[j];if(t[i]!==0)continue;region.push(i);for(const n of neighbors(i,level.width,level.height))if(!seen.has(n)){seen.add(n);queue.push(n);}}
      if(region.length>=50)holes=region;
    }
    expect(holes).toHaveLength(50);g.board=[...t];for(const i of source)g.board[i]=0;for(const i of holes)g.board[i]=null;g.rows=6;g.tray=[...source.map(i=>t[i]),...Array(22).fill(null)];organizeTray(g);
    selectBoard(g,source[0]);expect(place(g,holes[0])).toMatchObject({moved:50,remaining:0,route:'direct'});expect(g.selection).toBe(null);expect(inventoryValid(g)).toBe(true);
    g.board=[...t];for(const i of holes)g.board[i]=null;g.tray=[...Array(50).fill(0),...Array(22).fill(null)];selectTray(g,0);expect(place(g,holes[0])).toMatchObject({moved:50,remaining:0,route:'tray',won:true});expect(inventoryValid(g)).toBe(true);
  });
  it('全部关卡使用明亮豆色，没有黑色或极深色',()=>{
    const luminance=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    for(const l of LEVELS)for(const color of l.palette)expect(luminance(color)).toBeGreaterThan(.24);
  });
});

describe('不规则图形与原存档兼容',()=>{
  it('扩图库前真实生成的150份旧v3/v4存档逐项原样恢复，重新保存也保持旧artKey',()=>{
    const fixtures=JSON.parse(readFileSync(new URL('./fixtures/pindou-v3-v4.json',import.meta.url),'utf8'));expect(fixtures).toHaveLength(150);
    for(const {raw,board,tray}of fixtures){
      const v=JSON.parse(raw),g=restore(raw);expect(g).not.toBeNull();expect(g.board).toEqual(board);expect(g.tray).toEqual(tray);expect(g.rows).toBe(v.r);expect(g.remaining).toBe(v.s);expect(g.elapsed).toBe(v.e);expect(g.moves).toBe(v.m);expect(g.tools).toEqual(v.p);expect(g.artworkMigrated).toBeUndefined();expect(inventoryValid(g)).toBe(true);
      expect(gameArtwork(g).artKey).toBe(v.k);expect(gameArtwork(g).width).toBe(PREVIOUS_SIMPLE_LEVELS[v.l-1].width);
      const next=JSON.parse(serialize(g));expect(next.k).toBe(v.k);expect(restore(JSON.stringify(next)).board).toEqual(board);
      const fresh=createGame(v.l);if(v.l!==1)expect(gameArtwork(fresh).artKey).not.toBe(v.k);
    }
  });
  it('94关采用真实不规则轮廓，6关保留矩形；外沿同底色4邻接连续且只有一个闭合边框',()=>{
    let shaped=0;
    for(const base of LEVELS){const l=getArtwork(base.id);expect(l.cellCount).toBe(l.target.filter(c=>c!==null).length);
      if(!l.contoured){expect(l.target).not.toContain(null);continue;}shaped++;
      expect(l.target).toContain(null);expect(l.outline).toHaveLength(1);expect(l.outline[0][0]).toEqual(l.outline[0].at(-1));
      let area=0;for(let i=1;i<l.outline[0].length;i++){const [x,y]=l.outline[0][i-1],[nx,ny]=l.outline[0][i];expect(Math.abs(nx-x)+Math.abs(ny-y)).toBe(1);area+=x*ny-nx*y;}
      expect(Math.abs(area)/2).toBe(l.cellCount);
      const q=[l.boundary[0]],seen=new Set(q);for(let i=0;i<q.length;i++)for(const n of neighbors(q[i],l.width,l.height))if(l.target[n]===0&&!seen.has(n)){seen.add(n);q.push(n);}
      expect(l.boundary.every(i=>l.target[i]===0&&seen.has(i))).toBe(true);
      expect(getArtwork(l.id,false)).toBe(base);expect(l.artKey).toBe(base.artKey);
    }
    expect(shaped).toBe(94);expect(getArtwork(1).cellCount).toBe(120);
    expect(readFileSync(new URL('../public/readability.css',import.meta.url),'utf8')).toContain('.board-viewport.contoured{background:transparent;box-shadow:none;border-color:transparent}');
  });
  it('新游戏默认使用轮廓，每个随机排列只填有效格，不生成一格一格的碎边',()=>{
    for(const base of LEVELS){const l=getArtwork(base.id);
      for(const seed of [undefined,7,209,20261007]){const g=createGame(base.id,seed);expect(gameArtwork(g)).toBe(l);expect(g.contour).toBe(!!l.contoured);expect(inventoryValid(g)).toBe(true);expect(correctCount(g)).toBeLessThan(l.cellCount);
        expect(l.target.every((c,i)=>c!==null||g.board[i]===null)).toBe(true);
      }
      if(l.contoured){const g=createGame(l.id),edgeGroups=l.boundary.filter(i=>g.board[i]!==l.target[i]).map(i=>connected(g,i).length);expect(Math.max(...edgeGroups)).toBeGreaterThanOrEqual(20);expect(edgeGroups.filter(n=>n===1).length).toBeLessThanOrEqual(1);}
    }
  });
  it('留白不是空槽，取豆、放豆与损坏库存都拒绝图形外的位置',()=>{
    const g=createGame(2),l=gameArtwork(g),outside=l.target.findIndex(c=>c===null),source=g.board.findIndex((v,i)=>l.target[i]!==null&&v!==l.target[i]);
    selectBoard(g,source);const before=structuredClone(g);expect(selectBoard(g,outside).reason).toBe('outside');expect(place(g,outside).reason).toBe('outside');expect(connected(g,outside,'hole')).toEqual([]);expect(g).toEqual(before);
    const v=JSON.parse(serialize(g));v.b=v.b.slice(0,outside)+'0'+v.b.slice(outside+1);expect(restore(JSON.stringify(v))).toBeNull();g.board[outside]=0;expect(inventoryValid(g)).toBe(false);
  });
  it('完成度、整色完成和胜利只统计有效格，不把轮廓外的留白计入',()=>{
    for(const base of LEVELS){const g=createGame(base.id),l=gameArtwork(g);g.board=[...l.target];expect(correctCount(g)).toBe(l.cellCount);expect(isWon(g)).toBe(true);expect(completedColors(g)).toEqual(new Set(l.target.filter(c=>c!==null)));
      const index=l.target.findIndex(c=>c!==null),color=l.target[index];g.board[index]=null;g.tray[0]=color;expect(correctCount(g)).toBe(l.cellCount-1);expect(isWon(g)).toBe(false);expect(completedColors(g).has(color)).toBe(false);expect(inventoryValid(g)).toBe(true);
    }
  });
  it('所有100关的旧v3矩形存档原样继续，板豆、暂存、时间、空间和道具全部保留',()=>{
    for(const base of LEVELS){const g=newGame(base.id);addRow(g);addRow(g);selectBoard(g,g.board.findIndex((v,i)=>v!==base.target[i]));storeSelection(g);g.remaining=87;g.elapsed=321;g.extensions=4;g.tools={magnet:8,brush:7};
      const v=JSON.parse(serialize(g));v.v=3;delete v.q;const restored=restore(JSON.stringify(v));expect(restored).not.toBeNull();expect(restored.contour).toBe(false);expect(gameArtwork(restored)).toBe(base);
      for(const field of ['board','tray','rows','remaining','elapsed','moves','extensions','tools'])expect(restored[field]).toEqual(g[field]);expect(restored.artworkMigrated).toBeUndefined();expect(inventoryValid(restored)).toBe(true);
      const next=JSON.parse(serialize(restored));expect(next.v).toBe(4);expect(next.q).toBe(0);expect(restore(JSON.stringify(next)).board).toEqual(g.board);
    }
  });
  it('v4存档显式区分轮廓与矩形，100关刷新均恢复准确库存与空行',()=>{
    for(const base of LEVELS){const g=createGame(base.id),l=gameArtwork(g);selectBoard(g,g.board.findIndex((v,i)=>l.target[i]!==null&&v!==l.target[i]));storeSelection(g);for(let i=0;i<6;i++)addRow(g);g.remaining=93;
      const raw=serialize(g),v=JSON.parse(raw),r=restore(raw);expect(v.v).toBe(4);expect(v.q).toBe(l.contoured?1:0);expect(encodeURIComponent(raw).length).toBeLessThan(3500);expect(r.contour).toBe(g.contour);expect(r.board).toEqual(g.board);expect(r.tray).toEqual(g.tray);expect(r.rows).toBe(8);expect(r.remaining).toBe(93);expect(inventoryValid(r)).toBe(true);
      v.q=2;expect(restore(JSON.stringify(v))).toBeNull();if(!l.contoured){v.q=1;expect(restore(JSON.stringify(v))).toBeNull();}
    }
  });
  it('所有100关的新轮廓用普通取放完整通关，空白区不导致死锁，暂存仅受剩余空位限制',()=>{
    for(const base of LEVELS){const g=createGame(base.id),l=gameArtwork(g);while(g.tray.length<l.cellCount)addRow(g);
      for(let i=0;i<g.board.length;i++)if(l.target[i]!==null&&g.board[i]!==null&&g.board[i]!==l.target[i]){expect(selectBoard(g,i).ok).toBe(true);const expected=Math.min(g.selection.indices.length,g.tray.filter(c=>c===null).length);const result=storeSelection(g);expect(result.moved).toBe(expected);expect(inventoryValid(g)).toBe(true);}
      let steps=0;while(g.status!=='won'&&steps++<=l.cellCount){const i=g.board.findIndex((v,i)=>v===null&&l.target[i]!==null),slot=g.tray.findIndex(c=>c===l.target[i]);expect(slot).toBeGreaterThanOrEqual(0);selectTray(g,slot);expect(place(g,i).ok).toBe(true);expect(inventoryValid(g)).toBe(true);}
      expect(g.status).toBe('won');expect(g.board).toEqual(l.target);expect(g.tray.every(v=>v===null)).toBe(true);
    }
  });
  it('磁铁、刷子、撤销与整色完成计算在不规则关卡不填入留白',()=>{
    for(const base of LEVELS){const g=createGame(base.id),l=gameArtwork(g);selectBoard(g,g.board.findIndex((v,i)=>l.target[i]!==null&&v!==l.target[i]));storeSelection(g);const before=structuredClone(g);g.tools.magnet++;expect(magnet(g).ok).toBe(true);expect(inventoryValid(g)).toBe(true);expect(undo(g)).toBe(true);expect(g.board).toEqual(before.board);
      let steps=0;while(g.status!=='won'&&steps++<l.cellCount){g.tools.magnet++;expect(magnet(g).ok).toBe(true);expect(inventoryValid(g)).toBe(true);}expect(g.status).toBe('won');expect(completedColors(g)).toEqual(new Set(l.target.filter(c=>c!==null)));
      const b=createGame(base.id);b.board=[...l.target];const hole=l.target.findIndex(c=>c!==null);b.board[hole]=null;b.tray[0]=l.target[hole];expect(brush(b).won).toBe(true);expect(inventoryValid(b)).toBe(true);
    }
  });
});
