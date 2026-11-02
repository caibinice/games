import { NATIVE_ART } from './native-art-data.mjs';
import { GROWTH, ensureNative, nativeGood, nativeGoodName } from './native-progression.mjs';
import { operationEntrances } from './operations-ui.mjs';
import {
  SKILLS,
  GEAR_SLOTS,
  RARITIES,
  AFFIXES,
  UI_ASSET,
  skillImage,
  shortNumber,
} from './content.mjs';
import { combatStats, itemInfo } from './progression.mjs';
import { clientStage } from './client-campaign.mjs';
import { clientMap } from './client-maps.mjs';
import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const nativePictures = {
  'resource-diamond.png': 'zmzg_icon_dj_zuangshi',
  'resource-gold.png': 'zmzg_icon_dj_qian',
  'resource-meat.png': 'zmzg_icon_dj_tili',
  'shop-tactical-banner.webp': 'zmzg_zjm_icon_xianfengbaozang',
  'shop-chest-banner.webp': 'icon_daoju_baoxiang_5',
  'equipment-0.png': 'show_zhuangbei_toukui',
  'equipment-1.png': 'show_zhuangbei_hubi',
  'equipment-2.png': 'show_zhuangbei_yifu',
  'equipment-3.png': 'show_zhuangbei_kuzi',
  'equipment-4.png': 'show_zhuangbei_zuju',
  'equipment-5.png': 'show_zhuangbei_shoutao',
};
export const img = (name, cls = '', alt = '') =>
  `<img class="${cls}" src="${nativePictures[name] ? './assets/native-ui/' + nativePictures[name] + '.webp' : UI_ASSET + name}" alt="${esc(alt)}" draggable="false">`;
export const skillIcon = (id, cls = '') =>
  `<img class="${cls}" src="${skillImage(id)}" alt="" draggable="false">`;
const NAV = [
  ['shop', '商城', 'sd'],
  ['character', '角色', 'zb'],
  ['battle', '战斗', 'zd'],
  ['core', '核心', 'hx'],
  ['base', '基地', 'bl'],
  ['guild', '军团', 'jt'],
];
export function navigation(active) {
  return `<nav class="bottom-nav native-nav" aria-label="底部菜单">${NAV.map(([id, name, icon]) => `<button data-tab="${id}" class="nav-item ${active === id ? 'active' : ''}" aria-label="${name}" aria-pressed="${active === id}"><img class="nav-picture" src="./assets/native-ui/zmzg_zjm_button_ico_${icon}${active === id && id !== 'guild' ? '2' : ''}.webp" alt="" draggable="false"><b>${name}</b></button>`).join('')}</nav>`;
}
export function header(p, shop = false) {
  return `${!shop ? '<button class="profile-hit hit" data-action="profile" aria-label="指挥官资料"><img src="./assets/native-ui/zmzg_zjm_button_ico_zb.webp" alt=""></button>' : ''}<div class="resource-bar ${shop ? 'shop-resources' : ''}">${shop ? `<button data-supply="diamonds">${img('resource-diamond.png')}<b>${p.cheats?.diamonds ? '∞' : p.diamonds}</b><i>＋</i></button><button data-action="free-keys"><span class="key purple">⚿</span><b>∞</b></button><button data-action="free-keys"><span class="key blue">⚿</span><b>∞</b></button><button data-action="free-keys"><span class="pack-ticket">▰</span><b>∞</b></button>` : `<button data-supply="diamonds">${img('resource-diamond.png')}<b>${p.cheats?.diamonds ? '∞' : p.diamonds}</b></button><button data-supply="gold">${img('resource-gold.png')}<b>${p.cheats?.gold ? '∞' : shortNumber(p.gold)}</b></button><button data-supply="energy">${img('resource-meat.png')}<b>${p.cheats?.energy ? '∞' : p.energy + '/30'}</b></button>`}</div>${!shop ? `<button class="profile-name hit" data-action="profile">${esc(p.name)}</button>` : ''}<div class="mini-capsule"><button data-action="menu" aria-label="菜单"></button><button data-action="fullscreen" aria-label="切换全屏"></button></div>`;
}
export function marquee(p) {
  const history = Array.isArray(p.history) ? p.history : [];
  return `<div class="marquee"><span>${esc(history[history.length - 1] || '免费畅玩版 · 商城无限抽取，所有奖励真实入库！')}</span></div>`;
}
export function shopScreen(p, state) {
  const tabs = ['资源', '充值', '每日特惠', '特惠礼包'];
  return `<section class="screen shop-screen" aria-label="商城页面"><div class="shop-header-art"></div>${header(p, true)}<div class="shop-title">资源</div>${marquee(p)}<div class="screen-scroll shop-scroll">${state.shopTab === 0 ? shopResources(p) : shopSupply(p, state.shopTab)}</div><div class="sub-tabs shop-subtabs">${tabs.map((s, i) => `<button data-shop-tab="${i}" class="${state.shopTab === i ? 'selected' : ''}">${s}${i === 1 ? '<small>免费</small>' : ''}</button>`).join('')}</div></section>`;
}
function shopResources(p) {
  return `<div class="paper-panel"><h2 class="ribbon">基础战术卡包</h2><div class="shop-banner tactical-banner">${img('shop-tactical-banner.webp')}<button class="banner-help hit" data-help-pool="cards" aria-label="战术卡包概率说明">?</button><div class="pity tactical-pity"><div>剩余<strong>${10 - p.pity.cards}</strong>次必得<span>卓越卡牌</span></div><div>剩余<strong>${200 - p.legendPity.cards}</strong>次必得<em>绝世卡牌</em></div></div></div>${drawButtons('cards', [1, 5])}<h2 class="ribbon">宝箱</h2><div class="shop-banner chest-banner">${img('shop-chest-banner.webp')}<button class="banner-help hit" data-help-pool="normal" aria-label="普通宝箱概率说明">?</button><div class="pity chest-pity">剩余<strong>${10 - p.pity.normal}</strong>次必得<span>卓越宝石</span></div></div>${drawButtons('normal', [1, 10])}<h2 class="ribbon">高级宝箱</h2><div class="shop-banner chest-banner premium-banner">${img('shop-chest-banner.webp')}<div class="premium-title">高级宝箱</div><button class="banner-help hit" data-help-pool="premium" aria-label="高级宝箱概率说明">?</button><div class="pity chest-pity">每抽必得<strong>卓越以上</strong>宝石 / 装备</div></div>${drawButtons('premium', [1, 10])}<div class="free-note">无限免费 · 无广告 · 不扣钻石 / 钥匙 · 抽取结果自动保存</div></div>`;
}
function drawButtons(pool, counts) {
  return `<div class="draw-buttons"><button class="free-button" data-draw="${pool}" data-count="1"><span>▶</span> 免费<small>不限次</small></button>${counts.map((n) => `<button class="gold-button" data-draw="${pool}" data-count="${n}"><small>∞ 免费</small><b>抽${n}次</b></button>`).join('')}</div>`;
}
function shopSupply(p, tab) {
  const name = ['', '免费充值补给', '每日特惠', '特惠礼包'][tab];
  return `<div class="paper-panel supplies"><h2 class="ribbon">${name}</h2><p class="supply-note">本地畅玩版：所有补给免费领取，不产生支付。</p>${[
    ['diamonds', '钻石补给', '5000', 'resource-diamond.png'],
    ['gold', '金币补给', '50万', 'resource-gold.png'],
    ['energy', '体力补给', '1000', 'resource-meat.png'],
    ['materials', '锻造补给', '100图纸 + 10芯片', 'equipment-0.png'],
    ['all', '全套特惠礼包', '一键领取全部', 'gem-rainbow.png'],
  ]
    .map(
      ([id, name, n, pic]) =>
        `<div class="supply-card">${img(pic)}<div><h3>${name}</h3><p>${n} · 每次免费</p></div><button class="gold-button" data-grant="${id}">免费领取</button></div>`,
    )
    .join('')}</div>`;
}
export function presets(p, which = 'core') {
  return `<div class="preset-bar ${which}-presets">${p.presets.map((s, i) => `<button data-preset="${i}" class="${i === p.preset ? 'selected' : ''}">${i + 1}${i === p.preset ? '<span>方案' + (i + 1) + ' ⚙</span>' : ''}</button>`).join('')}<button data-action="preset-help">»</button></div>`;
}
export function characterScreen(p, state) {
  const power = combatStats(p).power;
  return `<section class="screen character-screen" aria-label="角色页面"><div class="character-upper ${p.skin}"></div><canvas class="native-home-player" data-native-player="character" aria-label="APK原生角色动画"></canvas><img class="native-weapon-front" src="${NATIVE_ART[GROWTH.GunBaseConfig.find((r) => r.ID === ensureNative(p).gun)?.DisPlayIconName] || './assets/native-ui/weapon-default.webp'}" alt=""><div class="role-level">Lv.${p.level}<small>经验 ${p.roleXp || 0} / ${p.level * 100}</small></div>${header(p)}<div class="hero-power">${power}<button data-action="stats" aria-label="属性详情">ⓘ</button></div><div class="character-links"><button class="hit" data-action="skins" aria-label="时装">时装</button><button class="hit" data-action="guns" aria-label="枪械">枪械</button><button class="hit" data-action="mercenary" aria-label="佣兵">佣兵</button><button class="hit" data-action="pioneer" aria-label="先锋技能">先锋</button><button class="hit" data-action="mecha" aria-label="机甲">机甲</button></div><button class="gem-summary-hit hit" data-action="stats" aria-label="宝石总览"></button><div class="gear-slots">${GEAR_SLOTS.map(
    (s, i) => {
      const gear = p.gear[s.id];
      return `<button class="gear-slot gear-slot-${i}" data-gear="${s.id}" aria-label="${s.name}详情">${img('equipment-' + i + '.png')}<strong>${gear.tier}阶</strong><b>${gear.level}级</b><span class="gem-sockets">${gear.gems.map((g) => `<i class="${g ? 'filled' : ''}"></i>`).join('')}</span></button>`;
    },
  ).join(
    '',
  )}</div>${presets(p, 'character')}<button class="forge-button gold-button" data-action="forge">装备锻造</button><div class="inventory-heading"><b>我的背包</b><span>${Object.values(p.inventory).reduce((s, n) => s + n, 0)} ◈</span><button class="refine-entry gold-button" data-action="refine-list">宝石洗练</button><button data-action="filter">☰ 筛选</button><button class="gold-button" data-action="synthesize">一键合成</button></div><div class="screen-scroll inventory-scroll">${inventory(p, state)}</div><div class="sub-tabs character-subtabs">${['宝石', '装备', '材料', '芯片'].map((s, i) => `<button data-inventory-tab="${i}" class="${state.inventoryTab === i ? 'selected' : ''}">${s}</button>`).join('')}</div></section>`;
}
export function gemPicture(item, p = null) {
  const r = item.rarity,
    slot = GEAR_SLOTS.findIndex((s) => s.id === item.slot);
  return `<span class="gem-art ${item.native ? 'native-gem' : 'legacy-gem'} rarity-${r}">${item.native ? '<img class="gem-image" src="./assets/client-interface/' + item.native.icon + '.webp" alt="" loading="lazy">' : img(r >= 6 ? 'gem-rainbow-art.png' : 'gem-red-art.png', 'gem-image')}<i class="gem-slot-badge">${['♟', '◒', '♜', '▥', '♧', '✥'][slot] || '◆'}</i>${p?.locked[item.id] ? '<em class="lock-badge">▣</em>' : ''}</span>`;
}
function inventory(p, state) {
  if (state.inventoryTab === 0) {
    const items = Object.entries(p.inventory)
      .filter(([id, qty]) => qty > 0 && itemInfo(id))
      .map(([id, qty]) => ({ ...itemInfo(id), quantity: qty }))
      .filter((i) => !state.filterSlot || i.slot === state.filterSlot)
      .sort((a, b) => b.rarity - a.rarity || a.slot.localeCompare(b.slot));
    return items.length
      ? `<div class="gem-grid">${items.map((i) => `<button data-gem="${i.id}" class="inventory-item" aria-label="${RARITIES[i.rarity].name}${GEAR_SLOTS.find((s) => s.id === i.slot).name}${i.native ? esc(i.native.description) : AFFIXES.find((a) => a.id === i.affix).name}宝石">${gemPicture(i, p)}<span>${i.quantity}</span></button>`).join('')}</div>`
      : '<p class="empty-state">背包空空的，去商城免费开宝箱吧！</p>';
  }
  if (state.inventoryTab === 1) {
    const items = Object.entries(p.gearBag).filter(([, qty]) => qty > 0);
    return items.length
      ? `<div class="gem-grid">${items
          .map(([id, qty]) => {
            const i = itemInfo(id),
              s = GEAR_SLOTS.find((s) => s.id === i.slot);
            return `<button data-bag-gear="${id}" class="inventory-item gear-bag rarity-${i.rarity}">${img('equipment-' + s.art + '.png')}<span>${qty}</span><b>${RARITIES[i.rarity].name}</b></button>`;
          })
          .join('')}</div>`
      : '<p class="empty-state">开启高级宝箱可以获得装备，所有抽取免费。</p>';
  }
  return `<button class="gold-button" data-growth-supply="1">免费领取养成材料</button><div class="growth-catalog material-catalog">${Object.entries(
    ensureNative(p).goods,
  )
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const r = nativeGood(id);
      return `<div>${NATIVE_ART[r?.IconName] ? `<img src="${NATIVE_ART[r.IconName]}" alt="">` : ''}<b>${esc(nativeGoodName(id))}</b><small>×${n}</small></div>`;
    })
    .join('')}</div>`;
}
export function coreScreen(p, state) {
  const disabled = p.presets[p.preset].disabled,
    stats = combatStats(p);
  return `<section class="screen core-screen" aria-label="核心页面"><div class="core-upper ${p.form}"><canvas class="native-home-player native-core-player" data-native-player="core" aria-label="APK核心骨骼动画"></canvas></div>${header(p)}${marquee(p)}<div class="core-links"><button class="hit" data-action="forms" aria-label="幻形">幻形</button><button class="hit" data-action="superweapon" aria-label="超武">超武</button><button class="hit" data-action="cards" aria-label="战术卡组">战术卡组</button></div><button class="disabled-count" data-action="disable-help">禁用技能(${disabled.length}/6) ⓘ</button>${presets(p, 'core')}<div class="core-stat"><span>总暴击伤害增幅</span><b>${(100 + stats.critical * 100).toFixed(1)}%</b><button data-action="stats">ⓘ</button><button class="gold-button" data-action="edit-disabled">${state.editDisabled ? '完成编辑' : '禁用编辑'}</button></div><div class="screen-scroll core-scroll"><div class="skill-grid">${SKILLS.map((s) => `<button class="skill-card ${disabled.includes(s.id) ? 'disabled-skill' : ''} ${state.editDisabled ? 'editing' : ''}" data-skill="${s.id}" aria-label="${s.name}${state.editDisabled ? '禁用配置' : '升级'}"><span class="skill-paper"></span>${skillIcon(s.id)}<b>${p.skills[s.id].level}级</b><small>${state.editDisabled ? (disabled.includes(s.id) ? '已禁用' : '可加入禁用') : s.name}</small>${p.skills[s.id].cards > 0 ? '<i class="red-dot"></i>' : ''}</button>`).join('')}</div></div></section>`;
}
export const MAP_NAMES = ['怒焰裂谷', '钢铁废墟', '极寒港口', '暗红禁区', '黎明要塞'];
export function battleScreen(p, profile, state) {
  const n = profile.selected,
    stars = profile.stars[n] || 0,
    hp = p.bestHealth[n] || 0,
    claims = p.stageClaims[n] || 0;
  return `<section class="screen campaign-screen" aria-label="战斗页面"><div class="campaign-art" ></div><img class="native-chapter-model" src="./assets/native-scenes/${clientStage(n).image}.webp" alt="${esc(clientStage(n).name)}关卡模型">${header(p)}${marquee(p)}<button class="campaign-stage hit" data-action="levels"><strong>${esc(clientStage(n).name)}</strong></button><div class="battle-modes"><button data-mode="normal" class="${state.mode === 'normal' ? 'selected' : ''}">☠ 普通</button><button data-mode="elite" class="${state.mode === 'elite' ? 'selected' : ''}">☠ 精英</button></div><button class="stage-arrow left hit" data-stage-step="-1" aria-label="上一关">❮</button><button class="stage-arrow right hit" data-stage-step="1" aria-label="下一关">❯</button><div class="campaign-rewards">${['成功通关', '50%血量通关', '完美通关'].map((s, i) => `<button data-claim="${i}" class="hit ${hp >= [1, 50, 100][i] && !(claims & (1 << i)) ? 'claim-ready' : ''}" aria-label="领取${s}宝箱"><span>${claims & (1 << i) ? '已领取' : s}</span></button>`).join('')}</div><button class="campaign-start hit" data-action="start"><b>开始游戏</b><span>${img('resource-meat.png')}5 <small>免费补给</small></span></button><button class="patrol-hit hit" data-action="patrol" aria-label="巡逻车"><img src="./assets/native-ui/zmzg_zjm_button_xlz01.webp" alt=""><span>巡逻车</span></button><div class="campaign-left">${operationEntrances('left')}</div><div class="campaign-right">${operationEntrances('right')}</div><div class="stage-small-label">${n}/${CAMPAIGN_LEVEL_COUNT} 关 · ${'★'.repeat(stars)}${state.mode === 'elite' ? ' · 精英强袭' : ''}</div></section>`;
}
export function lootCard(r) {
  if (r.type === 'card') {
    const s = SKILLS.find((s) => s.id === r.id);
    return `<div class="loot-card rarity-${r.rarity}">${skillIcon(r.id)}<b>${s.name}</b><span>${RARITIES[r.rarity].name}卡牌 ×${r.quantity}</span></div>`;
  }
  const i = itemInfo(r.id);
  return `<div class="loot-card rarity-${r.rarity}">${r.type === 'gem' ? gemPicture(i) : img('equipment-' + GEAR_SLOTS.find((s) => s.id === i.slot).art + '.png')}<b>${RARITIES[r.rarity].name}${r.type === 'gem' ? '宝石' : GEAR_SLOTS.find((s) => s.id === i.slot).name}</b><span>×${r.quantity}</span></div>`;
}
