import { NATIVE_BOX_DATA as D } from './native-box-data.mjs';
import {
  GROWTH,
  ensureNative,
  nativeGood,
  grantNativeGood,
  SKILL_IDS,
} from './native-progression.mjs';
export const BOX_BATCH_LIMIT = 100;
export const nativeBoxKind = (id) => (D.choices[id] ? 'choice' : D.random[id] ? 'random' : '');
export function nativeBoxOptions(id) {
  const group = D.choices[id] || D.random[id];
  return (D.groups[group] || []).map(([itemId, count, weight], index) => ({
    index,
    itemId,
    count,
    weight,
    kind: 'goods',
    nameText: nativeGood(itemId).nameText,
    icon: nativeGood(itemId).IconName,
  }));
}
export function nativeBoxCatalog(kind = 'choice') {
  return GROWTH.GoodsConfig.filter((r) =>
    kind === 'random' ? D.random[r.ItemID] : D.choices[r.ItemID],
  );
}
export const nativeBoxArt = (icon) => D.art[icon] || '';
const invalid = (reason) => ({ ok: false, reason });
const validCount = (n) => Number.isSafeInteger(n) && n > 0 && n <= BOX_BATCH_LIMIT;
function commit(p, id, used, rewards, seed) {
  const a = ensureNative(p),
    delta = new Map([[Number(id), -used]]);
  for (const r of rewards) delta.set(r.itemId, (delta.get(r.itemId) || 0) + r.count);
  for (const [itemId, n] of delta)
    if (
      !Number.isSafeInteger(n) ||
      !Number.isSafeInteger((a.goods[itemId] || 0) + n) ||
      (a.goods[itemId] || 0) + n < 0 ||
      (a.goods[itemId] || 0) + n > 1e9
    )
      return invalid('背包数量达到上限，本次未消耗宝箱');
  for (const [itemId, n] of delta)
    if (n > 0) grantNativeGood(p, itemId, n);
    else a.goods[itemId] = (a.goods[itemId] || 0) + n;
  if (seed !== undefined) p.seed = seed;
  for (const [skill, skillId] of Object.entries(SKILL_IDS))
    if (p.skills?.[skill]) p.skills[skill].cards = a.goods[61000 + skillId / 1000] || 0;
  return { ok: true, used, rewards };
}
export function chooseNativeBox(p, id, allocation) {
  id = Number(id);
  if (!D.choices[id] || !allocation || typeof allocation !== 'object' || Array.isArray(allocation))
    return invalid('请选择有效的自选宝箱');
  const options = nativeBoxOptions(id),
    rewards = [];
  let used = 0;
  for (const [key, n] of Object.entries(allocation)) {
    if (!/^(0|[1-9]\d*)$/.test(key) || !options[Number(key)] || !Number.isSafeInteger(n) || n < 0)
      return invalid('奖励选择或数量无效');
    if (n) {
      used += n;
      const r = options[Number(key)];
      rewards.push({ ...r, count: r.count * n });
    }
  }
  if (!validCount(used)) return invalid('请选择1至' + BOX_BATCH_LIMIT + '个宝箱的奖励');
  if ((p.native?.goods?.[id] || 0) < used) return invalid('宝箱数量不足');
  return commit(p, id, used, rewards);
}
export function openNativeRandomBox(p, id, count = 1) {
  id = Number(id);
  if (!D.random[id] || !validCount(count)) return invalid('随机宝箱或使用数量无效');
  if ((p.native?.goods?.[id] || 0) < count) return invalid('宝箱数量不足');
  const pool = nativeBoxOptions(id),
    total = pool.reduce((n, r) => n + r.weight, 0),
    out = new Map();
  let seed = p.seed >>> 0;
  for (let i = 0; i < count; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    let v = (seed / 4294967296) * total;
    const row = pool.find((r) => (v -= r.weight) < 0) || pool.at(-1);
    const old = out.get(row.itemId);
    if (old) old.count += row.count;
    else out.set(row.itemId, { ...row });
  }
  return commit(p, id, count, [...out.values()], seed);
}
// Explicit local free-play supply; not represented as an original paid event.
export function supplyNativeBox(p, id, count = 10) {
  id = Number(id);
  if (!nativeBoxKind(id) || !validCount(count)) return invalid('补给宝箱或数量无效');
  const a = ensureNative(p);
  if ((a.goods[id] || 0) + count > 1e9) return invalid('背包数量达到上限');
  grantNativeGood(p, id, count);
  return { ok: true };
}
