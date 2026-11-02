import {
  CLIENT_NATIVE_BASES as BASE,
  CLIENT_NATIVE_GRAPHS as GRAPH,
} from './native-skill-extra.mjs';
import { nativeAttr } from './client-builds.mjs';
import { applyNativeTargetBuff } from './native-buff-runtime.mjs';
const UNIT = 72,
  live = (g) => g.enemies.filter((e) => !e.dead),
  subs = (g) =>
    Object.entries(g.nativeSubSkills || {})
      .filter(([, s]) => s === 'gun')
      .map(([id]) => Number(id));
const color = (magic) =>
  magic === 3 ? '#ff7534' : magic === 2 ? '#b593ff' : magic === 4 ? '#95edff' : '#ffdb87';
const amount = (g, sub, index, ratio = 1) =>
  g.damage *
  g.stats.gunProfile.damageRatio *
  (BASE[g.stats.nativeGun.SkillID]?.AttrDamageData[index]?.Param1 ?? 0) *
  ratio *
  Math.max(0.05, 1 + nativeAttr(g, sub, 127));
function spawn(g, task, api) {
  const { sub, p, origin, target, angle, parallel, child } = task,
    dx = target.x - origin.x,
    dy = target.y - origin.y,
    len = Math.hypot(dx, dy) || 1,
    off = parallel * (p.data?.m_parallelBulletDist || 0.25) * UNIT,
    x = origin.x - (dy / len) * off,
    y = origin.y + (dx / len) * off,
    rad = (angle * Math.PI) / 180,
    rule = BASE[g.stats.nativeGun.SkillID]?.AttrDamageData[p.damageIndex],
    element = rule?.MagicType || 6;
  const bullet = api.fire(
    g,
    x,
    y,
    {
      x: x + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: y + dx * Math.sin(rad) + dy * Math.cos(rad),
    },
    amount(g, sub, p.damageIndex, p.damageRatio || 1),
    {
      speed: Math.max(80, p.speed * UNIT) * (1 + nativeAttr(g, sub, 119)),
      pierce: Math.max(0, p.through + Math.round(nativeAttr(g, sub, 117))),
      kind: 'gun',
      color: color(element),
      size: Math.max(2, p.radius * UNIT),
      nativeScaled: true,
    },
  );
  Object.assign(bullet, {
    nativeGun: true,
    nativeSupport: true,
    nativeChild: child,
    nativeSub: sub,
    nativeProfile: p,
    nativeDamageRule: rule,
    nativeElement: element,
    nativeFx: p.effect.m_prefabPath,
    damageIndex: p.damageIndex,
    life: Math.min(6, p.range / Math.max(0.01, p.speed)),
    nativeBornAt: g.time,
  });
  if (!child && g.nativeLastRoundAt !== task.at) {
    g.nativeLastRoundAt = task.at;
    g.events.push({ type: 'shot' });
  }
}
function emit(g, sub, p, target, api, { origin = { x: 270, y: 705 }, child = false } = {}) {
  const count = Math.min(16, Math.max(1, p.count + Math.round(nativeAttr(g, sub, 116)))),
    parallel = Math.min(8, Math.max(1, p.parallelCount || 1)),
    sequence = Math.min(16, Math.max(1, p.sequenceCount + Math.round(nativeAttr(g, sub, 115)))),
    interval = Math.max(0.01, p.interval),
    fixed = p.group?.m_fixedDir;
  const angles =
    Array.isArray(fixed) && fixed.length && fixed.every(Number.isFinite)
      ? fixed
      : Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * (p.angle || 5));
  g.nativeGunQueue ??= [];
  for (let seq = 0; seq < sequence; seq++)
    for (const angle of angles)
      for (let i = 0; i < parallel; i++) {
        const task = {
          at: g.time + (p.delay || 0) + seq * interval,
          sub,
          p,
          origin: { ...origin },
          target: { x: target.x, y: target.y },
          angle,
          parallel: i - (parallel - 1) / 2,
          child,
        };
        if (task.at <= g.time) spawn(g, task, api);
        else if (g.nativeGunQueue.length < 512) g.nativeGunQueue.push(task);
      }
}
export function fireGun(g, target, api) {
  for (const sub of subs(g))
    for (const p of GRAPH[sub]?.bullets || [])
      if (p.repeat.m_shootId === 1) emit(g, sub, p, target, api);
}
export function tickGun(g, api) {
  const queue = g.nativeGunQueue || [];
  g.nativeGunQueue = [];
  for (const task of queue)
    if (task.at <= g.time + 1e-8) spawn(g, task, api);
    else g.nativeGunQueue.push(task);
}
export function hitGun(g, b, e, api) {
  if (!b.nativeGun) return;
  const shoot = b.nativeProfile?.hit?.raw?.m_shootId || 2;
  for (const n of GRAPH[b.nativeSub]?.buffNodes || [])
    if (n.m_triggleRepeat?.m_shootId === shoot && api.random(g) <= (n.m_randomRate ?? 1))
      applyNativeTargetBuff(g, e, n.m_buffId || n.m_buffID, 'gun');
  for (const sub of subs(g)) {
    const graph = GRAPH[sub];
    if (!graph) continue;
    for (const area of graph.areas)
      if (area.repeat.m_shootId === shoot) {
        const radius = Math.max(1, area.radius * UNIT * (1 + nativeAttr(g, sub, 111))),
          rule = BASE[g.stats.nativeGun.SkillID]?.AttrDamageData[area.damageIndex];
        api.effect(g, 'gun-impact', e.x, e.y, {
          r: radius,
          element: rule?.MagicType,
          duration: 0.35,
        });
        for (const target of live(g))
          if (Math.hypot(target.x - e.x, target.y - e.y) <= radius + target.r)
            api.damage(g, target, amount(g, sub, area.damageIndex, area.damageRatio || 1), 'gun', {
              sourceSub: sub,
              damageIndex: area.damageIndex,
              damageRule: rule,
              shootId: area.hit?.raw?.m_shootId,
            });
      }
    for (const event of graph.events) {
      const select = event.m_selectRandomEnemy;
      if (event.m_triggleRepeat?.m_shootId !== shoot || !select?.m_shootId) continue;
      const targets = live(g)
        .filter((t) => t.id !== e.id)
        .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
        .slice(0, Math.min(16, select.m_shootCnt || 1));
      for (const p of graph.bullets)
        if (p.repeat.m_shootId === select.m_shootId)
          for (const t of targets)
            emit(g, sub, p, t, api, { origin: { x: e.x, y: e.y }, child: true });
    }
  }
}
