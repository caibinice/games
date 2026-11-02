import { nativeTargetForce } from './native-buff-runtime.mjs';
import { gemBuffDuration } from './gem-combat.mjs';
import {
  CLIENT_COMBAT_PROFILES as P,
  CLIENT_SKILL_RULES as S,
  CLIENT_SKILL_STATUS as B,
} from './client-skill-data.mjs';
import {
  buildCount as has,
  branchModifiers,
  nativeCooldown,
  nativeAttr,
} from './client-builds.mjs';

// The web battle still uses its own damage/camera scale. Native seconds, radii,
// counts, hit policies and dependencies are retained independently of that scale.
export const CLIENT_WORLD_SCALE = 72;
const unit = CLIENT_WORLD_SCALE,
  rad = Math.PI / 180;
function amount(g, skill, index, sub) {
  const base = skill === 'frost' ? 38 / 0.9 : 51 / 1.2;
  return (
    (g.stats.nativeAttack ? g.damage : base * g.damage) *
    (S[skill].damage[index]?.Param1 || 0) *
    branchModifiers(g, skill, sub).damage
  );
}
function projectile(
  g,
  profile,
  skill,
  sub,
  x,
  y,
  angle,
  api,
  { variant = 'normal', ignore = [], parent = false } = {},
) {
  const m = branchModifiers(g, skill, sub),
    speed = profile.speed * unit * m.speed;
  const b = api.fire(
    g,
    x,
    y,
    { x: x + Math.cos(angle) * 100, y: y + Math.sin(angle) * 100 },
    amount(g, skill, profile.damageIndex, sub),
    {
      speed,
      pierce: Math.max(0, profile.through + m.through),
      color: skill === 'frost' ? '#b4f8ff' : '#b8a6ff',
      size: profile.radius * unit,
      kind: skill,
    },
  );
  Object.assign(b, {
    nativeSkill: true,
    nativeSub: sub,
    variant,
    parent,
    hit: [...ignore],
    hitCount: 0,
    life: profile.range / profile.speed / m.speed,
    range: profile.range * unit,
    distance: 0,
    knockback: profile.knockback * unit * (1 + m.knockback),
    nativeProfile: profile,
  });
  return b;
}
function frostCast(g, t, api) {
  const giant = !!has(g, 211),
    p = giant ? P.frostGiant : P.frost,
    sub = giant ? 2111 : 2011;
  const count = Math.max(1, p.count + branchModifiers(g, 'frost', sub).count),
    angle = Math.atan2(t.y - 705, t.x - 270);
  for (let i = 0; i < count; i++)
    projectile(
      g,
      p,
      'frost',
      sub,
      270 + (i - (count - 1) / 2) * 7,
      705,
      angle + (i - (count - 1) / 2) * p.angle * rad,
      api,
      { variant: giant ? 'giant' : 'normal' },
    );
  api.effect(g, 'frost-launch', 270, 705, { duration: 0.2 });
}
function coldDot(g, e, api, unlimited) {
  const rule = B[unlimited ? 21911 : 20811];
  let d = g.nativeDots.find((d) => d.enemy === e.id);
  if (!d) {
    d = { enemy: e.id, stacks: 0, next: g.time, until: 0 };
    g.nativeDots.push(d);
  }
  d.stacks = Math.min(rule.StackNum, d.stacks + 1);
  d.until = g.time + rule.DurTime * (1 + (g.stats.nativeGemAttrs?.[132] || 0));
  d.rule = rule;
  // Native TickWhenAdd=1: the first application also deals a tick immediately.
  if (d.stacks === 1) {
    api.damage(
      g,
      e,
      (g.stats.nativeAttack ? g.damage : (38 / 0.9) * g.damage) *
        rule.DotDamageData.Param1 *
        d.stacks,
      'frost',
    );
    d.next = g.time + rule.DotTickConfig.TickTime;
  }
}
function splitTargets(g, hit, count, api) {
  const pool = g.enemies.filter((e) => !e.dead && e.id !== hit.id),
    chosen = [];
  while (pool.length && chosen.length < count)
    chosen.push(pool.splice(Math.floor(api.random(g) * pool.length), 1)[0]);
  return chosen;
}
export function nativeBulletHit(g, b, e, api) {
  if (!b.nativeSkill) return;
  if (b.kind === 'lightning') {
    if (has(g, 310))
      e.paralysis = Math.max(
        e.paralysis || 0,
        B[31011].DurTime * (1 + (g.stats.nativeGemAttrs?.[132] || 0)),
      );
    return;
  }
  if (b.knockback) e.y = Math.max(-40, e.y - b.knockback * nativeTargetForce(g, e, 123));
  if (b.variant !== 'shard' && has(g, 206))
    e.freeze = Math.max(e.freeze, gemBuffDuration(g, 20611, B[20611].DurTime));
  if (
    (b.variant !== 'shard' && (has(g, 208) || has(g, 219))) ||
    (b.variant === 'shard' && (has(g, 218) || has(g, 220)))
  )
    coldDot(g, e, api, !!(has(g, 219) || has(g, 220)));
  if (b.variant === 'giant') {
    for (const t of splitTargets(g, e, P.frostGiant.targetCount, api))
      projectile(g, P.frost, 'frost', 2011, e.x, e.y, Math.atan2(t.y - e.y, t.x - e.x), api, {
        ignore: [e.id],
        parent: true,
      });
  } else if (b.variant === 'normal' && b.hitCount === 0 && has(g, 202)) {
    for (const t of splitTargets(g, e, P.frostShard.targetCount, api))
      projectile(g, P.frostShard, 'frost', 2021, e.x, e.y, Math.atan2(t.y - e.y, t.x - e.x), api, {
        variant: 'shard',
        ignore: [e.id],
      });
  }
}
function magneticArea(
  g,
  x,
  y,
  profile,
  sub,
  api,
  { paralysis = 0, effect = 'magnet-splash' } = {},
) {
  const m = branchModifiers(g, 'lightning', sub),
    r = profile.radius * unit * m.range;
  api.effect(g, effect, x, y, { r, duration: 0.38 });
  for (const e of g.enemies)
    if (!e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.r) {
      api.damage(g, e, amount(g, 'lightning', profile.damageIndex, sub), 'lightning');
      if (paralysis)
        e.paralysis = Math.max(
          e.paralysis || 0,
          paralysis * (1 + (g.stats.nativeGemAttrs?.[132] || 0)),
        );
    }
}
function magneticStrike(g, t, api, recast = 0) {
  if (!t || t.dead) return;
  const sub = has(g, 314) ? 3141 : 3011,
    x = t.x,
    y = t.y,
    stun = B[30111].DurTime + (has(g, 308) ? B[30811].FuncData.FuncParam[1] / 10000 : 0);
  api.effect(g, 'magnet-strike', x, y, {
    r: has(g, 314) ? 24 : 13,
    duration: 0.4,
    nuclear: !!has(g, 314),
  });
  api.damage(
    g,
    t,
    amount(g, 'lightning', P.magnet.damageIndex, sub) * (has(g, 314) ? 3 : 1),
    'lightning',
    { sourceId: 'magnet:' + g.time, shootId: 2 },
  );
  t.paralysis = Math.max(t.paralysis || 0, gemBuffDuration(g, 30111, stun));
  g.nativeCasts.push({
    type: 'splash',
    at: g.time + P.magnetSplash.delay,
    x,
    y,
    profile: P.magnetSplash,
    sub: 3012,
    paralysis: stun,
  });
  if (has(g, 311))
    g.nativeCasts.push({
      type: 'splash',
      at: g.time + P.magnetExplosion.delay,
      x,
      y,
      profile: P.magnetExplosion,
      sub: 3111,
    });
  if (has(g, 304)) {
    const m = branchModifiers(g, 'lightning', 3041);
    g.nativeZones.push({
      x,
      y,
      next: g.time + P.magnetMatrix.delay,
      until: g.time + P.magnetMatrix.duration + m.duration,
      profile: P.magnetMatrix,
    });
  }
  if (has(g, 309) || has(g, 321))
    for (let i = 0; i < P.magnetParticle.count; i++)
      projectile(
        g,
        P.magnetParticle,
        'lightning',
        3091,
        x,
        y,
        i * P.magnetParticle.angle * rad,
        api,
        { variant: 'particle', ignore: [t.id] },
      );
  if (t.dead && has(g, 312) && recast < 140)
    g.nativeCasts.push({ type: 'magnet', at: g.time + 0.4, x, y, recast: recast + 1, near: true });
}
export function nativeShoot(g, t, api) {
  for (const skill of ['frost', 'lightning']) {
    if (!g.weapons[skill] || g.cooldowns[skill] > 0) continue;
    g.cooldowns[skill] = nativeCooldown(g, skill);
    const extra = (g.stats.nativeGemAttrs?.[412] || 0) + nativeAttr(g, S[skill].id, 412);
    const count =
      1 +
      (api.random(g) < extra ? 1 : 0) +
      (skill === 'frost' ? has(g, 207) + has(g, 210) : has(g, 307) + has(g, 313));
    for (let i = 0; i < count; i++)
      g.nativeCasts.push({
        type: skill === 'frost' ? 'frost' : 'magnet',
        at: g.time + i * 0.3,
        target: t.id,
        x: t.x,
        y: t.y,
        recast: 0,
      });
  }
}
export function nativeTick(g, api) {
  const due = g.nativeCasts.filter((c) => c.at <= g.time + 1e-7);
  g.nativeCasts = g.nativeCasts.filter((c) => c.at > g.time + 1e-7);
  for (const cast of due) {
    if (cast.type === 'splash') {
      magneticArea(g, cast.x, cast.y, cast.profile, cast.sub, api, { paralysis: cast.paralysis });
      continue;
    }
    const alive = g.enemies.filter((e) => !e.dead);
    let t = alive.find((e) => e.id === cast.target);
    if (!t)
      t = alive.sort(
        (a, b) => Math.hypot(a.x - cast.x, a.y - cast.y) - Math.hypot(b.x - cast.x, b.y - cast.y),
      )[0];
    if (!t) continue;
    if (cast.near && Math.hypot(t.x - cast.x, t.y - cast.y) > P.magnetSplash.radius * unit + t.r)
      continue;
    if (cast.type === 'frost') frostCast(g, t, api);
    else magneticStrike(g, t, api, cast.recast || 0);
  }
  for (const zone of g.nativeZones) {
    if (zone.next > g.time || zone.next > zone.until) continue;
    zone.next += zone.profile.interval;
    magneticArea(g, zone.x, zone.y, zone.profile, 3041, api, { effect: 'magnet-matrix' });
    const r = zone.profile.radius * unit * branchModifiers(g, 'lightning', 3041).range;
    for (const e of g.enemies)
      if (!e.dead && Math.hypot(e.x - zone.x, e.y - zone.y) <= r + e.r) {
        e.nativeSlowUntil = g.time + B[30411].DurTime * (1 + (g.stats.nativeGemAttrs?.[132] || 0));
        e.nativeSlowRatio = 1 + B[30411].AttrData[0].Value;
      }
  }
  g.nativeZones = g.nativeZones.filter((z) => z.until > g.time);
  for (const d of g.nativeDots) {
    const e = g.enemies.find((e) => e.id === d.enemy && !e.dead);
    if (!e) continue;
    if (d.next <= g.time && d.next <= d.until) {
      api.damage(
        g,
        e,
        (g.stats.nativeAttack ? g.damage : (38 / 0.9) * g.damage) *
          d.rule.DotDamageData.Param1 *
          d.stacks,
        'frost',
      );
      d.next += d.rule.DotTickConfig.TickTime;
    }
  }
  g.nativeDots = g.nativeDots.filter(
    (d) => d.until > g.time && g.enemies.some((e) => e.id === d.enemy && !e.dead),
  );
}
