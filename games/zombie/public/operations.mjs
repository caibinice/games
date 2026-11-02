import { seasonalTurn } from './seasonal-lottery.mjs';
import { advanceEgg, eggCanClaim, eggRewardIndexes, resetEgg } from './egg-lottery.mjs';
import {
  normalizeTreasureBoard,
  normalizeStarBoard,
  treasureStep,
  starTurn,
  starOptions,
  STAR_SMALL,
} from './board-lotteries.mjs';
import { NATIVE_OPERATIONS as DATA } from './native-operations-data.mjs';
import { ensureNative, grantNativeGood, SKILL_IDS, GROWTH } from './native-progression.mjs';
import { DROP_GEMS } from './native-gems.mjs';

export const OPERATIONS = [
  {
    id: 'wheel',
    name: '幸运转盘',
    icon: 'zmzg_zjm_icon_xingyunzhuanpan',
    page: 'luckwheelactui',
    rule: 21010006,
    mode: 'wheel',
  },
  {
    id: 'armed',
    name: '武装降临',
    icon: 'zmzg_zjm_icon_jijialaixi',
    page: 'turntabnewyearpage',
    rule: 21010006,
    mode: 'wheel',
    ui: 33001,
  },
  {
    id: 'box',
    name: '魔方宝藏',
    icon: 'zmzg_zjm_icon_xianfengbaozang',
    page: 'timelimitboxui',
    rule: 21180700,
    mode: 'box',
  },
  {
    id: 'egg',
    name: '扭蛋工坊',
    icon: 'zmzg_zjm_icon_ndgf',
    page: 'luckyeggui',
    rule: 21590003,
    mode: 'egg',
  },
  {
    id: 'festegg',
    name: '龙舟祈愿',
    icon: 'zmzg_zjm_icon_duanyangzhixia',
    page: 'sixoneluckyeggpage',
    rule: 21590003,
    mode: 'egg',
    eggUi: 66001,
  },
  {
    id: 'spring',
    name: '踏春转盘',
    icon: 'zmzg_zjm_icon_tachun',
    page: 'turntabnewyearpage',
    rule: 21010006,
    mode: 'wheel',
    ui: 33003,
  },
  {
    id: 'newyear',
    name: '龙年转盘',
    icon: 'zmzg_zjm_icon_longnianhuodong',
    page: 'turntabnewyearpage',
    rule: 21010006,
    mode: 'wheel',
    ui: 33002,
  },
  {
    id: 'treasure',
    name: '废墟寻宝',
    icon: 'zmzg_zjm_icon_xianfengbaozang',
    page: 'treasurehuntpage',
    rule: 0,
    mode: 'treasure',
  },
  {
    id: 'xunxing',
    name: '寻星访月',
    icon: 'zmzg_zjm_icon_xunxingfangyue',
    page: 'xunxinglottreryui',
    rule: 0,
    mode: 'star',
  },
  {
    id: 'bihai',
    name: '碧海凉夏',
    icon: 'zmzg_zjm_icon_bihailiangxia',
    page: 'bihaiturntableui',
    rule: 0,
    mode: 'bihai',
  },
];
const itemIds = {
  魔方核心: 99009,
  基建耗材: 1003,
  工程图纸: 1004,
  强化补剂: 100002,
  枪械紫塑剂: 91901,
  数码危机: 91003,
};
// Only this pool and its weights are embedded in the local APK. The other
// event pools are explicit offline catalogues, not the online server's odds.
export const OP_POOL = DATA.apkBuiltInLimitBoxPool.map((r) => ({
  ...r,
  itemId: itemIds[r.nameText] || 0,
}));
const skins = (type) =>
  GROWTH.SkinBaseConfig.filter(
    (r) =>
      r.SkinType === type &&
      r.CostItemID &&
      r.CostItemCnt &&
      GROWTH.SkinLevelConfig.some((l) => l.SkinID === r.SkinID && l.SkinLevel === 1),
  );
const outfits = skins(1),
  forms = skins(2),
  mercs = GROWTH.MercenaryBaseConfig.filter(
    (r) => r.CostItem?.CostItemID && r.CostItem?.CostItemCnt,
  );
const prize = (nameText, kind, count = 1, itemId = 0, icon = '') => ({
  nameText,
  kind,
  count,
  itemId,
  icon,
});
const outfit = () => prize('随机时装', 'outfit', 1, 0, outfits[0]?.IconName);
const form = () => prize('随机核心幻形', 'form', 1, 0, forms[0]?.IconName);
const merc = () => prize('随机佣兵碎片', 'merc', 1, 0, mercs[0]?.Icon);
const gem = (q) => ({
  ...prize({ 5: '传说', 6: '绝世', 7: '至尊' }[q] + '宝石', 'gem', 1, 0, 'icon_baoshi_4'),
  quality: q,
});
const goods = (name, id, count) => prize(name, 'goods', count, id);
const gold = (n) => prize('金币', 'gold', n);
const manual = (n) => prize('技能手册', 'manual', n);
const blueprint = (n) => prize('装备图纸', 'blueprint', n);
const reagent = (n) => goods('焕新试剂', 1001, n);
const skinMat = () => goods('时装紫塑剂', 81901, 5);
const soldierMat = () => goods('强化补剂', 100002, 20);
const fixedSkin = (type, index = 0) => {
  const r = skins(type)[index % skins(type).length];
  return goods(r.skinNameText + '材料', r.CostItemID, r.CostItemCnt);
};
const fixedMerc = (index, count) => {
  const r = mercs[index % mercs.length];
  return goods(r.nameText + '碎片', r.CostItem.CostItemID, count);
};
const rows = (items) =>
  items.map((r, i) => ({
    ...r,
    slot: i + 1,
    weight: [2, 3, 4, 4, 5, 6, 7, 8, 9, 12, 15, 20][i] || 1,
    localPool: true,
  }));
const POOLS = {
  bihai: rows([
    fixedMerc(0, 10),
    goods('数码危机·枪械', 91003, 1),
    fixedMerc(2, 30),
    soldierMat(),
    fixedSkin(1),
    reagent(20),
    goods('深海遗珠', 99031, 5),
    blueprint(15),
    gem(6),
    gold(3000),
    goods('沙滩铲', 2024, 5),
    gold(700),
  ]),
  wheel: rows([
    gem(7),
    form(),
    gem(6),
    reagent(20),
    gem(5),
    reagent(12),
    manual(30),
    blueprint(10),
    gold(2000),
    soldierMat(),
    goods('枪械紫塑剂', 91901, 3),
    gold(500),
  ]),
  armed: rows([
    merc(),
    goods('数码危机·枪械', 91003, 1),
    merc(),
    soldierMat(),
    merc(),
    goods('枪械紫塑剂', 91901, 5),
    soldierMat(),
    blueprint(15),
    manual(40),
    gold(3000),
    reagent(12),
    gold(700),
  ]),
  spring: rows([
    outfit(),
    form(),
    outfit(),
    skinMat(),
    reagent(20),
    gem(6),
    skinMat(),
    manual(30),
    blueprint(10),
    gold(2500),
    reagent(6),
    gold(600),
  ]),
  newyear: rows([
    outfit(),
    form(),
    gem(7),
    skinMat(),
    outfit(),
    reagent(20),
    gem(6),
    skinMat(),
    soldierMat(),
    gold(3000),
    manual(40),
    gold(600),
  ]),
  treasure: rows([
    gem(7),
    reagent(30),
    gem(6),
    blueprint(30),
    gem(5),
    reagent(20),
    goods('工程图纸', 1004, 10),
    goods('基建耗材', 1003, 20),
    manual(50),
    gold(3000),
    blueprint(10),
    gold(700),
  ]),
  xunxing: rows([
    form(),
    form(),
    outfit(),
    gem(7),
    reagent(20),
    form(),
    skinMat(),
    gem(6),
    manual(50),
    gold(3000),
    reagent(12),
    gold(700),
  ]),
  egg: rows([
    form(),
    outfit(),
    merc(),
    gem(7),
    reagent(30),
    gem(6),
    skinMat(),
    soldierMat(),
    manual(50),
    blueprint(15),
    reagent(12),
    gold(1000),
  ]),
};
POOLS.festegg = rows([
  outfit(),
  form(),
  merc(),
  gem(7),
  reagent(30),
  gem(6),
  skinMat(),
  soldierMat(),
  manual(50),
  blueprint(15),
  reagent(12),
  gold(1000),
]);
export const operationPool = (id, full = false) =>
  id === 'box' ? OP_POOL : (POOLS[id] || []).slice(0, !full && operation(id)?.ui ? 10 : 12);
const int = (v, max = 1e9) =>
  Math.max(0, Math.min(max, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0));
export const operation = (id) => OPERATIONS.find((o) => o.id === id);
export const BIHAI_THRESHOLDS = [20, 50, 100, 200];
const EXCHANGE_POOL = [
  fixedSkin(2),
  fixedSkin(1),
  gem(7),
  reagent(30),
  fixedMerc(0, 10),
  goods('数码危机·枪械', 91003, 1),
].map((r, i) => ({ ...r, offer: 220001 + i }));
export const operationExchangePool = (id) => (id === 'bihai' ? EXCHANGE_POOL : []);
export function exchangeOperationReward(p, id, offer) {
  const prize = operationExchangePool(id).find((r) => r.offer === offer);
  if (!prize) return { ok: false, reason: '请选择有效的兑换商品' };
  const s = operationState(p, id),
    reward = grantOperationReward(p, prize);
  s.shopCounts ||= {};
  s.shopCounts[offer] = Math.min(1e9, (s.shopCounts[offer] || 0) + 1);
  return { ok: true, reward };
}
export function claimBihaiMilestone(p, target) {
  const s = operationState(p, 'bihai');
  s.cumulativeClaimed = Array.isArray(s.cumulativeClaimed) ? s.cumulativeClaimed : [];
  if (
    !BIHAI_THRESHOLDS.includes(target) ||
    s.draws < target ||
    s.cumulativeClaimed.includes(target)
  )
    return { ok: false, reason: '累计次数不足或奖励已领取' };
  s.cumulativeClaimed.push(target);
  return {
    ok: true,
    reward: grantOperationReward(p, goods('强化补剂', 100002, target === 200 ? 20 : 5)),
  };
}
export function operationState(p, id) {
  if (!operation(id)) return null;
  const pool = operationPool(id),
    all = ensureNative(p).operations,
    raw = all[id] || {};
  const s = (all[id] = Object.assign(raw, {
    draws: int(raw.draws),
    luck: int(raw.luck, 199),
    floor: int(raw.floor, 6),
    protect: int(raw.protect, 2),
    claimReady: raw.claimReady === true,
    round: int(raw.round),
    batch: Math.max(1, int(raw.batch || 1, 10)),
    pointers: Math.max(1, int(raw.pointers || 1, 3)),
    taken: Array.isArray(raw.taken)
      ? [...new Set(raw.taken.filter((slot) => pool.some((r) => r.slot === slot)))].slice(
          0,
          pool.length - 1,
        )
      : [],
    coupons: int(raw.coupons),
    claimed: int(raw.claimed),
    selection: int(raw.selection, pool.length - 1),
    last: Array.isArray(raw.last)
      ? raw.last.filter((r) => pool.some((x) => x.slot === r.slot)).slice(-10)
      : [],
  }));
  if (id === 'treasure') normalizeTreasureBoard(s);
  if (id === 'xunxing') normalizeStarBoard(s);
  if (id === 'bihai') {
    s.cumulativeClaimed = [
      ...new Set(
        (Array.isArray(s.cumulativeClaimed) ? s.cumulativeClaimed : []).filter(
          (n) => BIHAI_THRESHOLDS.includes(n) && n <= s.draws,
        ),
      ),
    ];
    s.shopCounts =
      s.shopCounts && typeof s.shopCounts === 'object' && !Array.isArray(s.shopCounts)
        ? s.shopCounts
        : {};
  }
  return s;
}
const rand = (p) => {
  p.seed = (Math.imul(p.seed, 1664525) + 1013904223) >>> 0;
  return p.seed / 4294967296;
};
const choose = (p, arr) => arr[Math.floor(rand(p) * arr.length)];
export function weightedPick(rows, rng) {
  if (!rows.length) return null;
  let v = Math.max(0, Math.min(0.999999999, rng())) * rows.reduce((n, r) => n + r.weight, 0);
  return rows.find((r) => (v -= r.weight) < 0) || rows.at(-1);
}
export function grantOperationReward(p, reward) {
  let r = { ...reward };
  if (r.kind === 'outfit' || r.kind === 'form') {
    const row = choose(p, r.kind === 'outfit' ? outfits : forms);
    if (!row) return null;
    r = {
      ...r,
      nameText: row.skinNameText,
      itemId: row.CostItemID,
      count: row.CostItemCnt,
      icon: row.IconName,
      skinId: row.SkinID,
    };
    grantNativeGood(p, r.itemId, r.count);
  } else if (r.kind === 'merc') {
    const row = choose(p, mercs);
    if (!row) return null;
    r = {
      ...r,
      nameText: row.nameText + '碎片',
      itemId: row.CostItem.CostItemID,
      count: row.CostItem.CostItemCnt,
      icon: row.Icon,
      mercenaryId: row.ID,
    };
    grantNativeGood(p, r.itemId, r.count);
  } else if (r.kind === 'gem') {
    const row = choose(
      p,
      DROP_GEMS.filter((g) => g.quality === r.quality),
    );
    if (!row) return null;
    const id = 'gem-native:' + row.id;
    p.inventory[id] = Math.min(1e9, (p.inventory[id] || 0) + 1);
    r = {
      ...r,
      gemId: id,
      nameText: { 5: '传说', 6: '绝世', 7: '至尊' }[row.quality] + '宝石',
      description: row.description,
    };
  } else if (r.kind === 'gold' || r.nameText === '金币') p.gold = Math.min(1e9, p.gold + r.count);
  else if (r.kind === 'manual' || r.nameText === '技能手册') {
    const ids = Object.values(SKILL_IDS);
    for (let i = 0; i < r.count; i++)
      grantNativeGood(p, 61000 + ids[Math.floor(rand(p) * ids.length)] / 1000, 1);
    for (const [key, id] of Object.entries(SKILL_IDS))
      p.skills[key].cards = ensureNative(p).goods[61000 + id / 1000] || 0;
  } else if (r.kind === 'blueprint' || r.nameText === '装备图纸') {
    for (let i = 0; i < r.count; i++) grantNativeGood(p, 50001 + Math.floor(rand(p) * 6), 1);
  } else if (r.itemId) grantNativeGood(p, r.itemId, r.count);
  return r;
}
export function drawOperation(p, id, count = 1, rng = () => rand(p)) {
  const op = operation(id),
    s = operationState(p, id);
  if (!op || op.mode === 'egg') return [];
  const base = operationPool(id),
    out = [];
  const pick = (rows) =>
      weightedPick(
        rows.map((r) => ({ ...r, weight: r.Weight })),
        rng,
      ),
    give = (r) => {
      const reward = grantOperationReward(p, r);
      if (reward) out.push(reward);
    };
  if (op.mode === 'treasure') {
    for (let i = 0; i < Math.max(1, int(count, 100)); i++) {
      const hit = treasureStep(s, pick);
      if (!hit) break;
      give({
        ...base[hit.index % base.length],
        boardCell: hit.cell.CellID,
        boardLayer: hit.layer,
        boardCircle: hit.circle,
      });
    }
    s.last = out.slice(-10);
    s.lastCount = out.length;
    return out;
  }
  if (op.mode === 'star') {
    const turn = starTurn(s, count > 1, pick);
    for (const hit of turn.hits)
      give({
        ...base[(STAR_SMALL.findIndex((r) => r.SmallCellID === hit.SmallCellID) + 5) % base.length],
        starCell: hit.SmallCellID,
      });
    if (turn.big) {
      const cell = turn.big.BigCellID,
        options = starOptions(cell),
        selected = options.find((r) => r.booty === s.choices[cell]) || options[0];
      give({ ...base[selected.poolIndex], starBigCell: cell });
    }
    s.last = out.slice(-10);
    s.lastCount = out.length;
    return out;
  }
  for (let i = 0; i < Math.max(1, int(count, 100)); i++) {
    s.draws++;
    s.luck++;
    let pool = base;
    if (op.mode === 'wheel' && s.selection) {
      pool = base.map((r, i) =>
        i === 0 ? { ...base[s.selection], slot: r.slot, weight: r.weight } : r,
      );
    }
    if (op.ui) {
      const turn = seasonalTurn(
        s,
        pool,
        (rows) => weightedPick(rows, rng),
        (r) => grantOperationReward(p, r),
      );
      if (turn.won.slot === 1) s.luck = 0;
      out.push(...turn.rewards);
      continue;
    }
    const prize =
      (op.mode === 'box' || op.mode === 'bihai') && s.luck >= 200
        ? base[0]
        : weightedPick(pool, rng);
    if (prize.slot === 1) s.luck = 0;
    const resolved = grantOperationReward(p, prize);
    if (resolved) out.push(resolved);
  }
  s.last = out.slice(-10);
  s.lastCount = out.length;
  return out;
}
export function playEgg(p, protect = false, rng = () => rand(p), id = 'egg') {
  if (operation(id)?.mode !== 'egg') return { ok: false, reason: '活动类型不匹配' };
  return advanceEgg(operationState(p, id), protect, rng);
}
export const eggOptions = (floor, id = 'egg') =>
  eggRewardIndexes(int(floor, 6)).map((i) => ({ ...operationPool(id)[i] }));
export const eggReward = (floor, id = 'egg') => eggOptions(floor, id)[0];
export function claimEgg(p, choice = 0, id = 'egg') {
  if (operation(id)?.mode !== 'egg') return { ok: false, reason: '活动类型不匹配' };
  const s = operationState(p, id);
  if (!eggCanClaim(s)) return { ok: false, reason: '请先抽取，再选择本层奖励' };
  if (!Number.isInteger(choice) || choice < 0 || choice > 3)
    return { ok: false, reason: '请选择本层四项奖励之一' };
  const floor = s.floor,
    prize = grantOperationReward(p, eggOptions(floor, id)[choice]);
  if (!prize) return { ok: false, reason: '奖励配置缺失' };
  resetEgg(s);
  s.last = [prize];
  return { ok: true, floor, reward: prize };
}
export function claimOperationMilestone(p, id) {
  const s = operationState(p, id);
  if (!s) return { ok: false };
  if (['treasure', 'star', 'egg', 'bihai'].includes(operation(id).mode))
    return { ok: false, reason: '请使用本活动的专属领奖入口' };
  const target = (s.claimed + 1) * 20;
  if (s.draws < target) return { ok: false, reason: '还需抽取' + (target - s.draws) + '次' };
  s.claimed++;
  const reward = grantOperationReward(p, { ...operationPool(id)[0], count: 1 });
  return { ok: true, reward };
}
export function selectStarReward(p, cell, booty) {
  const options = starOptions(cell);
  if (!options.some((r) => r.booty === booty)) return { ok: false, reason: '请选择该星位的奖励' };
  operationState(p, 'xunxing').choices[cell] = booty;
  return { ok: true };
}
export function selectTreasureReward(p, layer, index) {
  if (
    !Number.isInteger(layer) ||
    layer < 1 ||
    layer > 20 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 2
  )
    return { ok: false, reason: '请选择有效的层数和奖励' };
  const s = operationState(p, 'treasure');
  if (s.boardClaimed.includes(layer)) return { ok: false, reason: '该层奖励已领取' };
  s.choices[layer] = index;
  return { ok: true };
}
export function claimTreasureLayer(p, layer, index) {
  const s = operationState(p, 'treasure');
  if (!s.progress.includes(layer) || s.boardClaimed.includes(layer))
    return { ok: false, reason: '该层尚未完成或已领取' };
  if (!Number.isInteger(index) || index < 0 || index > 2)
    return { ok: false, reason: '请选择三项奖励之一' };
  const reward = grantOperationReward(p, operationPool('treasure')[index]);
  if (!reward) return { ok: false, reason: '奖励配置缺失' };
  s.boardClaimed.push(layer);
  return { ok: true, reward };
}
export function claimTreasureTask(p) {
  const s = operationState(p, 'treasure');
  if (s.draws < (s.task + 1) * 10) return { ok: false, reason: '每完成10次寻宝可领取一次任务奖励' };
  s.task++;
  return { ok: true, reward: grantOperationReward(p, goods('焕新试剂', 1001, 5)) };
}
export const operationRules = (id) => {
  if (id === 'bihai')
    return '中央贝壳是大奖，周围有11个普通奖位。开奖只切换奖位亮光，不旋转整个奖盘。每抽一次累计1点幸运值，达到200点必得中央大奖，获得大奖后幸运值清零。累计20、50、100、200次可分别领取奖励，不按周重置。兑换商店和抽奖均免费不限次；奖品为明确配置的本地奖池，不代表原服当期奖励和概率。';
  if (id === 'treasure')
    return '按当前层的原生环数寻宝，同一环内已获得的格子不重复抽取。抽中本环大奖或取完本环后进入下一环，完成全部环后进入下一层。已完成层可额外三选一领取阶段奖励，每10次寻宝可领取一次任务奖励。';
  if (id === 'xunxing')
    return '七个小星位不重复抽取，特殊星位触发一次大奖抽取并重置小星位。大奖位同轮不重复，最低触发次序读取客户端配置；获得第七个大奖后结算本轮并开启新轮，最后一奖仍正常发放。连抽会在触发大奖时停止，自选大奖可在对应星位中设置。';
  const op = operation(id);
  return DATA.texts[op?.rule]?.plain || '';
};
