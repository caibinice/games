import { describe, it, expect } from 'vitest';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CLIENT_GEMS, CLIENT_GEM_COMPOSE } from '../public/client-gem-data.mjs';
import {
  NATIVE_GEMS,
  PLAYABLE_GEMS,
  nativeGemInfo,
  nativeGemPlayable,
  collectNativeGemAttrs,
} from '../public/native-gems.mjs';
import {
  createMeta,
  parseMeta,
  draw,
  itemInfo,
  equipGem,
  unequipGem,
  synthesize,
  combatStats,
} from '../public/progression.mjs';
import {
  gemDamageMultiplier,
  gemOnKill,
  gemOnUpgrade,
  gemTeleport,
  gemDebuffTime,
} from '../public/gem-combat.mjs';
import { createGame, start, chooseUpgrade } from '../public/engine.mjs';
import { branchModifiers } from '../public/client-builds.mjs';
const root = new URL('../public/', import.meta.url),
  text = (f) => readFileSync(new URL(f, root), 'utf8');
const fresh = () => {
  const p = createMeta(7);
  for (const g of Object.values(p.gear)) g.gems.fill(null);
  return p;
};
const add = (p, id, slot, n = 1, index = 0) => {
  const key = 'gem-native:' + id;
  p.inventory[key] = n;
  expect(equipGem(p, key, slot, index)).toBe(true);
  return key;
};
describe('APK-only login and native gem data', () => {
  it('retains every native definition and all seven qualities / six parts', () => {
    expect(CLIENT_GEMS).toHaveLength(2023);
    expect(new Set(CLIENT_GEMS.map((g) => g.id)).size).toBe(2023);
    expect([...new Set(CLIENT_GEMS.map((g) => g.quality))].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...new Set(CLIENT_GEMS.map((g) => g.part))].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(NATIVE_GEMS[900020107].description).toBe('技能冷却-7%');
    expect(NATIVE_GEMS[901030305].description).toContain('对精英和首领无效');
  });
  it('keeps unsupported complex Build/Buff items out of free draws', () => {
    const p = fresh(),
      rewards = Array.from({ length: 20 }, () => draw(p, 'normal', 100)).flat();
    expect(rewards).toHaveLength(2000);
    for (const r of rewards) {
      expect(r.nativeId).toBeGreaterThan(0);
      expect(nativeGemPlayable(r.native)).toBe(true);
    }
    expect(PLAYABLE_GEMS.length).toBeGreaterThan(1500);
    expect(PLAYABLE_GEMS.length).toBe(2023);
    expect(nativeGemPlayable({ rule: { BuffID: 99999999, Attr: { DataType: 0 } } })).toBe(false);
    p.inventory['gem-native:99999999'] = 1;
    expect(equipGem(p, 'gem-native:99999999', 'helmet', 0)).toBe(false);
  });
  it('uses source part mapping rather than the web inventory slot order', () => {
    expect(nativeGemInfo('gem-native:900010301').slot).toBe('boots');
    expect(nativeGemInfo('gem-native:900010401').slot).toBe('bracer');
    expect(nativeGemInfo('gem-native:900010501').slot).toBe('pants');
    expect(nativeGemInfo('gem-native:999')).toBe(null);
  });
  it('preserves both native and old save IDs without resetting inventory', () => {
    const p = fresh();
    p.inventory['gem:helmet:attack:4'] = 2;
    add(p, 900020107, 'helmet');
    const q = parseMeta(JSON.stringify(p));
    expect(q.inventory['gem:helmet:attack:4']).toBe(2);
    expect(q.gear.helmet.gems[0]).toBe('gem-native:900020107');
    expect(itemInfo(q.gear.helmet.gems[0]).nativeId).toBe(900020107);
  });
  it('applies source cooldown/critical/flat attack values and reverses on unequip', () => {
    const p = fresh(),
      before = combatStats(p);
    add(p, 900020107, 'helmet');
    add(p, 900030107, 'helmet', 1, 1);
    add(p, 900010107, 'helmet', 1, 2);
    const after = combatStats(p);
    expect(after.cooldown - before.cooldown).toBeCloseTo(0.07);
    expect(after.critChance).toBeCloseTo(0.07);
    expect(after.nativeGemAttrs[103]).toBe(70);
    expect(after.attack - before.attack).toBeCloseTo(0.7);
    unequipGem(p, 'helmet', 0);
    expect(combatStats(p).cooldown).toBe(before.cooldown);
  });
  it('caps a native item at its explicit MaxStack', () => {
    const p = fresh();
    add(p, 901080107, 'helmet', 2);
    expect(equipGem(p, 'gem-native:901080107', 'helmet', 1)).toBe(true);
    const limit = NATIVE_GEMS[901080107].maxStack;
    p.gear.helmet.gems = Array(limit + 1).fill('gem-native:901080107');
    expect(collectNativeGemAttrs(p).attrs[109]).toBe(limit);
  });
  it('uses native compose quantities, never the legacy hard-coded three', () => {
    const p = fresh();
    p.inventory = { 'gem-native:900010101': 4 };
    expect(CLIENT_GEM_COMPOSE[0].NeedNum).toBe(5);
    expect(synthesize(p)).toBe(0);
    p.inventory['gem-native:900010101'] = 5;
    expect(synthesize(p)).toBe(1);
    expect(p.inventory['gem-native:900010102']).toBe(1);
    p.inventory = { 'gem:helmet:attack:0': 3 };
    expect(synthesize(p)).toBe(1);
    expect(p.inventory['gem:helmet:attack:1']).toBe(1);
  });
  it('honors locks and changes only the selected item quantities', () => {
    const p = fresh();
    p.inventory = { 'gem-native:900010101': 5 };
    p.locked['gem-native:900010101'] = true;
    expect(synthesize(p)).toBe(0);
    expect(p.inventory['gem-native:900010101']).toBe(5);
  });
  it('opens an actual initial skill choice without incrementing the character rank', () => {
    const g = start(createGame({ stats: { initialChoices: 1 }, seed: 2 }));
    expect(g.status).toBe('upgrade');
    expect(g.rank).toBe(1);
    expect(chooseUpgrade(g, g.choices[0].id)).toBe(true);
    expect(g.status).toBe('running');
    expect(g.initialSelections).toBe(0);
  });
  it('combines source damage conditions only in their matching cases', () => {
    const g = createGame({
      loadout: 'frost',
      stats: {
        nativeGemAttrs: { 127: 0.1, 204: 0.2, 401: 0.3, 402: 0.4, 403: 0.5, 411: 0.6, 405: 0.1 },
      },
    });
    g.weapons.frost = 1;
    const e = { hp: 80, maxHp: 100, type: 'walker' };
    expect(gemDamageMultiplier(g, e, 'frost')).toBeCloseTo(2.1);
    g.wave = 6;
    e.hp = 50;
    expect(gemDamageMultiplier(g, e, 'frost')).toBeCloseTo(1.4);
    e.elite = true;
    g.hp = 20;
    expect(gemDamageMultiplier(g, e, 'frost')).toBeCloseTo(2.5);
  });
  it('applies negative-state duration and fire bonuses beyond just the two native branches', () => {
    const g = createGame({ stats: { nativeGemAttrs: { 132: 0.5, 203: 0.2 } } });
    expect(gemDebuffTime(g, 2)).toBe(3);
    expect(gemDamageMultiplier(g, { hp: 50, maxHp: 100 }, 'burn')).toBeCloseTo(1.2);
  });
  it('distinguishes kill flat heal, elite percentage heal and level-up heal', () => {
    const g = createGame({ stats: { nativeGemAttrs: { 408: 2, 409: 0.1, 410: 0.05 } } });
    g.hp = 100;
    gemOnKill(g, { type: 'walker' });
    expect(g.hp).toBe(102);
    gemOnKill(g, { type: 'walker', elite: true });
    expect(g.hp).toBe(134);
    gemOnUpgrade(g);
    expect(g.hp).toBe(149);
  });
  it('teleports ordinary targets but excludes elites, bosses and dead enemies', () => {
    const g = createGame({ stats: { nativeGemAttrs: { 414: 1 } } }),
      e = { y: 500, spawnY: -50 };
    expect(gemTeleport(g, e, () => 0)).toBe(true);
    expect(e.y).toBe(-50);
    for (const enemy of [{ type: 'boss' }, { elite: true }, { dead: true }])
      expect(gemTeleport(g, enemy, () => 0)).toBe(false);
  });
  it('counts global native through/speed attributes exactly once per projectile', () => {
    const g = createGame({ stats: { nativeGemAttrs: { 117: 2, 119: 0.16 } } });
    g.nativeBuilds = { 201: 1 };
    const m = branchModifiers(g, 'frost', 2011);
    expect(m.through).toBe(2);
    expect(m.speed).toBeCloseTo(1.16);
  });
  it('has no screenshot splash or static 80-percent start button in active startup code', () => {
    expect(text('native-entry.mjs')).not.toContain('original-ui');
    expect(text('ui.css')).not.toContain('splash.webp');
    expect(text('original-app.mjs')).not.toContain('splash-start');
    expect(text('app.mjs')).toContain('loadNativeEntry');
    expect(text('native-entry.mjs')).toContain('reader.read()');
    expect(text('native-entry.mjs')).not.toContain('force-cache');
    expect(text('native-entry.mjs')).toMatch(/size\s*!==\s*f\.bytes/);
  });
  it('has a current, hashed essential-resource byte manifest', () => {
    const rows = JSON.parse(text('entry-resources.json'));
    expect(rows.length).toBeGreaterThan(25);
    for (const row of rows) {
      const path = new URL(row.path, root);
      expect(statSync(path).size, row.path).toBe(row.bytes);
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(row.sha256);
    }
  });
  it('retains APK-only provenance and upstream license notices', () => {
    const evidence = JSON.parse(text('assets/client-interface/provenance.json'));
    expect(evidence.screenshots_used).toBe(false);
    expect(evidence.gem_count).toBe(2023);
    for (const out of evidence.outputs) {
      expect(existsSync(new URL(out.file, root))).toBe(true);
      expect(
        createHash('sha256')
          .update(readFileSync(new URL(out.file, root)))
          .digest('hex'),
      ).toBe(out.sha256);
    }
    expect(text('assets/client-interface/licenses.html')).toContain(
      'Spine Runtimes License Agreement',
    );
  });
});
