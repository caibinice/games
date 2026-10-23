import { newDuel, stepDuel } from './duel.mjs';
export async function loadGame(id) {
  if (id === 'lianliankan') return {};
  if (id === 'tank') {
    const [engine, renderer] = await Promise.all([
      import('../../../games/tank/public/engine.mjs'),
      import('../../../games/tank/public/renderer.mjs'),
    ]);
    return { engine, renderer, assets: await renderer.loadAssets() };
  }
  if (id === 'contra') {
    const [engine, renderer] = await Promise.all([
      import('../../../games/contra/public/engine.mjs'),
      import('../../../games/contra/public/renderer.mjs'),
    ]);
    return { engine, renderer, assets: await renderer.loadAssets() };
  }
  const [engine, renderer] = await Promise.all([
    import('../../../games/paopaotang/public/engine.mjs'),
    import('../../../games/paopaotang/public/renderer.mjs'),
  ]);
  return { engine, renderer };
}
export function createGame(id, modules, room) {
  if (id === 'lianliankan') return newDuel(room.seed);
  const options = {
    platform: 'pc',
    level: room.level,
    seed: room.seed,
    players: 2,
    mode: id === 'paopaotang' ? 'duo' : 'classic',
  };
  const g = id === 'contra' ? modules.engine.newCoopGame(options) : modules.engine.newGame(options);
  modules.engine.start(g);
  return g;
}
export function advance(id, m, g, ms, inputs) {
  if (id === 'lianliankan') return stepDuel(g, ms);
  if (id === 'contra') return m.engine.stepCoop(g, ms, { p1: inputs[0], p2: inputs[1] });
  m.engine.step(g, ms, { p1: inputs[0], p2: inputs[1] });
}
const terrainCache = new WeakMap();
function terrainBits(map) {
  const cached = terrainCache.get(map);
  if (cached?.version === map.version) return cached.bits;
  const bits = Object.fromEntries(
    ['bricks', 'steels', 'rivers', 'snows', 'forests'].map((k) => [
      k,
      [map[k].length, ...map[k].flatMap((v, i) => (v ? [i] : []))],
    ]),
  );
  terrainCache.set(map, { version: map.version, bits });
  return bits;
}
const rounded = (object) =>
  Object.fromEntries(
    Object.entries(object).map(([k, v]) => [
      k,
      typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v,
    ]),
  );
const CONTRA_FIELDS = [
  'level',
  'kind',
  'status',
  'clock',
  'score',
  'lives',
  'cheats',
  'multiplayer',
  'cameraX',
  'cameraY',
  'room',
  'roomOpen',
  'transitionUntil',
  'bossActive',
  'bossDefeatedAt',
];
const CONTRA_ARRAYS = [
  'bridges',
  'hazards',
  'movingPlatforms',
  'enemies',
  'bullets',
  'enemyBullets',
  'pickups',
  'capsules',
  'explosions',
  'cores',
];
export function capture(id, g) {
  if (id === 'tank') {
    const s = g.session,
      scene = s.scene;
    return {
      level: g.level,
      status: g.status,
      clock: g.clock,
      score: g.score,
      lives: g.lives,
      cheats: {},
      session: {
        phase: s.phase,
        curtain: s.curtain,
        gameoverProgress: s.gameoverProgress,
        players: s.players,
        scene: scene
          ? {
              map: {
                bits: terrainBits(scene.map),
                eagle: scene.map.eagle,
                eagleBroken: scene.map.eagleBroken,
                version: scene.map.version,
              },
              time: scene.time,
              remainingBotCount: scene.remainingBotCount,
              tanks: scene.tanks,
              bullets: scene.bullets,
              powerUps: scene.powerUps.map((p) => ({ ...p, visible: p.visible })),
              flickers: scene.flickers.map((f) => ({ x: f.x, y: f.y, shapeValue: f.shape() })),
              explosions: scene.explosions.map((e) => ({
                cx: e.cx,
                cy: e.cy,
                shapeValue: e.shape(),
              })),
              scorePopups: scene.scorePopups.map((p) => ({ ...p, visible: p.visible })),
              killInfo: scene.killInfo,
            }
          : null,
      },
    };
  }
  if (id === 'contra')
    return {
      ...Object.fromEntries(CONTRA_FIELDS.map((k) => [k, g[k]])),
      player: rounded(g.player),
      p2: { ...g.p2, player: rounded(g.p2.player) },
      boss: g.boss && rounded(g.boss),
      ...Object.fromEntries(CONTRA_ARRAYS.map((k) => [k, g[k].map(rounded)])),
      events: [],
    };
  return { ...g, events: [] };
}
export function hydrate(id, m, frame) {
  if (id === 'tank' && frame.session.scene) {
    const s = frame.session.scene;
    const packed = s.map;
    s.map = Object.assign(Object.create(m.engine.TerrainMap.prototype), packed);
    for (const [key, [length, ...indices]] of Object.entries(packed.bits || {})) {
      s.map[key] = Array(length).fill(false);
      for (const index of indices) s.map[key][index] = true;
    }
    delete s.map.bits;
    for (const f of [...s.flickers, ...s.explosions]) f.shape = () => f.shapeValue;
  }
  if (id === 'contra') frame.stage = m.engine.STAGES[frame.level - 1];
  return frame;
}
export function participants(id, g) {
  if (!g) return [];
  if (id === 'lianliankan')
    return g.players.map((p, slot) => ({
      slot,
      value: p.board.filter(Boolean).length + ' 张',
      detail: p.matched + ' 对',
    }));
  if (id === 'paopaotang')
    return g.players
      .filter((p) => p.team === 0)
      .map((p, slot) => ({
        slot,
        value: { active: '行动中', trapped: '被困！', out: '已出局' }[p.status],
        detail: '水泡 ' + p.capacity + ' · 威力 ' + p.power,
      }));
  if (id === 'contra')
    return [g.player, g.p2.player].map((p, slot) => ({
      slot,
      value: p.out ? '已阵亡' : (slot ? g.p2.lives : g.lives) + ' 命',
      detail: p.weapon,
    }));
  return g.session.players.map((p, slot) => ({
    slot,
    value: p.lives + ' 辆后备',
    detail: p.score + ' 分',
  }));
}
export function draw(id, m, canvas, g, age = 0) {
  if (!canvas || !g || id === 'lianliankan') return;
  if (id === 'paopaotang') return m.renderer.drawArena(canvas, g, g.clock + age, g.clock + age);
  if (canvas.width !== 256) canvas.width = 256;
  const h = id === 'tank' ? 240 : 224;
  if (canvas.height !== h) canvas.height = h;
  m.renderer.draw(canvas, g, m.assets);
  if (id === 'tank' && g.session.scene) {
    const c = canvas.getContext('2d');
    c.font = '6px monospace';
    for (const t of g.session.scene.tanks.filter((t) => t.side === 'player' && t.alive)) {
      c.fillStyle = t.color === 'green' ? '#8effc1' : '#ffe17b';
      c.fillText(t.color === 'green' ? '2P' : '1P', t.x + 11, t.y + 12);
    }
  }
}
