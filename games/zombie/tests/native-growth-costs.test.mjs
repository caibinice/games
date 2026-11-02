import {describe,it,expect} from 'vitest';
import {createMeta,parseMeta} from '../public/progression.mjs';
import {GROWTH,ensureNative,mercenaryUpgradeCost,upgradeMercenary,skinUpgradeCost,upgradeNativeSkin,nativeCombatStats} from '../public/native-progression.mjs';
import {costView,mercenaryPanel} from '../public/growth-ui.mjs';

const merc=()=>{const p=createMeta();p.gold=1000;const a=ensureNative(p);a.mercenaries[101]={level:1,quality:2};a.goods={100002:10,101101:30};return p;};
const skin=goods=>{const p=createMeta();ensureNative(p).goods=goods;return p;};
describe('native growth costs follow verified APK actions',()=>{
 it('uses the current mercenary row for both payment and the displayed quote',()=>{
  const p=merc(),c=mercenaryUpgradeCost(p,101);expect(c.gold).toBe(102);expect(c.items).toEqual([{id:100002,count:1}]);
  expect(mercenaryPanel(p,101)).toContain('金币 1000 / 102');expect(upgradeMercenary(p,101).ok).toBe(true);
  expect(p.gold).toBe(898);expect(p.native.goods[100002]).toBe(9);expect(p.native.mercenaries[101].level).toBe(2);
  expect(mercenaryUpgradeCost(p,101).gold).toBe(106);
 });
 it('promotes using the current quality cost rather than the following quality cost',()=>{
  const p=merc();expect(mercenaryUpgradeCost(p,101,true).items).toEqual([{id:101101,count:10}]);
  expect(upgradeMercenary(p,101,true).ok).toBe(true);expect(p.native.goods[101101]).toBe(20);expect(p.native.mercenaries[101].quality).toBe(3);
 });
 it('checks the next row before spending at the source level and quality caps',()=>{
  const p=merc(),m=p.native.mercenaries[101];m.level=Math.max(...GROWTH.MercenaryLevelConfig.filter(r=>r.ID===101).map(r=>r.Level));
  m.quality=Math.max(...GROWTH.MercenaryQualityConfig.filter(r=>r.ID===101).map(r=>r.QualityLv));const before=JSON.stringify(p);
  expect(upgradeMercenary(p,101).ok).toBe(false);expect(upgradeMercenary(p,101,true).ok).toBe(false);expect(JSON.stringify(p)).toBe(before);
 });
 it('prefers a skin-specific piece and leaves universal pieces untouched at activation and star-up',()=>{
  const p=skin({81001:3,81902:3});expect(skinUpgradeCost(p,81001).items).toEqual([{id:81001,count:1}]);
  expect(upgradeNativeSkin(p,81001).ok).toBe(true);expect(upgradeNativeSkin(p,81001).ok).toBe(true);
  expect(p.native.goods).toEqual({81001:1,81902:3});expect(parseMeta(p).native.skins[81001]).toBe(2);
 });
 it('accepts universal pieces alone and displays the two materials as alternatives',()=>{
  const p=skin({81902:2}),c=skinUpgradeCost(p,81001);expect(c.items).toEqual([{id:81902,count:1}]);expect(c.alternatives).toHaveLength(2);
  expect(costView(p,c)).toContain('>或</em>');expect(upgradeNativeSkin(p,81001).ok).toBe(true);expect(upgradeNativeSkin(p,81001).ok).toBe(true);
  expect(p.native.goods[81902]).toBe(0);const before=JSON.stringify(p);expect(upgradeNativeSkin(p,81001).ok).toBe(false);expect(JSON.stringify(p)).toBe(before);
 });
 it('enforces source prerequisite skins without consuming materials',()=>{
  const r=GROWTH.SkinBaseConfig.find(r=>r.PreActiveSkinID.some(Boolean)&&GROWTH.SkinLevelConfig.some(s=>s.SkinID===r.SkinID&&s.SkinLevel===1));
  expect(r).toBeTruthy();const p=skin({81902:100,82902:100});
  const before=JSON.stringify(p);expect(upgradeNativeSkin(p,r.SkinID)).toMatchObject({ok:false,reason:'请先激活前置外观'});expect(JSON.stringify(p)).toBe(before);
 });
 it('carries the upgraded mercenary and skin into the web battle profile',()=>{
  const p=merc();p.native.goods[81001]=3;upgradeMercenary(p,101);upgradeMercenary(p,101,true);upgradeNativeSkin(p,81001);upgradeNativeSkin(p,81001);
  p.native.mercenary=101;p.native.skinSlots[1]=81001;const stats=nativeCombatStats(parseMeta(p));
  expect(stats.mercenary).toMatchObject({id:101,level:2,quality:3});expect(stats.nativePlayerModel).toBe(11001);expect(stats.nativeSkinBuilds).toContain(600012);
 });
});
