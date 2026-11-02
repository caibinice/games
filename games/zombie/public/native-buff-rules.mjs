import { PROC_BUILD_IDS } from './proc-graph-rules.mjs';
import {
  CLIENT_NATIVE_BUFFS as BUFF,
  CLIENT_NATIVE_BUILDS as BUILD,
  CLIENT_NATIVE_GRAPHS as GRAPH,
  CLIENT_NATIVE_BASES as BASE,
} from './native-skill-extra.mjs';
import { CLIENT_BUILD_CATALOG as CORE } from './client-skill-data.mjs';
export const ROOT_SKILLS = {
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
export function expandNativeBuffs(rows) {
  const out = [];
  function add(row, path) {
    const b = typeof row === 'number' ? BUFF[row] : row;
    if (!b) return;
    const id = b.id || b.BuffID;
    if (path.has(id)) return;
    const next = new Set(path);
    next.add(id);
    if (b.FuncData?.FuncId === 67) {
      for (const id of b.FuncData.FuncParam.filter(Boolean)) add(id, next);
    } else out.push({ id, ...b });
  }
  for (const row of rows || []) add(row, new Set());
  return out;
}
const simpleTarget = (b) =>
  !!b &&
  b.FuncData.FuncId === 0 &&
  b.DurTime > 0 &&
  [0, 1, 2, 3, 4, 17, 21, 22, 29, 41].includes(b.State.StateID) &&
  (!b.DotDamageData.AttrType || [1, 3, 20, 23].includes(b.DotDamageData.AttrType));
export function nativeProcBuildSupported(id) {
  const b = BUILD[id];
  if (!b) return false;
  if (CORE[id] || PROC_BUILD_IDS.has(id)) return true;
  const subs = b.AddSubSkillID.filter(Boolean);
  return (
    subs.length > 0 &&
    subs.every((id) => {
      const g = GRAPH[id];
      return (
        !!g &&
        !g.events.length &&
        !g.bullets.length &&
        !g.chains.length &&
        !g.focus.length &&
        ((g.areas.length > 0 &&
          b.SkillID === 1000 &&
          g.areas.every((p) => p.duration > 0 && [2, 92].includes(p.repeat.m_shootId))) ||
          (g.buffNodes.length > 0 &&
            g.buffNodes.every((n) =>
              simpleTarget(BUFF[n.m_buffID || n.m_buffId || n.m_buffData?.m_buffID]),
            )))
      );
    })
  );
}
export function nativeBuffSupported(id, seen = new Set()) {
  if (seen.has(id)) return false;
  const b = BUFF[id];
  if (!b) return false;
  const f = b.FuncData.FuncId,
    p = b.FuncData.FuncParam;
  seen = new Set(seen);
  seen.add(id);
  if ([4, 8, 9, 10, 33, 34].includes(f)) return true;
  if (f === 0) return b.State.StateID === 32;
  if (f === 2) return nativeProcBuildSupported(p[0]);
  if (f === 3)
    return (
      !!BASE[p[0]] &&
      !!GRAPH[p[0]] &&
      ((p[1] === 1 && p[4] === 2) || (p[1] === 2 && p[2] > 0) || (p[1] === 3 && p[3] > 0))
    );
  if (f === 5) return !!BUFF[p[0]];
  if (f === 6) return BUFF[p[1]]?.FuncData.FuncId === 16;
  if (f === 7) return p[0] === 10000 && p[3] === 29;
  if (f === 11) return simpleTarget(BUFF[p[3]]);
  if (f === 23) return [0, 3].includes(p[2]) && !!BUFF[p[0]];
  if (f === 24)
    return (p[1] === 0 && BUFF[p[2]]?.FuncData.FuncId === 32) || simpleTarget(BUFF[p[2]]);
  if (f === 25) return [3000, 5000, 12000].includes(p[0]);
  if (f === 38) return p[1] === 404 || (p[0] === 12000 && p[1] === 167);
  if (f === 67)
    return (
      p.filter(Boolean).length > 0 && p.filter(Boolean).every((id) => nativeBuffSupported(id, seen))
    );
  return false;
}
export function gemDisplayCalibration(g) {
  const b = BUFF[g.rule.BuffID];
  if (![33, 34].includes(b?.FuncData.FuncId)) return undefined;
  const ratio = g.description.match(/最大生命值([\d.]+)%/),
    cap = g.description.match(/攻击力的([\d.]+)%/);
  return ratio && cap
    ? {
        ratio: Number(ratio[1]) / 100,
        cap: Number(cap[1]) / 100,
        source: 'APK TextConfig',
        rawRatio: b.FuncData.FuncParam[0] / 1e6,
      }
    : undefined;
}
