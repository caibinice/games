// Battle City adaptation. Upstream MIT: assets/battle-city-license.html

// games/tank/src/vendor/engine/constants.ts
var frame = (n) => 1e3 / 60 * n;
var BLOCK_SIZE = 16;
var TANK_SIZE = BLOCK_SIZE;
var FIELD_BLOCK_SIZE = 13;
var FIELD_SIZE = BLOCK_SIZE * FIELD_BLOCK_SIZE;
var BULLET_SIZE = 3;
var STEEL_POWER = 3;
var SCREEN_WIDTH = 16 * BLOCK_SIZE;
var SCREEN_HEIGHT = 15 * BLOCK_SIZE;
var TANK_KILL_SCORE_MAP = {
  basic: 100,
  fast: 200,
  power: 300,
  armor: 400
};
var ITEM_SIZE_MAP = {
  BRICK: 4,
  STEEL: 8,
  RIVER: BLOCK_SIZE,
  SNOW: BLOCK_SIZE,
  FOREST: BLOCK_SIZE
};
var N_MAP = {
  BRICK: FIELD_SIZE / ITEM_SIZE_MAP.BRICK,
  // 52
  STEEL: FIELD_SIZE / ITEM_SIZE_MAP.STEEL,
  // 26
  RIVER: FIELD_SIZE / ITEM_SIZE_MAP.RIVER,
  // 13
  SNOW: FIELD_SIZE / ITEM_SIZE_MAP.SNOW,
  // 13
  FOREST: FIELD_SIZE / ITEM_SIZE_MAP.FOREST
  // 13
};
var TANK_LEVELS = ["basic", "fast", "power", "armor"];
var PLAYER_SPAWN_POS = {
  player1: { x: 4 * BLOCK_SIZE, y: 12 * BLOCK_SIZE },
  player2: { x: 8 * BLOCK_SIZE, y: 12 * BLOCK_SIZE }
};
var LIFE_BONUS_SCORE = 1e4;
var BOT_SPAWN_X = [6 * BLOCK_SIZE, 12 * BLOCK_SIZE, 0];
var POWER_UP_BOT_INDICES = [3, 10, 17];
var MAX_BOT_ON_FIELD = { single: 4, multi: 6 };
function botSpawnInterval(stageNumber, multi) {
  return frame(190 - 4 * Math.min(stageNumber, 35) - (multi ? 20 : 0));
}
var BOT_FLICKER_DURATION = frame(56);
var SCORE_POPUP_DURATION = frame(48);
var POWER_UP_SCORE = 500;
var INITIAL_LIVES = 3;
var SPAWN_HELMET_DURATION = frame(135);
var AUTOPILOT_START = 2e3;
var AUTOPILOT_IDLE = 5e3;
var BLOCK_TIMEOUT = 200;
var BLOCK_DISTANCE_THRESHOLD = 0.01;
var STAR_ARMOR_SCORE = 5e3;
var TIMER_FREEZE_TICKS = 10;
var TIMER_FREEZE_TICK = frame(64);
var SNOW_SLIDE_START = 16;
var SNOW_SLIDE_LOCK = 8;
var HELMET_POWERUP_DURATION = frame(630);
var SHOVEL_STEEL_DURATION = frame(1076);
var SHOVEL_BLINK_INTERVAL = frame(16);
var SHOVEL_BLINK_TIMES = 6;

// games/tank/src/vendor/engine/entities/Tank.ts
var nextTankId = 1;
var Tank = class {
  tankId;
  side;
  level;
  color;
  x;
  y;
  direction;
  /** 是否在本帧发生平移（驱动履带动画） */
  moving = false;
  hp;
  alive = true;
  /** 转向预留坐标：沿当前移动轴吸附到 8 的倍数后的落点，供垂直转向时对齐使用 */
  rx;
  ry;
  /** 冰面剩余滑行量（px），只有玩家坦克使用；离开冰面时保留，回到冰面继续生效 */
  slide = 0;
  /** >0 表示被冻结（队友命中/timer），需等待若干 ms 才能再移动；转向不受影响 */
  frozenTimeout = 0;
  /** >0 表示开火冷却中 */
  cooldown = 0;
  /** Site adapter: optional player-only rapid-fire assist; default remains classic. */
  rapidFire = false;
  /** >0 表示处于无敌头盔保护中（ms） */
  helmetDuration = 0;
  /** 是否可见（被队友击中冻结时闪烁） */
  visible = true;
  /** 该 bot 是否携带道具（被击中时掉落） */
  withPowerUp = false;
  /** 进入战场的场景时间（出生闪烁结束时），bot 变色动画以此为起点 */
  bornAt = 0;
  constructor(init) {
    this.tankId = nextTankId++;
    this.side = init.side;
    this.level = init.level ?? "basic";
    this.color = init.color ?? (init.side === "player" ? "yellow" : "silver");
    this.direction = init.direction ?? "up";
    this.x = init.x;
    this.y = init.y;
    this.rx = init.x;
    this.ry = init.y;
    this.hp = init.hp ?? 1;
    this.helmetDuration = init.helmetDuration ?? 0;
    this.withPowerUp = init.withPowerUp ?? false;
  }
  rect() {
    return { x: this.x, y: this.y, width: TANK_SIZE, height: TANK_SIZE };
  }
};

// games/tank/src/vendor/engine/entities/Explosion.ts
var nextExplosionId = 1;
var SMALL_TIMELINE = [
  { shape: "s0", duration: frame(4) },
  { shape: "s1", duration: frame(3) },
  { shape: "s2", duration: frame(2) }
];
var BIG_TIMELINE = [
  { shape: "s0", duration: frame(7) },
  { shape: "s1", duration: frame(5) },
  { shape: "s2", duration: frame(7) },
  { shape: "b0", duration: frame(5) },
  { shape: "b1", duration: frame(7) },
  { shape: "s2", duration: frame(5) }
];
var BIG_EXPLOSION_DURATION = BIG_TIMELINE.reduce((sum, f) => sum + f.duration, 0);
var Explosion = class {
  id;
  cx;
  cy;
  kind;
  elapsed = 0;
  done = false;
  constructor(center, kind) {
    this.id = nextExplosionId++;
    this.cx = center.x;
    this.cy = center.y;
    this.kind = kind;
  }
  get timeline() {
    return this.kind === "big" ? BIG_TIMELINE : SMALL_TIMELINE;
  }
  /** 当前应显示的形状 */
  shape() {
    let acc = 0;
    for (const frame2 of this.timeline) {
      acc += frame2.duration;
      if (this.elapsed < acc) {
        return frame2.shape;
      }
    }
    return this.timeline[this.timeline.length - 1].shape;
  }
  advance(delta) {
    this.elapsed += delta;
    const total = this.timeline.reduce((sum, f) => sum + f.duration, 0);
    if (this.elapsed >= total) {
      this.done = true;
    }
  }
};

// games/tank/src/vendor/engine/entities/Flicker.ts
var TIMELINE = [
  { shape: 3, frames: 3 },
  { shape: 2, frames: 3 },
  { shape: 1, frames: 3 },
  { shape: 0, frames: 3 },
  { shape: 1, frames: 3 },
  { shape: 2, frames: 3 },
  { shape: 3, frames: 3 },
  { shape: 2, frames: 3 },
  { shape: 1, frames: 3 },
  { shape: 0, frames: 3 },
  { shape: 1, frames: 3 },
  { shape: 2, frames: 3 },
  { shape: 3, frames: 1 }
];
var FLICKER_DURATION = TIMELINE.reduce((sum, item) => sum + frame(item.frames), 0);
var nextFlickerId = 1;
var Flicker = class {
  id;
  tank;
  /** 播放速度倍率，bot 出生按 BOT_FLICKER_DURATION 换算 */
  speed;
  elapsed = 0;
  done = false;
  constructor(tank, speed = 1) {
    this.id = nextFlickerId++;
    this.tank = tank;
    this.speed = speed;
  }
  get x() {
    return this.tank.x;
  }
  get y() {
    return this.tank.y;
  }
  shape() {
    let acc = 0;
    for (const item of TIMELINE) {
      acc += frame(item.frames) / this.speed;
      if (this.elapsed < acc) {
        return item.shape;
      }
    }
    return TIMELINE[TIMELINE.length - 1].shape;
  }
  advance(delta) {
    this.elapsed += delta;
    if (this.elapsed >= FLICKER_DURATION / this.speed) {
      this.done = true;
    }
  }
  rect() {
    return { x: this.x, y: this.y, width: TANK_SIZE, height: TANK_SIZE };
  }
};

// games/tank/src/vendor/engine/entities/PowerUp.ts
var nextPowerUpId = 1;
var PowerUp = class {
  id;
  name;
  x;
  y;
  visible = true;
  /** 闪烁计时（每 8 帧切换可见性） */
  blinkTimer = 0;
  dead = false;
  constructor(name, x, y) {
    this.id = nextPowerUpId++;
    this.name = name;
    this.x = x;
    this.y = y;
  }
  /** 拾取碰撞框：居中 8×8 */
  rect() {
    return { x: this.x + BLOCK_SIZE / 4, y: this.y + BLOCK_SIZE / 4, width: 8, height: 8 };
  }
};

// games/tank/src/vendor/engine/entities/ScorePopup.ts
var nextScorePopupId = 1;
var ScorePopup = class {
  id;
  score;
  x;
  y;
  /** 击杀分数要等爆炸播完才出现（旧版 destroyTank 先 explosion 再 score） */
  delay;
  remaining = SCORE_POPUP_DURATION;
  done = false;
  constructor(score, x, y, delay = 0) {
    this.id = nextScorePopupId++;
    this.score = score;
    this.x = x;
    this.y = y;
    this.delay = delay;
  }
  get visible() {
    return this.delay <= 0;
  }
  advance(delta) {
    if (this.delay > 0) {
      this.delay -= delta;
      return;
    }
    this.remaining -= delta;
    if (this.remaining <= 0) {
      this.done = true;
    }
  }
};

// games/tank/src/vendor/engine/physics/geometry.ts
function between(min, value, max, threshold = 0) {
  return min - threshold <= value && value <= max + threshold;
}
function testCollide(a, b, threshold = 0) {
  return between(a.x - b.width, b.x, a.x + a.width, threshold) && between(a.y - b.height, b.y, a.y + a.height, threshold);
}
function isInField(rect) {
  return between(0, rect.x, FIELD_SIZE - rect.width) && between(0, rect.y, FIELD_SIZE - rect.height);
}
var round8 = (x) => Math.round(x / 8) * 8;
var floor8 = (x) => Math.floor(x / 8) * 8;
var ceil8 = (x) => Math.ceil(x / 8) * 8;
function isPerpendicular(d1, d2) {
  const v1 = d1 === "up" || d1 === "down";
  const v2 = d2 === "up" || d2 === "down";
  return v1 !== v2;
}
function getDirectionInfo(direction) {
  switch (direction) {
    case "up":
      return { axis: "y", delta: -1 };
    case "down":
      return { axis: "y", delta: 1 };
    case "left":
      return { axis: "x", delta: -1 };
    case "right":
      return { axis: "x", delta: 1 };
  }
}

// games/tank/src/vendor/engine/values.ts
function moveSpeed(tank) {
  if (tank.side === "player") {
    return 0.045;
  }
  return tank.level === "fast" ? 0.06 : 0.03;
}
function bulletSpeed(tank) {
  if (tank.side === "player") {
    return tank.level === "basic" ? 0.12 : 0.18;
  }
  if (tank.level === "basic") {
    return 0.12;
  } else if (tank.level === "power") {
    return 0.24;
  } else {
    return 0.18;
  }
}
function bulletPower(tank) {
  if (tank.side === "player" && tank.level === "armor") {
    return 3;
  } else if (tank.side === "bot" && tank.level === "power") {
    return 2;
  } else {
    return 1;
  }
}
function bulletInterval(tank) {
  return tank.level === "basic" ? 300 : 200;
}
function bulletLimit(tank) {
  if (tank.side === "bot" || tank.level === "basic" || tank.level === "fast") {
    return 1;
  } else {
    return 2;
  }
}

// games/tank/src/vendor/engine/ai/lane.ts
var FRIENDLY_MARGIN = 2;
var BULLET_OFFSET = 6;
var BULLET_WIDTH = 3;
var EPS = 0.01;
function laneRect(pos, direction, from, to, margin) {
  const across = BULLET_OFFSET - margin;
  const width = BULLET_WIDTH + 2 * margin;
  const length = to - from - 2 * EPS;
  switch (direction) {
    case "up":
      return { x: pos.x + across, y: pos.y - to + EPS, width, height: length };
    case "down":
      return { x: pos.x + across, y: pos.y + TANK_SIZE + from + EPS, width, height: length };
    case "left":
      return { x: pos.x - to + EPS, y: pos.y + across, width: length, height: width };
    case "right":
      return { x: pos.x + TANK_SIZE + from + EPS, y: pos.y + across, width: length, height: width };
  }
}
function distanceTo(pos, direction, rect) {
  switch (direction) {
    case "up":
      return pos.y - (rect.y + rect.height);
    case "down":
      return rect.y - (pos.y + TANK_SIZE);
    case "left":
      return pos.x - (rect.x + rect.width);
    case "right":
      return rect.x - (pos.x + TANK_SIZE);
  }
}
function edgeDistance(pos, direction) {
  switch (direction) {
    case "up":
      return pos.y;
    case "down":
      return FIELD_SIZE - pos.y - TANK_SIZE;
    case "left":
      return pos.x;
    case "right":
      return FIELD_SIZE - pos.x - TANK_SIZE;
  }
}
function eagleGuard(map) {
  if (map.eagle == null) {
    return null;
  }
  const ring = BLOCK_SIZE / 2;
  return {
    x: map.eagle.x - ring,
    y: map.eagle.y - ring,
    width: BLOCK_SIZE + 2 * ring,
    height: BLOCK_SIZE + 2 * ring
  };
}
function brickInFront(map, pos, direction) {
  const rect = laneRect(pos, direction, 0, ITEM_SIZE_MAP.BRICK, 0);
  if (map.brickIndicesIn(rect).length === 0) {
    return false;
  }
  const guard = eagleGuard(map);
  return guard == null || !testCollide(guard, rect, -EPS);
}
function openLane(map, pos, direction, max) {
  const limit = Math.min(max, edgeDistance(pos, direction));
  let to = 0;
  while (to < limit) {
    const next = Math.min(to + ITEM_SIZE_MAP.BRICK, limit);
    const rect = laneRect(pos, direction, to, next, 0);
    if (map.steelIndicesIn(rect).length > 0 || map.brickIndicesIn(rect).length > 0) break;
    to = next;
  }
  return to > 0 ? laneRect(pos, direction, 0, to, 0) : null;
}
function shouldDig(map, tank) {
  const { axis, delta } = getDirectionInfo(tank.direction);
  const rect = tank.rect();
  rect[axis] += delta;
  return map.collideBrick(rect, -EPS) && brickInFront(map, tank, tank.direction);
}
function scanLane(map, tanks, self, pos, direction) {
  let hit = { kind: "edge", distance: edgeDistance(pos, direction) };
  const consider = (kind, rect, margin) => {
    const lane = laneRect(pos, direction, 0, hit.distance, margin);
    if (hit.distance > 0 && testCollide(lane, rect, -EPS)) {
      const distance = Math.max(0, distanceTo(pos, direction, rect));
      if (distance < hit.distance) {
        hit = { kind, distance };
      }
    }
  };
  for (const tank of tanks) {
    if (tank !== self && tank.alive) {
      const friendly = tank.side === "player";
      consider(friendly ? "player" : "bot", tank.rect(), friendly ? FRIENDLY_MARGIN : 0);
    }
  }
  if (map.eagle != null) {
    const eagle = { x: map.eagle.x, y: map.eagle.y, width: BLOCK_SIZE, height: BLOCK_SIZE };
    consider("eagle", eagle, FRIENDLY_MARGIN);
  }
  const guard = eagleGuard(map);
  const layer = ITEM_SIZE_MAP.BRICK;
  let bricks = 0;
  for (let from = 0; from < hit.distance; from += layer) {
    const rect = laneRect(pos, direction, from, Math.min(from + layer, hit.distance), 0);
    if (map.steelIndicesIn(rect).length > 0) {
      return { hit: { kind: "steel", distance: from }, bricks };
    }
    if (map.brickIndicesIn(rect).length > 0) {
      if (guard != null && testCollide(guard, rect, -EPS)) {
        return { hit: { kind: "eagle", distance: from }, bricks };
      }
      bricks += 1;
    }
  }
  return { hit, bricks };
}

// games/tank/src/vendor/engine/ai/spots.ts
var N = 26;
var getRow = (t) => Math.floor(t / N);
var getCol = (t) => t % N;
var left = (t) => getCol(t) === 0 ? null : t - 1;
var right = (t) => getCol(t) === N - 1 ? null : t + 1;
var up = (t) => getRow(t) === 0 ? null : t - N;
var down = (t) => getRow(t) === N - 1 ? null : t + N;
var dirs = [left, right, up, down];
function around(t) {
  return [
    up(t),
    left(t) != null ? up(left(t)) : null,
    left(t),
    left(t) != null ? down(left(t)) : null,
    down(t),
    right(t) != null ? down(right(t)) : null,
    right(t),
    up(t) != null ? right(up(t)) : null
  ].filter((x) => x != null);
}
function getTankSpot(point) {
  const col = Math.round((point.x + 8) / 8);
  const row = Math.round((point.y + 8) / 8);
  return row * N + col;
}
function spotToTankPos(t) {
  return { x: getCol(t) * 8 - 8, y: getRow(t) * 8 - 8 };
}
var PASS_THRESHOLD = -0.01;
function buildSpots(map) {
  const spots = new Array(N * N);
  for (let row = 0; row < N; row += 1) {
    for (let col = 0; col < N; col += 1) {
      const t = row * N + col;
      if (row === 0 || col === 0) {
        spots[t] = { t, canPass: false };
        continue;
      }
      const rect = { x: col * 8 - 8, y: row * 8 - 8, width: 16, height: 16 };
      const blocked = map.collideBrick(rect, PASS_THRESHOLD) || map.collideSteel(rect, PASS_THRESHOLD) || map.collideRiver(rect, PASS_THRESHOLD);
      spots[t] = { t, canPass: !blocked };
    }
  }
  return spots;
}

// games/tank/src/vendor/engine/ai/dig-path.ts
var BRICK_LAYER_COST = 2;
var EPS2 = 0.01;
function tankRect(t) {
  return { ...spotToTankPos(t), width: BLOCK_SIZE, height: BLOCK_SIZE };
}
function shrink(rect) {
  return {
    x: rect.x + EPS2,
    y: rect.y + EPS2,
    width: rect.width - 2 * EPS2,
    height: rect.height - 2 * EPS2
  };
}
function diggable(map, t) {
  if (getRow(t) === 0 || getCol(t) === 0) return false;
  const rect = shrink(tankRect(t));
  if (map.steelIndicesIn(rect).length > 0 || map.collideRiver(rect, -EPS2)) return false;
  if (map.eagle != null) {
    const eagle = { ...map.eagle, width: BLOCK_SIZE, height: BLOCK_SIZE };
    if (testCollide(eagle, rect, -EPS2)) return false;
  }
  return true;
}
function hasBricks(map, t) {
  return map.brickIndicesIn(shrink(tankRect(t))).length > 0;
}
function layersToDig(map, guard, u, v) {
  const p = spotToTankPos(u);
  const depth = ITEM_SIZE_MAP.BRICK;
  let count = 0;
  for (let i = 0; i < 2; i += 1) {
    let layer;
    let band;
    if (v === u - N || v === u + N) {
      const y = v === u - N ? p.y - 8 + i * depth : p.y + 16 + i * depth;
      layer = { x: p.x, y, width: BLOCK_SIZE, height: depth };
      band = { x: p.x + BULLET_OFFSET, y, width: BULLET_WIDTH, height: depth };
    } else {
      const x = v === u - 1 ? p.x - 8 + i * depth : p.x + 16 + i * depth;
      layer = { x, y: p.y, width: depth, height: BLOCK_SIZE };
      band = { x, y: p.y + BULLET_OFFSET, width: depth, height: BULLET_WIDTH };
    }
    if (map.brickIndicesIn(shrink(layer)).length === 0) continue;
    if (guard != null && testCollide(guard, layer, -EPS2)) return Infinity;
    if (map.brickIndicesIn(shrink(band)).length === 0) return Infinity;
    count += 1;
  }
  return count;
}
function digDistances(map, start2, { layerCost = BRICK_LAYER_COST, avoid, extraCost } = {}) {
  const dist = new Float64Array(N * N).fill(Infinity);
  const prev = new Int32Array(N * N).fill(-1);
  const passable = new Int8Array(N * N).fill(-1);
  const canStand = (t) => {
    if (passable[t] === -1) passable[t] = diggable(map, t) && !avoid?.(t) ? 1 : 0;
    return passable[t] === 1;
  };
  const guard = eagleGuard(map);
  const heap = new MinHeap();
  dist[start2] = 0;
  heap.push(start2, 0);
  while (heap.size > 0) {
    const [u, d] = heap.pop();
    if (d > dist[u]) continue;
    for (const dir of dirs) {
      const v = dir(u);
      if (v == null || !canStand(v)) continue;
      const layers = layersToDig(map, guard, u, v);
      const cost = d + 1 + (layers === 0 ? 0 : layerCost * layers) + (extraCost?.(v) ?? 0);
      if (cost < dist[v]) {
        dist[v] = cost;
        prev[v] = u;
        heap.push(v, cost);
      }
    }
  }
  return { dist, prev };
}
function digPath(graph, end) {
  if (graph.dist[end] === Infinity) return null;
  const path = [end];
  while (graph.prev[path[0]] !== -1) {
    path.unshift(graph.prev[path[0]]);
  }
  return path;
}
var MinHeap = class {
  items = [];
  get size() {
    return this.items.length;
  }
  push(value, priority) {
    const items = this.items;
    items.push([value, priority]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (items[parent][1] <= items[i][1]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        const r = l + 1;
        let min = i;
        if (l < items.length && items[l][1] < items[min][1]) min = l;
        if (r < items.length && items[r][1] < items[min][1]) min = r;
        if (min === i) break;
        [items[min], items[i]] = [items[i], items[min]];
        i = min;
      }
    }
    return top;
  }
};

// games/tank/src/vendor/engine/ai/env.ts
var RelativePosition = class {
  dx;
  dy;
  absdx;
  absdy;
  constructor(subject, object) {
    this.dx = object.x - subject.x;
    this.dy = object.y - subject.y;
    this.absdx = Math.abs(this.dx);
    this.absdy = Math.abs(this.dy);
  }
  getPrimaryDirection() {
    if (this.absdx > this.absdy) {
      return this.dx > 0 ? "right" : "left";
    }
    return this.dy > 0 ? "down" : "up";
  }
  /** 沿某方向到达目标的前进距离 length 与垂直偏移 offset */
  getForwardInfo(direction) {
    switch (direction) {
      case "left":
        return { length: -this.dx, offset: this.absdy };
      case "right":
        return { length: this.dx, offset: this.absdy };
      case "up":
        return { length: -this.dy, offset: this.absdx };
      case "down":
        return { length: this.dy, offset: this.absdx };
    }
  }
};
var FireThreshold = {
  eagle(len) {
    if (len < 0) return 0.1;
    if (len <= 6 * BLOCK_SIZE) return 0.6;
    return 0;
  },
  playerTank(len) {
    if (len < 0) return 0.1;
    if (len <= 6 * BLOCK_SIZE) return 0.5;
    return 0;
  },
  destroyable(len) {
    return 0.6 - len / 300;
  },
  idle() {
    return 0.05;
  }
};
function movedTankRect(tank, axis, amount) {
  const shrink2 = 0.16;
  const base = {
    x: tank.x + shrink2,
    y: tank.y + shrink2,
    width: TANK_SIZE - 2 * shrink2,
    height: TANK_SIZE - 2 * shrink2
  };
  if (axis === "x") base.x += amount;
  else base.y += amount;
  return base;
}
function aheadLength(tank, direction, size, hasCell) {
  const { axis, delta } = getDirectionInfo(direction);
  for (let step2 = 1; step2 < 64; step2 += 1) {
    const rect = movedTankRect(tank, axis, delta * step2 * size);
    if (rect.x + rect.width <= 0 || rect.x >= FIELD_SIZE || rect.y + rect.height <= 0 || rect.y >= FIELD_SIZE) {
      return Infinity;
    }
    if (hasCell(rect)) {
      return (step2 - 1) * size;
    }
  }
  return Infinity;
}
function lookAhead(map, tank, direction) {
  const brickLen = aheadLength(
    tank,
    direction,
    ITEM_SIZE_MAP.BRICK,
    (r) => map.brickIndicesIn(r).length > 0
  );
  const steelLen = aheadLength(
    tank,
    direction,
    ITEM_SIZE_MAP.STEEL,
    (r) => map.steelIndicesIn(r).length > 0
  );
  const riverLen = aheadLength(
    tank,
    direction,
    ITEM_SIZE_MAP.RIVER,
    (r) => map.collideRiver(r, -0.02)
  );
  if (brickLen === Infinity && steelLen === Infinity && riverLen === Infinity) {
    let border;
    if (direction === "up") border = tank.y;
    else if (direction === "down") border = FIELD_SIZE - tank.y - TANK_SIZE;
    else if (direction === "left") border = tank.x;
    else border = FIELD_SIZE - tank.x - TANK_SIZE;
    return { type: "border", length: border };
  } else if (steelLen <= brickLen && steelLen <= riverLen) {
    return { type: "steel", length: steelLen };
  } else if (riverLen <= brickLen) {
    return { type: "river", length: riverLen };
  } else {
    return { type: "brick", length: brickLen };
  }
}
function getEnv(map, tanks, tank) {
  const eagle = map.eagle != null ? new RelativePosition(tank, map.eagle) : null;
  let nearest2 = null;
  let minDist = Infinity;
  for (const t of tanks) {
    if (t.side === "player" && t.alive) {
      const d = Math.abs(t.x - tank.x) + Math.abs(t.y - tank.y);
      if (d < minDist) {
        minDist = d;
        nearest2 = t;
      }
    }
  }
  const nearestPlayer = nearest2 != null ? new RelativePosition(tank, nearest2) : null;
  return {
    eagle,
    nearestPlayer,
    barrier: {
      up: lookAhead(map, tank, "up"),
      down: lookAhead(map, tank, "down"),
      left: lookAhead(map, tank, "left"),
      right: lookAhead(map, tank, "right")
    }
  };
}
function determineFire(tank, env, rand) {
  const random = rand();
  const ahead = env.barrier[tank.direction];
  if (ahead.type === "brick" && random < FireThreshold.destroyable(ahead.length)) {
    return true;
  }
  if (env.eagle != null) {
    const info = env.eagle.getForwardInfo(tank.direction);
    if (info.offset <= 8 && random < FireThreshold.eagle(info.length)) {
      return true;
    }
  }
  if (env.nearestPlayer != null) {
    const info = env.nearestPlayer.getForwardInfo(tank.direction);
    if (info.offset <= 8 && random < FireThreshold.playerTank(info.length)) {
      return true;
    }
  }
  return random < FireThreshold.idle();
}

// games/tank/src/vendor/engine/ai/fire-estimate.ts
function getAIFireCount(est) {
  return est.brickCount <= 3 ? 1 : 2;
}
function getFireResist(est) {
  return est.brickCount + est.steelCount * 100;
}
var e = 0.1;
function anySteel(map, r) {
  return map.steelIndicesIn(r).length > 0;
}
function anyBrick(map, r) {
  return map.brickIndicesIn(r).length > 0;
}
function getIdealFireEstMap(map, t) {
  const estMap = /* @__PURE__ */ new Map();
  estMap.set(t, { target: t, source: t, distance: 0, brickCount: 0, steelCount: 0 });
  for (const dir of [left, right, up, down]) {
    let lastPos = t;
    let cntPos = dir(lastPos);
    let brickCount = 0;
    let steelCount = 0;
    let distance = 8;
    while (cntPos != null) {
      const start2 = { x: getCol(lastPos) * 8, y: getRow(lastPos) * 8 };
      const end = { x: getCol(cntPos) * 8, y: getRow(cntPos) * 8 };
      let r1;
      let r2;
      if (dir === left) {
        r1 = { x: end.x + 4 + e, y: end.y - e, width: 4 - 2 * e, height: 2 * e };
        r2 = { x: end.x + e, y: end.y - e, width: 4 - 2 * e, height: 2 * e };
      } else if (dir === right) {
        r1 = { x: start2.x + e, y: start2.y - e, width: 4 - 2 * e, height: 2 * e };
        r2 = { x: start2.x + e + 4, y: start2.y - e, width: 4 - 2 * e, height: 2 * e };
      } else if (dir === up) {
        r1 = { x: end.x - e, y: end.y + e + 4, width: 2 * e, height: 4 - 2 * e };
        r2 = { x: end.x - e, y: end.y + e, width: 2 * e, height: 4 - 2 * e };
      } else {
        r1 = { x: start2.x - e, y: start2.y + e, width: 2 * e, height: 4 - 2 * e };
        r2 = { x: start2.x - e, y: start2.y + e + 4, width: 2 * e, height: 4 - 2 * e };
      }
      const collidedWithSteel = anySteel(map, r1) || anySteel(map, r2);
      if (collidedWithSteel) {
        steelCount += 1;
      } else {
        if (anyBrick(map, r1)) brickCount += 1;
        if (anyBrick(map, r2)) brickCount += 1;
      }
      estMap.set(cntPos, { source: cntPos, distance, target: t, brickCount, steelCount });
      lastPos = cntPos;
      cntPos = dir(cntPos);
      distance += 8;
    }
  }
  return estMap;
}
function mergeEstMap(a, b) {
  for (const [key, value] of b.entries()) {
    const cur = a.get(key);
    if (cur == null || getFireResist(cur) < getFireResist(value)) {
      a.set(key, value);
    }
  }
  return a;
}
function calculateFireEstimateMap(weakSpots, map) {
  return weakSpots.map((s) => getIdealFireEstMap(map, s)).reduce((acc, m) => mergeEstMap(acc, m), /* @__PURE__ */ new Map());
}

// games/tank/src/vendor/engine/ai/path-follower.ts
var REACH_EPS = 0.01;
var PathFollower = class {
  path = [];
  pathIndex = 0;
  turning = false;
  segDir = "down";
  segAxis = "y";
  segSign = 1;
  segTarget = 0;
  /** 路径已走完 */
  done = true;
  blockAcc = 0;
  lastX = 0;
  lastY = 0;
  /** 已朝向本段方向、还没走到头时返回这个方向：这时前方挡路的东西就在路线上 */
  advancing(tank) {
    if (this.done || this.turning || tank.direction !== this.segDir) {
      return null;
    }
    const ahead = (this.segTarget - tank[this.segAxis]) * this.segSign;
    return ahead > REACH_EPS ? this.segDir : null;
  }
  /** 本段要走的方向，可能还没转过去；路径走完为 null */
  heading() {
    return this.done ? null : this.segDir;
  }
  /** path 为 null 或少于 2 个点时返回 false，由调用方决定等待还是换目标 */
  begin(tank, path) {
    if (path == null || path.length < 2) {
      return false;
    }
    this.path = path;
    this.pathIndex = Math.max(0, path.indexOf(getTankSpot(tank)));
    this.blockAcc = 0;
    this.lastX = tank.x;
    this.lastY = tank.y;
    this.nextSegment(tank);
    return true;
  }
  /** 本 tick 的移动意图；连续 BLOCK_TIMEOUT 没有位移（冻结除外）返回 blocked */
  step(tank, delta) {
    if (this.detectBlocked(tank, delta)) {
      return { move: null, status: "blocked" };
    }
    if (this.turning || tank.direction !== this.segDir) {
      this.turning = false;
      return { move: { type: "turn", direction: this.segDir }, status: "moving" };
    }
    const ahead = (this.segTarget - tank[this.segAxis]) * this.segSign;
    if (ahead <= REACH_EPS) {
      this.nextSegment(tank);
      return { move: null, status: this.done ? "arrived" : "moving" };
    }
    return { move: { type: "forward", maxDistance: ahead }, status: "moving" };
  }
  nextSegment(tank) {
    if (this.pathIndex >= this.path.length - 1) {
      this.done = true;
      return;
    }
    const deltaStep = this.path[this.pathIndex + 1] - this.path[this.pathIndex];
    let step2 = 1;
    while (this.pathIndex + step2 + 1 < this.path.length && this.path[this.pathIndex + step2 + 1] - this.path[this.pathIndex + step2] === deltaStep) {
      step2 += 1;
    }
    this.pathIndex += step2;
    const targetPos = spotToTankPos(this.path[this.pathIndex]);
    this.segDir = new RelativePosition(tank, targetPos).getPrimaryDirection();
    const { axis, delta } = getDirectionInfo(this.segDir);
    this.segAxis = axis;
    this.segSign = delta;
    this.segTarget = targetPos[axis];
    this.turning = true;
    this.done = false;
  }
  detectBlocked(tank, delta) {
    let blocked = false;
    if (tank.frozenTimeout > 0) {
      this.blockAcc = 0;
    } else {
      const moved = Math.abs(tank.x - this.lastX) + Math.abs(tank.y - this.lastY);
      this.blockAcc = moved <= BLOCK_DISTANCE_THRESHOLD ? this.blockAcc + delta : 0;
      if (this.blockAcc >= BLOCK_TIMEOUT) {
        this.blockAcc = 0;
        blocked = true;
      }
    }
    this.lastX = tank.x;
    this.lastY = tank.y;
    return blocked;
  }
};

// games/tank/src/vendor/engine/ai/pathfinding.ts
function findPath(spots, start2, target, calculateScore = (step2) => step2) {
  const stop = typeof target === "number" ? (s) => s.t === target : target;
  const pre = new Array(spots.length).fill(-1);
  const distance = new Array(spots.length).fill(Infinity);
  let end = -1;
  let minScore = Infinity;
  let step2 = 0;
  let frontier = /* @__PURE__ */ new Set([start2]);
  while (frontier.size > 0) {
    step2 += 1;
    const next = /* @__PURE__ */ new Set();
    for (const u of frontier) {
      const spot = spots[u];
      if (!spot.canPass) {
        continue;
      }
      distance[u] = step2;
      if (stop(spot)) {
        const score = calculateScore(step2, spot);
        if (score < minScore) {
          minScore = score;
          end = u;
        }
      }
      for (const dir of dirs) {
        const v = dir(u);
        if (v != null && distance[v] === Infinity) {
          next.add(v);
          pre[v] = u;
        }
      }
    }
    frontier = next;
  }
  if (end === -1) {
    return null;
  }
  const path = [];
  let cur = end;
  while (true) {
    path.unshift(cur);
    if (cur === start2) {
      break;
    }
    cur = pre[cur];
  }
  return path;
}

// games/tank/src/vendor/engine/ai/bot-brain.ts
var DIG_LAYER_COST = 6;
var ATTACK_CHANCE = 0.2;
var ATTACK_RAMP = 6e4;
var AIM_RANGE = 6 * BLOCK_SIZE;
var AIM_CHANCE = 0.05;
var AIM_RAMP = 6e4;
var AIM_HOLD = 300;
var BASE_HIT_PENALTY = 3e3;
var DIRECTIONS = ["up", "down", "left", "right"];
function rampedChance(max, ramp, time) {
  return max * Math.min(1, time / ramp);
}
function randomPassableSpot(spots, random) {
  for (let i = 0; i < 1e3; i += 1) {
    const t = Math.floor(random() * spots.length);
    if (spots[t].canPass) {
      return t;
    }
  }
  return spots.findIndex((s) => s.canPass);
}
var BotBrain = class {
  phase = "planning";
  follower = new PathFollower();
  goalIsEagle = false;
  /** 当前路线要打砖 */
  digRoute = false;
  digging = false;
  fireTimer = 300;
  attackFireCount = 0;
  waitTimer = 0;
  /** 正在转身打的方向和剩余时间 */
  aimDirection = null;
  aimTimer = 0;
  /** 见 BASE_HIT_PENALTY */
  basePenalty = 0;
  /** 这辆 bot 的子弹打掉了老鹰外墙的砖或打中老鹰 */
  onBaseHit() {
    this.basePenalty = BASE_HIT_PENALTY;
  }
  move(tank, ctx, delta) {
    this.basePenalty = Math.max(0, this.basePenalty - delta);
    if (this.aimDirection != null) {
      this.aimTimer -= delta;
      if (this.aimTimer > 0) {
        return tank.direction === this.aimDirection ? null : { type: "turn", direction: this.aimDirection };
      }
      this.aimDirection = null;
    }
    switch (this.phase) {
      case "planning":
        this.plan(tank, ctx);
        return null;
      case "following": {
        this.digging = this.digRoute && this.follower.advancing(tank) != null && shouldDig(ctx.map, tank);
        if (this.digging) {
          return null;
        }
        const { move, status } = this.follower.step(tank, delta);
        if (status === "blocked") {
          this.plan(tank, ctx);
        } else if (status === "arrived") {
          this.arrive();
        }
        return move;
      }
      case "attackTurning":
        this.phase = "attackFiring";
        if (ctx.map.eagle == null) {
          return null;
        }
        return {
          type: "turn",
          direction: new RelativePosition(tank, ctx.map.eagle).getPrimaryDirection()
        };
      case "attackFiring":
        return null;
      case "waiting":
        this.waitTimer -= delta;
        if (this.waitTimer <= 0) {
          this.phase = "planning";
        }
        return null;
    }
  }
  fire(tank, ctx, delta) {
    return this.wantFire(tank, ctx, delta) && !(this.basePenalty > 0 && this.aimsAtBase(tank, ctx));
  }
  wantFire(tank, ctx, delta) {
    if (this.phase === "following" && this.digging) {
      return true;
    }
    if (this.aimDirection != null) {
      return tank.direction === this.aimDirection;
    }
    return this.phase === "attackFiring" ? this.attackFire(tank, ctx) : this.simpleFire(tank, ctx, delta);
  }
  plan(tank, ctx) {
    const start2 = getTankSpot(tank);
    const attack = ctx.random() < rampedChance(ATTACK_CHANCE, ATTACK_RAMP, ctx.time);
    if (attack && this.basePenalty <= 0 && ctx.map.eagle != null && !ctx.map.eagleBroken) {
      this.goalIsEagle = true;
      const eagleSpot = getTankSpot(ctx.map.eagle);
      const weakSpots = around(eagleSpot);
      const estMap = calculateFireEstimateMap(weakSpots, ctx.map);
      const candidates = [...estMap.keys()].filter(
        (t) => ctx.spots[t]?.canPass && getFireResist(estMap.get(t)) <= 8
      );
      if (candidates.length > 0) {
        const target = candidates[Math.floor(ctx.random() * candidates.length)];
        this.attackFireCount = getAIFireCount(estMap.get(target));
        const walk = findPath(ctx.spots, start2, target);
        const dig = digDistances(ctx.map, start2, { layerCost: DIG_LAYER_COST });
        this.digRoute = dig.dist[target] < (walk == null ? Infinity : walk.length - 1);
        this.beginPath(tank, this.digRoute ? digPath(dig, target) : walk);
        return;
      }
    }
    this.goalIsEagle = false;
    this.digRoute = false;
    const path = findPath(ctx.spots, start2, randomPassableSpot(ctx.spots, ctx.random));
    this.beginPath(tank, path);
  }
  beginPath(tank, path) {
    if (!this.follower.begin(tank, path)) {
      this.phase = "waiting";
      this.waitTimer = 200;
    } else if (this.follower.done) {
      this.arrive();
    } else {
      this.phase = "following";
    }
  }
  arrive() {
    this.phase = this.goalIsEagle ? "attackTurning" : "planning";
  }
  simpleFire(tank, ctx, delta) {
    this.fireTimer -= delta;
    if (this.fireTimer > 0) {
      return false;
    }
    this.fireTimer = bulletInterval(tank);
    const aim = this.phase === "following" ? this.sideTarget(tank, ctx) : null;
    if (aim != null && ctx.random() < rampedChance(AIM_CHANCE, AIM_RAMP, ctx.time)) {
      this.aimDirection = aim;
      this.aimTimer = AIM_HOLD;
      return false;
    }
    return determineFire(tank, getEnv(ctx.map, ctx.tanks, tank), ctx.random);
  }
  /** 炮口以外的方向上，AIM_RANGE 以内开火打得到的玩家所在方向 */
  sideTarget(tank, ctx) {
    for (const direction of DIRECTIONS) {
      if (direction === tank.direction) continue;
      const lane = openLane(ctx.map, tank, direction, AIM_RANGE);
      if (lane != null && ctx.tanks.some((t) => t.side === "player" && t.alive && testCollide(lane, t.rect(), -0.01))) {
        return direction;
      }
    }
    return null;
  }
  /** 这一枪打到的是老鹰外墙或老鹰；bot 子弹穿过 bot，所以只看玩家挡没挡着 */
  aimsAtBase(tank, ctx) {
    const players = ctx.tanks.filter((t) => t.side === "player");
    return scanLane(ctx.map, players, tank, tank, tank.direction).hit.kind === "eagle";
  }
  attackFire(tank, ctx) {
    if (this.attackFireCount <= 0 || this.basePenalty > 0) {
      this.phase = "planning";
      return false;
    }
    const active = ctx.bullets.filter((b) => b.tankId === tank.tankId && !b.dead).length;
    const canFire2 = tank.cooldown <= 0 && active < bulletLimit(tank);
    if (canFire2) {
      this.attackFireCount -= 1;
    }
    return canFire2;
  }
};

// games/tank/src/vendor/engine/ai/defense.ts
var MIN_SAVING = 12;
var MAX_ROUTE_COST = 24;
function toSpot(pos) {
  if (pos.x < 0 || pos.y < 0 || pos.x > FIELD_SIZE - BLOCK_SIZE || pos.y > FIELD_SIZE - BLOCK_SIZE) {
    return null;
  }
  return (pos.y + 8) / 8 * N + (pos.x + 8) / 8;
}
function interceptSpots(map) {
  const eagle = map.eagle;
  if (eagle == null) {
    return [];
  }
  const gap = 1.5 * BLOCK_SIZE;
  const shifts = [0, -8, 8];
  const sides = [
    shifts.map((d) => ({ x: eagle.x + d, y: eagle.y - gap })),
    shifts.map((d) => ({ x: eagle.x + d, y: eagle.y + gap })),
    shifts.map((d) => ({ x: eagle.x - gap, y: eagle.y + d })),
    shifts.map((d) => ({ x: eagle.x + gap, y: eagle.y + d }))
  ];
  const spots = [];
  for (const positions of sides) {
    const valid = positions.map(toSpot).filter((t) => t != null && diggable(map, t));
    const spot = valid.find((t) => !hasBricks(map, t)) ?? valid[0];
    if (spot != null) spots.push(spot);
  }
  return spots;
}
var cache = /* @__PURE__ */ new WeakMap();
function defenseRoutes(map) {
  const cached = cache.get(map);
  if (cached?.version === map.version) {
    return cached.routes;
  }
  const spots = interceptSpots(map);
  const routes = [];
  spots.forEach((a, i) => {
    const dig = digDistances(map, a);
    const walk = hasBricks(map, a) ? null : digDistances(map, a, { layerCost: Infinity });
    for (const b of spots.slice(i + 1)) {
      const walkDist = walk == null || hasBricks(map, b) ? Infinity : walk.dist[b];
      if (dig.dist[b] <= MAX_ROUTE_COST && walkDist - dig.dist[b] >= MIN_SAVING) {
        routes.push(digPath(dig, b));
      }
    }
  });
  cache.set(map, { version: map.version, routes });
  return routes;
}

// games/tank/src/vendor/engine/ai/eagle-threat.ts
var MAX_BRICKS = 3;
var HIT_OFFSET = 9;
var DIRECTIONS2 = ["up", "down", "left", "right"];
function eagleFireSpots(ctx) {
  const eagle = ctx.map.eagle;
  if (eagle == null || ctx.map.eagleBroken) return [];
  const result = [];
  for (let t = 0; t < N * N; t += 1) {
    if (!ctx.spots[t]?.canPass) continue;
    const pos = spotToTankPos(t);
    const rel = new RelativePosition(pos, eagle);
    const aims = DIRECTIONS2.some((direction) => {
      const { length, offset } = rel.getForwardInfo(direction);
      if (length <= 0 || offset > HIT_OFFSET) return false;
      const { hit, bricks } = scanLane(ctx.map, [], null, pos, direction);
      return hit.kind === "eagle" && bricks <= MAX_BRICKS;
    });
    if (aims) result.push(t);
  }
  return result;
}
function eagleReachSteps(ctx) {
  const dist = new Int32Array(N * N).fill(-1);
  let frontier = eagleFireSpots(ctx);
  for (const t of frontier) dist[t] = 0;
  let step2 = 0;
  while (frontier.length > 0) {
    step2 += 1;
    const next = [];
    for (const u of frontier) {
      for (const dir of dirs) {
        const v = dir(u);
        if (v == null || dist[v] !== -1 || !ctx.spots[v]?.canPass) continue;
        dist[v] = step2;
        next.push(v);
      }
    }
    frontier = next;
  }
  return dist;
}
function eagleReachTime(bot, steps) {
  const d = steps[getTankSpot(bot)];
  return d < 0 ? Infinity : d * 8 / moveSpeed(bot);
}

// games/tank/src/vendor/engine/ai/self-defense.ts
var THREAT_HORIZON = 600;
var AIM_RANGE2 = 6 * BLOCK_SIZE;
var DUEL_RANGE = 3 * BLOCK_SIZE;
var CROSS_RANGE = 3 * BLOCK_SIZE;
var EXPOSURE_COST = 1;
var EPS3 = 0.01;
var DIRECTIONS3 = ["up", "down", "left", "right"];
var OPPOSITE = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};
function shielded(map, bullet, from, to) {
  const between2 = getDirectionInfo(bullet.direction).axis === "x" ? { x: from, y: bullet.y, width: to - from, height: BULLET_SIZE } : { x: bullet.x, y: from, width: BULLET_SIZE, height: to - from };
  return map.collideBrick(between2, -EPS3) || map.collideSteel(between2, -EPS3);
}
function incomingBullet(tank, ctx) {
  let first = null;
  let firstTime = Infinity;
  for (const bullet of ctx.bullets) {
    if (bullet.dead || bullet.side !== "bot") continue;
    const { axis, delta } = getDirectionInfo(bullet.direction);
    const cross = axis === "x" ? "y" : "x";
    if (bullet[cross] + BULLET_SIZE <= tank[cross] || bullet[cross] >= tank[cross] + TANK_SIZE) {
      continue;
    }
    const [lo, hi] = delta > 0 ? [bullet[axis] + BULLET_SIZE, tank[axis]] : [tank[axis] + TANK_SIZE, bullet[axis]];
    const time = (hi - lo) / bullet.speed;
    if (hi < lo || time > THREAT_HORIZON || time >= firstTime) continue;
    if (shielded(ctx.map, bullet, lo, hi)) continue;
    first = bullet;
    firstTime = time;
  }
  return first;
}
function counterFire(tank, ctx, bullet) {
  const cross = getDirectionInfo(bullet.direction).axis === "x" ? "y" : "x";
  const face = OPPOSITE[bullet.direction];
  const after = isPerpendicular(face, tank.direction) ? { x: tank.rx, y: tank.ry } : tank;
  const own = ctx.bullets.filter((b) => b.tankId === tank.tankId && !b.dead).length;
  const ready = tank.cooldown <= 0 && own < bulletLimit(tank);
  if (!ready || Math.abs(bullet[cross] - (after[cross] + BULLET_OFFSET)) >= BULLET_SIZE) {
    return null;
  }
  return { move: tank.direction === face ? null : { type: "turn", direction: face } };
}
function stepsIntoBullet(tank, ctx) {
  const { axis: moveAxis, delta: sign } = getDirectionInfo(tank.direction);
  const speed = moveSpeed(tank);
  for (const bullet of ctx.bullets) {
    if (bullet.dead || bullet.side !== "bot") continue;
    const { axis, delta } = getDirectionInfo(bullet.direction);
    if (axis === moveAxis) continue;
    const gap = delta > 0 ? tank[axis] - (bullet[axis] + BULLET_SIZE) : bullet[axis] - (tank[axis] + TANK_SIZE);
    const leave = (gap + TANK_SIZE + BULLET_SIZE) / bullet.speed;
    const arrive = Math.max(0, gap / bullet.speed);
    if (leave < 0 || arrive > THREAT_HORIZON) continue;
    const lane = bullet[moveAxis];
    const c = tank[moveAxis];
    const enter = (sign > 0 ? lane - TANK_SIZE - c : c - lane - BULLET_SIZE) / speed;
    const exit = (sign > 0 ? lane + BULLET_SIZE - c : c + TANK_SIZE - lane) / speed;
    if (enter <= 0 || exit <= 0 || enter >= leave || arrive >= exit) continue;
    const [lo, hi] = delta > 0 ? [bullet[axis], tank[axis] + TANK_SIZE] : [tank[axis], bullet[axis]];
    if (shielded(ctx.map, bullet, lo, hi)) continue;
    return true;
  }
  return false;
}
function exposureCosts(ctx) {
  const costs = new Float64Array(N * N);
  for (const bot of ctx.tanks) {
    const lane = bot.side === "bot" ? aimLane(ctx, bot, AIM_RANGE2) : null;
    if (lane == null) continue;
    for (let t = 0; t < N * N; t += 1) {
      if (testCollide(lane, tankRectAt(spotToTankPos(t)), -EPS3)) costs[t] += EXPOSURE_COST * bot.hp;
    }
  }
  return costs;
}
function aimLane(ctx, bot, range) {
  if (!bot.alive || bot.frozenTimeout > 0) return null;
  return openLane(ctx.map, bot, bot.direction, range);
}
function avoidAim(tank, ctx) {
  const bots = ctx.tanks.filter((t) => t.side === "bot");
  const covers = (lane) => lane != null && testCollide(lane, tank.rect(), -EPS3);
  const close = bots.find((bot) => bot.hp > 1 && covers(aimLane(ctx, bot, DUEL_RANGE)));
  const out = close == null ? void 0 : sidestep(tank, ctx, close, "out");
  if (out !== void 0) return out;
  const cross = (bot) => getDirectionInfo(bot.direction).axis === "x" ? "y" : "x";
  const misaligned = bots.find(
    (bot) => covers(aimLane(ctx, bot, AIM_RANGE2)) && Math.abs(bot[cross(bot)] - tank[cross(bot)]) >= BULLET_SIZE
  );
  return misaligned == null ? void 0 : sidestep(tank, ctx, misaligned, "align");
}
function tankRectAt(pos) {
  return { x: pos.x, y: pos.y, width: TANK_SIZE, height: TANK_SIZE };
}
function canShift(tank, ctx, pos, cross, amount) {
  const swept = tankRectAt(pos);
  swept[cross === "x" ? "width" : "height"] += Math.abs(amount);
  if (amount < 0) swept[cross] += amount;
  if (swept.x < 0 || swept.y < 0 || swept.x + swept.width > FIELD_SIZE || swept.y + swept.height > FIELD_SIZE) {
    return false;
  }
  const { map } = ctx;
  if (map.collideBrick(swept, -EPS3) || map.collideSteel(swept, -EPS3) || map.collideRiver(swept, -EPS3) || map.eagle != null && testCollide(tankRectAt(map.eagle), swept, -EPS3)) {
    return false;
  }
  return !ctx.tanks.some((t) => t !== tank && t.alive && testCollide(t.rect(), swept, -EPS3));
}
function sidestep(tank, ctx, bot, mode) {
  const cross = getDirectionInfo(bot.direction).axis === "x" ? "y" : "x";
  let best = null;
  for (const direction of DIRECTIONS3) {
    const { axis, delta: sign } = getDirectionInfo(direction);
    if (axis !== cross) continue;
    const pos = isPerpendicular(direction, tank.direction) ? { x: tank.rx, y: tank.ry } : tank;
    const shift = mode === "align" ? (bot[cross] - pos[cross]) * sign : sign > 0 ? ceil8(bot[cross] + BULLET_OFFSET + BULLET_SIZE) - pos[cross] : pos[cross] - floor8(bot[cross] + BULLET_OFFSET - TANK_SIZE);
    if (shift < 0 || mode === "out" && shift === 0) continue;
    const cost = shift + (direction === tank.direction ? 0 : 1);
    if (best != null && cost >= best.cost) continue;
    if (shift > 0 && !canShift(tank, ctx, pos, cross, sign * shift)) continue;
    best = { direction, shift, cost };
  }
  if (best == null) return void 0;
  if (tank.direction !== best.direction) return { type: "turn", direction: best.direction };
  return best.shift > 0 ? { type: "forward", maxDistance: best.shift } : null;
}
function canFire(bot, ctx) {
  return bot.cooldown <= 0 && !ctx.bullets.some((b) => b.tankId === bot.tankId && !b.dead);
}
function holdBeforeAim(tank, ctx, direction) {
  const now = tank.rect();
  const lanes = [];
  for (const bot of ctx.tanks) {
    if (bot.side !== "bot" || !canFire(bot, ctx)) continue;
    const lane = aimLane(ctx, bot, CROSS_RANGE);
    if (lane != null && !testCollide(lane, now, -EPS3)) lanes.push(lane);
  }
  const inLane = (rect) => lanes.some((lane) => testCollide(lane, rect, -EPS3));
  const from = isPerpendicular(direction, tank.direction) ? { x: tank.rx, y: tank.ry } : tank;
  const { axis, delta: sign } = getDirectionInfo(direction);
  const next = sign > 0 ? floor8(from[axis]) + 8 : ceil8(from[axis]) - 8;
  const swept = tankRectAt(from);
  swept[axis === "x" ? "width" : "height"] += Math.abs(next - from[axis]);
  if (sign < 0) swept[axis] = next;
  if (!inLane(swept)) return void 0;
  const { axis: own, delta: facing } = getDirectionInfo(tank.direction);
  const coord = tank[own];
  if (Math.abs(coord - round8(coord)) < EPS3) return null;
  const targets = facing > 0 ? [ceil8(coord), floor8(coord)] : [floor8(coord), ceil8(coord)];
  for (const target of targets) {
    const pos = { x: tank.x, y: tank.y, [own]: target };
    if (inLane(tankRectAt(pos)) || !canShift(tank, ctx, tank, own, target - coord)) continue;
    return target === targets[0] ? { type: "forward", maxDistance: Math.abs(target - coord) } : { type: "turn", direction: OPPOSITE[tank.direction] };
  }
  return null;
}

// games/tank/src/vendor/engine/ai/teammate-brain.ts
var REPLAN_INTERVAL = 300;
var EAGLE_THREAT_TIME = 4e3;
var MAX_FIRE_THROUGH_BRICK = 6 * BLOCK_SIZE;
var ALIGN_TOLERANCE = 4;
var DANGER_BONUS = 40;
var POWER_UP_BONUS = { eager: 60, withHuman: 10 };
var OPEN_DEFENSE_BONUS = 30;
var SIDE_PENALTY = 5;
var GUARD_OFFSET_COST = 4;
var MAX_AIM_WAIT = 1e3;
var AVOID_DURATION = 2e3;
var STALL_LIMIT = 1500;
var BAN_DURATION = 5e3;
var BAN_RADIUS = 2;
var DIRECTIONS4 = ["up", "down", "left", "right"];
function startSpot(map, tank) {
  const around2 = (v) => [
    Math.round((v + 8) / 8),
    Math.floor((v + 8) / 8),
    Math.ceil((v + 8) / 8)
  ];
  for (const row of around2(tank.y)) {
    for (const col of around2(tank.x)) {
      if (diggable(map, row * N + col)) return row * N + col;
    }
  }
  return null;
}
function tankRectAt2(t) {
  return { ...spotToTankPos(t), width: BLOCK_SIZE, height: BLOCK_SIZE };
}
function spotsOn(powerUp) {
  const spots = [];
  for (let t = 0; t < N * N; t += 1) {
    if (testCollide(powerUp.rect(), tankRectAt2(t), -0.5)) spots.push(t);
  }
  return spots;
}
function nearest(graph, spots) {
  return Math.min(...spots.map((t) => graph.dist[t]));
}
function sidePenalty(pos, side) {
  const center = pos.x + BLOCK_SIZE / 2 - FIELD_SIZE / 2;
  return side !== 0 && Math.sign(center) === -side ? SIDE_PENALTY : 0;
}
var TeammateBrain = class {
  follower = new PathFollower();
  goal = null;
  following = false;
  /** 已经在目标上，或者没有目标 */
  arrived = true;
  digging = false;
  /** 正在对射抵消来弹，或者被 bot 正对着在调整站位；完了要按新位置重新规划 */
  countering = false;
  evading = false;
  /** 等子弹从前面过去 */
  holding = false;
  /** 已经在 bot 射线前等了多久 */
  aimWait = 0;
  /** 上次规划时有 bot 很快就能打到老鹰 */
  eagleThreatened = false;
  replanTimer = 0;
  stall = 0;
  lastX = NaN;
  lastY = NaN;
  /** spot → 到这个时刻（ctx.time）之前不再选它当目标 */
  banned = /* @__PURE__ */ new Map();
  /** spot → 到这个时刻之前寻路不经过它 */
  avoided = /* @__PURE__ */ new Map();
  move(tank, ctx, delta) {
    this.watchStall(tank, ctx, delta);
    this.digging = false;
    this.holding = false;
    const threat = tank.helmetDuration > 0 ? null : incomingBullet(tank, ctx);
    const counter = threat == null ? null : counterFire(tank, ctx, threat);
    if (counter != null) {
      this.countering = true;
      return counter.move;
    }
    const evade = tank.helmetDuration > 0 ? void 0 : avoidAim(tank, ctx);
    if (evade !== void 0) {
      this.evading = true;
      return evade;
    }
    if (this.countering || this.evading) {
      this.countering = false;
      this.evading = false;
      this.following = false;
      this.replanTimer = 0;
    }
    this.replanTimer -= delta;
    if (this.replanTimer <= 0) {
      this.replanTimer = REPLAN_INTERVAL;
      this.plan(tank, ctx);
    }
    if (this.following) {
      if (this.follower.advancing(tank) != null && shouldDig(ctx.map, tank)) {
        this.digging = true;
        return null;
      }
      if (this.follower.advancing(tank) != null && stepsIntoBullet(tank, ctx)) {
        this.holding = true;
        return null;
      }
      const heading = this.follower.heading();
      const hold = heading == null || this.eagleThreatened ? void 0 : holdBeforeAim(tank, ctx, heading);
      if (hold === void 0) {
        this.aimWait = 0;
      } else if (this.aimWait < MAX_AIM_WAIT) {
        this.aimWait += delta;
        this.holding = true;
        return hold;
      }
      const { move, status } = this.follower.step(tank, delta);
      if (status === "blocked") {
        this.avoidAhead(tank, ctx);
        this.following = false;
        this.replanTimer = 0;
        return null;
      }
      if (status === "arrived") {
        this.following = false;
        this.arrived = true;
      }
      return move;
    }
    if (this.goal?.face != null && tank.direction !== this.goal.face) {
      return { type: "turn", direction: this.goal.face };
    }
    return null;
  }
  fire(tank, ctx) {
    if (this.digging || this.countering) {
      return true;
    }
    const { hit, bricks } = scanLane(ctx.map, ctx.tanks, tank, tank, tank.direction);
    return hit.kind === "bot" && (bricks === 0 || hit.distance <= MAX_FIRE_THROUGH_BRICK);
  }
  /** 被 bot、队友或打不到的砖堵住时 PathFollower 会一直重试同一条路，这里负责换目标 */
  watchStall(tank, ctx, delta) {
    const moved = tank.x !== this.lastX || tank.y !== this.lastY;
    this.lastX = tank.x;
    this.lastY = tank.y;
    if (moved || this.arrived || this.digging || this.countering || this.evading || this.holding || tank.frozenTimeout > 0 || this.goal == null) {
      this.stall = 0;
      return;
    }
    this.stall += delta;
    if (this.stall >= STALL_LIMIT) {
      for (let dr = -BAN_RADIUS; dr <= BAN_RADIUS; dr += 1) {
        for (let dc = -BAN_RADIUS; dc <= BAN_RADIUS; dc += 1) {
          this.banned.set(this.goal.spot + dr * N + dc, ctx.time + BAN_DURATION);
        }
      }
      this.stall = 0;
      this.following = false;
      this.replanTimer = 0;
    }
  }
  /** 挡路的坦克占着的 spot 暂时不走；不是坦克挡路时（砖、钢的边角）就是正前方那一格 */
  avoidAhead(tank, ctx) {
    const { axis, delta } = getDirectionInfo(tank.direction);
    const front = tank.rect();
    if (delta > 0) front[axis] += BLOCK_SIZE;
    else front[axis] -= 1;
    if (axis === "x") front.width = 1;
    else front.height = 1;
    const blockers = ctx.tanks.filter((t) => t !== tank && t.alive && testCollide(t.rect(), front, -0.01)).map((t) => t.rect());
    const rects = blockers.length > 0 ? blockers : [front];
    for (let t = 0; t < N * N; t += 1) {
      if (rects.some((rect) => testCollide(rect, tankRectAt2(t), -0.01))) {
        this.avoided.set(t, ctx.time + AVOID_DURATION);
      }
    }
  }
  plan(tank, ctx) {
    const start2 = startSpot(ctx.map, tank);
    const goal = start2 == null ? null : this.chooseGoal(tank, ctx, start2);
    if (start2 == null || goal == null) {
      this.goal = null;
      this.following = false;
      this.arrived = true;
      return;
    }
    if (this.goal?.spot === goal.spot && this.following) {
      this.goal = goal;
      return;
    }
    this.goal = goal;
    const path = goal.route == null ? digPath(goal.graph, goal.spot) : [...digPath(goal.graph, goal.route[0]) ?? [], ...goal.route.slice(1)];
    this.following = goal.spot !== start2 && this.follower.begin(tank, path);
    if (this.following && this.follower.done) {
      this.following = false;
    }
    this.arrived = !this.following;
  }
  chooseGoal(tank, ctx, start2) {
    const avoid = (t) => (this.avoided.get(t) ?? -Infinity) > ctx.time;
    const exposure = exposureCosts(ctx);
    const dig = digDistances(ctx.map, start2, { avoid, extraCost: (t) => exposure[t] });
    const side = this.side(tank, ctx);
    const open = (goal) => goal != null && (this.banned.get(goal.spot) ?? -Infinity) <= ctx.time;
    let goals = [
      ...this.shootingGoals(tank, ctx, start2, dig, side),
      ...this.powerUpGoals(tank, ctx, dig),
      ...side === 0 ? this.defenseGoals(ctx, dig, start2) : []
    ].filter(open);
    if (goals.length === 0) {
      goals = this.guardGoals(ctx, dig, side).filter(open);
    }
    return goals.reduce(
      (best, g) => best == null || g.cost < best.cost ? g : best,
      null
    );
  }
  shootingGoals(tank, ctx, start2, graph, side) {
    const bots = ctx.tanks.filter((t) => t.side === "bot" && t.alive);
    const others = ctx.tanks.filter((t) => t !== tank && t.alive);
    const reach = eagleReachSteps(ctx);
    const dangerous = (bot) => eagleReachTime(bot, reach) <= EAGLE_THREAT_TIME;
    this.eagleThreatened = bots.some(dangerous);
    const goals = [];
    for (let t = 0; t < N * N && bots.length > 0; t += 1) {
      if (graph.dist[t] === Infinity) continue;
      const pos = spotToTankPos(t);
      const occupied = others.some((other) => testCollide(other.rect(), tankRectAt2(t), -0.01));
      if (occupied && t !== start2) continue;
      for (const bot of bots) {
        const rel = new RelativePosition(pos, bot);
        for (const face of DIRECTIONS4) {
          const { length, offset } = rel.getForwardInfo(face);
          if (length <= 0 || offset > ALIGN_TOLERANCE) continue;
          const { hit, bricks } = scanLane(ctx.map, ctx.tanks, tank, pos, face);
          if (hit.kind !== "bot" || bricks > 0 && hit.distance > MAX_FIRE_THROUGH_BRICK) {
            continue;
          }
          const bonus = dangerous(bot) ? DANGER_BONUS : 0;
          const cost = graph.dist[t] + sidePenalty(pos, side) + bricks * BRICK_LAYER_COST - bonus;
          goals.push({ spot: t, face, cost, graph });
        }
      }
    }
    return goals;
  }
  powerUpGoals(tank, ctx, graph) {
    const powerUps = ctx.powerUps.filter((p) => !p.dead);
    if (powerUps.length === 0) {
      return [];
    }
    const humanPlaying = ctx.players.some((p, i) => p != null && ctx.pilots[i] === "human");
    const mate = ctx.players.find((p) => p != null && p !== tank && p.alive);
    const mateStart = humanPlaying || mate == null ? null : startSpot(ctx.map, mate);
    const mateGraph = mateStart == null ? null : digDistances(ctx.map, mateStart);
    const goals = [];
    for (const powerUp of powerUps) {
      const spots = spotsOn(powerUp);
      let bonus = humanPlaying ? POWER_UP_BONUS.withHuman : POWER_UP_BONUS.eager;
      if (mateGraph != null) {
        const mine = nearest(graph, spots);
        const theirs = nearest(mateGraph, spots);
        const nearer = mine < theirs || mine === theirs && ctx.players.indexOf(tank) === 0;
        if (!nearer) continue;
      }
      for (const t of spots) {
        if (graph.dist[t] === Infinity) continue;
        goals.push({ spot: t, face: null, cost: graph.dist[t] - bonus, graph });
      }
    }
    return goals;
  }
  /** 每条开路路线从近的一端打到另一端；已经在路线上时朝还有砖的那头接着打 */
  defenseGoals(ctx, graph, start2) {
    const goals = [];
    for (const route of defenseRoutes(ctx.map)) {
      const k = route.indexOf(start2);
      let ordered;
      if (k !== -1) {
        const bricksAfter = route.slice(k + 1).some((t) => hasBricks(ctx.map, t));
        ordered = bricksAfter ? route.slice(k) : route.slice(0, k + 1).reverse();
      } else {
        const fromHead = graph.dist[route[0]] <= graph.dist[route[route.length - 1]];
        ordered = fromHead ? route : [...route].reverse();
      }
      const cost = graph.dist[ordered[0]] - OPEN_DEFENSE_BONUS;
      if (cost === Infinity || ordered.length < 2) continue;
      goals.push({ spot: ordered[ordered.length - 1], face: null, cost, graph, route: ordered });
    }
    return goals;
  }
  /** 回老鹰旁边守着。双人时各守一侧，单人守在正上方 */
  guardGoals(ctx, graph, side) {
    const eagle = ctx.map.eagle;
    if (eagle == null) {
      return [];
    }
    const target = side === 0 ? { x: eagle.x, y: eagle.y - 1.5 * BLOCK_SIZE } : { x: eagle.x + side * 1.5 * BLOCK_SIZE, y: eagle.y };
    const goals = [];
    for (let t = 0; t < N * N; t += 1) {
      if (graph.dist[t] === Infinity) continue;
      const pos = spotToTankPos(t);
      const offset = (Math.abs(pos.x - target.x) + Math.abs(pos.y - target.y)) / 8;
      goals.push({ spot: t, face: "up", cost: graph.dist[t] + offset * GUARD_OFFSET_COST, graph });
    }
    return goals;
  }
  /** 双人且两人都在场时 P1 管左半场（-1）、P2 管右半场（1）；否则整个场地都管（0） */
  side(tank, ctx) {
    if (ctx.players.filter((p) => p != null).length < 2) {
      return 0;
    }
    return ctx.players.indexOf(tank) === 0 ? -1 : 1;
  }
};

// games/tank/src/vendor/engine/physics/bullet-collision.ts
function getMBR(...rects) {
  let left2 = Infinity;
  let top = Infinity;
  let right2 = -Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left2 = Math.min(left2, r.x);
    top = Math.min(top, r.y);
    right2 = Math.max(right2, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  }
  return { x: left2, y: top, width: right2 - left2, height: bottom - top };
}
function bulletMBR(bullet) {
  return getMBR(bullet.lastRect(), bullet.rect());
}
var BULLET_EXPLOSION_SPREAD = 4;
var BULLET_EXPLOSION_THRESHOLD = 0.01;
function spreadBullet(bullet) {
  const r = bullet.rect();
  const v = BULLET_EXPLOSION_SPREAD + BULLET_EXPLOSION_THRESHOLD;
  if (bullet.direction === "up" || bullet.direction === "down") {
    r.x -= v;
    r.width += 2 * v;
    r.y -= BULLET_EXPLOSION_THRESHOLD;
    r.height += BULLET_EXPLOSION_THRESHOLD;
  } else {
    r.x -= BULLET_EXPLOSION_THRESHOLD;
    r.width += 2 * BULLET_EXPLOSION_THRESHOLD;
    r.y -= v;
    r.height += 2 * v;
  }
  return r;
}
var rotateDirectionMap = {
  up: "right",
  right: "down",
  down: "left",
  left: "up"
};
function rotate(b) {
  return {
    ...b,
    direction: rotateDirectionMap[b.direction],
    x: -b.y,
    y: b.x,
    lastX: -b.lastY,
    lastY: b.lastX
  };
}
function calculateHitTime(b1, b2) {
  if (b1.direction === "up") {
    if (b2.direction === "down") {
      return (b1.lastY - b2.lastY - BULLET_SIZE) / (b1.speed + b2.speed);
    } else if (b2.direction === "up") {
      if (b1.lastY === b2.lastY) {
        return -1;
      }
      if (b1.lastY < b2.lastY) {
        return (b2.lastY - b1.lastY - BULLET_SIZE) / (b2.speed - b1.speed);
      } else {
        return calculateHitTime(b2, b1);
      }
    } else if (b2.direction === "left") {
      const hitArea = { x: b1.x, y: b2.y, width: BULLET_SIZE, height: BULLET_SIZE };
      const time1 = (b1.lastY - b2.lastY - BULLET_SIZE) / b1.speed;
      const b2XAtTime1 = b2.lastX - b2.speed * time1;
      if (testCollide(hitArea, { x: b2XAtTime1, y: b2.y, width: BULLET_SIZE, height: BULLET_SIZE })) {
        return time1;
      }
      const time2 = (b2.lastX - b1.lastX - BULLET_SIZE) / b2.speed;
      const b1YAtTime2 = b1.lastY - b1.speed * time2;
      if (testCollide(hitArea, { x: b1.x, y: b1YAtTime2, width: BULLET_SIZE, height: BULLET_SIZE })) {
        return time2;
      }
      return -1;
    } else {
      const hitArea = { x: b1.x, y: b2.y, width: BULLET_SIZE, height: BULLET_SIZE };
      const time1 = (b1.lastY - b2.lastY - BULLET_SIZE) / b1.speed;
      const b2XAtTime1 = b2.lastX + b2.speed * time1;
      if (testCollide(hitArea, { x: b2XAtTime1, y: b2.y, width: BULLET_SIZE, height: BULLET_SIZE })) {
        return time1;
      }
      const time2 = (b1.lastX - b2.lastX - BULLET_SIZE) / b2.speed;
      const b1YAtTime2 = b1.lastY - b1.speed * time2;
      if (testCollide(hitArea, { x: b1.x, y: b1YAtTime2, width: BULLET_SIZE, height: BULLET_SIZE })) {
        return time2;
      }
      return -1;
    }
  } else {
    return calculateHitTime(rotate(b1), rotate(b2));
  }
}
function moveFromLast(b, time) {
  const distance = b.speed * time;
  switch (b.direction) {
    case "up":
      return { x: b.lastX, y: b.lastY - distance };
    case "down":
      return { x: b.lastX, y: b.lastY + distance };
    case "left":
      return { x: b.lastX - distance, y: b.lastY };
    case "right":
      return { x: b.lastX + distance, y: b.lastY };
  }
}
function getBulletCollision(b1, b2, delta) {
  if (!testCollide(bulletMBR(b1), bulletMBR(b2))) {
    return null;
  }
  const hitTime = calculateHitTime(b1, b2);
  if (hitTime >= 0 && hitTime <= delta) {
    return [moveFromLast(b1, hitTime), moveFromLast(b2, hitTime)];
  }
  return null;
}
function explosionPosFromRects(bullet, rects) {
  if (bullet.direction === "right") {
    const left2 = rects.reduce((m, r) => Math.min(m, r.x), Infinity);
    return { x: left2 - BULLET_SIZE, y: bullet.y };
  } else if (bullet.direction === "left") {
    const right2 = rects.reduce((m, r) => Math.max(m, r.x + r.width), -Infinity);
    return { x: right2, y: bullet.y };
  } else if (bullet.direction === "up") {
    const bottom = rects.reduce((m, r) => Math.max(m, r.y + r.height), -Infinity);
    return { x: bullet.x, y: bottom };
  } else {
    const top = rects.reduce((m, r) => Math.min(m, r.y), Infinity);
    return { x: bullet.x, y: top - BULLET_SIZE };
  }
}
function borderCollisionRect(fieldSize) {
  return { x: fieldSize, y: fieldSize, width: -fieldSize, height: -fieldSize };
}

// games/tank/src/vendor/engine/systems/bullet.ts
function emptyCollisions() {
  return {
    rects: [],
    explode: false,
    any: false,
    hitBrick: false,
    hitSteel: false,
    hitBorder: false,
    stop: null
  };
}
function eagleRect(eagle) {
  return { x: eagle.x, y: eagle.y, width: BLOCK_SIZE, height: BLOCK_SIZE };
}
function keepEarlier(b, c, p) {
  const travelled = (q) => Math.abs(q.x - b.lastX) + Math.abs(q.y - b.lastY);
  if (c.stop == null || travelled(p) < travelled(c.stop)) {
    c.stop = p;
  }
}
function updateBullets(bullets, map, explosions, audio, delta, tanks, hits) {
  if (bullets.length === 0) {
    return [];
  }
  for (const b of bullets) {
    b.lastX = b.x;
    b.lastY = b.y;
    const { axis, delta: sign } = getDirectionInfo(b.direction);
    if (axis === "x") {
      b.x += sign * b.speed * delta;
    } else {
      b.y += sign * b.speed * delta;
    }
  }
  const infoMap = /* @__PURE__ */ new Map();
  const info = (b) => {
    let c = infoMap.get(b.bulletId);
    if (c == null) {
      c = emptyCollisions();
      infoMap.set(b.bulletId, c);
    }
    return c;
  };
  for (let i = 0; i < bullets.length; i += 1) {
    for (let j = i + 1; j < bullets.length; j += 1) {
      const hit = getBulletCollision(bullets[i], bullets[j], delta);
      if (hit != null) {
        const [p1, p2] = hit;
        const c1 = info(bullets[i]);
        const c2 = info(bullets[j]);
        c1.any = true;
        c2.any = true;
        c1.rects.push({ x: p1.x, y: p1.y, width: 0, height: 0 });
        c2.rects.push({ x: p2.x, y: p2.y, width: 0, height: 0 });
        keepEarlier(bullets[i], c1, p1);
        keepEarlier(bullets[j], c2, p2);
      }
    }
  }
  for (const b of bullets) {
    const stop = infoMap.get(b.bulletId)?.stop;
    if (stop != null) {
      b.x = stop.x;
      b.y = stop.y;
    }
  }
  if (map.eagle != null && !map.eagleBroken) {
    const box = eagleRect(map.eagle);
    for (const b of bullets) {
      if (testCollide(box, bulletMBR(b))) {
        const c = info(b);
        c.any = true;
        c.explode = true;
        c.rects.push(box);
      }
    }
  }
  for (const b of bullets) {
    const mbr = bulletMBR(b);
    const c = info(b);
    for (const t of map.brickIndicesIn(mbr)) {
      c.any = true;
      c.explode = true;
      c.hitBrick = true;
      c.rects.push(map.brickRectAt(t));
    }
    for (const t of map.steelIndicesIn(mbr)) {
      c.any = true;
      c.explode = true;
      c.hitSteel = true;
      c.rects.push(map.steelRectAt(t));
    }
    const border = borderCollisionRect(FIELD_SIZE);
    if (b.x <= 0 || b.x + BULLET_SIZE >= FIELD_SIZE || b.y <= 0 || b.y + BULLET_SIZE >= FIELD_SIZE) {
      c.any = true;
      c.explode = true;
      c.hitBorder = true;
      c.rects.push(border);
    }
  }
  for (const b of bullets) {
    const mbr = bulletMBR(b);
    const c = info(b);
    for (const tank of tanks) {
      if (!tank.alive || tank.tankId === b.tankId) {
        continue;
      }
      if (!testCollide(tank.rect(), mbr, -0.02)) {
        continue;
      }
      if (b.side === "bot" && tank.side === "bot") {
        continue;
      }
      c.any = true;
      if (tank.side === "player" && tank.helmetDuration > 0) {
        break;
      }
      c.explode = true;
      c.rects.push(tank.rect());
      hits.push({ bullet: b, target: tank });
      break;
    }
  }
  const guard = eagleGuard(map);
  const baseHitters = [];
  for (const b of bullets) {
    const c = infoMap.get(b.bulletId);
    if (c == null || !c.any) {
      continue;
    }
    b.dead = true;
    if (!c.explode) {
      continue;
    }
    const pos = explosionPosFromRects(b, c.rects);
    b.x = pos.x;
    b.y = pos.y;
    explosions.push(new Explosion({ x: b.x + 2, y: b.y + 2 }, "small"));
    const spread = spreadBullet(b);
    const bricks = map.brickIndicesIn(spread);
    const hitsGuard = guard != null && bricks.some((t) => testCollide(guard, map.brickRectAt(t), -0.01));
    map.removeBricks(bricks);
    if (b.power >= STEEL_POWER) {
      map.removeSteels(map.steelIndicesIn(spread));
    }
    let hitsEagle = false;
    if (map.eagle != null && !map.eagleBroken && testCollide(eagleRect(map.eagle), spread)) {
      map.destroyEagle();
      hitsEagle = true;
    }
    if (b.side === "bot" && (hitsGuard || hitsEagle)) {
      baseHitters.push(b.tankId);
    }
    if (b.side === "player") {
      if (c.hitSteel || c.hitBorder) {
        audio.play("bullet_hit_1");
      } else if (c.hitBrick) {
        audio.play("bullet_hit_2");
      }
    }
  }
  let w = 0;
  for (let r = 0; r < bullets.length; r += 1) {
    if (!bullets[r].dead) {
      bullets[w++] = bullets[r];
    }
  }
  bullets.length = w;
  return baseHitters;
}

// games/tank/src/vendor/engine/systems/animation.ts
function updateAnimations(items, delta) {
  for (const item of items) {
    item.advance(delta);
  }
  let w = 0;
  for (let r = 0; r < items.length; r += 1) {
    if (!items[r].done) {
      items[w++] = items[r];
    }
  }
  items.length = w;
}

// games/tank/src/vendor/engine/entities/Bullet.ts
var nextBulletId = 1;
var Bullet = class {
  bulletId;
  side;
  tankId;
  direction;
  speed;
  power;
  x;
  y;
  lastX;
  lastY;
  /** 标记为待移除（命中/对撞/出界） */
  dead = false;
  constructor(init) {
    this.bulletId = nextBulletId++;
    this.side = init.side;
    this.tankId = init.tankId;
    this.direction = init.direction;
    this.speed = init.speed;
    this.power = init.power;
    this.x = init.x;
    this.y = init.y;
    this.lastX = init.x;
    this.lastY = init.y;
  }
  rect() {
    return { x: this.x, y: this.y, width: BULLET_SIZE, height: BULLET_SIZE };
  }
  lastRect() {
    return { x: this.lastX, y: this.lastY, width: BULLET_SIZE, height: BULLET_SIZE };
  }
};

// games/tank/src/vendor/engine/systems/fire.ts
function bulletStartPosition(tank) {
  switch (tank.direction) {
    case "up":
      return { x: tank.x + 6, y: tank.y };
    case "down":
      return { x: tank.x + 6, y: tank.y + 13 };
    case "left":
      return { x: tank.x, y: tank.y + 6 };
    case "right":
      return { x: tank.x + 13, y: tank.y + 6 };
  }
}
function fireTank(tank, shouldFire, delta, bullets, audio) {
  const rapid = tank.side === "player" && tank.rapidFire;
  let nextCooldown = tank.cooldown <= 0 ? 0 : tank.cooldown - delta;
  if (tank.cooldown <= 0 && shouldFire) {
    const active = bullets.filter((b) => b.tankId === tank.tankId && !b.dead).length;
    if (active < (rapid ? 8 : bulletLimit(tank))) {
      const { x, y } = bulletStartPosition(tank);
      if (tank.side === "player") {
        audio.play("bullet_shot");
      }
      bullets.push(
        new Bullet({
          side: tank.side,
          tankId: tank.tankId,
          direction: tank.direction,
          speed: bulletSpeed(tank),
          power: bulletPower(tank),
          x,
          y
        })
      );
      nextCooldown = rapid ? 75 : bulletInterval(tank);
    }
  }
  tank.cooldown = nextCooldown;
}

// games/tank/src/vendor/input/bindings.ts
var PLAYER1_CONTROL = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  fire: "KeyJ"
};
var PLAYER2_CONTROL = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  fire: "Slash"
};
var DIR_KEYS = ["up", "down", "left", "right"];
function directionCodes(control) {
  return DIR_KEYS.map((k) => control[k]);
}
function controlCodes(control) {
  return [...directionCodes(control), control.fire];
}
function codeToDirection(code, control) {
  for (const dir of DIR_KEYS) {
    if (control[dir] === code) {
      return dir;
    }
  }
  return null;
}

// games/tank/src/vendor/engine/systems/input.ts
function getPlayerInput(input, control, tank) {
  const code = input.lastPressed(directionCodes(control));
  if (code == null) {
    return null;
  }
  const direction = codeToDirection(code, control);
  if (direction == null) {
    return null;
  }
  if (direction !== tank.direction) {
    return { type: "turn", direction };
  }
  return { type: "forward" };
}
function keyboardController(input, control) {
  return {
    move: (tank) => getPlayerInput(input, control, tank),
    fire: () => input.consumeFire(control)
  };
}

// games/tank/src/vendor/engine/physics/collision.ts
function eagleRect2(eagle) {
  return { x: eagle.x, y: eagle.y, width: BLOCK_SIZE, height: BLOCK_SIZE };
}
function isInFront(other, tank) {
  switch (tank.direction) {
    case "left":
      return other.x < tank.x;
    case "right":
      return other.x > tank.x;
    case "up":
      return other.y < tank.y;
    case "down":
      return other.y > tank.y;
  }
}
function canTankMove(world, tank, threshold = -0.01) {
  const rect = tank.rect();
  if (!isInField(rect)) {
    return false;
  }
  const { map } = world;
  if (map.eagle != null && testCollide(eagleRect2(map.eagle), rect, threshold)) {
    return false;
  }
  if (map.collideBrick(rect, threshold)) {
    return false;
  }
  if (map.collideSteel(rect, threshold)) {
    return false;
  }
  if (map.collideRiver(rect, threshold)) {
    return false;
  }
  if (world.restrictedAreas.some((area) => testCollide(area, rect, threshold))) {
    return false;
  }
  for (const other of world.tanks) {
    if (other === tank || !other.alive) {
      continue;
    }
    const otherRect = { x: other.rx, y: other.ry, width: BLOCK_SIZE, height: BLOCK_SIZE };
    if (isInFront(otherRect, tank) && testCollide(otherRect, rect, threshold)) {
      return false;
    }
  }
  return true;
}

// games/tank/src/vendor/engine/systems/movement.ts
function updateReserved(world, tank) {
  const { axis } = getDirectionInfo(tank.direction);
  const coord = tank[axis];
  const floor = floor8(coord);
  const ceil = ceil8(coord);
  tank[axis] = floor;
  const canFloor = canTankMove(world, tank);
  tank[axis] = ceil;
  const canCeil = canTankMove(world, tank);
  tank[axis] = coord;
  let aligned;
  if (!canFloor) {
    aligned = ceil;
  } else if (!canCeil) {
    aligned = floor;
  } else {
    aligned = round8(coord);
  }
  if (axis === "x") {
    tank.rx = aligned;
    tank.ry = tank.y;
  } else {
    tank.rx = tank.x;
    tank.ry = aligned;
  }
}
function applyInput(world, tank, input, delta) {
  if (input == null) {
    tank.moving = false;
    return;
  }
  if (input.type === "turn") {
    if (isPerpendicular(input.direction, tank.direction)) {
      tank.x = tank.rx;
      tank.y = tank.ry;
    }
    tank.direction = input.direction;
    return;
  }
  if (tank.frozenTimeout > 0) {
    return;
  }
  const distance = Math.min(delta * moveSpeed(tank), input.maxDistance ?? Infinity);
  if (moveForward(world, tank, distance)) {
    tank.moving = true;
  }
}
function moveForward(world, tank, distance) {
  const { axis, delta: sign } = getDirectionInfo(tank.direction);
  const prev = tank[axis];
  tank[axis] = prev + sign * distance;
  if (canTankMove(world, tank)) {
    updateReserved(world, tank);
    return true;
  }
  tank[axis] = prev;
  return false;
}
function applyPlayerMove(world, tank, input, delta, audio) {
  const onSnow = world.map.isSnowAt(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2);
  let intent = input;
  if (onSnow && (tank.slide > SNOW_SLIDE_LOCK || tank.frozenTimeout > 0)) {
    intent = null;
  } else if (onSnow && intent != null && tank.slide === 0) {
    tank.slide = SNOW_SLIDE_START;
    audio.play("snow_slide");
  }
  if (intent == null && onSnow && tank.slide > 0) {
    const step2 = delta * moveSpeed(tank);
    moveForward(world, tank, Math.min(step2, tank.slide));
    tank.slide = Math.max(0, tank.slide - step2);
    tank.moving = false;
    return;
  }
  applyInput(world, tank, intent, delta);
}

// games/tank/src/vendor/engine/systems/powerup.ts
function updatePowerUps(powerUps, delta) {
  for (const p of powerUps) {
    p.blinkTimer += delta;
    if (p.blinkTimer >= frame(8)) {
      p.blinkTimer -= frame(8);
      p.visible = !p.visible;
    }
  }
  let w = 0;
  for (let r = 0; r < powerUps.length; r += 1) {
    if (!powerUps[r].dead) {
      powerUps[w++] = powerUps[r];
    }
  }
  powerUps.length = w;
}
function quadrantCollisions(map, x, y) {
  const parts = [
    { x: x + 4, y: y + 4, width: 4, height: 4 },
    { x: x + 8, y: y + 4, width: 4, height: 4 },
    { x: x + 4, y: y + 8, width: 4, height: 4 },
    { x: x + 8, y: y + 8, width: 4, height: 4 }
  ];
  const eagleRect3 = map.eagle != null ? { x: map.eagle.x, y: map.eagle.y, width: BLOCK_SIZE, height: BLOCK_SIZE } : null;
  let count = 0;
  for (const part of parts) {
    if (map.brickIndicesIn(part).length > 0 || map.steelIndicesIn(part).length > 0 || map.collideRiver(part, 0) || eagleRect3 != null && testCollide(eagleRect3, part)) {
      count += 1;
    }
  }
  return count;
}
function validPowerUpPositions(map) {
  const positions = [];
  const max = (FIELD_BLOCK_SIZE - 1) * BLOCK_SIZE;
  for (let y = 0; y < max; y += 0.5 * BLOCK_SIZE) {
    for (let x = 0; x < max; x += 0.5 * BLOCK_SIZE) {
      const c = quadrantCollisions(map, x, y);
      if (c >= 1 && c <= 3) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}
function determinePowerUpName(map, playerTanks, random) {
  if (map.eagle != null) {
    const eagleSpot = getTankSpot(map.eagle);
    const estMap = calculateFireEstimateMap(around(eagleSpot), map);
    const exposed = [...estMap.keys()].some(
      (t) => t !== eagleSpot && getFireResist(estMap.get(t)) === 0
    );
    if (exposed && random() < 0.5) {
      return "shovel";
    }
  }
  if (playerTanks.some((t) => t.level === "basic") && random() < 0.4) {
    return "star";
  }
  const names = ["tank", "star", "grenade", "timer", "helmet", "shovel"];
  return names[Math.floor(random() * names.length)];
}

// games/tank/src/vendor/engine/snapshot.ts
var round = (v) => Math.round(v * 1e3) / 1e3;
function terrainSnapshot(map) {
  const n = N_MAP.BRICK;
  const size = ITEM_SIZE_MAP.BRICK;
  const rows = [];
  for (let row = 0; row < n; row += 1) {
    let line = "";
    for (let col = 0; col < n; col += 1) {
      const px = col * size;
      const py = row * size;
      const at = (cells, cellSize, cellN) => cells[Math.floor(py / cellSize) * cellN + Math.floor(px / cellSize)];
      if (map.bricks[row * n + col]) line += "#";
      else if (at(map.steels, ITEM_SIZE_MAP.STEEL, N_MAP.STEEL)) line += "@";
      else if (at(map.rivers, ITEM_SIZE_MAP.RIVER, N_MAP.RIVER)) line += "~";
      else if (at(map.snows, ITEM_SIZE_MAP.SNOW, N_MAP.SNOW)) line += ":";
      else if (at(map.forests, ITEM_SIZE_MAP.FOREST, N_MAP.FOREST)) line += "%";
      else line += ".";
    }
    rows.push(line);
  }
  return rows;
}
function tankSnapshot(tank, intent) {
  return {
    id: tank.tankId,
    side: tank.side,
    level: tank.level,
    color: tank.color,
    x: round(tank.x),
    y: round(tank.y),
    direction: tank.direction,
    hp: tank.hp,
    helmet: round(tank.helmetDuration),
    frozen: round(tank.frozenTimeout),
    slide: round(tank.slide),
    withPowerUp: tank.withPowerUp,
    intent
  };
}
function bulletSnapshot(bullet) {
  return {
    id: bullet.bulletId,
    side: bullet.side,
    tankId: bullet.tankId,
    x: round(bullet.x),
    y: round(bullet.y),
    direction: bullet.direction
  };
}
function powerUpSnapshot(powerUp) {
  return { name: powerUp.name, x: round(powerUp.x), y: round(powerUp.y) };
}

// games/tank/src/vendor/engine/StatisticsAnimation.ts
var TOTAL_HOLD = 1e3;
var StatisticsAnimation = class {
  view;
  frames = [];
  end;
  elapsed = 0;
  constructor(stageName, killInfo, autopilot) {
    this.view = {
      stageName,
      counts: killInfo.map(() => emptyCounts(-1)),
      showTotal: false,
      autopilot
    };
    let t = 500;
    for (const level of TANK_LEVELS) {
      t += 250;
      const killCount = Math.max(...killInfo.map((k) => k[level]));
      if (killCount === 0) {
        this.frames.push({ at: t, level, values: killInfo.map(() => 0) });
      } else {
        for (let n = 1; n <= killCount; n += 1) {
          this.frames.push({ at: t, level, values: killInfo.map((k) => Math.min(n, k[level])) });
          t += 160;
        }
      }
      t += 200;
    }
    t += 200;
    this.frames.push({ at: t, level: null, values: [] });
    this.end = t + TOTAL_HOLD;
  }
  get done() {
    return this.elapsed >= this.end;
  }
  /** 推进动画；每播放一格回调一次（用于播放 statistics_1 音效） */
  advance(delta, onTick = () => {
  }) {
    this.elapsed += delta;
    while (this.frames.length > 0 && this.frames[0].at <= this.elapsed) {
      const f = this.frames.shift();
      onTick();
      if (f.level == null) {
        this.view.showTotal = true;
      } else {
        f.values.forEach((v, i) => {
          this.view.counts[i][f.level] = v;
        });
      }
    }
  }
};
function emptyCounts(value) {
  return { basic: value, fast: value, power: value, armor: value };
}

// games/tank/src/vendor/engine/BattleScene.ts
var TANK_UPGRADE = {
  basic: "fast",
  fast: "power",
  power: "armor",
  armor: "armor"
};
var FREEZE_DURATION = 1e3;
var BattleScene = class {
  constructor(map, audio, botGroups, players, stageNumber, options) {
    this.options = options;
    this.map = map;
    this.audio = audio;
    this.remainingBots = [...botGroups];
    this.players = players.map((state) => ({
      state,
      tank: null,
      flicker: null,
      respawnTimer: 0,
      brain: null
    }));
    this.killInfo = players.map(() => emptyCounts(0));
    const multi = players.length > 1;
    this.maxBotsOnField = multi ? MAX_BOT_ON_FIELD.multi : MAX_BOT_ON_FIELD.single;
    this.botSpawnInterval = botSpawnInterval(stageNumber, multi);
    this.stageNumber = stageNumber;
  }
  options;
  map;
  tanks = [];
  bullets = [];
  explosions = [];
  powerUps = [];
  scorePopups = [];
  players;
  /** 本关各玩家按等级的击杀数（结算页用，下标与 players 一致） */
  killInfo;
  /** bot 全体冻结的剩余计数（timer 道具），>0 时 bot 不动不开火 */
  botFreezeTicks = 0;
  /** shovel 道具状态机 */
  shovelPhase = "none";
  shovelTimer = 0;
  shovelBlinkToggles = 0;
  shovelSteelShown = false;
  brains = /* @__PURE__ */ new Map();
  /** 各坦克本 tick 的操作，只给快照用 */
  intents = /* @__PURE__ */ new Map();
  audio;
  /** 缓存的 spot 图，地形变动（version 改变）时重建 */
  spotsCache = null;
  spotsVersion = -1;
  /** 待出场的 bot 等级队列 */
  remainingBots;
  /** 已出场 bot 计数（用于道具下标判定） */
  spawnedBotCount = 0;
  /** 阵亡 bot 在爆炸（和得分弹出）播完前仍占着同屏名额，这里记各自的剩余时间 */
  dyingBotTimers = [];
  botFlickers = [];
  maxBotsOnField;
  botSpawnInterval;
  stageNumber;
  /** 距下次允许出生的剩余时间；为 0 时一有空位就出生 */
  botSpawnTimer = 0;
  nextBotSpawnIndex = 0;
  time = 0;
  status = "playing";
  loseReason = null;
  /** 开战：玩家开始出生，第一辆 bot 在下一次 step 立即出生 */
  start() {
    for (const slot of this.players) {
      this.spawnPlayer(slot);
    }
  }
  /** 过关：存活（或正在出生）坦克的等级留到下一关，并移出战场（旧版 reserveTankOnStageEnd） */
  reserveTanks() {
    for (const slot of this.players) {
      const tank = slot.tank ?? slot.flicker?.tank;
      if (tank != null && tank.alive) {
        slot.state.reservedTankLevel = tank.level;
        tank.alive = false;
      }
      slot.tank = null;
      slot.flicker = null;
    }
    this.cleanupTanks();
  }
  get flickers() {
    const result = [];
    for (const slot of this.players) {
      if (slot.flicker != null) result.push(slot.flicker);
    }
    result.push(...this.botFlickers);
    return result;
  }
  /** 各玩家剩余命数 */
  get lives() {
    return this.players.map((p) => p.state.lives);
  }
  /** 该玩家的坦克在场且出生闪烁已结束 */
  controllable(playerIndex) {
    return this.players[playerIndex].tank != null;
  }
  /** 尚未开始出生的 bot 数（HUD 右侧的小坦克图标） */
  get remainingBotCount() {
    return this.remainingBots.length;
  }
  get world() {
    return { map: this.map, tanks: this.tanks, restrictedAreas: this.flickers.map((f) => f.rect()) };
  }
  /** 取（必要时重建）spot 图 */
  get spots() {
    if (this.spotsCache == null || this.spotsVersion !== this.map.version) {
      this.spotsCache = buildSpots(this.map);
      this.spotsVersion = this.map.version;
    }
    return this.spotsCache;
  }
  aliveBotCount() {
    let n = 0;
    for (const t of this.tanks) {
      if (t.alive && t.side === "bot") n += 1;
    }
    return n;
  }
  // region 出生
  spawnPlayer(slot) {
    const { state } = slot;
    let level = "basic";
    if (state.reservedTankLevel != null) {
      level = state.reservedTankLevel;
      state.reservedTankLevel = null;
    } else if (state.lives > 0) {
      state.lives -= 1;
    } else {
      return;
    }
    const tank = new Tank({
      side: "player",
      level,
      color: state.color,
      direction: "up",
      x: state.spawnPos.x,
      y: state.spawnPos.y,
      hp: 1,
      helmetDuration: SPAWN_HELMET_DURATION
    });
    slot.flicker = new Flicker(tank);
    slot.respawnTimer = 0;
    slot.brain = null;
  }
  /** 出生计时只在真正出生时重置：满员时停在 0，一有空位就出生 */
  updateBotSpawn(delta) {
    if (this.botSpawnTimer > 0) {
      this.botSpawnTimer = Math.max(0, this.botSpawnTimer - delta);
      return;
    }
    const inUse = this.aliveBotCount() + this.botFlickers.length + this.dyingBotTimers.length;
    if (this.remainingBots.length === 0 || inUse >= this.maxBotsOnField) {
      return;
    }
    this.spawnBot();
    this.botSpawnTimer = this.botSpawnInterval;
  }
  /** 出生点轮流使用且不检查占用，与已有坦克重叠也照样出生 */
  spawnBot() {
    const x = BOT_SPAWN_X[this.nextBotSpawnIndex];
    this.nextBotSpawnIndex = (this.nextBotSpawnIndex + 1) % BOT_SPAWN_X.length;
    const level = this.remainingBots.shift();
    const withPowerUp = POWER_UP_BOT_INDICES.includes(this.spawnedBotCount);
    if (withPowerUp) {
      this.powerUps.length = 0;
    }
    this.spawnedBotCount += 1;
    const tank = new Tank({
      side: "bot",
      level,
      color: "silver",
      direction: "down",
      x,
      y: 0,
      hp: level === "armor" ? 4 : 1,
      withPowerUp
    });
    this.botFlickers.push(new Flicker(tank, FLICKER_DURATION / BOT_FLICKER_DURATION));
  }
  /** 推进出生闪烁，播完的坦克进入战场 */
  updateFlickers(delta) {
    for (const slot of this.players) {
      const flicker = slot.flicker;
      if (flicker == null) continue;
      flicker.advance(delta);
      if (flicker.done) {
        this.placeTank(flicker.tank);
        slot.tank = flicker.tank;
        slot.flicker = null;
      }
    }
    for (const flicker of this.botFlickers) {
      flicker.advance(delta);
      if (flicker.done) {
        this.placeTank(flicker.tank);
        this.brains.set(flicker.tank.tankId, new BotBrain());
      }
    }
    const pending = this.botFlickers.filter((f) => !f.done);
    this.botFlickers.splice(0, this.botFlickers.length, ...pending);
  }
  placeTank(tank) {
    tank.bornAt = this.time;
    this.tanks.push(tank);
  }
  // endregion
  // region 命中结算
  addScore(slot, amount) {
    const { state } = slot;
    const before = state.score;
    state.score += amount;
    const bonus = Math.floor(state.score / LIFE_BONUS_SCORE) - Math.floor(before / LIFE_BONUS_SCORE);
    if (bonus > 0) {
      state.lives += bonus;
    }
  }
  countKill(slot, level) {
    this.killInfo[this.players.indexOf(slot)][level] += 1;
  }
  playerSlotOfTank(tankId) {
    return this.players.find((p) => p.tank != null && p.tank.tankId === tankId) ?? null;
  }
  killBot(bot, shooterId) {
    bot.alive = false;
    this.explosions.push(new Explosion({ x: bot.x + 8, y: bot.y + 8 }, "big"));
    this.audio.play("explosion_1");
    const score = TANK_KILL_SCORE_MAP[bot.level];
    this.scorePopups.push(new ScorePopup(score, bot.x, bot.y, BIG_EXPLOSION_DURATION));
    const shooter = this.playerSlotOfTank(shooterId);
    if (shooter != null) {
      this.countKill(shooter, bot.level);
      this.addScore(shooter, score);
    }
    this.dyingBotTimers.push(BIG_EXPLOSION_DURATION + SCORE_POPUP_DURATION);
  }
  spawnPowerUp() {
    const playerTanks = this.players.map((p) => p.tank).filter((t) => t != null);
    const { random } = this.options;
    const name = determinePowerUpName(this.map, playerTanks, random);
    const positions = validPowerUpPositions(this.map);
    const pos = positions.length > 0 ? positions[Math.floor(random() * positions.length)] : {
      x: Math.floor(random() * 25) / 2 * BLOCK_SIZE,
      y: Math.floor(random() * 25) / 2 * BLOCK_SIZE
    };
    this.powerUps.push(new PowerUp(name, pos.x, pos.y));
    this.audio.play("powerup_appear");
  }
  killPlayer(slot) {
    const tank = slot.tank;
    if (tank == null) {
      return;
    }
    if (slot.state.infiniteLives) slot.state.lives += 1;
    tank.alive = false;
    this.explosions.push(new Explosion({ x: tank.x + 8, y: tank.y + 8 }, "big"));
    this.audio.play("explosion_1");
    slot.tank = null;
    slot.respawnTimer = BIG_EXPLOSION_DURATION;
  }
  applyHit(hit) {
    const target = hit.target;
    if (!target.alive) {
      return;
    }
    if (hit.bullet.side === "player") {
      if (target.side === "bot") {
        if (target.withPowerUp) {
          target.withPowerUp = false;
          this.spawnPowerUp();
        }
        target.hp -= 1;
        if (target.hp <= 0) {
          this.killBot(target, hit.bullet.tankId);
        }
      } else {
        target.frozenTimeout = FREEZE_DURATION;
      }
    } else {
      const slot = this.players.find((p) => p.tank === target);
      if (slot != null) {
        this.killPlayer(slot);
      }
    }
  }
  // endregion
  aiContext() {
    return {
      world: this.world,
      map: this.map,
      tanks: this.tanks,
      bullets: this.bullets,
      powerUps: this.powerUps,
      spots: this.spots,
      random: this.options.random,
      time: this.time,
      stageNumber: this.stageNumber,
      players: this.players.map((slot) => slot.tank),
      pilots: this.players.map((slot) => slot.state.pilot)
    };
  }
  /** 玩家和 bot 共用的执行顺序：移动 → 计时 → 开火。冰面滑行等玩家规则只在 applyPlayerMove 里 */
  drive(tank, controller, ctx, delta) {
    const move = controller.move(tank, ctx, delta);
    if (tank.side === "player") {
      applyPlayerMove(ctx.world, tank, move, delta, this.audio);
    } else {
      applyInput(ctx.world, tank, move, delta);
    }
    this.decayTimers(tank, delta);
    const fire = controller.fire(tank, ctx, delta);
    fireTank(tank, fire, delta, this.bullets, this.audio);
    this.intents.set(tank.tankId, { move, fire });
  }
  playerController(slot, input) {
    if (slot.state.pilot === "human") {
      slot.brain = null;
      return keyboardController(input, slot.state.control);
    }
    slot.brain ??= new TeammateBrain();
    return slot.brain;
  }
  /** 推进一个定步 */
  step(delta, input) {
    const ctx = this.aiContext();
    for (const slot of this.players) {
      const tank = slot.tank;
      if (tank == null || !tank.alive) {
        continue;
      }
      this.drive(tank, this.playerController(slot, input), ctx, delta);
    }
    const botsFrozen = this.botFreezeTicks > 0;
    for (const tank of this.tanks) {
      if (tank.side !== "bot" || !tank.alive) {
        continue;
      }
      if (botsFrozen) {
        tank.moving = false;
        this.intents.delete(tank.tankId);
        continue;
      }
      const brain = this.brains.get(tank.tankId);
      if (brain != null) {
        this.drive(tank, brain, ctx, delta);
      }
    }
    const freezeTickCrossed = Math.floor((this.time + delta) / TIMER_FREEZE_TICK) > Math.floor(this.time / TIMER_FREEZE_TICK);
    if (this.botFreezeTicks > 0 && freezeTickCrossed) {
      this.botFreezeTicks -= 1;
    }
    const hits = [];
    const { bullets, map, explosions, audio, tanks } = this;
    for (const tankId of updateBullets(bullets, map, explosions, audio, delta, tanks, hits)) {
      this.brains.get(tankId)?.onBaseHit();
    }
    for (const hit of hits) {
      this.applyHit(hit);
    }
    updateAnimations(this.explosions, delta);
    updateAnimations(this.scorePopups, delta);
    updatePowerUps(this.powerUps, delta);
    this.handlePickup();
    this.updateShovel(delta);
    this.updateFlickers(delta);
    this.updateDyingBots(delta);
    this.updateBotSpawn(delta);
    for (const slot of this.players) {
      if (slot.respawnTimer > 0) {
        slot.respawnTimer -= delta;
        if (slot.respawnTimer <= 0) {
          this.spawnPlayer(slot);
        }
      }
    }
    this.borrowLives(input);
    this.cleanupTanks();
    if (this.status === "playing") {
      this.judge();
    }
    this.time += delta;
  }
  /** 本关状态的纯数据快照，测试断言和调试用 */
  snapshot() {
    return {
      time: round(this.time),
      status: this.status,
      loseReason: this.loseReason,
      remainingBots: this.remainingBots.length,
      botsFrozen: this.botFreezeTicks > 0,
      terrain: terrainSnapshot(this.map),
      eagle: this.map.eagle == null ? null : { x: this.map.eagle.x, y: this.map.eagle.y, broken: this.map.eagleBroken },
      slots: this.players.map((slot) => ({
        tankId: slot.tank?.tankId ?? null,
        state: slot.tank != null ? "alive" : slot.flicker != null ? "spawning" : slot.respawnTimer > 0 ? "respawning" : "out"
      })),
      tanks: this.tanks.map((t) => tankSnapshot(t, this.intents.get(t.tankId) ?? null)),
      spawning: this.flickers.map((f) => ({ side: f.tank.side, x: f.x, y: f.y })),
      bullets: this.bullets.map(bulletSnapshot),
      powerUps: this.powerUps.map(powerUpSnapshot)
    };
  }
  // region 道具拾取与效果
  handlePickup() {
    for (const p of this.powerUps) {
      if (p.dead) {
        continue;
      }
      for (const slot of this.players) {
        const tank = slot.tank;
        if (tank == null || !tank.alive) {
          continue;
        }
        if (testCollide(p.rect(), tank.rect())) {
          p.dead = true;
          this.audio.play("powerup_pick");
          this.addScore(slot, POWER_UP_SCORE);
          this.scorePopups.push(new ScorePopup(POWER_UP_SCORE, p.x, p.y));
          this.applyPowerUp(p.name, slot, tank);
          break;
        }
      }
    }
  }
  applyPowerUp(name, slot, tank) {
    switch (name) {
      case "tank":
        slot.state.lives += 1;
        break;
      case "star":
        if (tank.level === "armor") {
          this.addScore(slot, STAR_ARMOR_SCORE);
        } else {
          tank.level = TANK_UPGRADE[tank.level];
        }
        break;
      case "grenade":
        for (const t of this.tanks) {
          if (t.side === "bot" && t.alive) {
            t.alive = false;
            this.countKill(slot, t.level);
            this.explosions.push(new Explosion({ x: t.x + 8, y: t.y + 8 }, "big"));
            this.dyingBotTimers.push(BIG_EXPLOSION_DURATION);
          }
        }
        this.audio.play("explosion_1");
        break;
      case "timer":
        this.botFreezeTicks = TIMER_FREEZE_TICKS;
        break;
      case "helmet":
        tank.helmetDuration = HELMET_POWERUP_DURATION;
        break;
      case "shovel":
        this.startShovel();
        break;
    }
  }
  shovelExcludes() {
    const excludes = [];
    if (this.map.eagle != null) {
      excludes.push({
        x: this.map.eagle.x,
        y: this.map.eagle.y,
        width: BLOCK_SIZE,
        height: BLOCK_SIZE
      });
    }
    for (const t of this.tanks) {
      if (t.alive) {
        excludes.push(t.rect());
      }
    }
    return excludes;
  }
  startShovel() {
    this.map.shovelConvert("steel", this.shovelExcludes());
    this.shovelPhase = "steel";
    this.shovelTimer = SHOVEL_STEEL_DURATION;
    this.shovelSteelShown = true;
    this.shovelBlinkToggles = 0;
  }
  updateShovel(delta) {
    if (this.shovelPhase === "none") {
      return;
    }
    this.shovelTimer -= delta;
    if (this.shovelTimer > 0) {
      return;
    }
    if (this.shovelPhase === "steel") {
      this.shovelPhase = "blink";
      this.shovelTimer = SHOVEL_BLINK_INTERVAL;
      return;
    }
    this.shovelSteelShown = !this.shovelSteelShown;
    this.map.shovelConvert(this.shovelSteelShown ? "steel" : "brick", this.shovelExcludes());
    this.shovelBlinkToggles += 1;
    this.shovelTimer = SHOVEL_BLINK_INTERVAL;
    if (this.shovelBlinkToggles >= SHOVEL_BLINK_TIMES * 2) {
      this.map.shovelConvert("brick", this.shovelExcludes());
      this.shovelPhase = "none";
    }
  }
  // endregion
  /** 递减坦克的头盔/冻结计时，并处理冻结闪烁 */
  decayTimers(tank, delta) {
    if (tank.helmetDuration > 0) {
      tank.helmetDuration = Math.max(0, tank.helmetDuration - delta);
    }
    if (tank.frozenTimeout > 0) {
      tank.frozenTimeout = Math.max(0, tank.frozenTimeout - delta);
      tank.visible = Math.floor(this.time / 150) % 2 === 0;
      if (tank.frozenTimeout === 0) {
        tank.visible = true;
      }
    } else {
      tank.visible = true;
    }
  }
  /** 各玩家此刻能否按开火键向队友借命，界面据此显示提示 */
  get canBorrowLife() {
    return this.players.map((slot) => this.lenderOf(slot) != null);
  }
  /** 不在场、没命的玩家可以向还有命的队友借一条 */
  lenderOf(slot) {
    if (slot.tank != null || slot.flicker != null || slot.state.lives > 0) {
      return null;
    }
    return this.players.find((p) => p !== slot && p.state.lives > 0) ?? null;
  }
  /** 双人模式：没命的玩家按开火键向队友借一条命（旧版 borrowLifeWatcher） */
  borrowLives(input) {
    for (const slot of this.players) {
      const lender = this.lenderOf(slot);
      if (lender != null && input.firePressed(slot.state.control)) {
        lender.state.lives -= 1;
        slot.state.lives += 1;
        this.spawnPlayer(slot);
      }
    }
  }
  updateDyingBots(delta) {
    for (let i = this.dyingBotTimers.length - 1; i >= 0; i -= 1) {
      this.dyingBotTimers[i] -= delta;
      if (this.dyingBotTimers[i] <= 0) {
        this.dyingBotTimers.splice(i, 1);
      }
    }
  }
  cleanupTanks() {
    let w = 0;
    for (let r = 0; r < this.tanks.length; r += 1) {
      const t = this.tanks[r];
      if (t.alive) {
        this.tanks[w++] = t;
      } else {
        this.brains.delete(t.tankId);
        this.intents.delete(t.tankId);
      }
    }
    this.tanks.length = w;
  }
  judge() {
    if (this.map.eagleBroken) {
      this.status = "lost";
      this.loseReason = "eagle";
      return;
    }
    const allPlayersOut = this.players.every(
      (p) => p.tank == null && p.flicker == null && p.state.lives <= 0 && p.respawnTimer <= 0
    );
    if (this.players.length > 0 && allPlayersOut) {
      this.status = "lost";
      this.loseReason = "dead";
      return;
    }
    if (this.remainingBots.length === 0 && this.botFlickers.length === 0 && this.aliveBotCount() === 0) {
      this.status = "won";
    }
  }
};

// games/tank/src/vendor/engine/map/parseStage.ts
function parseBrickBits(str) {
  if (str.length === 1) {
    const short = parseInt(str, 16);
    let long = 0;
    if (1 & short) long += 61440;
    if (2 & short) long += 3840;
    if (4 & short) long += 240;
    if (8 & short) long += 15;
    return long;
  } else if (str.length === 4) {
    return parseInt(str, 16);
  }
  throw new Error(`Invalid brick hex: ${str}`);
}
function fillBrick(bricks, row, col, bits) {
  const brickRow = 4 * row;
  const brickCol = 4 * col;
  const N2 = N_MAP.BRICK;
  const set = (r, c) => {
    bricks[r * N2 + c] = true;
  };
  const part0 = bits >> 12 & 15;
  part0 & 1 && set(brickRow, brickCol);
  part0 & 2 && set(brickRow, brickCol + 1);
  part0 & 4 && set(brickRow + 1, brickCol);
  part0 & 8 && set(brickRow + 1, brickCol + 1);
  const part1 = bits >> 8 & 15;
  part1 & 1 && set(brickRow, brickCol + 2);
  part1 & 2 && set(brickRow, brickCol + 3);
  part1 & 4 && set(brickRow + 1, brickCol + 2);
  part1 & 8 && set(brickRow + 1, brickCol + 3);
  const part2 = bits >> 4 & 15;
  part2 & 1 && set(brickRow + 2, brickCol);
  part2 & 2 && set(brickRow + 2, brickCol + 1);
  part2 & 4 && set(brickRow + 3, brickCol);
  part2 & 8 && set(brickRow + 3, brickCol + 1);
  const part3 = bits >> 0 & 15;
  part3 & 1 && set(brickRow + 2, brickCol + 2);
  part3 & 2 && set(brickRow + 2, brickCol + 3);
  part3 & 4 && set(brickRow + 3, brickCol + 2);
  part3 & 8 && set(brickRow + 3, brickCol + 3);
}
function fillSteel(steels, row, col, bits) {
  const N2 = N_MAP.STEEL;
  if (bits & 1) steels[2 * row * N2 + 2 * col] = true;
  if (bits & 2) steels[2 * row * N2 + 2 * col + 1] = true;
  if (bits & 4) steels[(2 * row + 1) * N2 + 2 * col] = true;
  if (bits & 8) steels[(2 * row + 1) * N2 + 2 * col + 1] = true;
}
function parseStageMap(map) {
  const bricks = new Array(N_MAP.BRICK ** 2).fill(false);
  const steels = new Array(N_MAP.STEEL ** 2).fill(false);
  const rivers = new Array(N_MAP.RIVER ** 2).fill(false);
  const snows = new Array(N_MAP.SNOW ** 2).fill(false);
  const forests = new Array(N_MAP.FOREST ** 2).fill(false);
  let eagle = null;
  for (let row = 0; row < FIELD_BLOCK_SIZE; row += 1) {
    const line = map[row].toLowerCase().trim().split(/ +/);
    for (let col = 0; col < FIELD_BLOCK_SIZE; col += 1) {
      const item = line[col].trim();
      const type = item[0];
      if (type === "b") {
        fillBrick(bricks, row, col, parseBrickBits(item.substring(1)));
      } else if (type === "t") {
        fillSteel(steels, row, col, parseInt(item[1], 16));
      } else if (type === "r") {
        rivers[row * FIELD_BLOCK_SIZE + col] = true;
      } else if (type === "s") {
        snows[row * FIELD_BLOCK_SIZE + col] = true;
      } else if (type === "f") {
        forests[row * FIELD_BLOCK_SIZE + col] = true;
      } else if (type === "e") {
        if (eagle != null) {
          throw new Error("Eagle appears more than once");
        }
        eagle = { x: col * BLOCK_SIZE, y: row * BLOCK_SIZE };
      } else if (type !== "x") {
        throw new Error(`Invalid map item at row:${row} col:${col} -> "${item}"`);
      }
    }
  }
  return { bricks, steels, rivers, snows, forests, eagle };
}
var MAX_GROUP_COUNT = 99;
function parseStageBots(bots) {
  return bots.map((descriptor) => {
    const [countStr, level] = descriptor.split("*").map((s) => s.trim());
    const count = Number(countStr);
    if (!Number.isInteger(count) || count < 0 || count > MAX_GROUP_COUNT) {
      throw new Error(`Invalid bot count in "${descriptor}"`);
    }
    if (!["basic", "fast", "power", "armor"].includes(level)) {
      throw new Error(`Invalid tank level in "${descriptor}"`);
    }
    return { tankLevel: level, count };
  });
}
function expandBots(groups) {
  const queue = [];
  for (const g of groups) {
    for (let i = 0; i < g.count; i += 1) {
      queue.push(g.tankLevel);
    }
  }
  return queue;
}
function parseStage(raw) {
  return {
    name: raw.name,
    difficulty: raw.difficulty,
    ...parseStageMap(raw.map),
    bots: parseStageBots(raw.bots)
  };
}

// games/tank/src/vendor/engine/map/TerrainMap.ts
var TerrainMap = class _TerrainMap {
  bricks;
  steels;
  rivers;
  snows;
  forests;
  eagle;
  /** 老鹰是否已被摧毁 */
  eagleBroken = false;
  /** 地形（brick/steel）变动版本号，渲染层据此决定是否重烘焙 */
  version = 0;
  constructor(parsed) {
    this.bricks = parsed.bricks;
    this.steels = parsed.steels;
    this.rivers = parsed.rivers;
    this.snows = parsed.snows;
    this.forests = parsed.forests;
    this.eagle = parsed.eagle;
  }
  static fromRaw(raw) {
    return new _TerrainMap(parseStage(raw));
  }
  /** 遍历某类地形所有被点亮的子格，回调拿到像素坐标 */
  forEachCell(cells, n, size, fn) {
    for (let i = 0; i < cells.length; i += 1) {
      if (cells[i]) {
        const row = Math.floor(i / n);
        const col = i % n;
        fn(col * size, row * size, i);
      }
    }
  }
  forEachBrick(fn) {
    this.forEachCell(this.bricks, N_MAP.BRICK, ITEM_SIZE_MAP.BRICK, fn);
  }
  forEachSteel(fn) {
    this.forEachCell(this.steels, N_MAP.STEEL, ITEM_SIZE_MAP.STEEL, fn);
  }
  forEachRiver(fn) {
    this.forEachCell(this.rivers, N_MAP.RIVER, ITEM_SIZE_MAP.RIVER, fn);
  }
  forEachSnow(fn) {
    this.forEachCell(this.snows, N_MAP.SNOW, ITEM_SIZE_MAP.SNOW, fn);
  }
  /** 像素坐标所在的 16×16 格是否为雪地（冰面）；越界返回 false */
  isSnowAt(px, py) {
    const size = ITEM_SIZE_MAP.SNOW;
    const col = Math.floor(px / size);
    const row = Math.floor(py / size);
    if (col < 0 || col >= N_MAP.SNOW || row < 0 || row >= N_MAP.SNOW) return false;
    return this.snows[row * N_MAP.SNOW + col];
  }
  forEachForest(fn) {
    this.forEachCell(this.forests, N_MAP.FOREST, ITEM_SIZE_MAP.FOREST, fn);
  }
  /**
   * 判断 rect 是否与某类地形的任一被点亮子格碰撞。
   * 只遍历 rect 覆盖范围内的子格（按 index 区间），而非全图扫描。
   */
  collideCells(cells, n, size, rect, threshold) {
    const col1 = Math.max(0, Math.floor(rect.x / size));
    const col2 = Math.min(n - 1, Math.floor((rect.x + rect.width) / size));
    const row1 = Math.max(0, Math.floor(rect.y / size));
    const row2 = Math.min(n - 1, Math.floor((rect.y + rect.height) / size));
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        if (cells[row * n + col]) {
          const cell = { x: col * size, y: row * size, width: size, height: size };
          if (testCollide(cell, rect, threshold)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  /** rect 是否撞上砖块（可被破坏） */
  collideBrick(rect, threshold) {
    return this.collideCells(this.bricks, N_MAP.BRICK, ITEM_SIZE_MAP.BRICK, rect, threshold);
  }
  /** rect 是否撞上钢块 */
  collideSteel(rect, threshold) {
    return this.collideCells(this.steels, N_MAP.STEEL, ITEM_SIZE_MAP.STEEL, rect, threshold);
  }
  /** rect 是否撞上河流（坦克不可通行，子弹可飞过） */
  collideRiver(rect, threshold) {
    return this.collideCells(this.rivers, N_MAP.RIVER, ITEM_SIZE_MAP.RIVER, rect, threshold);
  }
  /** 收集 rect 覆盖范围内、被点亮的子格索引 */
  collectIndices(cells, n, size, rect) {
    const result = [];
    const col1 = Math.max(0, Math.floor(rect.x / size));
    const col2 = Math.min(n - 1, Math.floor((rect.x + rect.width) / size));
    const row1 = Math.max(0, Math.floor(rect.y / size));
    const row2 = Math.min(n - 1, Math.floor((rect.y + rect.height) / size));
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        const t = row * n + col;
        if (cells[t]) {
          result.push(t);
        }
      }
    }
    return result;
  }
  /** rect 内被点亮的砖块子格索引 */
  brickIndicesIn(rect) {
    return this.collectIndices(this.bricks, N_MAP.BRICK, ITEM_SIZE_MAP.BRICK, rect);
  }
  /** rect 内被点亮的钢块子格索引 */
  steelIndicesIn(rect) {
    return this.collectIndices(this.steels, N_MAP.STEEL, ITEM_SIZE_MAP.STEEL, rect);
  }
  /** 砖块子格索引对应的像素矩形 */
  brickRectAt(t) {
    const size = ITEM_SIZE_MAP.BRICK;
    const n = N_MAP.BRICK;
    return { x: t % n * size, y: Math.floor(t / n) * size, width: size, height: size };
  }
  /** 钢块子格索引对应的像素矩形 */
  steelRectAt(t) {
    const size = ITEM_SIZE_MAP.STEEL;
    const n = N_MAP.STEEL;
    return { x: t % n * size, y: Math.floor(t / n) * size, width: size, height: size };
  }
  /** 移除若干砖块子格，有变动则 bump version */
  removeBricks(indices) {
    let changed = false;
    for (const t of indices) {
      if (this.bricks[t]) {
        this.bricks[t] = false;
        changed = true;
      }
    }
    if (changed) {
      this.version += 1;
    }
  }
  /** 移除若干钢块子格，有变动则 bump version */
  removeSteels(indices) {
    let changed = false;
    for (const t of indices) {
      if (this.steels[t]) {
        this.steels[t] = false;
        changed = true;
      }
    }
    if (changed) {
      this.version += 1;
    }
  }
  /** 摧毁老鹰 */
  destroyEagle() {
    this.eagleBroken = true;
  }
  /** 收集 rect 覆盖范围内的全部子格索引（不论是否点亮） */
  rangeIndices(n, size, rect) {
    const result = [];
    const col1 = Math.max(0, Math.floor(rect.x / size));
    const col2 = Math.min(n - 1, Math.floor((rect.x + rect.width) / size));
    const row1 = Math.max(0, Math.floor(rect.y / size));
    const row2 = Math.min(n - 1, Math.floor((rect.y + rect.height) / size));
    for (let row = row1; row <= row2; row += 1) {
      for (let col = col1; col <= col2; col += 1) {
        result.push(row * n + col);
      }
    }
    return result;
  }
  cellOverlaps(rectOfCell, excludes) {
    return excludes.some((e2) => testCollide(e2, rectOfCell, -0.1));
  }
  /**
   * shovel 道具：把老鹰四周的墙变为钢（mode='steel'）或砖（mode='brick'）。
   * excludes 为不应被墙覆盖的区域（老鹰本体、坦克）。
   */
  shovelConvert(mode, excludes) {
    if (this.eagle == null) {
      return;
    }
    const box = { x: this.eagle.x - 8, y: this.eagle.y - 8, width: 31, height: 31 };
    if (mode === "steel") {
      for (const t of this.rangeIndices(N_MAP.STEEL, ITEM_SIZE_MAP.STEEL, box)) {
        if (!this.cellOverlaps(this.steelRectAt(t), excludes)) {
          this.steels[t] = true;
        }
      }
      for (const t of this.rangeIndices(N_MAP.BRICK, ITEM_SIZE_MAP.BRICK, box)) {
        this.bricks[t] = false;
      }
    } else {
      for (const t of this.rangeIndices(N_MAP.BRICK, ITEM_SIZE_MAP.BRICK, box)) {
        if (!this.cellOverlaps(this.brickRectAt(t), excludes)) {
          this.bricks[t] = true;
        }
      }
      for (const t of this.rangeIndices(N_MAP.STEEL, ITEM_SIZE_MAP.STEEL, box)) {
        this.steels[t] = false;
      }
    }
    this.version += 1;
  }
};

// games/tank/src/vendor/engine/GameSession.ts
var CURTAIN_CLOSE = frame(30);
var MAP_LOAD_AT = CURTAIN_CLOSE + frame(20);
var CURTAIN_OPEN_AT = MAP_LOAD_AT + frame(20);
var ENTER_END = CURTAIN_OPEN_AT + frame(30);
var WON_DELAY = 4e3;
var DEAD_DELAY = 3e3;
var GAMEOVER_RISE_DURATION = 2e3;
var GAMEOVER_END = GAMEOVER_RISE_DURATION + 3e3;
var GameSession = class {
  constructor(stages2, startStageIndex, playerConfigs, audio, options) {
    this.stages = stages2;
    this.audio = audio;
    this.options = options;
    this.stageIndex = startStageIndex;
    this.players = playerConfigs.map((config) => ({
      ...config,
      lives: INITIAL_LIVES,
      score: 0,
      reservedTankLevel: null,
      pilot: "human",
      idleTime: 0,
      touchedThisStage: false
    }));
  }
  stages;
  audio;
  options;
  players;
  phase = "enter";
  /** 当前阶段已经历的逻辑时间（ms） */
  phaseTime = 0;
  stageIndex;
  /** 首关地图载入之前为 null */
  scene = null;
  statisticsAnimation = null;
  /** 出结果后到进入结算的剩余等待；null 表示本关尚未出结果 */
  endingTimer = null;
  /** 本关胜负确定那一刻各玩家是否为托管，结算页和结束页据此标注 CPU；胜负未定时为 null */
  stageEndAutopilot = null;
  get stage() {
    return this.stages[this.stageIndex];
  }
  /** 入场幕布闭合程度：0 完全打开，1 完全遮住战场 */
  /** 结算页的当前画面；不在结算阶段时为 null */
  get statistics() {
    return this.statisticsAnimation?.view ?? null;
  }
  get curtain() {
    if (this.phase !== "enter") {
      return 0;
    }
    if (this.phaseTime < CURTAIN_CLOSE) {
      return this.phaseTime / CURTAIN_CLOSE;
    }
    if (this.phaseTime < CURTAIN_OPEN_AT) {
      return 1;
    }
    return 1 - Math.min(1, (this.phaseTime - CURTAIN_OPEN_AT) / (ENTER_END - CURTAIN_OPEN_AT));
  }
  /** HUD 只在对战阶段显示（旧版 showHud / hideHud） */
  get hudVisible() {
    return this.phase === "playing";
  }
  /** GAME OVER 字样上升进度 0~1 */
  get gameoverProgress() {
    return this.phase === "gameover" ? Math.min(1, this.phaseTime / GAMEOVER_RISE_DURATION) : 0;
  }
  /** 打完了全部关卡 */
  cleared = false;
  get scores() {
    return this.players.map((p) => p.score);
  }
  /** 对局状态的纯数据快照，可直接 JSON 序列化；配合 textView 画成文本 */
  snapshot() {
    return {
      phase: this.phase,
      phaseTime: round(this.phaseTime),
      stageIndex: this.stageIndex,
      stageName: this.stage.name,
      cleared: this.cleared,
      stageEndAutopilot: this.stageEndAutopilot,
      players: this.players.map((p) => ({
        lives: p.lives,
        score: p.score,
        pilot: p.pilot,
        idleTime: round(p.idleTime),
        reservedTankLevel: p.reservedTankLevel
      })),
      scene: this.scene?.snapshot() ?? null
    };
  }
  step(delta, input) {
    this.phaseTime += delta;
    this.updatePilots(delta, input);
    switch (this.phase) {
      case "enter":
        this.stepEnter(delta);
        break;
      case "playing":
        this.stepPlaying(delta, input);
        break;
      case "statistics":
        this.stepStatistics(delta);
        break;
      case "gameover":
        this.scene?.step(delta, input);
        if (this.phaseTime >= GAMEOVER_END) {
          this.enterPhase("ended");
        }
        break;
      case "ended":
        break;
    }
  }
  /**
   * 任一阶段按了自己的绑定键就交还（包括结算页、入场幕布，这时按键只作为信号）；
   * 只有对战中、胜负未定、坦克可以操作时才累计空闲，阵亡等待时暂停不清零
   */
  updatePilots(delta, input) {
    if (!this.options.autopilot || this.phase === "ended") {
      return;
    }
    const scene = this.scene;
    const counting = this.phase === "playing" && scene != null && scene.status === "playing";
    this.players.forEach((player, i) => {
      if (input.touched(player.control) || input.held(player.control)) {
        player.pilot = "human";
        player.idleTime = 0;
        if (this.phase === "playing") {
          player.touchedThisStage = true;
        }
        return;
      }
      if (player.pilot === "autopilot" || !counting || !scene.controllable(i)) {
        return;
      }
      player.idleTime += delta;
      const limit = player.touchedThisStage ? AUTOPILOT_IDLE : AUTOPILOT_START;
      if (player.idleTime >= limit) {
        player.pilot = "autopilot";
      }
    });
  }
  enterPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
  }
  stepEnter(delta) {
    const prev = this.phaseTime - delta;
    if (prev < MAP_LOAD_AT && this.phaseTime >= MAP_LOAD_AT) {
      this.audio.play("stage_start");
      this.loadStage();
    }
    if (this.phaseTime >= ENTER_END) {
      this.endingTimer = null;
      this.stageEndAutopilot = null;
      for (const player of this.players) {
        player.idleTime = 0;
        player.touchedThisStage = false;
      }
      this.scene.start();
      this.enterPhase("playing");
    }
  }
  loadStage() {
    const raw = this.stage;
    this.scene = new BattleScene(
      TerrainMap.fromRaw(raw),
      this.audio,
      expandBots(parseStage(raw).bots),
      this.players,
      this.stageIndex + 1,
      this.options
    );
  }
  stepPlaying(delta, input) {
    const scene = this.scene;
    scene.step(delta, input);
    if (this.endingTimer == null) {
      if (scene.status !== "playing") {
        this.stageEndAutopilot = this.players.map((p) => p.pilot === "autopilot");
      }
      if (scene.status === "won") {
        this.endingTimer = WON_DELAY;
      } else if (scene.status === "lost") {
        if (scene.loseReason === "eagle") {
          this.startGameover();
          return;
        }
        this.endingTimer = DEAD_DELAY;
      }
      return;
    }
    this.endingTimer -= delta;
    if (this.endingTimer <= 0) {
      this.startStatistics(scene);
    }
  }
  startStatistics(scene) {
    this.statisticsAnimation = new StatisticsAnimation(
      this.stage.name,
      scene.killInfo,
      this.stageEndAutopilot
    );
    this.enterPhase("statistics");
  }
  stepStatistics(delta) {
    const animation = this.statisticsAnimation;
    animation.advance(delta, () => this.audio.play("statistics_1"));
    if (!animation.done) {
      return;
    }
    this.statisticsAnimation = null;
    const scene = this.scene;
    if (scene.status === "won") {
      scene.reserveTanks();
      if (this.stageIndex + 1 < this.stages.length) {
        this.stageIndex += 1;
        this.enterPhase("enter");
        return;
      }
      this.cleared = true;
      this.enterPhase("ended");
      return;
    }
    this.startGameover();
  }
  startGameover() {
    this.audio.play("game_over");
    this.enterPhase("gameover");
  }
};

// games/tank/src/vendor/input/InputManager.ts
var InputManager = class {
  down = /* @__PURE__ */ new Set();
  /** 当前仍按住的键，按最早→最新的顺序 */
  order = [];
  /** 自上次 consume 以来新按下的开火键（边沿） */
  firePressedSince = /* @__PURE__ */ new Set();
  /** releaseAll 时仍按着的键：松开之前都不算按下，自动重复的 keydown 也忽略 */
  suppressed = /* @__PURE__ */ new Set();
  /** 自上个 tick 起按过的键，含自动重复和被 suppress 的键；只用来判断玩家在不在场 */
  touchedSince = /* @__PURE__ */ new Set();
  /** 需要 preventDefault 的键：实际绑定的键位（空格、Tab 等有默认行为），外加方向键和 / */
  handledCodes;
  constructor(controls = []) {
    this.handledCodes = /* @__PURE__ */ new Set([...ALWAYS_HANDLED, ...controls.flatMap(controlCodes)]);
  }
  onKeyDown = (e2) => {
    this.keyDown(e2.code);
    if (this.handledCodes.has(e2.code)) {
      e2.preventDefault();
    }
  };
  onKeyUp = (e2) => {
    this.keyUp(e2.code);
    if (this.handledCodes.has(e2.code)) {
      e2.preventDefault();
    }
  };
  /** 按下一个键；DOM 事件走这里，无头运行（测试、回放）时直接调用。自动重复同样调用 */
  keyDown(code) {
    this.touchedSince.add(code);
    if (!this.down.has(code) && !this.suppressed.has(code)) {
      this.down.add(code);
      this.order.push(code);
      this.firePressedSince.add(code);
    }
  }
  keyUp(code) {
    this.down.delete(code);
    this.suppressed.delete(code);
    this.order = this.order.filter((c) => c !== code);
  }
  /** 切到别的窗口后松开的键收不到 keyup，失焦时当作全部松开 */
  onBlur = () => this.clear();
  attach(target = document) {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }
  detach(target = document) {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.clear();
  }
  /** 清空全部输入状态，包括 suppressed：不像 releaseAll 那样等 keyup，因为 keyup 可能永远不来 */
  clear() {
    this.down.clear();
    this.order = [];
    this.firePressedSince.clear();
    this.suppressed.clear();
    this.touchedSince.clear();
  }
  /** 把当前按着的键都视为已松开，需要重新按下才生效 */
  releaseAll() {
    for (const code of this.down) {
      this.suppressed.add(code);
    }
    this.down.clear();
    this.order = [];
    this.firePressedSince.clear();
    this.touchedSince.clear();
  }
  isDown(code) {
    return this.down.has(code);
  }
  /** 在 codes 中，当前仍按住且最近被按下的那个；都没按返回 null */
  lastPressed(codes) {
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      if (codes.includes(this.order[i])) {
        return this.order[i];
      }
    }
    return null;
  }
  /** 该玩家在本 tick 是否触发开火（持续按住 或 本 tick 内新按下） */
  consumeFire(control) {
    const held = this.down.has(control.fire);
    const edge = this.firePressedSince.has(control.fire);
    return held || edge;
  }
  /** 该玩家的开火键是否在本 tick 内新按下（不含持续按住） */
  firePressed(control) {
    return this.firePressedSince.has(control.fire);
  }
  /** 自上个 tick 起该玩家有没有按过任一绑定键 */
  touched(control) {
    return controlCodes(control).some((code) => this.touchedSince.has(code));
  }
  /** 该玩家是否有绑定键正按着，含 releaseAll 之后还没松开的 */
  held(control) {
    return controlCodes(control).some((code) => this.down.has(code) || this.suppressed.has(code));
  }
  /** 在每个逻辑 tick 末尾清空边沿标记 */
  endTick() {
    this.firePressedSince.clear();
    this.touchedSince.clear();
  }
};
var ALWAYS_HANDLED = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Slash"];

// games/tank/src/vendor/engine/random.ts
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// games/tank/src/vendor/stages/stage-1.json
var stage_1_default = {
  name: "1",
  difficulty: 1,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  Bf X  Bf X  Bf X  Bf X  Bf X  Bf X  ",
    "X  Bf X  Bf X  Bf X  Bf X  Bf X  Bf X  ",
    "X  Bf X  Bf X  Bf Tf Bf X  Bf X  Bf X  ",
    "X  Bf X  Bf X  B3 X  B3 X  Bf X  Bf X  ",
    "X  B3 X  B3 X  Bc X  Bc X  B3 X  B3 X  ",
    "Bc X  Bc Bc X  B3 X  B3 X  Bc Bc X  Bc ",
    "T3 X  B3 B3 X  Bc X  Bc X  B3 B3 X  T3 ",
    "X  Bc X  Bc X  Bf Bf Bf X  Bc X  Bc X  ",
    "X  Bf X  Bf X  Bf X  Bf X  Bf X  Bf X  ",
    "X  Bf X  Bf X  B3 X  B3 X  Bf X  Bf X  ",
    "X  Bf X  Bf X  B8 Bc B4 X  Bf X  Bf X  ",
    "X  X  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["18*basic", "2*fast"]
};

// games/tank/src/vendor/stages/stage-2.json
var stage_2_default = {
  name: "2",
  difficulty: 1,
  map: [
    "X  X  X  Tf X  X  X  Tf X  X  X  X  X  ",
    "X  B3 X  Tf X  X  X  Bf X  Bf X  Bf X  ",
    "X  Bf X  X  X  X  Bf BF X  Bf Tf BF X  ",
    "X  X  X  Bf X  X  X  X  X  Tf X  X  X  ",
    "F  X  X  BF X  X  TF X  X  BF F  BF TF ",
    "F  F  X  X  X  BF X  X  TF X  F  X  X  ",
    "X  BF BF BF F  F  F  TF X  X  F  BF X  ",
    "X  X  X  TF F  BF X  BF X  BF X  BF X  ",
    "TF BF X  TF X  BF X  BF X  X  X  BF X  ",
    "X  BF X  BF X  BF BF BF X  BF TF BF X  ",
    "X  BF X  BF X  BF BF BF X  X  X  X  X  ",
    "X  BF X  X  X  B8 BC B4 X  BF X  BF X  ",
    "X  BF X  BF X  BA EE B5 X  BF BF BF X  "
  ],
  bots: ["2*armor", "4*fast", "14*basic"]
};

// games/tank/src/vendor/stages/stage-3.json
var stage_3_default = {
  name: "3",
  difficulty: 1,
  map: [
    "X  X  X  X  BF X  X  X  BF X  X  X  X  ",
    "X  F  F  F  BF X  X  X  X  X  TC TC TC ",
    "BF F  F  F  X  X  X  X  X  X  X  X  X  ",
    "F  F  F  F  X  X  X  BF X  BF BF BF B5 ",
    "F  F  F  F  BF BF BF B3 X  BF X  BA X  ",
    "F  F  F  F  X  X  BF X  X  X  X  BA X  ",
    "X  F  X  X  X  X  TF TF TF X  X  F  X  ",
    "X  BC X  BF X  X  X  X  X  F  F  F  F  ",
    "BF B5 BA BF B5 BC B3 B3 B3 F  F  F  F  ",
    "X  X  X  X  X  BF X  BC BC F  F  F  F  ",
    "BF X  X  T5 X  X  X  B3 B3 F  F  F  X  ",
    "BF BF X  T5 X  B8 BC B4 X  F  F  F  X  ",
    "TF BF BF X  X  BA EE B5 X  BF X  X  X  "
  ],
  bots: ["14*basic", "4*fast", "2*armor"]
};

// games/tank/src/vendor/stages/stage-4.json
var stage_4_default = {
  name: "4",
  difficulty: 1,
  map: [
    "X  F  F  X  X  X  X  X  X  X  X  F  X  ",
    "F  F  X  X  Bc Bf Bf Bc Bc X  X  X  F  ",
    "F  X  X  Ba Bf Bf Bf Bf Bf Bf Bc X  T3 ",
    "T3 X  X  Bf Bf Bf Bf Bf Bf Bf Bf B5 X  ",
    "X  X  Ba B3 X  X  X  B3 Bf Bf X  B5 X  ",
    "R  X  Ba X  T5 X  T5 X  Bf B5 X  X  X  ",
    "X  X  Bf X  Bc Bc X  X  Bf B5 X  R  R  ",
    "X  X  Bf Bf Bf Bf Bf Bf Bf Bf X  X  X  ",
    "X  Ba Bf Bf Bf Bf Bf Bf Bf Bf B5 X  X  ",
    "X  B3 B3 Bf Bf Bf Bf Bf Bf B3 B3 X  X  ",
    "X  Bf Bf Bc B3 Bf Bf B3 Bc Bf Bf X  F  ",
    "F  X  B3 B3 X  B8 Bc B4 B3 B3 X  F  F  ",
    "Tf F  X  X  X  Ba E  B5 X  X  F  F  Tf "
  ],
  bots: ["10*power", "5*fast", "2*basic", "3*armor"]
};

// games/tank/src/vendor/stages/stage-5.json
var stage_5_default = {
  name: "5",
  difficulty: 1,
  map: [
    "X  X  X  X  Bf Bf X  X  X  X  X  X  X  ",
    "Tc X  Bc X  Bf X  X  X  T3 T3 Tf X  X  ",
    "Tf X  Bf X  X  X  Bf X  X  X  X  X  X  ",
    "Bf X  Bf Bf Bf X  Bf Bf X  R  R  X  R  ",
    "B3 X  X  X  B3 X  X  X  X  R  X  X  X  ",
    "X  X  Bc X  R  R  X  R  R  R  X  Bf Bf ",
    "Bf Bf X  X  R  Bf X  Bf Bf X  X  X  X  ",
    "X  X  X  X  R  X  X  X  X  X  Ta T5 X  ",
    "R  R  R  X  R  X  Tf X  Bf X  Ta X  X  ",
    "X  X  X  Bc Bc X  X  X  X  X  Ta Bf Bf ",
    "X  X  X  X  Bf B3 B3 B3 Bf Bc X  X  X  ",
    "Bf Bf B3 X  X  B8 Bc B4 X  B3 Bf X  X  ",
    "B3 X  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["5*power", "2*armor", "8*basic", "5*fast"]
};

// games/tank/src/vendor/stages/stage-6.json
var stage_6_default = {
  name: "6",
  difficulty: 1,
  map: [
    "X  X  X  X  X  Ba X  B5 F  F  X  X  X  ",
    "X  B5 Ta X  B5 X  X  X  Ba F  B5 Ba F  ",
    "X  B5 Ta X  B5 X  Bf X  Ba F  B5 Ba F  ",
    "X  Bf X  X  Bf X  Tf X  Bf F  X  Bf F  ",
    "X  X  X  Ba T3 X  Bf X  B3 T5 X  F  F  ",
    "Bf Bf B5 X  X  F  Bf F  X  X  Ba Bf Bf ",
    "X  X  X  X  Ba F  F  F  B5 X  X  X  X  ",
    "Tf Bf Bf X  B3 F  F  F  B3 Ba Bf Bf Tf ",
    "T3 T3 T3 X  Bc X  F  X  Bc X  T3 T3 T3 ",
    "X  Bf X  X  Bf X  X  X  Bf X  X  X  X  ",
    "X  Bf B5 X  X  B3 X  B3 X  X  Ba Bf F  ",
    "X  X  B3 X  X  B8 Bc B4 X  X  F  F  F  ",
    "X  X  Bc X  X  Ba E  B5 X  X  Bc F  F  "
  ],
  bots: ["7*power", "2*fast", "9*basic", "2*armor"]
};

// games/tank/src/vendor/stages/stage-7.json
var stage_7_default = {
  name: "7",
  difficulty: 2,
  map: [
    "X  X  X  X  X  X  X  T3 T3 X  X  X  X  ",
    "X  X  Tf T3 T3 T3 X  X  X  X  Tf X  X  ",
    "X  X  Tf X  X  X  F  X  T3 Tf Tf X  X  ",
    "X  Tf X  X  X  F  Tf X  X  X  Tf X  X  ",
    "X  X  X  X  F  Tf Tf X  X  X  T3 Tf X  ",
    "X  Tf X  F  Tf Tf Tf X  Tf X  X  X  X  ",
    "X  Ta X  Tf Tf X  X  X  Tf Tf X  X  X  ",
    "T5 X  X  X  Tf X  Tf Tf Tf X  X  Ta X  ",
    "X  Ta Tf X  X  X  Tf Tf F  X  X  Tf X  ",
    "X  Tf X  X  X  X  Tf F  X  X  Tf Tf X  ",
    "X  T3 T3 Tf X  X  F  X  X  Tf X  X  X  ",
    "X  X  X  X  X  B8 Bc B4 X  T3 X  Tc Tf ",
    "Tc Tc X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["3*basic", "4*fast", "6*power", "7*basic"]
};

// games/tank/src/vendor/stages/stage-8.json
var stage_8_default = {
  name: "8",
  difficulty: 3,
  map: [
    "X  X  Bf X  X  Bf X  Bc X  Bf X  X  X  ",
    "F  Bf Bf Bf X  Bf X  Tc X  Bf B5 X  X  ",
    "F  F  F  X  X  B3 X  Bf X  B3 X  Ba B5 ",
    "F  R  R  R  R  R  R  R  R  R  R  X  R  ",
    "X  Bf X  X  X  X  Bc Bc X  X  X  X  X  ",
    "X  X  Bf X  X  Ba Bf Bf B3 Bf B3 T3 T3 ",
    "Bf Bf X  Bf X  Ba Bf Bf F  Bf Tc Tc Bf ",
    "X  X  X  Tf X  Tc X  F  F  F  F  X  X  ",
    "R  R  X  R  R  R  R  R  X  R  R  R  R  ",
    "F  F  X  Ba X  X  Bc Bc X  X  X  X  X  ",
    "F  F  Bf X  B5 X  X  Ba X  Tc Bc Bf X  ",
    "F  Tc Bf X  B5 B8 Bc B4 X  B3 X  Bf X  ",
    "X  X  X  X  X  Ba E  B5 X  Bc X  B3 X  "
  ],
  bots: ["7*power", "2*armor", "4*fast", "7*basic"]
};

// games/tank/src/vendor/stages/stage-9.json
var stage_9_default = {
  name: "9",
  difficulty: 1,
  map: [
    "X  X  X  Bf X  X  X  X  X  Tc F  X  X  ",
    "Bf X  X  X  X  X  Tc F  Ta Tf T5 X  Bf ",
    "X  X  X  Tc F  Ta Tf T5 X  T3 F  X  X  ",
    "X  X  Ta Tf T5 X  T3 F  X  X  X  X  X  ",
    "X  X  X  T3 F  X  X  X  X  X  X  X  X  ",
    "X  X  X  F  Tc F  X  F  Tc F  X  X  X  ",
    "Tf Bf X  Ta Tf T5 X  Ta Tf T5 X  Bf Tf ",
    "X  X  X  F  T3 F  X  F  T3 F  X  X  X  ",
    "X  X  X  X  Tc X  X  X  Tc X  X  X  X  ",
    "Bf X  X  Ta Tf T5 X  Ta Tf T5 X  X  Bf ",
    "Bf X  X  F  T3 F  X  F  T3 F  X  X  Bf ",
    "X  X  Bc X  X  B8 Bc B4 X  X  Bc X  X  ",
    "X  X  Bf Bf X  Ba E  B5 X  Bf Bf X  X  "
  ],
  bots: ["6*fast", "4*fast", "7*power", "3*armor"]
};

// games/tank/src/vendor/stages/stage-10.json
var stage_10_default = {
  name: "10",
  difficulty: 1,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  Ba B3 Bf X  X  X  X  X  X  Bf B3 B5 ",
    "Ba B3 X  X  Bf X  F  F  X  Bf X  X  Ba ",
    "Bf X  X  X  Bf F  F  F  F  Bf X  X  Ba ",
    "Bf X  X  X  Bf F  Tf Tf F  Bf X  X  Bf ",
    "Ba Bc Bc Bf R  R  R  R  R  R  Bf Bf Bf ",
    "X  Bf Bf Bf Tf Tf Bf Tf Tf Bf Bf Bf B5 ",
    "X  X  Bf Bf Tf X  Bf X  Tf Bf Bf B5 X  ",
    "X  X  Bf Bf Bf Bf Bf Bf Bf Bf Bf B5 X  ",
    "Bf F  B3 B3 B3 Tf Tf B3 B3 B3 B3 F  Bf ",
    "Bf F  F  F  F  F  F  F  F  F  F  F  Bf ",
    "X  X  F  F  F  B8 Bc B4 F  F  F  F  X  ",
    "X  X  X  B5 X  Ba E  B5 X  X  B5 X  X  "
  ],
  bots: ["12*basic", "2*fast", "4*power", "2*armor"]
};

// games/tank/src/vendor/stages/stage-11.json
var stage_11_default = {
  name: "11",
  difficulty: 2,
  map: [
    "X  X  X  X  X  Tf X  Bf X  Bf Bf X  X  ",
    "X  Ba Bf Bf Bf Bf X  Bf X  X  X  X  X  ",
    "X  X  X  B5 X  Bf X  Bf Bf X  F  F  F  ",
    "X  Ba X  X  X  X  X  Tf X  F  F  F  F  ",
    "X  Ba X  Bf Bf Bf Tf Bf Bf F  F  B3 Tf ",
    "X  B3 B3 B3 Tf X  X  Bf X  F  F  X  Ba ",
    "Ba Bf Bf Bf X  Tf F  F  F  F  F  X  X  ",
    "X  X  X  Tf X  X  F  F  F  F  F  Bf X  ",
    "Tf Bf X  F  F  F  F  Tf F  F  F  Bf X  ",
    "Ba Bf F  F  F  F  F  X  X  X  X  Bf B5 ",
    "X  Bf F  F  X  X  X  X  T3 Bf Bf Bf X  ",
    "X  X  F  F  X  B8 Bc B4 X  Bf X  Ba X  ",
    "X  Bc F  F  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["5*fast", "6*armor", "4*power", "5*fast"]
};

// games/tank/src/vendor/stages/stage-12.json
var stage_12_default = {
  name: "12",
  difficulty: 1,
  map: [
    "X  X  X  X  X  X  X  Bf Bf Bf X  X  X  ",
    "X  Bf Bf Bf Bc X  Bc X  X  Bf X  X  X  ",
    "X  X  X  X  Bf X  B3 X  X  X  X  Bf Bf ",
    "X  R  R  R  R  R  X  Bf B5 X  X  Bf T3 ",
    "X  X  Tc Tc Tc R  X  Bf X  Tf T5 Bf X  ",
    "Bf X  Bf Bf Bf R  R  R  X  R  Bf Bf X  ",
    "X  X  X  X  Tf R  X  X  X  R  T3 X  X  ",
    "R  R  R  X  R  R  Bf Bf X  R  X  X  X  ",
    "X  X  X  X  X  Bf T3 T3 X  R  R  R  X  ",
    "Bf Bf Bf X  X  X  X  X  X  X  X  X  X  ",
    "X  X  Bf X  T3 T3 X  X  X  Bf Bf X  Ba ",
    "Bf X  X  X  X  B8 Bc B4 X  Bf X  X  Bf ",
    "X  X  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["8*power", "6*fast", "6*armor"]
};

// games/tank/src/vendor/stages/stage-13.json
var stage_13_default = {
  name: "13",
  difficulty: 3,
  map: [
    "X  X  X  X  Bc X  X  X  Bc X  X  X  X  ",
    "X  Bf Bf Bf Bf X  X  X  Bf Bf Bf Bf X  ",
    "X  Bf X  X  X  X  Bf X  X  X  X  Tf X  ",
    "X  Tf X  Bf B3 X  X  X  B3 Bf X  Bf Bf ",
    "X  Bf X  B5 F  Tc Tf Tc F  Ba X  Tf Bf ",
    "X  B3 X  X  F  F  F  F  F  X  X  T3 Bf ",
    "Bf Tc X  X  F  F  F  F  F  X  X  Bc Bf ",
    "Bf Tf X  B5 F  T3 Tf T3 F  Ba X  Bf X  ",
    "Bf Bf X  Bf Bc X  X  X  Bc Bf X  Tf X  ",
    "Bf Tf X  X  X  X  Bf X  X  X  X  Bf X  ",
    "Bf Bf Bf Bf Bf X  X  X  Bf Bf Bf Tf Tf ",
    "Bf Bf X  X  B3 B8 Bc B4 B3 X  X  Bf X  ",
    "Bf Bf X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["8*power", "8*fast", "4*armor"]
};

// games/tank/src/vendor/stages/stage-14.json
var stage_14_default = {
  name: "14",
  difficulty: 3,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "F  F  X  X  Bc Bf Bf Bf Bc X  X  F  F  ",
    "F  X  X  Ba Bf Bf Bf Bf Bf B5 X  X  F  ",
    "X  X  X  Bf Bf F  Bf F  Bf Bf X  X  X  ",
    "X  X  X  Bf F  F  Bf F  F  Bf X  X  X  ",
    "F  X  X  Bf Bf Bf Bf Bf Bf Bf X  X  F  ",
    "F  F  X  X  Bf F  Bf F  Bf X  X  F  F  ",
    "R  R  R  X  Bf Bf Bf Bf Bf X  R  R  R  ",
    "X  X  X  X  Ba Ba Ba Ba Ba X  X  X  X  ",
    "X  X  X  X  B5 B5 B5 B5 B5 X  X  X  X  ",
    "Ta Ta Ta X  X  X  X  X  X  X  T5 T5 T5 ",
    "B5 B5 B5 X  X  B8 Bc B4 X  X  Ba Ba Ba ",
    "T5 T5 T5 Ta X  Ba E  B5 X  T5 Ta Ta Ta "
  ],
  bots: ["10*power", "4*fast", "6*armor"]
};

// games/tank/src/vendor/stages/stage-15.json
var stage_15_default = {
  name: "15",
  difficulty: 2,
  map: [
    "X  X  X  X  Bf Bf X  X  Bf X  X  X  X  ",
    "X  F  F  Bf Bf X  X  X  Bf X  X  X  X  ",
    "F  F  F  F  F  F  F  F  Bf Bf X  X  X  ",
    "F  T3 Bf F  Bf Bf Bf F  F  F  F  Bf Tf ",
    "F  F  Bf F  F  F  T3 F  F  Bf T5 Bf X  ",
    "X  F  F  Bf Tc F  F  F  F  Bf X  Bf X  ",
    "X  Bf Bf Bf Bf Bf F  F  Bf Bf B5 F  F  ",
    "Ta T3 Bf Bf X  X  X  Bf B3 X  X  X  F  ",
    "X  Bf X  Bf X  Tc Bc B3 F  F  Bf B5 F  ",
    "X  Bf X  X  Ba Bf B3 F  F  Bf X  X  F  ",
    "X  Bf Bf B5 Ba B3 F  F  Bc F  Bf F  F  ",
    "X  X  Bf X  F  B8 Bc B4 Bf F  B3 F  X  ",
    "X  X  B3 X  X  Ba E  B5 X  F  F  F  X  "
  ],
  bots: ["2*basic", "10*fast", "8*armor"]
};

// games/tank/src/vendor/stages/stage-16.json
var stage_16_default = {
  name: "16",
  difficulty: 1,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  X  Tf F  Tf X  X  X  X  X  X  X  X  ",
    "X  X  X  F  X  F  Tc X  X  X  X  X  X  ",
    "X  F  X  X  X  X  F  Bc X  X  X  X  X  ",
    "X  F  F  X  X  F  X  F  Tc X  X  X  X  ",
    "X  F  X  F  X  F  X  X  F  Bc X  X  X  ",
    "X  F  X  X  F  X  X  X  F  F  Tc X  X  ",
    "X  X  F  X  X  X  X  F  F  F  F  Bc X  ",
    "X  X  X  F  X  X  F  X  F  F  F  F  X  ",
    "Bf X  X  X  X  X  F  X  X  F  F  F  Tf ",
    "Bf Bf X  X  X  X  X  F  X  F  F  F  F  ",
    "Tf Bf Bf X  X  B8 Bc B4 F  X  F  F  F  ",
    "Tf Tf Bf Bf X  Ba E  B5 F  X  X  F  F  "
  ],
  bots: ["16*basic", "2*fast", "2*armor"]
};

// games/tank/src/vendor/stages/stage-17.json
var stage_17_default = {
  name: "17",
  difficulty: 2,
  map: [
    "X  X  X  X  Bc X  X  X  X  X  Bc X  X  ",
    "X  Bf X  Bf Bf X  X  S  S  S  Bf Bf X  ",
    "X  Bf X  X  Bf X  Tf S  S  S  S  S  X  ",
    "S  S  S  T5 Bf X  X  Bf S  S  S  S  X  ",
    "S  S  S  S  S  S  Bf Bf Ba B5 X  X  X  ",
    "X  X  Ta S  S  S  S  Bf Ba B5 X  T3 T3 ",
    "Bf Bf Bf Bf S  S  S  S  S  S  S  Bf Bf ",
    "X  X  X  Bf Bf S  S  S  S  T5 X  X  X  ",
    "X  Bf Bf Bf X  S  S  S  Bf Bf X  Bf X  ",
    "S  S  S  Bf S  X  X  X  X  Bf X  Bf X  ",
    "S  S  S  S  S  T3 X  T3 X  X  Bc Bf X  ",
    "Bf S  S  S  S  B8 Bc B4 X  Bf X  X  X  ",
    "Bf Bf T5 X  X  Ba E  B5 X  Bf X  Bf X  "
  ],
  bots: ["2*armor", "2*fast", "8*armor", "8*basic"]
};

// games/tank/src/vendor/stages/stage-18.json
var stage_18_default = {
  name: "18",
  difficulty: 2,
  map: [
    "X  X  X  X  X  X  X  X  Tf Tf Tf F  X  ",
    "X  Bf X  X  X  X  X  X  Tf X  X  Tf X  ",
    "Bf F  Bf X  X  X  Bf Bf Bf Bf X  Tf X  ",
    "X  Bf F  Bf X  X  Bf X  F  Bf Tf Tf X  ",
    "X  X  Bf X  F  Tf Bf F  X  Bf X  X  X  ",
    "X  X  X  X  Tf X  Bf Tf Bf Bf X  X  X  ",
    "X  X  Bf Bf Tf Bf X  Tf X  X  X  X  X  ",
    "X  X  Bf X  F  Bf Tf F  X  X  X  X  X  ",
    "Tf Tf Tf F  X  Bf X  X  Bf Bf X  X  X  ",
    "Tf X  Bf Bf Bf Bf X  X  Bf Tf Tf X  X  ",
    "Tf X  X  Tf X  X  X  X  X  Tf Bf Bf X  ",
    "F  Tf Tf Tf X  B8 Bc B4 X  X  Bf Tf Tf ",
    "X  X  X  X  X  Ba E  B5 X  X  X  Tf Tf "
  ],
  bots: ["4*armor", "2*basic", "6*power", "8*fast"]
};

// games/tank/src/vendor/stages/stage-19.json
var stage_19_default = {
  name: "19",
  difficulty: 3,
  map: [
    "X  Bf X  Bf X  Bf X  Bf X  Bf X  Bf X  ",
    "X  Bf X  Bf X  Bf X  Bf X  Bf X  Bf X  ",
    "X  T3 X  T3 X  T3 X  T3 X  T3 X  T3 X  ",
    "Bc X  Bc X  Bf X  X  X  Bf X  Bc X  Bc ",
    "Bf X  Bf B3 Bf X  Bf X  Bf B3 Bf X  Bf ",
    "T3 X  T3 X  Tf X  T3 X  Tf X  T3 X  T3 ",
    "F  F  X  X  Bf X  F  X  Bf X  X  F  F  ",
    "F  F  F  F  Bf B3 F  B3 Bf F  F  F  F  ",
    "F  F  F  F  F  F  F  F  F  F  F  F  F  ",
    "Bc X  Bc X  Bf F  F  F  Bf X  Bc X  Bc ",
    "X  Bf X  Bf X  X  F  X  X  Bf X  Bf X  ",
    "X  Bf X  Bf X  B8 Bc B4 X  Bf X  Bf X  ",
    "X  B3 X  B3 X  Ba E  B5 X  B3 X  B3 X  "
  ],
  bots: ["4*fast", "8*armor", "4*basic", "4*power"]
};

// games/tank/src/vendor/stages/stage-20.json
var stage_20_default = {
  name: "20",
  difficulty: 4,
  map: [
    "X  X  X  R  X  Bf X  X  Bf X  Bf X  X  ",
    "X  X  X  X  X  X  X  X  Bf X  Tf X  X  ",
    "X  X  X  R  X  Bc Tf X  Bf X  Bf X  X  ",
    "T3 X  Bf R  X  Tf X  Bc B3 X  Bf X  X  ",
    "X  X  Bf R  X  X  X  Bf X  X  X  X  X  ",
    "Bf X  Bf R  R  X  R  R  R  R  X  X  Bf ",
    "X  X  X  Bc X  X  X  F  X  R  X  T3 T3 ",
    "Bf Bf Ba Bf X  Tf F  F  F  R  X  Bc Bc ",
    "B3 X  Ba X  X  Bf F  F  F  R  X  Bf X  ",
    "X  Tc X  X  X  Bf X  F  X  R  X  F  X  ",
    "X  Bf X  Tc X  B3 B3 B3 X  X  F  F  F  ",
    "X  Bf X  Bf X  B8 Bc B4 X  R  F  F  F  ",
    "X  X  X  X  X  Ba E  B5 X  R  X  F  X  "
  ],
  bots: ["8*fast", "2*basic", "2*power", "8*armor"]
};

// games/tank/src/vendor/stages/stage-21.json
var stage_21_default = {
  name: "21",
  difficulty: 3,
  map: [
    "X  X  X  Bc Bc Bc X  X  Bc X  X  X  X  ",
    "X  Bc Bf Bf Bf Bf Bf Bf Bf Bf X  X  X  ",
    "X  F  F  F  F  F  F  F  F  Bf Bf X  X  ",
    "F  F  X  X  X  X  X  X  F  F  Bf Bf X  ",
    "F  X  Tf X  X  Tf X  X  X  F  F  F  X  ",
    "F  X  Tf X  X  Tf X  X  X  F  F  F  X  ",
    "F  X  X  F  X  X  X  X  F  F  Bf Bf B5 ",
    "F  F  F  F  F  F  F  F  F  Bf Bf Bf B5 ",
    "Bf F  F  Bf Bf F  F  F  Bf Bf Bf Bf X  ",
    "X  Bf Bf Bf Bf Bf Bf Bf Bf Bf Bf X  Tf ",
    "Tf X  Bf Tf Bf Bf Bf Bf Bf Bf B5 X  Tf ",
    "X  Tf Bf B3 Tf B8 Bc B4 Bf Bf Tf Tf Tf ",
    "X  X  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["8*power", "2*fast", "6*basic", "4*armor"]
};

// games/tank/src/vendor/stages/stage-22.json
var stage_22_default = {
  name: "22",
  difficulty: 3,
  map: [
    "X  X  X  X  X  F  X  X  X  X  X  X  X  ",
    "X  X  X  X  F  Tf F  X  X  X  X  X  X  ",
    "X  X  F  X  X  F  X  X  F  F  X  X  X  ",
    "X  F  Bf F  X  X  X  F  Bf Bf F  X  X  ",
    "X  X  F  Bf F  X  X  X  F  F  X  X  F  ",
    "F  X  X  F  X  X  F  X  X  X  X  F  Tf ",
    "Bf F  X  X  X  F  Tf F  X  X  F  X  F  ",
    "Tf Bf F  X  X  X  F  X  X  F  Tf F  X  ",
    "Bf F  X  X  F  X  X  X  F  X  F  X  X  ",
    "F  X  X  F  Bf F  X  F  Bf F  X  X  X  ",
    "X  X  X  F  Bf F  X  X  F  X  X  F  X  ",
    "X  F  X  X  F  B8 Bc B4 X  X  F  Tf F  ",
    "F  Tf F  X  X  Ba E  B5 X  F  Bf F  X  "
  ],
  bots: ["8*fast", "6*basic", "2*power", "4*armor"]
};

// games/tank/src/vendor/stages/stage-23.json
var stage_23_default = {
  name: "23",
  difficulty: 2,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  X  X  X  X  Tf Tf X  X  X  X  X  X  ",
    "X  X  X  X  X  X  Tf X  X  X  X  X  X  ",
    "X  Tf Tf F  F  Bf Tf Bf F  F  Tf Tf X  ",
    "X  X  X  Tf F  F  Tf F  F  Tf X  X  X  ",
    "F  X  X  X  Tf F  F  F  Tf X  X  X  F  ",
    "Tf F  X  X  X  F  F  F  X  X  X  F  Tf ",
    "F  X  X  X  Tc T3 F  T3 Tc X  X  X  F  ",
    "X  X  X  X  Tf X  Tc X  Tf X  X  X  X  ",
    "X  X  X  Tf X  X  Tf X  X  Tf X  X  X  ",
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  X  X  X  X  B8 Bc B4 X  X  X  X  X  ",
    "X  X  Tf X  X  Ba E  B5 X  X  Tf X  X  "
  ],
  bots: ["6*armor", "4*power", "10*fast"]
};

// games/tank/src/vendor/stages/stage-24.json
var stage_24_default = {
  name: "24",
  difficulty: 3,
  map: [
    "X  X  Tf X  Bf T3 X  X  X  X  Ba X  X  ",
    "X  X  Bf X  Bf F  X  B3 Bf Bf Bf X  X  ",
    "X  F  F  X  Bf F  Ba B5 X  X  X  Tf Tf ",
    "F  F  F  F  F  F  Bf Bf Bf X  Ba Bf X  ",
    "X  X  F  F  Bc Bc T3 Bf X  Ba Bf B3 Ba ",
    "Bf T3 X  Bc B3 B3 X  X  X  Bf B3 X  Ba ",
    "Ba X  Bc Bf S  S  S  S  S  S  S  S  S  ",
    "Ba X  B3 X  S  S  S  S  S  S  S  S  S  ",
    "X  X  Tf X  S  S  S  S  S  S  S  S  S  ",
    "Bf X  Bf X  S  S  S  S  S  S  S  S  S  ",
    "Ba X  Bf X  S  S  S  S  S  S  S  S  S  ",
    "Ba X  Bf X  X  B8 Bc B4 S  S  S  S  S  ",
    "X  X  B3 X  X  Ba E  B5 X  S  S  S  S  "
  ],
  bots: ["4*power", "2*armor", "4*fast", "10*basic"]
};

// games/tank/src/vendor/stages/stage-25.json
var stage_25_default = {
  name: "25",
  difficulty: 3,
  map: [
    "X  X  X  Tf X  Bf X  Bf X  Bf X  Tf X  ",
    "X  Bf X  Bf X  X  X  X  X  Tf X  X  X  ",
    "X  Bf X  Bf X  X  Tf X  X  Tf X  Tf Tf ",
    "X  Bf X  X  X  Bf X  Tf Bf X  X  X  Tf ",
    "X  X  X  X  Bf Bf X  Bf Bf X  Tf X  X  ",
    "X  X  Tf X  Bf X  X  Bf Bf X  Bf Bf X  ",
    "Tf X  Tf X  X  Bf X  Tf X  X  Tf Bf X  ",
    "X  X  Bf Bf X  Bf X  X  X  Bf Tf X  X  ",
    "X  Tf Bf Bf X  Bf Bf X  Bf Bf X  X  Bf ",
    "X  Bf X  X  X  Bf Tf X  X  X  X  Bf Bf ",
    "X  X  X  Bf X  Bf Bf Tf X  Tf X  X  Bf ",
    "Bf X  Bf Bf X  B8 Bc B4 X  Bf Tf X  X  ",
    "Bf X  Bf X  X  Ba E  B5 X  Bf Bf Bf X  "
  ],
  bots: ["2*power", "8*fast", "10*armor"]
};

// games/tank/src/vendor/stages/stage-26.json
var stage_26_default = {
  name: "26",
  difficulty: 2,
  map: [
    "X  X  R  R  X  X  X  X  X  X  X  X  X  ",
    "Tc X  X  R  F  X  B5 X  X  X  X  X  X  ",
    "F  Tc X  X  X  X  T5 X  B5 X  R  R  X  ",
    "F  F  X  T3 Bc Ba X  X  T5 F  R  X  X  ",
    "F  F  F  X  X  Tf Bc Ba X  X  X  X  Tc ",
    "F  F  T3 Tc X  Ba X  Tf Bc X  X  Tc F  ",
    "F  T3 X  X  B3 Tf X  Ba X  T3 X  F  F  ",
    "X  X  X  X  X  B5 B3 Tf X  X  F  F  F  ",
    "X  X  R  F  Ta X  X  B5 B3 Tc T3 F  F  ",
    "X  R  R  X  Ba X  Ta X  X  X  X  X  F  ",
    "X  X  X  X  X  X  Ba X  F  R  X  X  T3 ",
    "Tf X  X  X  X  B8 Bc B4 X  R  R  X  X  ",
    "Tf Tf X  X  X  Ba E  B5 X  X  X  X  Tf "
  ],
  bots: ["6*fast", "6*armor", "4*basic", "4*power"]
};

// games/tank/src/vendor/stages/stage-27.json
var stage_27_default = {
  name: "27",
  difficulty: 4,
  map: [
    "X  X  X  X  Tf X  X  X  X  X  X  X  X  ",
    "Tf Tf X  X  Tf X  X  Tf Tf X  X  X  X  ",
    "X  Tf X  X  Tf X  X  X  Tf X  Tf Tf F  ",
    "X  Tf X  X  Tf Tf Tf X  F  X  Tf X  X  ",
    "X  Bf X  X  X  X  Tf X  Tf Tf Tf X  X  ",
    "F  Tf Tf X  Tf Bf Tf Bf Bf X  X  X  X  ",
    "X  X  Tf F  Tf F  X  X  Bf X  X  Tf Tf ",
    "X  X  Tf X  X  F  X  X  Tf X  X  Tf X  ",
    "X  X  Bf X  X  Tf X  X  Tf Tf Bf Tf X  ",
    "F  Tf Tf Tf F  F  Bf Tf Tf X  Bf Tf X  ",
    "X  X  X  Bf X  X  X  X  F  F  X  Bf X  ",
    "X  X  X  Tf X  B8 Bc B4 X  F  X  Bf X  ",
    "X  X  X  Tf X  Ba E  B5 X  Tf X  Bf X  "
  ],
  bots: ["2*power", "8*armor", "8*fast", "2*basic"]
};

// games/tank/src/vendor/stages/stage-28.json
var stage_28_default = {
  name: "28",
  difficulty: 3,
  map: [
    "X  X  X  X  X  X  X  X  X  X  Ta T5 X  ",
    "X  X  X  X  X  X  Tc X  X  X  Tf X  X  ",
    "X  X  X  X  X  Bc F  Bc X  Bf B5 X  X  ",
    "X  X  X  X  Tc F  F  F  Tc Bf B5 X  X  ",
    "X  X  X  Bc F  F  S  F  F  Bf B5 X  X  ",
    "X  X  Tc F  F  S  S  S  F  F  B5 X  X  ",
    "X  Bc F  F  S  S  S  S  S  F  F  Bc X  ",
    "Tc F  F  S  S  S  S  S  S  S  F  F  Tc ",
    "F  F  S  S  S  S  S  S  S  S  S  F  F  ",
    "X  F  S  S  S  S  S  S  S  S  S  F  X  ",
    "X  F  S  S  S  S  S  S  S  S  S  F  X  ",
    "X  F  S  S  S  B8 Bc B4 S  S  S  F  X  ",
    "X  F  S  S  X  Ba E  B5 X  S  S  F  X  "
  ],
  bots: ["2*fast", "1*armor", "15*basic", "2*power"]
};

// games/tank/src/vendor/stages/stage-29.json
var stage_29_default = {
  name: "29",
  difficulty: 3,
  map: [
    "X  X  X  X  X  X  X  X  X  X  Bf X  X  ",
    "X  Bf R  R  X  Tf X  Bf X  X  X  X  X  ",
    "X  X  R  R  Bf F  F  F  R  R  X  Tf X  ",
    "X  X  X  X  X  F  F  F  R  R  Bf X  X  ",
    "X  Tf X  X  R  R  X  F  X  X  X  X  X  ",
    "F  F  Bf X  R  R  Tf X  X  X  X  Bf X  ",
    "F  F  F  X  X  X  X  X  X  Tf X  X  Tf ",
    "X  Bf R  R  X  Bf X  X  X  X  X  X  X  ",
    "Tf X  R  R  F  F  R  R  F  F  X  Bf X  ",
    "X  X  X  X  F  X  R  R  F  F  R  R  X  ",
    "X  X  X  Tf F  X  X  X  F  F  R  R  X  ",
    "X  X  Bf X  Bf B8 Bc B4 X  X  X  X  X  ",
    "Bf X  X  X  X  Ba E  B5 X  Bf Tf X  X  "
  ],
  bots: ["10*power", "4*fast", "6*armor"]
};

// games/tank/src/vendor/stages/stage-30.json
var stage_30_default = {
  name: "30",
  difficulty: 2,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  X  X  X  X  Bc Bc X  X  X  Tc X  X  ",
    "X  Tc Tc X  Bc F  F  Tc X  Bc F  Bc X  ",
    "Bc F  F  Bc F  F  F  F  Bc F  F  F  Bc ",
    "F  F  F  F  F  F  F  F  F  F  F  F  F  ",
    "Tf F  R  F  F  F  F  F  R  F  F  F  F  ",
    "F  F  R  R  R  F  F  F  R  R  R  F  Tf ",
    "F  F  F  F  R  F  Tf F  F  F  R  F  F  ",
    "F  F  F  F  F  F  F  F  F  F  F  F  F  ",
    "F  F  F  F  F  B3 B3 F  F  F  F  F  T3 ",
    "T3 F  F  F  B3 X  X  B3 F  F  F  T3 X  ",
    "X  T3 B3 B3 X  B8 Bc B4 B3 B3 B3 X  X  ",
    "X  X  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["4*basic", "8*fast", "4*power", "4*armor"]
};

// games/tank/src/vendor/stages/stage-31.json
var stage_31_default = {
  name: "31",
  difficulty: 2,
  map: [
    "X  X  X  R  X  X  X  X  R  X  X  X  X  ",
    "R  R  X  R  X  R  R  R  R  X  R  R  R  ",
    "F  F  Bf X  X  Bf X  X  R  X  R  F  R  ",
    "F  R  R  R  R  X  Tf X  X  Bf F  F  F  ",
    "F  F  X  R  X  X  R  X  R  R  R  R  F  ",
    "R  R  X  R  X  R  R  X  X  R  X  X  X  ",
    "X  X  Bf F  Bf X  Bf F  X  R  X  X  R  ",
    "X  R  R  F  R  R  R  R  X  F  Bf X  R  ",
    "Bf X  X  Bf X  X  R  X  F  F  R  X  R  ",
    "R  R  X  R  R  X  R  Bf R  R  R  X  X  ",
    "X  X  Bf X  F  F  X  X  F  R  X  X  R  ",
    "X  R  R  R  F  B8 Bc B4 X  R  X  R  R  ",
    "X  R  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["3*power", "8*fast", "6*armor", "3*power"]
};

// games/tank/src/vendor/stages/stage-32.json
var stage_32_default = {
  name: "32",
  difficulty: 3,
  map: [
    "S  S  S  S  S  S  X  S  S  S  S  S  S  ",
    "S  S  S  S  S  S  S  S  S  S  S  S  S  ",
    "S  S  S  Bf S  S  S  S  S  Bf S  S  S  ",
    "S  Bf X  Bf X  Bf S  Bf X  Bf X  Bf S  ",
    "S  B3 B3 Bf X  X  X  X  X  Bf B3 B3 S  ",
    "S  S  S  Bf Bc Bf Tf Bf Bc Bf S  S  S  ",
    "Tf S  S  S  X  T3 X  T3 X  S  S  S  Tf ",
    "S  S  S  S  X  Bc X  Bc X  S  S  S  S  ",
    "S  S  S  S  X  Bf X  Bf X  S  S  S  S  ",
    "S  S  S  Bf X  X  Bc X  X  Bf S  S  S  ",
    "S  Bf S  Bf X  T3 T3 T3 X  Bf S  Bf S  ",
    "X  Bf Bc Bf X  B8 Bc B4 X  Bf Bc Bf X  ",
    "X  B3 X  X  X  Ba E  B5 X  X  X  B3 X  "
  ],
  bots: ["8*armor", "6*basic", "2*power", "4*fast"]
};

// games/tank/src/vendor/stages/stage-33.json
var stage_33_default = {
  name: "33",
  difficulty: 3,
  map: [
    "X  X  X  X  Tf X  X  X  X  Tf X  X  X  ",
    "X  Tf X  X  X  Tf X  X  Tf F  F  X  X  ",
    "X  X  Tf X  X  X  X  Tf F  Tc T5 X  X  ",
    "X  X  X  Tf X  F  F  F  F  F  X  Ta X  ",
    "X  T5 X  X  Tf F  F  Tf F  X  X  Tf X  ",
    "X  T3 T5 F  X  Tf F  F  Tf X  X  Ta X  ",
    "X  X  F  F  F  F  F  X  X  Tf X  X  X  ",
    "X  Tc T5 F  X  Tf F  X  X  X  Tf X  X  ",
    "X  F  F  F  Tf X  Tf X  Tc X  X  Tf X  ",
    "F  F  F  Tf X  X  X  X  Ta X  X  X  X  ",
    "X  X  Tf X  X  X  X  X  X  X  X  Ta Tf ",
    "X  X  X  X  X  B8 Bc B4 X  Tc T5 X  X  ",
    "T5 X  Tc X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["4*fast", "8*armor", "4*power", "4*fast"]
};

// games/tank/src/vendor/stages/stage-34.json
var stage_34_default = {
  name: "34",
  difficulty: 4,
  map: [
    "X  X  X  X  B5 Ba X  X  X  X  X  X  X  ",
    "B5 B5 B5 Ba X  B5 X  X  B5 B5 X  X  X  ",
    "B5 B5 B5 Bf Bf X  X  X  B5 Bf B5 X  X  ",
    "Ba Ba X  Bf B5 X  X  Ba B5 Bf Bf X  X  ",
    "X  B5 X  Bf Ba B5 X  B5 Bf Bf Bf X  X  ",
    "X  B5 Ba X  X  Bf B5 Bf Ba Ba Bf X  X  ",
    "X  B5 X  X  Ba Bf Bf B5 X  B5 Bf X  X  ",
    "X  Ba X  X  B5 Bf Bf B5 X  B5 Bf X  X  ",
    "X  Ba B3 B3 X  Bf Bf Bf X  B5 B5 B3 Bf ",
    "X  Ba X  X  Ba B5 Bf Ba B5 B5 B5 Ba Ba ",
    "X  X  B5 X  Bf Ba B5 Bf Bf X  X  Ba X  ",
    "X  X  B5 Ba B5 B8 Bc B4 Bf B5 X  B5 X  ",
    "X  X  B5 Ba X  Ba E  B5 X  Bf Bf X  X  "
  ],
  bots: ["4*power", "10*fast", "6*armor"]
};

// games/tank/src/vendor/stages/stage-35.json
var stage_35_default = {
  name: "35",
  difficulty: 2,
  map: [
    "X  X  X  X  X  X  X  X  X  X  X  X  X  ",
    "X  X  X  X  Bf X  Bf X  X  X  X  X  X  ",
    "F  X  X  F  Bf F  Bf F  X  X  F  X  X  ",
    "Bf F  F  Bf Bf Bf Bf Bf F  F  Bf F  X  ",
    "Bf Bf Bf Bf Tf Bf Tf Bf Bf Bf Bf F  X  ",
    "R  R  R  Bf Bf Bf Bf Bf R  R  R  F  X  ",
    "R  Bf Bf Bf Bf Bf Bf Bf Bf Bf R  R  F  ",
    "Bf Bf Bf R  Bf Bf Bf R  Bf Bf Bf F  F  ",
    "Bf Bf R  R  R  Bf R  R  R  Bf Bf R  R  ",
    "F  R  R  F  F  F  F  F  R  R  F  R  F  ",
    "X  F  F  X  X  X  X  X  F  F  X  F  X  ",
    "X  X  X  X  X  B8 Bc B4 X  X  X  X  X  ",
    "X  X  X  X  X  Ba E  B5 X  X  X  X  X  "
  ],
  bots: ["4*power", "6*fast", "10*armor"]
};

// games/tank/src/vendor/stages/index.ts
var stages = [stage_1_default, stage_2_default, stage_3_default, stage_4_default, stage_5_default, stage_6_default, stage_7_default, stage_8_default, stage_9_default, stage_10_default, stage_11_default, stage_12_default, stage_13_default, stage_14_default, stage_15_default, stage_16_default, stage_17_default, stage_18_default, stage_19_default, stage_20_default, stage_21_default, stage_22_default, stage_23_default, stage_24_default, stage_25_default, stage_26_default, stage_27_default, stage_28_default, stage_29_default, stage_30_default, stage_31_default, stage_32_default, stage_33_default, stage_34_default, stage_35_default];

// games/tank/src/engine.ts
var LEVEL_COUNT = 35;
var WIDTH = 256;
var HEIGHT = 240;
var TICK_MS = 1e3 / 60;
var TITLE = "\u5766\u514B\u5927\u6218";
var STORAGE = "fish-tank";
var MODES = [["classic", "\u7ECF\u5178 \xB7 3 \u8F86\u5766\u514B"]];
var CHEAT_OPTIONS = [
  { key: "infiniteLives", label: "\u65E0\u9650\u5766\u514B", description: "\u9635\u4EA1\u540E\u6301\u7EED\u91CD\u751F\uFF1B\u8001\u9E70\u57FA\u5730\u4ECD\u9700\u4FDD\u62A4\u3002" },
  { key: "rapidFire", label: "\u8D85\u7EA7\u8FDE\u53D1", description: "\u6309\u4F4F\u5F00\u706B\u9AD8\u901F\u53D1\u5C04\uFF0C\u6700\u591A\u540C\u65F6 8 \u53D1\u73A9\u5BB6\u5B50\u5F39\u3002" },
  { key: "autoPowerUps", label: "\u81EA\u52A8\u968F\u673A\u9053\u5177", description: "\u6218\u6597\u4E2D\u6BCF 8 \u79D2\u5728\u8EAB\u8FB9\u7A7A\u5730\u751F\u6210\u968F\u673A\u9053\u5177\u3002" }
];
var normalizeCheats = (raw = {}) => Object.fromEntries(CHEAT_OPTIONS.map((o) => [o.key, raw?.[o.key] === true]));
var isAssisted = (g) => g.assisted === true;
function setCheat(g, key, enabled) {
  if (!CHEAT_OPTIONS.some((o) => o.key === key) || typeof enabled !== "boolean") return false;
  g.cheats[key] = enabled;
  if (enabled) g.assisted = true;
  if (key === "autoPowerUps") g.nextCheatDrop = g.clock + 8e3;
  return true;
}
function spawnRandomPowerUp(g) {
  const scene = g.session.scene, player = scene?.tanks.find((t) => t.side === "player" && t.alive);
  if (!["running", "paused"].includes(g.status) || g.session.phase !== "playing" || scene?.status !== "playing" || !player) return null;
  const positions = [];
  const world = { map: scene.map, tanks: [], restrictedAreas: [] };
  for (let y = 0; y <= 192; y += 8) for (let x = 0; x <= 192; x += 8) {
    const d = Math.hypot(x - player.x, y - player.y);
    if (d < 20 || d > 56 || scene.powerUps.some((p) => !p.dead && Math.hypot(p.x - x, p.y - y) < 16)) continue;
    if (canTankMove(world, { rect: () => ({ x, y, width: 16, height: 16 }) })) positions.push({ x, y });
  }
  const pos = positions.length ? positions[Math.floor(g.cheatRandom() * positions.length)] : { x: player.x, y: player.y };
  const names = ["tank", "star", "grenade", "timer", "helmet", "shovel"], name = names[Math.floor(g.cheatRandom() * names.length)];
  if (scene.powerUps.length >= 6) scene.powerUps.splice(0, scene.powerUps.length - 5);
  scene.powerUps.push(new PowerUp(name, pos.x, pos.y));
  g.assisted = true;
  g.events.push({ type: "sound", name: "powerup_appear" });
  return name;
}
var levelInfo = (level) => ({ name: `STAGE ${String(level).padStart(2, "0")}`, kind: "base-defense", description: "\u5B88\u536B\u8001\u9E70 \xB7 \u51FB\u9000 20 \u8F86\u654C\u519B" });
function newGame({ level = 1, seed = Date.now(), platform = "pc", mode = "classic", cheats = {}, assisted = false, players = 1 } = {}) {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT || !["pc", "mobile"].includes(platform) || mode !== "classic" || ![1, 2].includes(players)) throw Error("Invalid tank options");
  let g;
  const session = new GameSession(
    stages,
    level - 1,
    [{ control: PLAYER1_CONTROL, color: "yellow", spawnPos: PLAYER_SPAWN_POS.player1 }, ...players === 2 ? [{ control: PLAYER2_CONTROL, color: "green", spawnPos: PLAYER_SPAWN_POS.player2 }] : []],
    { play: (name) => g?.events.push({ type: "sound", name }) },
    { autopilot: false, random: seededRandom(seed) }
  );
  const options = normalizeCheats(cheats);
  g = { version: 1, level, seed, platform, mode, status: "ready", clock: 0, score: 0, lives: 3, events: [], session, players, input: new InputManager(players === 2 ? [PLAYER1_CONTROL, PLAYER2_CONTROL] : [PLAYER1_CONTROL]), accumulator: 0, lastVictory: 0, cheats: options, assisted: assisted === true || Object.values(options).some(Boolean), cheatRandom: seededRandom(Number(seed) >>> 0 ^ 1632582066), nextCheatDrop: 8e3 };
  return g;
}
function start(g) {
  if (["ready", "paused"].includes(g.status)) g.status = "running";
}
function pause(g) {
  if (g.status === "running") {
    g.status = "paused";
    for (const control of [PLAYER1_CONTROL, PLAYER2_CONTROL]) for (const key of Object.values(control)) g.input.keyUp(key);
  }
}
function step(g, milliseconds, command = {}) {
  g.events = [];
  if (g.status !== "running" || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
  const commands = g.players === 2 ? [command.p1 || {}, command.p2 || {}] : [command];
  for (let i = 0; i < commands.length; i++) {
    const control = i === 0 ? PLAYER1_CONTROL : PLAYER2_CONTROL, c = commands[i];
    for (const [action, code] of Object.entries(control)) if (!c[action]) g.input.keyUp(code);
    for (const action of c.order || Object.keys(control)) if (c[action] && action in control) g.input.keyDown(control[action]);
  }
  g.accumulator += Math.min(100, milliseconds);
  while (g.accumulator + 1e-8 >= TICK_MS && g.status === "running") {
    const before = g.session.scene;
    g.session.players[0].infiniteLives = g.cheats.infiniteLives;
    if (g.cheats.infiniteLives && before?.status === "playing" && !before.tanks.some((t) => t.side === "player" && t.alive) && !before.flickers.some((f) => f.tank.side === "player")) g.session.players[0].lives = Math.max(1, g.session.players[0].lives);
    for (const t of before?.tanks || []) if (t.side === "player") {
      t.rapidFire = g.cheats.rapidFire;
      if (t.rapidFire) t.cooldown = Math.min(t.cooldown, 75);
    }
    g.session.step(TICK_MS, g.input);
    g.input.endTick();
    g.clock += TICK_MS;
    g.accumulator = Math.max(0, g.accumulator - TICK_MS);
    const s = g.session, scene = s.scene;
    g.score = s.players[0].score;
    g.lives = s.players[0].lives + (scene?.tanks.some((t) => t.side === "player" && t.alive) || scene?.flickers.some((f) => f.tank.side === "player") ? 1 : 0);
    if (scene?.status === "won" && g.lastVictory !== g.level) {
      g.lastVictory = g.level;
      g.events.push({ type: "levelclear", level: g.level });
    }
    if (g.level !== s.stageIndex + 1) {
      g.level = s.stageIndex + 1;
      g.events.push({ type: "level", level: g.level });
    }
    if (s.phase === "ended") {
      g.status = s.cleared ? "won" : "lost";
      g.events.push({ type: g.status });
    }
    if (!g.cheats.autoPowerUps) g.nextCheatDrop = g.clock + 8e3;
    else if (s.phase === "playing" && scene?.status === "playing" && g.clock >= g.nextCheatDrop) {
      spawnRandomPowerUp(g);
      g.nextCheatDrop = g.clock + 8e3;
    }
  }
}
var serialize = (g) => JSON.stringify({ version: 1, level: g.level, seed: g.seed, platform: g.platform, mode: g.mode, status: "ready", cheats: g.cheats, assisted: g.assisted });
function restore(raw, platform) {
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (d.version !== 1 || platform && platform !== d.platform) return null;
    return newGame(d);
  } catch {
    return null;
  }
}
function snapshot(g) {
  return { level: g.level, status: g.status, clock: g.clock, score: g.score, lives: g.lives, ...g.session.snapshot() };
}
function view(g) {
  const p = g.session.scene?.tanks.find((t) => t.side === "player");
  return { x: p?.x || 0, y: p?.y || 0, projectiles: g.session.scene?.bullets.length || 0 };
}
function summary(g) {
  const scene = g.session.scene;
  return { weapon: scene?.tanks.find((t) => t.side === "player")?.level || "basic", enemies: scene?.remainingBotCount ?? 20, objective: "\u4FDD\u62A4\u8001\u9E70\u57FA\u5730", phase: g.session.phase };
}
export {
  Bullet,
  CHEAT_OPTIONS,
  GameSession,
  HEIGHT,
  InputManager,
  LEVEL_COUNT,
  MODES,
  PLAYER1_CONTROL,
  PLAYER2_CONTROL,
  PowerUp,
  STORAGE,
  TICK_MS,
  TITLE,
  Tank,
  TerrainMap,
  WIDTH,
  expandBots,
  isAssisted,
  levelInfo,
  newGame,
  normalizeCheats,
  parseStage,
  pause,
  restore,
  seededRandom,
  serialize,
  setCheat,
  snapshot,
  spawnRandomPowerUp,
  stages,
  start,
  step,
  summary,
  view
};
