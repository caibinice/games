import { describe, it, expect, vi } from 'vitest';
import * as Engine from '../games/contra/public/engine.mjs';
import * as Tank from '../games/tank/public/engine.mjs';
import { capture, hydrate } from '../web/src/online/adapters.mjs';
import { ContraPrediction } from '../web/src/online/prediction.mjs';
import { SnapshotPresentation } from '../web/src/online/presentation.mjs';
import { RoomClient } from '../web/src/online/client.mjs';
import { draw } from '../games/contra/public/renderer.mjs';
const tick = 1000 / 60;
const world = (level = 1) => {
  const g = Engine.newCoopGame({ level, seed: 12 });
  Engine.start(g);
  return g;
};
const copy = (g) =>
  hydrate('contra', { engine: Engine }, JSON.parse(JSON.stringify(capture('contra', g))));
describe('Prediction and reconciliation without changing authoritative outcomes', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('P2 movement/jump/fire reuses level %i physics', (level) => {
    const g = world(level),
      prediction = new ContraPrediction(Engine);
    prediction.reconcile(copy(g), null, 0);
    const cmd = { right: true, jump: true, fire: true };
    prediction.input(cmd, 0);
    for (let i = 0; i < 12; i++) {
      Engine.stepCoop(g, tick, { p2: cmd });
      prediction.advance(tick);
    }
    expect(prediction.state.p2.player.x).toBeCloseTo(g.p2.player.x, 1);
    expect(prediction.state.p2.player.y).toBeCloseTo(g.p2.player.y, 1);
    expect(prediction.state.bullets.length).toBeGreaterThan(0);
  });
  it('responds before the first acknowledged input and ignores pre-input snapshots', () => {
    const g = world(),
      p = new ContraPrediction(Engine);
    p.reconcile(copy(g), null, 0);
    p.input({ right: true, jump: true }, 10);
    p.advance(tick);
    expect(p.state.p2.player.x).toBeGreaterThan(56);
    expect(p.state.p2.player.y).toBeLessThan(96);
    p.reconcile(copy(g), null, 30);
    expect(p.state.p2.player.x).toBeGreaterThan(56);
  });
  it('replays unacknowledged commands under 360 ms round trip and releases immediately', () => {
    const g = world(),
      p = new ContraPrediction(Engine),
      packets = [];
    p.reconcile(copy(g), null, 0);
    p.input({ right: true }, 0);
    let command = {},
      ack = null;
    for (let i = 1; i <= 90; i++) {
      const now = i * tick;
      if (i === 12) {
        command = { right: true };
        ack = { at: 0, clock: g.clock };
      }
      if (i === 36) p.input({}, now);
      if (i === 48) {
        command = {};
        ack = { at: 36 * tick, clock: g.clock };
      }
      Engine.stepCoop(g, tick, { p2: command });
      if (i % 3 === 0) packets.push({ at: now + 180, g: copy(g), ack: ack && { ...ack } });
      while (packets[0]?.at <= now) {
        const q = packets.shift();
        p.reconcile(q.g, q.ack, now);
      }
      p.advance(tick);
      const expected = 56 + Math.min(now, 600) * 0.09;
      expect(Math.abs(p.state.p2.player.x - expected)).toBeLessThan(5);
    }
    expect(Math.abs(p.state.p2.player.x - g.p2.player.x)).toBeLessThan(3);
  });
  it('prediction never awards a pickup, damages players, advances AI or changes the source', () => {
    const g = world(),
      raw = JSON.stringify(g),
      p = new ContraPrediction(Engine);
    p.reconcile(copy(g), null, 0);
    p.input({ right: true, fire: true }, 0);
    p.advance(100);
    expect(JSON.stringify(g)).toBe(raw);
    expect(p.state.score).toBe(g.score);
    expect(p.state.lives).toBe(g.lives);
    expect(p.state.enemies).toEqual(g.enemies);
  });
  it('death/respawn and room transitions override speculation without locally reviving', () => {
    const g = world(),
      p = new ContraPrediction(Engine);
    p.reconcile(copy(g), null, 0);
    p.input({ right: true }, 0);
    p.advance(100);
    g.p2.player.deadUntil = 900;
    p.reconcile(copy(g), { at: 0, clock: 0 }, 100);
    p.advance(1000);
    expect(p.state.p2.player.deadUntil).toBe(900);
    expect(p.apply(g)).toBe(g);
    g.p2.player.deadUntil = 0;
    g.p2.player.x = 40;
    p.reconcile(copy(g), { at: 0, clock: 0 }, 1500);
    expect(p.state.p2.player.x).toBe(40);
    g.room++;
    g.p2.player.x = 152;
    p.reconcile(copy(g), { at: 0, clock: 0 }, 1600);
    expect(p.state.p2.player.x).toBe(152);
  });
  it('replay and correction history stay bounded across long stalls', () => {
    const g = world(),
      p = new ContraPrediction(Engine);
    p.reconcile(copy(g), null, 0);
    for (let i = 0; i < 400; i++) p.input({ right: i % 2 === 0 }, i * 10);
    expect(p.history.length).toBeLessThanOrEqual(128);
    p.reconcile(copy(g), { at: 0, clock: 0 }, 100000);
    expect(p.state.clock).toBeLessThanOrEqual(g.clock + 1001);
  });
});
describe('Smooth render snapshots and bounded transport', () => {
  it('new explosions and deaths are renderable even before their interpolated birth time', () => {
    const g = world();
    g.clock = 0;
    g.player.deadUntil = 950;
    g.explosions = [{ x: 50, y: 50, bornAt: 50 }];
    const context = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}) });
    const rects = new Proxy({}, { get: () => ({ x: 0, y: 0, w: 1, h: 1 }) });
    expect(() =>
      draw({ getContext: () => context }, g, { atlas: {}, rects, maps: Array(9).fill({}) }),
    ).not.toThrow();
  });
  it('worker game clock starts/stops independently of requestAnimationFrame', async () => {
    vi.useFakeTimers();
    const postMessage = vi.fn(),
      worker = { postMessage };
    vi.stubGlobal('self', worker);
    await import('../web/src/online/clock-worker.mjs');
    worker.onmessage({ data: true });
    vi.advanceTimersByTime(1000);
    expect(postMessage.mock.calls.length).toBeGreaterThanOrEqual(59);
    worker.onmessage({ data: false });
    const count = postMessage.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(postMessage).toHaveBeenCalledTimes(count);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('interpolates remote poses each render frame without mutating snapshots', () => {
    const a = world(),
      b = copy(a);
    b.clock = 50;
    b.player.x += 4.5;
    const s = new SnapshotPresentation('contra');
    s.receive(copy(a), 0);
    s.receive(b, 50);
    const values = [50, 60, 70, 80, 90, 100].map((now) => s.sample(now).player.x);
    expect(values).toEqual([...values].sort((x, y) => x - y));
    expect(new Set(values).size).toBe(6);
    expect(b.player.x).toBe(36.5);
    expect(s.sample(5000).player.x).toBeLessThanOrEqual(41);
  });
  it('does not interpolate a respawn or a different room through walls', () => {
    const a = world(),
      b = copy(a);
    b.clock = 50;
    b.player.x = 200;
    const s = new SnapshotPresentation('contra');
    s.receive(a, 0);
    s.receive(b, 50);
    expect(s.sample(50).player.x).toBe(200);
    const next = { ...b, room: 1 };
    s.receive(next, 100);
    expect(s.sample(100)).toBe(next);
  });
  it('sends materially smaller Contra frames and retains prediction/render fields', () => {
    const g = world();
    for (let i = 0; i < 600; i++)
      Engine.stepCoop(g, tick, { p1: { fire: true }, p2: { fire: true } });
    const old = JSON.stringify({ ...g, stage: undefined, events: [] }),
      packed = capture('contra', g);
    expect(JSON.stringify(packed).length).toBeLessThan(old.length * 0.8);
    expect(copy(g).p2.jumpHeld).toBe(g.p2.jumpHeld);
    expect(packed.spawned).toBeUndefined();
  });
  it('caches tank terrain only while the terrain version is unchanged', () => {
    const g = Tank.newGame({ players: 2 });
    Tank.start(g);
    for (let i = 0; i < 180; i++) Tank.step(g, tick, {});
    const first = capture('tank', g).session.scene.map.bits;
    expect(capture('tank', g).session.scene.map.bits).toBe(first);
    const map = g.session.scene.map;
    map.removeBricks([map.bricks.findIndex(Boolean)]);
    expect(capture('tank', g).session.scene.map.bits).not.toBe(first);
  });
  it('drops stale snapshots before serializing when the socket is congested, not controls', () => {
    vi.stubGlobal('WebSocket', { OPEN: 1 });
    const send = vi.fn(),
      c = new RoomClient(
        () => {},
        () => {},
      );
    c.socket = { readyState: 1, bufferedAmount: 25000, send };
    expect(
      c.send({
        type: 'frame',
        get state() {
          throw Error('should not serialize');
        },
      }),
    ).toBe(false);
    expect(c.send({ type: 'input', input: { right: true } })).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
