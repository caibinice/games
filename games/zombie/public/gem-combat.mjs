import { CLIENT_SKILL_RULES as SKILL_RULES } from './client-skill-data.mjs';
import { activeNativeBuffs, nativeHasState, nativeKillBuffs } from './native-buff-runtime.mjs';
// Source values are Q32.32 attributes decoded from BattleCore.GemBaseConfig.
// Absolute attack still uses the web adapter's 100-attack reference scale.
const types = {
  burn: [203],
  frost: [204],
  iceblast: [204, 207],
  lightning: [202],
  electric: [202],
  electron: [202],
  grenade: [203, 207],
  fuel: [203],
  airdrop: [207, 205],
  laser: [208],
  guided: [208],
  vehicle: [205],
  gun: [205],
  wind: [215],
  vortex: [215],
  drone: [205],
};
const skillIds = {
  grenade: 1000,
  frost: 2000,
  lightning: 3000,
  laser: 4000,
  vehicle: 5000,
  wind: 6000,
  airdrop: 7000,
  guided: 8000,
  iceblast: 9000,
  electron: 10000,
  vortex: 11000,
  drone: 12000,
  fuel: 13000,
  electric: 14000,
};
export const gemAttr = (g, id) =>
  (g.stats.nativeGemAttrs?.[id] || 0) + (g.stats.nativeRaw?.[id] || 0);
export function gemDamageMultiplier(g, e, kind, context = {}) {
  let ratio = gemAttr(g, 127);
  if (kind === 'mercenary') ratio += gemAttr(g, 166);
  const rule = context.damageRule || SKILL_RULES[kind]?.damage[context.damageIndex || 0],
    magic = { 1: 201, 2: 202, 3: 203, 4: 204, 5: 214, 6: 205, 7: 215 },
    damage = { 1: 206, 2: 207, 3: 208, 4: 209 };
  const ids = rule
    ? [magic[rule.MagicType], damage[rule.DamageType]]
    : kind === 'gun'
      ? [205, 206]
      : types[kind] || [];
  for (const id of ids) if (id) ratio += gemAttr(g, id);
  if (g.wave < 5) ratio += gemAttr(g, 401);
  if (e.hp / e.maxHp > 0.7) ratio += gemAttr(g, 402);
  if (e.type === 'boss' || e.elite) ratio += gemAttr(g, 403);
  if (g.hp / g.maxHp < 0.3) ratio += gemAttr(g, 411);
  if (e.y >= 250) ratio += gemAttr(g, 406);
  for (const b of activeNativeBuffs(g)) {
    const p = b.FuncData.FuncParam;
    if (b.FuncData.FuncId === 8 && (p[0] === 0 || p[0] === skillIds[kind])) {
      const state = p[1],
        negative = e.freeze > 0 || e.slow > 0 || e.burn > 0 || e.paralysis > 0;
      if (nativeHasState(g, e, state)) ratio += p[2] / 10000;
    }
  }
  ratio +=
    gemAttr(g, 405) * Object.entries(g.weapons).filter(([id, n]) => id !== 'gun' && n > 0).length;
  return Math.max(0, 1 + ratio);
}
export function gemCritical(g, e) {
  return e.hp >= e.maxHp && activeNativeBuffs(g).some((b) => b.FuncData.FuncId === 4);
}
export function gemBuffDuration(g, id, seconds) {
  for (const b of activeNativeBuffs(g))
    if (b.FuncData.FuncId === 5 && b.FuncData.FuncParam[0] === id)
      seconds += b.FuncData.FuncParam[1] / 10000;
  return gemDebuffTime(g, seconds);
}
export function gemOnKill(g, e, kind) {
  if (!g.noHealing)
    g.hp = Math.min(
      g.maxHp,
      g.hp + gemAttr(g, 408) + (e.type === 'boss' || e.elite ? g.maxHp * gemAttr(g, 409) : 0),
    );
  nativeKillBuffs(g, e, kind);
}
export function gemOnUpgrade(g) {
  if (g.noHealing) return;
  g.hp = Math.min(g.maxHp, g.hp + g.maxHp * gemAttr(g, 410));
}
export function gemTeleport(g, e, random) {
  const chance = gemAttr(g, 414);
  if (chance > 0 && !e.dead && e.type !== 'boss' && !e.elite && random(g) < Math.min(1, chance)) {
    e.y = e.spawnY ?? -40;
    e.flash = 0.25;
    return true;
  }
  return false;
}

export const gemDebuffTime = (g, seconds) => Math.max(0, seconds * (1 + gemAttr(g, 132)));
