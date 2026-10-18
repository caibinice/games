import { describe, it, expect } from 'vitest';
import * as E from '../public/engine.mjs';
import { visualPose, frameSize } from '../public/presentation.mjs';
const tick = (g, seconds) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) E.step(g, 1 / 60);
};
function running(cheats) {
  const g = E.newGame({ cheats });
  E.start(g);
  g.spawnAt = 1e9;
  return g;
}
describe('Responsive controls, durability and assists', () => {
  it('starts with six durability cells and completes a lane change within 75 ms', () => {
    const g = running();
    expect(g.hp).toBe(6);
    E.changeLane(g, 1);
    tick(g, 0.075);
    expect(g.x).toBe(E.LANES[2]);
    expect(g.lane).toBe(2);
  });
  it('jet cooldown is 2.5s and airborne presses never restart the animation', () => {
    const g = running();
    E.activateJet(g);
    expect(g.cooldown).toBe(2.5);
    tick(g, 0.7);
    const left = g.jet;
    expect(E.activateJet(g)).toBe(false);
    expect(g.jet).toBe(left);
    tick(g, 1);
    expect(g.jet).toBe(0);
    expect(E.jetBlockReason(g)).toBe('cooldown');
    tick(g, 0.85);
    expect(E.activateJet(g)).toBe(true);
  });
  it('five collected coins repair one point once, without overhealing', () => {
    const g = running();
    g.hp = 3;
    g.objects = Array.from({ length: 5 }, (_, id) => ({
      id,
      type: 'coin',
      x: 0,
      z: 1,
      passed: false,
    }));
    E.step(g, 1 / 60);
    expect(g.hp).toBe(4);
    expect(g.coins).toBe(5);
    expect(g.repairCoins).toBe(0);
    tick(g, 0.1);
    expect(g.hp).toBe(4);
    expect(g.coins).toBe(5);
    g.hp = 5;
    E.collectItem(g, 'repair');
    expect(g.hp).toBe(6);
    E.collectItem(g, 'repair');
    expect(g.hp).toBe(6);
  });
  it('infinite spray keeps energy full, still respects cooldown and no air restart', () => {
    const g = running({ infiniteEnergy: true });
    E.toggleBoost(g);
    E.activateJet(g);
    tick(g, 1);
    expect(g.energy).toBe(100);
    expect(g.boost).toBe(1);
    expect(E.activateJet(g)).toBe(false);
    tick(g, 1.6);
    expect(E.activateJet(g)).toBe(true);
    expect(g.energy).toBe(100);
  });
  it('infinite durability ignores all obstacle damage and collision slowdowns', () => {
    for (const type of Object.keys(E.OBSTACLES)) {
      const g = running({ infiniteDurability: true });
      g.speed = E.levelInfo(1).speed;
      g.objects = [{ id: 1, type, x: 0, z: 1, passed: false }];
      E.step(g, 1 / 60);
      expect(g.hp).toBe(6);
      expect(g.speed).toBe(E.levelInfo(1).speed);
      expect(g.status).toBe('running');
    }
  });
  it('turning assists off restores normal costs and keeps the run marked assisted', () => {
    const g = running();
    E.setCheats(g, { infiniteEnergy: true, infiniteDurability: true });
    E.setCheats(g, {});
    expect(g.assisted).toBe(true);
    E.activateJet(g);
    expect(g.energy).toBe(65);
    g.objects = [{ id: 1, type: 'truck', x: 0, z: 1, passed: false }];
    E.step(g, 1 / 60);
    expect(g.hp).toBe(5);
  });
  it('restores old v1 stage saves and sanitizes persisted assist values', () => {
    const g = E.restore(
      { version: 1, level: 12, mode: 'campaign' },
      { infiniteEnergy: true, infiniteDurability: 'yes' },
    );
    expect(g.hp).toBe(6);
    expect(g.cheats).toEqual({ infiniteEnergy: true, infiniteDurability: false });
    expect(E.normalizeCheats(null)).toEqual({ infiniteEnergy: false, infiniteDurability: false });
  });
});
describe('Stable display sampling', () => {
  it('smooths intermediate high-refresh frames without mutating physics', () => {
    const g = running();
    E.changeLane(g, 1);
    const before = structuredClone(g);
    const a = visualPose(g, 1 / 240),
      b = visualPose(g, 1 / 120);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.distance).toBeGreaterThan(a.distance);
    expect(g).toEqual(before);
    expect(b.x).toBeLessThanOrEqual(E.LANES[2]);
  });
  it('never extrapolates paused games and never overshoots a landing', () => {
    const g = running();
    E.activateJet(g);
    g.jet = 0.001;
    expect(visualPose(g, 1 / 60).height).toBe(0);
    E.pause(g);
    expect(visualPose(g, 1)).toEqual(visualPose(g, 0));
  });
  it('ignores fractional viewport jitter and resizes only for a real dimension change', () => {
    expect(frameSize(844.4, 390.2, { width: 844, height: 390 }).changed).toBe(false);
    expect(frameSize(390, 844, { width: 844, height: 390 }).changed).toBe(true);
  });
});
