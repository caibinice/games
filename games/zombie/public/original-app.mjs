import {
  chooseNativeBox,
  supplyNativeBox,
  BOX_BATCH_LIMIT,
  nativeBoxKind,
} from './native-boxes.mjs';
import { nativeChoiceBoxView, nativeBoxSupplyView } from './native-box-ui.mjs';
import { preloadNativeFx } from './native-fx.mjs';
import { animateStarDraw } from './star-lottery.mjs';
import { animateBihaiDraw } from './bihai-lottery.mjs';
import {
  renderNativeTreasure,
  clearNativeTreasure,
  animateTreasureDraw,
} from './native-treasure.mjs';
import { activityItems, useActivityItem } from './native-activity-items.mjs';
import { renderNativeForm, clearNativeForm } from './native-form-preview.mjs';
import { gemSourceNote } from './proc-graph-rules.mjs';
import { guideHTML, GEM_TAGS } from './guide-data.mjs';
import { NATIVE_ART } from './native-art-data.mjs';
import { CLIENT_NATIVE_BUILDS } from './native-skill-extra.mjs';
import {
  operation,
  operationState,
  operationPool,
  drawOperation,
  playEgg,
  claimEgg,
  eggOptions,
  claimOperationMilestone,
  claimTreasureLayer,
  claimTreasureTask,
  selectTreasureReward,
  selectStarReward,
  operationRules,
  operationExchangePool,
  exchangeOperationReward,
  claimBihaiMilestone,
} from './operations.mjs';
import { STAR_BIG, STAR_SMALL, starOptions } from './board-lotteries.mjs';
import { eggCanClaim } from './egg-lottery.mjs';
import {
  loadOperationLayouts,
  operationScreen,
  operationRewardCards,
  operationExchangeView,
} from './operations-ui.mjs';
import {
  nativeSupply,
  ensureNative,
  upgradeGunSkill,
  unlockNativeGun,
  upgradeNativeGun,
  recruitMercenary,
  upgradeMercenary,
  upgradeNativeSkin,
  equipNativeSkin,
} from './native-progression.mjs';
import {
  nativeSkillPanel,
  nativeGearPanel,
  gunPanel,
  mercenaryPanel,
  skinPanel,
} from './growth-ui.mjs';
import {
  gemRefineCost,
  pendingGemRefine,
  rollGemRefine,
  finishGemRefine,
  refinableGemInventory,
} from './gem-refine.mjs';
import { NATIVE_ACTIVITY_RULES } from './native-activity-rules.mjs';
import { fitGame } from './layout.mjs';
import { renderNativeHome, clearNativeHome } from './native-home.mjs';
import { claimEventMilestone, mazeNodes, enterMaze } from './activity-state.mjs';
import {
  createGame,
  start,
  step,
  togglePause,
  setAim,
  airstrike,
  chooseUpgrade,
  rerollUpgrades,
  ORIGINAL_WEAPONS,
} from './engine.mjs';
import {
  defaultProfile,
  parseProfile,
  recordWin,
  battleStars,
  battleHealthPercent,
  SAVE_KEY,
} from './profile.mjs';
import {
  createMeta,
  parseMeta,
  META_KEY,
  draw,
  upgradeSkill,
  enhanceGear,
  forgeGear,
  equipGear,
  equipGem,
  unequipGem,
  synthesize,
  setDisabled,
  grantSupply,
  combatStats,
  recordBattle,
  claimStage,
  itemInfo,
} from './progression.mjs';
import { SKILLS, GEAR_SLOTS, AFFIXES, RARITIES, shortNumber, skillById } from './content.mjs';
import {
  esc,
  img,
  skillIcon,
  navigation,
  shopScreen,
  characterScreen,
  coreScreen,
  battleScreen,
  gemPicture,
  lootCard,
  MAP_NAMES,
} from './screens.mjs';
import { createOriginalRenderer } from './original-render.mjs';
import { createAudio } from './audio.mjs';
import { CAMPAIGN_LEVEL_COUNT } from './campaign-limits.mjs';
import { loadClientStage, loadActivities } from './client-campaign.mjs';
import { applyCheats, CHEAT_FLAGS, grantGuildReward } from './cheats.mjs';
import { createGuildApi } from './guild-api.mjs';
import { guildScreen, activityScreen, baseScreen } from './community-screens.mjs';
import { skillCodex } from './skill-codex.mjs';
import { CLIENT_BUILD_CATALOG } from './client-skill-data.mjs';
import { showEntry, hideEntry } from './native-entry.mjs';
import {
  NATIVE_GEMS,
  PLAYABLE_GEMS,
  nativeGemPlayable,
  nativeGemDebug,
  gemDescription,
  nativeComposeCount,
} from './native-gems.mjs';
const $ = (id) => document.getElementById(id),
  state = {
    tab: 'battle',
    shopTab: 0,
    inventoryTab: 0,
    filterSlot: '',
    editDisabled: false,
    mode: 'normal',
    chapter: 0,
  };
let profile = defaultProfile(),
  meta = createMeta();
try {
  profile = parseProfile(localStorage.getItem(SAVE_KEY));
  const raw = localStorage.getItem(META_KEY);
  if (raw) meta = parseMeta(raw);
} catch {}
const guildApi = createGuildApi();
let starting = false;
preloadNativeFx().then((r) => {
  document.documentElement.dataset.fxPrewarm = `${r.loaded}/${r.total}`;
});
const treeView = { skill: 'frost', source: 'native', zoom: 100, focus: null, mode: 'all' };
const audio = createAudio(profile);
let g = null,
  renderer = null,
  canvas = null,
  modalType = '',
  resumeOnClose = false,
  lastFocus = null,
  toastTimer,
  announceTimer,
  previous = 0,
  hudAt = 0,
  raf,
  ended = false,
  settled = false,
  accumulator = 0,
  pointer = null;
function save() {
  // 战役进度与养成背包使用独立存档键，重绘页面时不要把局内临时状态写回。
  applyCheats(meta, profile);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    toast('存储空间不足，本次仍可继续游玩');
  }
}
function toast(s) {
  $('toast').textContent = s;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2400);
}
const focusEggFloor = () => {
  const list = document.querySelector('.egg-scroll'),
    current = list?.querySelector('.current');
  if (current) list.scrollTop = current.offsetTop - list.clientHeight + current.offsetHeight;
};
const resize = () => {
  fitGame();
  if (state.operation && !state.opBusy) {
    const plane = document.querySelector('.operation-stage'),
      height = Math.max(1334, parseFloat($('game-root').style.height) / 1.44 || 1334);
    if (plane && Math.abs(parseFloat(plane.style.height) - height) > 1) {
      $('page').innerHTML = operationScreen(meta, state.operation);
      if (state.operation === 'treasure')
        renderNativeTreasure($('page'), operationState(meta, 'treasure'));
    }
    focusEggFloor();
  }
};
function render() {
  if (g) return;
  clearNativeTreasure();
  applyCheats(meta, profile);
  if (!meta.entered) {
    $('page').innerHTML = '';
    showEntry();
    return;
  }
  hideEntry();
  if (state.operation) {
    clearNativeHome();
    $('page').innerHTML = operationScreen(meta, state.operation);
    $('game-root').dataset.page = 'operation';
    resize();
    if (state.operation === 'treasure')
      renderNativeTreasure($('page'), operationState(meta, 'treasure'));
    return;
  }
  const fn = {
    shop: () => shopScreen(meta, state),
    character: () => characterScreen(meta, state),
    core: () => coreScreen(meta, state),
    battle: () => battleScreen(meta, profile, state),
    guild: () => guildScreen(meta, state),
    base: () => (state.activityView ? activityScreen(meta, state) : baseScreen(meta)),
    journey: () => activityScreen(meta, state),
  };
  $('page').innerHTML =
    fn[state.tab]() +
    navigation(state.tab) +
    '<button class="cheat-shortcut" data-action="cheats">畅玩控制台</button>';
  $('game-root').dataset.page = state.tab;
  requestAnimationFrame(() => {
    resize();
    renderNativeHome($('page'), meta);
  });
}
function entryFailure(error) {
  console.error('游戏入口渲染失败', error);
  const old = $('entry-error');
  if (old) old.remove();
  const message = String(error?.message || '页面渲染遇到错误').slice(0, 180);
  $('page').insertAdjacentHTML(
    'beforeend',
    `<section id="entry-error" class="entry-error" role="alert"><h3>进入时遇到错误</h3><p>${esc(message)}</p><p>进度与背包保留，请重试或刷新页面。</p><div class="dialog-actions"><button class="gold-button" data-action="enter">重试进入</button><button class="secondary-button" data-action="reload">刷新页面</button></div></section>`,
  );
}
function enter() {
  const prior = meta.entered;
  meta.entered = true;
  try {
    render();
  } catch (error) {
    meta.entered = prior;
    entryFailure(error);
    return;
  }
  save();
  audio.setHome(true);
  audio.unlock();
}
function modal(title, html, type = 'info', { closable = true, pause = true } = {}) {
  clearNativeForm();
  $('overlay').dataset.kind = type;
  if ($('overlay').hidden) lastFocus = document.activeElement;
  if (pause && g?.status === 'running') {
    togglePause(g);
    resumeOnClose = true;
  }
  modalType = type;
  $('dialog').dataset.kind = type;
  $('dialog').classList.toggle('skill-codex-dialog', type === 'skill-tree' || type === 'gem-codex');
  $('overlay').hidden = false;
  $('dialog').innerHTML =
    `${closable ? '<button class="dialog-close" data-action="close" aria-label="关闭">×</button>' : ''}<h2 id="dialog-title" class="dialog-title">${title}</h2><div class="dialog-body">${html}</div>`;
  audio.setActive(false);
  queueMicrotask(() => {
    $('dialog').querySelector('button,input')?.focus({ preventScroll: true });
    if (type === 'form') {
      renderNativeForm($('dialog'));
      $('dialog')
        .querySelector('.native-form-carousel .selected')
        ?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  });
}
function close(force = false) {
  if (!force && modalType === 'skill-tree' && g?.status === 'upgrade') {
    choices();
    return;
  }
  if (!force && ['upgrade', 'result'].includes(modalType)) return;
  clearNativeForm();
  const was = resumeOnClose;
  resumeOnClose = false;
  modalType = '';
  $('overlay').hidden = true;
  $('dialog').innerHTML = '';
  if (was && g?.status === 'paused') togglePause(g);
  audio.setActive(g?.status === 'running');
  if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}
const actions = (html) => `<div class="dialog-actions">${html}</div>`;
const button = (label, attrs = '', cls = 'gold-button') =>
  `<button class="${cls}" ${attrs}>${label}</button>`;
function help() {
  modal(
    '指挥官手册',
    `<p>自动射击；按住战场拖动可以集火，松手恢复自动瞄准。击杀升级后，从三项强化中选择一项。14系技能均按APK配置的前置、互斥与次数进入局内升级池；枪械具有30发弹匣与换弹流程。</p><p>商城三个卡池无限免费抽取，奖励自动进入卡牌、宝石和装备背包。角色装备、宝石、核心等级、出战技能和禁用方案都会影响实战。</p><p>战役已接入参考包普通${CAMPAIGN_LEVEL_COUNT}关和精英${CAMPAIGN_LEVEL_COUNT}关、每关20波的出怪时间、怪物种类和数量浮动，以及局内经验表。伤害、防线和首领表现仍采用网页适配数值。普通通关解锁下一关和本关精英；耐久达标后回营地领取宝箱。体力与金币可在商城免费补充。</p><p>电脑：P / Esc 暂停，1 / 2 / 3 选强化，Space 空袭，F 全屏。手机：点击按钮操作，支持全屏；横屏会保留完整竖屏战场。</p><p class="source-label">加载场景、登录骨骼动画、原生宝石配置、怪物序列帧、核心图标及音乐来自参考APK；六栏导航、主线场景、防线与角色骨骼使用APK素材；完整Unity粒子与部分活动专属机关仍在迁移。未接入原作账号与服务器。素材与还原进度见 <a href="./assets/credits.html" target="_blank" rel="noopener">素材说明</a>。</p>`,
  );
}
function settings() {
  modal(
    '作战设置',
    `<p class="dialog-sub">关卡和养成保存在本机；军团成员、聊天和首领为多人共享。</p>${actions(button(profile.music ? '音乐：开' : '音乐：关', 'data-action="music"') + button(profile.sound ? '音效：开' : '音效：关', 'data-action="sound"') + button('全屏显示', 'data-action="fullscreen"') + button('畅玩控制台', 'data-action="cheats"') + button('活动道具', 'data-activity-items="1"') + button('常驻活动', 'data-action="activities"') + button('技能升级图鉴', 'data-action="skill-tree"') + button('技能合成公式', 'data-action="skill-recipes"') + button('宝石属性图鉴', 'data-action="gem-codex"') + button('攻略与机制对照', 'data-action="guide-sources"') + button('玩法说明', 'data-action="help"') + button('返回游戏大厅', 'data-action="lobby"', 'secondary-button'))}`,
    'settings',
  );
}
function showSkillTree() {
  modal('技能升级图鉴', skillCodex(treeView, g), 'skill-tree');
  if (treeView.focus)
    requestAnimationFrame(() =>
      $('dialog')
        .querySelector('[data-codex-build="' + treeView.focus + '"]')
        ?.scrollIntoView({ block: 'nearest' }),
    );
}
function showCheats() {
  const labels = {
    gold: '无限金币',
    diamonds: '无限钻石',
    energy: '无限体力',
    unlockAll: '全部关卡解锁',
    invincible: '防线无敌',
    firepower: '千倍火力',
  };
  modal(
    '畅玩控制台',
    `<p>这些开关仅影响本游戏，设置保存在当前浏览器。所有活动始终开放，免费抽奖和军团签到不限次数。</p><div class="cheat-grid">${CHEAT_FLAGS.map((k) => button(labels[k] + '：' + (meta.cheats[k] ? '开' : '关'), `data-cheat="${k}"`, meta.cheats[k] ? 'gold-button' : 'secondary-button')).join('')}</div>${actions(button('领取全套补给', 'data-action="cheat-supply"') + (g && !['won', 'lost'].includes(g.status) ? button('直接通关本局', 'data-action="cheat-win"') : '') + button('确定', 'data-action="close"', 'secondary-button'))}<p class="dialog-sub">无敌与火力从下一次出击生效。全关解锁覆盖普通和精英${CAMPAIGN_LEVEL_COUNT}关。</p>`,
    'cheats',
  );
}
async function openActivities(tab = 'base') {
  if (g) return;
  close();
  state.tab = tab;
  state.activityView = true;
  state.activityError = '';
  render();
  try {
    state.activities = await loadActivities();
    if (state.activityType === undefined) state.activityType = state.activities[0]?.LevelType;
    render();
  } catch (error) {
    state.activityError = error.message;
    render();
  }
}
async function refreshGuild(silent = false) {
  if (state.guildBusy) return;
  const revision = state.guildRevision || 0;
  if (!silent) {
    state.guildLoading = true;
    state.guildError = '';
    render();
  }
  try {
    await guildApi.ensure(meta.name);
    const me = await guildApi.me();
    if (revision !== (state.guildRevision || 0)) return;
    state.guild = me.guild;
    state.guildPlayer = me.playerId;
    if (!me.guild) state.guildDirectory = await guildApi.list();
    state.guildError = '';
  } catch (error) {
    state.guildError = error.message;
  } finally {
    state.guildLoading = false;
    if (
      state.tab === 'guild' &&
      !g &&
      (!silent || !document.activeElement?.matches('input,textarea'))
    )
      render();
  }
}
async function guildAction(d) {
  if (state.guildBusy) return;
  const action = d.guildAction;
  if (action === 'refresh') {
    refreshGuild();
    return;
  }
  if (action === 'invite') {
    const url = new URL(location.href);
    url.search = '?guild=' + state.guild.code;
    try {
      await navigator.clipboard.writeText(url.href);
      toast('邀请链接已复制');
    } catch {
      modal(
        '邀请朋友',
        `<p>军团码：${esc(state.guild.code)}</p><p class="guild-invite-url">${esc(url.href)}</p>`,
      );
    }
    return;
  }
  const name = $('guild-name')?.value,
    code = d.code || $('guild-code')?.value,
    text = $('guild-message')?.value;
  if (action === 'leave' && !confirm('确认退出当前军团？')) return;
  state.guildBusy = true;
  state.guildRevision = (state.guildRevision || 0) + 1;
  render();
  try {
    await guildApi.ensure(meta.name);
    let result;
    if (action === 'create') {
      state.guild = await guildApi.create(name);
    } else if (action === 'join') {
      state.guild = await guildApi.join(
        String(code || '')
          .trim()
          .toUpperCase(),
      );
    } else {
      const n = action === 'signin10' ? 10 : 1;
      for (let i = 0; i < n; i++) {
        result = await guildApi.action(
          state.guild.code,
          action === 'signin10' ? 'signin' : action,
          { text, count: Number(d.count) || 1 },
        );
        grantGuildReward(meta, result.reward);
        state.guild = result.guild;
      }
      save();
    }
    state.guildPlayer = guildApi.playerId;
    state.guildError = '';
    toast(action.startsWith('signin') ? '签到奖励已到账，可继续签到' : '军团状态已同步');
  } catch (error) {
    toast(error.message);
  } finally {
    state.guildBusy = false;
    render();
  }
}
try {
  state.guildInvite = new URL(location.href).searchParams.get('guild') || '';
} catch {}
const guildPoll = setInterval(() => {
  if (!document.hidden && state.tab === 'guild' && !g && !state.guildLoading && $('overlay').hidden)
    refreshGuild(true);
}, 10000);
function showStats() {
  const s = combatStats(meta),
    gp = s.gunProfile;
  modal(
    '角色属性',
    `<p class="dialog-sub">当前方案${meta.preset + 1} · 战力 ${s.power}</p><div class="stat-grid">${[
      ['先锋攻击', s.nativeAttack.toFixed(0)],
      ['防线耐久', s.nativeMaxHp.toFixed(0)],
      ['暴击率', ((s.critChance + gp.critChance) * 100).toFixed(1) + '%'],
      ['额外暴击伤害', ((s.critical + gp.critDamage) * 100).toFixed(1) + '%'],
      ['弹匣容量', gp.capacity],
      ['射击间隔', gp.interval.toFixed(3) + '秒'],
      ['换弹时间', gp.reload.toFixed(2) + '秒'],
      ['佣兵', s.mercenary?.name || '未出战'],
    ]
      .map(([n, v]) => `<div>${n}<b>${v}</b></div>`)
      .join(
        '',
      )}</div><p>数值由装备、宝石、枪械、核心和已激活外观配置计算。复杂触发、部分枪型与专属机关继续逐项对照，不再使用截图的固定战力或每级0.6%加成。</p>`,
  );
}
function showDraw(pool, n) {
  const rewards = draw(meta, pool, n);
  save();
  render();
  modal(
    '恭喜获得',
    `<div class="loot-grid ${n === 1 ? 'single' : ''}">${rewards.map(lootCard).join('')}</div><p class="dialog-sub">累计免费抽取 ${meta.draws[pool]} 次 · 奖励已保存至背包</p>${actions(button('再抽' + n + '次', `data-draw="${pool}" data-count="${n}"`) + button('确定', 'data-action="close"', 'secondary-button'))}<p class="free-note">不限次数 · 不扣任何货币 · 无广告</p>`,
    'draw',
  );
}
function showPool(pool) {
  modal(
    '免费抽取说明',
    `<p>所有卡池可无限次免费抽取，无广告、无支付、无钥匙消耗。</p><p>本地复刻设定：精良48%，稀有30%，卓越16%，传说4.5%，绝世1.3%，幻彩0.2%。10次以内必得卓越及以上，200次以内必得绝世及以上；提前获得即重置相应保底。</p><p>${pool === 'premium' ? '高级宝箱最低卓越品质，30%获得装备，其余为宝石。' : pool === 'cards' ? '战术卡包随机获得14种技能之一的卡牌，品质影响数量，供核心升级。' : '普通宝箱从已接入战斗的客户端宝石中抽取，包含不同部位的暴击、冷却、元素、穿透、击杀回复和传送等词条；复合触发词条先在图鉴列出，不发放无效道具。'}</p><p class="source-label">上述为此网页免费版规则，不代表原作线上概率。</p>`,
  );
}
function showSkill(id) {
  const s = skillById(id);
  modal(s.name, nativeSkillPanel(meta, id, s.name, s.desc), 'skill');
}
function showGear(slot) {
  const s = GEAR_SLOTS.find((s) => s.id === slot),
    v = meta.gear[slot];
  modal(
    s.name,
    nativeGearPanel(meta, slot) +
      `<h3>宝石镶嵌</h3><div class="slot-choices">${v.gems.map((id, i) => `<button data-socket="${slot}" data-index="${i}">${id ? gemPicture(itemInfo(id)) : '＋'}<span>${id ? '已镶嵌' : '空插槽'}</span></button>`).join('')}</div>${actions(button('装备强化', `data-enhance="${slot}"`) + button('升阶锻造', `data-forge="${slot}"`) + button('领取养成材料', 'data-growth-supply="1"'))}`,
    'gear',
  );
}
function gemText(i) {
  const a = AFFIXES.find((a) => a.id === i.affix);
  return i.native ? gemDescription(i) : a.name + ' +' + ((i.rarity + 1) * a.value).toFixed(1) + '%';
}
function showGem(id) {
  const i = itemInfo(id);
  if (!i) return;
  const s = GEAR_SLOTS.find((s) => s.id === i.slot);
  modal(
    RARITIES[i.rarity].name + '宝石',
    `<div class="native-gem-tip"><div class="native-gem-heading">${gemPicture(i, meta)}<div><h3>${s.name}专属宝石</h3><p>品质：${RARITIES[i.rarity].name}　数量：${meta.inventory[id] || 0}</p></div></div><h4>宝石效果</h4><p class="native-gem-description">${esc(gemText(i))}</p>${i.native && gemSourceNote(i.native) ? '<p class="source-note">' + esc(gemSourceNote(i.native)) + '</p>' : ''}<div class="dialog-actions">${gemRefineCost(id) ? button('洗练', `data-gem-refine="${id}"`) : ''}${button(meta.locked[id] ? '解除锁定' : '锁定宝石', `data-lock="${id}"`, 'secondary-button')}</div></div><p>选择插槽镶嵌，旧宝石返回背包：</p><div class="slot-choices">${meta.gear[i.slot].gems.map((old, n) => `<button data-equip-gem="${id}" data-slot="${i.slot}" data-index="${n}">${old ? gemPicture(itemInfo(old)) : '＋'}<span>插槽${n + 1}</span></button>`).join('')}</div>${actions(button('一键合成', 'data-action="synthesize"', 'secondary-button'))}`,
    'gem',
  );
}
function showSocket(slot, index, focus = '') {
  const old = meta.gear[slot]?.gems[index];
  if (!meta.gear[slot]) return;
  const items = Object.entries(meta.inventory)
    .filter(([id, n]) => n > 0 && itemInfo(id)?.slot === slot)
    .sort((a, b) => itemInfo(b[0]).rarity - itemInfo(a[0]).rarity);
  focus = items.some(([id]) => id === focus) ? focus : items[0]?.[0] || '';
  const picked = focus && itemInfo(focus),
    current = old && itemInfo(old);
  modal(
    '宝石镶嵌',
    `<p class="dialog-sub">${GEAR_SLOTS.find((s) => s.id === slot).name} · 插槽${index + 1} · 替换后旧宝石返回背包</p>${current ? `<div class="native-current-gem">${gemPicture(current, meta)}<div><b>已镶嵌 · ${RARITIES[current.rarity].name}</b><p>${esc(gemText(current))}</p></div>${gemRefineCost(old) ? button('洗练', `data-gem-refine="${old}" data-slot="${slot}" data-index="${index}"`) : ''}${button('卸下', `data-unequip="${slot}" data-index="${index}"`, 'secondary-button')}</div>` : ''}<div class="native-gem-picker"><div class="socket-item"><div class="gem-grid">${items.map(([id, n]) => `<button class="inventory-item ${focus === id ? 'selected' : ''}" data-socket-view="${id}" data-slot="${slot}" data-index="${index}">${gemPicture(itemInfo(id), meta)}<span>${n}</span></button>`).join('') || '<p>此部位背包暂无宝石</p>'}</div></div>${picked ? `<div class="native-gem-tip"><div class="native-gem-heading">${gemPicture(picked, meta)}<div><h3>${RARITIES[picked.rarity].name}宝石</h3><p>数量：${meta.inventory[focus]}</p></div></div><h4>宝石效果</h4><p class="native-gem-description">${esc(gemText(picked))}</p><div class="dialog-actions">${button('镶嵌', `data-equip-gem="${focus}" data-slot="${slot}" data-index="${index}"`)}${gemRefineCost(focus) ? button('洗练', `data-gem-refine="${focus}"`) : ''}</div></div>` : ''}</div>`,
    'socket',
  );
}
function showGemRefinePicker() {
  const rows = refinableGemInventory(meta, state.refinePart || ''),
    amount = ensureNative(meta).goods[1001] || 0;
  modal(
    '宝石洗练',
    `<p class="dialog-sub">选择背包中的传说、绝世或至尊宝石。已镶嵌的宝石请先卸下；每次只洗练一颗，保持品质和部位。</p><div class="refine-picker-stock"><img src="./assets/native-operations/images/icon_baoshi_huanxinshiji.webp" alt="焕新试剂">焕新试剂 <b>${amount}</b></div><div class="refine-part-tabs">${[['all', '全部'], ...GEAR_SLOTS.map((s) => [s.id, s.name])].map(([id, name]) => `<button data-refine-part="${id}" class="${(state.refinePart || 'all') === id ? 'selected' : ''}">${name}</button>`).join('')}</div><div class="refine-gem-list">${
      rows
        .map((r) => {
          const i = itemInfo(r.id);
          return `<article><button class="refine-picker-gem" data-gem="${r.id}" aria-label="查看宝石详情">${gemPicture(i, meta)}<span>×${r.count}</span></button><div><b>${RARITIES[i.rarity].name} · ${GEAR_SLOTS.find((s) => s.id === i.slot).name}</b><p>${esc(gemText(i))}</p><small>${r.locked ? '已锁定，请在详情中解锁' : '消耗焕新试剂 ' + r.cost.count}</small></div><button class="gold-button" data-gem-refine="${r.id}" ${r.locked ? 'disabled' : ''}>洗练</button></article>`;
        })
        .join('') ||
      '<p class="empty-state">此分类暂无可洗练宝石。可从常驻抽奖或高级宝箱获取，已镶嵌的宝石需先卸下。</p>'
    }</div>`,
    'refine-picker',
  );
}
function showGemRefine(id, source = { type: 'inventory' }) {
  const pending = pendingGemRefine(meta);
  if (pending) {
    id = pending.oldId;
    source = pending.source;
  }
  if (!pending && source.type !== 'inventory') {
    toast('请先卸下宝石，再到背包洗练');
    return;
  }
  const i = itemInfo(id),
    cost = gemRefineCost(id);
  if (!i || !cost) {
    toast('传说及以上客户端宝石才可洗练');
    return;
  }
  state.refineView = { id, source };
  const next = pending && itemInfo(pending.newId),
    quantity = ensureNative(meta).goods[cost.id] || 0;
  modal(
    '洗练',
    `<div class="native-refine"><div class="native-refine-item">${gemPicture(i, meta)}</div><div class="native-refine-attr"><b>当前词条</b><p>${esc(gemText(i))}</p></div>${next ? `<div class="native-refine-result"><b>新词条 · ${RARITIES[next.rarity].name}</b><p>${esc(gemText(next))}</p><div class="dialog-actions">${button('保留原词条', 'data-refine-finish="keep"', 'secondary-button')}${button('替换新词条', 'data-refine-finish="replace"')}</div></div>` : `<div class="native-refine-cost"><img src="./assets/native-operations/images/icon_baoshi_huanxinshiji.webp" alt="焕新试剂"><b>${quantity}/${cost.count}</b></div><div class="dialog-actions">${button('洗练', 'data-refine-start="1"')}</div>`}<p class="native-refine-note">${pending ? '这是旧版本遗留的待确认结果；处理后恢复客户端直接洗练流程。' : '点击后直接替换词条，品质和部位不变；候选词条等概率抽取，非原服权重。'}</p></div>`,
    pending ? 'gem-refine-legacy' : 'gem-refine',
  );
}
function showBagGear(id) {
  const i = itemInfo(id),
    s = GEAR_SLOTS.find((s) => s.id === i.slot);
  modal(
    '替换装备',
    `<div class="large-item">${img('equipment-' + s.art + '.png')}<div><h3>${RARITIES[i.rarity].name}${s.name}</h3><p>持有 ×${meta.gearBag[id]}</p><p>当前品质：${RARITIES[meta.gear[i.slot].rarity].name}</p><p>保留强化、阶级与宝石，旧装备返回背包。</p></div></div>${actions(button('装备', `data-equip-gear="${id}"`))}`,
  );
}
function showLevels(chapter = Math.floor((profile.selected - 1) / 10)) {
  chapter = Math.max(0, Math.min(Math.ceil(CAMPAIGN_LEVEL_COUNT / 10) - 1, chapter));
  state.chapter = chapter;
  modal(
    '关卡选择 · ' + CAMPAIGN_LEVEL_COUNT + '关',
    `<div class="chapter-tabs">${Array.from({ length: Math.ceil(CAMPAIGN_LEVEL_COUNT / 10) }, (_, i) => button(i * 10 + 1 + '—' + Math.min(CAMPAIGN_LEVEL_COUNT, i * 10 + 10), `data-chapter="${i}"`, i === chapter ? 'selected' : '')).join('')}</div><div class="level-grid">${Array.from(
      { length: Math.min(10, CAMPAIGN_LEVEL_COUNT - chapter * 10) },
      (_, i) => chapter * 10 + i + 1,
    )
      .map(
        (n) =>
          `<button class="${n === profile.selected ? 'current' : ''}" data-level="${n}" ${n > profile.unlocked ? 'disabled' : ''}>${String(n).padStart(2, '0')}<small>${n > profile.unlocked ? '未解锁' : profile.stars[n] ? '★'.repeat(profile.stars[n]) : '待出击'}</small></button>`,
      )
      .join(
        '',
      )}</div><p class="dialog-sub">普通${CAMPAIGN_LEVEL_COUNT}关 + 精英${CAMPAIGN_LEVEL_COUNT}关 · 已解锁${profile.unlocked}/${CAMPAIGN_LEVEL_COUNT} · 控制台可一键全开</p>`,
    'levels',
  );
}

function showSelection(type, focus = 0) {
  state.growthView = { type, focus };
  if (type === 'mercenary')
    modal(
      '佣兵 · 原生19人',
      mercenaryPanel(meta, focus || ensureNative(meta).mercenary || 101),
      'growth',
    );
  else if (type === 'guns') modal('枪械与加点', gunPanel(meta, focus), 'growth');
  else {
    const skinType = type === 'forms' ? 2 : 1;
    modal(
      type === 'forms' ? '核心幻形' : '战斗时装',
      skinPanel(meta, skinType, focus, skinType === 2 ? state.formFilter || '' : ''),
      type === 'forms' ? 'form' : 'growth',
    );
  }
}
async function openOperation(id) {
  if (g || state.opLoading || !operation(id)) return;
  close();
  state.opLoading = true;
  toast('正在载入活动界面…');
  try {
    await loadOperationLayouts();
    state.operation = id;
    render();
    clearTimeout(toastTimer);
    $('toast').classList.remove('visible');
  } catch (error) {
    toast(error.message);
  } finally {
    state.opLoading = false;
  }
}
function operationResult(rows) {
  save();
  render();
  modal(
    '恭喜获得',
    operationRewardCards(rows) +
      `<p class="free-note">奖励已入库 · 免费不限次数</p>${actions(button('继续抽取', 'data-action="close"'))}`,
    'operation-reward',
  );
}
function showEggChoices() {
  const s = operationState(meta, state.operation);
  if (!eggCanClaim(s)) {
    toast('请先抽取，再选择本层奖励');
    return;
  }
  modal(
    '第' + s.floor + '层奖励 · 选择一项',
    `<p>${s.claimReady ? '免费抽取降层，本轮已结束。' : '领取后结束本轮。'}选择一项奖励，领取后层数归零。</p><div class="egg-choice-cards">${eggOptions(
      s.floor,
      state.operation,
    )
      .map(
        (r, i) =>
          `<div>${operationRewardCards([r])}${button('领取此奖励', `data-op-egg-choose="${i}"`)}</div>`,
      )
      .join('')}</div>`,
    'egg-choice',
  );
}
function showOperationExchange() {
  const id = state.operation;
  if (id !== 'bihai') return;
  modal('兑换', operationExchangeView(meta, id), 'bihai-shop');
}
function showTreasureRewards() {
  const s = operationState(meta, 'treasure'),
    pool = operationPool('treasure');
  modal(
    '奖励总览',
    `<div class="treasure-overview-banner"><b>大奖预览</b></div><div class="treasure-progress-list" tabindex="0" aria-label="各层通关奖励">${Array.from(
      { length: 20 },
      (_, i) => i + 1,
    )
      .map((layer) => {
        const choice = s.choices[layer],
          selected = Number.isInteger(choice) && choice >= 0 && choice < 3,
          done = s.boardClaimed.includes(layer),
          complete = s.progress.includes(layer);
        return `<div class="treasure-progress-row"><b>通过第<em>${layer}</em>层可获得</b><button class="treasure-progress-prize ${done ? 'claimed' : ''}" data-treasure-layer="${layer}" aria-label="第${layer}层${done ? '已领取' : complete ? '领取奖励' : '通关奖励'}" ${!complete || done ? 'disabled' : ''}>${selected ? operationRewardCards([pool[choice]]) : '<i>＋</i>'}${done ? '<strong>✓</strong>' : ''}</button>${!done ? `<button class="treasure-progress-change" data-treasure-select="${layer}" aria-label="选择第${layer}层通关奖励">${selected ? '↻' : '＋'}</button>` : ''}</div>`;
      })
      .join(
        '',
      )}</div><div class="treasure-overview-task">累计寻宝 ${s.draws} 次${button('领取10次寻宝奖励', `data-treasure-task="1" ${s.draws < (s.task + 1) * 10 ? 'disabled' : ''}`)}</div>`,
    'treasure-progress',
  );
}
function showTreasureSelection(layer, reset = false) {
  if (reset || state.treasureSelection?.layer !== layer) {
    const saved = operationState(meta, 'treasure').choices[layer];
    state.treasureSelection = {
      layer,
      index: Number.isInteger(saved) && saved >= 0 && saved < 3 ? saved : -1,
    };
  }
  const v = state.treasureSelection;
  modal(
    '选择奖励',
    `<div class="native-select-prizes">${operationPool('treasure')
      .slice(0, 3)
      .map(
        (r, i) =>
          `<button data-treasure-pick="${i}" class="${v.index === i ? 'selected' : ''}">${operationRewardCards([r])}<i>${v.index === i ? '✓' : ''}</i></button>`,
      )
      .join(
        '',
      )}</div>${actions(button('确定', `data-treasure-confirm="1" ${v.index < 0 ? 'disabled' : ''}`))}`,
    'treasure-select',
  );
}
function showBoardPreview(type, cell) {
  const s = operationState(meta, state.operation),
    pool = operationPool(state.operation);
  if (type === 'treasure') {
    const r = pool[cell];
    if (r)
      modal(
        r.nameText,
        operationRewardCards([r]) + '<p>格子、权重和推进采用APK配置；奖品使用本地主题映射。</p>',
      );
    return;
  }
  if (type === 'star-small') {
    const i = STAR_SMALL.findIndex((r) => r.SmallCellID === cell);
    if (i >= 0)
      modal(
        '星盘' + cell,
        operationRewardCards([pool[(i + 5) % pool.length]]) +
          (STAR_SMALL[i].IsSpecialItem ? '<p>抽中此格还会触发月盘，并重置星盘。</p>' : ''),
      );
    return;
  }
  const row = STAR_BIG.find((r) => r.BigCellID === cell);
  if (!row) return;
  modal(
    '月盘' + cell + (row.IsOpt ? ' · 自选奖励' : ''),
    `<p>已获得 ${s.counts[cell] || 0} 次 · 配置最低触发序号 ${row.MinCnt}</p><div class="egg-choice-cards">${starOptions(
      cell,
    )
      .map(
        (r) =>
          `<div>${operationRewardCards([pool[r.poolIndex]])}${row.IsOpt ? button(s.choices[cell] === r.booty ? '已选中' : '设为本格奖励', `data-star-choose="${cell}:${r.booty}"`) : ''}</div>`,
      )
      .join('')}</div>`,
    'star-choice',
  );
}
function growthResult(result, type, focus) {
  save();
  render();
  showSelection(type, focus);
  toast(result.ok ? '配置已保存，下次出击生效' : result.reason);
}

function home() {
  close(true);
  renderer?.dispose?.();
  g = null;
  renderer = null;
  canvas = null;
  resumeOnClose = false;
  settled = false;
  accumulator = 0;
  state.tab = 'battle';
  audio.setHome(true);
  audio.setActive(false);
  render();
}
async function begin(activityId = null) {
  if (starting || g) return;
  if (
    !activityId &&
    state.mode === 'elite' &&
    !meta.cheats.unlockAll &&
    !profile.stars[profile.selected]
  ) {
    toast('普通通关后开启本关精英');
    return;
  }
  starting = true;
  let resolved;
  try {
    resolved = await loadClientStage(profile.selected, state.mode === 'elite', activityId);
  } catch (error) {
    toast(error.message || '关卡载入失败，请重试');
    starting = false;
    return;
  }
  starting = false;
  if (ended) return;
  if (meta.energy < 5) {
    toast('体力不足，已免费补充');
    grantSupply(meta, 'energy');
  }
  meta.energy -= 5;
  save();
  audio.setHome(false);
  close(true);
  const stats = combatStats(meta);
  stats.initialChoices = (stats.initialChoices || 0) + 1;
  const preset = meta.presets[meta.preset];
  g = createGame({
    level: resolved.activity ? 1 : profile.selected,
    clientStageData: resolved,
    cheats: meta.cheats,
    attack: profile.attack,
    fortify: profile.fortify,
    extended: true,
    client: true,
    disabled: preset.disabled,
    loadout: stats.nativeFormStart?.skill || preset.support,
    coreLevels: Object.fromEntries(Object.entries(meta.skills).map(([k, v]) => [k, v.level])),
    stats,
    elite: state.mode === 'elite',
  });
  g.battleId = globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random();
  clearNativeHome();
  settled = false;
  resumeOnClose = false;
  accumulator = 0;
  pointer = null;
  $('game-root').dataset.page = 'combat';
  $('page').innerHTML =
    `<section class="battle-container"><canvas id="battlefield" class="battle-canvas" aria-label="战场，按住拖动集火"></canvas><div class="mini-capsule"><button data-action="pause" aria-label="战斗菜单"></button><button data-action="fullscreen" aria-label="切换全屏"></button></div><div class="battle-hud"><div class="combat-top"><button data-action="pause" aria-label="暂停">Ⅱ</button><span id="combat-time" class="combat-time">00:00</span><b class="combat-title">${esc(g.info.name)}</b><span id="combat-wave" class="combat-wave"></span></div><div class="combat-xp"><i id="xp-fill"></i><span id="combat-xp-text"></span></div></div><div class="combat-left"><div class="combat-energy"><span>ϟ</span> <b id="combat-energy"></b></div><span class="fps" id="fps">FPS:60</span><button class="speed-button" data-action="speed" aria-label="切换战斗倍速">×${meta.speed}</button><button class="combat-icon" data-action="damage" aria-label="伤害统计">▥</button><button class="combat-icon" data-action="help" aria-label="战斗说明">?</button><button class="combat-icon combat-cheats" data-action="cheats" aria-label="畅玩控制台">⚙</button></div><div id="combat-skills" class="combat-skills"></div><div id="combat-ammo" class="combat-ammo"></div><div id="event-objective" class="event-objective"></div><button id="airstrike" class="combat-airstrike" data-action="airstrike" aria-label="空袭">${skillIcon('airdrop')}<b>空袭</b></button><button class="turret-hit turret-left" data-turret="drone" aria-label="左炮塔升级260能量"></button><button class="turret-hit turret-right" data-turret="frost" aria-label="右炮塔升级160能量"></button><div class="combat-health"><i id="hp-fill"></i><span id="hp-text"></span></div><b id="hp-value" class="combat-hp-value"></b><span class="combat-name">${esc(meta.name)}</span><div id="announcement" class="combat-announcement"></div></section>`;
  canvas = $('battlefield');
  renderer = createOriginalRenderer(canvas, g.stats);
  bindPointer();
  start(g);
  audio.unlock();
  audio.setActive(true);
  announce(
    '第1波尸潮',
    g.info.waves + '波坚守 · ' + (g.activity ? '常驻活动' : g.elite ? '精英强袭' : '普通战役'),
  );
  hud();
}
function announce(t, s = '') {
  clearTimeout(announceTimer);
  const el = $('announcement');
  if (!el) return;
  el.innerHTML = esc(t) + `<small>${esc(s)}</small>`;
  el.classList.add('visible');
  announceTimer = setTimeout(() => el.classList.remove('visible'), 1900);
}
function hud() {
  if (!g || !canvas) return;
  Object.assign(canvas.dataset, {
    status: g.status,
    feedbackCount: g.feedbackSequence || 0,
    damageNumbers: g.effects.filter((f) => f.type === 'damage-text').length,
    hitImpacts: g.effects.filter((f) => f.type === 'hit-impact').length,
    visualZones: g.effects.filter((f) => f.visualKey).length,
    level: g.info.level,
    kills: g.kills,
    hp: Math.ceil(g.hp),
    wave: g.wave + 1,
    sourceId: g.info.clientId || 0,
    nativeForm: g.stats.nativeFormStart?.id || 0,
    nativeProcZones: g.nativeProcZones || 0,
    unlimitedFire: Math.max(0, (g.nativeUnlimitedUntil || 0) - g.time),
    gemZones: g.gemProcZones?.length || 0,
    frostbiteStacks: Math.max(0, ...g.enemies.map((e) => e.frostbiteStacks || 0)),
    nativeBuilds: JSON.stringify(g.nativeBuilds || {}),
    ammo: g.magazine?.ammo ?? '',
    reload: g.magazine?.reload ?? '',
    eventMode: g.event?.mode || '',
    mode: g.activity ? 'activity' : g.elite ? 'elite' : 'normal',
  });
  $('combat-time').textContent =
    Math.floor(g.time / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    Math.floor(g.time % 60)
      .toString()
      .padStart(2, '0');
  $('combat-wave').textContent = '第' + (g.wave + 1) + '/' + g.info.waves + '波';
  $('combat-xp-text').textContent = 'Lv.' + g.rank + ' · ' + g.kills + '/' + g.info.count;
  $('xp-fill').style.width = Math.min(100, (g.xp / g.nextXp) * 100) + '%';
  $('combat-energy').textContent = Math.floor(g.energy * 10);
  $('hp-fill').style.width = (g.hp / g.maxHp) * 100 + '%';
  $('hp-text').textContent = Math.ceil(g.hp) + ' / ' + g.maxHp;
  $('hp-value').textContent = Math.floor((g.hp / g.maxHp) * 100) + '%';
  $('airstrike').disabled = g.energy < 100 || g.status !== 'running';
  $('airstrike').style.filter = g.energy < 100 ? 'grayscale(.8) brightness(.65)' : '';
  if ($('combat-ammo'))
    $('combat-ammo').textContent =
      g.magazine?.reload > 0
        ? '换弹中 ' + g.magazine.reload.toFixed(1) + 's'
        : g.magazine
          ? g.magazine.ammo + ' / ' + g.magazine.capacity
          : '';
  if ($('event-objective'))
    $('event-objective').textContent = g.event
      ? g.event.name +
        ' · ' +
        (g.event.seconds
          ? Math.max(0, Math.ceil(g.event.seconds - g.time)) + 's'
          : g.kills + ' 击杀')
      : '';
  const dock = SKILLS.filter((s) => g.weapons[s.id] > 0)
    .map((s) => `<span title="${s.name}">${skillIcon(s.id)}<b>${g.weapons[s.id]}</b></span>`)
    .join('');
  if ($('combat-skills').innerHTML !== dock) $('combat-skills').innerHTML = dock;
}
function pause() {
  if (!g || !['running', 'paused'].includes(g.status) || !$('overlay').hidden) return;
  release();
  modal(
    '战斗暂停',
    `<p class="dialog-sub">第${g.info.level}关 · 第${g.wave + 1}/${g.info.waves}波 · 离开页面会自动暂停</p>${actions(button('继续战斗', 'data-action="close"') + button('设置', 'data-action="menu"', 'secondary-button') + button('返回营地', 'data-action="home"', 'secondary-button'))}`,
    'pause',
  );
  hud();
}
function choices() {
  modal(
    '选择技能',
    `<p class="dialog-sub">等级提升！选择一项本局强化 · Lv.${g.rank}</p><div class="upgrade-options">${g.choices.map((o, i) => `<button class="upgrade-option" data-choice="${o.id}">${NATIVE_ART[CLIENT_NATIVE_BUILDS[o.nativeBuildId]?.Icon] ? `<img src="${NATIVE_ART[CLIENT_NATIVE_BUILDS[o.nativeBuildId].Icon]}" alt="">` : skillIcon(o.skill === 'gun' ? 'grenade' : o.skill || (skillById(o.id) ? o.id : 'grenade'))}<span>${o.kind}</span><b>${o.name}</b><p>${o.desc}</p><small>${i + 1} · ${o.nativeBuildId ? '本分支 ' + o.level + '/' + o.limit + ' 次' : o.level + '/5级'}</small></button>`).join('')}</div>${actions(button('重新抽取（' + (3 - (g.rerolls || 0)) + '/3）', 'data-action="reroll"', 'secondary-button') + button('查看合成公式', 'data-action="skill-recipes"', 'secondary-button'))}`,
    'upgrade',
    { closable: false, pause: false },
  );
}
function damagePanel() {
  modal(
    '伤害统计',
    `<div class="damage-list">${
      Object.entries(g.damageBySkill)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([id, n]) =>
            `<div>${skillIcon(skillById(id) ? id : 'grenade')}<span>${skillById(id)?.name || { gun: '先锋步枪', burn: '持续灼烧', airstrike: '空袭' }[id] || id}</span><b>${shortNumber(n)}</b></div>`,
        )
        .join('') || '<p>开炮后会记录每个技能造成的有效伤害。</p>'
    }</div>`,
    'damage',
  );
}
function result() {
  if (settled) return;
  settled = true;
  const won = g.status === 'won';
  if (won) {
    recordBattle(meta, g);
    if (!g.activity) recordWin(profile, g);
    save();
  }
  const ratio = g.hp / g.maxHp,
    stars = battleStars(g);
  modal(
    won ? '战斗胜利' : '防线失守',
    `<div class="result-stars">${won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '再接再厉'}</div><div class="stat-grid"><div>击退僵尸<b>${g.kills}</b></div><div>完成波次<b>${g.wave + 1}/${g.info.waves}</b></div><div>防线耐久<b>${battleHealthPercent(g)}%</b></div><div>${won ? '金币奖励' : '战斗得分'}<b>${won ? '+' + g.info.reward * 100 : g.score}</b></div></div><p class="dialog-sub">${won ? '奖励已入库，营地宝箱按耐久条件领取。' : '试试升级核心、镶嵌宝石，或使用冻结技能控制尸潮。'}</p>${actions(button(won && !g.activity && g.info.level < CAMPAIGN_LEVEL_COUNT ? '下一关' : '重新挑战', 'data-action="next"') + button('返回营地', 'data-action="home"', 'secondary-button'))}`,
    'result',
    { closable: false, pause: false },
  );
  hud();
}
function bindPointer() {
  canvas.addEventListener('pointerdown', (e) => {
    if (g.status !== 'running' || !$('overlay').hidden) return;
    pointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    aimAt(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) aimAt(e);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
    canvas.addEventListener(ev, release);
}
function aimAt(e) {
  const r = canvas.getBoundingClientRect();
  setAim(
    g,
    ((e.clientX - r.left) / r.width) * 540,
    (((e.clientY - r.top) / r.height) * 1200 - 40) / 1.28,
  );
}
function release() {
  pointer = null;
  if (g) setAim(g, null, null);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    document.body.classList.toggle('immersive');
    toast('已开启沉浸布局，手机也可添加到主屏幕');
  }
  resize();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  audio.unlock();
  if (d.operation) {
    openOperation(d.operation);
    return;
  }
  if (d.operationClose) {
    state.operation = null;
    render();
    return;
  }
  if (d.activityItems) {
    showActivityItems();
    return;
  }
  if (d.boxCatalog) {
    showBoxCatalog(d.boxCatalog);
    return;
  }
  if (d.boxSupply) {
    const r = supplyNativeBox(meta, Number(d.boxSupply), 10);
    if (!r.ok) {
      toast(r.reason);
      return;
    }
    save();
    showBoxCatalog(state.boxCatalogKind || 'choice');
    toast('已领取10个宝箱');
    return;
  }
  if (d.choiceAdjust) {
    const view = state.choiceBox;
    if (!view) return;
    const index = Number(d.choiceAdjust),
      owned = ensureNative(meta).goods[view.id] || 0,
      other = Object.entries(view.allocation).reduce(
        (sum, [k, n]) => sum + (Number(k) === index ? 0 : n),
        0,
      );
    view.allocation[index] = Math.max(
      0,
      Math.min(
        Math.min(owned, BOX_BATCH_LIMIT) - other,
        (view.allocation[index] || 0) + Number(d.delta),
      ),
    );
    showChoiceBox(view.id, view.allocation);
    return;
  }
  if (d.choiceConfirm) {
    const view = state.choiceBox;
    if (!view || view.id !== Number(d.choiceConfirm)) return;
    const r = chooseNativeBox(meta, view.id, view.allocation);
    if (!r.ok) {
      toast(r.reason);
      return;
    }
    state.choiceBox = null;
    save();
    render();
    modal(
      '恭喜获得',
      operationRewardCards(r.rewards) +
        actions(
          button('返回活动道具', 'data-activity-items="1"') + button('关闭', 'data-action="close"'),
        ),
      'operation-reward',
    );
    return;
  }
  if (d.activityItemUse) {
    const r = useActivityItem(meta, Number(d.activityItemUse), Number(d.count) || 1);
    if (!r.ok) {
      toast(r.reason);
      return;
    }
    if (r.chooseBox) {
      showChoiceBox(r.chooseBox);
      return;
    }
    save();
    if (r.operation) {
      close();
      await openOperation(r.operation);
      if (r.exchange) showOperationExchange();
      return;
    }
    render();
    if (r.rewards?.length) operationResult(r.rewards);
    else {
      showActivityItems();
      toast('原生道具效果已应用');
    }
    return;
  }
  if (d.opPointer) {
    if (state.opBusy) return;
    const s = operationState(meta, state.operation);
    s.pointers = Math.max(1, Math.min(3, s.pointers + Number(d.opPointer)));
    save();
    render();
    return;
  }
  if (d.treasureSkip) {
    const s = operationState(meta, 'treasure');
    s.skipAnimation = !s.skipAnimation;
    save();
    render();
    return;
  }
  if (d.opExchange) {
    showOperationExchange();
    return;
  }
  if (d.opExchangeBuy) {
    const r = exchangeOperationReward(meta, state.operation, Number(d.opExchangeBuy));
    if (r.ok) {
      save();
      showOperationExchange();
      toast('已获得 ' + r.reward.nameText + ' ×' + r.reward.count);
    } else toast(r.reason);
    return;
  }
  if (d.bihaiMilestone) {
    const r = claimBihaiMilestone(meta, Number(d.bihaiMilestone));
    if (r.ok) operationResult([r.reward]);
    else toast(r.reason);
    return;
  }
  if (d.starSkip) {
    if (state.opBusy) return;
    const s = operationState(meta, 'xunxing');
    s.skipAnimation = !s.skipAnimation;
    save();
    render();
    return;
  }
  if (d.bihaiSkip) {
    if (state.opBusy) return;
    const s = operationState(meta, 'bihai');
    s.skipAnimation = !s.skipAnimation;
    save();
    render();
    return;
  }
  if (d.opDraw) {
    if (state.opBusy) return;
    state.opBusy = true;
    const id = state.operation,
      initial = ['treasure', 'bihai', 'xunxing'].includes(id)
        ? structuredClone(operationState(meta, id))
        : null,
      rows = drawOperation(meta, id, Number(d.opDraw));
    save();
    document.querySelector('.operation-stage')?.classList.add('spinning');
    document
      .querySelectorAll('[data-op-draw],[data-treasure-batch],[data-treasure-skip]')
      .forEach((b) => (b.disabled = true));
    try {
      if (id === 'treasure') await animateTreasureDraw(rows, initial);
      else if (id === 'xunxing')
        await animateStarDraw(document.querySelector('.star-mode'), rows, initial);
      else if (id === 'bihai')
        await animateBihaiDraw(document.querySelector('.bihai-mode'), rows, initial.skipAnimation);
      else await new Promise((resolve) => setTimeout(resolve, 900));
    } catch (error) {
      console.warn('活动开奖动画中断', error);
    } finally {
      state.opBusy = false;
    }
    if (state.operation === id) {
      audio.ui('reward');
      operationResult(rows);
    }
    return;
  }
  if (d.opEgg) {
    if (d.opEgg === 'claim') {
      showEggChoices();
      return;
    }
    const r = playEgg(meta, d.opEgg === 'protect', undefined, state.operation);
    save();
    render();
    if (r.claimReady) showEggChoices();
    else toast(r.ok ? (r.success ? '升层成功' : '本层受到保护') : r.reason);
    return;
  }
  if (d.opEggChoose !== undefined) {
    const r = claimEgg(meta, Number(d.opEggChoose), state.operation);
    if (r.ok) operationResult([r.reward]);
    else toast(r.reason);
    return;
  }
  if (d.opEggPreview !== undefined) {
    const [floor, index] = d.opEggPreview.split(':').map(Number),
      s = operationState(meta, state.operation),
      reward = eggOptions(floor, state.operation)[index];
    if (!reward) return;
    modal(
      '第' + floor + '层 · ' + reward.nameText,
      operationRewardCards([reward]) +
        (floor === s.floor && eggCanClaim(s)
          ? actions(button('领取此奖励', `data-op-egg-choose="${index}"`))
          : '<p>升至对应层后，可从四项奖励中领取一项。</p>'),
    );
    return;
  }
  if (d.boardPreview) {
    const [type, cell] = d.boardPreview.split(':');
    showBoardPreview(type, Number(cell));
    return;
  }
  if (d.starChoose) {
    const [cell, booty] = d.starChoose.split(':').map(Number),
      r = selectStarReward(meta, cell, booty);
    if (r.ok) {
      save();
      close();
      render();
      toast('月盘自选奖励已保存');
    } else toast(r.reason);
    return;
  }
  if (d.treasureRewards) {
    showTreasureRewards();
    return;
  }
  if (d.treasureBatch) {
    if (state.opBusy) return;
    const s = operationState(meta, 'treasure');
    s.batch = Math.max(1, Math.min(10, s.batch + Number(d.treasureBatch)));
    save();
    render();
    return;
  }
  if (d.treasureSelect) {
    showTreasureSelection(Number(d.treasureSelect), true);
    return;
  }
  if (d.treasurePick !== undefined) {
    if (!state.treasureSelection) return;
    state.treasureSelection.index = Number(d.treasurePick);
    showTreasureSelection(state.treasureSelection.layer);
    return;
  }
  if (d.treasureConfirm) {
    const v = state.treasureSelection;
    if (!v) return;
    const r = selectTreasureReward(meta, v.layer, v.index);
    if (r.ok) {
      save();
      close();
      render();
      toast('本层通关奖励已选定');
    } else toast(r.reason);
    return;
  }
  if (d.treasureLayer) {
    const layer = Number(d.treasureLayer),
      s = operationState(meta, 'treasure');
    if (!s.progress.includes(layer) || s.boardClaimed.includes(layer)) return;
    if (Number.isInteger(s.choices[layer]) && s.choices[layer] >= 0 && s.choices[layer] < 3) {
      const r = claimTreasureLayer(meta, layer, s.choices[layer]);
      if (r.ok) operationResult([r.reward]);
      else toast(r.reason);
      return;
    }
    modal(
      '第' + layer + '层 · 选择一项奖励',
      `<div class="egg-choice-cards">${operationPool('treasure')
        .slice(0, 3)
        .map(
          (r, i) =>
            `<div>${operationRewardCards([r])}${button('领取此奖励', `data-treasure-claim="${layer}:${i}"`)}</div>`,
        )
        .join('')}</div>`,
      'treasure-choice',
    );
    return;
  }
  if (d.treasureClaim) {
    const [layer, index] = d.treasureClaim.split(':').map(Number),
      r = claimTreasureLayer(meta, layer, index);
    if (r.ok) operationResult([r.reward]);
    else toast(r.reason);
    return;
  }
  if (d.treasureTask) {
    const r = claimTreasureTask(meta);
    if (r.ok) operationResult([r.reward]);
    else toast(r.reason);
    return;
  }
  if (d.boardRecords) {
    const s = operationState(meta, state.operation);
    modal(
      '寻星访月 · 开奖记录',
      `<p>累计星盘 ${s.draws} 次 · 第${s.reset + 1}轮 · 以下为最近一次实际获得的奖励：</p>${operationRewardCards(s.last)}<p>最近星盘轨迹：${s.history.join(' → ') || '尚未抽取'}</p>`,
    );
    return;
  }
  if (d.opMilestone) {
    const r = claimOperationMilestone(meta, state.operation);
    if (r.ok) operationResult([r.reward]);
    else toast(r.reason);
    return;
  }
  if (d.opHelp) {
    const o = operation(state.operation);
    modal(
      o.name + ' · 规则',
      `<p style="white-space:pre-line">${esc(operationRules(o.id))}</p><p class="source-label">免费版免除货币消耗，活动永久开放。魔方宝藏采用客户端内置奖池和200幸运值保底；其余活动各有本地主题奖池，线上当期奖池与概率未在安装包中。随机时装、幻形和佣兵碎片从本包可激活配置中抽取。扭蛋本地升层概率为50%，保护三次必升；部分转盘和盲盒保留本地每20次累计奖励，寻宝使用独立的层奖励与10次任务。</p>`,
    );
    return;
  }
  if (d.opPreview !== undefined) {
    const r = operationPool(state.operation)[Number(d.opPreview)];
    const o = operation(state.operation);
    if (!r) return;
    modal(
      r.nameText,
      operationRewardCards([r]) +
        `<p>${r.localPool ? '本地常驻奖池' : `客户端内置参考概率：${r.percent}%`}</p>${['outfit', 'form', 'merc'].includes(r.kind) ? '<p>抽中后将从本包中可激活的对应收藏里随机获得一项。</p>' : ''}${o.mode === 'wheel' ? button('设为自选珍宝', `data-op-select="${d.opPreview}"`) : ''}`,
    );
    return;
  }
  if (d.opSelect) {
    operationState(meta, state.operation).selection = Number(d.opSelect);
    save();
    close();
    render();
    return;
  }
  if (d.growthSupply) {
    grantSupply(meta, 'all');
    save();
    render();
    if (['growth', 'form'].includes(modalType))
      showSelection(state.growthView.type, state.growthView.focus);
    else close();
    toast('原生养成材料已补充，可重复领取');
    return;
  }
  if (d.formFilter !== undefined) {
    state.formFilter = d.formFilter;
    showSelection('forms');
    return;
  }
  if (d.gemTag !== undefined) {
    state.gemTag = d.gemTag;
    state.gemCodexPage = 0;
    showGemCodex();
    return;
  }
  if (d.growthGunView) {
    showSelection('guns', Number(d.growthGunView));
    return;
  }
  if (d.growthGun) {
    growthResult(unlockNativeGun(meta, Number(d.growthGun)), 'guns', Number(d.growthGun));
    return;
  }
  if (d.growthGunUp) {
    growthResult(upgradeNativeGun(meta, Number(d.growthGunUp)), 'guns', Number(d.growthGunUp));
    return;
  }
  if (d.growthTalent) {
    growthResult(upgradeGunSkill(meta), 'guns', state.growthView?.focus);
    return;
  }
  if (d.growthMercView) {
    showSelection('mercenary', Number(d.growthMercView));
    return;
  }
  if (d.growthMerc) {
    growthResult(recruitMercenary(meta, Number(d.growthMerc)), 'mercenary', Number(d.growthMerc));
    return;
  }
  if (d.growthMercUp || d.growthMercQuality) {
    const id = Number(d.growthMercUp || d.growthMercQuality);
    growthResult(upgradeMercenary(meta, id, !!d.growthMercQuality), 'mercenary', id);
    return;
  }
  if (d.growthSkinView) {
    showSelection(d.skinType === '2' ? 'forms' : 'skins', Number(d.growthSkinView));
    return;
  }
  if (d.growthSkinUnset) {
    const id = Number(d.growthSkinUnset),
      a = ensureNative(meta);
    if (a.skinSlots[2] === id) a.skinSlots[2] = 0;
    growthResult({ ok: true }, 'forms', id);
    return;
  }
  if (d.growthSkin || d.growthSkinUp) {
    const id = Number(d.growthSkin || d.growthSkinUp);
    growthResult(
      d.growthSkin ? equipNativeSkin(meta, id) : upgradeNativeSkin(meta, id),
      state.growthView?.type || 'skins',
      id,
    );
    return;
  }
  audio.ui(d.action === 'close' ? 'close' : d.tab ? 'page' : d.draw ? 'reward' : 'click');
  if (d.guildAction) {
    guildAction(d);
    return;
  }
  if (d.cheat) {
    if (CHEAT_FLAGS.includes(d.cheat)) {
      meta.cheats[d.cheat] = !meta.cheats[d.cheat];
      save();
      render();
      showCheats();
    }
    return;
  }
  if (d.nativeEventHelp) {
    const rules = NATIVE_ACTIVITY_RULES[d.nativeEventHelp] || [];
    modal(
      '客户端活动规则',
      `<p class="dialog-sub">以下是参考APK原文；网页版解除其中的日期、次数和开放门槛，不改变已经接入的玩法机制。尚未接通的专属机制保留待办。</p>${rules.map((r) => `<p style="white-space:pre-line;line-height:1.7">${esc(r.text)}</p>`).join('') || '<p>此活动规则正在按客户端配置核对。</p>'}`,
    );
    return;
  }
  if (d.activityType !== undefined) {
    state.activityType = Number(d.activityType);
    state.activityPage = 0;
    render();
    return;
  }
  if (d.activityPage) {
    const count = (state.activities || []).filter(
      (a) => state.activityType === undefined || a.LevelType === state.activityType,
    ).length;
    state.activityPage = Math.max(
      0,
      Math.min(
        Math.max(0, Math.ceil(count / 12) - 1),
        (state.activityPage || 0) + Number(d.activityPage),
      ),
    );
    render();
    return;
  }
  if (d.mazeNode !== undefined) {
    const node = enterMaze(meta, Number(d.mazeNode));
    if (node) {
      save();
      if (node.kind === 'supply') {
        toast('路线补给已到账');
        showMaze();
      } else {
        close();
        const a = (state.activities || []).find((a) => a.LevelType === 8 && a.available);
        if (a) begin(a.LevelID);
      }
    }
    return;
  }
  if (d.eventClaim) {
    toast(claimEventMilestone(meta, d.eventClaim) ? '活动奖励已到账' : '积分不足，通关获得100积分');
    save();
    render();
    return;
  }
  if (d.activity) {
    begin(Number(d.activity));
    return;
  }

  if (d.tab) {
    if (!['shop', 'character', 'core', 'battle', 'base', 'guild', 'journey'].includes(d.tab))
      return;
    state.tab = d.tab;
    state.activityView = false;
    state.editDisabled = false;
    close();
    render();
    if (d.tab === 'guild') refreshGuild();
    if (d.tab === 'journey') openActivities(d.tab);
    return;
  }
  if (d.draw) {
    audio.unlock();
    showDraw(d.draw, Number(d.count));
    return;
  }
  if (d.helpPool) {
    showPool(d.helpPool);
    return;
  }
  if (d.shopTab !== undefined) {
    state.shopTab = Number(d.shopTab);
    render();
    return;
  }
  if (d.inventoryTab !== undefined) {
    state.inventoryTab = Number(d.inventoryTab);
    render();
    return;
  }
  if (d.campaignSupply) {
    openOperation('wheel');
    return;
  }
  if (d.supply || d.grant) {
    const type = d.supply || d.grant || 'all';
    grantSupply(meta, type);
    save();
    render();
    toast('免费补给已到账，可重复领取');
    return;
  }
  if (d.preset !== undefined) {
    meta.preset = Number(d.preset);
    save();
    render();
    toast('已切换方案' + (meta.preset + 1));
    return;
  }
  if (d.gear) {
    showGear(d.gear);
    return;
  }
  if (d.gem) {
    showGem(d.gem);
    return;
  }
  if (d.bagGear) {
    showBagGear(d.bagGear);
    return;
  }
  if (d.refinePart) {
    state.refinePart =
      d.refinePart === 'all'
        ? ''
        : GEAR_SLOTS.some((s) => s.id === d.refinePart)
          ? d.refinePart
          : '';
    showGemRefinePicker();
    return;
  }
  if (d.gemRefine) {
    showGemRefine(
      d.gemRefine,
      d.slot ? { type: 'equipped', slot: d.slot, index: Number(d.index) } : { type: 'inventory' },
    );
    return;
  }
  if (d.refineStart) {
    const v = state.refineView,
      r = rollGemRefine(meta, v.id, v.source);
    if (r.ok) {
      save();
      render();
      audio.ui('refine');
      showGemRefine(r.id, r.source);
      $('dialog').classList.add('refine-flash');
    } else toast(r.reason);
    return;
  }
  if (d.refineFinish) {
    const r = finishGemRefine(meta, d.refineFinish === 'replace');
    if (!r.ok) {
      toast(r.reason);
      return;
    }
    save();
    render();
    if (r.source.type === 'equipped') showSocket(r.source.slot, r.source.index);
    else showGem(r.id);
    toast(d.refineFinish === 'replace' ? '新词条已生效' : '已保留原词条');
    return;
  }
  if (d.socketView) {
    showSocket(d.slot, Number(d.index), d.socketView);
    return;
  }
  if (d.socket) {
    showSocket(d.socket, Number(d.index));
    return;
  }
  if (d.equipGem) {
    const ok = equipGem(meta, d.equipGem, d.slot, Number(d.index));
    if (ok) {
      save();
      render();
      showGear(d.slot);
      toast('镶嵌成功，属性已生效');
    } else toast('宝石数量不足');
    return;
  }
  if (d.unequip) {
    unequipGem(meta, d.unequip, Number(d.index));
    save();
    render();
    showGear(d.unequip);
    return;
  }
  if (d.lock) {
    meta.locked[d.lock] = !meta.locked[d.lock];
    save();
    render();
    showGem(d.lock);
    return;
  }
  if (d.enhance) {
    const r = enhanceGear(meta, d.enhance);
    save();
    render();
    showGear(d.enhance);
    toast(r.ok ? '装备强化成功' : r.reason);
    return;
  }
  if (d.forge) {
    const ok = forgeGear(meta, d.forge);
    save();
    render();
    showGear(d.forge);
    toast(ok ? '装备升阶成功' : '图纸不足或已达30阶');
    return;
  }
  if (d.equipGear) {
    equipGear(meta, d.equipGear);
    save();
    close();
    render();
    toast('已替换装备，旧装备返回背包');
    return;
  }
  if (d.skill) {
    if (state.editDisabled) {
      const ok = setDisabled(meta, d.skill);
      save();
      render();
      if (!ok) toast('最多禁用6种技能');
    } else showSkill(d.skill);
    return;
  }
  if (d.upgradeSkill) {
    let r = { ok: false };
    let count = 0;
    for (let i = 0; i < Math.min(5, Number(d.upgradeCount) || 1); i++) {
      r = upgradeSkill(meta, d.upgradeSkill);
      if (!r.ok) break;
      count++;
    }
    save();
    render();
    showSkill(d.upgradeSkill);
    toast(count ? '核心升级 ' + count + ' 级' : r.reason);
    return;
  }
  if (d.support) {
    if (meta.presets[meta.preset].disabled.includes(d.support)) {
      toast('请先解除该技能禁用');
      return;
    }
    meta.presets[meta.preset].support = d.support;
    save();
    showSkill(d.support);
    toast('已设为开局出战技能');
    return;
  }
  if (d.goShop) {
    state.tab = 'shop';
    state.shopTab = 0;
    close();
    render();
    return;
  }
  if (d.selectType) {
    return;
  }
  if (d.mode) {
    if (d.mode === 'elite' && !profile.stars[profile.selected]) {
      toast('普通通关后开启精英');
      return;
    }
    state.mode = d.mode;
    render();
    return;
  }
  if (d.stageStep) {
    const next = profile.selected + Number(d.stageStep);
    if (next < 1 || next > CAMPAIGN_LEVEL_COUNT) return;
    if (next > profile.unlocked) {
      toast('先通关当前关卡解锁下一关');
      return;
    }
    profile.selected = next;
    state.mode = 'normal';
    save();
    render();
    return;
  }
  if (d.chapter !== undefined) {
    showLevels(Number(d.chapter));
    return;
  }
  if (d.level) {
    const n = Number(d.level);
    if (n >= 1 && n <= profile.unlocked) {
      profile.selected = n;
      state.mode = 'normal';
      save();
      close();
      render();
    }
    return;
  }
  if (d.claim !== undefined) {
    const reward = claimStage(meta, profile.selected, Number(d.claim));
    if (reward) {
      save();
      render();
      modal(
        '通关奖励',
        `<div class="loot-grid single">${lootCard(reward)}</div><p class="dialog-sub">宝石与钻石已入库</p>`,
      );
    } else toast('达成对应血量通关条件后领取，每项限领一次');
    return;
  }
  if (d.nativeGemGrant) {
    const gem = NATIVE_GEMS[d.nativeGemGrant];
    if (gem && nativeGemPlayable(gem)) {
      const id = 'gem-native:' + gem.id;
      meta.inventory[id] = (meta.inventory[id] || 0) + 1;
      save();
      toast('客户端宝石已领取');
    }
    return;
  }
  if (d.gemCodexPart !== undefined) {
    state.gemCodexPart = d.gemCodexPart;
    state.gemCodexPage = 0;
    showGemCodex();
    return;
  }
  if (d.gemCodexPage) {
    state.gemCodexPage = Math.max(0, (state.gemCodexPage || 0) + Number(d.gemCodexPage));
    showGemCodex();
    return;
  }
  if (d.treeSkill) {
    treeView.skill = d.treeSkill;
    treeView.source = 'native';
    treeView.focus = null;
    showSkillTree();
    return;
  }
  if (d.treeSource) {
    treeView.source = d.treeSource;
    showSkillTree();
    return;
  }
  if (d.treeMode) {
    treeView.mode = d.treeMode === 'fusion' ? 'fusion' : 'all';
    showSkillTree();
    return;
  }
  if (d.treeZoom) {
    treeView.zoom = Math.max(50, Math.min(200, treeView.zoom + Number(d.treeZoom)));
    showSkillTree();
    return;
  }
  if (d.treeBuild) {
    const b = CLIENT_BUILD_CATALOG[d.treeBuild];
    if (b) {
      treeView.skill = b.skill;
      treeView.focus = b.id;
      showSkillTree();
    }
    return;
  }
  if (d.choice) {
    if (chooseUpgrade(g, d.choice)) {
      close(true);
      audio.setActive(true);
      audio.sound('upgrade');
      hud();
    }
    return;
  }
  if (d.turret && g?.status === 'running') {
    const id = d.turret,
      cost = id === 'drone' ? 26 : 16;
    if (!g.availableWeapons.some((w) => w.id === id)) {
      toast('当前方案已禁用此技能');
      return;
    }
    if (g.weapons[id] >= 5) {
      toast('炮塔已满级');
      return;
    }
    if (g.energy < cost) {
      toast('能量不足');
      return;
    }
    g.energy -= cost;
    g.weapons[id] = (g.weapons[id] || 0) + 1;
    toast('炮塔升级成功');
    hud();
    return;
  }
  switch (d.action) {
    case 'reroll':
      if (rerollUpgrades(g)) choices();
      break;
    case 'enter':
      enter();
      break;
    case 'reload':
      location.reload();
      break;
    case 'close':
      close();
      break;
    case 'fullscreen':
      fullscreen();
      break;
    case 'menu':
      settings();
      break;
    case 'help':
      help();
      break;
    case 'skill-tree':
      treeView.mode = 'all';
      showSkillTree();
      break;
    case 'skill-recipes':
      treeView.mode = 'fusion';
      treeView.source = 'native';
      showSkillTree();
      break;
    case 'gem-codex':
      showGemCodex();
      break;
    case 'guide-sources':
      modal('攻略与机制对照', guideHTML());
      break;
    case 'music':
      profile.music = !profile.music;
      save();
      audio.unlock();
      settings();
      break;
    case 'sound':
      profile.sound = !profile.sound;
      save();
      settings();
      break;
    case 'lobby':
      location.href = '/games/';
      break;
    case 'free-keys':
      toast('所有钥匙无限，直接点击免费抽取即可');
      break;
    case 'stats':
      showStats();
      break;
    case 'profile':
      modal(
        '指挥官资料',
        `<p class="dialog-sub">等级 ${meta.level} · 战力 ${combatStats(meta).power}</p><label>指挥官昵称<input id="name-input" maxlength="16" value="${esc(meta.name)}"></label>${actions(button('保存昵称', 'data-action="save-name"'))}`,
      );
      break;
    case 'save-name':
      meta.name = $('name-input').value.trim().slice(0, 16) || '指挥官';
      save();
      close();
      render();
      break;
    case 'synthesize': {
      const n = synthesize(meta);
      save();
      render();
      close();
      toast(
        n
          ? '合成成功，获得' + n + '颗更高品质宝石'
          : '客户端宝石按品质配置数量合成，锁定宝石不参与',
      );
      break;
    }
    case 'refine-list':
      showGemRefinePicker();
      break;
    case 'filter':
      modal(
        '背包筛选',
        `<div class="filter-options">${[['', '全部'], ...GEAR_SLOTS.map((s) => [s.id, s.name])].map(([id, n]) => button(n, `data-filter="${id}"`, state.filterSlot === id ? 'active' : '')).join('')}</div>`,
      );
      break;
    case 'forge':
      showGear('helmet');
      break;
    case 'skins':
    case 'mercenary':
    case 'forms':
      showSelection(d.action);
      break;
    case 'guns':
      showSelection('guns');
      break;
    case 'mecha':
    case 'pioneer':
    case 'superweapon':
      modal(
        d.action === 'mecha' ? '机甲支援' : '先锋 / 超武配置',
        `<p>空投轰炸、装甲车、制导激光等支援技能已开放。进入核心选择开局技能，或通过局内升级获得；满级技能有额外范围、冻结或穿透效果。</p>${actions(button('前往核心', 'data-tab="core"'))}`,
      );
      break;
    case 'cards':
      modal(
        '战术卡组',
        `<div class="option-list">${SKILLS.map((s) => `<div class="option-row">${skillIcon(s.id)}<div><b>${s.name}</b><p>持有卡牌 ${meta.skills[s.id].cards}</p></div>${button('升级', `data-skill="${s.id}"`)}</div>`).join('')}</div>`,
      );
      break;
    case 'edit-disabled':
      state.editDisabled = !state.editDisabled;
      render();
      break;
    case 'disable-help':
      modal(
        '禁用技能',
        `<p>编辑时点击技能，可将最多6种技能排除出局内升级池。禁用开局技能会自动选择其他可用技能。5个方案分别保存禁用列表与出战技能。</p>`,
      );
      break;
    case 'preset-help':
      modal(
        '方案配置',
        `<p>点击1—5切换方案；每个方案独立保存出战技能和禁用技能。装备与宝石全局共用，切换方案不会复制道具。</p>`,
      );
      break;
    case 'event-map':
      showMaze();
      break;
    case 'cheats':
      showCheats();
      break;
    case 'activities':
      openActivities('base');
      break;
    case 'cheat-supply':
      grantSupply(meta, 'all');
      save();
      render();
      toast('全套资源已到账');
      break;
    case 'cheat-win':
      if (g && !['won', 'lost'].includes(g.status)) {
        g.spawned = g.kills = g.info.count;
        g.wave = g.info.waves - 1;
        g.enemies = [];
        g.bullets = [];
        if (g.plan) for (const p of g.plan) p.spawned = p.total;
        g.status = 'won';
        g.events.push({ type: 'won' });
        resumeOnClose = false;
        close(true);
      }
      break;
    case 'levels':
      showLevels();
      break;
    case 'start':
      begin();
      break;
    case 'patrol':
      grantSupply(meta, 'all');
      save();
      render();
      modal(
        '巡逻车补给',
        `<p>离线巡逻补给已领取：钻石5000、金币50万、体力1000、锻造图纸100、芯片10。</p><p class="free-note">免费畅玩版可重复领取</p>`,
      );
      break;
    case 'pause':
      pause();
      break;
    case 'home':
      home();
      break;
    case 'next': {
      const activity = g.activity ? g.info.clientId : null,
        n =
          g.status === 'won' && g.info.level < CAMPAIGN_LEVEL_COUNT
            ? g.info.level + 1
            : g.info.level;
      home();
      if (!activity) profile.selected = n;
      save();
      begin(activity);
      break;
    }
    case 'speed':
      meta.speed = meta.speed === 1 ? 1.5 : meta.speed === 1.5 ? 2 : 1;
      save();
      b.textContent = '×' + meta.speed;
      break;
    case 'damage':
      damagePanel();
      break;
    case 'airstrike':
      if (airstrike(g)) {
        announce('空袭支援', '全区域轰炸');
        hud();
      }
      break;
  }
  if (d.filter !== undefined) {
    state.filterSlot = d.filter;
    close();
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea') || e.repeat) return;
  if (e.code === 'Tab' && !$('overlay').hidden) {
    const list = [...$('dialog').querySelectorAll('button:not(:disabled),input,a[href]')];
    if (!list.length) return;
    const first = list[0],
      last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
    return;
  }
  if (e.code === 'KeyF') {
    fullscreen();
    return;
  }
  if (e.code === 'Space' && g?.status === 'running' && $('overlay').hidden) {
    e.preventDefault();
    $('airstrike').click();
  }
  if (['KeyP', 'Escape'].includes(e.code)) {
    if (!$('overlay').hidden) close();
    else pause();
  }
  if (g?.status === 'upgrade' && /^Digit[123]$/.test(e.code))
    $('dialog').querySelectorAll('[data-choice]')[Number(e.code.slice(-1)) - 1]?.click();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    release();
    audio.pause();
    pause();
  } else {
    audio.setHome(meta.entered && !g);
    audio.setActive(g?.status === 'running' && $('overlay').hidden);
  }
});
window.addEventListener('blur', () => {
  release();
  pause();
});
function frame(now) {
  if (ended) return;
  const dt = previous ? Math.min(0.1, (now - previous) / 1000) : 0;
  previous = now;
  if (g) {
    if (g.status === 'running') accumulator += dt * meta.speed;
    else accumulator = 0;
    let safety = 0;
    while (accumulator >= 1 / 60 && g.status === 'running' && safety++ < 12) {
      step(g, 1 / 60);
      accumulator -= 1 / 60;
    }
    for (const ev of g.events.splice(0)) {
      if (['shot', 'boom', 'wallhit', 'upgrade', 'won', 'lost'].includes(ev.type))
        audio.sound(ev.type);
      if (ev.type === 'wave') announce('第' + ev.wave + '波尸潮');
      if (ev.type === 'boss') announce(ev.name, '首领来袭');
    }
    if (g.status === 'upgrade' && !['upgrade', 'skill-tree'].includes(modalType)) choices();
    if (['won', 'lost'].includes(g.status) && !settled) result();
    renderer.draw(g, now / 1000);
    if (now - hudAt > 100) {
      hud();
      $('fps').textContent = 'FPS:' + Math.min(60, Math.round(dt ? 1 / dt : 60));
      hudAt = now;
    }
  }
  raf = requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.visualViewport?.addEventListener('scroll', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('fullscreenchange', resize);
window.addEventListener('pagehide', () => {
  clearNativeForm();
  clearNativeHome();
  renderer?.dispose?.();
  ended = true;
  clearInterval(guildPoll);
  cancelAnimationFrame(raf);
  clearTimeout(toastTimer);
  clearTimeout(announceTimer);
  audio.dispose();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
resize();
audio.setHome(meta.entered);
try {
  render();
} catch (error) {
  meta.entered = false;
  render();
  entryFailure(error);
}
raf = requestAnimationFrame(frame);

function showGemCodex() {
  const slots = { helmet: 1, armor: 2, boots: 3, bracer: 4, pants: 5, gloves: 6 },
    part = state.gemCodexPart || '',
    rows = Object.values(NATIVE_GEMS)
      .filter((g) => !state.gemTag || g.description.includes(state.gemTag))
      .filter((g) => !part || g.part === slots[part]),
    page = Math.min(
      Math.max(0, state.gemCodexPage || 0),
      Math.max(1, Math.ceil(rows.length / 30)) - 1,
    );
  state.gemCodexPage = page;
  modal(
    '宝石属性图鉴',
    `<p class="dialog-sub">参考 APK 共 ${Object.keys(NATIVE_GEMS).length} 条真实宝石配置；${PLAYABLE_GEMS.length} 条已接入实战（修改包测试词条只在图鉴领取），含百分比追加、秒杀、防线免疫、冻伤、燃烧地面等。含命中派生、折射、掉血支援、无限火力与电极联动；2条空白关联已按标注的兼容规则补全。</p><div class="gem-mechanic-tags">${GEM_TAGS.map(([id, label]) => button(label, 'data-gem-tag="' + id + '"', (state.gemTag || '') === id ? 'gold-button' : 'secondary-button')).join('')}</div><div class="gem-codex-tabs">${[['', '全部'], ...GEAR_SLOTS.map((s) => [s.id, s.name])].map(([id, n]) => button(n, 'data-gem-codex-part="' + id + '"', part === id ? 'gold-button' : 'secondary-button')).join('')}</div><div class="native-gem-list">${rows
      .slice(page * 30, page * 30 + 30)
      .map(
        (g) =>
          `<article data-native-gem="${g.id}"><img src="./assets/client-interface/${g.icon}.webp" alt=""><div><b>${esc(g.name)}</b><p>${esc(g.description)}</p>${gemSourceNote(g) ? '<small class="source-note">' + esc(gemSourceNote(g)) + '</small>' : ''}<small>${nativeGemPlayable(g) ? (nativeGemDebug(g) ? '测试词条 · 图鉴领取' : '已接入实战') : '配置参考 · 源配置空白'} · ID ${g.id}</small></div>${nativeGemPlayable(g) ? button('免费领取', 'data-native-gem-grant="' + g.id + '"') : ''}</article>`,
      )
      .join(
        '',
      )}</div>${actions(button('上一页', 'data-gem-codex-page="-1"', 'secondary-button') + '<span>' + (page + 1) + ' / ' + Math.max(1, Math.ceil(rows.length / 30)) + '</span>' + button('下一页', 'data-gem-codex-page="1"', 'secondary-button'))}`,
    'gem-codex',
  );
}

function showMaze() {
  modal(
    '雾境探索路线',
    `<p class="dialog-sub">网页常驻探索：完成战斗解锁下一排相邻区域，宝箱节点即时领取补给。原作机关、随机事件仍在细化。</p><div class="maze-map">${mazeNodes(
      meta,
    )
      .map(
        (n) =>
          `<button data-maze-node="${n.id}" ${n.open ? '' : 'disabled'} class="${n.cleared ? 'cleared' : ''}">${n.cleared ? '✓' : n.kind === 'supply' ? '▣' : n.kind === 'boss' ? '☠' : '⚔'}<small>区域${n.id + 1}</small></button>`,
      )
      .join('')}</div>`,
    'maze',
  );
}

function showActivityItems() {
  const rows = activityItems(meta);
  modal(
    '活动道具',
    `<p class="dialog-sub">读取 APK 道具功能与数量；自选和随机宝箱、随机宝石均按对应源配置处理。</p><button data-box-catalog="choice">自选宝箱 / 随机宝箱补给</button><div class="growth-catalog">${rows.map(({ row: r, count, effect }) => `<article><b>${esc(r.nameText)}</b><small>${esc(effect)} · 拥有 ${count}</small>${button('使用', `data-activity-item-use="${r.ItemID}"`)}${(r.Func.FuncValue === 5 || nativeBoxKind(r.ItemID) === 'random') && count > 1 ? button('使用十个', `data-activity-item-use="${r.ItemID}" data-count="${Math.min(10, count)}"`) : ''}</article>`).join('') || '<p>当前没有可使用的活动道具，可从抽奖或畅玩补给获取。</p>'}</div>`,
    'activity-items',
  );
}

function showBoxCatalog(kind = 'choice') {
  state.boxCatalogKind = kind === 'random' ? 'random' : 'choice';
  modal('宝箱畅玩补给', nativeBoxSupplyView(meta, state.boxCatalogKind), 'box-catalog');
}
function showChoiceBox(id, allocation = {}) {
  const scroll = $('dialog').querySelector('.native-choice-list')?.scrollTop || 0;
  state.choiceBox = { id: Number(id), allocation: { ...allocation } };
  modal(
    '选择道具',
    nativeChoiceBoxView(meta, Number(id), state.choiceBox.allocation),
    'native-choice-box',
  );
  $('dialog').querySelector('.native-choice-list').scrollTop = scroll;
}
document.addEventListener('input', (e) => {
  const index = e.target.dataset?.choiceQuantity,
    view = state.choiceBox;
  if (index === undefined || !view || modalType !== 'native-choice-box') return;
  const other = Object.entries(view.allocation).reduce(
      (sum, [k, n]) => sum + (k === index ? 0 : n),
      0,
    ),
    owned = ensureNative(meta).goods[view.id] || 0,
    n = Math.floor(Number(e.target.value));
  view.allocation[index] = Math.max(
    0,
    Math.min(Math.min(owned, BOX_BATCH_LIMIT) - other, Number.isFinite(n) ? n : 0),
  );
  e.target.value = view.allocation[index];
  const used = Object.values(view.allocation).reduce((a, n) => a + n, 0);
  $('dialog').querySelector('.native-choice-tip').textContent = `已选择 ${used}/${owned}`;
  $('dialog').querySelector('.native-choice-confirm').disabled = !used;
  for (const b of $('dialog').querySelectorAll('[data-choice-adjust]'))
    b.disabled =
      b.dataset.delta === '1'
        ? used >= Math.min(owned, BOX_BATCH_LIMIT)
        : !(view.allocation[b.dataset.choiceAdjust] > 0);
  for (const row of $('dialog').querySelectorAll('[data-choice-row]'))
    row.classList.toggle('selected', view.allocation[row.dataset.choiceRow] > 0);
});
