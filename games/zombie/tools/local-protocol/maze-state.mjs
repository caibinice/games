import {
  MAZE_SOURCE as S,
  MAZE_FUNCTION_GROUPS as GROUPS,
  MAZE_EVENTS as E,
  MAZE_SCORE_REWARDS,
} from './maze-source.mjs';
import { isMazeBattle } from './campaign-state.mjs';
export const mazeState = (role) => {
  const s = {
    level: 1,
    type: 1,
    row: 1,
    col: 1,
    coin: 1000000,
    score: 0,
    highScore: 0,
    resets: 0,
    claims: [],
    drugs: {},
    capsules: [],
    effects: [],
    rand: { IsEvent: 0, EventID: 0, RandItem: [] },
    shopRefreshes: 0,
    shopBought: [],
    ...structuredClone(role.localMaze || {}),
  };
  if (!s.row && !s.col) {
    s.row = 1;
    s.col = 1;
  }
  if (s.pending)
    for (const n of s.pending.NpcData || []) {
      if (!S.MessMonsterLibraryConfig.some((r) => r.ID === n.ID)) {
        const r = S.MessMonsterLibraryConfig.find((r) =>
          [r.MonsterID, r.EliteID, r.BossID].includes(n.ID),
        );
        if (r) n.ID = r.ID;
      }
    }
  return s;
};
const emptyRand = () => ({ IsEvent: 0, EventID: 0, RandItem: [] });
function randomFor(role, s, salt = 0) {
  let x =
    role.createdAt ^ (s.resets * 2654435761) ^ (s.level * 97531) ^ (s.type * 7919) ^ salt || 12345;
  return (max) => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) % Math.max(1, max);
  };
}
function pick(pool, weight, random) {
  let n = random(pool.reduce((n, r) => n + Math.max(0, weight(r)), 0));
  return pool.find((r) => (n -= Math.max(0, weight(r))) < 0) || pool[0];
}
const layout = (s) => S.MessMapConfig.filter((r) => r.Level === s.level && r.Type === s.type);
function advance(s) {
  s.highScore = Math.max(s.highScore, s.score);
  const row = layout(s).find((r) => r.Row === s.row && r.Clo === s.col);
  if (row && row.NextGrid.every((n) => !n.Row && !n.Clo)) {
    if (s.level < 3) {
      s.level++;
      s.type = 1;
      s.row = 1;
      s.col = 1;
      s.previousRow = 0;
      s.previousCol = 0;
    } else s.completed = true;
  }
}
function addItem(s, type, id) {
  if (type === 1) {
    const cfg = E.MessYaoJiConfig.find((r) => r.YaoJiID === id);
    if (!cfg || (s.drugs[id] || 0) >= cfg.MaxCount) return false;
    if (cfg.PreID) delete s.drugs[cfg.PreID];
    s.drugs[id] = (s.drugs[id] || 0) + 1;
    return true;
  }
  if (type === 2 && E.MessJiaoNangConfig.some((r) => r.JiaoNangID === id)) {
    if (!s.capsules.includes(id)) s.capsules.push(id);
    return true;
  }
  return false;
}
const drugPool = (s) =>
  E.MessYaoJiConfig.filter(
    (r) => r.Weight > 0 && (s.drugs[r.YaoJiID] || 0) < r.MaxCount && (!r.PreID || s.drugs[r.PreID]),
  );
const rangeCount = (min, max, random) => min + random(Math.max(0, max - min) + 1);
function offerDrugs(role, s, salt = 0) {
  const random = randomFor(role, s, 70000 + salt + s.score),
    pool = drugPool(s),
    options = [];
  while (pool.length && options.length < 3) {
    const r = pick(pool, (v) => v.Weight, random);
    pool.splice(pool.indexOf(r), 1);
    options.push({ Type: 1, ItemID: r.YaoJiID });
  }
  s.rand = { IsEvent: 0, EventID: 0, RandItem: options };
  if (!options.length) s.drugChoices = 0;
}
function queueDrugChoices(role, s, count, salt = 0) {
  s.drugChoices = (s.drugChoices || 0) + count;
  if (s.drugChoices) offerDrugs(role, s, salt);
}
function shopData(role, p = {}) {
  const s = mazeState(role),
    random = randomFor(role, s, 50000 + s.shopRefreshes),
    pool = [...S.MessShopConfig],
    items = [];
  while (pool.length && items.length < 6) {
    const r = pick(pool, (v) => v.Rate, random);
    pool.splice(pool.indexOf(r), 1);
    items.push({
      ID: r.ShopID,
      ItemID: r.ItemID,
      ItemType: r.Type,
      BuyCount: s.shopBought.includes(r.ShopID) ? 1 : 0,
      MoneyType: r.CurrencyType,
      MoneyCnt: p.freeActions ? 0 : r.Price,
      Sort: items.length + 1,
    });
  }
  return { RefreshCnt: 0, ItemData: items };
}
export function mazeScoreData(role) {
  const s = mazeState(role);
  return {
    CurScore: s.score,
    HisScore: Math.max(s.highScore, s.score),
    AwardList: E.MessScoreBootyConfig.map((r) => ({
      Level: r.Level,
      Score: r.Score,
      IsAward: s.claims.includes(r.Level) ? 1 : 0,
      BootyList: {
        AwardItem: MAZE_SCORE_REWARDS.filter((a) => a.BootyID === r.BootyID).map(
          ({ BootyID, ...a }) => a,
        ),
      },
    })),
  };
}
export function mazeRoleData(role) {
  const s = mazeState(role),
    eventPending = s.rand.IsEvent && s.previousRow > 0;
  return {
    Result: { Ret: 0 },
    Level: s.level,
    Type: s.type,
    MessCoin: s.coin,
    MessScore: s.score,
    ResetCount: 0,
    CurRow: s.pending?.Row || s.row,
    CurClo: s.pending?.Clo || s.col,
    PreRow: eventPending ? s.previousRow : s.row,
    PreClo: eventPending ? s.previousCol : s.col,
    YaoJi: {
      YaoJiData: Object.entries(s.drugs).map(([ID, ItemCnt]) => ({ ID: Number(ID), ItemCnt })),
    },
    JiaoNang: { JiaoNangData: s.capsules.map((ID) => ({ ID })) },
    Effect: { EffectData: s.effects.map((ID) => ({ ID })) },
    RandData: s.rand,
  };
}
function nodeData(role, s, row) {
  const random = randomFor(role, s, row.Row * 101 + row.Clo);
  const group = GROUPS.find((g) => g.id === row.GroupID),
    selected = pick(group?.entries || [], (r) => r.weight, random),
    func = S.MessFuncConfig.find((f) => f.FuncID === selected?.func);
  if (!func) throw Error('Missing source maze function');
  const pool = S.MessMonsterLibraryConfig.filter((m) => m.LibraryID === func.NpcGroupID),
    npcs = [];
  // Native UpdateModel resolves NpcData.ID through GetMessMonsterLibraryConfig;
  // it is a library record key, not the nested MonsterID/EliteID/BossID.
  while (pool.length && npcs.length < func.SelectCnt) {
    const r = pick(pool, (m) => m.Weight, random);
    pool.splice(pool.indexOf(r), 1);
    npcs.push({ ID: r.ID });
  }
  const events = E.EventGroups.filter((e) => e.GroupID === func.Param[0]),
    event =
      func.FuncType === 5
        ? pick(events, (e) => e.Weight, random)
        : func.FuncType === 7
          ? E.MessEventBaseConfig.find((e) => e.EventID === func.Param[0])
          : null;
  return {
    Row: row.Row,
    Clo: row.Clo,
    FuncID: func.FuncID,
    EventID: event?.EventID || 0,
    NpcData: npcs,
  };
}
export function mazeGridData(role, level, type) {
  return {
    Result: { Ret: 0 },
    Level: level,
    Type: type,
    MessGridData: S.MessMapConfig.filter((r) => r.Level === level && r.Type === type).map((row) =>
      nodeData(role, { ...mazeState(role), level, type }, row),
    ),
  };
}
export const mazeNotifications = (role) => [
  { cmd: 24506, type: 'CSMessMapRoleDataRes', data: mazeRoleData(role) },
  { cmd: 24517, type: 'CSMessScoreAwardDataRes', data: mazeScoreData(role) },
  {
    cmd: 24501,
    type: 'CSMessMapGridDataRes',
    data: mazeGridData(role, mazeState(role).level, mazeState(role).type),
  },
];
export const mazeCommands = new Set([
  24500, 24502, 24505, 24507, 24509, 24511, 24513, 24515, 24518, 24520,
]);
export function mazeAction(q, role, p = {}) {
  const b = q.body,
    c = q.cmd,
    s = mazeState(role),
    out = (type, data = {}, ret = 0, r = role) => ({
      role: r,
      cmd: c + 1,
      type,
      data: { Result: { Ret: ret }, ...data },
    });
  if (c === 24505) {
    if (b.length !== 1) throw Error('Invalid maze role query');
    return out('CSMessMapRoleDataRes', mazeRoleData(role));
  }
  if (c === 24500) {
    if (b.length !== 8) throw Error('Invalid maze map query');
    const level = b.readInt32BE(),
      type = b.readInt32BE(4),
      data = mazeGridData(role, level, type);
    return out('CSMessMapGridDataRes', data, data.MessGridData.length ? 0 : 1);
  }
  const updated = () => ({ ...role, localMaze: s }),
    changed = (type, data = {}, extra = {}) => {
      const r = { ...updated(), ...extra };
      return { ...out(type, data, 0, r), notifications: mazeNotifications(r) };
    };
  if (c === 24507) {
    if (b.length !== 1) throw Error('Invalid maze shop query');
    return out('CSMessMapShopRes', shopData(role, p));
  }
  if (c === 24509) {
    if (b.length !== 4) throw Error('Invalid maze purchase');
    const item = shopData(role, p).ItemData.find((i) => i.ID === b.readInt32BE());
    if (!item || item.BuyCount || s.coin < item.MoneyCnt || !addItem(s, item.ItemType, item.ItemID))
      return out('CSMessMapShopBuyRes', {}, 1);
    s.coin -= item.MoneyCnt;
    s.shopBought.push(item.ID);
    return {
      ...changed('CSMessMapShopBuyRes'),
      notifications: [
        ...mazeNotifications(updated()),
        { cmd: 24508, type: 'CSMessMapShopRes', data: shopData(updated(), p) },
      ],
    };
  }
  if (c === 24511) {
    if (b.length !== 1) throw Error('Invalid maze shop refresh');
    s.shopRefreshes++;
    s.shopBought = [];
    return {
      ...changed('CSMessMapShopRefreshRes'),
      notifications: [
        ...mazeNotifications(updated()),
        { cmd: 24508, type: 'CSMessMapShopRes', data: shopData(updated(), p) },
      ],
    };
  }
  if (c === 24515) {
    if (b.length !== 1) throw Error('Invalid maze reset');
    const cancel = isMazeBattle(role);
    Object.assign(s, {
      level: 1,
      type: 1,
      row: 1,
      col: 1,
      previousRow: 0,
      previousCol: 0,
      pending: null,
      score: 0,
      wins: 0,
      claims: [],
      eventClaims: [],
      drugs: {},
      drugChoices: 0,
      capsules: [],
      effects: [],
      rand: emptyRand(),
      lastBattle: null,
      completed: false,
      resets: s.resets + 1,
      shopRefreshes: 0,
      shopBought: [],
    });
    delete s.reportError;
    return changed('CSMessMapResetRes', {}, cancel ? { pendingBattle: null } : {});
  }
  if (c === 24518) {
    if (b.length !== 4) throw Error('Invalid maze score claim');
    const level = b.readInt32BE(),
      cfg = E.MessScoreBootyConfig.find((r) => r.Level === level);
    if (!cfg || s.score < cfg.Score || s.claims.includes(level))
      return out('CSMessScoreAwardRes', { BootyList: {} }, 1);
    s.claims.push(level);
    const awards = MAZE_SCORE_REWARDS.filter((a) => a.BootyID === cfg.BootyID).map(
      ({ BootyID, ...a }) => a,
    );
    return { ...changed('CSMessScoreAwardRes', { BootyList: { AwardItem: awards } }), awards };
  }
  if (c === 24520) {
    if (b.length !== 8) throw Error('Invalid maze item selection');
    const id = b.readInt32BE(),
      type = b.readInt32BE(4);
    if (!s.rand.RandItem.some((r) => r.ItemID === id && r.Type === type) || !addItem(s, type, id))
      return out('CSMessMapRandItemChoseRes', {}, 1);
    s.drugChoices = Math.max(0, (s.drugChoices ?? 1) - 1);
    s.rand = emptyRand();
    if (s.drugChoices) offerDrugs(role, s, id + s.drugChoices);
    return changed('CSMessMapRandItemChoseRes');
  }
  if (c === 24513) {
    if (b.length !== 4) throw Error('Invalid maze event choice');
    const id = b.readInt32BE(),
      key = s.level + ':' + s.row + ':' + s.col,
      node = layout(s).find((n) => n.Row === s.row && n.Clo === s.col),
      func = node
        ? S.MessFuncConfig.find((f) => f.FuncID === nodeData(role, s, node).FuncID)
        : null,
      eventID = s.rand.IsEvent ? s.rand.EventID : func?.FuncType === 7 ? func.Param[0] : 0,
      event = E.MessEventBaseConfig.find((e) => e.EventID === eventID),
      choice = E.MessEventChoseConfig.find((e) => e.ChoseID === id);
    if ((s.eventClaims || []).includes(key) || !event?.Chose.includes(id) || !choice)
      return out('CSMessMapChoseRes', { MessMap: 0 }, 1);
    const random = randomFor(role, s, 90000 + id),
      amount = (f) => f.Param[0] * rangeCount(f.Param[1], f.Param[2], random),
      costs = choice.ChoseFunc.filter((f) => f.Type === 7).reduce((n, f) => n + amount(f), 0);
    if (s.coin < costs && !p.freeActions) return out('CSMessMapChoseRes', { MessMap: 0 }, 1);
    if (!p.freeActions) s.coin -= costs;
    s.rand = emptyRand();
    s.eventClaims = [...(s.eventClaims || []), key];
    for (const f of choice.ChoseFunc) {
      if (f.Type === 1 && !s.effects.includes(f.Param[0])) s.effects.push(f.Param[0]);
      if (f.Type === 3) s.coin = Math.min(1e9, s.coin + amount(f));
      // Source Type 5 is [delivery mode, min count, max count], not quality.
      if (f.Type === 5) {
        const count = rangeCount(f.Param[1], f.Param[2], random);
        if (f.Param[0] === 3) queueDrugChoices(role, s, count, id);
        else
          for (let i = 0; i < count; i++) {
            const pool = drugPool(s);
            if (!pool.length) break;
            addItem(s, 1, pick(pool, (v) => v.Weight, random).YaoJiID);
          }
      }
      if (f.Type === 8)
        for (let i = 0; i < f.Param[0]; i++) {
          const owned = Object.keys(s.drugs).filter((id) => s.drugs[id] > 0);
          if (!owned.length) break;
          const id = owned[random(owned.length)];
          if (--s.drugs[id] === 0) delete s.drugs[id];
        }
    }
    return changed('CSMessMapChoseRes', { MessMap: 0 });
  }
  if (c === 24502) {
    if (b.length !== 16) throw Error('Invalid maze move');
    const [level, type, row, col] = [0, 4, 8, 12].map((at) => b.readInt32BE(at)),
      current = S.MessMapConfig.find(
        (r) => r.Level === s.level && r.Type === s.type && r.Row === s.row && r.Clo === s.col,
      ),
      target = S.MessMapConfig.find(
        (r) => r.Level === level && r.Type === type && r.Row === row && r.Clo === col,
      );
    if (
      s.pending &&
      level === s.level &&
      type === s.type &&
      row === s.pending.Row &&
      col === s.pending.Clo
    ) {
      const func = S.MessFuncConfig.find((f) => f.FuncID === s.pending.FuncID);
      return {
        ...changed('CSMessMapGridMoveRes'),
        battleStartId: func.Param[0],
        resumeBattle: true,
      };
    }
    // A relogged native client can re-tap the unresolved event tile. Preserve the
    // approach position in role data so CanMoveCell accepts this replay.
    if (s.rand.IsEvent && level === s.level && type === s.type && row === s.row && col === s.col)
      return changed('CSMessMapGridMoveRes');
    const reachable =
      s.row === 0
        ? row === 1 && col === 1
        : current?.NextGrid.some((n) => n.Row === row && n.Clo === col);
    if (
      !target ||
      !reachable ||
      level !== s.level ||
      type !== s.type ||
      s.pending ||
      s.rand.IsEvent ||
      s.rand.RandItem.length
    )
      return out('CSMessMapGridMoveRes', {}, 1);
    const node = nodeData(role, s, target),
      func = S.MessFuncConfig.find((f) => f.FuncID === node.FuncID),
      battle = [2, 3, 4].includes(func.FuncType);
    s.previousRow = s.row;
    s.previousCol = s.col;
    if (battle) s.pending = node;
    else {
      s.row = row;
      s.col = col;
      if ([5, 7].includes(func.FuncType))
        s.rand = { IsEvent: 1, EventID: node.EventID, RandItem: [] };
      s.score += 10;
      advance(s);
    }
    return {
      ...changed('CSMessMapGridMoveRes'),
      ...(battle ? { battleStartId: func.Param[0] } : {}),
    };
  }
  return null;
}
export function mazeBattleData(role, maxHp, coreSkin) {
  const s = mazeState(role),
    node = s.pending;
  if (!node) return null;
  const data = mazeRoleData(role);
  return {
    YaoJi: data.YaoJi,
    JiaoNang: data.JiaoNang,
    Effect: data.Effect,
    Level: s.level,
    Type: s.type,
    Row: node.Row,
    Clo: node.Clo,
    FuncID: node.FuncID,
    NpcData: node.NpcData,
    WinCnt: s.wins || 0,
    FirstAtk: s.lastBattle ? 0 : 1,
    TechSkinData: coreSkin || { SkinType: 2 },
    LastMessData: s.lastBattle || { WallHpMax: maxHp, WallHp: maxHp },
  };
}
export function settleMaze(role, won, carry = null, hpRate = 100) {
  const s = mazeState(role);
  if (!s.pending) return role;
  if (won) {
    s.row = s.pending.Row;
    s.col = s.pending.Clo;
    const func = S.MessFuncConfig.find((f) => f.FuncID === s.pending.FuncID),
      score = func?.Param[2] || 100;
    s.coin += score;
    s.score += score;
    s.wins = (s.wins || 0) + 1;
    if (carry) {
      s.lastBattle = carry;
      s.effects = [];
    } else if (s.lastBattle)
      s.lastBattle.WallHp = Math.max(1, Math.round((s.lastBattle.WallHpMax * hpRate) / 100));
    s.highScore = Math.max(s.highScore, s.score);
    s.pending = null;
    advance(s);
    if (!s.completed) queueDrugChoices(role, s, 1, s.wins);
  } else s.pending = null;
  return { ...role, localMaze: s };
}
