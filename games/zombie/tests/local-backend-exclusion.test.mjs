import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {runtimeEntries} from '../../../scripts/build.mjs';
import {selectGames} from '../../../scripts/catalog.mjs';
describe('research backend never ships with the web game',()=>{
 it('builds only public runtime files, without Python, tools, profiles, tokens or local logs',()=>{
  const paths=[...runtimeEntries(selectGames('zombie')).keys()];
  expect(paths.some(p=>p==='games/zombie/native-form-preview.mjs')).toBe(true);
  expect(paths.filter(p=>/(?:^|\/)(?:tools|docs|local-protocol-python|control\.token|profile\.json|role-state\.json)(?:\/|$)|\.py$|worker-requests|fixture\.lock/.test(p))).toEqual([]);
 });
 it('has no frontend dependency on the local protocol server',()=>{
  for(const f of ['original-app.mjs','native-form-preview.mjs','gem-refine.mjs']){
   const s=readFileSync(new URL('../public/'+f,import.meta.url),'utf8');expect(s).not.toMatch(/local-protocol|5327[3-6]|5317[3-6]|control\.token/);
  }
 });
});
