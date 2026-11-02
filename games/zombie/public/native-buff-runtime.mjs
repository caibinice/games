import {
  nativeProcHit,
  nativeProcTick,
  nativeProcCast,
  nativeProcWallDamage,
} from './native-proc-runtime.mjs';
import { PROC_GRAPH_IDS } from './proc-graph-rules.mjs';
import { nativeAttr } from './client-builds.mjs';
import {
  CLIENT_NATIVE_BUFFS as BUFF,
  CLIENT_NATIVE_GRAPHS as GRAPH,
} from './native-skill-extra.mjs';
import { CLIENT_SKILL_RULES as SKILL } from './client-skill-data.mjs';
import { expandNativeBuffs, ROOT_SKILLS } from './native-buff-rules.mjs';
const globalAttr = (g, id) => (g.stats.nativeGemAttrs?.[id] || 0) + (g.stats.nativeRaw?.[id] || 0),
  live = (g) => g.enemies.filter((e) => !e.dead);
export function activeNativeBuffs(g) {
  const key = g.nativeBuffRevision || 0;
  if (g.nativeProcCache?.revision === key && g.nativeProcCache?.gemRows === g.stats.nativeGemBuffs)
    return g.nativeProcCache.rows;
  const rows = expandNativeBuffs([
    ...(g.stats.nativeGemBuffs || []),
    ...(g.nativeBuildBuffs || []),
  ]);
  g.nativeProcCache = { revision: key, gemRows: g.stats.nativeGemBuffs, rows };
  return rows;
}
function state(g) {
  return (g.nativeProcState ??= { extraAt: {}, shieldUsed: {}, lowHpUsed: {}, killReduction: {} });
}
export function nativeHasState(g, e, id) {
  if (id === -1)
    return (
      e.freeze > 0 ||
      e.paralysis > 0 ||
      e.slow > 0 ||
      e.burn > 0 ||
      Object.values(e.nativeGemStates || {}).some((t) => t > g.time)
    );
  if (id === 3) return e.freeze > 0;
  if (id === 1 || id === 2) return e.paralysis > 0;
  return (e.nativeGemStates?.[id] || 0) > g.time || (id === 4 && e.burn > 0);
}
export function markNativeState(e, id, until) {
  if (id) {
    e.nativeGemStates ??= {};
    e.nativeGemStates[id] = Math.max(e.nativeGemStates[id] || 0, until);
  }
}
function match(root, kind) {
  return root === 0 || root === -1 || root === ROOT_SKILLS[kind];
}
export function nativeExtraHit(g, e, kind, critical, api) {
  const s = state(g),
    attack = g.stats.nativeAttack || g.damage || 100;
  let extra = 0;
  if (
    kind === 'vehicle' &&
    e.type !== 'boss' &&
    !e.elite &&
    e.hp / e.maxHp < nativeAttr(g, 5000, 418)
  )
    return { extra: Math.max(0, e.hp), execute: true };
  for (const b of activeNativeBuffs(g)) {
    const f = b.FuncData.FuncId,
      p = b.FuncData.FuncParam;
    if (f === 38 && p[1] === 404 && e.type !== 'boss' && !e.elite && api.random(g) < p[2] / 10000)
      return { extra: Math.max(0, e.hp), execute: true };
    if ((f !== 33 || !critical) && f !== 34) continue;
    const key = b.id + ':' + kind;
    if ((s.extraAt[key] ?? -Infinity) + p[3] / 10000 > g.time) continue;
    const ratio = b.display?.ratio ?? p[0] / 1e6,
      cap = b.display?.cap ?? p[1] / 1e6;
    extra += Math.min(e.maxHp * ratio, attack * cap);
    s.extraAt[key] = g.time;
  }
  return { extra, execute: false };
}
export function nativeRandomDamageRatio(g, api) {
  let scale = 1;
  for (const b of activeNativeBuffs(g))
    if (b.FuncData.FuncId === 10) {
      const p = b.FuncData.FuncParam;
      scale *= 1 + (p[0] + (p[1] - p[0]) * api.random(g)) / 10000;
    }
  return Math.max(0, scale);
}
function buffTime(g, b) {
  let duration = b.DurTime;
  for (const m of activeNativeBuffs(g))
    if (m.FuncData.FuncId === 5 && m.FuncData.FuncParam[0] === b.BuffID)
      duration += m.FuncData.FuncParam[1] / 10000;
  return Math.max(0, duration * (1 + globalAttr(g, 132)));
}
export function applyNativeTargetBuff(g, e, id, kind) {
  const b = BUFF[id];
  if (!b || e.dead) return false;
  const duration = buffTime(g, b),
    until = g.time + duration,
    st = b.State.StateID;
  markNativeState(e, st, until);
  if (st === 3 || st === 17 || st === 20) e.freeze = Math.max(e.freeze || 0, duration);
  if ([1, 2, 15, 16].includes(st)) e.paralysis = Math.max(e.paralysis || 0, duration);
  if (st === 4) e.burn = Math.max(e.burn || 0, duration);
  for (const a of b.AttrData || []) {
    if (a.DataType === 108) {
      e.nativeSlowUntil = until;
      e.nativeSlowRatio = Math.max(0.05, 1 + a.Value);
    }
    if ([123, 125].includes(a.DataType)) {
      e.nativeForceBuffs ??= {};
      e.nativeForceBuffs[id] = {
        until,
        attrs: Object.fromEntries(b.AttrData.map((v) => [v.DataType, v.Value])),
      };
    }
    if (a.DataType === 354 && a.Value < 0) e.groundedUntil = until;
    if (a.DataType === 128) {
      e.vulnerableUntil = until;
      e.vulnerableRatio = 1 + a.Value;
    }
  }
  if (st === 29) {
    e.nativeWoundUntil = until;
    e.nativeWoundRatio = b.State.StateParam;
  }
  const dot = b.DotDamageData;
  if (dot?.AttrType && dot.Param1) {
    e.nativeGemDots ??= {};
    const previous = e.nativeGemDots[id],
      old = previous && previous.until > g.time ? previous : null,
      stack = Math.min(Math.max(1, b.StackNum), old ? old.stacks + 1 : 1);
    e.nativeGemDots[id] = {
      id,
      until,
      next: old?.next ?? g.time + (b.DotTickConfig.TickWhenAdd ? 0 : b.DotTickConfig.TickTime),
      stacks: stack,
      kind: b.DotTickConfig.BindSkill
        ? Object.keys(ROOT_SKILLS).find((k) => ROOT_SKILLS[k] === b.DotTickConfig.BindSkill) || kind
        : kind,
    };
    if (st === 22) e.frostbiteStacks = stack;
  }
  return true;
}
function addProcZone(g, e, kind, sub, p) {
  g.gemProcZones ??= [];
  const radius = p.radius * 72 * (1 + globalAttr(g, 111)),
    duration = p.duration * (1 + globalAttr(g, 114));
  g.gemProcZones.push({
    x: e.x,
    y: e.y,
    r: radius,
    until: g.time + duration,
    next: g.time,
    interval: Math.max(0.05, p.interval),
    kind,
    sub,
    index: p.damageIndex,
    ratio: p.damageRatio || 1,
  });
  if (g.gemProcZones.length > 64) g.gemProcZones.shift();
}
export function nativeAreaImpact(g, point, kind) {
  if (kind !== 'grenade') return;
  for (const [id, skill] of Object.entries(g.nativeSubSkills || {})) {
    if (skill !== kind || Number(id) < 20000000 || Number(id) >= 30000000) continue;
    for (const p of GRAPH[id]?.areas || [])
      if (p.repeat.m_shootId === 2) addProcZone(g, point, kind, Number(id), p);
  }
}
export function nativeHitBuffs(g, e, kind, api, context = {}) {
  if (context.noProcs) return;
  for (const b of activeNativeBuffs(g)) {
    const f = b.FuncData.FuncId,
      p = b.FuncData.FuncParam;
    if (f === 11 && match(p[0], kind) && !e.dead && api.random(g) < p[2] / 10000)
      applyNativeTargetBuff(g, e, p[3], kind);
    if (f === 24 && match(p[0], kind) && !e.dead && (p[1] === 0 || nativeHasState(g, e, p[1]))) {
      if (BUFF[p[2]]?.FuncData.FuncId === 32)
        api.damage(g, e, e.hp, kind, { noProcs: true, allowCrit: false, absolute: true });
      else applyNativeTargetBuff(g, e, p[2], kind);
    }
  }
  for (const [id, skill] of Object.entries(g.nativeSubSkills || {})) {
    if (
      skill !== kind ||
      Number(id) < 20000000 ||
      Number(id) >= 30000000 ||
      PROC_GRAPH_IDS.has(Number(id))
    )
      continue;
    const graph = GRAPH[id];
    if (!graph) continue;
    if (!e.dead)
      for (const n of graph.buffNodes) {
        const r = n.m_triggleRepeat || {};
        if (
          r.m_eventType !== 1 ||
          ![1, 2].includes(r.m_shootId) ||
          api.random(g) > (n.m_randomRate ?? 1)
        )
          continue;
        applyNativeTargetBuff(g, e, n.m_buffID || n.m_buffId || n.m_buffData?.m_buffID, kind);
      }
  }
  nativeProcHit(g, e, kind, api, context);
}
export function nativeGemTick(g, dt, api) {
  for (const e of live(g)) {
    let stacks = 0;
    for (const [id, d] of Object.entries(e.nativeGemDots || {})) {
      const b = BUFF[id];
      if (!b || d.until <= g.time) {
        delete e.nativeGemDots[id];
        continue;
      }
      if (b.State.StateID === 22) stacks = Math.max(stacks, d.stacks);
      if (d.next > g.time) continue;
      d.next += Math.max(0.05, b.DotTickConfig.TickTime);
      const a = b.DotDamageData,
        atk = g.stats.nativeAttack || g.damage;
      let amount =
        a.AttrType === 1
          ? atk * a.Param1
          : [3, 20].includes(a.AttrType)
            ? e.maxHp * a.Param1
            : a.AttrType === 23
              ? e.maxHp * a.Param1
              : 0;
      if (a.AttrType !== 1 && a.Param3 > 0) amount = Math.min(amount, (atk * a.Param3) / 10000);
      let ratio = 1;
      for (const m of activeNativeBuffs(g))
        if (m.FuncData.FuncId === 23 && m.FuncData.FuncParam[0] === Number(id)) {
          const p = m.FuncData.FuncParam;
          if (p[2] && !nativeHasState(g, e, p[2])) continue;
          ratio += p[1] / 10000;
          if (p[3] === 1 && p[2] === 3) {
            e.freeze = 0;
            for (const st of [3, 17, 20]) delete e.nativeGemStates?.[st];
          }
        }
      amount *= d.stacks * ratio;
      if (a.AttrType === 23) {
        const removed = Math.min(e.maxHp - 1, amount);
        e.maxHp -= removed;
        e.hp = Math.min(e.hp, e.maxHp);
      } else
        api.damage(g, e, amount, d.kind, {
          dot: true,
          noProcs: true,
          allowCrit: false,
          absolute: a.AttrType !== 1,
          buffId: Number(id),
        });
    }
    e.frostbiteStacks = stacks;
  }
  for (const z of g.gemProcZones || []) {
    if (z.until <= g.time || z.next > g.time) continue;
    z.next += z.interval;
    api.effect(g, 'burn-zone', z.x, z.y, { r: z.r, duration: z.interval + 0.1 });
    const coefficient = SKILL[z.kind]?.damage[z.index]?.Param1 || 0.1;
    for (const e of live(g))
      if (Math.hypot(e.x - z.x, e.y - z.y) <= z.r + e.r)
        api.damage(g, e, (g.stats.nativeAttack || g.damage) * coefficient * z.ratio, z.kind, {
          dot: true,
          noProcs: true,
          allowCrit: false,
        });
  }
  g.gemProcZones = (g.gemProcZones || []).filter((z) => z.until > g.time);
  nativeProcTick(g, api);
}
export function nativeCastBuffs(g, kind, api) {
  nativeProcCast(g, kind, api);
  if (g.stats.nativeFormStart?.skill === kind) g.nativeCoreCasts = (g.nativeCoreCasts || 0) + 1;
  for (const b of activeNativeBuffs(g))
    if (b.FuncData.FuncId === 25 && b.FuncData.FuncParam[1] === ROOT_SKILLS[kind])
      state(g).killReduction[b.id] = 0;
}
export function nativeKillBuffs(g, e, kind) {
  for (const b of activeNativeBuffs(g)) {
    const f = b.FuncData.FuncId,
      p = b.FuncData.FuncParam;
    if (f !== 25 || !match(p[0], kind)) continue;
    const targets =
      p[1] === 0
        ? Object.keys(g.cooldowns)
        : Object.keys(ROOT_SKILLS).filter((k) => ROOT_SKILLS[k] === p[1]);
    for (const key of targets) {
      if (p[4] === 0) g.cooldowns[key] = Math.max(0, g.cooldowns[key] - p[2] / 10000);
      else {
        let ratio = p[2] / 10000;
        if (p[3] < 10000) {
          const used = state(g).killReduction[b.id] || 0;
          ratio = Math.max(0, Math.min(ratio, p[3] / 10000 - used));
          state(g).killReduction[b.id] = used + ratio;
        }
        g.cooldowns[key] = Math.max(0, g.cooldowns[key] * (1 - ratio));
      }
    }
  }
}
export function nativeWallHit(g, e, amount, api) {
  if (amount <= 0) return 0;
  const s = state(g);
  if ((s.immuneUntil || 0) > g.time) {
    api.effect(g, 'wall-shield', 270, 650, { duration: 0.3, r: 250 });
    return 0;
  }
  const grouped = new Map();
  for (const b of activeNativeBuffs(g))
    if (b.FuncData.FuncId === 9) {
      const p = b.FuncData.FuncParam,
        old = grouped.get(b.id) || { count: 0, reflect: 0 };
      old.count += p[0];
      old.reflect = Math.max(old.reflect, p[2] / 10000);
      grouped.set(b.id, old);
    }
  for (const [id, shield] of grouped)
    if ((s.shieldUsed[id] || 0) < shield.count) {
      s.shieldUsed[id] = (s.shieldUsed[id] || 0) + 1;
      api.effect(g, 'wall-shield', 270, 650, { duration: 0.35, r: 250 });
      if (shield.reflect)
        api.damage(g, e, (g.stats.nativeAttack || g.damage) * shield.reflect, 'wall-reflect', {
          noProcs: true,
          allowCrit: false,
        });
      return 0;
    }
  const taken = Math.max(0, (amount + globalAttr(g, 128)) * (1 + globalAttr(g, 129)));
  for (const b of activeNativeBuffs(g))
    if (b.FuncData.FuncId === 6) {
      const p = b.FuncData.FuncParam;
      if (!s.lowHpUsed[b.id] && g.hp - taken < (g.maxHp * p[0]) / 10000) {
        s.lowHpUsed[b.id] = true;
        s.immuneUntil = g.time + (BUFF[p[1]]?.DurTime || 0);
      }
    }
  const result = activeNativeBuffs(g).some((b) => b.State.StateID === 32)
    ? Math.min(taken, Math.max(0, g.hp - 1))
    : taken;
  nativeProcWallDamage(g, result, api);
  return result;
}
export function nativeElectronPath(g, from, to, main, amount, api) {
  if (!(g.stats.nativeSkillAttrs?.[10011]?.[168] > 0)) return;
  let bonus = 0;
  for (const b of activeNativeBuffs(g))
    if (b.FuncData.FuncId === 7 && b.FuncData.FuncParam[0] === 10000)
      bonus += b.FuncData.FuncParam[2] / 10000;
  const damage = (g.stats.nativeAttack || g.damage) * 0.15 * (1 + bonus);
  for (const e of live(g)) {
    if (e === main) continue;
    const dx = to.x - from.x,
      dy = to.y - from.y,
      l2 = dx * dx + dy * dy,
      t = Math.max(0, Math.min(1, ((e.x - from.x) * dx + (e.y - from.y) * dy) / (l2 || 1))),
      dist = Math.hypot(e.x - from.x - t * dx, e.y - from.y - t * dy);
    if (dist <= e.r + 10) api.damage(g, e, damage, 'electron', { noProcs: true });
  }
}

export function nativeTargetForce(g, e, type) {
  return (
    1 +
    Object.values(e.nativeForceBuffs || {})
      .filter((b) => b.until > g.time)
      .reduce((sum, b) => sum + (b.attrs[type] || 0), 0)
  );
}
export function nativeHealTarget(g, e, amount) {
  const scale = e.nativeWoundUntil > g.time ? Math.max(0, 1 - e.nativeWoundRatio) : 1;
  const healed = Math.min(Math.max(0, e.maxHp - e.hp), Math.max(0, amount) * scale);
  e.hp += healed;
  return healed;
}
