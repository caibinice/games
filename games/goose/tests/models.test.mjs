import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {ITEMS} from '../public/catalog.mjs';
// Resolve the renderer import to the installed, pinned library for geometry-only
// tests: public/vendor is intentionally created by build, never committed.
const source=readFileSync(new URL('../public/models.mjs',import.meta.url),'utf8').replace("'./vendor/three.module.js'",JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('three').replace('three.cjs','three.module.js')).href));
const {makeModel,makeBowl}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
describe('Original 3D model geometry',()=>{
 it('every one of the 34 model families has finite, visible geometry',()=>{for(const kind of Object.keys(ITEMS)){const model=makeModel(kind);expect(model.children.length,kind).toBeGreaterThan(0);const box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());expect([size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0),kind).toBe(true);expect(Math.max(size.x,size.y,size.z),kind).toBeGreaterThan(.3);}});
 it('clones share baked geometry but never mutable transforms',()=>{const a=makeModel('skewer'),b=makeModel('skewer');expect(a).not.toBe(b);expect(a.children[0].geometry).toBe(b.children[0].geometry);a.position.x=4;a.children[0].position.y=3;expect(b.position.x).toBe(0);expect(b.children[0].position.y).toBe(0);});
 it('the bin is over four units deep and its static parts use only four batches',()=>{const bowl=makeBowl('#bfdad8'),box=new T.Box3().setFromObject(bowl);expect(box.getSize(new T.Vector3()).y).toBeGreaterThan(4);expect(box.min.y).toBeLessThan(-3.4);expect(box.max.y).toBeGreaterThan(.7);expect(bowl.children.length).toBeLessThanOrEqual(4);});
 it('the collection renderer uses original geometry and the complete-match puff has owned geometry',()=>{const source=readFileSync(new URL('../public/scene.mjs',import.meta.url),'utf8');expect(source).toContain('export class CollectionScene');expect(source).toContain('this.cloudGeometry=new T.SphereGeometry');expect(source).toContain('makeModel(item.kind');expect(source).not.toContain('new T.Mesh(sphere()');});
});
