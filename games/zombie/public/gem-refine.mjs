import { CLIENT_GEM_ROLL } from './client-gem-data.mjs';
import { DROP_GEMS, nativeGemInfo } from './native-gems.mjs';
import { ensureNative, spendNative } from './native-progression.mjs';

const max = 1_000_000_000;
const random = (p) => {
  p.seed = (Math.imul(p.seed, 1664525) + 1013904223) >>> 0;
  return p.seed / 4294967296;
};
export const gemRefineCost = (id) => {
  const i = nativeGemInfo(id),
    row = CLIENT_GEM_ROLL.find((r) => r.Quality === i?.native.quality);
  return row?.CanRoll ? { id: row.CostItemID, count: row.CostItemNum } : null;
};
export function refinableGemInventory(p, slot = '') {
  return Object.entries(p.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({
      id,
      count,
      item: nativeGemInfo(id),
      cost: gemRefineCost(id),
      locked: !!p.locked[id],
    }))
    .filter((r) => r.cost && (!slot || r.item.slot === slot))
    .sort(
      (a, b) =>
        b.item.native.quality - a.item.native.quality ||
        a.item.native.part - b.item.native.part ||
        a.item.nativeId - b.item.nativeId,
    );
}
const validSource = (p, id, source) =>
  source?.type === 'inventory'
    ? (p.inventory[id] || 0) > 0
    : source?.type === 'equipped' && p.gear[source.slot]?.gems?.[source.index] === id;
// Preserve the source part and quality. The APK does not contain the live
// server's reroll weights, so the local candidate selection is uniform.
export function pendingGemRefine(p) {
  const pending = ensureNative(p).gemRefine;
  if (!pending) return null;
  const old = nativeGemInfo(pending.oldId),
    next = nativeGemInfo(pending.newId);
  if (
    !old ||
    !next ||
    old.slot !== next.slot ||
    old.rarity !== next.rarity ||
    !DROP_GEMS.some((g) => g.id === next.nativeId) ||
    !gemRefineCost(old.id)
  )
    return null;
  return pending;
}
export function beginGemRefine(p, id, source = { type: 'inventory' }, rng = () => random(p)) {
  if (pendingGemRefine(p)) return { ok: false, reason: '请先决定保留原词条还是替换新词条' };
  const i = nativeGemInfo(id),
    cost = gemRefineCost(id);
  if (!i || !cost) return { ok: false, reason: '传说及以上的客户端宝石才可洗练' };
  if (!validSource(p, id, source)) return { ok: false, reason: '宝石位置已变化，请重新选择' };
  const pool = DROP_GEMS.filter((g) => g.part === i.native.part && g.quality === i.native.quality);
  if (!pool.length) return { ok: false, reason: '该部位暂时没有可用词条' };
  if ((ensureNative(p).goods[cost.id] || 0) < cost.count)
    return { ok: false, reason: '焕新试剂不足' };
  const r = Math.max(0, Math.min(0.999999999, Number(rng()) || 0)),
    candidate = pool[Math.floor(r * pool.length)];
  const paid = spendNative(p, { items: [cost] });
  if (!paid.ok) return paid;
  const pending = {
    oldId: id,
    newId: 'gem-native:' + candidate.id,
    source:
      source.type === 'equipped'
        ? { type: 'equipped', slot: source.slot, index: source.index }
        : { type: 'inventory' },
  };
  ensureNative(p).gemRefine = pending;
  return { ok: true, pending };
}
export function finishGemRefine(p, replace) {
  const pending = pendingGemRefine(p);
  if (!pending) return { ok: false, reason: '没有待确认的洗练结果' };
  if (!replace) {
    delete ensureNative(p).gemRefine;
    return { ok: true, id: pending.oldId, source: pending.source };
  }
  if (!validSource(p, pending.oldId, pending.source))
    return { ok: false, reason: '原宝石已移动，请放回原位置后替换，或保留原词条' };
  if (pending.source.type === 'inventory') {
    if (pending.newId !== pending.oldId) {
      if ((p.inventory[pending.newId] || 0) >= max)
        return { ok: false, reason: '目标宝石数量已达上限' };
      p.inventory[pending.oldId]--;
      p.inventory[pending.newId] = (p.inventory[pending.newId] || 0) + 1;
    }
  } else p.gear[pending.source.slot].gems[pending.source.index] = pending.newId;
  delete ensureNative(p).gemRefine;
  return { ok: true, id: pending.newId, source: pending.source };
}
// Observed in the pinned APK: CSGemRollRes immediately updates the gem. The
// begin/finish API above remains only to settle pending saves from older builds.
export function rollGemRefine(p, id, source = { type: 'inventory' }, rng = () => random(p)) {
  if (source.type !== 'inventory') return { ok: false, reason: '请先卸下宝石，再到背包洗练' };
  if (p.locked[id]) return { ok: false, reason: '请先解除宝石锁定' };
  const snapshot = {
    inventory: { ...p.inventory },
    goods: { ...ensureNative(p).goods },
    seed: p.seed,
  };
  const begun = beginGemRefine(p, id, source, rng);
  if (!begun.ok) return begun;
  const result = finishGemRefine(p, true);
  if (!result.ok) {
    p.inventory = snapshot.inventory;
    ensureNative(p).goods = snapshot.goods;
    p.seed = snapshot.seed;
    delete ensureNative(p).gemRefine;
  }
  return result;
}
