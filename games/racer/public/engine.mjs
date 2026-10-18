// Deterministic metres/seconds simulation, independent of Vue/WebGL.
import { THEMES, ROUTE_NAMES, PATTERNS, ROUTE_ORDERS } from './tracks.mjs';
export { THEMES, PATTERNS };
export const STORAGE = 'jet-r-racer';
export const LEVEL_COUNT = 30;
export const LANES = [-3.2, 0, 3.2];
export const JET_DURATION = 1.65;
export const JET_COOLDOWN = 5.5;
export const LANE_SPEED = 25;
export const MAX_DESIGN_SPEED = 56;
export const ITEMS = {
  energy: {
    name: '氮气补给',
    icon: 'N',
    color: '#83eed6',
    duration: 0,
    description: '补充 32% 能量。',
  },
  reverse: {
    name: '黑色魔鬼',
    icon: '↔',
    color: '#be95ff',
    duration: 7,
    description: '7 秒内左右操作颠倒，按左向右，按右向左。',
  },
  fullSpeed: {
    name: '全速冲刺',
    icon: 'MAX',
    color: '#ffce72',
    duration: 8,
    description: '8 秒强制加速，免氮气消耗，期间开关锁定。',
  },
  ghost: {
    name: '隐身穿越',
    icon: '◌',
    color: '#9eeaff',
    duration: 7,
    description: '7 秒透明闪光，无视所有障碍，包括长挂车。',
  },
  repair: {
    name: '车身修复',
    icon: '+',
    color: '#f0a9ba',
    duration: 0,
    description: '恢复 1 格车身，最多 3 格。',
  },
};
export const OBSTACLES = {
  traffic: { length: 4.6, width: 1.85, jumpHeight: 1.6 },
  barrier: { length: 1.2, width: 2.65, jumpHeight: 0.95 },
  gate: { length: 1.4, width: 2.5, jumpHeight: -1 },
  truck: { length: 22, width: 2.3, jumpHeight: Infinity },
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export function levelInfo(level = 1) {
  const n = clamp(Math.floor(Number(level) || 1), 1, LEVEL_COUNT);
  const variant = Math.floor((n - 1) / THEMES.length),
    theme = THEMES[(n - 1) % THEMES.length];
  return {
    level: n,
    chapter: variant,
    theme,
    variant,
    name: theme.name,
    routeName: ROUTE_NAMES[variant],
    distance: 1400 + ((n * 73) % 220),
    speed: 38.5 + ((n - 1) % 5) * 0.32,
    gap: 28,
  };
}
export function newGame({ level = 1, seed = 12345, mode = 'campaign' } = {}) {
  const info = levelInfo(level);
  return {
    version: 1,
    level: info.level,
    mode: mode === 'endless' ? 'endless' : 'campaign',
    seed: seed >>> 0 || 12345,
    status: 'ready',
    clock: 0,
    distance: 0,
    speed: info.speed * 0.8,
    x: 0,
    lane: 1,
    hp: 3,
    energy: 100,
    cooldown: 0,
    jet: 0,
    height: 0,
    roll: 0,
    boost: 0,
    nitroEnabled: false,
    effects: { reverse: 0, fullSpeed: 0, ghost: 0 },
    invulnerable: 0,
    score: 0,
    coins: 0,
    combo: 0,
    nearMiss: 0,
    jumps: 0,
    cleared: 0,
    spawnAt: 96,
    nextId: 1,
    objects: [],
    events: [],
    segments: [],
    route: [],
    patternIndex: 0,
    plannedLane: 1,
    steerLatch: 0,
    jetLatch: false,
    boostLatch: false,
  };
}
function random(g) {
  g.seed ^= g.seed << 13;
  g.seed ^= g.seed >>> 17;
  g.seed ^= g.seed << 5;
  g.seed >>>= 0;
  return g.seed / 4294967296;
}
export function start(g) {
  if (['ready', 'paused'].includes(g.status)) {
    g.status = 'running';
    g.events = [];
  }
}
export function pause(g) {
  if (g.status === 'running') {
    g.status = 'paused';
    g.jetLatch = false;
    g.steerLatch = 0;
    g.boostLatch = false;
  }
}
export function jetBlockReason(g) {
  if (g.status !== 'running') return 'paused';
  if (g.jet > 0) return 'airborne';
  if (g.cooldown > 0) return 'cooldown';
  return g.energy < 35 ? 'energy' : '';
}
export function activateJet(g) {
  if (jetBlockReason(g)) return false;
  g.energy -= 35;
  g.cooldown = JET_COOLDOWN;
  g.jet = JET_DURATION;
  g.jumps++;
  g.events.push({ type: 'jet' });
  return true;
}
export function toggleBoost(g) {
  if (g.status !== 'running') return 'paused';
  if (g.effects.fullSpeed > 0) return 'locked';
  if (!g.nitroEnabled && g.energy < 3) return 'energy';
  g.nitroEnabled = !g.nitroEnabled;
  g.events.push({ type: 'nitro', enabled: g.nitroEnabled });
  return g.nitroEnabled ? 'on' : 'off';
}
export function changeLane(g, delta) {
  if (g.status !== 'running') return false;
  const direction = Math.sign(delta) * (g.effects.reverse > 0 ? -1 : 1);
  const next = clamp(g.lane + direction, 0, 2);
  const changed = next !== g.lane;
  g.lane = next;
  return changed;
}
function add(g, type, lane, z, extra = {}) {
  const spec = OBSTACLES[type] || { length: 1.1, width: 1.15 };
  const o = {
    id: g.nextId++,
    type,
    lane,
    x: LANES[lane],
    z,
    length: spec.length,
    width: spec.width,
    passed: false,
    ...extra,
  };
  g.objects.push(o);
  return o;
}
function nextLane(lane, turn) {
  const next = lane + turn;
  return next < 0 || next > 2 ? lane - turn : next;
}
export function spawnRow(
  g,
  z,
  {
    safeLane = g.plannedLane,
    blockers = ['traffic', 'barrier'],
    gate = true,
    row = 0,
    pattern = 'choice',
  } = {},
) {
  const blocked = [0, 1, 2].filter((l) => l !== safeLane);
  for (const [i, lane] of blocked.entries())
    add(g, blockers[(i + row) % blockers.length], lane, z, {
      variant: Math.floor(random(g) * 2),
      row: z,
      pattern,
    });
  if (gate) add(g, 'gate', safeLane, z, { row: z, pattern });
  for (const offset of [-5, 0, 5]) add(g, 'coin', safeLane, z + offset);
  g.route.push({ z, lane: safeLane, pattern, gate });
}
export function spawnPattern(g, startZ = g.spawnAt) {
  const info = levelInfo(g.level),
    order = ROUTE_ORDERS[info.variant];
  const pattern = PATTERNS[order[(g.patternIndex + g.level - 1) % order.length]];
  let safe = g.plannedLane;
  const mirror = (g.level + g.patternIndex) % 2 ? 1 : -1;
  for (const [row, turn] of pattern.turns.entries()) {
    safe = nextLane(safe, turn * mirror);
    spawnRow(g, startZ + row * pattern.gap, {
      safeLane: safe,
      blockers: pattern.blockers,
      gate: pattern.gates,
      row,
      pattern: pattern.id,
    });
  }
  const endZ = startZ + (pattern.turns.length - 1) * pattern.gap;
  const itemCycle = ['energy', 'reverse', 'fullSpeed', 'ghost', 'energy', 'repair'];
  const item = itemCycle[(g.patternIndex + info.variant) % itemCycle.length];
  // Inter-formation recovery gap gives enough room to collect OR dodge a pickup.
  add(g, item, safe, endZ + 26);
  g.segments.push({ start: startZ, end: endZ, name: pattern.name, id: pattern.id });
  g.plannedLane = safe;
  g.patternIndex++;
  g.spawnAt = endZ + 54;
  return { pattern, nextZ: g.spawnAt, lane: safe };
}
export function collectItem(g, type) {
  if (!ITEMS[type]) return false;
  if (type === 'energy') g.energy = clamp(g.energy + 32, 0, 100);
  else if (type === 'repair') g.hp = Math.min(3, g.hp + 1);
  else {
    g.effects[type] = Math.min(ITEMS[type].duration * 1.75, g.effects[type] + ITEMS[type].duration);
    if (type === 'fullSpeed') g.nitroEnabled = false;
  }
  g.events.push({ type: 'pickup', item: type });
  return true;
}
export function sweptOverlap(o, x0, x1, d0, d1) {
  let enter = 0,
    exit = 1;
  const axes = [
    [x0 - o.x, x1 - x0, 0.79 + (o.width ?? OBSTACLES[o.type]?.width ?? 1.15) / 2],
    [d0 - o.z, d1 - d0, 2.1 + (o.length ?? OBSTACLES[o.type]?.length ?? 1.1) / 2],
  ];
  for (const [p, v, extent] of axes) {
    if (Math.abs(v) < 1e-9) {
      if (Math.abs(p) > extent) return false;
      continue;
    }
    let a = (-extent - p) / v,
      b = (extent - p) / v;
    if (a > b) [a, b] = [b, a];
    enter = Math.max(enter, a);
    exit = Math.min(exit, b);
    if (enter > exit) return false;
  }
  return exit >= 0 && enter <= 1;
}
export function obstacleHits(o, height, x = o.x) {
  if (o.type === 'gate') return height > 1.1 || Math.abs(x - o.x) > 0.5;
  if (o.type === 'truck') return true;
  return height < (OBSTACLES[o.type]?.jumpHeight ?? 1.6);
}
export function step(g, dt = 1 / 60, input = {}) {
  g.events = [];
  if (g.status !== 'running') return;
  dt = clamp(Number(dt) || 0, 0, 0.05);
  g.clock += dt;
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (steer && steer !== g.steerLatch) changeLane(g, steer);
  g.steerLatch = steer;
  if (input.jet && !g.jetLatch) activateJet(g);
  g.jetLatch = !!input.jet;
  if (input.boost && !g.boostLatch) toggleBoost(g);
  g.boostLatch = !!input.boost;
  for (const key of ['reverse', 'fullSpeed', 'ghost']) {
    const before = g.effects[key];
    g.effects[key] = Math.max(0, before - dt);
    if (before > 0 && g.effects[key] === 0) {
      g.events.push({ type: 'effectEnd', item: key });
      if (key === 'ghost') g.invulnerable = Math.max(g.invulnerable, 0.65);
    }
  }
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.invulnerable = Math.max(0, g.invulnerable - dt);
  const forced = g.effects.fullSpeed > 0;
  if (g.nitroEnabled && g.energy <= 0) {
    g.nitroEnabled = false;
    g.events.push({ type: 'empty' });
  }
  g.boost = forced || g.nitroEnabled ? 1 : 0;
  g.energy = clamp(g.energy + (forced ? 4 : g.nitroEnabled ? -14 : 8) * dt, 0, 100);
  const target =
    levelInfo(g.level).speed +
    (g.mode === 'endless' ? Math.min(3, g.distance / 1400) : 0) +
    g.boost * 12;
  g.speed += (target - g.speed) * Math.min(1, dt * 2.8);
  const previousDistance = g.distance,
    previousX = g.x;
  g.distance += g.speed * dt;
  g.x += clamp(LANES[g.lane] - g.x, -LANE_SPEED * dt, LANE_SPEED * dt);
  if (g.jet > 0) {
    g.jet = Math.max(0, g.jet - dt);
    const t = 1 - g.jet / JET_DURATION;
    g.height = Math.sin(Math.PI * t) * 3.8;
    const turn = clamp((t - 0.16) / 0.67, 0, 1);
    g.roll = turn * turn * (3 - 2 * turn) * Math.PI * 2;
    if (!g.jet) {
      g.height = 0;
      g.roll = 0;
      g.events.push({ type: 'land' });
    }
  }
  while (g.spawnAt < g.distance + 300) spawnPattern(g);
  for (const o of g.objects) {
    if (g.status === 'lost') break;
    if (o.passed) continue;
    const collectible = o.type === 'coin' || !!ITEMS[o.type];
    if (sweptOverlap(o, previousX, g.x, previousDistance, g.distance)) {
      if (collectible && g.height < 1.9) {
        o.passed = true;
        if (o.type === 'coin') {
          g.coins++;
          g.score += 50;
          g.events.push({ type: 'coin' });
        } else collectItem(g, o.type);
      } else if (!collectible) {
        const hit = obstacleHits(o, g.height, g.x);
        if (g.effects.ghost > 0) {
          o.ghosted = true;
        } else if (hit && !o.hit && !g.invulnerable) {
          o.hit = true;
          g.hp--;
          g.combo = 0;
          g.speed *= 0.7;
          g.invulnerable = 1.25;
          g.events.push({ type: 'hit' });
          if (g.hp <= 0) {
            g.status = 'lost';
            g.events.push({ type: 'lost' });
          }
        } else if (!hit && g.height > 0.8) o.jumped = true;
      }
    }
    const extent = 2.1 + (o.length ?? OBSTACLES[o.type]?.length ?? 1.1) / 2;
    if (o.z - g.distance < -extent) {
      o.passed = true;
      if (!collectible && !o.hit) {
        if (o.jumped || o.ghosted) {
          g.cleared++;
          g.combo++;
          g.score += 150 + g.combo * 15;
          g.events.push({ type: 'clear', ghost: !!o.ghosted });
        } else if (o.type !== 'gate' && Math.abs(g.x - o.x) < 3.8 && g.height < 1) {
          g.nearMiss++;
          g.combo++;
          g.score += 80;
          g.events.push({ type: 'near' });
        }
      }
    }
  }
  g.objects = g.objects.filter(
    (o) => o.z - g.distance > -35 && (!o.passed || (!ITEMS[o.type] && o.type !== 'coin')),
  );
  g.segments = g.segments.filter((s) => s.end > g.distance - 40);
  g.route = g.route.filter((r) => r.z > g.distance - 50);
  if (
    g.status === 'running' &&
    g.mode === 'campaign' &&
    g.distance >= levelInfo(g.level).distance
  ) {
    g.status = 'won';
    g.score += 1000 + g.hp * 300;
    g.events.push({ type: 'won' });
  }
}
export function totalScore(g) {
  return Math.floor(g.score + g.distance * 2);
}
export function serialize(g) {
  return { version: 1, level: g.level, mode: g.mode };
}
export function restore(value) {
  if (
    value?.version !== 1 ||
    !Number.isInteger(value.level) ||
    value.level < 1 ||
    value.level > LEVEL_COUNT
  )
    return null;
  return newGame({ level: value.level, mode: value.mode });
}
