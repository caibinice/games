import { coreDetails, buildTitle } from './core-details.mjs';
import { SKILLS, skillImage } from './content.mjs';
import {
  GROWTH,
  ensureNative,
  nativeGood,
  nativeGoodName,
  nativeGoodCount,
  coreUpgradeCost,
  equipUpgradeCost,
  nativeGearRow,
  gunSkillCost,
  mercenaryProfile,
  skinProfile,
  mercenaryUpgradeCost,
  skinUpgradeCost,
} from './native-progression.mjs';
import { art } from './operations-ui.mjs';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const btn = (text, attrs) => `<button class="gold-button" ${attrs}>${text}</button>`;
export function costView(p, c) {
  if (!c) return '<p>已达当前配置上限</p>';
  return `<div class="native-cost">${c.gold ? `<span>金币 ${p.gold} / ${c.gold}</span>` : ''}${(
    c.alternatives ||
    c.items ||
    []
  )
    .filter((i) => i.id && i.count)
    .map(
      (i) =>
        `<span class="${nativeGoodCount(p, i.id) < i.count ? 'short' : ''}">${art(nativeGood(i.id)?.IconName)}${esc(nativeGoodName(i.id))} ${nativeGoodCount(p, i.id)} / ${i.count}</span>`,
    )
    .join(c.alternatives ? '<em class="cost-or">或</em>' : '')}</div>`;
}
const attrNames = {
  101: '防线生命',
  103: '攻击',
  104: '暴击率',
  105: '暴击伤害',
  108: '移动速度',
  110: '技能冷却',
  111: '范围',
  114: '持续时间',
  116: '数量',
  117: '穿透',
  119: '弹速',
  127: '伤害增幅',
  128: '受到伤害',
  129: '受到伤害比例',
  202: '雷系伤害',
  203: '火系伤害',
  204: '冰系伤害',
  205: '物理伤害',
  206: '弹道伤害',
  207: '爆炸伤害',
  208: '射线伤害',
  209: '地面伤害',
  214: '能量伤害',
  215: '风系伤害',
  138: '弹匣容量',
  140: '弹匣增幅',
  141: '换弹秒数',
  143: '换弹时间增幅',
  148: '枪械基础伤害系数',
  149: '枪械伤害',
  150: '枪械暴击率',
  151: '枪械暴伤',
  221: '雷系攻击',
  222: '火系攻击',
  227: '枪械攻击',
};
export const attrView = (rows) =>
  `<div class="native-attrs">${(rows || [])
    .filter((r) => r.DataType && r.Value)
    .map(
      (r) =>
        `<span>${attrNames[r.DataType] || '属性 ' + r.DataType}<b>${[101, 103, 116, 117, 128, 138, 220, 221, 222, 223, 224, 225, 226, 227].includes(r.DataType) ? r.Value.toFixed(0) : [141].includes(r.DataType) ? r.Value.toFixed(2) + 's' : (r.Value * 100).toFixed(1) + '%'}</b></span>`,
    )
    .join('')}</div>`;
export function nativeSkillPanel(p, id, name, desc) {
  const level = p.skills[id].level,
    row = coreUpgradeCost(p, id),
    current = coreDetails(id, level),
    next = coreDetails(id, Math.min(46, level + 1));
  return `<h3>${level} / 46级</h3><p>${esc(desc)}</p><div class="core-preview"><h4>局外核心系数 · 不含局内强化</h4>${current.damage.map((r, i) => `<div>${esc(r.label)}<b>${(r.ratio * 100).toFixed(1)}%${level < 46 ? ' → ' + (next.damage[i].ratio * 100).toFixed(1) + '%' : ''}</b></div>`).join('')}<div>基础冷却<b>${current.cooldown.toFixed(2)}s${level < 46 ? ' → ' + next.cooldown.toFixed(2) + 's' : ''}</b></div></div><h4>升级后的收藏属性</h4>${attrView(next.global)}${costView(p, row)}<div class="dialog-actions">${btn('升级', `data-upgrade-skill="${id}"`)}${btn('连升5级', `data-upgrade-skill="${id}" data-upgrade-count="5"`)}${btn('设为出战', `data-support="${id}"`)}${btn('技能前置树', `data-tree-skill="${id}"`)}${btn('领取养成材料', 'data-growth-supply="1"')}</div><h4>原生等级节点</h4><div class="core-milestones">${current.milestones.map((m) => `<article class="${m.level <= level ? 'unlocked' : ''}"><b>Lv.${m.level} · ${esc(m.name)}</b><p>${esc(m.description)}</p><small>${m.level <= level ? '已接入初始构筑' : '达到等级后自动接入'} · Build ${m.id}</small></article>`).join('')}</div><p class="source-label">攻略存在版本差异。本包核心最高46级，等级节点读取APK原表，不用固定每级百分比代替。</p>`;
}

export function nativeGearPanel(p, slot) {
  const g = p.gear[slot],
    row = nativeGearRow(p, slot);
  return `<h3>${esc(row?.nameText || '装备')} · ${g.tier}阶 / 品质${g.rarity + 1}</h3><p>强化 ${g.level}/150 · 前缀 ${g.prefix || 1}</p>${attrView(row?.ImpactData)}${costView(p, equipUpgradeCost(p, slot))}`;
}
export function gunPanel(p, focus = 0) {
  const a = ensureNative(p),
    id = focus || a.gun,
    row = GROWTH.GunBaseConfig.find((r) => r.ID === id),
    c = gunSkillCost(p),
    up = GROWTH.GunUpConfig.find((r) => r.GunID === id && r.Level === (a.guns[id] || 0) + 1);
  return `<div class="growth-focus">${art(row.DisPlayIconName, 'growth-gun')}<h3>${esc(row.nameText)} ${a.guns[id] ? '★'.repeat(a.guns[id]) : '未拥有'}</h3>${attrView(row.ImpactData)}<div class="dialog-actions">${btn(a.gun === id ? '已装备' : '激活 / 装备', `data-growth-gun="${id}"`)}${btn('枪械强化', `data-growth-gun-up="${id}"`)}</div>${costView(p, a.guns[id] ? (up ? { items: [{ id: up.CostItemID, count: up.CostItemCnt }] } : null) : { items: [{ id: row.UnlockCondParam1, count: row.UnlockCondParam2 }] })}</div><h3>枪械加点 ${a.gunSkillLevel} / 270</h3>${c ? `<div class="native-node">${art(c.row.IconName)}<b>${esc(c.row.skillNameText)}</b><p>${esc(c.row.skillDesText)}</p></div>${costView(p, c)}${btn('学习下一节点', 'data-growth-talent="1"')}` : '全部节点已激活'}<div class="growth-catalog">${GROWTH.GunBaseConfig.map((r) => `<button class="${id === r.ID ? 'selected' : ''}" data-growth-gun-view="${r.ID}">${art(r.IconName)}<span>${esc(r.nameText)}</span><small>${a.guns[r.ID] ? '★'.repeat(a.guns[r.ID]) : '未激活'}</small></button>`).join('')}</div>`;
}
export function mercenaryPanel(p, focus = 101) {
  const a = ensureNative(p),
    m = mercenaryProfile(p, focus),
    r = m.row,
    cost = (row) =>
      row
        ? {
            gold: row.CurrencyType === 2 ? row.CurrencyNum : 0,
            items: [{ id: row.CostItem.CostItemID, count: row.CostItem.CostItemCnt }],
          }
        : null;
  return `<div class="growth-focus mercenary-focus">${art(r.Icon, 'mercenary-portrait')}<h3>${esc(r.nameText)}</h3><p>${m.level ? 'Lv.' + m.level + '/100 · ' + esc(m.qualityRow.qualityNameText) + ' ' + m.quality + '/21阶' : '未招募'}</p>${m.level ? `<p>继承先锋攻击 ${(m.qualityRow.ExtendAtk * 100).toFixed(0)}% · 技能 ${m.skills.SkillId.filter(Boolean).join(' / ')}</p>${attrView([...m.levelRow.ImpactData, ...m.qualityRow.ImpactData])}` : ''}<div class="dialog-actions">${btn(a.mercenary === focus ? '已出战' : m.level ? '出战' : '招募', `data-growth-merc="${focus}"`)}${m.level ? btn('升级', `data-growth-merc-up="${focus}"`) + btn('升品', `data-growth-merc-quality="${focus}"`) : ''}</div>${costView(p, m.level ? mercenaryUpgradeCost(p, focus) : cost(r))}${m.level ? '<p>下一品质消耗</p>' + costView(p, mercenaryUpgradeCost(p, focus, true)) : ''}</div><div class="growth-catalog mercenary-catalog">${GROWTH.MercenaryBaseConfig.map((r) => `<button data-growth-merc-view="${r.ID}" class="${r.ID === focus ? 'selected' : ''}">${art(r.Icon)}<span>${esc(r.nameText)}</span><small>${a.mercenaries[r.ID] ? 'Lv.' + a.mercenaries[r.ID].level : '未招募'}</small></button>`).join('')}</div>`;
}
export function skinPanel(p, type = 1, focus = 0, filter = '') {
  const a = ensureNative(p),
    all = GROWTH.SkinBaseConfig.filter((r) => r.SkinType === type),
    rows = all.filter((r) => type !== 2 || filter === '' || r.MagicId === Number(filter));
  if (!rows.length) return '<p>此分类在本包没有配置</p>';
  focus = rows.some((r) => r.SkinID === focus)
    ? focus
    : rows.some((r) => r.SkinID === a.skinSlots[type])
      ? a.skinSlots[type]
      : rows[0].SkinID;
  const s = skinProfile(p, focus),
    r = s.row,
    c = skinUpgradeCost(p, focus),
    current = s.current || s.next,
    skill =
      SKILLS.find(
        (k) => GROWTH.MagicSkillConfig.find((m) => m.nameText === k.name)?.ID === r.MagicId,
      ) ||
      SKILLS.find(
        (k) =>
          ({
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
          })[k.id] === r.MagicId,
      );
  const formInfo =
    type === 2
      ? `<div class="form-loadout"><b>开局技能：${esc(skill?.name || '通用加成')}</b><p>${esc(current?.skillNameText || '')} · ${esc(current?.descText || '本包缺少此项升星表')}</p>${
          current?.RandBuildCount
            ? `<div>每局从下列原生组合中随机获得一组：${current.RandBuild.slice(
                0,
                current.RandBuildCount,
              )
                .map(
                  (pair) =>
                    '<p>' +
                    [pair.Build1, pair.Build2]
                      .filter(Boolean)
                      .map(buildTitle)
                      .map(esc)
                      .join(' + ') +
                    '</p>',
                )
                .join('')}</div>`
            : ''
        }</div>`
      : '';
  if (type === 2) {
    const ordered = [...rows].sort(
        (x, y) => Number(Boolean(a.skins[y.SkinID])) - Number(Boolean(a.skins[x.SkinID])),
      ),
      at = ordered.findIndex((v) => v.SkinID === focus),
      stars = (n) =>
        Array.from(
          { length: 5 },
          (_, i) =>
            `<img src="./assets/native-growth-ui/images/zmzg_com_icon_star${i < n ? 1 : 2}.webp" alt="${i < n ? '★' : '☆'}">`,
        ).join(''),
      equipped = a.skinSlots[2] === focus;
    return `<div class="native-form-view" data-form-focus="${focus}"><div class="native-form-title">${esc(r.skinNameText)}</div><div class="native-form-stars" aria-label="${s.level}星">${stars(s.level)}</div><div class="native-form-attrs">${attrView(current?.ImpactData)}</div><div class="native-form-portrait">${art(r.IconName, 'growth-skin')}<canvas data-native-form="${focus}" aria-label="${esc(r.skinNameText)}动态模型"></canvas></div><button class="native-form-arrow prev" aria-label="上一个幻形" data-growth-skin-view="${ordered[(at - 1 + ordered.length) % ordered.length].SkinID}" data-skin-type="2">‹</button><button class="native-form-arrow next" aria-label="下一个幻形" data-growth-skin-view="${ordered[(at + 1) % ordered.length].SkinID}" data-skin-type="2">›</button><details class="native-form-skill"><summary><b>${s.level ? '已获得以下技能' : '激活后获得以下技能'}</b><img src="${skillImage(skill?.id || 'grenade')}" alt=""><span>${esc(current?.skillNameText || skill?.name || '技能详情')}</span></summary><div>${formInfo}<p>模型、属性、升星材料读取参考 APK；收藏加成与出战加成分别结算。</p><button class="secondary-button" data-growth-supply="1">领取本地养成材料</button></div></details><div class="native-form-actions">${s.level ? btn(equipped ? '卸下' : '装备', `${equipped ? 'data-growth-skin-unset' : 'data-growth-skin'}="${focus}"`) : ''}${btn(s.level ? '升星' : '激活', `data-growth-skin-up="${focus}" ${s.next ? '' : 'disabled'}`)}</div><div class="native-form-cost">${costView(p, s.next ? c : null)}</div><div class="native-form-carousel" aria-label="幻形列表">${ordered.map((v) => `<button class="${focus === v.SkinID ? 'selected' : ''} ${a.skins[v.SkinID] ? 'owned' : 'locked'}" data-growth-skin-view="${v.SkinID}" data-skin-type="2" aria-label="${esc(v.skinNameText)}"><span class="form-card-art">${art(v.IconName)}</span>${a.skinSlots[2] === v.SkinID ? '<i class="form-equipped">✓</i>' : ''}${!a.skins[v.SkinID] ? '<img class="form-lock" src="./assets/native-growth-ui/images/com_lock.webp" alt="未激活">' : ''}<small>${stars(a.skins[v.SkinID] || 0)}</small></button>`).join('')}</div><nav class="native-form-footer" aria-label="核心外观"><button class="form-back" data-action="close" aria-label="返回核心">↶</button><button class="selected" aria-current="page"><i>◈</i>幻形</button><button disabled title="炫彩幻形页面待迁移"><i>✧</i>炫彩幻形</button><button disabled title="幻技页面待迁移"><i>✺</i>幻技</button></nav></div>`;
  }
  return `${type === 2 ? `<p class="dialog-sub">已激活 ${all.filter((r) => a.skins[r.SkinID]).length}/${all.length} · 收藏属性叠加，出战词条仅由当前装备项提供</p><div class="form-filters">${[['', '全部'], ...GROWTH.MagicSkillConfig.map((r) => [r.ID, r.nameText]), ['0', '通用']].map(([id, name]) => `<button data-form-filter="${id}" class="${filter === String(id) ? 'selected' : ''}">${esc(name)}</button>`).join('')}</div>` : ''}<div class="growth-focus">${art(r.IconName, 'growth-skin')}<h3>${esc(r.skinNameText)} ${s.level ? 'Lv.' + s.level : '未激活'}</h3>${formInfo}<h4>${s.level ? '当前收藏属性' : '激活后收藏属性'}</h4>${attrView(current?.ImpactData)}${type !== 2 ? '<p>' + esc(current?.descText || '') + '</p>' : ''}${costView(p, s.next ? c : null)}<div class="dialog-actions">${btn(s.level ? '升星' : '激活', `data-growth-skin-up="${focus}" ${s.next ? '' : 'disabled'}`)}${btn(a.skinSlots[type] === focus ? '已装备' : '装备', `data-growth-skin="${focus}" ${s.level ? '' : 'disabled'}`)}${btn('免费补齐材料', 'data-growth-supply="1"')}</div></div><div class="growth-catalog">${rows.map((r) => `<button class="${focus === r.SkinID ? 'selected' : ''}" data-growth-skin-view="${r.SkinID}" data-skin-type="${type}">${art(r.IconName)}<span>${esc(r.skinNameText)}</span><small>${a.skins[r.SkinID] ? 'Lv.' + a.skins[r.SkinID] : GROWTH.SkinLevelConfig.some((l) => l.SkinID === r.SkinID && l.SkinLevel === 1) ? '未激活' : '缺升星配置'}</small></button>`).join('')}</div><p class="source-label">属性、初始技能与随机词条来自 APK。复杂专属机关仍逐项迁移；不虚构缺失的升星数值。</p>`;
}
