import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CLIENT_MAPS,CLIENT_LEVEL_MAPS} from '../public/client-map-data.mjs';
import {clientMap,createClientMaps,mapDestination} from '../public/client-maps.mjs';
import {navigation} from '../public/screens.mjs';

const path=file=>new URL('../public/'+file,import.meta.url);
describe('native map artwork and source IDs',()=>{
 it('covers every normal and elite campaign stage using its native map',()=>{
  for(let level=1;level<=259;level++)for(const base of [1000,2000]){
   const stage={LevelID:base+level},map=clientMap(stage);
   expect(map.MapID).toBe(CLIENT_LEVEL_MAPS[stage.LevelID]);
   expect(map.file).toBeTruthy();expect(existsSync(path(map.file))).toBe(true);
  }
  expect(new Set(Array.from({length:259},(_,i)=>clientMap({LevelID:1001+i}).MapID)).size).toBe(62);
  expect(clientMap({LevelID:1001}).MapID).toBe(101004);
  expect(clientMap({LevelID:1002}).MapID).toBe(101001);
  expect(clientMap({LevelID:1003}).MapID).toBe(101003);
 });
 it('keeps missing activity art explicit and never chooses a random substitute',()=>{
  expect(Object.keys(CLIENT_MAPS)).toHaveLength(79);
  expect(Object.values(CLIENT_MAPS).filter(m=>m.file)).toHaveLength(68);
  expect(clientMap({base:{MapID:101064}})).toMatchObject({MapID:101064,file:null});
  expect(clientMap({LevelID:9999999})).toBeNull();expect(clientMap(null)).toBeNull();
 });
 it('matches published derivatives to verified source hashes and prefab layers',()=>{
  const proof=JSON.parse(readFileSync(path('assets/client-maps/provenance.json'),'utf8'));
  expect(proof.apk_sha256).toBe('7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6');
  expect(proof.level_mappings).toBe(6257);expect(proof.prefabs[101001].layers).toHaveLength(3);
  for(const output of proof.outputs)expect(createHash('sha256').update(readFileSync(path(output.file))).digest('hex')).toBe(output.sha256);
  for(const prefab of Object.values(proof.prefabs))for(const layer of prefab.layers){expect(typeof layer.sprite_path_id).toBe('string');expect(BigInt(layer.sprite_path_id)).not.toBe(0n);}
 });
 it('preserves native aspect ratio in the independent web camera',()=>{
  const dest=mapDestination(540,473,1024);expect(dest.width).toBe(540);expect(dest.height/dest.width).toBeCloseTo(1024/473,8);
 });
 it('loads lazily, keeps just the selected image, and falls back on failures',()=>{
  const images=[],draws=[];
  class FakeImage{constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;images.push(this);}}
  const context={fillRect(){},drawImage(...args){draws.push(args);}},maps=createClientMaps(context,FakeImage);
  expect(images).toHaveLength(0);expect(maps.draw()).toBe(false);
  maps.select({LevelID:1001});expect(images).toHaveLength(1);expect(maps.mapId).toBe(101004);expect(maps.draw()).toBe(false);
  images[0].complete=true;images[0].naturalWidth=473;images[0].naturalHeight=1024;
  expect(maps.draw()).toBe(true);expect(draws[0][0]).toBe(images[0]);
  maps.select({LevelID:1001});expect(images).toHaveLength(1);
  maps.select({LevelID:1002});expect(images).toHaveLength(2);expect(maps.draw()).toBe(false);
  images[1].complete=true;expect(maps.draw()).toBe(false); // HTTP/decode failure.
  maps.select({base:{MapID:101064}});expect(images).toHaveLength(2);expect(maps.draw()).toBe(false);
  maps.select(null);expect(maps.mapId).toBeNull();expect(maps.draw()).toBe(false);
 });
 it('uses six APK sprite tabs in the native controller order',()=>{const ids=['shop','character','battle','core','base','guild'],icons=['sd','zb','zd','hx','bl','jt'];let html=navigation('battle');expect([...html.matchAll(/data-tab="([^"]+)"/g)].map(m=>m[1])).toEqual(ids);for(let i=0;i<ids.length;i++){const file='zmzg_zjm_button_ico_'+icons[i]+(ids[i]==='guild'?'':'2')+'.webp';expect(navigation(ids[i])).toContain(file);expect(existsSync(path('assets/native-ui/'+file))).toBe(true);}expect(html).not.toContain('original-ui');});
});
