import {
  GROWTH,
  ensureNative,
  nativeGoodCount,
  upgradeNativeSkin,
  unlockNativeGun,
  upgradeMercenary,
} from './native-progression.mjs';
import { DROP_GEMS } from './native-gems.mjs';
import { nativeBoxKind, openNativeRandomBox } from './native-boxes.mjs';
const rows = new Map(GROWTH.GoodsConfig.map((r) => [r.ItemID, r]));
const mercenaryItems = new Map(
  GROWTH.MercenaryBaseConfig.filter((r) => r.CostItem?.CostItemID).map((r) => [
    r.CostItem.CostItemID,
    r.ID,
  ]),
);
export const activityItemEffect = (id) =>
  mercenaryItems.has(Number(id))
    ? '佣兵招募 / 升品'
    : nativeBoxKind(id) === 'choice'
      ? '自选宝箱'
      : nativeBoxKind(id) === 'random'
        ? '随机宝箱'
        : Number(id) === 99031
          ? '碧海兑换货币'
          : Number(id) === 2024
            ? '前往碧海凉夏'
            : { 5: '随机宝石', 7: '外观激活 / 升星', 8: '枪械激活 / 装备', 14: '佣兵招募 / 升品' }[
                rows.get(Number(id))?.Func.FuncValue
              ] || '';
export function activityItems(p) {
  return Object.entries(ensureNative(p).goods)
    .filter(([id, n]) => n > 0 && activityItemEffect(id))
    .map(([id, count]) => ({ row: rows.get(Number(id)), count, effect: activityItemEffect(id) }));
}
export function useActivityItem(p, id, count = 1) {
  id = Number(id);
  const row = rows.get(id),
    a = ensureNative(p);
  if (
    !row ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    nativeGoodCount(p, id) < count
  )
    return { ok: false, reason: '道具数量不足或使用数量无效' };
  if (nativeBoxKind(id) === 'choice') return { ok: true, chooseBox: id, rewards: [] };
  if (nativeBoxKind(id) === 'random') return openNativeRandomBox(p, id, count);
  if (id === 99031) return { ok: true, operation: 'bihai', exchange: true, rewards: [] };
  const effect = row.Func.FuncValue,
    target = row.Func.ArrFuncParam[0];
  if (effect === 13 && target === 79) return { ok: true, operation: 'bihai', rewards: [] };
  if (effect === 5) {
    const pool = DROP_GEMS.filter((g) => g.quality === target);
    if (!pool.length) return { ok: false, reason: '该品质暂无源宝石配置' };
    const rewards = [];
    a.goods[id] -= count;
    for (let i = 0; i < count; i++) {
      p.seed = (Math.imul(p.seed, 1664525) + 1013904223) >>> 0;
      const g = pool[Math.floor((p.seed / 4294967296) * pool.length)],
        gemId = 'gem-native:' + g.id;
      p.inventory[gemId] = Math.min(1e9, (p.inventory[gemId] || 0) + 1);
      rewards.push({
        kind: 'gem',
        quality: g.quality,
        gemId,
        count: 1,
        nameText: g.name || row.nameText,
        description: g.description,
      });
    }
    return { ok: true, rewards };
  }
  if (count !== 1) return { ok: false, reason: '激活和养成道具请逐次使用' };
  if (mercenaryItems.has(id))
    return { ...upgradeMercenary(p, mercenaryItems.get(id), true), rewards: [] };
  const out =
    effect === 7
      ? upgradeNativeSkin(p, target)
      : effect === 8
        ? unlockNativeGun(p, target)
        : effect === 14
          ? upgradeMercenary(p, target, true)
          : { ok: false, reason: '该道具功能仍待迁移' };
  return { ...out, rewards: [] };
}
