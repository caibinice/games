import {
  CLIENT_NATIVE_BASES as NATIVE_BASES,
  CLIENT_NATIVE_GRAPHS as NATIVE_GRAPHS,
} from './native-skill-extra.mjs';
import { NATIVE_GROWTH as DATA } from './native-growth-data.mjs';
export const GROWTH = DATA.tables;
export const SKILL_IDS = {
  grenade: 1000,
  frost: 2000,
  lightning: 3000,
  laser: 4000,
  vehicle: 5000,
  wind: 6000,
  airdrop: 7000,
  guided: 8000,
  iceblast: 9000,
  electron: 10000,
  vortex: 11000,
  drone: 12000,
  fuel: 13000,
  electric: 14000,
};
export const PARTS = { helmet: 1, armor: 2, boots: 3, bracer: 4, pants: 5, gloves: 6 };
const MAX = 1e9,
  n = (v, d = 0, max = MAX) =>
    Number.isFinite(Number(v)) ? Math.max(0, Math.min(max, Math.trunc(Number(v)))) : d;
const index = (rows, key) => new Map(rows.map((r) => [key(r), r]));
const goods = index(GROWTH.GoodsConfig, (r) => r.ItemID),
  cores = index(GROWTH.MagicSkillLevelConfig, (r) => r.ID + ':' + r.Level),
  gearLevels = index(GROWTH.EquipUpLevelConfig, (r) => r.Type + ':' + r.Level),
  guns = index(GROWTH.GunBaseConfig, (r) => r.ID),
  gunNodes = index(GROWTH.GunSkillConfig, (r) => r.GunSkillLevel),
  mercs = index(GROWTH.MercenaryBaseConfig, (r) => r.ID),
  mercLevels = index(GROWTH.MercenaryLevelConfig, (r) => r.ID + ':' + r.Level),
  mercQualities = index(GROWTH.MercenaryQualityConfig, (r) => r.ID + ':' + r.QualityLv),
  skins = index(GROWTH.SkinBaseConfig, (r) => r.SkinID);
export function ensureNative(p) {
  if (p.native?.version === 1) return p.native;
  const cards = {};
  for (const [key, id] of Object.entries(SKILL_IDS)) {
    const row = GROWTH.MagicSkillConfig.find((r) => r.ID === id);
    if (row && p.skills?.[key]?.cards) cards[row.PieceItemID] = p.skills[key].cards;
  }
  p.native = {
    version: 1,
    goods: { 50001: p.materials?.forge || 0, 90002: 0, 100002: 0, ...cards },
    guns: { 1: 1 },
    gun: 1,
    gunSkillLevel: 0,
    mercenaries: {},
    mercenary: 0,
    skins: {},
    skinSlots: { 1: 0, 2: 0, 3: 0 },
    operations: {},
  };
  return p.native;
}
export function parseNative(p, raw) {
  const a = ensureNative(p);
  if (!raw || raw.version !== 1) return a;
  a.goods = {};
  for (const [id, c] of Object.entries(raw.goods || {}).slice(0, 5000))
    if (/^\d+$/.test(id) && n(c) > 0) a.goods[id] = n(c);
  a.guns = { 1: 1 };
  for (const [id, v] of Object.entries(raw.guns || {}))
    if (guns.has(Number(id))) a.guns[id] = n(v, 1, 5) || 1;
  a.gun = a.guns[raw.gun] ? Number(raw.gun) : 1;
  a.gunSkillLevel = n(raw.gunSkillLevel, 0, 270);
  a.mercenaries = {};
  for (const [id, v] of Object.entries(raw.mercenaries || {}))
    if (mercs.has(Number(id)))
      a.mercenaries[id] = {
        level: Math.max(1, n(v.level, 1, 100)),
        quality: Math.max(1, n(v.quality, 1, 21)),
      };
  a.mercenary = a.mercenaries[raw.mercenary] ? Number(raw.mercenary) : 0;
  a.skins = {};
  for (const [id, v] of Object.entries(raw.skins || {}))
    if (skins.has(Number(id)))
      a.skins[id] = Math.max(
        1,
        n(
          v,
          1,
          Math.max(
            ...GROWTH.SkinLevelConfig.filter((r) => r.SkinID === Number(id)).map(
              (r) => r.SkinLevel,
            ),
            1,
          ),
        ),
      );
  a.skinSlots = { 1: 0, 2: 0, 3: 0 };
  for (const type of [1, 2, 3])
    if (a.skins[raw.skinSlots?.[type]] && skins.get(Number(raw.skinSlots[type])).SkinType === type)
      a.skinSlots[type] = Number(raw.skinSlots[type]);
  a.operations = {};
  for (const id of [
    'wheel',
    'armed',
    'box',
    'egg',
    'festegg',
    'spring',
    'newyear',
    'treasure',
    'xunxing',
    'bihai',
  ])
    if (
      raw.operations?.[id] &&
      typeof raw.operations[id] === 'object' &&
      !Array.isArray(raw.operations[id])
    )
      a.operations[id] = raw.operations[id];
  const r = raw.gemRefine,
    s = r?.source;
  if (
    /^gem-native:\d+$/.test(r?.oldId || '') &&
    /^gem-native:\d+$/.test(r?.newId || '') &&
    (s?.type === 'inventory' ||
      (s?.type === 'equipped' &&
        PARTS[s.slot] &&
        Number.isInteger(s.index) &&
        s.index >= 0 &&
        s.index < 5))
  )
    a.gemRefine = {
      oldId: r.oldId,
      newId: r.newId,
      source:
        s.type === 'inventory'
          ? { type: 'inventory' }
          : { type: 'equipped', slot: s.slot, index: s.index },
    };
  return a;
}
export const nativeGood = (id) => goods.get(Number(id));
export const nativeGoodName = (id) => nativeGood(id)?.nameText || '物品 ' + id;
export const nativeGoodCount = (p, id) => ensureNative(p).goods[id] || 0;
export function grantNativeGood(p, id, count = 1) {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0 || !Number.isFinite(count) || count <= 0)
    return false;
  const a = ensureNative(p);
  a.goods[id] = Math.min(MAX, (a.goods[id] || 0) + Math.trunc(count));
  return true;
}
export function spendNative(p, { gold = 0, diamonds = 0, items = [] }) {
  const a = ensureNative(p);
  if (p.gold < gold) return { ok: false, reason: '金币不足' };
  if (p.diamonds < diamonds) return { ok: false, reason: '钻石不足' };
  for (const item of items)
    if ((a.goods[item.id] || 0) < item.count)
      return { ok: false, reason: nativeGoodName(item.id) + '不足' };
  p.gold -= gold;
  p.diamonds -= diamonds;
  for (const item of items) a.goods[item.id] -= item.count;
  return { ok: true };
}
export function nativeSupply(p) {
  const ids = new Set([
    70005, 70006, 70007, 1001, 100002, 90002, 50001, 1003, 1004, 1005, 60001, 91901, 81901, 81902,
    81903,
  ]);
  for (const table of [
    'MercenaryBaseConfig',
    'MercenaryLevelConfig',
    'MercenaryQualityConfig',
    'MagicSkillLevelConfig',
  ])
    for (const r of GROWTH[table]) {
      const i = r.CostItem;
      ids.add(i?.CostItemID || r.CostItemID || 0);
    }
  for (const r of GROWTH.EquipUpLevelConfig) ids.add(r.CostItemID);
  for (const r of GROWTH.EquipReforgeConfig) ids.add(r.CostItemID);
  for (const r of GROWTH.GunUpConfig) ids.add(r.CostItemID);
  for (const r of GROWTH.GunBaseConfig) if (r.UnlockCondType === 3) ids.add(r.UnlockCondParam1);
  for (const r of GROWTH.SkinBaseConfig) ids.add(r.CostItemID);
  for (const r of GROWTH.SkinLevelConfig) for (const i of r.CostItem) ids.add(i.ItemID);
  for (const id of ids) if (id) grantNativeGood(p, id, 10000);
  return ids.size;
}
export const coreLevelRow = (key, level) => cores.get((SKILL_IDS[key] || key) + ':' + level);
export function coreUpgradeCost(p, key) {
  const level = p.skills[key]?.level || 1,
    row = level < 46 ? coreLevelRow(key, level) : null;
  return row
    ? { gold: row.CostGoldCnt, items: [{ id: row.CostItemID, count: row.CostItemCnt }], row }
    : null;
}
export function upgradeNativeCore(p, key) {
  const c = coreUpgradeCost(p, key);
  if (!c) return { ok: false, reason: '已达 APK 核心等级上限46级' };
  const paid = spendNative(p, c);
  if (!paid.ok) return paid;
  p.skills[key].level++;
  p.skills[key].cards = nativeGoodCount(p, c.row.CostItemID);
  return { ok: true };
}
export function equipUpgradeCost(p, slot) {
  const g = p.gear[slot],
    row = gearLevels.get(PARTS[slot] + ':' + (g?.level + 1));
  return row
    ? {
        gold: row.MoneyType === 2 ? row.MoneyNum : 0,
        items: [{ id: row.CostItemID, count: row.CostItemNum }],
        row,
      }
    : null;
}
export function upgradeNativeGear(p, slot) {
  const c = equipUpgradeCost(p, slot);
  if (!c) return { ok: false, reason: '已达 APK 装备强化上限150级' };
  const paid = spendNative(p, c);
  if (!paid.ok) return paid;
  p.gear[slot].level++;
  return { ok: true };
}
export function nativeGearRow(p, slot) {
  const g = p.gear[slot];
  return (
    GROWTH.EquipConfig.find(
      (r) => r.ItemID === 800000000 + (g.rarity + 1) * 10000 + PARTS[slot] * 1000 + g.tier,
    ) || GROWTH.EquipConfig.find((r) => r.Type === PARTS[slot] && r.PinJie === g.tier)
  );
}
export function reforgeNativeGear(p, slot) {
  const g = p.gear[slot];
  if (g.tier === 30 && g.rarity === 6) return { ok: false, reason: '已达锻造上限' };
  const row = GROWTH.EquipReforgeConfig.find(
    (r) => r.EquipPinJie === g.tier && r.Quality === g.rarity + 1 && r.Prefix === (g.prefix || 1),
  );
  if (!row) return { ok: false, reason: '参考包没有此装备的锻造配置' };
  const paid = spendNative(p, { items: [{ id: row.CostItemID, count: row.CostItemNum }] });
  if (!paid.ok) return paid;
  const next = GROWTH.EquipPrefixParamConfig.find(
    (r) => r.Stage === g.tier && r.Quality === g.rarity + 1 && r.Prefix === (g.prefix || 1) + 1,
  );
  if (next) g.prefix = next.Prefix;
  else if (g.rarity < 6) {
    g.rarity++;
    g.prefix = 1;
  } else if (g.tier < 30) {
    g.tier++;
    g.rarity = 0;
    g.prefix = 1;
  } else return { ok: false, reason: '已达锻造上限' };
  return { ok: true };
}
export function gunSkillCost(p) {
  const row = gunNodes.get(ensureNative(p).gunSkillLevel + 1);
  return row
    ? {
        gold: row.CostCurrencyID === 2 ? row.CostCurrencyNum : 0,
        items: [{ id: row.CostItemID, count: row.CostItemCnt }],
        row,
      }
    : null;
}
export function upgradeGunSkill(p) {
  const c = gunSkillCost(p);
  if (!c) return { ok: false, reason: '已点满270个原生枪械节点' };
  const paid = spendNative(p, c);
  if (paid.ok) ensureNative(p).gunSkillLevel++;
  return paid;
}
export function unlockNativeGun(p, id) {
  const a = ensureNative(p),
    row = guns.get(Number(id));
  if (!row) return { ok: false, reason: '枪械不存在' };
  if (a.guns[id]) {
    a.gun = Number(id);
    return { ok: true };
  }
  const c =
    row.UnlockCondType === 3
      ? { items: [{ id: row.UnlockCondParam1, count: row.UnlockCondParam2 || 1 }] }
      : { items: [] };
  const paid = spendNative(p, c);
  if (paid.ok) {
    a.guns[id] = 1;
    a.gun = Number(id);
  }
  return paid;
}
export function upgradeNativeGun(p, id) {
  const a = ensureNative(p),
    level = a.guns[id];
  if (!level) return unlockNativeGun(p, id);
  const row = GROWTH.GunUpConfig.find((r) => r.GunID === Number(id) && r.Level === level + 1);
  if (!row) return { ok: false, reason: '已达此枪械强化上限' };
  const paid = spendNative(p, { items: [{ id: row.CostItemID, count: row.CostItemCnt }] });
  if (paid.ok) a.guns[id]++;
  return paid;
}
export function mercenaryProfile(p, id) {
  const a = ensureNative(p),
    row = mercs.get(Number(id));
  if (!row) return null;
  const own = a.mercenaries[id] || { level: 0, quality: row.InitQualityLv };
  return {
    row,
    ...own,
    levelRow: mercLevels.get(id + ':' + Math.max(1, own.level)),
    qualityRow: mercQualities.get(id + ':' + own.quality),
    skills: GROWTH.MercenarySkillConfig.filter(
      (r) => r.ID === Number(id) && r.MinUnlockQuality <= own.quality,
    ).sort((a, b) => b.MinUnlockQuality - a.MinUnlockQuality)[0],
  };
}
export function recruitMercenary(p, id) {
  const a = ensureNative(p),
    m = mercenaryProfile(p, id);
  if (!m) return { ok: false, reason: '佣兵不存在' };
  if (m.level) {
    a.mercenary = Number(id);
    return { ok: true };
  }
  const paid = spendNative(p, {
    gold: m.row.CurrencyType === 2 ? m.row.CurrencyNum : 0,
    items: [{ id: m.row.CostItem.CostItemID, count: m.row.CostItem.CostItemCnt }],
  });
  if (paid.ok) {
    a.mercenaries[id] = { level: 1, quality: m.row.InitQualityLv };
    a.mercenary = Number(id);
  }
  return paid;
}
export function mercenaryUpgradeCost(p, id, quality = false) {
  const m = mercenaryProfile(p, id);
  if (!m?.level) return null;
  const rows = quality ? mercQualities : mercLevels,
    value = quality ? m.quality : m.level,
    row = rows.get(id + ':' + value),
    next = rows.get(id + ':' + (value + 1));
  return row && next
    ? {
        gold: row.CurrencyType === 2 ? row.CurrencyNum : 0,
        items: [{ id: row.CostItem.CostItemID, count: row.CostItem.CostItemCnt }],
        row,
        next,
      }
    : null;
}
export function upgradeMercenary(p, id, quality = false) {
  const a = ensureNative(p),
    m = mercenaryProfile(p, id);
  if (!m?.level) return recruitMercenary(p, id);
  const cost = mercenaryUpgradeCost(p, id, quality);
  if (!cost) return { ok: false, reason: quality ? '品质阶已满' : '佣兵等级已满100级' };
  const paid = spendNative(p, cost);
  if (paid.ok) a.mercenaries[id][quality ? 'quality' : 'level']++;
  return paid;
}
export function skinProfile(p, id) {
  const row = skins.get(Number(id));
  if (!row) return null;
  const level = ensureNative(p).skins[id] || 0;
  return {
    row,
    level,
    current: GROWTH.SkinLevelConfig.find((r) => r.SkinID === Number(id) && r.SkinLevel === level),
    next: GROWTH.SkinLevelConfig.find((r) => r.SkinID === Number(id) && r.SkinLevel === level + 1),
  };
}
export function skinUpgradeCost(p, id) {
  const s = skinProfile(p, id);
  if (!s?.next) return null;
  const alternatives = (
    s.next.CostItem?.length
      ? s.next.CostItem
      : [{ ItemID: s.row.CostItemID, ItemCnt: s.row.CostItemCnt }]
  )
    .filter((i) => i.ItemID > 0 && i.ItemCnt > 0)
    .map((i) => ({ id: i.ItemID, count: i.ItemCnt }));
  if (!alternatives.length) return null;
  const chosen = alternatives.find((i) => nativeGoodCount(p, i.id) >= i.count) || alternatives[0];
  return { items: [chosen], alternatives, row: s.next };
}
export function upgradeNativeSkin(p, id) {
  const a = ensureNative(p),
    s = skinProfile(p, id);
  if (s && !s.level && s.row.PreActiveSkinID.some((pre) => pre && !a.skins[pre]))
    return { ok: false, reason: '请先激活前置外观' };
  const cost = skinUpgradeCost(p, id);
  if (!cost) return { ok: false, reason: '已达此外观的原生等级上限' };
  const paid = spendNative(p, cost);
  if (paid.ok) a.skins[id] = (a.skins[id] || 0) + 1;
  return paid;
}
export function equipNativeSkin(p, id) {
  const a = ensureNative(p),
    s = skinProfile(p, id);
  if (!s?.level) return { ok: false, reason: '请先激活此外观' };
  a.skinSlots[s.row.SkinType] = Number(id);
  if (s.row.SkinType === 2) {
    const skill = Object.keys(SKILL_IDS).find((k) => SKILL_IDS[k] === s.row.MagicId),
      preset = p.presets[p.preset];
    if (skill) {
      preset.support = skill;
      preset.disabled = preset.disabled.filter((k) => k !== skill);
    }
  }
  return { ok: true };
}
const sum = (out, rows) => {
  for (const a of rows || []) if (a.DataType) out[a.DataType] = (out[a.DataType] || 0) + a.Value;
};
export function nativeCombatStats(p) {
  const a = ensureNative(p),
    raw = {},
    skillAttrs = {},
    builds = [];
  for (const slot of Object.keys(PARTS)) {
    const row = nativeGearRow(p, slot);
    sum(raw, row?.ImpactData);
    sum(raw, gearLevels.get(PARTS[slot] + ':' + p.gear[slot].level)?.ImpactData);
  }
  for (const [key, id] of Object.entries(SKILL_IDS))
    sum(raw, cores.get(id + ':' + (p.skills[key]?.level || 1))?.GlobalAttrList);
  for (const [key, id] of Object.entries(SKILL_IDS))
    for (let level = 1; level <= (p.skills[key]?.level || 0); level++) {
      const row = cores.get(id + ':' + level);
      if (!row) continue;
      for (const library of DATA.libraries[row.AttrLibraryID] || [])
        for (const skill of library.skills) {
          skillAttrs[skill] ??= {};
          sum(skillAttrs[skill], library.values);
        }
      if (row.BuildID) builds.push(row.BuildID);
    }
  const gun = guns.get(a.gun) || guns.get(1);
  sum(raw, gun.ImpactData);
  for (const row of GROWTH.GunSkillConfig)
    if (row.GunSkillLevel <= a.gunSkillLevel) {
      sum(raw, [row.ImpactData]);
      if (row.BuildID) builds.push(row.BuildID);
    }
  sum(
    raw,
    GROWTH.GunUpConfig.find((r) => r.GunID === a.gun && r.Level === a.guns[a.gun])?.ImpactData,
  );
  const skinBuilds = [];
  for (const [id, level] of Object.entries(a.skins)) {
    const row = GROWTH.SkinLevelConfig.find(
      (r) => r.SkinID === Number(id) && r.SkinLevel === level,
    );
    sum(raw, row?.ImpactData);
    if (Object.values(a.skinSlots).includes(Number(id))) {
      if (row?.EntryID) skinBuilds.push(row.EntryID);
      if (row?.EntryID2) skinBuilds.push(row.EntryID2);
    }
  }
  const form = skinProfile(p, a.skinSlots[2]),
    formSkill = Object.keys(SKILL_IDS).find((k) => SKILL_IDS[k] === form?.row.MagicId),
    nativeFormStart = form?.level
      ? {
          id: form.row.SkinID,
          name: form.row.skinNameText,
          skill: formSkill,
          randomBuilds: (form.current?.RandBuild || [])
            .slice(0, form.current?.RandBuildCount || 0)
            .map((r) => [r.Build1, r.Build2].filter(Boolean))
            .filter((r) => r.length),
        }
      : null;
  const merc = mercenaryProfile(p, a.mercenary);
  let mercenary = null;
  if (merc?.level) {
    const attr = {};
    sum(attr, merc.levelRow?.ImpactData);
    sum(attr, merc.qualityRow?.ImpactData);
    mercenary = {
      id: a.mercenary,
      name: merc.row.nameText,
      icon: merc.row.Icon,
      level: merc.level,
      quality: merc.quality,
      modelId: merc.row.ModelID,
      extendAttack: merc.qualityRow.ExtendAtk,
      attrs: attr,
      skills: (merc.skills?.SkillId || []).filter(Boolean),
    };
  }
  const gunBase = NATIVE_BASES[gun.SkillID],
    loop = NATIVE_GRAPHS[gun.SkillID]?.events
      .map((e) => e.m_selectRandomEnemy)
      .find((e) => e?.m_innerLayerCallCnt > 0 && e.m_innerLayerDurTime > 0),
    shotInterval = loop
      ? Math.max((gunBase?.SkillCD || 0.5) / loop.m_innerLayerCallCnt, loop.m_innerLayerDurTime)
      : gunBase?.SkillCD || 0.5;
  return {
    nativeFormStart,
    nativePlayerModel: skins.get(a.skinSlots[1])?.ModelId?.[0] || 0,
    nativeCoreModel: skins.get(a.skinSlots[2])?.ModelId?.[0] || 0,
    nativeRaw: raw,
    nativeSkillAttrs: skillAttrs,
    nativeGrowthBuilds: builds,
    nativeSkinBuilds: skinBuilds,
    nativeGunSkillLevel: a.gunSkillLevel,
    nativeGunLevel: a.guns[a.gun],
    nativeGun: gun,
    mercenary,
    nativeAttack: Math.max(1, 100 + (raw[103] || 0)),
    nativeMaxHp: Math.max(1, 1000 + (raw[101] || 0)),
    gunProfile: {
      capacity: Math.max(1, Math.round((raw[138] || 30) * (1 + (raw[140] || 0)))),
      interval: Math.max(0.03, shotInterval),
      reload: Math.max(0.15, (raw[141] || 3.5) * (1 + (raw[143] || 0))),
      damageRatio: (raw[148] || 1) * (1 + (raw[149] || 0)),
      critChance: raw[150] || 0,
      critDamage: raw[151] || 0,
    },
  };
}
