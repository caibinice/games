import { lotteryText } from './lottery-state.mjs';
import { NATIVE_OPERATIONS as N } from '../../public/native-operations-data.mjs';
export const BOX_ACTIVITY_ID = 56001,
  BOX_SUB_ID = 5600101;
export function operTextData(body) {
  if (body.length < 8 || body.length > 264) throw Error('Invalid operating-text request');
  const count = body.readInt32BE(4);
  if (count < 0 || count > 64 || body.length !== 8 + count * 4)
    throw Error('Invalid operating-text count');
  const labels = [
    '魔方宝藏 · 本地常开',
    '活动奖励',
    '免费抽取',
    '抽取一次',
    '抽取五次',
    '活动规则',
    N.params.LimitBoxFuncParamConfig.rows.find((r) => r.id === 108).text,
    N.params.LimitBoxFuncParamConfig.rows.find((r) => r.id === 109).text,
  ];
  return {
    TextConfig: Array.from({ length: count }, (_, i) => {
      const ID = body.readInt32BE(8 + i * 4);
      return {
        ID,
        ...(lotteryText(ID) || {
          ArgNum: 0,
          Content:
            N.texts[ID]?.plain ||
            labels[ID - 1015900000] ||
            (ID === 1
              ? '操作条件未满足：请检查等级上限、锁定或领取状态。'
              : '未配置的文本（' + ID + '）'),
        }),
      };
    }),
  };
}
const award = (type, id, count) => ({
  AwardItemType: type,
  AwardItemID: id,
  AwardItemCnt: count,
  AwardItemParam: [0, 0, 0],
  AwardItemRunParam: [0, 0],
  IsBroadCast: 0,
});
// Generic manual/blueprint rewards have no resolved live BootyID in this APK.
// These explicit local item mappings are not claimed as the original server pool.
const localIds = {
  1: 99009,
  3: 50001,
  4: 61001,
  5: 1003,
  6: 1004,
  7: 91003,
  8: 100002,
  10: 50002,
  11: 61002,
  12: 91901,
};
export const boxPool = N.apkBuiltInLimitBoxPool.map((r) => ({
  ...r,
  award: r.rewardType === 'gold' ? award(2, 99002, r.count) : award(1, localIds[r.slot], r.count),
}));
export const boxState = (role) => ({
  ...{ DrawCnt: 0, LuckValue: 0, history: [] },
  ...role.localBox,
});
export function activityOpenData() {
  return {
    ActivityList: [
      {
        ActivityID: BOX_ACTIVITY_ID,
        ActivityType: 56,
        ActivityTypeParam: 0,
        OpenTime: 1,
        EndTime: 4102444800,
        DelayTime: 0,
        UIConfigID: 0,
      },
    ],
  };
}
export function boxData(role) {
  const s = boxState(role);
  return {
    ActivityID: BOX_ACTIVITY_ID,
    ActSubID: BOX_SUB_ID,
    DrawCnt: s.DrawCnt,
    LuckValue: s.LuckValue,
  };
}
export function boxConfig() {
  return {
    BootyCfgList: boxPool.map((r) => ({
      ActSubID: BOX_SUB_ID,
      Sort: r.slot,
      Type: 0,
      Weight: r.weight,
      BootyList: { AwardItem: [r.award] },
      DisplayRate: r.percent / 100,
    })),
    ParamCfgList: N.params.LimitBoxFuncParamConfig.rows.map((r) => ({
      FuncID: r.id,
      Value: [102, 103].includes(r.id) ? 0 : r.id === 104 ? 1000000000 : r.value,
    })),
    LuckBootyCfgList: [
      { OrderID: 1, NeedLuckValue: 200, BootyList: { AwardItem: [boxPool[0].award] } },
    ],
  };
}
export function drawBox(role, count, pick) {
  if (!Number.isInteger(count) || count < 1 || count > 100) return { ret: 1 };
  const state = boxState(role),
    awards = [],
    results = [],
    luck = [];
  const total = boxPool.reduce((n, r) => n + r.weight, 0);
  for (let i = 0; i < count; i++) {
    let selected;
    if (state.LuckValue + 1 >= 200) {
      selected = boxPool[0];
    } else {
      let n = pick(total);
      selected = boxPool.find((r) => (n -= r.weight) < 0) || boxPool.at(-1);
    }
    state.DrawCnt++;
    state.LuckValue = selected.slot === 1 ? 0 : state.LuckValue + 1;
    results.push(selected.slot);
    awards.push(selected.award);
  }
  state.history = [...state.history, ...results].slice(-100);
  return { ret: 0, role: { ...role, localBox: state }, awards, results, luck };
}
