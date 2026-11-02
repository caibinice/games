import { CLIENT_GEMS } from '../../public/client-gem-data.mjs';
// Six special rows have UnlockType=1 / UnlockParam=9999 (attack: 99999) in
// ResDef.GemBaseConfig. Keep their definitions for reference, not normal drops.
export const hiddenGemIds = new Set(
  CLIENT_GEMS.filter((g) => g.id % 10 !== g.quality).map((g) => g.id),
);
const replacements = new Map(
  [...hiddenGemIds].filter((id) => id % 100 === 99).map((id) => [id, id - 92]),
);
export const normalGem = (g) => !hiddenGemIds.has(g.id) && g.id < 999000000;
export function migrateHiddenGems(role) {
  const replace = (id) => replacements.get(Number(id)) ?? id;
  const bag = role.localBag;
  if (bag) {
    if (bag.gems) bag.gems = bag.gems.map(replace);
    if (bag.locks) bag.locks = [...new Set(bag.locks.map(replace))];
    for (const field of ['gemCounts', 'lockCounts'])
      if (bag[field]) {
        const counts = {};
        for (const [id, n] of Object.entries(bag[field])) {
          const key = replace(id);
          counts[key] = (counts[key] || 0) + n;
        }
        bag[field] = counts;
      }
  }
  for (const page of role.localEquip?.data?.GemPageData || [])
    for (const part of page.GemPageEquipData || [])
      for (const entry of part.GemList || []) entry.GemData.ItemID = replace(entry.GemData.ItemID);
  return role;
}
