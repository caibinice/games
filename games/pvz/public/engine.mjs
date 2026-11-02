export const WIDTH = 1080,
  HEIGHT = 640,
  LAWN_X = 150,
  LAWN_Y = 160,
  CELL_W = 88,
  LAWN_H = 420,
  COLS = 9,
  LEVEL_COUNT = 50;
export const CHAPTERS = [
  {
    name: '阳光草坪',
    sub: 'A SUNNY AFTERNOON',
    color: '#9dcf64',
    grass: ['#80ad4f', '#8cb958'],
    sky: '#b7d9c0',
    night: false,
    pool: false,
    roof: false,
  },
  {
    name: '月夜庭院',
    sub: 'AFTER THE SUN GOES DOWN',
    color: '#b7acd8',
    grass: ['#456c5a', '#507760'],
    sky: '#293e57',
    night: true,
    pool: false,
    roof: false,
  },
  {
    name: '泳池派对',
    sub: 'A SPLASH OF TROUBLE',
    color: '#79cad5',
    grass: ['#80b15c', '#8ebd66'],
    sky: '#acdaca',
    night: false,
    pool: true,
    roof: false,
  },
  {
    name: '迷雾后院',
    sub: 'SOMETHING IN THE MIST',
    color: '#9bbcad',
    grass: ['#3c6459', '#456d60'],
    sky: '#31474e',
    night: true,
    pool: true,
    roof: false,
  },
  {
    name: '屋顶决战',
    sub: 'THE LAST ROOFTOP',
    color: '#e4ae7c',
    grass: ['#ae735a', '#be8062'],
    sky: '#d0c5a6',
    night: false,
    pool: false,
    roof: true,
  },
];
export const PLANTS = [
  {
    id: 'sunflower',
    name: '向日葵',
    cost: 50,
    cooldown: 5,
    hp: 260,
    unlock: 1,
    desc: '每 12 秒生产 25 阳光。多种几棵，后续火力才有保障。',
  },
  {
    id: 'peashooter',
    name: '豌豆射手',
    cost: 100,
    cooldown: 5,
    hp: 300,
    unlock: 1,
    damage: 20,
    period: 1.4,
    desc: '发射豌豆，攻击所在一行的僵尸。',
  },
  {
    id: 'wallnut',
    name: '坚果墙',
    cost: 50,
    cooldown: 16,
    hp: 1800,
    unlock: 1,
    desc: '耐久很高，拦住僵尸，为后排争取时间。',
  },
  {
    id: 'cherrybomb',
    name: '樱桃炸弹',
    cost: 150,
    cooldown: 30,
    hp: 300,
    unlock: 2,
    desc: '短暂引爆，炸掉附近三行的大片僵尸。',
  },
  {
    id: 'potatomine',
    name: '土豆地雷',
    cost: 25,
    cooldown: 12,
    hp: 260,
    unlock: 3,
    desc: '埋下 10 秒后就绪，接近的僵尸会触发爆炸。',
  },
  {
    id: 'snowpea',
    name: '寒冰射手',
    cost: 175,
    cooldown: 7,
    hp: 300,
    unlock: 5,
    damage: 20,
    period: 1.5,
    desc: '冰豌豆令僵尸减速，适合配合普通火力。',
  },
  {
    id: 'repeater',
    name: '双发射手',
    cost: 200,
    cooldown: 8,
    hp: 300,
    unlock: 8,
    damage: 20,
    period: 1.4,
    desc: '每次连射两颗豌豆，单格火力翻倍。',
  },
  {
    id: 'chomper',
    name: '大嘴花',
    cost: 150,
    cooldown: 12,
    hp: 360,
    unlock: 10,
    desc: '吞掉近处的普通僵尸，然后消化 12 秒。',
  },
  {
    id: 'puffshroom',
    name: '小喷菇',
    cost: 0,
    cooldown: 6,
    hp: 180,
    unlock: 11,
    damage: 20,
    period: 1.5,
    desc: '免费种植，射程三格。白天睡觉，夜晚作战。',
  },
  {
    id: 'squash',
    name: '窝瓜',
    cost: 50,
    cooldown: 18,
    hp: 300,
    unlock: 16,
    desc: '敌人靠近就跳起来压扁，一次性重击。',
  },
  {
    id: 'lilypad',
    name: '睡莲',
    cost: 25,
    cooldown: 2.5,
    hp: 240,
    unlock: 21,
    base: true,
    desc: '先放在泳池水道，再在上面种植物。',
  },
  {
    id: 'flowerpot',
    name: '花盆',
    cost: 25,
    cooldown: 2.5,
    hp: 240,
    unlock: 41,
    base: true,
    desc: '屋顶种植必备，开场已在前三列摆好花盆。',
  },
  {
    id: 'cabbage',
    name: '卷心菜投手',
    cost: 125,
    cooldown: 6,
    hp: 300,
    unlock: 41,
    damage: 55,
    period: 2.2,
    desc: '投掷大颗卷心菜，适合屋顶持续输出。',
  },
];
export const ZOMBIES = {
  zombie: { name: '普通僵尸', hp: 180, speed: 14, damage: 38 },
  cone: { name: '路障僵尸', hp: 400, speed: 14, damage: 40 },
  bucket: { name: '铁桶僵尸', hp: 780, speed: 13, damage: 42 },
  football: { name: '橄榄球僵尸', hp: 620, speed: 27, damage: 50 },
  newspaper: { name: '读报僵尸', hp: 300, speed: 12, damage: 40 },
  gargantuar: { name: '巨人僵尸', hp: 2000, speed: 10, damage: 180 },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function stageInfo(level) {
  const n = clamp(Math.trunc(level) || 1, 1, 50),
    chapter = Math.floor((n - 1) / 10),
    theme = CHAPTERS[chapter];
  return {
    level: n,
    chapter,
    theme,
    rows: theme.pool ? 6 : 5,
    count: 9 + Math.ceil(n * 0.65),
    waves: 2 + Math.floor((n - 1) / 15),
    spawnPeriod: Math.max(2, 5.7 - n * 0.055),
    hpScale: 1 + (n - 1) * 0.009,
    boss: n % 10 === 0,
    skyPeriod: theme.night ? 16 : 8.5,
    name: theme.name + ' ' + (((n - 1) % 10) + 1),
    reward: 30 + n * 4,
  };
}
export function random(g) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export const plantInfo = (id) => PLANTS.find((p) => p.id === id);
export const rowY = (g, row) => LAWN_Y + ((row + 0.5) * LAWN_H) / g.info.rows;
export const colX = (col) => LAWN_X + (col + 0.5) * CELL_W;
export function isWater(g, row) {
  return g.info.theme.pool && (row === 2 || row === 3);
}
export function createGame({ level = 1, seed = Date.now(), autoCollect = false } = {}) {
  const info = stageInfo(level),
    g = {
      version: 1,
      info,
      seed: seed >>> 0,
      status: 'ready',
      time: 0,
      sun: info.theme.roof ? 250 : info.theme.pool || info.theme.night ? 200 : 150,
      kills: 0,
      spawned: 0,
      spawnClock: 18,
      skyClock: 3,
      rank: 0,
      nextId: 1,
      plants: [],
      bases: [],
      zombies: [],
      bullets: [],
      suns: [],
      effects: [],
      events: [],
      cooldowns: Object.fromEntries(PLANTS.map((p) => [p.id, 0])),
      laneCounts: Array(info.rows).fill(0),
      mowers: Array.from({ length: info.rows }, (_, row) => ({ row, status: 'ready', x: 106 })),
      autoCollect,
      settled: false,
      score: 0,
    };
  if (info.theme.roof)
    for (let row = 0; row < info.rows; row++)
      for (let col = 0; col < 3; col++)
        g.bases.push({
          id: g.nextId++,
          kind: 'flowerpot',
          row,
          col,
          x: colX(col),
          y: rowY(g, row),
          hp: 240,
          maxHp: 240,
        });
  return g;
}
export function start(g) {
  if (g.status === 'ready') {
    g.status = 'running';
    g.events.push({ type: 'start' });
  }
  return g;
}
export function togglePause(g) {
  if (g.status === 'running') g.status = 'paused';
  else if (g.status === 'paused') g.status = 'running';
  return g.status;
}
export function cellAt(g, x, y) {
  const row = Math.floor((y - LAWN_Y) / (LAWN_H / g.info.rows)),
    col = Math.floor((x - LAWN_X) / CELL_W);
  return row < 0 || row >= g.info.rows || col < 0 || col >= COLS ? null : { row, col };
}
export function canPlant(g, id, row, col) {
  const p = plantInfo(id);
  if (g.status !== 'running') return '请先开始种植';
  if (!p || p.unlock > g.info.level) return '植物尚未解锁';
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    row >= g.info.rows ||
    col < 0 ||
    col >= COLS
  )
    return '请选择草坪格子';
  if (g.cooldowns[id] > 0.001) return '种子正在冷却';
  if (g.sun < p.cost) return '阳光不足';
  const base = g.bases.find((b) => b.row === row && b.col === col);
  if (p.base) {
    if (base) return '这里已经有底座';
    if (id === 'lilypad' && !isWater(g, row)) return '睡莲要种在水上';
    if (id === 'flowerpot' && !g.info.theme.roof) return '花盆用于屋顶';
  } else {
    if (g.plants.some((b) => b.row === row && b.col === col)) return '这里已经种有植物';
    if (isWater(g, row) && base?.kind !== 'lilypad') return '先在水上放一片睡莲';
    if (g.info.theme.roof && base?.kind !== 'flowerpot') return '先放花盆再种植物';
  }
  return null;
}
export function plant(g, id, row, col) {
  const reason = canPlant(g, id, row, col);
  if (reason) return { ok: false, reason };
  const p = plantInfo(id),
    e = {
      id: g.nextId++,
      kind: id,
      row,
      col,
      x: colX(col),
      y: rowY(g, row),
      hp: p.hp,
      maxHp: p.hp,
      age: 0,
      timer: id === 'sunflower' ? 5 : 0.25,
      digest: 0,
      flash: 0,
    };
  g.sun -= p.cost;
  g.cooldowns[id] = p.cooldown;
  (p.base ? g.bases : g.plants).push(e);
  g.events.push({ type: 'plant', id });
  return { ok: true, plant: e };
}
export function shovel(g, row, col) {
  if (g.status !== 'running') return false;
  const list = g.plants.some((p) => p.row === row && p.col === col) ? g.plants : g.bases,
    i = list.findIndex((p) => p.row === row && p.col === col);
  if (i < 0) return false;
  list.splice(i, 1);
  g.events.push({ type: 'shovel' });
  return true;
}
function addSun(g, x, y, fall = false) {
  g.suns.push({
    id: g.nextId++,
    x,
    y,
    targetY: fall ? LAWN_Y + random(g) * LAWN_H : y + 32,
    fall,
    age: 0,
    value: 25,
  });
}
export function collectSun(g, id) {
  if (g.status !== 'running') return false;
  const i = g.suns.findIndex((s) => s.id === id);
  if (i < 0) return false;
  g.sun = Math.min(9990, g.sun + g.suns[i].value);
  g.suns.splice(i, 1);
  g.events.push({ type: 'sun' });
  return true;
}
export function collectAt(g, x, y) {
  const s = g.suns.find((s) => Math.hypot(s.x - x, s.y - y) < 34);
  return s ? collectSun(g, s.id) : false;
}
function effect(g, type, x, y, more = {}) {
  g.effects.push({
    type,
    x,
    y,
    life: more.duration || 0.5,
    duration: more.duration || 0.5,
    ...more,
  });
  if (g.effects.length > 100) g.effects.shift();
}
function hit(g, z, amount, kind = 'pea') {
  if (z.dead) return;
  z.hp -= amount;
  z.flash = 0.08;
  if (z.kind === 'newspaper' && z.hp < z.maxHp * 0.5) z.enraged = true;
  if (kind === 'ice') z.slow = 5;
  if (z.hp <= 0) {
    z.dead = true;
    g.kills++;
    g.score += Math.round(z.maxHp);
    effect(g, 'death', z.x, z.y);
    g.events.push({ type: 'kill' });
  }
}
function explosion(g, p, r, damage) {
  effect(g, 'explosion', p.x, p.y, { r, duration: 0.8 });
  for (const z of g.zombies)
    if (!z.dead && Math.hypot(z.x - p.x, (z.y - p.y) * 1.1) < r) hit(g, z, damage, 'bomb');
  g.events.push({ type: 'boom' });
}
function spawn(g) {
  const n = g.info.level,
    p = random(g);
  let kind = 'zombie';
  if (g.info.boss && g.spawned === g.info.count - 1) kind = 'gargantuar';
  else if (n >= 25 && p < 0.14) kind = 'football';
  else if (n >= 8 && p < 0.32) kind = 'bucket';
  else if (n >= 11 && p < 0.44) kind = 'newspaper';
  else if (n >= 3 && p < 0.64) kind = 'cone';
  const z = ZOMBIES[kind];
  const min = Math.min(...g.laneCounts),
    lanes = g.laneCounts.map((count, row) => ({ count, row })).filter((l) => l.count === min),
    row = lanes[Math.floor(random(g) * lanes.length)].row,
    hp = z.hp * g.info.hpScale;
  g.laneCounts[row]++;
  g.zombies.push({
    id: g.nextId++,
    kind,
    row,
    x: 1030,
    y: rowY(g, row),
    hp,
    maxHp: hp,
    speed: z.speed,
    damage: z.damage,
    attack: 0,
    eating: false,
    slow: 0,
    flash: 0,
    dead: false,
    enraged: false,
    phase: random(g) * 6.28,
  });
  g.spawned++;
  const wave = Math.min(g.info.waves, Math.ceil(g.spawned / (g.info.count / g.info.waves)));
  if (wave > g.rank) {
    g.rank = wave;
    g.events.push({ type: 'wave', wave });
  }
  if (kind === 'gargantuar') g.events.push({ type: 'boss' });
}
function shoot(g, p, type, damage) {
  g.bullets.push({
    id: g.nextId++,
    row: p.row,
    x: p.x + 27,
    y: p.y - 14,
    origin: p.x + 27,
    damage,
    kind: type,
    life: 4,
  });
  effect(g, 'muzzle', p.x + 28, p.y - 15);
  g.events.push({ type: 'shot' });
}
export function step(g, delta) {
  // 统一在模拟时钟内更新冷却、产阳光和碰撞，暂停时不补算后台流逝时间。
  if (g.status !== 'running') return;
  const dt = clamp(Number(delta) || 0, 0, 0.05);
  g.time += dt;
  for (const id in g.cooldowns) g.cooldowns[id] = Math.max(0, g.cooldowns[id] - dt);
  for (const f of g.effects) f.life -= dt;
  g.effects = g.effects.filter((f) => f.life > 0);
  g.skyClock -= dt;
  if (g.skyClock <= 0) {
    addSun(g, LAWN_X + random(g) * COLS * CELL_W, 120, true);
    g.skyClock = g.info.skyPeriod;
  }
  for (const s of g.suns) {
    s.age += dt;
    s.y = Math.min(s.targetY, s.y + dt * (s.fall ? 65 : 25));
    if (g.autoCollect && s.age > 0.7) collectSun(g, s.id);
  }
  g.suns = g.suns.filter((s) => s.age < 14);
  g.spawnClock -= dt;
  if (g.spawnClock <= 0 && g.spawned < g.info.count) {
    spawn(g);
    g.spawnClock = g.info.spawnPeriod * (g.spawned % 7 === 0 ? 0.5 : 1);
  }
  for (const p of g.plants) {
    if (p.hp <= 0) continue;
    p.age += dt;
    p.timer -= dt;
    p.digest = Math.max(0, p.digest - dt);
    p.flash = Math.max(0, p.flash - dt);
    const data = plantInfo(p.kind),
      targets = g.zombies.filter((z) => !z.dead && z.row === p.row && z.x >= p.x - 15),
      nearest = targets.sort((a, b) => a.x - b.x)[0];
    if (p.kind === 'sunflower' && p.timer <= 0) {
      addSun(g, p.x, p.y - 40);
      p.timer = 12;
    }
    if (p.kind === 'cherrybomb' && p.age > 0.8) {
      explosion(g, p, 155, 1800);
      p.hp = 0;
    }
    if (p.kind === 'potatomine' && p.age > 10 && nearest && nearest.x - p.x < 32) {
      explosion(g, p, 102, 1800);
      p.hp = 0;
    }
    if (p.kind === 'squash' && nearest && nearest.x - p.x < 75) {
      effect(g, 'squash', nearest.x, nearest.y, { duration: 0.6 });
      for (const z of targets) if (Math.abs(z.x - nearest.x) < 35) hit(g, z, 1800, 'bomb');
      p.hp = 0;
    }
    if (p.kind === 'chomper' && p.digest <= 0 && nearest && nearest.x - p.x < 70) {
      hit(g, nearest, nearest.kind === 'gargantuar' ? 450 : nearest.maxHp + 1, 'bite');
      p.digest = 12;
      g.events.push({ type: 'bite' });
    }
    if (
      data.damage &&
      p.timer <= 0 &&
      nearest &&
      !(p.kind === 'puffshroom' && !g.info.theme.night) &&
      !(p.kind === 'puffshroom' && nearest.x - p.x > 3 * CELL_W)
    ) {
      const type =
        p.kind === 'snowpea'
          ? 'ice'
          : p.kind === 'cabbage'
            ? 'cabbage'
            : p.kind === 'puffshroom'
              ? 'spore'
              : 'pea';
      shoot(g, p, type, data.damage);
      if (p.kind === 'repeater') {
        shoot(g, p, type, data.damage);
        g.bullets.at(-1).x -= 24;
      }
      p.timer = data.period;
    }
  }
  for (const b of g.bullets) {
    b.life -= dt;
    const old = b.x;
    b.x += dt * (b.kind === 'cabbage' ? 330 : 430);
    const z = g.zombies
      .filter((z) => !z.dead && z.row === b.row && z.x + 19 >= old && z.x - 19 <= b.x)
      .sort((a, b) => a.x - b.x)[0];
    if (z) {
      hit(g, z, b.damage, b.kind);
      b.life = 0;
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0 && b.x < 1080);
  for (const z of g.zombies) {
    if (z.dead) continue;
    z.slow = Math.max(0, z.slow - dt);
    z.flash = Math.max(0, z.flash - dt);
    const p =
      g.plants
        .filter((p) => p.hp > 0 && p.row === z.row && z.x - p.x < 40 && z.x - p.x > -25)
        .sort((a, b) => b.x - a.x)[0] ||
      g.bases.find((p) => p.hp > 0 && p.row === z.row && z.x - p.x < 30 && z.x - p.x > -25);
    z.eating = Boolean(p);
    if (p) {
      z.attack -= dt;
      if (z.attack <= 0) {
        z.attack = 0.7;
        p.hp -= z.damage * 0.7;
        p.flash = 0.12;
        g.events.push({ type: 'bite' });
      }
    } else z.x -= z.speed * (z.slow > 0 ? 0.45 : 1) * (z.enraged ? 2.2 : 1) * dt;
    const mower = g.mowers[z.row];
    if (z.x < 112 && mower.status === 'ready') {
      mower.status = 'active';
      g.events.push({ type: 'mower' });
    }
    if (z.x < 70 && mower.status === 'used') {
      g.status = 'lost';
      g.events.push({ type: 'lost' });
      return;
    }
  }
  for (const m of g.mowers)
    if (m.status === 'active') {
      const old = m.x;
      m.x += dt * 620;
      for (const z of g.zombies)
        if (!z.dead && z.row === m.row && z.x >= old - 45 && z.x < m.x + 45)
          hit(g, z, z.maxHp + 1, 'mower');
      if (m.x > 1120) m.status = 'used';
    }
  g.zombies = g.zombies.filter((z) => !z.dead);
  g.plants = g.plants.filter((p) => p.hp > 0);
  g.bases = g.bases.filter((p) => p.hp > 0);
  if (g.spawned === g.info.count && !g.zombies.length) {
    g.status = 'won';
    g.events.push({ type: 'won' });
  }
  if (g.events.length > 80) g.events.splice(0, g.events.length - 80);
}
