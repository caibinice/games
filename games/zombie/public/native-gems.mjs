import { GEM_COMPAT } from './gem-compat.mjs';
import {
  nativeBuffSupported,
  nativeProcBuildSupported,
  gemDisplayCalibration,
} from './native-buff-rules.mjs';
import { CLIENT_GEMS, CLIENT_GEM_COMPOSE } from './client-gem-data.mjs';
import {
  CLIENT_ATTR_LIBRARIES as LIB,
  CLIENT_NATIVE_BUFFS as BUFF,
} from './native-skill-extra.mjs';
import { CLIENT_BUILD_CATALOG as BUILDS } from './client-skill-data.mjs';
export const NATIVE_GEMS = Object.fromEntries(CLIENT_GEMS.map((g) => [g.id, g]));
const parts = { 1: 'helmet', 2: 'armor', 3: 'boots', 4: 'bracer', 5: 'pants', 6: 'gloves' };
// These effects have a real combat implementation. Do not drop inactive complex
// Buff/Build gems into the playable pool just because their descriptions exist.
const attrTypes = new Set([
  101, 103, 104, 105, 109, 110, 111, 112, 113, 114, 116, 117, 119, 122, 124, 127, 128, 129, 132,
  134, 135, 154, 155, 166, 168, 182, 202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 401, 402,
  403, 404, 405, 406, 408, 409, 410, 411, 412, 414, 415, 418,
]);
const supportedBuff = nativeBuffSupported;
export function nativeGemPlayable(g) {
  const r = g?.rule;
  if (!r) return false;
  if (GEM_COMPAT[g.id]) return true;
  if (r.BuildID && !BUILDS[r.BuildID] && !nativeProcBuildSupported(r.BuildID)) return false;
  if (r.BuffID && !supportedBuff(r.BuffID)) return false;
  if (
    r.AttrLibraryID &&
    (!LIB[r.AttrLibraryID]?.length ||
      LIB[r.AttrLibraryID].some((a) => a.values.some((v) => !attrTypes.has(v.DataType))))
  )
    return false;
  return (
    (!r.Attr.DataType || attrTypes.has(r.Attr.DataType)) &&
    !!(r.Attr.DataType || r.AttrLibraryID || r.BuildID || r.BuffID)
  );
}
export const PLAYABLE_GEMS = CLIENT_GEMS.filter(nativeGemPlayable);
export const nativeGemDebug = (g) => g.id >= 999990000 || [900380309, 900380319].includes(g.id);
export const DROP_GEMS = PLAYABLE_GEMS.filter((g) => !nativeGemDebug(g));
export function nativeGemInfo(id) {
  const match = /^gem-native:(\d+)$/.exec(String(id)),
    g = match && NATIVE_GEMS[match[1]];
  return g
    ? {
        id: String(id),
        type: 'gem',
        nativeId: g.id,
        slot: parts[g.part],
        affix: 'native',
        rarity: g.quality - 1,
        native: g,
      }
    : null;
}
export function gemDescription(i) {
  return i.native?.description || '';
}
export function nativeGemNext(i) {
  if (!i?.native) return null;
  const g = CLIENT_GEMS.find(
    (g) =>
      g.type === i.native.type &&
      g.part === i.native.part &&
      g.quality === i.native.quality + 1 &&
      nativeGemPlayable(g),
  );
  return g ? 'gem-native:' + g.id : null;
}
export function nativeComposeCount(i) {
  return CLIENT_GEM_COMPOSE.find((r) => r.Quality === i.native?.quality + 1)?.NeedNum || 0;
}
export function collectNativeGemAttrs(p) {
  const attrs = {},
    skillAttrs = {},
    buffs = [],
    builds = [],
    seen = {};
  let fight = 0,
    count = 0;
  for (const gear of Object.values(p.gear))
    for (const id of gear.gems) {
      const i = nativeGemInfo(id);
      if (!i || !nativeGemPlayable(i.native)) continue;
      const n = seen[i.nativeId] || 0;
      if (n >= i.native.maxStack) continue;
      seen[i.nativeId] = n + 1;
      const r = i.native.rule,
        a = r.Attr,
        compat = GEM_COMPAT[i.nativeId];
      if (a.DataType) attrs[a.DataType] = (attrs[a.DataType] || 0) + a.Value;
      for (const row of LIB[r.AttrLibraryID] || [])
        for (const skill of row.skills) {
          if (skill === -1) {
            for (const v of row.values) attrs[v.DataType] = (attrs[v.DataType] || 0) + v.Value;
          } else {
            skillAttrs[skill] ??= {};
            for (const v of row.values)
              skillAttrs[skill][v.DataType] = (skillAttrs[skill][v.DataType] || 0) + v.Value;
          }
        }
      for (const [skill, values] of Object.entries(compat?.attrs || {})) {
        skillAttrs[skill] ??= {};
        for (const [type, value] of Object.entries(values))
          skillAttrs[skill][type] = (skillAttrs[skill][type] || 0) + value;
      }
      if (r.BuffID)
        buffs.push({
          id: r.BuffID,
          ...BUFF[r.BuffID],
          ...compat?.buff,
          display: gemDisplayCalibration(i.native),
        });
      if (r.BuildID) builds.push(r.BuildID);
      fight += i.native.fight;
      count++;
    }
  return { attrs, skillAttrs, buffs, builds, fight, count };
}
