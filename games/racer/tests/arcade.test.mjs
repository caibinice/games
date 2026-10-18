import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as E from '../public/engine.mjs';
const tick = (g, t, input = {}) => {
  for (let i = 0; i < Math.ceil(t * 60); i++) E.step(g, 1 / 60, input);
};
const running = () => {
  const g = E.newGame();
  E.start(g);
  g.spawnAt = 1e9;
  return g;
};
describe('Arcade items and input', () => {
  it('direct clicks move exactly one lane and quick double clicks move twice', () => {
    const g = running();
    E.changeLane(g, -1);
    expect(g.lane).toBe(0);
    tick(g, 0.2);
    expect(g.x).toBe(E.LANES[0]);
    E.changeLane(g, 1);
    E.changeLane(g, 1);
    expect(g.lane).toBe(2);
    tick(g, 0.3);
    expect(g.x).toBe(E.LANES[2]);
  });
  it('black devil reverses both button and stepped keyboard direction, then expires', () => {
    const g = running();
    E.collectItem(g, 'reverse');
    E.changeLane(g, -1);
    expect(g.lane).toBe(2);
    E.changeLane(g, 1);
    expect(g.lane).toBe(1);
    E.step(g, 1 / 60, { right: true });
    expect(g.lane).toBe(0);
    tick(g, 7.1);
    E.changeLane(g, 1);
    expect(g.lane).toBe(1);
    expect(g.effects.reverse).toBe(0);
  });
  it('nitro is a toggle, not a held input, and turning it off stops energy drain', () => {
    const g = running();
    expect(E.toggleBoost(g)).toBe('on');
    const initial = g.energy;
    tick(g, 1);
    expect(g.boost).toBe(1);
    expect(g.energy).toBeLessThan(initial);
    expect(E.toggleBoost(g)).toBe('off');
    const e = g.energy;
    tick(g, 1);
    expect(g.boost).toBe(0);
    expect(g.energy).toBeGreaterThan(e);
  });
  it('holding Shift toggles only once, a second press turns nitro off', () => {
    const g = running();
    tick(g, 1, { boost: true });
    expect(g.nitroEnabled).toBe(true);
    E.step(g, 1 / 60);
    E.step(g, 1 / 60, { boost: true });
    expect(g.nitroEnabled).toBe(false);
  });
  it('full speed is free, locked and ends without leaving manual nitro on', () => {
    const g = running();
    g.energy = 12;
    E.toggleBoost(g);
    E.collectItem(g, 'fullSpeed');
    expect(g.nitroEnabled).toBe(false);
    expect(E.toggleBoost(g)).toBe('locked');
    tick(g, 3);
    expect(g.energy).toBeGreaterThanOrEqual(12);
    expect(g.boost).toBe(1);
    tick(g, 5.2);
    expect(g.effects.fullSpeed).toBe(0);
    expect(g.boost).toBe(0);
  });
  it('nitro exhaustion turns it off instead of rapidly oscillating at zero', () => {
    const g = running();
    g.energy = 4;
    E.toggleBoost(g);
    tick(g, 1);
    expect(g.nitroEnabled).toBe(false);
    tick(g, 2);
    expect(g.nitroEnabled).toBe(false);
    expect(g.energy).toBeGreaterThan(0);
  });
  it('ghost ignores every obstacle including a long truck, and expiry has an exit grace', () => {
    for (const type of Object.keys(E.OBSTACLES)) {
      const g = running();
      E.collectItem(g, 'ghost');
      g.objects = [{ id: 1, type, x: 0, z: 2, passed: false }];
      tick(g, 0.4);
      expect(g.hp).toBe(3);
    }
    const g = running();
    g.effects.ghost = 0.01;
    E.step(g, 1 / 60);
    expect(g.invulnerable).toBeGreaterThan(0.5);
  });
  it('long trucks hit even at the jump apex and only damage once through their full length', () => {
    const g = running();
    E.activateJet(g);
    tick(g, 0.8);
    g.objects = [{ id: 1, type: 'truck', x: 0, z: g.distance, passed: false }];
    E.step(g, 1 / 60);
    expect(g.hp).toBe(2);
    tick(g, 1.5);
    expect(g.hp).toBe(2);
    expect(E.obstacleHits({ type: 'truck', x: 0 }, 100)).toBe(true);
  });
  it('truck tails remain collidable beyond the old centre-only collision window', () => {
    const g = running();
    g.objects = [{ id: 1, type: 'truck', x: 0, z: -9, passed: false }];
    E.step(g, 1 / 60);
    expect(g.hp).toBe(2);
    const b = running();
    b.objects = [{ id: 1, type: 'truck', x: 0, z: -14, passed: false }];
    E.step(b, 1 / 60);
    expect(b.hp).toBe(3);
  });
  it('gate has a ground opening but posts and airborne beam remain dangerous', () => {
    expect(E.obstacleHits({ type: 'gate', x: 0 }, 0, 0)).toBe(false);
    expect(E.obstacleHits({ type: 'gate', x: 0 }, 0, 1)).toBe(true);
    expect(E.obstacleHits({ type: 'gate', x: 0 }, 2, 0)).toBe(true);
  });
  it('pause freezes effects, cooldown and fuel while preserving nitro switch', () => {
    const g = running();
    E.collectItem(g, 'reverse');
    E.toggleBoost(g);
    E.activateJet(g);
    E.pause(g);
    const before = structuredClone(g);
    tick(g, 3);
    expect(g.effects).toEqual(before.effects);
    expect(g.cooldown).toBe(before.cooldown);
    expect(g.energy).toBe(before.energy);
    expect(g.nitroEnabled).toBe(true);
  });
  it('repeated pickup durations are capped and repair is bounded', () => {
    const g = running();
    for (let n = 0; n < 20; n++) {
      E.collectItem(g, 'reverse');
      E.collectItem(g, 'ghost');
      E.collectItem(g, 'fullSpeed');
      E.collectItem(g, 'repair');
    }
    expect(g.hp).toBe(3);
    for (const k of ['reverse', 'ghost', 'fullSpeed'])
      expect(g.effects[k]).toBeLessThanOrEqual(E.ITEMS[k].duration * 1.75);
  });
  it('pickup collision consumes once and activates the corresponding effect', () => {
    for (const type of ['reverse', 'ghost', 'fullSpeed']) {
      const g = running();
      g.objects = [{ id: 1, type, x: 0, z: 2, passed: false }];
      tick(g, 0.1);
      expect(g.effects[type]).toBeGreaterThan(E.ITEMS[type].duration - 0.2);
      expect(g.objects.some((o) => o.type === type)).toBe(false);
    }
  });
  it('jet rejection exposes a specific cooldown, airborne or energy reason', () => {
    const g = running();
    g.energy = 10;
    expect(E.jetBlockReason(g)).toBe('energy');
    g.energy = 100;
    expect(E.activateJet(g)).toBe(true);
    expect(E.jetBlockReason(g)).toBe('airborne');
    tick(g, 2);
    expect(E.jetBlockReason(g)).toBe('cooldown');
    tick(g, 4);
    expect(E.jetBlockReason(g)).toBe('');
  });
});
describe('Authored combination routes', () => {
  it('all 30 routes use all 8 formations, triple obstacles and short gaps without dead ends', () => {
    for (let level = 1; level <= 30; level++) {
      const g = E.newGame({ level, seed: level }),
        seen = new Set();
      for (let p = 0; p < 8; p++) seen.add(E.spawnPattern(g).pattern.id);
      expect(seen.size).toBe(8);
      let triples = 0;
      for (let i = 0; i < g.route.length; i++) {
        const row = g.route[i],
          objects = g.objects.filter((o) => o.row === row.z),
          blocked = objects.filter((o) => o.type !== 'gate');
        expect(blocked).toHaveLength(2);
        expect(blocked.every((o) => o.lane !== row.lane)).toBe(true);
        if (objects.length === 3) {
          triples++;
          expect(objects.find((o) => o.lane === row.lane).type).toBe('gate');
        }
        if (i) {
          const previous = g.route[i - 1],
            previousObjects = g.objects.filter((o) => o.row === previous.z);
          const extent = (list) => 2.1 + Math.max(...list.map((o) => o.length)) / 2;
          const seconds =
            (row.z - previous.z - extent(objects) - extent(previousObjects)) / E.MAX_DESIGN_SPEED;
          expect(Math.abs(row.lane - previous.lane)).toBeLessThanOrEqual(1);
          expect(seconds).toBeGreaterThan(E.LANES[1] / E.LANE_SPEED + 0.08);
        }
      }
      expect(triples).toBeGreaterThan(10);
      expect(Math.min(...g.route.slice(1).map((r, i) => r.z - g.route[i].z))).toBeLessThan(31);
    }
  });
  it.each([1, 2, 3, 4, 5, 6, 13, 30])(
    'a ground route stays collision-free at design speed in level %i',
    (level) => {
      const g = E.newGame({ level, seed: level, mode: 'endless' });
      while (g.spawnAt < 1700) E.spawnPattern(g);
      g.spawnAt = 1e9;
      const route = [...g.route],
        extents = new Map(
          route.map((r) => [
            r.z,
            2.1 + Math.max(...g.objects.filter((o) => o.row === r.z).map((o) => o.length)) / 2,
          ]),
        );
      g.objects = g.objects.filter((o) => !!E.OBSTACLES[o.type]);
      E.start(g);
      g.effects.fullSpeed = 1e6;
      let target = 0;
      while (g.distance < 1600 && g.status === 'running') {
        if (
          target < route.length - 1 &&
          g.distance > route[target].z + extents.get(route[target].z) + 0.3
        )
          target++;
        if (g.lane !== route[target].lane) E.changeLane(g, Math.sign(route[target].lane - g.lane));
        g.speed = E.MAX_DESIGN_SPEED;
        E.step(g, 1 / 60);
      }
      expect(g.hp).toBe(3);
      expect(g.distance).toBeGreaterThanOrEqual(1600);
    },
  );
});
describe('Parking model mobile budget', () => {
  it.each(['mobile', 'desktop'])(
    '%s GLB stays self-contained and within geometry/draw-call budgets',
    (id) => {
      const meta = JSON.parse(
        readFileSync(new URL('../art/xiaomi-assets.json', import.meta.url), 'utf8'),
      ).assets.find((a) => a.id === id);
      const bytes = readFileSync(new URL('../' + meta.file, import.meta.url));
      expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
      expect(bytes.length).toBe(meta.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(meta.sha256);
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trim());
      let triangles = 0,
        primitives = 0;
      for (const mesh of json.meshes)
        for (const p of mesh.primitives) {
          primitives++;
          triangles +=
            (p.indices === undefined
              ? json.accessors[p.attributes.POSITION].count
              : json.accessors[p.indices].count) / 3;
        }
      expect(triangles).toBeLessThan(30000);
      expect(primitives).toBeLessThanOrEqual(20);
      expect(bytes.length).toBeLessThan(id === 'mobile' ? 1100000 : 1600000);
      expect(json.images.every((i) => i.bufferView !== undefined && !i.uri)).toBe(true);
    },
  );
});
