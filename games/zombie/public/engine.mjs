import { combatEffect, damageFeedback } from './combat-feedback.mjs';
import {
  nativeProcCritical,
  nativeProcBulletHit,
  nativeProcEnd,
  nativeElectrodeCross,
} from './native-proc-runtime.mjs';
import {
  nativeExtraHit,
  nativeHitBuffs,
  nativeGemTick,
  nativeWallHit,
  nativeRandomDamageRatio,
  nativeCastBuffs,
} from './native-buff-runtime.mjs';
import {
  fireNativeGun,
  nativeGunHit,
  supportTick,
  nativePassiveHit,
} from './native-support-combat.mjs';
import { tickGun } from './native-gun-combat.mjs';
// Deterministic, DOM-free combat simulation. This game owns no other game's state.
import { SKILLS } from './content.mjs';
import {
  clientStage,
  clientPlan,
  clientXp,
  clientMonster,
  clientEnemyType,
} from './client-campaign.mjs';
import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
import {
  BRANCH_FAMILIES,
  initClientBuilds,
  nativeBuildOptions,
  applyNativeBuild,
} from './client-builds.mjs';
import { nativeShoot, nativeTick, nativeBulletHit } from './client-skill-combat.mjs';
import {
  gemAttr,
  gemDamageMultiplier,
  gemOnKill,
  gemOnUpgrade,
  gemTeleport,
  gemDebuffTime,
  gemCritical,
} from './gem-combat.mjs';
import { extendedShoot, extendedTick, extendedBulletHit } from './native-extended-combat.mjs';
import { initEvent, eventTick } from './activity-state.mjs';
export const WIDTH = 540,
  HEIGHT = 800,
  WALL_Y = 650,
  LEVEL_COUNT = CAMPAIGN_LEVEL_COUNT;
export const CHAPTERS = [
  {
    name: '失守街区',
    sub: 'THE SILENT DISTRICT',
    color: '#b4cf8c',
    road: '#313c3d',
    edge: '#222f30',
    boss: '畸变清道夫',
  },
  {
    name: '锈铁工厂',
    sub: 'RUST & RUIN',
    color: '#efac6c',
    road: '#3c3935',
    edge: '#302e2b',
    boss: '钢铁屠夫',
  },
  {
    name: '冰封港口',
    sub: 'FROZEN HARBOR',
    color: '#95dae3',
    road: '#34434d',
    edge: '#243440',
    boss: '极寒巨兽',
  },
  {
    name: '赤色禁区',
    sub: 'THE RED ZONE',
    color: '#ee8e8b',
    road: '#403438',
    edge: '#2e272e',
    boss: '疫变母体',
  },
  {
    name: '黎明要塞',
    sub: 'UNTIL THE DAWN',
    color: '#c9b8f0',
    road: '#37364a',
    edge: '#272738',
    boss: '终焉主宰',
  },
];
export const WEAPONS = [
  {
    id: 'gun',
    name: '先锋步枪',
    short: '步枪',
    icon: 'gun',
    color: '#f4c774',
    desc: '自动锁定最前方敌人；满级解锁双发穿透。',
  },
  {
    id: 'grenade',
    name: '温压弹',
    short: '温压',
    icon: 'bomb',
    color: '#ff9a5c',
    desc: '范围爆炸；升级扩大爆炸范围与灼烧伤害。',
  },
  {
    id: 'frost',
    name: '冰爆发生器',
    short: '冰爆',
    icon: 'snow',
    color: '#92e8fb',
    desc: '大范围减速，满级冻结尸潮。',
  },
  {
    id: 'lightning',
    name: '电磁穿刺',
    short: '雷电',
    icon: 'bolt',
    color: '#c7b2ff',
    desc: '闪电在多个敌人之间弹射，优先打击前排。',
  },
  {
    id: 'laser',
    name: '高能射线',
    short: '激光',
    icon: 'laser',
    color: '#ff839d',
    desc: '持续穿透一整条直线，满级扩大射线宽度。',
  },
  {
    id: 'drone',
    name: '旋翼无人机',
    short: '无人机',
    icon: 'drone',
    color: '#b4db94',
    desc: '两翼自动火力支援；升级增加射速与弹丸。',
  },
];
export const ORIGINAL_WEAPONS = [
  { ...WEAPONS[0] },
  ...SKILLS.map((s) => ({
    ...s,
    short: s.name,
    icon: WEAPONS.find((w) => w.id === s.id)?.icon || 'bolt',
  })),
];
export const ENEMIES = {
  walker: { name: '游荡者', hp: 59, speed: 36, r: 17, damage: 6, color: '#a4b583', xp: 1 },
  runner: { name: '疾行者', hp: 40, speed: 64, r: 14, damage: 5, color: '#c7b185', xp: 1 },
  brute: { name: '巨块', hp: 233, speed: 25, r: 27, damage: 15, color: '#9ca37c', xp: 3 },
  spitter: { name: '腐蚀者', hp: 99, speed: 33, r: 18, damage: 7, color: '#a4c96f', xp: 2 },
  armor: { name: '铁甲感染者', hp: 168, speed: 29, r: 20, damage: 10, color: '#9daeb2', xp: 2 },
  bomber: { name: '爆裂体', hp: 78, speed: 43, r: 19, damage: 22, color: '#db9b70', xp: 2 },
  boss: { name: '变异首领', hp: 1705, speed: 23, r: 44, damage: 22, color: '#b8b48b', xp: 14 },
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function stageInfo(level) {
  const n = clamp(Math.trunc(level) || 1, 1, LEVEL_COUNT),
    chapter = Math.floor((n - 1) / 10) % CHAPTERS.length;
  return {
    level: n,
    chapter,
    theme: CHAPTERS[chapter],
    waves: 3 + Math.floor((n - 1) / 15),
    count: 32 + n * 2,
    boss: n % 5 === 0,
    name:
      n % 10 === 0
        ? CHAPTERS[chapter].boss
        : n % 5 === 0
          ? '精英围城'
          : ['街角警戒', '清扫行动', '防线告急', '暗夜突围'][(n - 1) % 4],
    reward: 45 + n * 6,
    hpScale: 1 + (n - 1) * 0.055,
    speedScale: 1 + Math.min(0.25, (n - 1) * 0.005),
  };
}
export function random(g) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export function createGame({
  level = 1,
  seed = Date.now(),
  attack = 0,
  fortify = 0,
  loadout = 'grenade',
  extended = false,
  disabled = [],
  coreLevels = {},
  stats = {},
  elite = false,
  client = false,
  clientStageData = null,
  cheats = {},
} = {}) {
  const info = stageInfo(level);
  if (extended) {
    info.waves = 20;
    info.count = 120 + info.level * 6;
  }
  if (elite) {
    info.count = Math.ceil(info.count * 1.3);
    info.hpScale *= 1.5;
    info.reward = Math.ceil(info.reward * 1.5);
    info.boss = true;
  }
  const availableWeapons = (extended ? ORIGINAL_WEAPONS : WEAPONS).filter(
    (w) =>
      (w.id !== 'electric' || client || loadout === 'electric') &&
      (w.id === 'gun' || !disabled.includes(w.id)),
  );
  if (!availableWeapons.some((w) => w.id === loadout))
    loadout = availableWeapons.find((w) => w.id !== 'gun')?.id || 'gun';
  if (
    stats.nativeFormStart?.skill &&
    availableWeapons.some((w) => w.id === stats.nativeFormStart.skill)
  )
    loadout = stats.nativeFormStart.skill;
  const maxHp = stats.nativeMaxHp
    ? Math.round(stats.nativeMaxHp)
    : Math.round((300 + fortify * 35) * (stats.hp || 1));
  const game = {
    version: 1,
    info,
    seed: seed >>> 0,
    status: 'ready',
    time: 0,
    wave: 0,
    waveSpawned: 0,
    spawned: 0,
    kills: 0,
    extended,
    elite,
    availableWeapons,
    coreLevels,
    stats,
    quotas: extended
      ? Array.from(
          { length: info.waves },
          (_, i) => Math.floor(info.count / info.waves) + (i < info.count % info.waves ? 1 : 0),
        )
      : null,
    specials: [],
    damageBySkill: {},
    waveCount: Math.ceil(info.count / info.waves),
    spawnClock: 1,
    waveWait: 0,
    nextId: 1,
    hp: maxHp,
    maxHp,
    damage: (1 + attack * 0.09 + (info.level - 1) * 0.018) * (stats.attack || 1),
    score: 0,
    rank: 1,
    xp: 0,
    nextXp: 9,
    energy: extended ? 100 : 55,
    airstrikes: 0,
    weapons: Object.fromEntries(
      (extended ? ORIGINAL_WEAPONS : WEAPONS).map((w) => [
        w.id,
        w.id === 'gun' || w.id === loadout ? 1 : 0,
      ]),
    ),
    perks: { rapid: 0, power: 0, critical: 0, pierce: 0 },
    cooldowns: Object.fromEntries(
      (extended ? ORIGINAL_WEAPONS : WEAPONS).map((w, i) => [w.id, i * 0.3]),
    ),
    enemies: [],
    bullets: [],
    effects: [],
    events: [],
    choices: [],
    aim: null,
    combo: 0,
    comboTime: 0,
    settled: false,
    cheats: { invincible: cheats.invincible === true, firepower: cheats.firepower === true },
  };
  if (client && extended) {
    game.client = clientStageData || clientStage(info.level);
    if (!Array.isArray(game.client.waves)) throw Error('请先载入客户端关卡数据');
    game.activity = game.client.activity === true;
    game.plan = clientPlan(game.client, () => random(game));
    info.clientId = game.client.LevelID;
    info.name = game.client.name;
    info.waves = Math.max(1, ...game.client.waves.map((w) => w.Wave));
    info.boss = game.plan.some((p) => clientMonster(p.config.MonsterID).Type === 2);
    info.count = game.plan.reduce((n, p) => n + p.total, 0);
    game.quotas = Array.from({ length: info.waves }, (_, i) =>
      game.plan.filter((p) => p.config.Wave === i + 1).reduce((n, p) => n + p.total, 0),
    );
    game.nextXp = clientXp(1);
    if (!stats.nativeAttack) game.damage *= 4;
  }
  if (stats.nativeAttack) game.damage = stats.nativeAttack;
  if (game.client) {
    initClientBuilds(game);
    game.magazine = {
      capacity:
        stats.gunProfile?.capacity ||
        Math.max(1, 30 + Math.round(stats.nativeGunAttrs?.[116] || 0)),
      ammo: 30,
      reload: 0,
      reloadTime: stats.gunProfile?.reload || Math.max(0.2, 1 * (1 - (stats.rapid || 0))),
      shots: 0,
    };
    game.magazine.ammo = game.magazine.capacity;
    initEvent(game);
  }
  if (game.cheats.firepower) game.damage *= 1000;
  return game;
}
export function start(g) {
  if (g.status === 'ready') {
    g.status = 'running';
    g.events.push({ type: 'wave', wave: 1 });
    if (g.stats.initialChoices > 0) {
      g.initialSelections = Math.min(30, g.stats.initialChoices);
      g.choices = upgradeOptions(g);
      g.status = 'upgrade';
    }
  }
  return g;
}
export function togglePause(g) {
  if (g.status === 'running') g.status = 'paused';
  else if (g.status === 'paused') g.status = 'running';
  return g.status;
}
export function setAim(g, x, y) {
  g.aim = x === null ? null : { x: clamp(x, 28, 512), y: clamp(y, 30, WALL_Y) };
}
function effect(g, type, x, y, more = {}) {
  return combatEffect(g, type, x, y, more);
}
function damage(g, e, amount, kind = 'gun', context = {}) {
  if (e.dead) return;
  const sourceRule = context.damageRule;
  if (
    e.flying &&
    !(e.groundedUntil > g.time) &&
    (sourceRule?.DamageType === 4 || (!sourceRule && kind === 'vehicle'))
  )
    return;
  const critical =
    context.allowCrit !== false &&
    (gemCritical(g, e) ||
      ((kind === 'gun' || (g.client && (gemAttr(g, 104) > 0 || nativeProcCritical(g, kind) > 0))) &&
        random(g) <
          (g.stats.nativeAttack ? 0 : 0.06) +
            g.perks.critical * 0.09 +
            (g.stats.critChance || 0) +
            nativeProcCritical(g, kind) +
            (kind === 'gun' ? g.stats.gunProfile?.critChance || 0 : 0)));
  const ignoreChance = gemAttr(g, 415),
    scale =
      e.type === 'armor' && kind === 'gun' && !(ignoreChance > 0 && random(g) < ignoreChance)
        ? 0.65
        : 1;
  let n = context.absolute
    ? amount
    : amount *
      scale *
      (e.vulnerableUntil > g.time ? e.vulnerableRatio : 1) *
      (critical
        ? 2 + (g.stats.critical || 0) + (kind === 'gun' ? g.stats.gunProfile?.critDamage || 0 : 0)
        : 1) *
      (1 + g.perks.power * 0.16) *
      (g.stats.nativeAttack ? 1 : 1 + Math.max(0, (g.coreLevels[kind] || 1) - 1) * 0.006) *
      (kind === 'gun' ? 1 : 1 + (g.stats.element || 0)) *
      gemDamageMultiplier(g, e, kind, context) *
      nativeRandomDamageRatio(g, nativeApi);
  if (!context.noProcs) {
    const bonus = nativeExtraHit(g, e, kind, critical, nativeApi);
    n += bonus.extra;
  }
  n = Math.max(0, n);
  g.damageBySkill[kind] = (g.damageBySkill[kind] || 0) + Math.min(e.hp, n);
  e.hp -= n;
  e.flash = 0.085;
  gemTeleport(g, e, random);
  damageFeedback(g, e, n, kind, critical);
  if (e.hp <= 0) {
    gemOnKill(g, e, kind);
    e.dead = true;
    g.kills++;
    g.combo++;
    g.comboTime = 2;
    g.score += Math.round(e.maxHp * 2);
    g.xp += e.xp ?? ENEMIES[e.type].xp;
    g.energy = clamp(g.energy + 1.8, 0, 100);
    effect(g, 'death', e.x, e.y, {
      color: e.color,
      r: e.r,
      frameModel: e.frameModel,
      phase: e.phase,
      duration: 0.4,
    });
    g.events.push({ type: 'kill', kind: e.type });
  }
  if (!context.noProcs) {
    nativeHitBuffs(g, e, kind, nativeApi, context);
    if (g.stats.nativeAttack) nativePassiveHit(g, e, kind, nativeApi);
  }
}
function blast(g, x, y, r, amount, kind) {
  effect(g, kind, x, y, { r, duration: ['frost', 'iceblast'].includes(kind) ? 0.8 : 0.48 });
  for (const e of g.enemies)
    if (!e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) {
      damage(g, e, amount, kind);
      if (kind === 'frost' || kind === 'iceblast') {
        e.slow = Math.max(e.slow, gemDebuffTime(g, 3 + (g.weapons.frost || 1) * 0.5));
        if (g.weapons.frost === 5 || kind === 'iceblast')
          e.freeze = gemDebuffTime(g, kind === 'iceblast' ? 2 : 1.3);
      }
      if (['grenade', 'fuel', 'airdrop'].includes(kind))
        e.burn = gemDebuffTime(g, kind === 'fuel' ? 6 : 2);
    }
}
function target(g) {
  const alive = g.enemies.filter((e) => !e.dead && e.y > -8);
  if (!alive.length) return null;
  return alive.reduce((a, b) => {
    const priority = (e) => (g.aim ? Math.hypot(e.x - g.aim.x, e.y - g.aim.y) - e.y * 0.12 : -e.y);
    return priority(a) <= priority(b) ? a : b;
  });
}
function fire(
  g,
  x,
  y,
  t,
  dmg,
  { speed = 680, pierce = 0, color = '#ffdb87', size = 3, kind = 'gun', nativeScaled = false } = {},
) {
  if (!nativeScaled && (!g.client || !BRANCH_FAMILIES.includes(kind))) {
    speed *= 1 + gemAttr(g, 119);
    pierce += Math.round(gemAttr(g, 117));
  }
  const d = Math.hypot(t.x - x, t.y - y) || 1;
  const bullet = {
    id: g.nextId++,
    x,
    y,
    px: x,
    py: y,
    vx: ((t.x - x) / d) * speed,
    vy: ((t.y - y) / d) * speed,
    damage: dmg,
    life: 1.8,
    pierce,
    color,
    size,
    kind,
    bornAt: g.time,
    hit: [],
  };
  g.bullets.push(bullet);
  effect(g, 'muzzle', x, y, { duration: 0.09, color, kind, angle: Math.atan2(t.y - y, t.x - x) });
  return bullet;
}
const nativeApi = { damage, fire, effect, random };
function shoot(g, dt) {
  for (const w of g.availableWeapons) g.cooldowns[w.id] -= dt;
  if (g.magazine && g.nativeUnlimitedUntil > g.time) {
    g.magazine.ammo = g.magazine.capacity;
    g.magazine.reload = 0;
  }
  if (g.magazine?.reload > 0) {
    g.magazine.reload = Math.max(0, g.magazine.reload - dt);
    if (!g.magazine.reload) g.magazine.ammo = g.magazine.capacity;
  }
  const t = target(g);
  if (!t) return;
  const power = g.damage;
  if (g.client) {
    const previous = { ...g.cooldowns };
    nativeShoot(g, t, nativeApi);
    extendedShoot(g, t, nativeApi);
    for (const id of Object.keys(g.cooldowns))
      if (previous[id] <= 0 && g.cooldowns[id] > 0) nativeCastBuffs(g, id, nativeApi);
  }
  if (
    g.weapons.gun > 0 &&
    g.cooldowns.gun <= 0 &&
    (!g.magazine || (g.magazine.ammo > 0 && !g.magazine.reload))
  ) {
    const lv = g.weapons.gun;
    if (g.stats.gunProfile) {
      g.cooldowns.gun =
        (g.stats.gunProfile.interval * (g.nativeUnlimitedUntil > g.time ? 0.5 : 1)) /
        (1 + g.perks.rapid * 0.15);
      fireNativeGun(g, t, nativeApi);
    } else {
      g.cooldowns.gun =
        (0.31 / (1 + lv * 0.12 + g.perks.rapid * 0.15 + (g.stats.rapid || 0))) *
        (g.client ? 1 - (g.stats.cooldown || 0) : 1);
      fire(g, 270, 705, t, (20 + lv * 6) * power, { pierce: g.perks.pierce + (lv === 5 ? 2 : 0) });
      if (lv >= 4) fire(g, 285, 704, { x: t.x + 18, y: t.y }, (16 + lv * 4) * power);
    }
    if (!g.stats.gunProfile) g.events.push({ type: 'shot' });
    if (g.magazine) {
      g.magazine.shots++;
      nativeCastBuffs(g, 'gun', nativeApi);
      if (!(g.nativeUnlimitedUntil > g.time) && --g.magazine.ammo <= 0) {
        g.magazine.reload = g.magazine.reloadTime;
        g.events.push({ type: 'reload' });
      }
    }
  }
  for (const id of ['grenade', 'frost', 'lightning', 'laser', 'drone']) {
    if (g.client && BRANCH_FAMILIES.includes(id)) continue;
    const lv = g.weapons[id];
    if (!lv || g.cooldowns[id] > 0) continue;
    if (id === 'grenade') {
      g.cooldowns[id] = Math.max(2, 5.2 - lv * 0.45);
      blast(g, t.x, t.y, 58 + lv * 12, (42 + lv * 23) * power, id);
      g.events.push({ type: 'boom' });
    }
    if (id === 'frost') {
      g.cooldowns[id] = Math.max(3.4, 6.5 - lv * 0.38);
      blast(g, t.x, t.y, 70 + lv * 10, (22 + lv * 16) * power, id);
    }
    if (id === 'lightning') {
      g.cooldowns[id] = Math.max(2, 4.2 - lv * 0.3);
      const path = [{ x: 270, y: 700 }],
        used = [];
      let current = t;
      for (let i = 0; i < 3 + lv && current; i++) {
        used.push(current.id);
        path.push({ x: current.x, y: current.y });
        damage(g, current, (35 + lv * 16) * power, id);
        let next = null,
          dist = 180 + lv * 15;
        for (const e of g.enemies) {
          const d = Math.hypot(e.x - current.x, e.y - current.y);
          if (!e.dead && !used.includes(e.id) && d < dist) {
            next = e;
            dist = d;
          }
        }
        current = next;
      }
      effect(g, 'lightning', t.x, t.y, { path, duration: 0.3 });
    }
    if (id === 'laser') {
      g.cooldowns[id] = Math.max(2.5, 5 - lv * 0.3);
      const dx = t.x - 270,
        dy = t.y - 705,
        d = Math.hypot(dx, dy),
        ux = dx / d,
        uy = dy / d;
      for (const e of g.enemies)
        if (!e.dead && Math.abs((e.x - 270) * uy - (e.y - 705) * ux) < e.r + 8 + lv * 3)
          damage(g, e, (70 + lv * 28) * power, id);
      effect(g, 'laser', 270, 705, {
        tx: 270 + ux * 950,
        ty: 705 + uy * 950,
        r: 5 + lv * 2,
        duration: 0.36,
      });
    }
    if (id === 'drone') {
      g.cooldowns[id] = 0.7 / (1 + lv * 0.22);
      for (const x of [140, 400])
        fire(g, x, 590, t, (12 + lv * 9) * power, {
          color: '#c7ef9d',
          pierce: lv === 5 ? 1 : 0,
          kind: 'drone',
        });
    }
    g.cooldowns[id] *= 1 - (g.stats.cooldown || 0);
  }
  if (g.extended)
    for (const id of [
      'vehicle',
      'guided',
      'electron',
      'iceblast',
      'vortex',
      'airdrop',
      'wind',
      'fuel',
      'electric',
    ]) {
      if (g.client && BRANCH_FAMILIES.includes(id)) continue;
      const lv = g.weapons[id];
      if (!lv || g.cooldowns[id] > 0) continue;
      g.cooldowns[id] = Math.max(2, 7 - lv * 0.4) * (1 - (g.stats.cooldown || 0));
      if (id === 'vehicle') {
        g.specials.push({ type: id, x: t.x, y: 640, life: 2, hit: [], level: lv });
        effect(g, 'vehicle', t.x, 640, { ty: -50, duration: 2, r: 38 });
      }
      if (id === 'guided') {
        damage(g, t, (125 + lv * 55) * power, id);
        effect(g, 'guided', 270, 705, { tx: t.x, ty: t.y, r: 4 + lv, duration: 0.65 });
      }
      if (id === 'electron') {
        const list = [...g.enemies]
          .filter((e) => !e.dead)
          .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))
          .slice(0, 4 + lv);
        const path = [{ x: 270, y: 705 }];
        for (const e of list) {
          damage(g, e, (35 + lv * 18) * power, id);
          e.freeze = gemDebuffTime(g, 0.3);
          path.push({ x: e.x, y: e.y });
        }
        effect(g, 'electron', t.x, t.y, { path, duration: 0.5 });
      }
      if (id === 'iceblast') blast(g, t.x, t.y, 95 + lv * 12, (45 + lv * 20) * power, id);
      if (id === 'vortex') {
        g.specials.push({ type: id, x: t.x, y: t.y, life: 2.3, level: lv });
        effect(g, id, t.x, t.y, { r: 75 + lv * 8, duration: 2.3 });
      }
      if (id === 'airdrop') {
        for (let i = -1; i <= 1; i++)
          blast(
            g,
            Math.max(30, Math.min(510, t.x + i * 55)),
            Math.max(0, t.y + i * 70),
            65 + lv * 5,
            (45 + lv * 18) * power,
            id,
          );
        g.events.push({ type: 'boom' });
      }
      if (id === 'wind') {
        for (const e of g.enemies)
          if (!e.dead && Math.abs(e.y - t.y) < 55 + lv * 9)
            damage(g, e, (70 + lv * 22) * power, id);
        effect(g, id, 270, t.y, { r: 230, duration: 0.5 });
      }
      if (id === 'fuel') {
        blast(g, t.x, t.y, 80 + lv * 10, (30 + lv * 18) * power, id);
        g.specials.push({ type: id, x: t.x, y: t.y, life: 4, level: lv });
        effect(g, id, t.x, t.y, { r: 80 + lv * 10, duration: 4 });
      }
      if (id === 'electric') {
        g.specials.push({ type: id, x: t.x, y: t.y, life: 4, level: lv });
        effect(g, 'vortex', t.x, t.y, { r: 95, duration: 4 });
      }
    }
}
function spawn(g) {
  const info = g.info,
    finalWave = g.wave === info.waves - 1;
  const boss = info.boss && finalWave && g.spawned === info.count - 1;
  let type = 'walker',
    p = random(g);
  if (boss) type = 'boss';
  else if (info.level >= 12 && p < 0.11) type = 'bomber';
  else if (info.level >= 6 && p < 0.22) type = 'armor';
  else if (info.level >= 4 && p < 0.32) type = 'spitter';
  else if (info.level >= 3 && p < 0.44) type = 'brute';
  else if (info.level >= 2 && p < 0.65) type = 'runner';
  const base = ENEMIES[type],
    hp = base.hp * info.hpScale * (boss && info.level % 10 === 0 ? 1.6 : 1);
  g.enemies.push({
    id: g.nextId++,
    type,
    x: 45 + random(g) * 450,
    y: -40 - random(g) * 35,
    r: base.r,
    hp,
    maxHp: hp,
    speed: base.speed * info.speedScale,
    damage: base.damage,
    color: base.color,
    slow: 0,
    freeze: 0,
    burn: 0,
    flash: 0,
    attack: 1,
    phase: random(g) * 6.28,
    dead: false,
  });
  g.spawned++;
  g.waveSpawned++;
  if (boss) g.events.push({ type: 'boss', name: info.theme.boss });
}
function spawnClient(g, plan) {
  const cfg = plan.config,
    monster = clientMonster(cfg.MonsterID),
    type = clientEnemyType(monster),
    base = ENEMIES[type],
    elite = monster.Type === 6;
  // Original schedule/species/ratios are preserved as source values. Until the
  // native player/equipment formulas are ported, absolute health/damage use the
  // bounded web balance below; do not label these calculations native-identical.
  const hp =
    monster.Hp *
    g.info.hpScale *
    cfg.HpRatio *
    (type === 'boss' ? 6 : elite ? 2 : 1) *
    (g.elite ? 1.5 : 1);
  const r = type === 'boss' ? 44 : elite ? 25 : base.r;
  g.enemies.push({
    id: g.nextId++,
    type,
    elite,
    clientId: monster.MonsterID,
    flying: monster.IsFly === 1,
    frameModel: monster.frameModel,
    name: monster.name,
    sourceHp: monster.Hp * g.client.base.HpRatio * cfg.HpRatio,
    sourceAttack: monster.Atk * g.client.base.AttackRatio * cfg.AtkRatio,
    x: 45 + random(g) * 450,
    y: -40 - random(g) * 35,
    r,
    hp,
    maxHp: hp,
    speed: monster.MoveSpeed * 85 * g.info.speedScale,
    damage: monster.Atk * cfg.AtkRatio * (g.elite ? 1.3 : 1),
    xp: cfg.DropMp,
    color: base.color,
    slow: 0,
    freeze: 0,
    burn: 0,
    flash: 0,
    attack: 1,
    phase: random(g) * 6.28,
    dead: false,
  });
  g.spawned++;
  if (cfg.Wave - 1 > g.wave) {
    g.wave = cfg.Wave - 1;
    g.waveSpawned = 0;
    g.events.push({ type: 'wave', wave: cfg.Wave });
  }
  g.waveSpawned++;
  if (type === 'boss') g.events.push({ type: 'boss', name: monster.name });
}
function advanceClientPlan(g, dt) {
  for (const plan of g.plan) {
    if (g.time < plan.config.TriggerTime || plan.spawned >= plan.total) continue;
    while (g.time + 1e-7 >= plan.next && plan.spawned < plan.total && g.enemies.length < 140) {
      const first = plan.spawned === 0 ? plan.config.FirstRefreshNum : 0,
        n = Math.min(
          plan.total - plan.spawned,
          first || Math.max(1, plan.config.SingleRefreshNum),
          140 - g.enemies.length,
        );
      for (let i = 0; i < n; i++) {
        spawnClient(g, plan);
        plan.spawned++;
      }
      plan.next += Math.max(1 / 60, plan.config.Interval);
    }
  }
  const b = g.client.base;
  if (b.MpRecoverInterval > 0) g.xp += (b.MpRecoverValue / b.MpRecoverInterval) * dt;
}
export function upgradeOptions(g) {
  const options = g.availableWeapons
    .filter((w) => g.weapons[w.id] < 5 && !(g.client && BRANCH_FAMILIES.includes(w.id)))
    .map((w) => ({
      id: w.id,
      name: w.name,
      icon: w.icon,
      color: w.color,
      level: g.weapons[w.id] + 1,
      desc: w.desc,
      kind: g.weapons[w.id] === 0 ? '解锁技能' : g.weapons[w.id] === 4 ? '终极进化' : '火力升级',
    }));
  if (g.client) options.push(...nativeBuildOptions(g));
  for (const [id, name, icon, desc] of [
    ['rapid', '高速装填', 'reload', '全部步枪射速 +15%'],
    ['power', '高爆弹头', 'power', '所有技能伤害 +16%'],
    ['critical', '精确打击', 'target', '步枪暴击率 +9%'],
    ['pierce', '贯穿弹药', 'pierce', '步枪额外穿透 1 个敌人'],
  ])
    if (g.perks[id] < 5)
      options.push({
        id,
        name,
        icon,
        desc,
        color: '#e0d5b5',
        kind: '战术强化',
        level: g.perks[id] + 1,
      });
  if (!g.noHealing && g.hp < g.maxHp)
    options.push({
      id: 'repair',
      name: '战地维修',
      icon: 'repair',
      desc: '立即恢复防线 30% 耐久',
      kind: '应急补给',
      color: '#b4db94',
      level: 1,
    });
  const selected = [];
  while (options.length && selected.length < 3) {
    let i;
    if (g.client) {
      let cursor = random(g) * options.reduce((n, o) => n + (o.weight || 100), 0);
      i = options.findIndex((o) => (cursor -= o.weight || 100) < 0);
      if (i < 0) i = options.length - 1;
    } else i = Math.floor(random(g) * options.length);
    selected.push(options.splice(i, 1)[0]);
  }
  return selected;
}
export function chooseUpgrade(g, id) {
  if (g.status !== 'upgrade' || !g.choices.some((c) => c.id === id)) return false;
  const choice = g.choices.find((c) => c.id === id);
  if (choice.nativeBuildId) {
    if (!applyNativeBuild(g, choice.nativeBuildId)) return false;
  } else if (id === 'repair') g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.3);
  else if (id in g.weapons) g.weapons[id] = Math.min(5, g.weapons[id] + 1);
  else if (id in g.perks) g.perks[id] = Math.min(5, g.perks[id] + 1);
  g.choices = [];
  g.status = 'running';
  g.events.push({ type: 'upgrade', id });
  if (g.initialSelections > 0) {
    g.initialSelections--;
    if (g.initialSelections) {
      g.choices = upgradeOptions(g);
      g.status = 'upgrade';
    }
  }
  return true;
}
export function rerollUpgrades(g) {
  if (g.status !== 'upgrade' || (g.rerolls || 0) >= 3) return false;
  g.rerolls = (g.rerolls || 0) + 1;
  g.choices = upgradeOptions(g);
  return true;
}
export function airstrike(g) {
  if (g.status !== 'running' || g.energy < 100) return false;
  g.energy = 0;
  g.airstrikes++;
  effect(g, 'airstrike', 270, 320, { r: 600, duration: 1.1 });
  for (const e of g.enemies) damage(g, e, (200 + g.info.level * 8) * g.damage, 'airstrike');
  g.events.push({ type: 'airstrike' });
  return true;
}
function hitSegment(b, e) {
  const dx = b.x - b.px,
    dy = b.y - b.py,
    len = dx * dx + dy * dy,
    t = len ? clamp(((e.x - b.px) * dx + (e.y - b.py) * dy) / len, 0, 1) : 0;
  return Math.hypot(b.px + dx * t - e.x, b.py + dy * t - e.y) < e.r + b.size;
}
export function step(g, delta) {
  // 这里只推进可复现的战斗状态；输入、DOM 和素材加载由外层处理。
  if (g.status !== 'running') return;
  const dt = clamp(Number(delta) || 0, 0, 0.05);
  g.time += dt;
  g.energy = Math.min(100, g.energy + dt * 0.7);
  g.comboTime -= dt;
  if (g.comboTime <= 0) g.combo = 0;
  for (const f of g.effects) f.life -= dt;
  g.effects = g.effects.filter((f) => f.life > 0);
  const quota = g.quotas
    ? g.quotas[g.wave]
    : Math.min(g.waveCount, g.info.count - g.wave * g.waveCount);
  if (g.client) advanceClientPlan(g, dt);
  else if (g.waveSpawned < quota) {
    g.spawnClock -= dt;
    if (g.spawnClock <= 0 && g.enemies.length < 70) {
      spawn(g);
      g.spawnClock = Math.max(0.25, 0.82 - g.info.level * 0.006);
    }
  }
  shoot(g, dt);
  if (g.client) {
    tickGun(g, nativeApi);
    nativeTick(g, nativeApi);
    extendedTick(g, dt, nativeApi);
    supportTick(g, dt, nativeApi);
    eventTick(g, dt, nativeApi);
    nativeGemTick(g, dt, nativeApi);
    if (g.status !== 'running') return;
  }
  for (const s of g.specials) {
    s.life -= dt;
    if (s.type === 'vehicle') {
      const before = s.y;
      s.y -= dt * 370 * (1 + gemAttr(g, 119));
      for (const e of g.enemies)
        if (
          !e.dead &&
          !s.hit.includes(e.id) &&
          Math.abs(e.x - s.x) < 55 &&
          e.y <= before + 30 &&
          e.y >= s.y - 30
        ) {
          s.hit.push(e.id);
          damage(g, e, (100 + s.level * 40) * g.damage, 'vehicle');
          e.y = Math.max(-40, e.y - 30);
          if (g.weapons.grenade >= 2) blast(g, e.x, e.y, 60, 50 * g.damage, 'grenade');
        }
    }
    if (['vortex', 'fuel', 'electric'].includes(s.type))
      for (const e of g.enemies)
        if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < 100) {
          damage(g, e, (18 + s.level * 9) * g.damage * dt, s.type);
          if (s.type === 'vortex') {
            e.x += (s.x - e.x) * dt * 0.8;
            e.slow = gemDebuffTime(g, 0.5);
            if (g.weapons.electron >= 2) e.freeze = gemDebuffTime(g, 0.15);
          } else if (s.type === 'electric') {
            e.slow = gemDebuffTime(g, 0.5);
            e.freeze = Math.max(e.freeze, gemDebuffTime(g, 0.08));
          } else e.burn = gemDebuffTime(g, 2);
        }
  }
  g.specials = g.specials.filter((s) => s.life > 0);
  for (const b of g.bullets) {
    b.life -= dt;
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (g.client) nativeElectrodeCross(g, b);
    const enemies =
      b.nativeSkill || b.nativeProc
        ? g.enemies
            .filter((e) => !e.dead && !b.hit.includes(e.id) && hitSegment(b, e))
            .sort(
              (a, e) =>
                (a.x - b.px) * b.vx +
                (a.y - b.py) * b.vy -
                ((e.x - b.px) * b.vx + (e.y - b.py) * b.vy),
            )
        : g.enemies;
    for (const e of enemies)
      if (!e.dead && !b.hit.includes(e.id) && hitSegment(b, e)) {
        damage(g, e, b.damage, b.kind, {
          damageIndex: b.nativeProc?.index ?? b.damageIndex ?? b.nativeProfile?.damageIndex ?? 0,
          sourceSub: b.nativeProc?.sub ?? b.nativeSub,
          damageRule: b.nativeProc?.rule ?? b.nativeDamageRule,
          sourceId: b.id,
          shootId: b.nativeProfile?.hit?.raw?.m_shootId || undefined,
          noProcs: b.nativeNoProcs === true,
        });
        if (b.nativeElectrified && !e.dead)
          e.paralysis = Math.max(e.paralysis || 0, b.nativeElectrified);
        if (b.nativeProc) nativeProcBulletHit(g, b, e, nativeApi);
        if (b.nativeGun) nativeGunHit(g, b, e, nativeApi);
        if (b.nativeExtended) extendedBulletHit(g, b, e, nativeApi);
        else if (b.nativeSkill) nativeBulletHit(g, b, e, nativeApi);
        b.hit.push(e.id);
        if (b.nativeSkill) b.hitCount++;
        effect(g, 'hit-impact', e.x, e.y, {
          color: b.color,
          element: b.nativeElement || b.nativeDamageRule?.MagicType,
          kind: b.kind,
          r: Math.max(7, Math.min(22, b.size * 1.7)),
          angle: Math.atan2(b.vy, b.vx),
          duration: 0.2,
        });
        if (b.life <= 0 || (b.nativeSkill ? b.hitCount : b.hit.length) > b.pierce) {
          b.life = 0;
          break;
        }
      }
  }
  if (g.client)
    for (const b of g.bullets)
      if (!b.nativeProcEnded && (b.life <= 0 || b.x <= -40 || b.x >= 580 || b.y <= -80)) {
        b.nativeProcEnded = true;
        if (b.nativeSkill)
          nativeProcEnd(g, b.kind, b.nativeProfile?.hit?.raw?.m_shootId || 3, b, nativeApi, {
            sourceId: b.id,
          });
      }
  g.bullets = g.bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < 580 && b.y > -80);
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.slow = Math.max(0, e.slow - dt);
    e.freeze = Math.max(0, e.freeze - dt);
    if (e.burn > 0) {
      e.burn -= dt;
      if (
        !Object.values(e.nativeGemDots || {}).some((d) => d.until >= g.time && d.kind !== 'frost')
      )
        damage(g, e, (g.stats.nativeAttack ? 0.05 : 11) * g.damage * dt, 'burn', {
          noProcs: true,
          allowCrit: false,
        });
    }
    if (e.dead) continue;
    e.paralysis = Math.max(0, (e.paralysis || 0) - dt);
    const speed =
      e.freeze > 0 || e.paralysis > 0
        ? 0
        : e.speed * (e.slow > 0 ? 0.4 : 1) * (e.nativeSlowUntil > g.time ? e.nativeSlowRatio : 1);
    const ranged = e.type === 'spitter' && e.y > 480;
    if (e.y < WALL_Y - e.r && !ranged) {
      e.y += speed * dt;
      if (speed > 0) e.x = clamp(e.x + Math.sin(g.time * 1.2 + e.phase) * dt * 3, 30, 510);
    } else if (e.freeze <= 0 && e.paralysis <= 0) {
      e.attack -= dt;
      if (e.attack <= 0) {
        e.attack = e.type === 'boss' ? 1.4 : 1.1;
        g.hp = Math.max(0, g.hp - nativeWallHit(g, e, e.damage, nativeApi));
        effect(g, 'wallhit', e.x, WALL_Y, { r: 24, duration: 0.3 });
        g.events.push({ type: 'wallhit' });
        if (e.type === 'bomber' && !e.dead) {
          e.dead = true;
          g.kills++;
          effect(g, 'grenade', e.x, e.y, { r: 60, duration: 0.5 });
        }
      }
    }
  }
  g.enemies = g.enemies.filter((e) => !e.dead);
  if (g.cheats.invincible) g.hp = g.maxHp;
  if (g.hp <= 0) {
    g.status = 'lost';
    g.events.push({ type: 'lost' });
    return;
  }
  if (g.client) {
    if (g.spawned >= g.info.count && !g.enemies.length) {
      g.status = 'won';
      g.events.push({ type: 'won' });
      return;
    }
  } else if (g.waveSpawned >= quota && !g.enemies.length) {
    g.waveWait += dt;
    if (g.waveWait > 1.3) {
      if (g.wave >= g.info.waves - 1) {
        g.status = 'won';
        g.events.push({ type: 'won' });
        return;
      }
      g.wave++;
      g.waveSpawned = 0;
      g.waveWait = 0;
      g.spawnClock = 1.2;
      g.xp += 4;
      g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.04);
      g.events.push({ type: 'wave', wave: g.wave + 1 });
    }
  }
  if (g.xp >= g.nextXp && g.rank < (g.maxRank || Infinity)) {
    g.xp -= g.nextXp;
    g.rank++;
    gemOnUpgrade(g);
    g.nextXp = g.client ? clientXp(g.rank) : 9 + g.rank * 3;
    g.choices = upgradeOptions(g);
    if (g.choices.length) g.status = 'upgrade';
  }
  if (g.events.length > 80) g.events.splice(0, g.events.length - 80);
}
