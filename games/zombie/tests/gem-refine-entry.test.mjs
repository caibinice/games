import {describe,it,expect} from 'vitest';
import {createMeta} from '../public/progression.mjs';
import {ensureNative} from '../public/native-progression.mjs';
import {DROP_GEMS} from '../public/native-gems.mjs';
import {refinableGemInventory,rollGemRefine} from '../public/gem-refine.mjs';
describe('visible native gem-refine inventory flow',()=>{
 it('lists only owned refinable native gems, preserves locks and filters by source equipment part',()=>{const p=createMeta();p.inventory={};const ids=[4,5,6,7].map(q=>'gem-native:'+DROP_GEMS.find(g=>g.quality===q&&g.part===2).id);for(const id of ids)p.inventory[id]=2;p.locked[ids[3]]=true;const rows=refinableGemInventory(p);expect(rows.map(r=>r.id)).toEqual(ids.slice(1).reverse());expect(rows.map(r=>r.cost.count)).toEqual([20,12,6]);expect(rows[0].locked).toBe(true);expect(refinableGemInventory(p,'armor')).toHaveLength(3);expect(refinableGemInventory(p,'boots')).toEqual([]);});
 it('rolls one from a stack, refreshes the selected gem and never creates a second-choice popup',()=>{const p=createMeta(),id='gem-native:'+DROP_GEMS.find(g=>g.quality===7&&g.part===2).id;p.inventory={[id]:3};ensureNative(p).goods[1001]=50;const r=rollGemRefine(p,id,{type:'inventory'},()=>.8);expect(r.ok).toBe(true);expect(Object.values(p.inventory).reduce((a,b)=>a+b,0)).toBe(3);expect(p.native.goods[1001]).toBe(30);expect(p.native.gemRefine).toBeUndefined();expect(refinableGemInventory(p).some(x=>x.id===r.id)).toBe(true);});
});
