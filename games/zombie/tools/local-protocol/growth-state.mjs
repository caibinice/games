import { SKIN_CATALOG as T } from './skin-catalog.mjs';
const skin = new Map(T.SkinBaseConfig.map((r) => [r.SkinID, r])),
  merc = new Map(T.MercenaryBaseConfig.map((r) => [r.ID, r]));
const baseline = (p) =>
  JSON.stringify([
    p.forms ?? [],
    p.outfits ?? [],
    p.equippedForm ?? 0,
    p.equippedOutfit ?? 0,
    p.mercs ?? [],
    p.activeMerc ?? 0,
  ]);
export function growthState(role, p) {
  if (role.localGrowth?.baseline === baseline(p)) return structuredClone(role.localGrowth);
  return {
    baseline: baseline(p),
    skins: Object.fromEntries([...(p.forms || []), ...(p.outfits || [])].map((id) => [id, 1])),
    selected: { 1: p.equippedOutfit || 0, 2: p.equippedForm || 0, 3: 0 },
    mercs: Object.fromEntries(
      (p.mercs || []).map((id) => [id, { level: 1, quality: merc.get(id).InitQualityLv }]),
    ),
    slots: [p.activeMerc || 0, 0],
  };
}
export function skinSlots(type) {
  const rows = T.SkinExtraConfig.filter((r) => r.SkinType === type);
  return [...new Set(rows.map((r) => r.Slot))].map((Slot) => ({
    Slot,
    EffectSkinID: 0,
    SubSlotEntry: rows
      .filter((r) => r.Slot === Slot)
      .map((r) => ({ SubID: r.SubSlot, SlotSkinID: 0 })),
  }));
}
export function skinLoadout(s, type, page = 0) {
  const saved = s.extra?.[type]?.[page];
  if (saved) return structuredClone(saved);
  const slots = skinSlots(type),
    id = s.selected[type] || 0;
  // Older personal-server saves only recorded the worn appearance. Migrate its
  // primary effect once logically; an explicitly saved empty page stays empty.
  if (page === 0 && id && s.skins[id] && slots[0]) {
    slots[0].EffectSkinID = id;
    if (slots[0].SubSlotEntry[0]) slots[0].SubSlotEntry[0].SlotSkinID = id;
  }
  return slots;
}
export function growthData(role, p) {
  const s = growthState(role, p);
  return {
    SkinData: {
      SkinList: [1, 2, 3, 4, 5]
        .filter((type) =>
          Object.keys(s.skins).some((id) =>
            [type, type === 1 ? 4 : type === 2 ? 5 : 0].includes(skin.get(Number(id))?.SkinType),
          ),
        )
        .map((type) => ({
          SkinType: type,
          SkinList: Object.entries(s.skins)
            .filter(([id]) => skin.get(Number(id))?.SkinType === type)
            .map(([SkinID, SkinLevel]) => ({ SkinID: Number(SkinID), SkinLevel })),
          SkinChooseInfo: {
            CurSkinID: s.selected[type] || s.selected[type === 1 ? 4 : type === 2 ? 5 : 0] || 0,
            PageIdx: s.pages?.[type] ?? 0,
            ChooseExtraSkinList: skinLoadout(s, type, s.pages?.[type] ?? 0),
          },
        })),
    },
    MercenaryData: {
      Slot1: s.slots[0],
      Slot2: s.slots[1],
      MercenaryList: Object.entries(s.mercs).map(([id, m]) => ({
        ID: Number(id),
        Quality: m.quality,
        Level: m.level,
      })),
    },
  };
}
export function battleSkinData(role, p) {
  const s = growthState(role, p),
    raw = growthData(role, p).SkinData;
  return {
    SkinList: [1, 2, 3]
      .map((type) => {
        const normal = raw.SkinList.find((r) => r.SkinType === type),
          advanced = raw.SkinList.find((r) => r.SkinType === (type === 1 ? 4 : type === 2 ? 5 : 0));
        if (!normal && !advanced) return null;
        const activePage = s.pages?.[type] ?? s.pages?.[type === 1 ? 4 : type === 2 ? 5 : 0] ?? 0;
        const owned = [...(normal?.SkinList || []), ...(advanced?.SkinList || [])],
          info = {
            CurSkinID: normal?.SkinChooseInfo.CurSkinID || 0,
            PageIdx: activePage,
            ChooseExtraSkinList: skinLoadout(s, type, activePage),
          };
        if (advanced?.SkinChooseInfo.CurSkinID) info.CurSkinID = advanced.SkinChooseInfo.CurSkinID;
        if (advanced)
          for (const slot of skinLoadout(s, advanced.SkinType, activePage)) {
            const existing = info.ChooseExtraSkinList.findIndex((r) => r.Slot === slot.Slot);
            if (existing < 0) info.ChooseExtraSkinList.push(structuredClone(slot));
            else if (slot.EffectSkinID || slot.SubSlotEntry.some((r) => r.SlotSkinID))
              info.ChooseExtraSkinList[existing] = structuredClone(slot);
          }
        for (const slot of info.ChooseExtraSkinList) {
          const first = slot.SubSlotEntry.find((r) => r.SubID === 1);
          if (
            first &&
            !first.SlotSkinID &&
            slot.EffectSkinID &&
            owned.some((r) => r.SkinID === slot.EffectSkinID)
          )
            first.SlotSkinID = slot.EffectSkinID;
        }
        return { SkinType: type, SkinList: owned, SkinChooseInfo: info };
      })
      .filter(Boolean),
  };
}
export function growthAction(request, role, p, bag, gold) {
  const s = growthState(role, p),
    fail = () => ({ ret: 1 }),
    pay = (items = [], currency = 0) => {
      if (p.freeActions && [5801, 5805, 29304].includes(request.cmd)) return true;
      const total = new Map();
      for (const [id, n] of items) if (n > 0) total.set(id, (total.get(id) || 0) + n);
      if (
        gold < currency ||
        [...total].some(
          ([id, n]) =>
            (bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === id)?.StackCnt || 0) < n,
        )
      )
        return false;
      for (const [id, n] of total)
        bag.ItemData.find((i) => i.ItemType === 1 && i.ItemID === id).StackCnt -= n;
      gold -= currency;
      return true;
    };
  const c = request.cmd,
    b = request.body;
  let id = 0,
    newLevel = 0;
  if ([29302, 29304, 29306].includes(c)) {
    if (b.length !== 8) throw Error('Invalid skin action request');
    id = b.readUInt32BE();
    const type = b.readUInt32BE(4),
      r = skin.get(id),
      level = s.skins[id] || 0;
    if (![1, 2, 3, 4, 5].includes(type) || (id && r?.SkinType !== type)) return fail();
    if (c === 29306) {
      if (id && !level) return fail();
      s.selected[type] = id;
      if (id && [1, 2, 4, 5].includes(type)) s.selected[type < 3 ? type + 3 : type - 3] = 0;
    } else if (c === 29302) {
      const costs = T.SkinLevelConfig.find((s) => s.SkinID === id && s.SkinLevel === 1)
          ?.CostItem || [{ ItemID: r?.CostItemID, ItemCnt: r?.CostItemCnt }],
        chosen = costs.find(
          (i) =>
            i.ItemCnt > 0 &&
            (bag.ItemData.find((b) => b.ItemType === 1 && b.ItemID === i.ItemID)?.StackCnt || 0) >=
              i.ItemCnt,
        );
      if (
        !r ||
        level ||
        (!p.freeActions &&
          (r.PreActiveSkinID.some((pre) => pre && !s.skins[pre]) ||
            !chosen ||
            !pay([[chosen.ItemID, chosen.ItemCnt]])))
      )
        return fail();
      s.skins[id] = newLevel = 1;
    } else {
      const next = T.SkinLevelConfig.find((r) => r.SkinID === id && r.SkinLevel === level + 1),
        chosen = next?.CostItem.find(
          (i) =>
            i.ItemCnt > 0 &&
            (bag.ItemData.find((b) => b.ItemType === 1 && b.ItemID === i.ItemID)?.StackCnt || 0) >=
              i.ItemCnt,
        );
      if (
        !level ||
        !next ||
        (!p.freeActions && (!chosen || !pay([[chosen.ItemID, chosen.ItemCnt]])))
      )
        return fail();
      s.skins[id] = newLevel = level + 1;
    }
  } else if (c === 5807) {
    if (b.length !== 8) throw Error('Invalid mercenary use request');
    const slots = [b.readInt32BE(), b.readInt32BE(4)];
    if (slots.some((id) => id && !s.mercs[id]) || (slots[0] && slots[0] === slots[1]))
      return fail();
    s.slots = slots;
  } else {
    if (b.length !== 4) throw Error('Invalid mercenary growth request');
    id = b.readInt32BE();
    const r = merc.get(id),
      own = s.mercs[id];
    if (!r) return fail();
    if (c === 5803) {
      if (
        own ||
        ![0, 2].includes(r.CurrencyType) ||
        !pay(
          [[r.CostItem.CostItemID, r.CostItem.CostItemCnt]],
          r.CurrencyType === 2 ? r.CurrencyNum : 0,
        )
      )
        return fail();
      s.mercs[id] = { level: 1, quality: r.InitQualityLv };
    } else {
      if (!own) return fail();
      const table = c === 5801 ? T.MercenaryLevelConfig : T.MercenaryQualityConfig,
        key = c === 5801 ? 'Level' : 'QualityLv',
        current = c === 5801 ? own.level : own.quality,
        row = table.find((r) => r.ID === id && r[key] === current),
        next = table.find((r) => r.ID === id && r[key] === current + 1);
      if (
        !row ||
        !next ||
        ![0, 2].includes(row.CurrencyType) ||
        !pay(
          [[row.CostItem.CostItemID, row.CostItem.CostItemCnt]],
          row.CurrencyType === 2 ? row.CurrencyNum : 0,
        )
      )
        return fail();
      if (c === 5801) own.level++;
      else own.quality++;
    }
  }
  return { ret: 0, role: { ...role, localGrowth: s }, bag, gold, id, newLevel };
}
