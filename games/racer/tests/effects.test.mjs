import { describe, it, expect } from 'vitest';
import { Matrix4, Quaternion } from 'three';
import {
  createNitroExhaust,
  createGhostMaterial,
  exhaustBudget,
  GHOST_BODY_ALPHA,
} from '../public/effects.mjs';
import { PICKUP_DESIGNS } from '../public/pickups.mjs';

describe('Recognizable pickups and lightweight effects', () => {
  it('each pickup has its own silhouette and color; energy is a fuel can', () => {
    expect(new Set(Object.values(PICKUP_DESIGNS).map((d) => d.shape)).size).toBe(5);
    expect(new Set(Object.values(PICKUP_DESIGNS).map((d) => d.color)).size).toBe(5);
    expect(PICKUP_DESIGNS.energy.shape).toBe('fuel-can');
  });
  it.each([true, false])(
    'particle pool stays bounded and reuses its GPU arrays (mobile=%s)',
    (mobile) => {
      const fx = createNitroExhaust({ mobile }),
        matrix = new Matrix4(),
        rotation = new Quaternion();
      const attributes = { ...fx.points.geometry.attributes };
      for (let i = 0; i < 600; i++) {
        const active = fx.update(1 / 60, true, matrix, rotation);
        expect(active).toBeLessThanOrEqual(exhaustBudget(mobile));
      }
      expect(fx.active).toBeGreaterThan(20);
      expect(fx.points.geometry.attributes.position).toBe(attributes.position);
      expect(fx.points.geometry.attributes.age).toBe(attributes.age);
      const before = Array.from(attributes.position.array);
      fx.update(0.05, false, matrix, rotation, false);
      expect(Array.from(attributes.position.array)).toEqual(before);
      for (let i = 0; i < 30; i++) fx.update(1 / 60, false, matrix, rotation);
      expect(fx.active).toBe(0);
      expect(fx.points.visible).toBe(false);
      fx.clear();
      expect(fx.active).toBe(0);
      expect(Array.from(attributes.age.array).every((v) => v === 0)).toBe(true);
      fx.points.geometry.dispose();
      fx.points.material.dispose();
    },
  );
  it('ghost uses very low body alpha and a continuous rim shimmer, without depth blocking', () => {
    const m = createGhostMaterial();
    expect(GHOST_BODY_ALPHA).toBeLessThan(0.025);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.fragmentShader).toContain('rim');
    expect(m.fragmentShader).not.toContain('discard');
    m.dispose();
  });
});
