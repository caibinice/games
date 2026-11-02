import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
export const SAVE_KEY = 'fish-zombie-v1';
export function defaultProfile() {
  return {
    version: 1,
    unlocked: 1,
    selected: 1,
    coins: 0,
    attack: 0,
    fortify: 0,
    loadout: 'grenade',
    stars: {},
    best: {},
    sound: true,
    music: true,
  };
}
export function parseProfile(raw) {
  const p = defaultProfile();
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!o || o.version !== 1) return p;
    const number = (k, max) =>
      Number.isFinite(o[k]) ? Math.max(0, Math.min(max, Math.trunc(o[k]))) : p[k];
    for (const [k, max] of [
      ['unlocked', CAMPAIGN_LEVEL_COUNT],
      ['selected', CAMPAIGN_LEVEL_COUNT],
      ['coins', 1e8],
      ['attack', 10],
      ['fortify', 10],
    ])
      p[k] = number(k, max);
    p.unlocked = Math.max(1, p.unlocked);
    p.selected = Math.max(1, Math.min(p.unlocked, p.selected));
    for (const key of ['stars', 'best'])
      for (const [k, v] of Object.entries(o[key] || {}))
        if (/^[1-9]\d*$/.test(k) && Number(k) <= CAMPAIGN_LEVEL_COUNT && Number.isFinite(v))
          p[key][k] = Math.max(0, Math.min(key === 'stars' ? 3 : 1e9, Math.trunc(v)));
    if (['grenade', 'frost', 'lightning', 'laser', 'drone'].includes(o.loadout))
      p.loadout = o.loadout;
    for (const k of ['sound', 'music']) if (typeof o[k] === 'boolean') p[k] = o[k];
  } catch {}
  return p;
}
export function battleHealthPercent(g) {
  const ratio = Number(g.hp) / Number(g.maxHp);
  return Number.isFinite(ratio) ? Math.floor(Math.max(0, Math.min(1, ratio)) * 1000) / 10 : 0;
}
export function battleStars(g) {
  if (g.status !== 'won') return 0;
  const hp = battleHealthPercent(g);
  return g.client ? (hp >= 100 ? 3 : hp >= 50 ? 2 : 1) : hp >= 80 ? 3 : hp >= 40 ? 2 : 1;
}
export function recordWin(profile, g) {
  if (g.status !== 'won' || g.settled) return false;
  g.settled = true;
  const n = g.info.level;
  const stars = battleStars(g);
  profile.stars[n] = Math.max(profile.stars[n] || 0, stars);
  profile.best[n] = Math.max(profile.best[n] || 0, g.score);
  profile.coins += g.info.reward;
  profile.unlocked = Math.max(profile.unlocked, Math.min(CAMPAIGN_LEVEL_COUNT, n + 1));
  profile.selected = Math.min(CAMPAIGN_LEVEL_COUNT, n + 1);
  return true;
}
export function upgradeCost(profile, id) {
  return ['attack', 'fortify'].includes(id) && profile[id] < 10 ? 80 + profile[id] * 65 : Infinity;
}
export function buyUpgrade(profile, id) {
  const cost = upgradeCost(profile, id);
  if (profile.coins < cost || !Number.isFinite(cost)) return false;
  profile.coins -= cost;
  profile[id]++;
  return true;
}
