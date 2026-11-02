import { SHOP_SOURCE as S } from './shop-source.mjs';

export const shopTypes = {
  CSShopBuyRes: [
    ['Result', 'ProtoResult'],
    ['BootyList', 'CSBootyAwardList'],
  ],
  CSBuyGoldRes: [
    ['Result', 'ProtoResult'],
    ['BootyList', 'CSBootyAwardList'],
  ],
};
export const shopCommands = new Set([4300, 4310]);
const common = new Map(S.CommonShopConfig.map((r) => [r.GoodID, r]));
const chests = new Map(S.ChestConfig.map((r) => [r.ChestID, r]));

function pickBooty(id, level, rng) {
  const rows = S.BootyConfig.filter(
    (r) =>
      r.BootyID === id &&
      (!r.MinLevel || level >= r.MinLevel) &&
      (!r.MaxLevel || level <= r.MaxLevel),
  );
  if (!rows.length || rows.some((r) => ![1, 2].includes(r.ItemType))) return [];
  let chosen = rows;
  if (rows[0].BootyType === 2) {
    let roll = rng(rows.reduce((sum, r) => sum + r.RandParam, 0));
    chosen = [rows.find((r) => (roll -= r.RandParam) < 0)];
  }
  return chosen.map((r) => ({
    AwardItemType: r.ItemType,
    AwardItemID: r.ItemID,
    AwardItemCnt: r.ItemCnt,
    AwardItemParam: r.ItemParam,
    IsBroadCast: r.IsBroadCast,
  }));
}

// Use source shop IDs, item quantities and chest guarantees; free mode only
// removes the price/quota. Unsupported payment-only rows never fake a grant.
export function shopAction(q, role, p, rng) {
  const responseType = q.cmd === 4310 ? 'CSBuyGoldRes' : 'CSShopBuyRes';
  const fail = () => ({
    role,
    type: responseType,
    cmd: q.cmd + 1,
    data: { Result: { Ret: 1 }, BootyList: {} },
    awards: [],
  });
  if (q.cmd === 4310) {
    if (q.body.length !== 4 || !p.freeActions) return fail();
    const cfg = S.ShopGoldConfig.find((r) => r.GoldID === q.body.readInt32BE());
    if (
      !cfg ||
      (cfg.levelMin && (p.level || 1) < cfg.levelMin) ||
      (cfg.levelMax && (p.level || 1) > cfg.levelMax)
    )
      return fail();
    const awards = [{ AwardItemType: 2, AwardItemID: 99002, AwardItemCnt: cfg.ItemCount }];
    return {
      role,
      type: responseType,
      cmd: 4311,
      data: { Result: { Ret: 0 }, BootyList: { AwardItem: awards } },
      awards,
    };
  }
  if (q.body.length !== 12 || !p.freeActions) return fail();
  const kind = q.body.readInt32BE(),
    id = q.body.readInt32BE(4),
    count = q.body.readInt32BE(8);
  if (![1, 2, 4].includes(kind) || count < 1 || count > 100) return fail();
  const cfg = kind === 1 ? chests.get(id) : common.get(id);
  if (!cfg) return fail();
  const s = structuredClone(role.localShop || { common: {}, chests: {} });
  s.common ||= {};
  s.chests ||= {};
  const previous = (kind === 1 ? s.chests : s.common)[id] || 0;
  const awards = [];
  for (let i = 1; i <= count; i++) {
    const index = previous + i;
    const booty =
      kind !== 1
        ? cfg.BootyID
        : cfg.BigGuaranteeCnt && index % cfg.BigGuaranteeCnt === 0
          ? cfg.BigGuaranteeBootyID
          : cfg.GuaranteeCnt && index % cfg.GuaranteeCnt === 0
            ? cfg.GuaranteeBootyID
            : cfg.CommonBootyID;
    const reward = pickBooty(booty, p.level || 1, rng);
    if (!reward.length) return fail();
    awards.push(...reward);
  }
  const combined = new Map();
  for (const a of awards) {
    const key = `${a.AwardItemType}:${a.AwardItemID}:${JSON.stringify(a.AwardItemParam)}`;
    const old = combined.get(key);
    if (old) old.AwardItemCnt += a.AwardItemCnt;
    else combined.set(key, { ...a });
  }
  const result = [...combined.values()];
  if (result.length > 100) return fail();
  (kind === 1 ? s.chests : s.common)[id] = previous + count;
  return {
    role: { ...role, localShop: s },
    type: 'CSShopBuyRes',
    cmd: 4301,
    data: { Result: { Ret: 0 }, BootyList: { AwardItem: result } },
    awards: result,
  };
}
