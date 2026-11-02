import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolveNativeLayout} from '../public/native-layout.mjs';
import {OPERATIONS} from '../public/operations.mjs';

const path=new URL('../public/assets/native-operations/',import.meta.url);
const full=JSON.parse(readFileSync(new URL('layouts.json',path),'utf8'));
const bytes=readFileSync(new URL('layouts-compact.json',path));
const compact=JSON.parse(bytes.toString('utf8'));
const relevant=n=>n.name==='m_tfTurnCentre'||/^BoxItem(?: \(\d+\))?$/.test(n.name)||/^[^/]+\/[Bb][Gg]$/.test(n.path)||n.path.includes('/m_goTurnObj')||/^m_itemChildNode(?: \(\d+\))?$/.test(n.name)||/^m_itemBooty(?:[1-8]| \([1-6]\))?$/.test(n.name)||/\/m_itemBooty[^/]*\/Bottom\/m_imgChose$/.test(n.path);
const ordered=page=>{const nodes=resolveNativeLayout(page),by=new Map(nodes.map(n=>[n.rectId,n])),out=[];function visit(id){const n=by.get(id);if(!n)return;if(relevant(n))out.push(n);for(const c of n.children)visit(c);}for(const id of page.rootRectIds)visit(id);return out;};
describe('compact native event geometry',()=>{
 it('covers every current event and reduces transfer size',()=>{for(const o of OPERATIONS)expect(compact[o.page]).toBeTruthy();expect(gzipSync(bytes,{level:9}).length).toBeLessThan(50000);});
 it.each([...new Set(OPERATIONS.map(o=>o.page))])('%s preserves native layer order, transforms and active states',name=>{const a=ordered(full[name]),b=ordered(compact[name]);expect(b.map(n=>n.rectId)).toEqual(a.map(n=>n.rectId));for(let i=0;i<a.length;i++){expect(b[i].active).toBe(a[i].active);expect(b[i].cssMatrix).toEqual(a[i].cssMatrix);expect(b[i].components).toEqual(a[i].components);}});
});
