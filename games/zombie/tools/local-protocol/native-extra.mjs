// Research-only templates, pinned APK protocol (big-endian). Copy only after owner review.
const u8 = (n) => Buffer.from([Number(n) || 0]);
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(Number(n) || 0);
  return b;
};
const i32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(Number(n) || 0);
  return b;
};
const f32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeFloatBE(Number(n) || 0);
  return b;
};
const u64 = (n) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(n || 0));
  return b;
};
const str = (s) => {
  const b = Buffer.from(String(s ?? ''), 'utf8');
  return Buffer.concat([u32(b.length + 1), b, u8(0)]);
};
const join = (parts) => Buffer.concat(parts);
export function parseFinLevelPrefix(body) {
  if (!Buffer.isBuffer(body) || body.length < 16) throw Error('Truncated CSFinLevelReq');
  const data = {
    IsFin: body[0],
    IsWin: body[1],
    HpRate: body.readFloatBE(2),
    BattleGID: body.readBigUInt64BE(6).toString(),
    IsDump: body[14],
    IsHalfWayFin: body[15],
    ClientData: body.subarray(16),
  };
  if (
    ![data.IsFin, data.IsWin, data.IsDump, data.IsHalfWayFin].every((x) => x === 0 || x === 1) ||
    !Number.isFinite(data.HpRate) ||
    data.HpRate < 0 ||
    data.HpRate > 100
  )
    throw Error('Invalid CSFinLevelReq prefix');
  // ClientData is structured variable data, not validated here. Server should bind
  // BattleGID to its own pending battle and take duration from server-owned state.
  return data;
}
export function packFinLevelRes(d = {}) {
  const players = d.PlayerStatDataList ?? [];
  if (players.length > 6) throw Error('CSFinLevelRes supports at most 6 players');
  const awards = d.BootyList?.AwardItem ?? [];
  if (awards.length > 100) throw Error('Fixture award limit');
  const w = d.WuGuanResult ?? {};
  return join([
    Buffer.alloc(5),
    u32(d.LevelID),
    u8(d.IsWin),
    i32(d.StarLevel),
    f32(d.CurHpRate),
    u8(d.IsNewRecord),
    u32(d.BattleDurationTime),
    i32(awards.length),
    ...awards.map(packBootyAwardItem),
    i32(players.length),
    ...players.map((p) =>
      join([
        u64(p.RoleID),
        str(p.RoleName),
        u8(p.BodyType),
        i32(p.Head),
        u8(p.HeadSex),
        str(p.HeadURL),
        i32(p.HeadFrame),
        i32(p.WorldID),
        i32(p.KillMonsterNum),
      ]),
    ),
    i32(w.Rank),
    i32(w.RivalRank),
    u8(w.IsTimeout),
    u8(d.IsHalfWayFin),
  ]);
}
export function packRefuseReconnectRes(levelID) {
  return join([Buffer.alloc(5), i32(levelID)]);
}
export function packExtraAttrData(d = {}) {
  const list = d.ExtraAttrList ?? [];
  if (list.length > 4) throw Error('Native extra attr count exceeds 4');
  return join([
    u8(list.length),
    ...list.map((a) => join([i32(a.ZhaoShiID), u8(a.AttrID), u8(a.AddType), f32(a.AttrValue)])),
  ]);
}
export function packEquipDetail(d = {}) {
  const tmp = d.HaveXiLianTmpData ?? 0;
  if (tmp !== 0 && tmp !== 1) throw Error('Invalid equipment temp presence flag');
  return join([
    u32(d.Level),
    i32(d.Quality),
    u8(d.InitQuality),
    i32(d.Prefix),
    u8(d.InitPrefix),
    packExtraAttrData(d.ExtraAttrData),
    u8(tmp),
    ...(tmp ? [packExtraAttrData(d.XiLianTmpExtraAttrData)] : []),
    i32(d.ReforgeUseQiHun),
    u8(d.IsLock),
    u8(d.IsNew),
  ]);
}
export function packItemData(d) {
  const detail = d.Detail ?? {};
  let data;
  switch (d.ItemType) {
    case 1:
      data = u32(detail.GoodsDetail?.LastUseTime);
      break;
    case 2:
      data = packEquipDetail(detail.EquipDetail);
      break;
    case 3:
      data = i32(detail.GemDetail?.IsLock);
      break;
    default:
      throw Error('Template supports Goods/Equip/Gem only; Chip needs its own schema');
  }
  return join([
    u32(d.ItemGID),
    u32(d.ItemID),
    u32(d.StackCnt ?? 1),
    u8(d.ItemType),
    u32(d.CreateTime),
    data,
  ]);
}
const equipIDs = [800011001, 800012001, 800013001, 800014001, 800015001, 800016001];
export function starterEquipment(now = 0) {
  return {
    IsOpen: 1,
    EquipList: equipIDs.map((ItemID, i) => ({
      ItemGID: 91001 + i,
      ItemID,
      StackCnt: 1,
      ItemType: 2,
      CreateTime: now,
      Detail: {
        EquipDetail: {
          Level: 1,
          Quality: 1,
          InitQuality: 1,
          Prefix: 1,
          InitPrefix: 1,
          ExtraAttrData: { ExtraAttrList: [] },
          HaveXiLianTmpData: 0,
          ReforgeUseQiHun: 0,
          IsLock: 0,
          IsNew: 0,
        },
      },
    })),
    FightVal: 0,
    UsingPageID: 1,
    GemPageData: [1, 2, 3].map((GemPageID) => ({
      GemPageID,
      GemPageEquipData: [1, 2, 3, 4, 5, 6].map((Type) => ({ Type, GemList: [] })),
    })),
  };
}
export function starterGems(now = 0, ids = null) {
  const list = ids ?? [1, 2, 3, 4, 5, 6].map((part) => 900010001 + part * 100);
  return list.map((ItemID, i) => ({
    ItemGID: 92001 + i,
    ItemID,
    StackCnt: 1,
    ItemType: 3,
    CreateTime: now,
    Detail: { GemDetail: { IsLock: 0 } },
  }));
}
export function packEquipData(d) {
  const eq = d.EquipList ?? [],
    pages = d.GemPageData ?? [];
  if (eq.length > 6 || pages.length > 3) throw Error('Invalid equipment/page count');
  return join([
    u8(d.IsOpen),
    i32(eq.length),
    ...eq.map(packItemData),
    u32(d.FightVal),
    i32(d.UsingPageID),
    i32(pages.length),
    ...pages.map((p) => {
      const es = p.GemPageEquipData ?? [];
      if (es.length > 6) throw Error('Invalid gem page equipment count');
      return join([
        i32(p.GemPageID),
        i32(es.length),
        ...es.map((e) => {
          const gs = e.GemList ?? [];
          if (gs.length > 5) throw Error('Invalid gem slot count');
          return join([
            i32(e.Type),
            i32(gs.length),
            ...gs.map((g) => join([i32(g.OrderID), packItemData(g.GemData)])),
          ]);
        }),
      ]);
    }),
  ]);
}

export function packBootyAwardItem(a) {
  const p = a.AwardItemParam ?? [0, 0, 0],
    r = a.AwardItemRunParam ?? [0, 0];
  if (p.length !== 3 || r.length !== 2)
    throw Error('Native award arrays are fixed lengths 3 and 2');
  return join([
    i32(a.AwardItemType),
    i32(a.AwardItemID),
    i32(a.AwardItemCnt),
    ...p.map(i32),
    ...r.map(i32),
    u8(a.IsBroadCast),
  ]);
}
