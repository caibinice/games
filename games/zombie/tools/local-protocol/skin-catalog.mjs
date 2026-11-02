import { NATIVE_GROWTH } from '../../public/native-growth-data.mjs';
// The pinned APK lists these appearances but omits their UI and engine levels.
// Use a reviewed, same-category/same-skill-family fallback, not invented effects.
// The APK packer reads this JSON-compatible literal; keep its data syntax intact.
// prettier-ignore
export const SKIN_LEVEL_FALLBACKS={"81035":81012,"81037":81008,"81039":81010,"81041":81009,"81042":81013,"82035":82012,"82037":82008,"82039":82010,"82041":82009,"82042":82013};
const source = NATIVE_GROWTH.tables,
  levels = [...source.SkinLevelConfig];
for (const [target, template] of Object.entries(SKIN_LEVEL_FALLBACKS)) {
  if (levels.some((r) => r.SkinID === Number(target)))
    throw Error('Reviewed missing skin now has source levels');
  for (const row of source.SkinLevelConfig.filter((r) => r.SkinID === template)) {
    const copy = structuredClone(row);
    copy.SkinID = Number(target);
    for (const cost of copy.CostItem) if (cost.ItemID === template) cost.ItemID = Number(target);
    levels.push(copy);
  }
}
export const SKIN_CATALOG = { ...source, SkinLevelConfig: levels };
