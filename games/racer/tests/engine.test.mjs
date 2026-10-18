import { describe, it, expect } from 'vitest';
import * as E from '../public/engine.mjs';
const tick = (g, seconds, input = {}) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) E.step(g, 1 / 60, input);
};
function running() {
  const g = E.newGame();
  E.start(g);
  g.spawnAt = 1e9;
  g.speed = 35;
  return g;
}
describe('JET-R deterministic simulation', () => {
  it('has 30 routes across six maps with closely matched arcade difficulty', () => {
    const maps = new Set(),
      speeds = [];
    for (let n = 1; n <= 30; n++) {
      const info = E.levelInfo(n);
      maps.add(info.theme.id);
      speeds.push(info.speed);
      expect(info.distance).toBeGreaterThan(1300);
      expect(info.distance).toBeLessThan(1700);
    }
    expect(maps.size).toBe(6);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(1.04);
    expect(E.levelInfo(-2).level).toBe(1);
    expect(E.levelInfo(99).level).toBe(30);
  });
  it('only advances while running and pauses without stuck input', () => {
    const g = E.newGame();
    E.step(g, 0.05);
    expect(g.distance).toBe(0);
    E.start(g);
    tick(g, 1);
    const d = g.distance;
    E.pause(g);
    tick(g, 1);
    expect(g.distance).toBe(d);
    E.start(g);
    tick(g, 0.2);
    expect(g.distance).toBeGreaterThan(d);
  });
  it('is deterministic for an identical seed and commands', () => {
    const a = E.newGame({ seed: 41 }),
      b = E.newGame({ seed: 41 });
    for (const g of [a, b]) {
      E.start(g);
      tick(g, 8, { left: true });
    }
    expect(a).toEqual(b);
  });
  it('one direction press moves one lane, release re-arms and edges clamp', () => {
    const g = running();
    tick(g, 0.5, { left: true });
    expect(g.lane).toBe(0);
    tick(g, 0.5, { right: true });
    expect(g.lane).toBe(1);
    tick(g, 0.5, { right: true });
    expect(g.lane).toBe(1);
    tick(g, 0.1);
    tick(g, 0.5, { right: true });
    expect(g.lane).toBe(2);
    E.changeLane(g, 1);
    expect(g.lane).toBe(2);
  });
  it('jet rises, completes a full side-roll and lands exactly level', () => {
    const g = running();
    expect(E.activateJet(g)).toBe(true);
    tick(g, E.JET_DURATION / 2);
    expect(g.height).toBeGreaterThan(3.7);
    expect(g.roll).toBeGreaterThan(2);
    expect(g.roll).toBeLessThan(4);
    tick(g, 1);
    expect(g.height).toBe(0);
    expect(g.roll).toBe(0);
    expect(g.jet).toBe(0);
    expect(g.jumps).toBe(1);
  });
  it('jet cooldown, energy and held input prevent repeated activation', () => {
    const g = running();
    tick(g, 8, { jet: true });
    expect(g.jumps).toBe(1);
    tick(g, 0.1);
    tick(g, 0.1, { jet: true });
    expect(g.jumps).toBe(2);
    g.jet = 0;
    g.cooldown = 0;
    g.energy = 20;
    expect(E.activateJet(g)).toBe(false);
  });
  it.each(['traffic', 'barrier'])('airborne player clears a %s without damage', (type) => {
    const g = running();
    E.activateJet(g);
    tick(g, 0.8);
    g.objects = [{ id: 1, type, x: 0, z: g.distance + 0.1, passed: false }];
    tick(g, 0.35);
    expect(g.hp).toBe(3);
    expect(g.cleared).toBe(1);
    expect(g.combo).toBe(1);
  });
  it('overhead gates punish jumping but allow a ground pass', () => {
    for (const airborne of [false, true]) {
      const g = running();
      if (airborne) {
        E.activateJet(g);
        tick(g, 0.7);
      }
      g.objects = [{ id: 1, type: 'gate', x: 0, z: g.distance + 0.1, passed: false }];
      tick(g, 0.15);
      expect(g.hp).toBe(airborne ? 2 : 3);
    }
  });
  it('swept collision catches fast frames and invulnerability prevents stacking', () => {
    const g = running();
    g.speed = 200;
    g.objects = [
      { id: 1, type: 'traffic', x: 0, z: 4, passed: false },
      { id: 2, type: 'barrier', x: 0, z: 4, passed: false },
    ];
    E.step(g, 0.05);
    expect(g.hp).toBe(2);
    tick(g, 0.2);
    expect(g.hp).toBe(2);
  });
  it('old obstacles never damage a car after passing', () => {
    const g = running();
    g.objects = [{ id: 1, type: 'traffic', x: 0, z: -6, passed: false }];
    tick(g, 0.2);
    expect(g.hp).toBe(3);
  });
  it('coins and energy collect once and remain bounded', () => {
    const g = running();
    g.energy = 95;
    g.objects = [
      { id: 1, type: 'coin', x: 0, z: 1, passed: false },
      { id: 2, type: 'energy', x: 0, z: 1, passed: false },
    ];
    tick(g, 0.5);
    expect(g.coins).toBe(1);
    expect(g.energy).toBeLessThanOrEqual(100);
    expect(g.score).toBeGreaterThanOrEqual(50);
  });
  it('every generated row has a ground-safe lane with rewards', () => {
    for (let n = 1; n <= 30; n++) {
      const g = E.newGame({ level: n, seed: n });
      for (let r = 0; r < 100; r++) {
        g.objects = [];
        E.spawnRow(g, r * 100);
        const blocked = new Set(
          g.objects.filter((o) => ['traffic', 'barrier'].includes(o.type)).map((o) => o.lane),
        );
        expect(blocked.size).toBeLessThan(3);
        expect(g.objects.some((o) => o.type === 'coin' && !blocked.has(o.lane))).toBe(true);
      }
    }
  });
  it('boost consumes energy, increases speed and cannot produce negative energy', () => {
    const a = running(),
      b = running();
    tick(a, 3, { boost: true });
    tick(b, 3);
    expect(a.distance).toBeGreaterThan(b.distance);
    expect(a.energy).toBeLessThan(b.energy);
    tick(a, 30, { boost: true });
    expect(a.energy).toBeGreaterThanOrEqual(0);
  });
  it('campaign completes at the goal, endless keeps running', () => {
    for (const mode of ['campaign', 'endless']) {
      const g = running();
      g.mode = mode;
      g.distance = E.levelInfo(1).distance - 1;
      tick(g, 0.2);
      expect(g.status).toBe(mode === 'campaign' ? 'won' : 'running');
    }
  });
  it('third hit ends the run', () => {
    const g = running();
    g.hp = 1;
    g.objects = [{ id: 1, type: 'traffic', x: 0, z: 0.1, passed: false }];
    tick(g, 0.1);
    expect(g.status).toBe('lost');
    expect(g.events).toEqual([]);
  });
  it('save format restores stage/settings only, rejects corrupt stages', () => {
    const g = E.newGame({ level: 30, mode: 'endless' });
    const restored = E.restore(E.serialize(g));
    expect(restored.level).toBe(30);
    expect(restored.mode).toBe('endless');
    expect(restored.status).toBe('ready');
    for (const v of [null, {}, { version: 1, level: 99 }, { version: 1, level: 1.1 }])
      expect(E.restore(v)).toBeNull();
  });
});
