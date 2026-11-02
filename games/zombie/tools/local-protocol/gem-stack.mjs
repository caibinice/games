import { starterGems } from './native-extra.mjs';
export function gemCounts(items) {
  const out = new Map();
  for (const i of items)
    if (i.ItemType === 3 && i.StackCnt > 0)
      out.set(i.ItemID, (out.get(i.ItemID) || 0) + i.StackCnt);
  return out;
}
export function gemItems(counts, seconds, locks = [], lockCounts = null) {
  if (lockCounts) {
    const out = [];
    for (const [id, total] of counts) {
      const locked = Math.min(total, Math.max(0, lockCounts[id] || 0));
      for (const [n, flag] of [
        [locked, 1],
        [total - locked, 0],
      ])
        if (n > 0) {
          const item = starterGems(seconds, [id])[0];
          item.ItemGID = 92001 + out.length;
          item.StackCnt = n;
          item.Detail.GemDetail.IsLock = flag;
          out.push(item);
        }
    }
    return out;
  }
  const entries = [...counts].filter(([, n]) => n > 0),
    total = entries.reduce((n, [, c]) => n + c, 0);
  // Retain old small-bag ordering; large inventories never expand by quantity.
  const ids =
    total <= 60 ? entries.flatMap(([id, n]) => Array(n).fill(id)) : entries.map(([id]) => id);
  return starterGems(seconds, ids).map((i) => {
    if (total > 60) i.StackCnt = counts.get(i.ItemID);
    i.Detail.GemDetail.IsLock = locks.includes(i.ItemID) ? 1 : 0;
    return i;
  });
}
export function bagWithoutActive(counts, equip, seconds) {
  const remaining = new Map(counts),
    active =
      equip.GemPageData.find((p) => p.GemPageID === equip.UsingPageID)?.GemPageEquipData.flatMap(
        (p) => p.GemList.map((g) => g.GemData),
      ) || [];
  for (const i of active) {
    const n = remaining.get(i.ItemID) || 0;
    if (n < 1) throw Error('Saved page exceeds owned gem count');
    remaining.set(i.ItemID, n - 1);
  }
  return gemItems(remaining, seconds);
}
