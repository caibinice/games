import { NATIVE_GROWTH as DATA } from './native-growth-data.mjs';
import {
  CLIENT_SKILL_RULES as RULES,
  CLIENT_BUILD_CATALOG as BUILDS,
} from './client-skill-data.mjs';
import { CLIENT_NATIVE_BUILDS as RAW_BUILDS } from './native-skill-extra.mjs';
import { GROWTH, SKILL_IDS } from './native-progression.mjs';
function values(skill, level) {
  const out = {};
  for (const r of GROWTH.MagicSkillLevelConfig)
    if (r.ID === SKILL_IDS[skill] && r.Level <= level)
      for (const lib of DATA.libraries[r.AttrLibraryID] || [])
        for (const id of lib.skills) {
          out[id] ??= {};
          for (const v of lib.values) out[id][v.DataType] = (out[id][v.DataType] || 0) + v.Value;
        }
  return out;
}
export function coreDetails(skill, level) {
  const rule = RULES[skill],
    id = SKILL_IDS[skill],
    row = GROWTH.MagicSkillLevelConfig.find((r) => r.ID === id && r.Level === level),
    attrs = values(skill, level);
  if (!row || !rule) return null;
  const a = (id, type) => attrs[id]?.[type] || 0;
  const damage = rule.damage.slice(0, 2).map((d, index) => {
    const desc = row.AttrList.find((r) => r.Type === 127 && r.DamageIndex === index);
    return {
      index,
      label:
        DATA.texts[desc?.Name] ||
        { 1: '弹道伤害', 2: '爆炸伤害', 3: '射线伤害', 4: '地面伤害' }[d.DamageType] ||
        '伤害段' + (index + 1),
      ratio: d.Param1 * (1 + a(id, 127) + a(desc?.SubSkillID, 127)),
    };
  });
  return {
    level,
    damage,
    cooldown: Math.max(rule.minCooldown, rule.cooldown * (1 + a(id, 110))),
    global: row.GlobalAttrList,
    build: row.BuildID,
    milestones: GROWTH.MagicSkillLevelConfig.filter((r) => r.ID === id && r.BuildID).map((r) => ({
      level: r.Level,
      id: r.BuildID,
      name:
        (BUILDS[r.BuildID]?.name || RAW_BUILDS[r.BuildID]?.name || '').replace(/^[-—]+$/, '') ||
        '专属词条 #' + r.BuildID,
      description: BUILDS[r.BuildID]?.description || RAW_BUILDS[r.BuildID]?.description || '',
    })),
  };
}
export const buildTitle = (id) => BUILDS[id]?.name || RAW_BUILDS[id]?.name || String(id);
