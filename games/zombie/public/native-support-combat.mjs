import { activeNativeBuffs } from './native-buff-runtime.mjs';
import {
  CLIENT_NATIVE_BASES as BASE,
  CLIENT_NATIVE_GRAPHS as GRAPH,
  CLIENT_NATIVE_BUFFS as BUFF,
} from './native-skill-extra.mjs';
import { nativeAttr } from './client-builds.mjs';
import { fireGun, hitGun } from './native-gun-combat.mjs';
const UNIT = 72,
  alive = (g) => g.enemies.filter((e) => !e.dead && e.y > -10);
export function nativeSourceDamage(g, id, index = 0, attack = g.damage) {
  return attack * (BASE[id]?.AttrDamageData[index]?.Param1 || 0);
}
function sourceCast(
  g,
  skill,
  sub,
  t,
  api,
  { x = 110, y = 700, kind = 'mercenary', attack = g.damage, child = false } = {},
) {
  const graph = GRAPH[sub] || GRAPH[skill];
  if (!graph) return;
  const root = BASE[skill] || BASE[sub],
    amount = (i) => attack * (root?.AttrDamageData[i]?.Param1 || 1);
  for (const p of graph.bullets.slice(0, 8)) {
    if ((child && p.repeat.m_shootId !== 2) || (!child && p.repeat.m_shootId === 2)) continue;
    const count = Math.min(
      16,
      Math.max(1, p.count + p.parallelCount - 1 + nativeAttr(g, sub, 116)),
    );
    for (let i = 0; i < count; i++) {
      const angle = ((i - (count - 1) / 2) * (p.angle || 4) * Math.PI) / 180,
        dx = t.x - x,
        dy = t.y - y,
        tx = x + dx * Math.cos(angle) - dy * Math.sin(angle),
        ty = y + dx * Math.sin(angle) + dy * Math.cos(angle);
      const b = api.fire(
        g,
        x,
        y,
        { x: tx, y: ty },
        amount(p.damageIndex) * (p.damageRatio || 1) * (1 + nativeAttr(g, sub, 127)),
        {
          speed: Math.max(80, p.speed * UNIT) * (1 + nativeAttr(g, sub, 119)),
          pierce: Math.max(0, p.through + nativeAttr(g, sub, 117)),
          kind,
          color: kind === 'mercenary' ? '#a1e3ff' : '#ffdb87',
          size: Math.max(3, p.radius * UNIT),
        },
      );
      Object.assign(b, {
        nativeSupport: true,
        nativeGun: kind === 'gun',
        nativeChild: child,
        life: Math.min(5, p.range / Math.max(0.01, p.speed)),
        nativeSource: sub,
      });
    }
  }
  for (const p of graph.areas.slice(0, 5)) {
    const r = Math.max(20, p.radius * UNIT * (1 + nativeAttr(g, sub, 111)));
    api.effect(g, 'grenade', t.x, t.y, { r, duration: 0.45 });
    for (const e of alive(g))
      if (Math.hypot(e.x - t.x, e.y - t.y) <= r + e.r)
        api.damage(
          g,
          e,
          amount(p.damageIndex) * (p.damageRatio || 1) * (1 + nativeAttr(g, sub, 127)),
          kind,
        );
  }
  for (const p of graph.chains.slice(0, 2)) {
    const path = [{ x, y }];
    for (const e of alive(g)
      .sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))
      .slice(0, p.m_maxTargetCount || 3)) {
      path.push({ x: e.x, y: e.y });
      api.damage(g, e, amount(0), kind);
    }
    api.effect(g, 'electron', x, y, { path, duration: 0.3 });
  }
}
export function fireNativeGun(g, t, api) {
  fireGun(g, t, api);
}
export function nativeGunHit(g, b, e, api) {
  hitGun(g, b, e, api);
}
export function supportTick(g, dt, api) {
  const m = g.stats.mercenary;
  if (!m) return;
  g.supportTimers ??= {};
  const target = alive(g).sort((a, b) => b.y - a.y)[0];
  if (!target) return;
  const attack =
    (g.stats.nativeAttack * m.extendAttack + (m.attrs[103] || 0)) *
    (1 + (m.attrs[221] || 0)) *
    (g.cheats.firepower ? 1000 : 1);
  for (const id of m.skills) {
    const base = BASE[id];
    if (!base || base.CloseAutoUse || !GRAPH[id] || base.SkillCD <= 0) continue;
    g.supportTimers[id] = (g.supportTimers[id] || 0) - dt;
    if (g.supportTimers[id] > 0) continue;
    g.supportTimers[id] = Math.max(0.15, base.SkillCD * (1 + (m.attrs[222] || 0)));
    sourceCast(g, id, id, target, api, { kind: 'mercenary', attack });
    g.mercenaryShots = (g.mercenaryShots || 0) + 1;
    g.events.push({ type: 'mercenary-shot', id });
  }
}
export function nativePassiveHit(g, e, kind, api) {
  const ids = {
    gun: -2,
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
  g.nativePassiveCounts ??= {};
  if (g.inNativePassive) return;
  for (const buff of activeNativeBuffs(g)) {
    const id = buff.id || buff.BuffID,
      f = buff?.FuncData,
      p = f?.FuncParam;
    if (f?.FuncId !== 3 || p[4] !== 2 || p[2] !== ids[kind] || p[3] <= 0 || !GRAPH[p[0]]) continue;
    const n = (g.nativePassiveCounts[id] || 0) + 1;
    g.nativePassiveCounts[id] = n;
    if (n % p[3]) continue;
    g.inNativePassive = true;
    try {
      sourceCast(g, p[0], p[0], e, api, { x: 270, y: 700, kind, attack: g.damage });
    } finally {
      g.inNativePassive = false;
    }
  }
}
