// Local state transitions for the pinned APK. Pages reference the same owned
// gems; only the active page is removed from the bag presented to the client.
import { starterEquipment, starterGems } from './native-extra.mjs';
import { CLIENT_GEMS } from '../../public/client-gem-data.mjs';
import { gemCounts, gemItems, bagWithoutActive } from './gem-stack.mjs';
const gems = new Map(CLIENT_GEMS.map((g) => [g.id, g]));
export const gemBaseline = (profile) => JSON.stringify(profile.gems ?? null);
export const activeGems = (equip) =>
  equip.GemPageData.find((p) => p.GemPageID === equip.UsingPageID)?.GemPageEquipData.flatMap((p) =>
    p.GemList.map((g) => g.GemData),
  ) ?? [];
export function equipmentFor(role, seconds, profile = {}) {
  const saved = role.localEquip;
  const data =
    saved?.version === 1 && saved.baseline === gemBaseline(profile)
      ? structuredClone(saved.data)
      : starterEquipment(seconds);
  if (
    saved?.version === 1 &&
    saved.baseline !== gemBaseline(profile) &&
    Array.isArray(saved.data?.EquipList)
  )
    data.EquipList = structuredClone(saved.data.EquipList);
  // Early synthetic saves used prefix 0, absent from the pinned APK's table.
  // Migrate only that invalid value; retain earned levels and gem layouts.
  for (const item of data.EquipList ?? []) {
    const d = item.Detail?.EquipDetail;
    if (d?.Prefix === 0) d.Prefix = 1;
    if (d?.InitPrefix === 0) d.InitPrefix = 1;
  }
  if (![1, 2, 3].includes(data.UsingPageID) || data.GemPageData?.length !== 3)
    throw Error('Invalid saved local equipment pages');
  for (const page of data.GemPageData) {
    if (![1, 2, 3].includes(page.GemPageID) || page.GemPageEquipData?.length !== 6)
      throw Error('Invalid saved local gem page');
    for (const part of page.GemPageEquipData) {
      if (![1, 2, 3, 4, 5, 6].includes(part.Type) || part.GemList?.length > 5)
        throw Error('Invalid saved local gem part');
      const slots = new Set();
      for (const entry of part.GemList) {
        if (
          !Number.isInteger(entry.OrderID) ||
          entry.OrderID < 1 ||
          entry.OrderID > 5 ||
          slots.has(entry.OrderID) ||
          gems.get(entry.GemData?.ItemID)?.part !== part.Type
        )
          throw Error('Invalid saved local gem slot');
        slots.add(entry.OrderID);
      }
    }
  }
  return data;
}
export function subtractActive(ids, equip) {
  const out = [...ids];
  for (const gem of activeGems(equip)) {
    const at = out.indexOf(gem.ItemID);
    if (at < 0) throw Error('Saved page exceeds owned gem count');
    out.splice(at, 1);
  }
  return out;
}
export const saveEquipment = (role, profile, equip) => ({
  ...role,
  localEquip: { version: 1, baseline: gemBaseline(profile), data: equip },
});
export const gemInAnyPage = (equip, id) =>
  equip.GemPageData.some((p) =>
    p.GemPageEquipData.some((e) => e.GemList.some((g) => g.GemData.ItemID === id)),
  );
export function applyGemAction(cmd, body, equip, bag, seconds, locks = []) {
  const fail = () => ({ ret: 1 });
  const lockedCounts = Object.fromEntries(
    gemCounts(bag.ItemData.filter((i) => i.Detail?.GemDetail?.IsLock === 1)),
  );
  if (cmd === 4208) {
    if (body.length !== 4) throw Error('Invalid gem-page request length');
    const page = body.readUInt32BE();
    if (![1, 2, 3].includes(page)) return fail();
    const owned = gemCounts([...bag.ItemData, ...activeGems(equip)]);
    equip.UsingPageID = page;
    bag.ItemData = [
      ...bagWithoutActive(owned, equip, seconds),
      ...bag.ItemData.filter((i) => i.ItemType !== 3),
    ];
  } else {
    const lock = cmd === 4210,
      offset = lock ? 1 : 0;
    if (body.length !== 16 + offset) throw Error('Invalid gem action request length');
    const [id, page, part, order] = [0, 4, 8, 12].map((at) => body.readUInt32BE(at + offset)),
      source = gems.get(id),
      target = equip.GemPageData.find((p) => p.GemPageID === page)?.GemPageEquipData.find(
        (p) => p.Type === part,
      ),
      existing = target?.GemList.find((g) => g.OrderID === order);
    if (!source || source.part !== part) return fail();
    if (lock) {
      const state = body[0];
      if (
        state > 1 ||
        !(page === 0
          ? bag.ItemData.some((i) => i.ItemType === 3 && i.ItemID === id)
          : existing?.GemData.ItemID === id)
      )
        return fail();
      if (page === 0) {
        if (state) lockedCounts[id] = Math.max(1, lockedCounts[id] || 0);
        else delete lockedCounts[id];
      } else existing.GemData.Detail.GemDetail.IsLock = state;
    } else {
      if (page !== equip.UsingPageID || order < 1 || order > 5 || !target) return fail();
      const owned = gemCounts([...bag.ItemData, ...activeGems(equip)]);
      if (cmd === 4200) {
        if (!bag.ItemData.some((i) => i.ItemType === 3 && i.ItemID === id && i.StackCnt > 0))
          return fail();
        // The client only allows one effect family per equipment part.
        if (
          target.GemList.some(
            (g) => g.OrderID !== order && gems.get(g.GemData.ItemID)?.type === source.type,
          )
        )
          return fail();
        const item = {
          ...starterGems(seconds, [id])[0],
          ItemGID: 94000 + page * 100 + part * 10 + order,
        };
        target.GemList = target.GemList.filter((g) => g.OrderID !== order);
        target.GemList.push({ OrderID: order, GemData: item });
        target.GemList.sort((a, b) => a.OrderID - b.OrderID);
      } else if (cmd === 4206) {
        if (existing?.GemData.ItemID !== id) return fail();
        target.GemList = target.GemList.filter((g) => g.OrderID !== order);
      } else return fail();
      bag.ItemData = [
        ...bagWithoutActive(owned, equip, seconds),
        ...bag.ItemData.filter((i) => i.ItemType !== 3),
      ];
    }
  }
  bag.ItemData = [
    ...gemItems(gemCounts(bag.ItemData), seconds, [], lockedCounts),
    ...bag.ItemData.filter((i) => i.ItemType !== 3),
  ];
  locks = Object.keys(lockedCounts)
    .filter((id) => lockedCounts[id] > 0)
    .map(Number);
  return { ret: 0, equip, bag, locks };
}
