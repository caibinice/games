import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {treasureBoardView} from '../public/operations-ui.mjs';
import {treasureRings} from '../public/board-lotteries.mjs';
const root=new URL('../public/assets/native-operations/',import.meta.url);
const pages=JSON.parse(readFileSync(new URL('layouts-compact.json',root),'utf8'));
describe('TreasureHuntPage source actor and landing geometry',()=>{
 it('retains the exact prefab-referenced skeleton rather than a reward showcase model',()=>{
  const base=new URL('treasure-player/',root),source=JSON.parse(readFileSync(new URL('source.json',base),'utf8'));
  expect(source.bundle).toBe('assets_actormodel_ui_ui_009_zhadanxiaoren.ab');
  expect(String(source.skeletonDataPathID)).toBe('-2291954376038960331');
  const data=Buffer.from(JSON.parse(readFileSync(new URL('player-skeleton.json',base),'utf8')),'base64');
  expect(createHash('sha256').update(data).digest('hex')).toBe(source.sources.find(r=>r.file.includes('.skel-')).sha256);
  for(const name of ['idle1','idle2','run1','run2','run3','skill1'])expect(data.includes(Buffer.from(name))).toBe(true);
 });
 it.each([[1,1,4],[2,2,12],[6,3,20]])('preserves source ring cell order for layer %i / circle %i', (layer,circle,count)=>{
  const ring=treasureRings(layer).find(r=>r.id===circle),view=treasureBoardView(pages.treasurehuntpage,1334,{layer,circle,cells:[]});
  expect(view.points).toHaveLength(count);expect(view.points.map(p=>p.id)).toEqual(ring.cells.map(r=>r.CellID));
  expect(view.points.filter(p=>p.big).map(p=>p.id)).toEqual(ring.cells.filter(r=>r.IsBig).map(r=>r.CellID));
  expect(view.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>0&&p.x<750&&p.y>200&&p.y<1100)).toBe(true);
  expect(new Set(view.points.map(p=>`${p.x}:${p.y}`)).size).toBe(count);
 });
 it('moves every landing position with the native long-screen center anchor',()=>{
  const state={layer:6,circle:3,cells:[]},a=treasureBoardView(pages.treasurehuntpage,1334,state),b=treasureBoardView(pages.treasurehuntpage,1534,state);
  for(let i=0;i<a.points.length;i++){expect(b.points[i].x).toBe(a.points[i].x);expect(b.points[i].y-a.points[i].y).toBe(100);}
 });
});
