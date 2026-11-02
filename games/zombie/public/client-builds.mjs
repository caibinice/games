import { ROOT_SKILLS } from './native-buff-rules.mjs';
import { CLIENT_BUILD_CATALOG as CORE, CLIENT_SKILL_RULES as S } from './client-skill-data.mjs';
import {
  CLIENT_NATIVE_BUILDS as B,
  CLIENT_NATIVE_GROUPS as GROUPS,
  CLIENT_NATIVE_BUFFS as BUFF,
} from './native-skill-extra.mjs';

export const BRANCH_FAMILIES = Object.keys(S);
const RAW = (id) => {
  const b = B[id];
  return b
    ? {
        id: b.BuildID,
        skill: b.GunAdd ? 'gun' : Object.keys(S).find((k) => S[k].id === b.SkillID),
        name: b.name,
        description: b.description,
        limit: 1,
        add: b.AddSubSkillID.filter(Boolean),
        remove: b.RmvSubSkillID.filter(Boolean),
        buffs: [b.BuffID1, b.BuffID2].filter(Boolean),
        attrs: null,
        main: !!b.MainSkillBuild,
      }
    : null;
};
const gunRows = GROUPS.filter((r) => r.GroupID === 1101 && B[r.BuildID]?.GunAdd);
const C = {
  ...CORE,
  ...Object.fromEntries(
    gunRows.map((r) => [
      r.BuildID,
      {
        ...RAW(r.BuildID),
        requires: r.DependCondition.filter((v) => v.Type),
        conflicts: r.ConflictCondition.filter((v) => v.Type),
        weight: r.Weight,
        limit: r.MaxSelectCount,
        gunGroup: 1101,
      },
    ]),
  ),
};
export const NATIVE_BUILD_CATALOG = C;
const info = (id) => C[id] || RAW(id);

export function initClientBuilds(g) {
  g.nativeBuilds = {};
  g.nativeCasts = [];
  g.nativeZones = [];
  g.nativeDots = [];
  g.nativeSubSkills = {};
  for (const skill of BRANCH_FAMILIES) if (g.weapons[skill]) g.nativeBuilds[S[skill].baseBuild] = 1;
  if (g.stats.nativeGun?.BuildID) g.nativeBuilds[g.stats.nativeGun.BuildID] = 1;
  const queue = [...(g.stats.nativeGemBuilds || []), ...(g.stats.nativeSkinBuilds || [])];
  if (g.stats.nativeFormStart) {
    const f = g.stats.nativeFormStart,
      skill = f.skill;
    if (S[skill] && g.availableWeapons.some((w) => w.id === skill)) {
      g.weapons[skill] = Math.max(1, g.weapons[skill]);
      queue.push(S[skill].baseBuild);
    }
    if (f.randomBuilds?.length) {
      g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
      queue.push(...f.randomBuilds[Math.floor((g.seed / 4294967296) * f.randomBuilds.length)]);
    }
  }
  for (const b of g.stats.nativeGemBuffs || [])
    if (b.FuncData.FuncId === 2) queue.push(b.FuncData.FuncParam[0]);
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const b = info(id),
      raw = B[id];
    if (
      !b ||
      !raw ||
      ((b.main || b.add.length) && b.skill && !g.availableWeapons.some((w) => w.id === b.skill))
    )
      continue;
    g.nativeBuilds[id] = Math.min(b.limit, (g.nativeBuilds[id] || 0) + 1);
    if (b.main && S[b.skill]) {
      g.weapons[b.skill] = Math.max(1, g.weapons[b.skill]);
      g.nativeBuilds[S[b.skill].baseBuild] = 1;
    }
    for (const bid of b.buffs) {
      const f = BUFF[bid]?.FuncData;
      if (f?.FuncId === 2) queue.push(f.FuncParam[0]);
    }
  }
  rebuildSubSkills(g);
}

export function rebuildSubSkills(g) {
  const active = {},
    selected = Object.entries(g.nativeBuilds || {})
      .filter(([, n]) => n)
      .map(([id]) => info(id))
      .filter(Boolean);
  for (const b of selected) for (const sub of b.add) active[sub] = b.skill;
  for (const b of selected) for (const sub of b.remove) delete active[sub];
  g.nativeSubSkills = active;
  g.nativeBuildBuffs = selected.flatMap((b) => b.buffs);
  g.nativeBuffRevision = (g.nativeBuffRevision || 0) + 1;
  return active;
}
export function buildCount(g, id) {
  return g.nativeBuilds?.[id] || 0;
}
export function buildCondition(g, c) {
  if (c.Type === 2) return buildCount(g, c.Param1) >= c.Param2;
  if (c.Type === 1) return (g.stats.nativeGemBuffs || []).some((b) => b.id === c.Param1);
  if (c.Type === 3) return (g.stats.nativeGunSkillLevel || 0) >= c.Param1;
  if (c.Type === 7) return (g.stats.nativeGunLevel || 1) >= c.Param2;
  if (c.Type === 4) {
    const skill = Object.keys(S).find((k) => S[k].id === c.Param1);
    return (g.nativeAllAffixes ? 100 : g.coreLevels[skill] || 1) >= c.Param2;
  }
  // The reference ARM64 CheckCondition switch handles types 1..10 only.
  // 0 / 11 / 12 fall through to true, as in that client; do not invent OR rules.
  if ([0, 11, 12].includes(c.Type)) return true;
  return false;
}
export function buildEligible(g, b) {
  return (
    !!g.nativeBuilds &&
    (BRANCH_FAMILIES.includes(b.skill) ||
      (b.skill === 'gun' && g.stats.nativeGun?.WeaponType === 1)) &&
    g.availableWeapons.some((w) => w.id === b.skill) &&
    buildCount(g, b.id) < b.limit &&
    b.requires.every((c) => buildCondition(g, c)) &&
    !b.conflicts.some((c) => buildCondition(g, c))
  );
}
export function nativeBuildOptions(g) {
  return Object.values(C)
    .filter((b) => buildEligible(g, b))
    .map((b) => ({
      id: 'build:' + b.id,
      nativeBuildId: b.id,
      skill: b.skill,
      name: b.name,
      desc: b.description,
      icon: b.skill === 'gun' ? 'grenade' : b.skill,
      color: S[b.skill]?.color || '#92e8fb',
      kind: b.main ? '解锁技能' : b.add.length ? '质变分支' : '技能强化',
      level: buildCount(g, b.id) + 1,
      limit: b.limit,
      weight: b.weight,
    }));
}
export function applyNativeBuild(g, id) {
  const b = C[id];
  if (!b || !buildEligible(g, b)) return false;
  g.nativeBuilds[id] = buildCount(g, id) + 1;
  g.weapons[b.skill] =
    1 +
    Object.entries(g.nativeBuilds)
      .filter(([key]) => C[key]?.skill === b.skill && !C[key].main)
      .reduce((n, [, v]) => n + v, 0);
  rebuildSubSkills(g);
  return true;
}
const GLOBAL_TYPES = new Set([111, 112, 113, 114, 116, 117, 119, 122, 124, 134, 135]);
export function nativeAttr(g, skillId, type) {
  let total = GLOBAL_TYPES.has(type)
    ? (g.stats.nativeGemAttrs?.[type] || 0) + (g.stats.nativeRaw?.[type] || 0)
    : 0;
  for (const [key, count] of Object.entries(g.nativeBuilds || {}))
    for (const a of B[key]?.attrs || [C[key]?.attrs]) {
      if (a?.skills.includes(skillId))
        for (const v of a.values) if (v.DataType === type) total += v.Value * count;
    }
  total += g.stats.nativeSkillAttrs?.[skillId]?.[type] || 0;
  return total;
}
export function nativeCooldown(g, skill) {
  const rule = S[skill];
  if (!rule) return null;
  return Math.max(
    rule.minCooldown,
    rule.cooldown * (1 + nativeAttr(g, rule.id, 110)) * (1 - (g.stats.cooldown || 0)),
  );
}
export function branchModifiers(g, skill, sub) {
  const root = S[skill].id,
    attr = (type) =>
      nativeAttr(g, sub, type) +
      (sub === root
        ? 0
        : nativeAttr(g, root, type) -
          (GLOBAL_TYPES.has(type)
            ? (g.stats.nativeGemAttrs?.[type] || 0) + (g.stats.nativeRaw?.[type] || 0)
            : 0));
  return {
    damage: Math.max(0.05, 1 + attr(127)),
    range: Math.max(0.1, 1 + attr(111)),
    speed: Math.max(0.1, 1 + attr(119)),
    through: Math.round(attr(117)),
    count: Math.round(attr(116)),
    duration: attr(114),
    hits: Math.round(attr(112)),
    interval: attr(113),
    knockback: attr(122),
    casts: Math.max(0, Math.round(attr(134))),
    chains: Math.max(0, Math.round(attr(123))),
  };
}
