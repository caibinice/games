import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
export const CHEAT_FLAGS = ['gold', 'diamonds', 'energy', 'unlockAll', 'invincible', 'firepower'];
export function parseCheats(raw) {
  return Object.fromEntries(CHEAT_FLAGS.map((k) => [k, raw?.[k] === true]));
}
export function applyCheats(meta, profile) {
  const c = meta.cheats || {};
  for (const k of ['gold', 'diamonds', 'energy']) if (c[k]) meta[k] = 1_000_000_000;
  if (c.unlockAll) profile.unlocked = CAMPAIGN_LEVEL_COUNT;
}
export function grantGuildReward(meta, reward) {
  for (const k of ['gold', 'diamonds'])
    if (Number.isFinite(reward?.[k]) && reward[k] > 0)
      meta[k] = Math.min(1_000_000_000, meta[k] + Math.trunc(reward[k]));
}
