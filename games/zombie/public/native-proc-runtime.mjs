import {
  CLIENT_NATIVE_GRAPHS as G,
  CLIENT_NATIVE_BASES as BASE,
  CLIENT_NATIVE_BUFFS as B,
} from './native-skill-extra.mjs';
import { PROC_GRAPH_IDS } from './proc-graph-rules.mjs';
import { nativeAttr } from './client-builds.mjs';
import { ROOT_SKILLS } from './native-buff-rules.mjs';
import {
  activeNativeBuffs,
  applyNativeTargetBuff,
  nativeHasState,
  markNativeState,
} from './native-buff-runtime.mjs';
const UNIT = 72,
  alive = (g) => g.enemies.filter((e) => !e.dead),
  buffId = (n) => n.m_buffId || n.m_buffID || n.m_buffData?.m_buffID;
const repeat = (n) => n.repeat || n.m_triggleRepeat || {};
const state = (g) =>
  (g.nativeGraphState ??= {
    counts: {},
    first: {},
    casts: {},
    wall: {},
    self: {},
    queue: [],
    zones: [],
    serial: 0,
  });
const primaryShoot = {
  frost: 3,
  lightning: 2,
  grenade: 2,
  laser: 2,
  guided: 2,
  electron: 2,
  wind: 2,
  vehicle: 2,
  vortex: 2,
  drone: 3,
  fuel: 2,
  electric: 2,
  iceblast: 92,
  airdrop: 3,
  gun: 2,
};
function queue(g, entry) {
  const s = state(g);
  if (s.queue.length < 256) s.queue.push(entry);
}
function procGraphs(g, kind) {
  return Object.entries(g.nativeSubSkills || {})
    .filter(([id, k]) => k === kind && PROC_GRAPH_IDS.has(Number(id)))
    .map(([id]) => Number(id));
}
function keySource(g, kind, c) {
  return c.sourceId ?? `${kind}:${state(g).casts[kind] || 0}`;
}
function matches(g, r, signal, e, kind, c, key) {
  if (r.m_eventType !== signal.event || r.m_shootId !== signal.shoot) return false;
  if (r.m_buffStateIdTrigger && !nativeHasState(g, e, r.m_buffStateIdTrigger)) return false;
  const s = state(g),
    source = keySource(g, kind, c);
  if (r.m_firstHitTarget) {
    const k = key + ':' + source;
    if (s.first[k]) return false;
    s.first[k] = true;
  }
  if (r.m_firstBulletTriggle && (s.casts[kind] || 0) !== 1) return false;
  if (r.m_totalShootCount > 0) {
    s.counts[key] = (s.counts[key] || 0) + 1;
    if (s.counts[key] % r.m_totalShootCount) return false;
  }
  return true;
}
function select(g, origin, find, count, exclude, api) {
  count = Math.min(32, count);
  let pool = alive(g).filter(
    (e) =>
      e.id !== exclude &&
      (!find ||
        find.m_distance <= 0 ||
        Math.hypot(e.x - origin.x, e.y - origin.y) <= find.m_distance * UNIT + e.r),
  );
  const result = [];
  while (pool.length && result.length < count) {
    const index =
      find?.m_targetSelectType === 1
        ? Math.floor(api.random(g) * pool.length)
        : pool.reduce(
            (best, e, i) =>
              Math.hypot(e.x - origin.x, e.y - origin.y) <
              Math.hypot(pool[best].x - origin.x, pool[best].y - origin.y)
                ? i
                : best,
            0,
          );
    result.push(pool.splice(index, 1)[0]);
  }
  const found = result.slice();
  for (let i = 0; find?.m_fillTarget && found.length && result.length < count; i++)
    result.push(found[i % found.length]);
  return result;
}
function selfBuff(g, id, kind) {
  const b = B[id];
  if (!b) return;
  const s = state(g),
    old = s.self[id],
    stacks = Math.min(Math.max(1, b.StackNum), (old?.until > g.time ? old.stacks : 0) + 1);
  s.self[id] = { id, kind, stacks, until: b.TimeType === 1 ? Infinity : g.time + b.DurTime };
  if (b.State.StateID === 23) {
    g.nativeUnlimitedUntil = g.time + b.DurTime;
    if (g.magazine) {
      g.magazine.reload = 0;
      g.magazine.ammo = g.magazine.capacity;
    }
  }
  if (b.FuncData.FuncId === 29) {
    const p = b.FuncData.FuncParam,
      k = Object.keys(ROOT_SKILLS).find((k) => ROOT_SKILLS[k] === p[0]);
    if (k) g.cooldowns[k] = Math.max(0, g.cooldowns[k] * (1 - p[1] / 10000));
  }
}
export function nativeProcCritical(g, kind) {
  let total = 0;
  for (const v of Object.values(state(g).self)) {
    if (v.until <= g.time) continue;
    const f = B[v.id]?.FuncData,
      p = f?.FuncParam;
    if (f?.FuncId === 20 && p[0] === ROOT_SKILLS[kind] && p[2] === 104)
      total += (p[3] / 10000) * v.stacks;
  }
  return total;
}
function amount(g, kind, sub, index, ratio = 1, root = ROOT_SKILLS[kind]) {
  const rule = BASE[root]?.AttrDamageData[index];
  return (
    (g.stats.nativeAttack || g.damage) *
    (rule?.Param1 || 0) *
    Math.max(0, 1 + nativeAttr(g, sub, 127)) *
    ratio
  );
}
function contextFor(kind, sub, index, extra = {}) {
  return {
    noProcs: true,
    sourceSub: sub,
    damageIndex: index,
    damageRule: BASE[ROOT_SKILLS[kind]]?.AttrDamageData[index],
    ...extra,
  };
}
function spawnBullet(g, kind, sub, p, origin, t, api) {
  if (g.bullets.length >= 400) return;
  const speed = Math.max(20, (p.speed || 8) * UNIT),
    count = Math.min(
      16,
      Math.max(
        1,
        p.group?.m_groupType === 2
          ? p.group.m_NoneNum || 1
          : p.group?.m_groupType === 1
            ? p.group.m_fixedDir.length
            : p.count || 1,
      ),
    ),
    angle = Math.atan2(t.y - origin.y, t.x - origin.x);
  for (let i = 0; i < count; i++) {
    const a = angle + ((i - (count - 1) / 2) * (p.angle || 0) * Math.PI) / 180;
    const b = api.fire(
      g,
      origin.x,
      origin.y,
      { x: origin.x + Math.cos(a) * 100, y: origin.y + Math.sin(a) * 100 },
      amount(g, kind, sub, p.damageIndex, p.damageRatio || 1),
      {
        speed,
        pierce: Math.max(0, p.through),
        size: Math.max(3, p.radius * UNIT),
        kind,
        color: '#baf3ff',
      },
    );
    Object.assign(b, {
      life: Math.max(0.2, p.life || p.range / (p.speed || 8) || 3),
      nativeProc: {
        kind,
        sub,
        shoot: p.hit?.raw.m_shootId || 0,
        index: p.damageIndex,
        fx: p.effect?.m_prefabPath,
        rule: BASE[ROOT_SKILLS[kind]]?.AttrDamageData[p.damageIndex],
      },
      nativeNoProcs: true,
      hit: [origin.id].filter(Boolean),
    });
  }
}
function addArea(g, kind, sub, p, origin, t, api, root) {
  const s = state(g),
    shape = p.data?.m_shootTestParam,
    beam = shape?.m_type === 2,
    life = Math.max(0.001, p.duration || 0.001),
    hit = shape?.m_rect;
  s.zones.push({
    id: ++s.serial,
    kind,
    sub,
    index: p.damageIndex,
    x: origin.x,
    y: origin.y,
    tx: t.x,
    ty: t.y,
    r: Math.max(2, p.radius * UNIT),
    beam,
    exclude: beam ? origin.id : undefined,
    width: Math.max(3, (hit?.m_width || 0.1) * UNIT),
    until: g.time + life,
    next: g.time,
    interval: p.interval > 0 ? p.interval : Infinity,
    ratio: p.damageRatio || 1,
    shoot: p.hit?.raw.m_shootId || 0,
    root,
    freeze: 0,
  });
  if (s.zones.length > 128) s.zones.shift();
}
function send(g, kind, graphId, shoot, origin, t, api, depth = 0) {
  if (depth > 8) return;
  const graph = G[graphId];
  if (!graph) return;
  const graphs = [{ id: graphId, g: graph }];
  const root = ROOT_SKILLS[kind];
  if (G[root] && root !== graphId) graphs.push({ id: root, g: G[root] });
  for (const { id, g: gr } of graphs) {
    for (const p of gr.bullets)
      if (repeat(p).m_eventType === 1 && repeat(p).m_shootId === shoot)
        spawnBullet(g, kind, id === root ? graphId : id, p, origin, t, api);
    for (const p of gr.areas)
      if (repeat(p).m_eventType === 1 && repeat(p).m_shootId === shoot)
        addArea(g, kind, graphId, p, origin, t, api);
    for (const n of gr.buffNodes)
      if (repeat(n).m_eventType === 1 && repeat(n).m_shootId === shoot) {
        if (api.random(g) > n.m_randomRate) continue;
        if (n.m_objectType === 0) selfBuff(g, buffId(n), kind);
        else applyNativeTargetBuff(g, t, buffId(n), kind);
      }
    for (const n of gr.chains)
      if (repeat(n).m_eventType === 1 && repeat(n).m_shootId === shoot) {
        const d = n.m_chainData,
          used = new Set([origin.id]),
          count = Math.min(32, d.m_reflectCount || 1);
        let from = { x: origin.x, y: origin.y },
          target =
            t.id === origin.id ? select(g, origin, d.m_SearchTargetParam, 1, origin.id, api)[0] : t;
        for (let i = 0; i < count && target; i++) {
          used.add(target.id);
          queue(g, {
            at: g.time + i * (d.m_moveNodeTime || 0.2),
            type: 'chain',
            kind,
            sub: graphId,
            index: n.m_impactData.m_damageIndex,
            target: target.id,
            from,
            ratio: n.m_impactData.m_damageRatio || 1,
          });
          from = { x: target.x, y: target.y };
          target = select(g, from, d.m_SearchTargetParam, alive(g).length, null, api).find(
            (e) => !used.has(e.id),
          );
        }
      }
    for (const n of gr.focus)
      if (repeat(n).m_eventType === 1 && repeat(n).m_shootId === shoot) {
        state(g).zones.push({
          id: ++state(g).serial,
          kind,
          sub: graphId,
          index: n.m_targetImpactData.m_damageIndex,
          x: origin.x,
          y: origin.y,
          target: t.id,
          r: 4,
          focus: true,
          until: g.time + n.m_lifeTime,
          next: g.time,
          interval: Math.max(0.05, n.m_targetImpactData.m_impcatMinInteravl || 0.2),
          ratio: n.m_targetImpactData.m_damageRatio || 1,
          shoot: n.m_targetImpactData.m_shootId || 0,
        });
      }
  }
}
function signalGraph(g, kind, id, signal, e, api, c = {}) {
  const gr = G[id];
  if (!gr) return;
  let index = 0;
  for (const n of gr.events) {
    const key = id + ':event:' + index++;
    if (!matches(g, repeat(n), signal, e, kind, c, key)) continue;
    let shoot = 0,
      count = 1,
      rate = 1,
      find = null;
    if (n.m_eventType === 3) {
      shoot = n.m_hitRandomTriggerHit.m_shootId;
      rate = n.m_hitRandomTriggerHit.m_random;
    } else if (n.m_eventType === 4) {
      const r = n.m_selectRandomEnemy;
      shoot = r.m_shootId;
      rate = r.m_randomRate;
      count = Math.max(1, r.m_shootCnt + Math.round(nativeAttr(g, id, 134)));
      find = r.m_searchTargetParam;
    } else continue;
    if (!shoot || api.random(g) >= rate) continue;
    if (n.m_eventType === 3) {
      send(g, kind, id, shoot, e, e, api);
      continue;
    }
    const targets = select(g, e, find, count, e.id, api);
    for (const t of targets) send(g, kind, id, shoot, e, t, api);
  }
  index = 0;
  for (const p of gr.areas) {
    if (!matches(g, repeat(p), signal, e, kind, c, id + ':area:' + index++)) continue;
    addArea(g, kind, id, p, e, e, api);
  }
  index = 0;
  for (const n of gr.buffNodes) {
    if (n.m_objectType === 0) continue;
    if (
      !matches(g, repeat(n), signal, e, kind, c, id + ':buff:' + index++) ||
      api.random(g) > n.m_randomRate
    )
      continue;
    applyNativeTargetBuff(g, e, buffId(n), kind);
  }
}
export function nativeProcHit(g, e, kind, api, c = {}) {
  if (c.noProcs) return;
  const signal = { event: 1, shoot: c.shootId ?? primaryShoot[kind] ?? 2 };
  for (const id of procGraphs(g, kind)) {
    if ((id >= 20043111 && id <= 20043141) || (id >= 20049211 && id <= 20049251)) continue;
    signalGraph(g, kind, id, signal, e, api, c);
    if (e.dead) signalGraph(g, kind, id, { event: 4, shoot: signal.shoot }, e, api, c);
  }
}
export function nativeProcEnd(g, kind, shoot, e, api, c = {}) {
  for (const id of procGraphs(g, kind)) signalGraph(g, kind, id, { event: 3, shoot }, e, api, c);
}
export function nativeProcBulletHit(g, b, e, api) {
  const p = b.nativeProc;
  if (!p) return;
  if (p.shoot) send(g, p.kind, p.sub, p.shoot, e, e, api);
  if (p.kind === 'grenade') {
    const area = G[1012]?.areas[0];
    if (area) addArea(g, p.kind, p.sub, area, e, e, api);
  }
}
export function nativeProcMissile(g, api) {
  for (const id of procGraphs(g, 'airdrop'))
    if (id >= 20043111 && id <= 20043141) {
      const n = G[id].buffNodes[0];
      if (n) selfBuff(g, buffId(n), 'airdrop');
    }
}
export function nativeProcZoneComplete(g, z, targets, api) {
  if (z.skill === 'iceblast' && !z.gemInitialChecked) {
    z.gemInitialChecked = true;
    if ((state(g).casts.iceblast || 0) === 1 && targets.length === 1)
      for (const id of procGraphs(g, 'iceblast'))
        if (id >= 20049211 && id <= 20049251) {
          const n = G[id].buffNodes[0];
          if (n) selfBuff(g, buffId(n), 'iceblast');
        }
  }
  if (z.skill === 'airdrop' && !z.gemFragments) {
    z.gemFragments = true;
    nativeProcEnd(g, 'airdrop', 2, z, api, { sourceId: z.id });
  }
}
function sourceSkill(g, id, t, api) {
  const gr = G[id],
    root = BASE[id];
  if (!gr || !root) return;
  if (id >= 2004051 && id <= 2004054) {
    for (const n of gr.buffNodes) selfBuff(g, buffId(n), 'gun');
    api.effect(g, 'unlimited-fire', 270, 650, { duration: 0.6, r: 95 });
    return;
  }
  const kind = id === 2034601 ? 'laser' : id >= 2002021 && id <= 2002025 ? 'airdrop' : 'vehicle';
  if (kind === 'airdrop') {
    const p = gr.areas.filter((p) => p.radius > 0.2).slice(-1)[0];
    if (p) queue(g, { at: g.time + 0.8, type: 'source-area', id, kind, p, t: { x: t.x, y: t.y } });
  } else if (kind === 'vehicle') {
    const p = gr.bullets[0],
      event = gr.events[0],
      n = Math.max(1, event?.m_selectRandomEnemy?.m_outerLayerCallCnt || 1);
    for (let i = 0; i < n; i++) {
      const target = alive(g)[i % Math.max(1, alive(g).length)] || t;
      queue(g, {
        at: g.time + i * 0.17,
        type: 'source-bullet',
        id,
        kind,
        p,
        t: { x: target.x, y: target.y },
      });
    }
  } else {
    const p = gr.areas[0];
    if (p) addArea(g, kind, id, p, { x: 270, y: 705 }, t, api, id);
  }
}
export function nativeProcCast(g, kind, api) {
  const s = state(g);
  s.casts[kind] = (s.casts[kind] || 0) + 1;
  if (kind === 'airdrop')
    for (const [id, v] of Object.entries(s.self))
      if (v.kind === kind && B[id]?.FuncData.FuncId === 20) delete s.self[id];
  const t = alive(g).sort((a, b) => b.y - a.y)[0];
  if (!t) return;
  for (const b of activeNativeBuffs(g)) {
    const f = b.FuncData,
      p = f.FuncParam;
    if (f.FuncId !== 3 || p[1] !== 3 || p[2] !== ROOT_SKILLS[kind] || p[3] <= 0) continue;
    if (s.casts[kind] % p[3] === 0) sourceSkill(g, p[0], t, api);
  }
  if (kind === 'guided')
    for (const id of procGraphs(g, kind))
      signalGraph(g, kind, id, { event: 1, shoot: 1 }, { x: 270, y: 705, id: 0 }, api, {
        sourceId: s.casts[kind],
      });
  if (Object.keys(s.first).length > 4000) s.first = {};
}
export function nativeProcWallDamage(g, taken, api) {
  if (taken <= 0) return;
  const s = state(g),
    t = alive(g).sort((a, b) => b.y - a.y)[0] || { x: 270, y: 350 };
  for (const b of activeNativeBuffs(g)) {
    const f = b.FuncData,
      p = f.FuncParam;
    if (f.FuncId !== 3 || p[1] !== 2 || p[2] <= 0) continue;
    const loss = (s.wall[b.id] || 0) + Math.min(g.hp, taken) / g.maxHp,
      threshold = p[2] / 10000,
      n = Math.min(32, Math.floor((loss + 1e-9) / threshold));
    s.wall[b.id] = loss - n * threshold;
    for (let i = 0; i < n; i++) sourceSkill(g, p[0], t, api);
  }
}
export function nativeProcTick(g, api) {
  const s = state(g),
    due = s.queue.filter((c) => c.at <= g.time + 1e-7);
  s.queue = s.queue.filter((c) => c.at > g.time + 1e-7);
  for (const c of due) {
    if (c.type === 'chain') {
      const e = alive(g).find((e) => e.id === c.target);
      if (!e) continue;
      api.damage(
        g,
        e,
        amount(g, c.kind, c.sub, c.index, c.ratio),
        c.kind,
        contextFor(c.kind, c.sub, c.index),
      );
      api.effect(g, 'electron', e.x, e.y, { path: [c.from, { x: e.x, y: e.y }], duration: 0.25 });
    } else if (c.type === 'source-area') {
      const p = c.p;
      addArea(g, c.kind, c.id, p, c.t, c.t, api, c.id);
    } else if (c.type === 'source-bullet') {
      const p = c.p;
      if (!p) continue;
      const b = api.fire(
        g,
        270,
        650,
        c.t,
        (g.stats.nativeAttack || g.damage) *
          (BASE[c.id].AttrDamageData[p.damageIndex]?.Param1 || 0),
        {
          speed: p.speed * UNIT,
          pierce: p.through,
          kind: c.kind,
          size: p.radius * UNIT,
          color: '#d2c15a',
        },
      );
      Object.assign(b, {
        life: p.range / (p.speed || 1),
        nativeNoProcs: true,
        nativeProc: {
          kind: c.kind,
          sub: c.id,
          index: p.damageIndex,
          shoot: 0,
          sourceRoot: c.id,
          rule: BASE[c.id].AttrDamageData[p.damageIndex],
        },
        banThroughResistance: nativeAttr(g, c.id, 155) > 0,
        banRedirect: nativeAttr(g, c.id, 154) > 0,
      });
    }
  }
  for (const z of s.zones) {
    if (z.until <= g.time || z.next > g.time) continue;
    z.next += z.interval;
    const target = z.focus ? alive(g).find((e) => e.id === z.target) : null;
    if (z.focus && !target) continue;
    if (target) {
      z.x = target.x;
      z.y = target.y;
    }
    const dx = z.tx - z.x,
      dy = z.ty - z.y,
      len = Math.hypot(dx, dy) || 1;
    const rule = BASE[z.root || ROOT_SKILLS[z.kind]]?.AttrDamageData[z.index],
      fx = z.focus
        ? 'guided'
        : z.beam
          ? 'laser'
          : rule?.MagicType === 3
            ? 'grenade'
            : z.kind === 'drone'
              ? 'drone-explosion'
              : z.kind === 'electron'
                ? 'electron-field'
                : z.kind === 'frost'
                  ? 'iceblast'
                  : z.kind;
    api.effect(g, fx, z.focus ? 270 : z.x, z.focus ? 705 : z.y, {
      tx: z.focus ? z.x : z.tx,
      ty: z.focus ? z.y : z.ty,
      r: z.beam ? z.width : z.r,
      duration: Math.min(0.5, Number.isFinite(z.interval) ? z.interval + 0.05 : 0.5),
    });
    for (const e of alive(g)) {
      if (e.id === z.exclude) continue;
      const inside = z.focus
        ? e.id === z.target
        : z.beam
          ? Math.abs((e.x - z.x) * dy - (e.y - z.y) * dx) / len < e.r + z.width
          : Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r;
      if (!inside) continue;
      api.damage(
        g,
        e,
        amount(g, z.kind, z.sub, z.index, z.ratio, z.root),
        z.kind,
        contextFor(z.kind, z.sub, z.index, {
          damageRule: BASE[z.root || ROOT_SKILLS[z.kind]]?.AttrDamageData[z.index],
        }),
      );
      if (z.shoot) send(g, z.kind, z.sub, z.shoot, e, e, api);
    }
  }
  s.zones = s.zones.filter((z) => z.until > g.time);
  for (const [id, v] of Object.entries(s.self)) if (v.until <= g.time) delete s.self[id];
  g.nativeProcZones = s.zones.length;
}
export function nativeElectrodeCross(g, b) {
  const duration = Math.max(
    g.stats.nativeSkillAttrs?.[14002]?.[182] || 0,
    g.stats.nativeSkillAttrs?.[14101]?.[182] || 0,
  );
  if (!duration || (b.nativeElectrodeAt ?? -Infinity) + 0.5 > g.time) return;
  for (const z of g.extendedZones || []) {
    if (z.skill !== 'electric' || !z.points?.length || z.until <= g.time) continue;
    const dy = b.y - b.py;
    if (!dy) continue;
    const t = (z.y - b.py) / dy,
      x = b.px + (b.x - b.px) * t;
    if (t >= 0 && t <= 1 && x >= z.points[0].x - 8 && x <= z.points.slice(-1)[0].x + 8) {
      b.nativeElectrified = duration;
      b.nativeElectrodeAt = g.time;
      break;
    }
  }
}
export function nativeDroneReflect(g, z) {
  let value = 0,
    cap = 0;
  for (const b of activeNativeBuffs(g)) {
    const p = b.FuncData.FuncParam;
    if (b.FuncData.FuncId === 38 && p[0] === 12000 && p[1] === 167) {
      value += p[2] / 10000;
      cap += p[3] / 10000;
    }
  }
  z.reflectBonus = Math.min(cap, (z.reflectBonus || 0) + value);
}
