export const SAVE_KEY = 'fish-pvz-v1';
export function defaultProfile() {
  return {
    version: 1,
    unlocked: 1,
    selected: 1,
    stars: {},
    music: true,
    sound: true,
    autoCollect: false,
  };
}
export function parseProfile(raw) {
  const p = defaultProfile();
  try {
    const q = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!q || q.version !== 1) return p;
    for (const k of ['unlocked', 'selected'])
      if (Number.isFinite(q[k])) p[k] = Math.max(1, Math.min(50, Math.trunc(q[k])));
    p.selected = Math.min(p.selected, p.unlocked);
    for (const [k, v] of Object.entries(q.stars || {}))
      if (/^([1-9]|[1-4][0-9]|50)$/.test(k) && Number.isFinite(v))
        p.stars[k] = Math.max(1, Math.min(3, Math.trunc(v)));
    for (const k of ['music', 'sound', 'autoCollect']) if (typeof q[k] === 'boolean') p[k] = q[k];
  } catch {}
  return p;
}
export function recordWin(p, g) {
  if (g.status !== 'won' || g.settled) return false;
  g.settled = true;
  const used = g.mowers.filter((m) => m.status !== 'ready').length,
    stars = used === 0 ? 3 : used < 3 ? 2 : 1;
  p.stars[g.info.level] = Math.max(p.stars[g.info.level] || 0, stars);
  p.unlocked = Math.max(p.unlocked, Math.min(50, g.info.level + 1));
  p.selected = Math.min(50, g.info.level + 1);
  return true;
}
