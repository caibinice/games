import { PROGRESSION_SOURCE as S } from './progression-source.mjs';
export const CHIP_IDS = new Set(S.ChipConfig.map((r) => r.ItemID));
const pick = (rows, rng, weight = 'Weight') => {
  let n = rng(rows.reduce((sum, r) => sum + r[weight], 0));
  return rows.find((r) => (n -= r[weight]) < 0);
};
export function createChipItem(id, bag, seconds, rng) {
  const cfg = S.ChipConfig.find((r) => r.ItemID === id);
  if (!cfg) throw Error('Unknown native chip');
  const main = pick(
    S.ChipMainLibConfig.filter((r) => r.LibID === cfg.MainLib),
    rng,
  );
  const gid = Math.max(980000, ...bag.ItemData.map((r) => r.ItemGID)) + 1;
  return {
    ItemGID: gid,
    ItemID: id,
    ItemType: 4,
    StackCnt: 1,
    CreateTime: seconds,
    Detail: {
      ChipDetail: {
        Level: 1,
        InitLevel: 1,
        MainAffix: main.MainAffixID,
        SubAffixList: [],
        TotalUseExp: 0,
        IsLock: 0,
        IsNew: 1,
        CurExp: 0,
      },
    },
  };
}
export function chipBoxAction(q, role, bag, rng) {
  const b = q.body;
  const data = {
    Result: { Ret: 1 },
    ItemGID: 0,
    ItemID: 0,
    ItemNum: 0,
    ItemFuncID: 2,
    BootyAwardList: {},
  };
  const fail = () => ({ role, cmd: 4008, type: 'CSItemUseRes', data });
  if (b.length < 16) return fail();
  const gid = b.readUInt32BE(),
    count = b.readUInt32BE(4),
    id = b.readUInt32BE(8),
    params = b.readUInt32BE(12);
  Object.assign(data, { ItemGID: gid, ItemID: id, ItemNum: count });
  if (params > 10 || b.length !== 16 + params * 4 || count < 1 || count > 100) return fail();
  const item = bag.ItemData.find((r) => r.ItemType === 1 && r.ItemGID === gid && r.ItemID === id);
  const box = S.ChipBoxes.find((r) => r.ItemID === id && r.FuncValue === 2);
  const rows =
    box &&
    S.ChipBooty.filter(
      (r) => r.BootyID === box.BootyID && r.ItemType === 28 && CHIP_IDS.has(r.ItemID),
    );
  if (
    !item ||
    item.StackCnt < count ||
    !rows?.length ||
    (role.localChips?.length || 0) + count > 1000
  )
    return fail();
  const awards = Array.from({ length: count }, () => {
    const r = pick(rows, rng, 'RandParam');
    return {
      AwardItemType: 28,
      AwardItemID: r.ItemID,
      AwardItemCnt: 1,
      AwardItemParam: [0, 0, 0],
      AwardItemRunParam: [0, 0],
    };
  });
  item.StackCnt -= count;
  data.Result.Ret = 0;
  data.BootyAwardList = { AwardItem: awards };
  return { role, cmd: 4008, type: 'CSItemUseRes', data, awards, bag };
}
