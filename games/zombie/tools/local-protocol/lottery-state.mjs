// Local, permanent activity fixture. Protocol layouts and available item IDs are
// from the pinned APK; unresolved live BootyIDs use explicit offline catalogues.
import { NATIVE_OPERATIONS as N } from '../../public/native-operations-data.mjs';
import { SKIN_CATALOG as T } from './skin-catalog.mjs';
import { CLIENT_GEMS } from '../../public/client-gem-data.mjs';
import { operationPool, operationExchangePool } from '../../public/operations.mjs';
import { advanceEgg, eggCanClaim, eggRewardIndexes, resetEgg } from '../../public/egg-lottery.mjs';
import { treasureStep, starTurn, normalizeStarBoard } from '../../public/board-lotteries.mjs';

// XunXing casts EndTime to int32 before subtracting the current server time.
const END = 2147483647,
  MAX = 1e9;
export const LOTTERY_EVENTS = [
  { id: 'wheel', type: 39, ui: 0 },
  { id: 'xianjun', type: 27, ui: 0 },
  { id: 'bihai', type: 79, ui: 0 },
  { id: 'newyear', type: 33, ui: 33002 },
  { id: 'egg', type: 47, ui: 0 },
  { id: 'festegg', type: 66, ui: 66001 },
  { id: 'treasure', type: 58, ui: 0 },
  { id: 'xunxing', type: 78, ui: 0 },
];
export const lotteryOpenEntries = () =>
  LOTTERY_EVENTS.map((e) => ({
    ActivityID: e.type * 1000 + 1,
    ActivityType: e.type,
    ActivityTypeParam: 0,
    OpenTime: 1,
    EndTime: END,
    DelayTime: 0,
    UIConfigID: e.ui,
  }));
// Client-side entry checks require a real source ticket even when no fee is paid.
export const lotteryFreeTickets = [2001, 2004, 2007, 2012];
const aliases = { xianjun: 'spring' };
const localWords = [
  '转动',
  '{0}',
  '活动常开',
  '当前第{0}轮',
  '龙年转盘',
  '恭喜{0}获得{1}',
  '跳过动画',
  '×{0}',
  '指针数量',
  '道具不足',
  '本地活动常开，抽取不扣金币或钻石；奖励配置与记录独立保存。',
];
export function lotteryText(id) {
  if (id === 1905800000 || id === 1905800001)
    return {
      Content: id === 1905800000 ? '寻宝任务' : '每寻宝10次，可领取5个焕新试剂。',
      ArgNum: 0,
    };
  const word =
    id === 109
      ? localWords[10]
      : id === 110 || id === 1902700110
        ? '活动奖池'
        : id === 111 || id === 1902700111
          ? '本地配置权重，非原服当期概率'
          : id >= 1904700000 && id <= 1904700006
            ? '第' + (id - 1904700000) + '层奖励'
            : id === 1904700020
              ? '免费抽取'
              : id === 1904700021
                ? '本地晋层概率：50%'
                : localWords[id >= 200 && id <= 210 ? id - 200 : id - 1903300200];
  return word === undefined
    ? null
    : { Content: word, ArgNum: new Set(word.match(/\{\d+\}/g) || []).size };
}
const a = (id, count = 1, type = 1) => ({
  AwardItemType: type,
  AwardItemID: id,
  AwardItemCnt: count,
  AwardItemParam: [0, 0, 0],
  AwardItemRunParam: [0, 0],
  IsBroadCast: 0,
});
const list = (awards) => ({ AwardItem: awards });
const skins = (type) =>
  T.SkinBaseConfig.filter(
    (r) =>
      r.SkinType === type &&
      r.CostItemID &&
      r.CostItemCnt &&
      T.SkinLevelConfig.some((l) => l.SkinID === r.SkinID && l.SkinLevel === 1),
  );
const pools = new Map();
export function lotteryPool(id) {
  if (pools.has(id)) return pools.get(id);
  const out = operationPool(aliases[id] || id, true)
    .slice(0, id === 'newyear' ? 10 : 12)
    .map((r, i) => {
      let award;
      if (r.kind === 'outfit' || r.kind === 'form') {
        const s = skins(r.kind === 'outfit' ? 1 : 2)[i % skins(r.kind === 'outfit' ? 1 : 2).length];
        award = a(s.CostItemID, s.CostItemCnt);
      } else if (r.kind === 'merc') {
        const s = T.MercenaryBaseConfig[i % T.MercenaryBaseConfig.length];
        award = a(s.CostItem.CostItemID, s.CostItem.CostItemCnt);
      } else if (r.kind === 'gem') award = a(70000 + r.quality);
      else if (r.kind === 'gold') award = a(99002, r.count, 2);
      else if (r.kind === 'manual') award = a(61001 + (i % 14), r.count);
      else if (r.kind === 'blueprint') award = a(50001 + (i % 6), r.count);
      else award = a(r.itemId, r.count);
      return {
        cell: i + 1,
        booty: 100000 + LOTTERY_EVENTS.findIndex((e) => e.id === id) * 1000 + i + 1,
        weight: r.weight,
        award,
        localPool: true,
      };
    });
  pools.set(id, out);
  return out;
}
const state = (role, id) => {
  const defaults = {
    draws: 0,
    luck: 0,
    claimed: [],
    choices: {},
    history: [],
    counts: {},
    floor: 0,
    protect: 0,
    round: 0,
    claimReady: false,
    big: [],
    small: [],
    reset: 0,
    layer: 1,
    circle: 1,
    cells: [],
    progress: [],
    task: 0,
    gifts: {},
    shopCounts: {},
  };
  const saved = role.localLotteries?.[id],
    out = structuredClone({
      ...defaults,
      ...(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}),
    });
  // Existing local saves predate some activities/fields. Missing containers must
  // inherit defaults without discarding their draw, guarantee or claim counters.
  for (const [key, value] of Object.entries(defaults)) {
    if (Array.isArray(value)) {
      if (!Array.isArray(out[key])) out[key] = [];
    } else if (value && typeof value === 'object') {
      if (!out[key] || typeof out[key] !== 'object' || Array.isArray(out[key])) out[key] = {};
    } else if (typeof value === 'number' && (!Number.isSafeInteger(out[key]) || out[key] < 0))
      out[key] = value;
  }
  return out;
};
const save = (role, id, s) => ({ ...role, localLotteries: { ...role.localLotteries, [id]: s } });
const record = (s, cells) => {
  s.draws += cells.length;
  s.history = [...s.history, ...cells].slice(-100);
  for (const cell of cells) s.counts[cell] = (s.counts[cell] || 0) + 1;
};
const pick = (pool, rng) => {
  let v = rng(pool.reduce((n, r) => n + r.weight, 0));
  return pool.find((r) => (v -= r.weight) < 0) || pool.at(-1);
};
// The old fixture offered only the first five pool rows, excluding almost every
// outfit/form. Native selectors allow at most five candidates per cell. Offer
// all 108 premium rewards across ten cells and three rounds, not an oversized
// packet that the APK silently drops.
export const premiumLotteryChoices = () => [
  ...skins(1).map((s, i) => ({
    booty: 700001 + i,
    award: a(s.CostItemID, s.CostItemCnt),
    limit: 0,
  })),
  ...skins(2).map((s, i) => ({
    booty: 710001 + i,
    award: a(s.CostItemID, s.CostItemCnt),
    limit: 0,
  })),
  ...T.MercenaryBaseConfig.map((m, i) => ({
    booty: 720001 + i,
    award: a(m.CostItem.CostItemID, m.CostItem.CostItemCnt),
    limit: 0,
  })),
  { booty: 730001, award: a(70007), limit: 0 },
  { booty: 730002, award: a(70006), limit: 0 },
  { booty: 730003, award: a(1001, 100), limit: 0 },
];
const choices = (id, cell, round = 0) => {
  const p = lotteryPool(id);
  if (id === 'newyear') {
    const all = premiumLotteryChoices(),
      start = (round * 50 + (cell - 1) * 5) % all.length;
    return Array.from({ length: 5 }, (_, i) => all[(start + i) % all.length]);
  }
  return cell === 1 ? p.slice(0, 5) : p.filter((r) => r.cell === cell);
};
const selected = (s, id, cell) =>
  choices(id, cell, s.round).find((r) => r.booty === s.choices[cell]) ||
  choices(id, cell, s.round)[0];
const thresholds = [20, 50, 100, 200];
const milestone = (id, n) => [a(id === 'bihai' ? 100002 : 1001, n === 200 ? 20 : 5)];
const simpleData = (role, id) => {
  const s = state(role, id);
  return {
    TotalTurnCnt: s.draws,
    XianYunValue: s.luck,
    AwardCumuBootyList: s.claimed,
    LastFreeTime: 0,
    NextWeekTime: END,
  };
};
const turnData = (role, type) => {
  const id = type === 1 ? 'wheel' : 'xianjun',
    s = state(role, 'turn' + type);
  return {
    TurnTableType: type,
    TotalTurnCnt: s.draws,
    LastFreeTime: 0,
    IsHitFinalReward: s.history.at(-1) === 1 ? 1 : 0,
    BaoDiTurnCnt: s.luck,
    CellList: lotteryPool(id).map((r) => ({
      CellID: r.cell,
      ChooseBootyID: selected(s, id, r.cell).booty,
      AwardRecordList: [
        { BootyID: selected(s, id, r.cell).booty, ChooseCnt: s.counts[r.cell] || 0 },
      ],
    })),
  };
};
const turnAwardData = (role) => ({
  Total: 1,
  TurnTableAwardList: [1, 2].map((type) => ({
    TurnTableType: type,
    AwardBoxList: state(role, 'turn' + type).claimed,
  })),
});
export function eggData(role, id) {
  const s = state(role, id);
  return {
    TurnEggsTicket: MAX,
    CurLevel: s.floor,
    IsFree: 1,
    CurTurnTimes: s.protect,
    AwardRecordList: [],
  };
}
const eggOptions = (id, level) => eggRewardIndexes(level).map((i) => lotteryPool(id)[i]);
const eggCfg = (id) => ({
  LevelCfgList: Array.from({ length: 7 }, (_, Level) => ({
    Level,
    TextID: 1904700000 + Level,
    CurrencyType: 3,
    CurrencyCnt: 0,
    CostItemID: 0,
    CostItemCnt: 0,
    MaxTimes: 3,
    BootyList: eggOptions(id, Level).map((r) => ({
      BootyAwardList: list([r.award]),
      Limit: 0,
      BootyID: r.booty,
    })),
    TurnEggsShowEntry: [
      { ShowLevel: Math.min(6, Level + 1), IsGray: 0 },
      { ShowLevel: Math.max(0, Level - 1), IsGray: 1 },
    ],
  })),
  PlayTextID: 21590003,
  TurnTextID: 1904700020,
  RateTextID: 1904700021,
});
const simpleCfg = (id, prefix) => ({
  [prefix + 'ActCfgList']: lotteryPool(id).map((r) => ({
    CellID: r.cell,
    CellType: r.cell === 1 ? 1 : 2,
    BootyList: list([r.award]),
    ShowRate:
      ((r.weight / lotteryPool(id).reduce((n, r) => n + r.weight, 0)) * 100).toFixed(2) + '%',
  })),
  WeeklyCumuBootyCfgList: thresholds.map((CumuCnt) => ({
    CumuCnt,
    Icon: id === 'bihai' ? 'icon_guyongbing_qianghuabuji' : 'com_box1',
    BootyList: list(milestone(id, CumuCnt)),
  })),
  [prefix + 'ActParamCfgList']: [
    3, 0, 0, 0, 10, 1, 0, 10, 200, 1903300210, 1902700110, 1902700111,
  ].map((FuncValue, i) => ({ FuncID: 100 + i, FuncValue })),
});
const newYearData = (role) => {
  const s = state(role, 'newyear');
  return {
    ActivityID: 33001,
    ActSubID: 3300101,
    Period: s.round + 1,
    TotalPeriod: s.round + 1,
    DrawCnt: s.draws,
    CellList: lotteryPool('newyear').map((r) => ({
      CellID: r.cell,
      GetCnt: s.counts[r.cell] || 0,
      ChooseBootyID: selected(s, 'newyear', r.cell).booty,
    })),
    GiftList: [],
  };
};
const newYearCfg = (role) => ({
  LuckWheelParamConfig: {
    CfgList: [
      { FuncID: 1, Value: 2004 },
      { FuncID: 102, Value: 1903300204 },
      ...Array.from({ length: 11 }, (_, i) => ({ FuncID: 200 + i, Value: 1903300200 + i })),
    ],
  },
  LuckWheelBootyConfig: {
    CfgList: lotteryPool('newyear').map((r) => ({
      ActivitySubID: 3300101,
      Type: r.cell === 1 ? 1 : 2,
      CellID: r.cell,
      Weight: r.weight,
      MinCnt: 0,
      LimitCnt: 1,
      Period: state(role, 'newyear').round + 1,
      IsOpt: 1,
      BootyAwardChooseList: choices('newyear', r.cell, state(role, 'newyear').round).map((c) => ({
        BootyID: c.booty,
        BootyAwardList: list([c.award]),
      })),
    })),
  },
  LuckWheelGiftConfig: { CfgList: [] },
});

const raw = N.legacyRawTables;
const treasureLayers = raw.FindTreasureLayerConfig.rows.filter((r) => r.ActSubID === 5800101),
  lastTreasureLayer = Math.max(...treasureLayers.map((r) => r.LayerID));
export function treasureLayer(layer) {
  const row = treasureLayers.find((r) => r.LayerID === layer) || treasureLayers[0],
    pool = lotteryPool('treasure');
  const cells = raw.FindTreasureCircleConfig.rows.filter(
    (r) => r.CircleGroupID === row.CircleGroupID,
  );
  return {
    Layer: layer,
    LayerCfg: {
      LayerID: layer,
      CircleCnt: new Set(cells.map((r) => r.CircleID)).size,
      ModelCnt: [row.ModelID1, row.ModelID2, row.ModelID3].filter(Boolean).length,
      CircleCfgList: [...new Set(cells.map((r) => r.CircleID))].map((CircleID) => ({
        CircleID,
        CellList: cells
          .filter((r) => r.CircleID === CircleID)
          .map((r, i) => ({
            CellID: r.CellID,
            BootyAwardList: list([pool[i % pool.length].award]),
            IsBig: r.IsBig,
            Weight: r.Weight,
          })),
      })),
      ModelCfgList: [1, 2, 3]
        .filter((i) => row['ModelID' + i])
        .map((i) => ({ ModelID: row['ModelID' + i], ModelScale: row['ModelScale' + i] || 0.5 })),
    },
  };
}
const treasureData = (role) => {
  const s = state(role, 'treasure');
  return {
    CurLayer: s.layer,
    CurCircle: s.circle,
    CellList: s.cells.map((CellID) => ({ CellID })),
    ProgressList: s.progress.map((Layer) => ({
      Layer,
      HasDone: 1,
      HasGet: s.claimed.includes(Layer) ? 1 : 0,
      BootyID: s.choices[Layer] || lotteryPool('treasure')[0].booty,
    })),
    GiftList: [],
    TaskData: { CurrProgress: s.draws, CurrTaskID: 1 },
  };
};
const treasureChoices = (layer = 1) => [
  ...lotteryPool('treasure').slice(0, 3),
  ...premiumLotteryChoices().slice(((layer - 1) * 2) % 108, (((layer - 1) * 2) % 108) + 2),
];
const treasureCfg = () => ({
  ActID: 58001,
  ActSubID: 5800101,
  LayerProgressCfgList: treasureLayers.map((r) => ({
    Layer: r.LayerID,
    IsOpt: 1,
    BootyAwardChooseList: treasureChoices(r.LayerID).map((c) => ({
      BootyID: c.booty,
      BootyAwardList: list([c.award]),
    })),
  })),
  GiftCfgList: [],
  FindTreasureParamCfgList: N.params.FindTreasureParamConfig.rows.map((r) => ({
    ParamType: r.id,
    ParamValue: r.value,
  })),
  FindTreasureTaskCfgList: [
    {
      TaskID: 1,
      NextTask: 1,
      InitTask: 1,
      TaskName: 1905800000,
      TaskDesc: 1905800001,
      MaxProgress: 10,
      IsCumu: 1,
      BootyAwardList: list([a(1001, 5)]),
    },
  ],
});
const bigCfg = () => ({
  CfgList: raw.XunXingBigCellConfig.rows.map((r, i) => ({
    BigCellID: r.BigCellID,
    Weight: r.Weight,
    MinCnt: r.MinCnt,
    ShowBootyRatio: r.ShowBootyRatio,
    IsOpt: r.IsOpt,
    BootyEntryList: [1, 2, 3, 4, 5]
      .filter((k) => r['BootyID' + k])
      .map((k, j) => ({
        BootyID: r['BootyID' + k],
        Limit: r['Limit' + k],
        BootyAwardList: list([lotteryPool('xunxing')[(i + j) % 12].award]),
      })),
  })),
});
const smallCfg = () => ({
  CfgList: raw.XunXingSmallCellConfig.rows.map((r, i) => ({
    ActSubID: r.ActSubID,
    SmallCellID: r.SmallCellID,
    Weight: r.Weight,
    ShowBootyRatio: r.ShowBootyRatio,
    BootyAwardList: list([lotteryPool('xunxing')[(i + 5) % 12].award]),
    IsSpecialItem: r.IsSpecialItem,
  })),
});
const xunData = (role) => {
  const s = normalizeStarBoard(state(role, 'xunxing'));
  return {
    ActItemCnt: MAX,
    DrawBigPrizeList: s.big.map((CellID) => ({ CellID })),
    DrawSmallPrizeList: s.small.map((CellID) => ({ CellID })),
    AwardRecordList: Object.entries(s.counts)
      .filter(([, count]) => count > 0)
      .map(([CellID, ChooseCnt]) => ({
        CellID: Number(CellID),
        BootyID:
          s.choices[CellID] ||
          bigCfg().CfgList.find((r) => r.BigCellID === Number(CellID))?.BootyEntryList[0]
            ?.BootyID ||
          0,
        ChooseCnt,
      })),
    ChooseList: bigCfg()
      .CfgList.filter((r) => r.IsOpt === 1)
      .map((r) => ({
        CellID: r.BigCellID,
        BootyID: s.choices[r.BigCellID] || r.BootyEntryList[0].BootyID,
      })),
    ResetCount: s.reset,
  };
};

export function lotteryNotifications(role, configs = true) {
  const out = [];
  const push = (cmd, type, data) => out.push({ cmd, type, data });
  if (configs) {
    push(10010, 'CSNotifyTurnTableParamCfg', {
      TurnTableParamCfgList: [1, 2].map((TurnTableType) => ({
        TurnTableType,
        MultyTurnCnt: 10,
        CostMoneyType: 3,
        CostMoneyCntOnce: 0,
        CostMoneyCntMulty: 0,
        FreeInterval: 0,
        ActDesc: 21010006,
      })),
    });
    push(10011, 'CSNotifyTurnTableBoxCfg', {
      TurnTableBoxBootyCfgList: [1, 2].flatMap((TurnTableType) =>
        thresholds.map((NeedTurnCnt) => ({
          TurnTableType,
          NeedTurnCnt,
          BootyList: list(milestone('wheel', NeedTurnCnt)),
          BoxIcon: 'com_box1',
        })),
      ),
    });
    push(10012, 'CSNotifyTurnTableCellCfg', {
      TurnTableCellList: [1, 2].flatMap((type) => {
        const id = type === 1 ? 'wheel' : 'xianjun';
        return lotteryPool(id).map((r) => ({
          TurnTableType: type,
          CellID: r.cell,
          BootyList: Array.from({ length: 5 }, (_, i) => {
            const c = choices(id, r.cell)[i];
            return { BootyAwardList: list(c ? [c.award] : []), Limit: 0, BootyID: c?.booty || 0 };
          }),
          ShowRate:
            ((r.weight / lotteryPool(id).reduce((n, c) => n + c.weight, 0)) * 100).toFixed(2) + '%',
          IsFinalReward: r.cell === 1 ? 1 : 0,
          MinimumCntMin: 0,
          MinimumCntMax: 0,
          IsOption: r.cell === 1 ? 1 : 0,
          CellType: 0,
        }));
      }),
    });
    push(10211, 'CSNotifyXianJunActCfg', simpleCfg('xianjun', 'XianJun'));
    push(11972, 'CSNotifyBiHaiActCfg', simpleCfg('bihai', 'BiHai'));
    push(10912, 'CSNotifyLuckWheelConfig', newYearCfg(role));
    push(14806, 'CSTurnEggsActCfgNotify', eggCfg('egg'));
    push(14813, 'CSFestTurnEggsActCfgNotify', eggCfg('festegg'));
    push(12047, 'CSNotifyFindTreasureCfg', treasureCfg());
    push(12085, 'CSNotifyXunXingBigCellCfg', bigCfg());
    push(12086, 'CSNotifyXunXingSmallCellCfg', smallCfg());
    push(12087, 'CSNotifyXunXingDrawPrizeCfg', {
      CfgList: raw.XunXingDrawPrizeConfig.rows.map((r) => ({
        DrawBigPrizeCnt: r.DrawBigPrizeCnt,
        ExpendItemID: r.ExpendItemID,
        ExpendItemCnt: r.ExpendItemCnt,
      })),
      ShowCfgList: [],
      ModelChangeTime: 360,
    });
  }
  push(10013, 'CSNotifyTurnTableAwardData', turnAwardData(role));
  push(10014, 'CSNotifyTurnTableTurnData', {
    Total: 1,
    TurnTableList: [1, 2].map((t) => turnData(role, t)),
  });
  push(10212, 'CSNotifyXianJunActData', simpleData(role, 'xianjun'));
  push(11973, 'CSNotifyBiHaiActData', simpleData(role, 'bihai'));
  push(10913, 'CSNotifyLuckWheelData', newYearData(role));
  push(14801, 'CSGetTurnEggsActDataRes', eggData(role, 'egg'));
  push(14808, 'CSGetFestTurnEggsActDataRes', eggData(role, 'festegg'));
  push(12048, 'CSNotifyFindTreasureData', treasureData(role));
  push(12076, 'CSNotifyFindTreasureLayerCfg', treasureLayer(state(role, 'treasure').layer));
  push(12088, 'CSNotifyXunXingActData', xunData(role));
  for (const [id, cmd, kind] of [
    ['xianjun', 10217, 'XianJunAct'],
    ['bihai', 11978, 'BiHaiAct'],
    ['treasure', 12063, 'FindTreasure'],
    ['xunxing', 12091, 'XunXingAct'],
  ]) {
    const s = state(role, id);
    push(cmd, 'CSNotifyGlobal' + kind + 'Data', {
      Idx: s.draws,
      GlobalDataList: (s.recent || [])
        .slice(-10)
        .map((AwardItem) => ({ Name: role.name, AwardList: list(AwardItem) })),
    });
  }
  return out;
}

const commands = {
  11500: 'CSQueryExchangeShopRes',
  11502: 'CSExchangeShopBuyRes',
  10015: 'CSTurntableTurnRes',
  10017: 'CSGetTurnTableBoxAwardRes',
  11970: 'CSTurntableSetOpRes',
  10213: 'CSXianJunActTurnRes',
  10215: 'CSGetXianJunActBoxAwardRes',
  11974: 'CSBiHaiActTurnRes',
  11976: 'CSGetBiHaiActBoxAwardRes',
  10914: 'CSLuckWheelDrawRes',
  10918: 'CSLuckyWheelSetOpRes',
  14800: 'CSGetTurnEggsActDataRes',
  14802: 'CSGetTurnEggsActLevelRes',
  14804: 'CSGetTurnEggsSelectAwardRes',
  14807: 'CSGetFestTurnEggsActDataRes',
  14809: 'CSGetFestTurnEggsActLevelRes',
  14811: 'CSGetFestTurnEggsSelectAwardRes',
  12049: 'CSFindTreasureDrawPrizeRes',
  12053: 'CSFindTreasureProgressRes',
  12096: 'CSFindTreasureSetOpRes',
  12094: 'CSFindTreasureGetTaskAwardRes',
  12089: 'CSXunXingDrawPrizeRes',
  12092: 'CSXunXingChooseOptRes',
};
export const lotteryCommands = new Set(Object.keys(commands).map(Number));
export function lotteryAction(request, role, rng) {
  const cmd = request.cmd,
    type = commands[cmd];
  if (!type) return null;
  let updated = role,
    awards = [],
    response = { Result: { Ret: 0 } };
  const fail = () => ({ role, awards: [], type, response: { Result: { Ret: 1 } }, ret: 1 });
  const size = (n) => {
    if (request.body.length !== n) throw Error('Invalid lottery request length');
  };
  const int = (at = 0) => request.body.readInt32BE(at);
  const batch = (count) => Number.isInteger(count) && count >= 1 && count <= 100;
  if (cmd === 11500) {
    size(1);
    const shopType = request.body[0],
      s = state(role, 'bihai');
    const offers = shopType === 22 ? operationExchangePool('bihai') : [];
    return {
      role,
      awards,
      type,
      response: {
        Type: shopType,
        ExchangeShopData: {
          RefreshCount: 0,
          AllItemData: {
            ExchangeShopItemData: offers.map((r) => ({
              ExchangeShopItemNO: r.offer,
              ItemID: r.kind === 'gem' ? 70000 + r.quality : r.itemId,
              ItemCnt: r.count,
              CurrencyType: 31,
              CurrencyCount: 0,
              BuyCnt: s.shopCounts?.[r.offer] || 0,
              BuyLimitCnt: MAX,
              BuyLimitType: 0,
            })),
          },
        },
        RefreshTime: END,
      },
      ret: 0,
    };
  }
  if (cmd === 11502) {
    size(9);
    const offer = request.body.readUInt32BE(0),
      shopType = request.body[4],
      count = request.body.readInt32BE(5),
      prize = operationExchangePool('bihai').find((r) => r.offer === offer);
    if (shopType !== 22 || !prize || !batch(count)) return fail();
    const s = state(role, 'bihai');
    s.shopCounts ||= {};
    s.shopCounts[offer] = (s.shopCounts[offer] || 0) + count;
    updated = save(role, 'bihai', s);
    awards = [a(prize.kind === 'gem' ? 70000 + prize.quality : prize.itemId, prize.count * count)];
    return {
      role: updated,
      awards,
      type,
      response: { Result: { Ret: 0 }, BootyAwardList: list(awards) },
      ret: 0,
    };
  }
  if ([14800, 14807].includes(cmd)) {
    size(1);
    return {
      role,
      awards,
      type,
      response: eggData(role, cmd === 14800 ? 'egg' : 'festegg'),
      ret: 0,
    };
  }
  if ([10015, 10213, 11974, 10914].includes(cmd)) {
    size(cmd === 10015 ? 8 : 4);
    const turn = cmd === 10015 ? int() : 0,
      count = int(cmd === 10015 ? 4 : 0);
    if (!batch(count) || (cmd === 10015 && ![1, 2].includes(turn))) return fail();
    const id =
        cmd === 10015
          ? turn === 1
            ? 'wheel'
            : 'xianjun'
          : cmd === 10213
            ? 'xianjun'
            : cmd === 11974
              ? 'bihai'
              : 'newyear',
      key = cmd === 10015 ? 'turn' + turn : id,
      s = state(role, key),
      hits = [];
    for (let i = 0; i < count; i++) {
      const pool = lotteryPool(id),
        available = cmd === 10914 ? pool.filter((r) => !s.counts[r.cell]) : pool,
        r =
          (cmd !== 10914 && (s.draws + i + 1) % 20 === 0) || (cmd === 11974 && s.luck >= 199)
            ? pool[0]
            : pick(available, rng),
        prize = selected(s, id, r.cell);
      hits.push(r.cell);
      awards.push(prize.award);
      s.luck = r.cell === 1 ? 0 : s.luck + 1;
      if (cmd === 10914) {
        s.counts[r.cell] = 1;
        if (r.cell === 1 || Object.keys(s.counts).length === pool.length) {
          for (const rest of pool.filter((r) => !s.counts[r.cell]))
            awards.push(selected(s, id, rest.cell).award);
          s.round++;
          s.counts = {};
        }
      }
    }
    if (cmd === 10914) {
      s.draws += hits.length;
      s.history = [...s.history, ...hits].slice(-100);
    } else record(s, hits);
    updated = save(role, key, s);
    if (cmd === 10914)
      response = {
        ...response,
        CellList: hits.map((CellID) => ({
          CellID,
          GetCnt: s.counts[CellID] || 0,
          ChooseBootyID: selected(s, id, CellID).booty,
        })),
        BootyList: list(awards),
      };
    else
      response = {
        ...response,
        ...(cmd === 10015 ? { TurnTableType: turn } : {}),
        HitCellList: { HitCellID: hits },
        BootyAwardList: list(awards),
      };
  } else if ([10017, 10215, 11976].includes(cmd)) {
    size(cmd === 10017 ? 8 : 4);
    const turn = cmd === 10017 ? int() : 0,
      n = int(cmd === 10017 ? 4 : 0);
    if (cmd === 10017 && ![1, 2].includes(turn)) return fail();
    const id = cmd === 10017 ? 'wheel' : cmd === 10215 ? 'xianjun' : 'bihai',
      key = cmd === 10017 ? 'turn' + turn : id,
      s = state(role, key);
    if (!thresholds.includes(n) || s.draws < n || s.claimed.includes(n)) return fail();
    s.claimed.push(n);
    awards = milestone(id, n);
    updated = save(role, key, s);
    response = {
      ...response,
      ...(cmd === 10017 ? { TurnTableType: turn, NeedTurnCnt: n } : { CumuCnt: n }),
      BootyAwardList: list(awards),
    };
  } else if ([11970, 10918, 12092].includes(cmd)) {
    size(cmd === 11970 ? 12 : 8);
    const turn = cmd === 11970 ? int() : 0,
      cell = int(cmd === 11970 ? 4 : 0),
      booty = int(cmd === 11970 ? 8 : 4);
    if (cmd === 11970 && ![1, 2].includes(turn)) return fail();
    const id =
        cmd === 11970 ? (turn === 1 ? 'wheel' : 'xianjun') : cmd === 10918 ? 'newyear' : 'xunxing',
      key = cmd === 11970 ? 'turn' + turn : id,
      s = state(role, key),
      opts =
        cmd === 12092
          ? bigCfg().CfgList.find((r) => r.BigCellID === cell)?.BootyEntryList
          : choices(id, cell, s.round);
    if (!opts?.some((r) => (r.BootyID ?? r.booty) === booty)) return fail();
    s.choices[cell] = booty;
    updated = save(role, key, s);
  } else if ([14802, 14809].includes(cmd)) {
    size(1);
    const free = request.body[0];
    if (free > 1) return fail();
    const id = cmd === 14802 ? 'egg' : 'festegg',
      s = state(role, id);
    if (s.floor >= 6 || s.claimReady) return fail();
    const result = advanceEgg(s, !free, () => rng(100) / 100);
    if (!result.ok) return fail();
    updated = save(role, id, s);
  } else if ([14804, 14811].includes(cmd)) {
    size(4);
    const id = cmd === 14804 ? 'egg' : 'festegg',
      s = state(role, id),
      prize = eggOptions(id, s.floor).find((r) => r.booty === int());
    if (!prize || !eggCanClaim(s)) return fail();
    awards = [prize.award];
    resetEgg(s);
    updated = save(role, id, s);
    response = { ...response, BootyAwardList: list(awards) };
  } else if (cmd === 12049) {
    size(4);
    const count = int();
    if (!batch(count)) return fail();
    const s = state(role, 'treasure'),
      hits = [];
    for (let i = 0; i < count; i++) {
      const hit = treasureStep(s, (rows) =>
        pick(
          rows.map((r) => ({ ...r, weight: r.Weight })),
          rng,
        ),
      );
      if (!hit) return fail();
      awards.push(lotteryPool('treasure')[hit.index % 12].award);
      hits.push({ CellID: hit.cell.CellID, Layer: hit.layer });
    }
    updated = save(role, 'treasure', s);
    response = { ...response, BootyList: list(awards), CellList: hits };
  } else if ([12053, 12096].includes(cmd)) {
    size(8);
    const layer = int(),
      booty = int(4),
      s = state(role, 'treasure'),
      prize = treasureChoices(layer).find((r) => r.booty === booty);
    if (layer < 1 || layer > lastTreasureLayer || !prize) return fail();
    if (cmd === 12053) {
      if (!s.progress.includes(layer) || s.claimed.includes(layer)) return fail();
      s.claimed.push(layer);
      awards = [prize.award];
    }
    s.choices[layer] = booty;
    updated = save(role, 'treasure', s);
  } else if (cmd === 12094) {
    size(4);
    const s = state(role, 'treasure');
    if (int() !== 1 || s.draws < (s.task + 1) * 10) return fail();
    s.task++;
    updated = save(role, 'treasure', s);
    awards = [a(1001, 5)];
  } else if (cmd === 12089) {
    size(4);
    if (![0, 1].includes(int())) return fail();
    const s = state(role, 'xunxing'),
      small = smallCfg().CfgList,
      big = bigCfg().CfgList,
      turn = starTurn(s, !!int(), (rows) =>
        pick(
          rows.map((r) => ({ ...r, weight: r.Weight })),
          rng,
        ),
      ),
      hits = turn.hits.map((r) => r.SmallCellID);
    for (const id of hits)
      awards.push(...small.find((r) => r.SmallCellID === id).BootyAwardList.AwardItem);
    if (turn.big) {
      const b = big.find((r) => r.BigCellID === turn.big.BigCellID),
        prize =
          b.BootyEntryList.find((r) => r.BootyID === s.choices[b.BigCellID]) || b.BootyEntryList[0];
      awards.push(...prize.BootyAwardList.AwardItem);
    }
    updated = save(role, 'xunxing', s);
    response = {
      ...response,
      CellList: hits,
      BigCellID: turn.big?.BigCellID || 0,
      BootyList: list(awards),
    };
  }
  if (awards.length) {
    const id =
        cmd === 10015 || cmd === 10017
          ? 'turn' + int()
          : cmd === 10213 || cmd === 10215
            ? 'xianjun'
            : cmd === 11974 || cmd === 11976
              ? 'bihai'
              : cmd === 10914
                ? 'newyear'
                : cmd === 14804
                  ? 'egg'
                  : cmd === 14811
                    ? 'festegg'
                    : cmd === 12089
                      ? 'xunxing'
                      : 'treasure',
      s = state(updated, id);
    s.recent = [...(s.recent || []), structuredClone(awards)].slice(-20);
    updated = save(updated, id, s);
  }
  return { role: updated, awards, type, response, ret: 0 };
}
