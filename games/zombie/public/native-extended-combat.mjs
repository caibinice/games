import {
  nativeProcMissile,
  nativeProcZoneComplete,
  nativeDroneReflect,
} from './native-proc-runtime.mjs';
import { PROC_GRAPH_IDS } from './proc-graph-rules.mjs';
import {
  applyNativeTargetBuff,
  markNativeState,
  nativeElectronPath,
  nativeAreaImpact,
  nativeTargetForce,
} from './native-buff-runtime.mjs';
import { CLIENT_SKILL_RULES as S, CLIENT_BUILD_CATALOG as C } from './client-skill-data.mjs';
import { CLIENT_NATIVE_GRAPHS as G, CLIENT_NATIVE_BUFFS as B } from './native-skill-extra.mjs';
import {
  branchModifiers as mods,
  nativeCooldown,
  nativeAttr,
  buildCount,
} from './client-builds.mjs';
const unit = 72,
  TAU = Math.PI * 2;
const color = {
  grenade: '#ffad43',
  laser: '#67eaff',
  vehicle: '#d2c15a',
  wind: '#80f5e0',
  airdrop: '#ff8f42',
  guided: '#87ffff',
  iceblast: '#91eaff',
  electron: '#ffdb55',
  vortex: '#6dffe2',
  drone: '#c7e390',
  fuel: '#ff8536',
  electric: '#ba9cff',
};
const alive = (g) => g.enemies.filter((e) => !e.dead);
const subs = (g, skill) =>
  Object.entries(g.nativeSubSkills || {})
    .filter(([, s]) => s === skill)
    .map(([id]) => Number(id));
function mainSub(g, skill, kind) {
  return (
    subs(g, skill)
      .filter((id) => id < 1000000 && G[id]?.[kind]?.length)
      .slice(-1)[0] || S[skill].subSkills.find((id) => G[id]?.[kind]?.length)
  );
}
function amount(g, skill, sub, index = 0, ratio = 1) {
  return (
    (g.stats.nativeAttack ? g.damage : 42 * g.damage) *
    (S[skill].damage[index]?.Param1 || S[skill].damage[0]?.Param1 || 1) *
    mods(g, skill, sub).damage *
    ratio
  );
}
function status(g, e, skill, api, shootId = 2) {
  const negative = 1 + (g.stats.nativeGemAttrs?.[132] || 0);
  const active = subs(g, skill);
  for (const id of active.filter((id) => !PROC_GRAPH_IDS.has(id)))
    for (const n of G[id]?.buffNodes || []) {
      if (
        n.m_objectType !== 1 ||
        (n.m_triggleRepeat?.m_shootId && n.m_triggleRepeat.m_shootId !== shootId) ||
        api.random(g) > n.m_randomRate
      )
        continue;
      applyNativeTargetBuff(g, e, n.m_buffId || n.m_buffID || n.m_buffData?.m_buffID, skill);
    }
  if (skill === 'grenade' && buildCount(g, 106)) e.burn = Math.max(e.burn || 0, 6 * negative);
  if (skill === 'iceblast') e.freeze = Math.max(e.freeze || 0, 1 * negative);
  if (skill === 'wind' && buildCount(g, 607)) e.freeze = Math.max(e.freeze || 0, 1 * negative);
  if (skill === 'electron' && buildCount(g, 1007))
    e.paralysis = Math.max(e.paralysis || 0, 1 * negative);
  if (skill === 'fuel') {
    e.burn = Math.max(e.burn || 0, 2.6 * negative);
    if (buildCount(g, 1304)) e.slow = Math.max(e.slow || 0, 1 * negative);
  }
}
function hit(g, e, skill, sub, index, api, ratio = 1, context = {}) {
  api.damage(g, e, amount(g, skill, sub, index, ratio), skill, {
    damageIndex: index,
    sourceSub: sub,
    damageRule: S[skill].damage[index],
    ...context,
  });
  status(g, e, skill, api);
}
function zone(g, skill, sub, x, y, profile, api, extra = {}) {
  const m = mods(g, skill, sub),
    duration = Math.max(0.05, (profile.duration || 0.05) * (1 + m.duration));
  const z = {
    id: g.nextId++,
    bornAt: g.time,
    skill,
    sub,
    x,
    y,
    r: Math.max(12, (profile.radius || 0.7) * unit * m.range),
    until: g.time + duration,
    next: g.time + (profile.delay || 0),
    interval: Math.max(0.05, (profile.interval || 0.2) * (1 + m.interval)),
    index: profile.damageIndex || 0,
    ratio: profile.damageRatio || 1,
    ...extra,
  };
  g.extendedZones.push(z);
  api.effect(g, skill, x, y, {
    r: z.r,
    duration,
    variant: sub,
    tx: extra.tx,
    ty: extra.ty,
    visualKey: `zone:${z.id}`,
    bornAt: z.bornAt,
    until: z.until,
  });
  return z;
}
function bullet(g, skill, sub, t, p, api, offset = 0) {
  const m = mods(g, skill, sub),
    speed = Math.max(15, (p.speed || 8) * unit * m.speed),
    angle = Math.atan2(t.y - 705, t.x - 270) + offset;
  const b = api.fire(
    g,
    270,
    705,
    { x: 270 + Math.cos(angle) * 100, y: 705 + Math.sin(angle) * 100 },
    amount(g, skill, sub, p.damageIndex || 0),
    {
      speed,
      pierce: Math.max(0, p.through + m.through),
      color: color[skill],
      size: Math.max(3, p.radius * unit * m.range),
      kind: skill,
    },
  );
  Object.assign(b, {
    nativeSkill: true,
    nativeExtended: true,
    nativeSub: sub,
    hitCount: 0,
    knockback: p.hit?.type === 2 ? (p.knockback || 0) * unit * (1 + m.knockback) : 0,
    life: Math.max(0.2, p.life || p.range / (p.speed || 8) || 3),
    nativeProfile: p,
  });
  return b;
}
export function extendedBulletHit(g, b, e, api) {
  if (!b.nativeExtended) return false;
  const skill = b.kind;
  if (b.knockback && e.type !== 'boss')
    e.y = Math.max(-40, e.y - b.knockback * nativeTargetForce(g, e, 123));
  status(g, e, skill, api, b.nativeProfile.hit?.raw?.m_shootId || 2);
  if (skill === 'grenade') {
    const sub = mainSub(g, skill, 'areas') || 1012,
      p = G[sub]?.areas[0] || { radius: 0.7, damageIndex: 1 };
    const m = mods(g, skill, sub),
      r = p.radius * unit * m.range;
    api.effect(g, 'grenade', e.x, e.y, { r, duration: 0.5, variant: sub });
    nativeAreaImpact(g, e, skill);
    for (const t of alive(g))
      if (Math.hypot(t.x - e.x, t.y - e.y) <= r + t.r)
        hit(g, t, skill, sub, p.damageIndex, api, 1, {
          sourceId: b.id,
          shootId: p.hit?.raw?.m_shootId || 3,
        });
  }
  if (skill === 'vehicle' && buildCount(g, 511)) {
    api.effect(g, 'grenade', e.x, e.y, { r: 30, duration: 0.3 });
  }
  return true;
}
function cast(g, skill, t, api) {
  const m = mods(g, skill, S[skill].id);
  if (['grenade', 'wind', 'vehicle'].includes(skill)) {
    const sub = mainSub(g, skill, 'bullets'),
      p = G[sub]?.bullets[0];
    if (!p) return;
    const n = Math.min(12, Math.max(1, p.count + m.count));
    for (let i = 0; i < n; i++)
      bullet(
        g,
        skill,
        sub,
        t,
        p,
        api,
        (i - (n - 1) / 2) * Math.max(0.06, (p.angle * Math.PI) / 180),
      );
    return;
  }
  if (skill === 'electron') {
    const sub = mainSub(g, skill, 'chains') || 10011,
      node = G[sub]?.chains[0],
      d = node?.m_chainData;
    const n = Math.min(
      30,
      (d?.m_reflectCount || 4) +
        Math.round(nativeAttr(g, sub, 135) + nativeAttr(g, S[skill].id, 135)),
    );
    const used = [];
    let current = t;
    let from = { x: 270, y: 705 };
    for (let i = 0; i < n && current; i++) {
      used.push(current.id);
      g.extendedCasts.push({
        at: g.time + i * (d?.m_moveNodeTime || 0.25),
        type: 'chain',
        skill,
        sub,
        target: current.id,
        x: current.x,
        y: current.y,
        from,
        index: node?.m_impactData?.m_damageIndex || 0,
      });
      from = { x: current.x, y: current.y };
      current = alive(g)
        .filter(
          (e) =>
            !used.includes(e.id) &&
            Math.hypot(e.x - from.x, e.y - from.y) <
              (d?.m_SearchTargetParam?.m_distance || 4) * unit * m.range,
        )
        .sort(
          (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
        )[0];
    }
    return;
  }
  if (skill === 'guided') {
    const sub = mainSub(g, skill, 'focus') || 8011,
      n = G[sub]?.focus[0];
    zone(
      g,
      skill,
      sub,
      t.x,
      t.y,
      {
        radius: 0.2,
        duration: n?.m_lifeTime || 4,
        interval: n?.m_targetImpactData?.m_impcatMinInteravl || 0.2,
        damageIndex: n?.m_targetImpactData?.m_damageIndex || 0,
      },
      api,
      { target: t.id, focus: true },
    );
    return;
  }
  if (skill === 'laser') {
    const sub = mainSub(g, skill, 'areas') || 4011,
      p = G[sub]?.areas[0] || {};
    zone(g, skill, sub, 270, 705, p, api, {
      beam: true,
      tx: t.x,
      ty: t.y,
      r: Math.max(5, 9 * m.range),
      sweep: buildCount(g, 412) > 0,
    });
    return;
  }
  if (['vortex', 'drone'].includes(skill)) {
    const sub = mainSub(g, skill, 'bullets'),
      p = G[sub]?.bullets[0] || {};
    zone(
      g,
      skill,
      sub,
      t.x,
      t.y,
      {
        radius: p.radius || 0.6,
        duration: p.life || S[skill].duration,
        interval: p.hit?.raw?.m_impcatMinInteravl || 0.3,
        damageIndex: p.damageIndex,
      },
      api,
      {
        moving: true,
        speed: p.speed * unit * m.speed,
        drone: skill === 'drone',
        pull: skill === 'vortex',
      },
    );
    if (buildCount(g, 1102))
      zone(
        g,
        skill,
        sub,
        Math.min(490, t.x + 65),
        t.y,
        { radius: p.radius || 0.6, duration: (p.life || 9) * 0.5, interval: 0.3 },
        api,
        { moving: true, speed: p.speed * unit * m.speed, pull: true },
      );
    return;
  }
  if (skill === 'electric') {
    const sub = mainSub(g, skill, 'electrodes') || 14002,
      n = G[sub]?.electrodes[0];
    const count = Math.min(8, (n?.m_cnt || 2) + m.count);
    const points = Array.from({ length: count }, (_, i) => ({
      x: Math.max(35, Math.min(505, t.x + (i - (count - 1) / 2) * 100)),
      y: t.y,
    }));
    const z = zone(
      g,
      skill,
      sub,
      t.x,
      t.y,
      {
        radius: 1.5,
        duration: n?.m_lifeTime || 10,
        interval: n?.m_spreadImpactData?.m_impcatMinInteravl || 0.2,
        delay: n?.m_delayTime || 0.667,
      },
      api,
      { points },
    );
    return z;
  }
  if (skill === 'airdrop') {
    const sub = mainSub(g, skill, 'areas') || 7012,
      p = G[sub]?.areas[0] || { radius: 0.75 };
    for (let i = 0; i < 3; i++)
      g.extendedCasts.push({
        at: g.time + 0.45 + i * 0.35,
        type: 'blast',
        skill,
        sub,
        x: Math.max(30, Math.min(510, t.x + (i - 1) * 55)),
        y: Math.max(0, t.y + (i - 1) * 60),
        profile: p,
      });
    return;
  }
  const sub = mainSub(g, skill, 'areas'),
    p = G[sub]?.areas[0] || { radius: 0.8, duration: 1, interval: 0.2 };
  zone(g, skill, sub || S[skill].id, t.x, t.y, p, api);
}
export function extendedShoot(g, t, api) {
  g.extendedCasts ??= [];
  g.extendedZones ??= [];
  for (const skill of Object.keys(S)) {
    if (['frost', 'lightning'].includes(skill) || !g.weapons[skill] || g.cooldowns[skill] > 0)
      continue;
    g.cooldowns[skill] = nativeCooldown(g, skill);
    let count = 1;
    for (const sub of [S[skill].id, ...subs(g, skill)])
      count += Math.max(0, Math.round(nativeAttr(g, sub, 134)));
    if (api.random(g) < (g.stats.nativeGemAttrs?.[412] || 0)) count++;
    for (let i = 0; i < Math.min(16, count); i++)
      g.extendedCasts.push({
        at: g.time + i * 0.3,
        type: 'cast',
        skill,
        target: t.id,
        x: t.x,
        y: t.y,
      });
  }
}
export function extendedTick(g, dt, api) {
  const due = (g.extendedCasts || []).filter((c) => c.at <= g.time + 1e-7);
  g.extendedCasts = (g.extendedCasts || []).filter((c) => c.at > g.time + 1e-7);
  for (const c of due) {
    const t =
      alive(g).find((e) => e.id === c.target) ||
      alive(g).sort(
        (a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y),
      )[0];
    if (c.type === 'cast') {
      if (t) cast(g, c.skill, t, api);
    } else if (c.type === 'chain') {
      if (t) {
        nativeElectronPath(
          g,
          c.from,
          { x: t.x, y: t.y },
          t,
          amount(g, c.skill, c.sub, c.index),
          api,
        );
        hit(g, t, c.skill, c.sub, c.index, api);
        api.effect(g, 'electron', t.x, t.y, { path: [c.from, { x: t.x, y: t.y }], duration: 0.3 });
      }
    } else if (c.type === 'blast') {
      nativeProcMissile(g, api);
      zone(g, c.skill, c.sub, c.x, c.y, { ...c.profile, duration: 0.05, interval: 0.1 }, api);
    }
  }
  for (const z of g.extendedZones || []) {
    if (z.moving) {
      if (z.drone) {
        z.vx ??= z.speed * 0.85;
        z.vy ??= -z.speed * 0.35;
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        let bounced = false;
        if (z.x < 40 || z.x > 500) {
          z.x = Math.max(40, Math.min(500, z.x));
          z.vx = -z.vx;
          bounced = true;
        }
        if (z.y < 0 || z.y > 620) {
          z.y = Math.max(0, Math.min(620, z.y));
          z.vy = -z.vy;
          bounced = true;
        }
        if (bounced) nativeDroneReflect(g, z);
      } else z.y -= z.speed * dt;
    }
    if (z.focus) {
      const t = alive(g).find((e) => e.id === z.target) || alive(g).sort((a, b) => b.y - a.y)[0];
      if (t) {
        z.target = t.id;
        z.x = t.x;
        z.y = t.y;
      }
    }
    if (z.pull)
      for (const e of alive(g))
        if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + 40) {
          const force = (1 + nativeAttr(g, z.sub, 124)) * nativeTargetForce(g, e, 125) * dt * 0.8;
          e.x += (z.x - e.x) * force;
          e.slow = Math.max(e.slow || 0, 0.3);
        }
    if (z.next > g.time || z.next > z.until) continue;
    z.next += z.interval;
    if (z.beam) {
      const a = z.sweep
        ? -0.6 + Math.sin(g.time * 1.5) * 0.6
        : Math.atan2(z.ty - z.y, z.tx - z.x) + Math.PI / 2;
      const dx = Math.sin(a),
        dy = -Math.cos(a);
      z.tx = z.x + dx * 1000;
      z.ty = z.y + dy * 1000;
      api.effect(g, 'laser', z.x, z.y, {
        tx: z.tx,
        ty: z.ty,
        r: z.r,
        duration: z.until - z.bornAt,
        visualKey: `zone:${z.id}`,
        bornAt: z.bornAt,
        until: z.until,
      });
    } else if (z.focus)
      api.effect(g, 'guided', 270, 705, {
        tx: z.x,
        ty: z.y,
        r: 5,
        duration: z.until - z.bornAt,
        visualKey: `zone:${z.id}`,
        bornAt: z.bornAt,
        until: z.until,
      });
    else
      api.effect(g, z.skill, z.x, z.y, {
        r: z.r,
        duration: z.until - z.bornAt,
        points: z.points,
        variant: z.sub,
        visualKey: `zone:${z.id}`,
        bornAt: z.bornAt,
        until: z.until,
      });
    const targets = [];
    for (const e of alive(g)) {
      let inside = z.focus
        ? e.id === z.target
        : z.beam
          ? Math.abs((e.x - z.x) * (z.ty - z.y) - (e.y - z.y) * (z.tx - z.x)) / 1000 < e.r + z.r
          : Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.r;
      if (z.points)
        inside =
          z.points.some((p) => Math.hypot(e.x - p.x, e.y - p.y) < 65 + e.r) ||
          (Math.abs(e.y - z.y) < 12 && e.x >= z.points[0].x && e.x <= z.points.slice(-1)[0].x);
      if (inside) {
        targets.push(e);
        hit(g, e, z.skill, z.sub, z.index, api, z.ratio * (1 + (z.reflectBonus || 0)), {
          sourceId: z.id,
          shootId:
            z.skill === 'iceblast' ? 92 : z.skill === 'drone' ? 3 : z.skill === 'airdrop' ? 3 : 2,
        });
        if (z.skill === 'electric' && buildCount(g, 1403))
          e.paralysis = Math.max(e.paralysis || 0, 0.2);
      }
    }
    nativeProcZoneComplete(g, z, targets, api);
  }
  g.extendedZones = (g.extendedZones || []).filter((z) => z.until > g.time && z.y > -100);
}
