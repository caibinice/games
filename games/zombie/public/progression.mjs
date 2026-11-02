import {
  ensureNative,
  parseNative,
  nativeSupply,
  nativeCombatStats,
  upgradeNativeCore,
  upgradeNativeGear,
  reforgeNativeGear,
  grantNativeGood,
  SKILL_IDS,
} from './native-progression.mjs';
import { SKILLS, GEAR_SLOTS, AFFIXES } from './content.mjs';
import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
import { parseCheats } from './cheats.mjs';
import {
  nativeGemInfo,
  nativeGemPlayable,
  PLAYABLE_GEMS,
  DROP_GEMS,
  nativeGemNext,
  nativeComposeCount,
  collectNativeGemAttrs,
} from './native-gems.mjs';
export const META_KEY = 'fish-zombie-meta-v1';
const MAX = 1_000_000_000;
const integer = (v, f = 0, max = MAX) =>
  Number.isFinite(v) ? Math.max(0, Math.min(max, Math.trunc(v))) : f;
const add = (obj, key, n) => (obj[key] = Math.min(MAX, (obj[key] || 0) + n));
export function gemId(slot, affix, rarity) {
  return 'gem:' + slot + ':' + affix + ':' + rarity;
}
export function itemInfo(id) {
  const native = nativeGemInfo(id);
  if (native) return native;
  const parts = String(id).split(':');
  if (
    parts[0] === 'gem' &&
    GEAR_SLOTS.some((s) => s.id === parts[1]) &&
    AFFIXES.some((a) => a.id === parts[2]) &&
    /^[0-6]$/.test(parts[3])
  )
    return { id, type: 'gem', slot: parts[1], affix: parts[2], rarity: Number(parts[3]) };
  if (parts[0] === 'gear' && GEAR_SLOTS.some((s) => s.id === parts[1]) && /^[0-6]$/.test(parts[2]))
    return { id, type: 'gear', slot: parts[1], rarity: Number(parts[2]) };
  return null;
}
export function createMeta(seed = Date.now()) {
  const gems = {};
  const starters = PLAYABLE_GEMS.filter((g) => g.type === 1 && g.quality === 1).slice(0, 6);
  for (let i = 0; i < starters.length; i++)
    add(gems, 'gem-native:' + starters[i].id, i % 4 === 0 ? 5 : 1);
  return {
    version: 1,
    seed: seed >>> 0,
    entered: false,
    diamonds: 10000,
    gold: 100000,
    energy: 100,
    level: 1,
    name: '指挥官',
    skills: Object.fromEntries(SKILLS.map((s, i) => [s.id, { level: 1, cards: 0 }])),
    gear: Object.fromEntries(
      GEAR_SLOTS.map((s, i) => [
        s.id,
        { level: 1, tier: 1, rarity: 0, prefix: 1, gems: Array(5).fill(null) },
      ]),
    ),
    inventory: gems,
    locked: {},
    gearBag: {},
    draws: { cards: 0, normal: 0, premium: 0 },
    pity: { cards: 0, normal: 0, premium: 0 },
    legendPity: { cards: 0, normal: 0, premium: 0 },
    presets: Array.from({ length: 5 }, () => ({ disabled: [], support: 'grenade' })),
    preset: 0,
    skin: 'initial',
    mercenary: 'initial',
    form: 'initial',
    speed: 1.5,
    materials: { forge: 500, chip: 12 },
    stageClaims: {},
    bestHealth: {},
    eliteWins: {},
    history: [],
    dailyClaims: 0,
    cheats: parseCheats(),
    activityWins: {},
    roleXp: 0,
    eventProgress: {},
    settledBattles: [],
    maze: { cleared: [], position: 0 },
  };
}
export function parseMeta(raw) {
  let o;
  try {
    o = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return createMeta();
  }
  const p = createMeta();
  if (!o || o.version !== 1) return p;
  for (const k of ['diamonds', 'gold', 'energy', 'level', 'dailyClaims'])
    p[k] = integer(o[k], p[k]);
  p.level = Math.max(1, Math.min(999, p.level));
  p.seed = integer(o.seed, p.seed, 4294967295);
  if (typeof o.entered === 'boolean') p.entered = o.entered;
  if (typeof o.name === 'string') p.name = o.name.slice(0, 16);
  for (const s of SKILLS) {
    const a = o.skills?.[s.id];
    if (a)
      p.skills[s.id] = { level: Math.max(1, integer(a.level, 1, 46)), cards: integer(a.cards) };
  }
  p.inventory = {};
  p.gearBag = {};
  p.locked = {};
  for (const [k, v] of Object.entries(o.inventory || {}).slice(0, 3000)) {
    const i = itemInfo(k);
    if (i?.type === 'gem' && integer(v) > 0) p.inventory[k] = integer(v);
  }
  for (const [k, v] of Object.entries(o.gearBag || {}).slice(0, 100)) {
    const i = itemInfo(k);
    if (i?.type === 'gear' && integer(v) > 0) p.gearBag[k] = integer(v);
  }
  for (const [k, v] of Object.entries(o.locked || {}))
    if (itemInfo(k) && v === true) p.locked[k] = true;
  for (const s of GEAR_SLOTS) {
    const a = o.gear?.[s.id];
    if (a)
      p.gear[s.id] = {
        level: Math.max(1, integer(a.level, 1, 150)),
        tier: Math.max(1, integer(a.tier, 1, 30)),
        rarity: integer(a.rarity, 0, 6),
        prefix: Math.max(1, integer(a.prefix, 1, 8)),
        gems: Array.from({ length: 5 }, (_, i) => {
          const id = a.gems?.[i],
            item = itemInfo(id);
          return item?.type === 'gem' && item.slot === s.id ? id : null;
        }),
      };
  }
  for (const pool of ['cards', 'normal', 'premium'])
    for (const k of ['draws', 'pity', 'legendPity']) p[k][pool] = integer(o[k]?.[pool]);
  p.presets = Array.from({ length: 5 }, (_, i) => {
    const a = o.presets?.[i] || {};
    return {
      disabled: [
        ...new Set(
          (Array.isArray(a.disabled) ? a.disabled : []).filter((id) =>
            SKILLS.some((s) => s.id === id),
          ),
        ),
      ].slice(0, 6),
      support: SKILLS.some((s) => s.id === a.support) ? a.support : 'grenade',
    };
  });
  p.preset = integer(o.preset, 0, 4);
  if (['winter', 'commando', 'wasteland'].includes(o.skin)) p.skin = o.skin;
  if (['ranger', 'medic', 'engineer'].includes(o.mercenary)) p.mercenary = o.mercenary;
  if (['rainbow', 'flame', 'frost'].includes(o.form)) p.form = o.form;
  if ([1, 1.5, 2].includes(o.speed)) p.speed = o.speed;
  for (const k of ['forge', 'chip']) p.materials[k] = integer(o.materials?.[k], p.materials[k]);
  for (const k of ['stageClaims', 'bestHealth', 'eliteWins']) {
    p[k] = {};
    for (const [id, v] of Object.entries(o[k] || {}))
      if (/^[1-9]\d*$/.test(id) && Number(id) <= CAMPAIGN_LEVEL_COUNT)
        p[k][id] = integer(v, 0, k === 'bestHealth' ? 100 : 7);
  }
  p.cheats = parseCheats(o.cheats);
  p.activityWins = {};
  for (const [id, v] of Object.entries(o.activityWins || {}).slice(0, 10000))
    if (/^[1-9]\d*$/.test(id) && Number(id) <= 1000000) p.activityWins[id] = integer(v);
  p.roleXp = integer(o.roleXp);
  p.eventProgress = {};
  for (const [id, a] of Object.entries(o.eventProgress || {}).slice(0, 6000))
    if (/^\d+$/.test(id) && a && typeof a === 'object')
      p.eventProgress[id] = {
        runs: integer(a.runs),
        wins: integer(a.wins),
        bestKills: integer(a.bestKills),
        points: integer(a.points),
        claimed: integer(a.claimed),
      };
  p.settledBattles = (Array.isArray(o.settledBattles) ? o.settledBattles : [])
    .filter((x) => typeof x === 'string')
    .slice(-100);
  p.maze = {
    position: integer(o.maze?.position, 0, 14),
    cleared: [
      ...new Set(
        (Array.isArray(o.maze?.cleared) ? o.maze.cleared : []).filter(
          (n) => Number.isInteger(n) && n >= 0 && n < 15,
        ),
      ),
    ],
  };
  parseNative(p, o.native);
  p.history = (Array.isArray(o.history) ? o.history : [])
    .filter((s) => typeof s === 'string')
    .slice(-12)
    .map((s) => s.slice(0, 100));
  return p;
}
export function random(p) {
  p.seed = (Math.imul(p.seed, 1664525) + 1013904223) >>> 0;
  return p.seed / 4294967296;
}
export function draw(p, pool, count = 1) {
  if (!['cards', 'normal', 'premium'].includes(pool)) return [];
  const n = Math.max(1, Math.min(100, integer(count, 1, 100))),
    rewards = [];
  for (let i = 0; i < n; i++) {
    p.draws[pool]++;
    p.pity[pool]++;
    p.legendPity[pool]++;
    const r = random(p);
    let rarity = r < 0.48 ? 1 : r < 0.78 ? 2 : r < 0.94 ? 3 : r < 0.985 ? 4 : r < 0.998 ? 5 : 6;
    if (pool === 'premium') rarity = Math.max(3, rarity);
    if (p.pity[pool] >= 10) rarity = Math.max(3, rarity);
    if (p.legendPity[pool] >= 200) rarity = Math.max(5, rarity);
    if (rarity >= 3) p.pity[pool] = 0;
    if (rarity >= 5) p.legendPity[pool] = 0;
    if (pool === 'cards') {
      const skill = SKILLS[Math.floor(random(p) * SKILLS.length)],
        quantity = rarity >= 5 ? 30 : rarity >= 3 ? 10 : 5;
      add(p.skills[skill.id], 'cards', quantity);
      grantNativeGood(p, 61000 + Math.round(SKILL_IDS[skill.id] / 1000), quantity);
      rewards.push({ type: 'card', id: skill.id, rarity, quantity });
    } else if (pool === 'premium' && random(p) < 0.3) {
      const slot = GEAR_SLOTS[Math.floor(random(p) * 6)].id,
        id = 'gear:' + slot + ':' + rarity;
      add(p.gearBag, id, 1);
      rewards.push({ type: 'gear', id, slot, rarity, quantity: 1 });
    } else {
      const poolGems = DROP_GEMS.filter((g) => g.quality === rarity + 1),
        g = poolGems[Math.floor(random(p) * poolGems.length)],
        id = 'gem-native:' + g.id,
        i = nativeGemInfo(id);
      add(p.inventory, id, 1);
      rewards.push({ ...i, quantity: 1 });
    }
  }
  p.history.push(
    '免费开启' +
      { cards: '战术卡包', normal: '普通宝箱', premium: '高级宝箱' }[pool] +
      '，获得 ' +
      rewards.length +
      ' 份奖励',
  );
  p.history = p.history.slice(-12);
  return rewards;
}
export function upgradeSkill(p, id) {
  return upgradeNativeCore(p, id);
}
export function enhanceGear(p, slot) {
  return upgradeNativeGear(p, slot);
}
export function forgeGear(p, slot) {
  return reforgeNativeGear(p, slot).ok;
}
export function equipGear(p, id) {
  const item = itemInfo(id);
  if (item?.type !== 'gear' || !p.gearBag[id]) return false;
  const old = p.gear[item.slot],
    oldId = 'gear:' + item.slot + ':' + old.rarity;
  add(p.gearBag, oldId, 1);
  p.gearBag[id]--;
  old.rarity = item.rarity;
  return true;
}
export function equipGem(p, id, slot, index) {
  const item = itemInfo(id),
    gear = p.gear[slot];
  if (
    item?.type !== 'gem' ||
    (item.native && !nativeGemPlayable(item.native)) ||
    item.slot !== slot ||
    !gear ||
    index < 0 ||
    index > 4 ||
    !Number.isInteger(index) ||
    !(p.inventory[id] > 0)
  )
    return false;
  const old = gear.gems[index];
  if (old) add(p.inventory, old, 1);
  p.inventory[id]--;
  gear.gems[index] = id;
  return true;
}
export function unequipGem(p, slot, index) {
  const g = p.gear[slot],
    id = g?.gems?.[index];
  if (!id) return false;
  add(p.inventory, id, 1);
  g.gems[index] = null;
  return true;
}
export function synthesize(p) {
  let total = 0,
    changed = true;
  while (changed) {
    changed = false;
    for (const [id, qty] of Object.entries(p.inventory)) {
      const item = itemInfo(id);
      if (!item || item.rarity >= 6 || p.locked[id] || qty < 3) continue;
      const need = item.native ? nativeComposeCount(item) : 3,
        next = item.native ? nativeGemNext(item) : gemId(item.slot, item.affix, item.rarity + 1);
      if (!next || !need) continue;
      const n = Math.floor(qty / need);
      if (!n) continue;
      p.inventory[id] -= n * need;
      add(p.inventory, next, n);
      total += n;
      changed = true;
    }
  }
  return total;
}
export function setDisabled(p, id) {
  const list = p.presets[p.preset].disabled;
  if (!SKILLS.some((s) => s.id === id)) return false;
  const i = list.indexOf(id);
  if (i >= 0) {
    list.splice(i, 1);
    return true;
  }
  if (list.length >= 6) return false;
  list.push(id);
  if (p.presets[p.preset].support === id)
    p.presets[p.preset].support = SKILLS.find((s) => !list.includes(s.id)).id;
  return true;
}
export function grantSupply(p, type = 'all') {
  if (type === 'all' || type === 'diamonds') p.diamonds = Math.min(MAX, p.diamonds + 5000);
  if (type === 'all' || type === 'gold') p.gold = Math.min(MAX, p.gold + 500000);
  if (type === 'all' || type === 'energy') p.energy = Math.min(MAX, p.energy + 1000);
  if (type === 'all' || type === 'materials') {
    p.materials.forge = Math.min(MAX, p.materials.forge + 100);
    p.materials.chip = Math.min(MAX, p.materials.chip + 10);
    nativeSupply(p);
  }
  p.dailyClaims++;
}
export function combatStats(p) {
  const base = nativeCombatStats(p),
    native = collectNativeGemAttrs(p),
    raw = base.nativeRaw;
  const result = {
    ...base,
    attack: base.nativeAttack / 100,
    hp: base.nativeMaxHp / 1000,
    critical: (raw[105] || 0) + (native.attrs[105] || 0),
    rapid: -(raw[147] || 0),
    cooldown: Math.min(0.9, -(raw[110] || 0) - (native.attrs[110] || 0)),
    element: 0,
    critChance: (raw[104] || 0) + (native.attrs[104] || 0),
    nativeGemAttrs: native.attrs,
    nativeGemCount: native.count,
    nativeGemFight: native.fight,
    nativeGemBuffs: native.buffs,
    nativeGemBuilds: [...base.nativeGrowthBuilds, ...native.builds],
    nativeSkillAttrs: base.nativeSkillAttrs,
    nativeGunAttrs: native.skillAttrs[100] || {},
    initialChoices: Math.min(30, Math.max(0, Math.round(native.attrs[109] || 0))),
  };
  for (const [skill, attrs] of Object.entries(native.skillAttrs)) {
    result.nativeSkillAttrs[skill] ??= {};
    for (const [id, value] of Object.entries(attrs))
      result.nativeSkillAttrs[skill][id] = (result.nativeSkillAttrs[skill][id] || 0) + value;
  }
  for (const gear of Object.values(p.gear))
    for (const id of gear.gems) {
      const i = itemInfo(id),
        affix = i && !i.native && AFFIXES.find((a) => a.id === i.affix);
      if (affix) {
        const value = ((i.rarity + 1) * affix.value) / 100;
        if (i.affix === 'attack') result.nativeAttack += 100 * value;
        else if (i.affix === 'hp') result.nativeMaxHp += 1000 * value;
        else result[i.affix] = (result[i.affix] || 0) + value;
      }
    }
  result.nativeAttack += native.attrs[103] || 0;
  result.nativeMaxHp += native.attrs[101] || 0;
  result.hp = result.nativeMaxHp / 1000;
  const ga = result.nativeSkillAttrs[100] || {},
    gp = result.gunProfile;
  gp.capacity = Math.max(1, Math.round((gp.capacity + (ga[138] || 0)) * (1 + (ga[140] || 0))));
  gp.interval = Math.max(0.03, gp.interval * (1 + (ga[147] || 0)));
  gp.reload = Math.max(0.15, gp.reload * (1 + (ga[143] || 0)));
  gp.damageRatio += ga[149] || 0;
  gp.critChance += ga[150] || 0;
  gp.critDamage += ga[151] || 0;
  result.attack = result.nativeAttack / 100;
  result.power = Math.round(result.nativeAttack * 2 + result.nativeMaxHp * 0.1 + native.fight);
  return result;
}
export function recordBattle(p, g) {
  if (g.status !== 'won' || g.metaSettled || (g.battleId && p.settledBattles.includes(g.battleId)))
    return false;
  g.metaSettled = true;
  if (g.battleId) {
    p.settledBattles.push(g.battleId);
    p.settledBattles = p.settledBattles.slice(-100);
  }
  const level = g.info.level;
  if (g.activity) p.activityWins[g.info.clientId] = (p.activityWins[g.info.clientId] || 0) + 1;
  else {
    p.bestHealth[level] = Math.max(p.bestHealth[level] || 0, Math.floor((g.hp / g.maxHp) * 100));
    if (g.elite) p.eliteWins[level] = 1;
  }
  p.gold = Math.min(MAX, p.gold + g.info.reward * 100);
  p.diamonds = Math.min(MAX, p.diamonds + 30);
  p.roleXp += 100 + g.kills;
  while (p.roleXp >= p.level * 100 && p.level < 999) {
    p.roleXp -= p.level * 100;
    p.level++;
  }
  if (g.activity) {
    const id = g.info.clientId,
      a = p.eventProgress[id] || { runs: 0, wins: 0, bestKills: 0, points: 0, claimed: 0 };
    a.runs++;
    a.wins++;
    a.bestKills = Math.max(a.bestKills, g.kills);
    a.points += 100;
    p.eventProgress[id] = a;
    p.gold = Math.min(MAX, p.gold + (g.event?.coins || 0));
    if (g.event?.mode === 'maze' && !p.maze.cleared.includes(p.maze.position))
      p.maze.cleared.push(p.maze.position);
  }
  return true;
}
export function claimStage(p, level, index) {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > CAMPAIGN_LEVEL_COUNT ||
    index < 0 ||
    index > 2 ||
    !Number.isInteger(index)
  )
    return false;
  const hp = p.bestHealth[level] || 0,
    mask = 1 << index;
  if (hp < [1, 50, 100][index] || (p.stageClaims[level] || 0) & mask) return false;
  p.stageClaims[level] = (p.stageClaims[level] || 0) | mask;
  p.diamonds += 50 * (index + 1);
  const id = gemId(GEAR_SLOTS[level % 6].id, AFFIXES[index].id, 2 + index);
  add(p.inventory, id, 1);
  return {
    type: 'gem',
    id,
    slot: GEAR_SLOTS[level % 6].id,
    affix: AFFIXES[index].id,
    rarity: 2 + index,
    quantity: 1,
  };
}
