// Deterministic simulation in metres/seconds, independent of Vue and WebGL.
export const STORAGE = 'jet-r-racer';
export const LEVEL_COUNT = 30;
export const LANES = [-3.2, 0, 3.2];
export const JET_DURATION = 1.65;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export function levelInfo(level = 1) {
  const n = clamp(Math.floor(Number(level) || 1), 1, LEVEL_COUNT),
    chapter = Math.floor((n - 1) / 10);
  return {
    level: n,
    chapter,
    name: ['蔚蓝海岸', '落日都会', '霓虹天际'][chapter],
    distance: 760 + n * 55,
    speed: 29 + n * 0.45,
    gap: 72 - Math.min(n, 25) * 0.8,
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
    speed: 0,
    x: 0,
    lane: 1,
    hp: 3,
    energy: 100,
    cooldown: 0,
    jet: 0,
    height: 0,
    roll: 0,
    boost: 0,
    invulnerable: 0,
    score: 0,
    coins: 0,
    combo: 0,
    nearMiss: 0,
    jumps: 0,
    cleared: 0,
    spawnAt: 95,
    nextId: 1,
    objects: [],
    events: [],
    steerLatch: 0,
    jetLatch: false,
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
  }
}
export function activateJet(g) {
  if (g.status !== 'running' || g.jet > 0 || g.cooldown > 0 || g.energy < 35) return false;
  g.energy -= 35;
  g.cooldown = 5.5;
  g.jet = JET_DURATION;
  g.jumps++;
  g.events.push({ type: 'jet' });
  return true;
}
export function changeLane(g, delta) {
  if (g.status !== 'running') return;
  g.lane = clamp(g.lane + Math.sign(delta), 0, 2);
}
function add(g, type, lane, z, extra = {}) {
  g.objects.push({ id: g.nextId++, type, lane, x: LANES[lane], z, passed: false, ...extra });
}
export function spawnRow(g, z) {
  // A guaranteed free lane on every row; rows are >1.3 seconds apart at top speed.
  const safe = Math.floor(random(g) * 3),
    hard = g.level > 7 && random(g) < 0.38;
  for (let lane = 0; lane < 3; lane++) {
    if (lane === safe) {
      for (let i = 0; i < 4; i++) add(g, 'coin', lane, z + i * 4);
      continue;
    }
    if (!hard && random(g) < 0.35) continue;
    const r = random(g);
    add(g, r < 0.58 ? 'traffic' : r < 0.84 ? 'barrier' : 'gate', lane, z, {
      variant: Math.floor(random(g) * 3),
    });
  }
  if (random(g) < 0.32) add(g, 'energy', safe, z + 23);
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
  g.cooldown = Math.max(0, g.cooldown - dt);
  g.invulnerable = Math.max(0, g.invulnerable - dt);
  const boosting = !!input.boost && g.energy > 3 && g.jet <= 0;
  g.boost = boosting ? 1 : 0;
  g.energy = clamp(g.energy + (boosting ? -16 : 7) * dt, 0, 100);
  const target =
    levelInfo(g.level).speed +
    (g.mode === 'endless' ? Math.min(15, g.distance / 1000) : 0) +
    (boosting ? 14 : 0);
  g.speed += (target - g.speed) * Math.min(1, dt * 1.8);
  const previousDistance = g.distance;
  g.distance += g.speed * dt;
  const previousX = g.x;
  g.x += (LANES[g.lane] - g.x) * Math.min(1, dt * 12);
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
  while (g.spawnAt < g.distance + 270) {
    spawnRow(g, g.spawnAt);
    g.spawnAt += levelInfo(g.level).gap;
  }
  for (const o of g.objects) {
    if (o.passed) continue;
    const before = o.z - previousDistance,
      after = o.z - g.distance;
    // Swept interval includes fast frames; collision expires as soon as it passes.
    if (before >= -2.4 && after <= 2.4) {
      const sweptMin = Math.min(previousX, g.x) - 0.86,
        sweptMax = Math.max(previousX, g.x) + 0.86;
      const aligned = o.x >= sweptMin - 0.65 && o.x <= sweptMax + 0.65;
      if (o.type === 'coin' || o.type === 'energy') {
        if (aligned && g.height < 2) {
          o.passed = true;
          if (o.type === 'coin') {
            g.coins++;
            g.score += 50;
            g.events.push({ type: 'coin' });
          } else {
            g.energy = clamp(g.energy + 28, 0, 100);
            g.events.push({ type: 'energy' });
          }
        }
      } else if (aligned) {
        const hit =
          o.type === 'gate' ? g.height > 1.1 : g.height < (o.type === 'traffic' ? 1.5 : 0.8);
        if (hit && !g.invulnerable) {
          o.passed = true;
          g.hp--;
          g.combo = 0;
          g.speed *= 0.58;
          g.invulnerable = 1.7;
          g.events.push({ type: 'hit' });
          if (g.hp <= 0) {
            g.status = 'lost';
            g.events.push({ type: 'lost' });
          }
        } else if (!hit && after < 0) {
          o.passed = true;
          g.cleared++;
          g.combo++;
          g.score += 150 + g.combo * 15;
          g.events.push({ type: 'clear' });
        }
      }
    }
    if (after < -3 && !o.passed) {
      o.passed = true;
      if (!['coin', 'energy'].includes(o.type) && Math.abs(g.x - o.x) < 3.7 && g.height < 1) {
        g.nearMiss++;
        g.combo++;
        g.score += 80;
        g.events.push({ type: 'near' });
      }
    }
  }
  g.objects = g.objects.filter((o) => o.z - g.distance > -18);
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
