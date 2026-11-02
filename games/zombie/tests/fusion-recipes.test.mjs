import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGame, start } from '../public/engine.mjs';
import {
  NATIVE_BUILD_CATALOG as C,
  applyNativeBuild,
  buildEligible,
  nativeBuildOptions,
} from '../public/client-builds.mjs';
import { skillCodex, isFusionRecipe, fusionFormula } from '../public/skill-codex.mjs';
import { createMeta, combatStats } from '../public/progression.mjs';
const game = (skill, levels) =>
  start(
    createGame({
      client: true,
      extended: true,
      loadout: skill,
      seed: 7,
      coreLevels: levels,
      stats: combatStats(createMeta()),
    }),
  );
describe('APK-specific skill fusion requirements', () => {
  it('keeps the recipe overlay open during a pending battle upgrade and returns to choices on close', () => {
    const app = readFileSync(new URL('../public/original-app.mjs', import.meta.url), 'utf8');
    expect(app).toMatch(
      /g\.status\s*===\s*'upgrade'\s*&&\s*!\[\s*'upgrade',\s*'skill-tree',?\s*\]\.includes\(modalType\)/,
    );
    expect(app).toMatch(
      /modalType\s*===\s*'skill-tree'\s*&&\s*g\?\.status\s*===\s*'upgrade'\)\s*\{\s*choices\(\);\s*return;/,
    );
  });
  it('shows the actual all-of prerequisite and core-level gates rather than merging guide versions', () => {
    const b = C[112];
    expect(fusionFormula(b)).toEqual(['温压弹 ×1', '热能爆炸 ×1', '热能爆发 ×1']);
    const html = skillCodex({ skill: 'grenade', mode: 'fusion' });
    expect(html).toContain('温压弹核心 ≥14级');
    expect(html).toContain('超爆弹');
    expect(html).toContain('前置不会作为材料被消耗');
  });
  it('only offers super explosive after both required branches and forbids the mutually exclusive rapid branch', () => {
    const g = game('grenade', { grenade: 14 });
    expect(buildEligible(g, C[112])).toBe(false);
    expect(applyNativeBuild(g, 103)).toBe(true);
    expect(buildEligible(g, C[112])).toBe(false);
    expect(applyNativeBuild(g, 105)).toBe(true);
    expect(buildEligible(g, C[112])).toBe(true);
    expect(applyNativeBuild(g, 112)).toBe(true);
    expect(g.nativeSubSkills[1121]).toBe('grenade');
    expect(buildEligible(g, C[102])).toBe(false);
  });
  it('giant cryo needs all three native upgrades and level10, then replaces its projectile', () => {
    const g = game('frost', { frost: 10 });
    for (const id of [205, 206]) expect(applyNativeBuild(g, id)).toBe(true);
    expect(buildEligible(g, C[211])).toBe(false);
    expect(applyNativeBuild(g, 203)).toBe(true);
    expect(buildEligible(g, C[211])).toBe(true);
    expect(applyNativeBuild(g, 211)).toBe(true);
    expect(g.nativeSubSkills[2111]).toBe('frost');
  });
  it('laser fusion options honor the native mutually-exclusive branches', () => {
    const g = game('laser', { laser: 18 });
    for (const id of [405, 406, 404]) expect(applyNativeBuild(g, id)).toBe(true);
    expect(buildEligible(g, C[410])).toBe(true);
    expect(applyNativeBuild(g, 410)).toBe(true);
    expect(buildEligible(g, C[412])).toBe(false);
  });
  it('includes gun recipes, prerequisites, talent thresholds and live state', () => {
    const html = skillCodex({ skill: 'gun', mode: 'fusion' });
    expect(html).toContain('分裂子弹');
    expect(html).toContain('伤害增幅 ×1');
    expect(html).toContain('枪械天赋 ≥1级');
    expect(isFusionRecipe(C[300104])).toBe(true);
    const g = game('grenade', { grenade: 1 });
    g.stats.nativeGunSkillLevel = 1;
    expect(nativeBuildOptions(g).some((x) => x.nativeBuildId === 300104)).toBe(false);
    expect(applyNativeBuild(g, 300107)).toBe(true);
    expect(nativeBuildOptions(g).some((x) => x.nativeBuildId === 300104)).toBe(true);
  });
});
