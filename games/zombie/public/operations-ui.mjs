import { seasonalPrizePoints } from './seasonal-lottery.mjs';
import {
  OPERATIONS,
  operation,
  operationState,
  operationPool,
  operationExchangePool,
  eggOptions,
  BIHAI_THRESHOLDS,
} from './operations.mjs';
import { bihaiSlots } from './bihai-lottery.mjs';
import { eggCanClaim } from './egg-lottery.mjs';
import {
  treasureRings,
  STAR_SMALL,
  STAR_BIG,
  starOptions,
  sourceBoardSlots,
} from './board-lotteries.mjs';
import { NATIVE_OPERATIONS as DATA } from './native-operations-data.mjs';
import { NATIVE_ART } from './native-art-data.mjs';
import { nativeGood, ensureNative } from './native-progression.mjs';
import { resolveNativeLayout } from './native-layout.mjs';
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const art = (name, cls = '') =>
  NATIVE_ART[name] ? `<img class="${cls}" src="${NATIVE_ART[name]}" alt="" draggable="false">` : '';
export const rewardIcon = (r) =>
  r.kind === 'gem' && [5, 6, 7].includes(r.quality)
    ? (!r.gemId && art(nativeGood(70000 + r.quality)?.IconName)) ||
      `<img src="./assets/client-interface/icon_baoshi_${r.quality}.webp" alt="">`
    : r.nameText === '金币'
      ? '<img src="./assets/native-ui/zmzg_icon_dj_qian.webp" alt="">'
      : art(
          r.icon ||
            nativeGood(r.itemId || { 金币: 2, 装备图纸: 50001, 技能手册: 61001 }[r.nameText])
              ?.IconName,
        ) || art('zmzg_mh_icon_jd');
export function operationExchangeView(p, id = 'bihai') {
  const s = operationState(p, id),
    pearl = art(nativeGood(99031).IconName);
  return `<div class="bihai-shop-currency"><b>深海遗珠兑换道具</b>${pearl}<strong>${ensureNative(p).goods[99031] || 0}</strong></div><div class="bihai-shop" aria-label="兑换商品">${operationExchangePool(
    id,
  )
    .map((r) => {
      const good = nativeGood(r.itemId || (r.kind === 'gem' ? 70000 + r.quality : 0)),
        name = good?.nameText || r.nameText;
      return `<div class="bihai-shop-row"><div class="bihai-shop-item" data-quality="${good?.Quality || r.quality || 1}">${rewardIcon(r)}<b>${r.count}</b></div><div class="bihai-shop-info"><b>${esc(name)}</b><div>${pearl}<span>0</span><small>已兑换 ${s.shopCounts[r.offer] || 0} 次</small></div></div><button data-op-exchange-buy="${r.offer}" aria-label="兑换${esc(name)}">兑换</button></div>`;
    })
    .join('')}</div><small class="bihai-shop-note">本地免费兑换 · 不限次数</small>`;
}
let layouts;
export async function loadOperationLayouts() {
  if (!layouts) {
    const r = await fetch(
      new URL('./assets/native-operations/layouts-compact.json', import.meta.url),
    );
    if (!r.ok) throw Error('原生活动布局载入失败');
    layouts = await r.json();
  }
  return layouts;
}
export function operationEntrances(side) {
  const ids = side === 'left' ? OPERATIONS.map((o) => o.id) : [];
  return ids
    .map((id) => {
      const o = operation(id);
      return `<button class="hit operation-entry" data-operation="${id}" aria-label="${o.name}">${art(o.icon) || art('zmzg_zjm_icon_jijialaixi')}<span>${o.name}</span><small>常驻</small></button>`;
    })
    .join('');
}
const style = (n) =>
  Object.entries(n.css)
    .map(([k, v]) => k.replace(/[A-Z]/g, (x) => '-' + x.toLowerCase()) + ':' + v)
    .join(';');
function sourceLayers(page, height) {
  const resolved = resolveNativeLayout(page, { height }),
    byId = new Map(resolved.map((n) => [n.rectId, n])),
    order = [];
  const visit = (id) => {
    const n = byId.get(id);
    if (!n) return;
    order.push(n);
    for (const k of n.children) visit(k);
  };
  for (const id of page.rootRectIds) visit(id);
  const render = (rows) =>
    rows
      .filter(
        (n) =>
          n.active &&
          !/m_goLottery|m_goLock|m_itemReward|m_imgRecieved|m_btn|m_goSpine/.test(n.path),
      )
      .map((n) =>
        n.components
          .filter((c) => c.enabled && (c.sprite || c.texture) && c.kind !== 'text')
          .map(
            (c) =>
              `<img class="native-op-layer" style="${style(n)};opacity:${c.color?.a ?? 1}" src="./assets/native-operations/${c.sprite || c.texture}" alt="" draggable="false">`,
          )
          .join(''),
      )
      .join('');
  return {
    back: render(order.filter((n) => /^[^/]+\/[Bb][Gg]$/.test(n.path))),
    wheel: render(order.filter((n) => n.path.includes('/m_goTurnObj'))),
  };
}

function eggLayers(page, height, id, s) {
  const nodes = resolveNativeLayout(page, { height }),
    node = (name) => nodes.find((n) => n.name === name),
    fest = id === 'festegg';
  const layer = (n) =>
    n.components
      .filter((c) => c.enabled && (c.sprite || c.texture))
      .map(
        (c) =>
          `<img class="native-op-layer" style="${style(n)}" src="./assets/native-operations/${c.sprite || c.texture}" alt="" draggable="false">`,
      )
      .join('');
  const back = nodes
    .filter(
      (n) =>
        n.active &&
        (/\/bgNode\/BG$/.test(n.path) || (/\/bgNode\/Bg$/.test(n.path) && n.width > 700)),
    )
    .map(layer)
    .join('');
  const row = (floor, final = false) =>
    `<div class="egg-native-floor ${s.floor === floor ? 'current' : ''} ${final ? 'egg-final' : ''}" data-egg-floor="${floor}"><div class="egg-native-shelf">${art(final ? (fest ? 'zmzg_dw_djq' : 'zmzg_ndgf_zs01') : fest ? 'zmzg_dw_gb' : 'zmzg_ndgf_zwt')}</div><b class="egg-native-label" style="background-image:url('${NATIVE_ART[fest ? 'zmzg_dw_dp01' : 'zmzg_ndgf_dpz01'] || ''}')">${floor}</b><div class="egg-native-prizes">${eggOptions(
      floor,
      id,
    )
      .map(
        (r, i) =>
          `<button data-op-egg-preview="${floor}:${i}" aria-label="第${floor}层 ${esc(r.nameText)}">${rewardIcon(r)}<b>${r.count}</b></button>`,
      )
      .join('')}</div></div>`;
  const final = node('m_itemLayerFinal'),
    viewport = node('m_scrollViewLayer'),
    random = nodes.find((n) => /\/RoundsRandomNode\/bg$/.test(n.path));
  return {
    back: back + `<div class="egg-native-final" style="${style(final)}">${row(6, true)}</div>`,
    slots: `<div class="egg-scroll" tabindex="0" aria-label="扭蛋楼层奖励" style="${style(viewport)}">${[5, 4, 3, 2, 1, 0].map((n) => row(n)).join('')}</div>${random ? layer(random) : ''}<div class="op-egg-status" style="${random ? style(random) : ''}">第 ${s.round + 1} 轮 · 当前 ${s.floor} 层<br>${s.claimReady ? '降层结束，请选择奖励' : '保护进度 ' + s.protect + '/3'}</div>`,
  };
}

export function treasureBoardView(page, height, s) {
  const nodes = resolveNativeLayout(page, { height }),
    names = ['m_itemFirstNodeRoot', 'm_itemSecNodeRoot', 'm_itemThirdNodeRoot'];
  const ring = treasureRings(s.layer).find((r) => r.id === s.circle),
    slots = sourceBoardSlots(nodes, names[s.circle - 1]);
  const points = ring.cells.map((r, i) => {
    const n = slots[i],
      m = n.cssMatrix;
    return {
      id: r.CellID,
      big: !!r.IsBig,
      x: m[4] + (n.width * m[0]) / 2,
      y: m[5] + (n.height * m[3]) / 2,
    };
  });
  const html = ring.cells
    .map((r, i) => {
      const n = slots[i];
      if (!n) return '';
      const sprite = n.components.find((c) => c.sprite)?.sprite;
      return `<div class="board-cell treasure-cell current-ring ${s.cells.includes(r.CellID) ? 'board-collected' : ''}" style="${style(n)}" data-treasure-cell="${r.CellID}" aria-label="寻宝格${r.CellID}">${sprite ? `<img class="board-frame" src="./assets/native-operations/${sprite}" alt="">` : ''}${r.IsBig ? art('zmzg_mrsl_jiantou', 'treasure-goal-arrow') : ''}</div>`;
    })
    .join('');
  return { html, points };
}
export function treasureView(height, s) {
  return treasureBoardView(layouts.treasurehuntpage, height, s);
}
function boardLayers(page, height, id, s, pool) {
  const nodes = resolveNativeLayout(page, { height });
  if (id === 'treasure') {
    return treasureBoardView(page, height, s).html;
  }
  const render = (rows, group, big) => {
    const slots = sourceBoardSlots(nodes, group);
    return rows
      .map((r, i) => {
        const n = slots[i];
        if (!n) return '';
        const cell = big ? r.BigCellID : r.SmallCellID,
          options = big ? starOptions(cell) : [],
          selected = big ? options.find((x) => x.booty === s.choices[cell]) || options[0] : null,
          prize = pool[big ? selected.poolIndex : (i + 5) % pool.length],
          frame = nodes
            .find((x) => x.path === n.path + '/Bottom/m_imgChose')
            ?.components.find((c) => c.sprite)?.sprite;
        return `<button class="board-cell star-cell ${big ? 'star-big' : 'star-small'} ${(big ? s.big : s.small).includes(cell) ? 'board-collected' : ''}" style="${style(n)}" data-star-cell="${big ? 'big' : 'small'}:${cell}" data-board-preview="${big ? 'star-big' : 'star-small'}:${cell}" aria-label="${big ? '月盘' : '星盘'}${cell} ${esc(prize.nameText)}">${frame ? `<img class="board-frame" src="./assets/native-operations/${frame}" alt="">` : ''}<span class="board-reward">${rewardIcon(prize)}<b>${prize.count}</b></span>${big && r.IsOpt ? '<small>自选</small>' : !big && r.IsSpecialItem ? '<small>触发月盘</small>' : ''}</button>`;
      })
      .join('');
  };
  return (
    render(STAR_BIG, 'm_itemBigAwardItems', true) +
    render(STAR_SMALL, 'm_itemSmallAwardItems', false)
  );
}

function bihaiScreen(page, height, s, pool) {
  const nodes = resolveNativeLayout(page, { height }),
    visual = (n) =>
      n.components
        .filter((c) => c.enabled && (c.sprite || c.texture))
        .map(
          (c) =>
            `<img class="native-op-layer" style="${style(n)}" src="./assets/native-operations/${c.sprite || c.texture}" alt="">`,
        )
        .join('');
  const backgrounds = nodes
    .filter((n) => n.name === 'BG' && /^BiHaiTurnTableUI(?:\/Bottom)?\/BG$/.test(n.path))
    .map(visual)
    .join('');
  const slots = bihaiSlots(page, height),
    tiles = slots
      .map(({ cell, frame, prize }) => {
        const layers = nodes
          .filter(
            (n) =>
              n.active &&
              (n.path === frame.path || n.path.startsWith(frame.path + '/')) &&
              !n.path.includes('/m_tfRewardRoot') &&
              !n.path.includes('/m_tfEffRoot'),
          )
          .map(visual)
          .join('');
        return `<div class="bihai-tile ${cell === 1 ? 'bihai-grand' : ''}" data-bihai-cell="${cell}">${layers}</div><button class="bihai-prize" style="${style(prize)}" data-op-preview="${cell - 1}" aria-label="${esc(pool[cell - 1].nameText)}">${rewardIcon(pool[cell - 1])}<b>${pool[cell - 1].count}</b></button>`;
      })
      .join('');
  const bottom = height - 1334,
    claimed = s.cumulativeClaimed || [];
  return `<section class="screen operations-screen bihai-mode" aria-label="碧海凉夏" data-operation-page="bihai"><div class="operation-stage" style="height:${height}px;--op-offset:${bottom / 2}px">${backgrounds}<div class="bihai-title">碧海凉夏<small>永久开放 · 本地免费奖池</small></div><button class="op-help" data-op-help="1" aria-label="活动规则">?</button><button class="bihai-exchange" data-op-exchange="1">${art('zmzg_bhlx_duihuanlihe')}<b>兑换</b></button><div class="bihai-luck">${s.luck}/200幸运值${art('zmzg_bhlx_xingyunzhi')}</div>${tiles}<div class="bihai-cumulative" style="top:${842 + bottom}px"><b>本期累计抽奖${s.draws}次</b><div class="bihai-progress-track">${art('zmzg_bhlx_jindutiao_01')}<i style="width:${Math.min(100, s.draws / 2)}%"></i></div><div class="bihai-boxes">${BIHAI_THRESHOLDS.map((n) => `<button data-bihai-milestone="${n}" class="${s.draws >= n ? 'available' : ''}" aria-label="累计${n}次奖励" ${claimed.includes(n) ? 'disabled' : ''}>${art(nativeGood(100002).IconName)}<span>${claimed.includes(n) ? '已领取' : n}</span></button>`).join('')}</div></div><button class="treasure-skip" style="bottom:284px" data-bihai-skip="1" aria-pressed="${!!s.skipAnimation}"><i>${s.skipAnimation ? '✓' : ''}</i>跳过动画</button><div class="op-buttons"><button data-op-draw="1">免费</button><button data-op-draw="10">免费抽10次</button></div><button class="op-back" data-operation-close="1" aria-label="返回主页">${art('com_btn_fh')}</button><div class="op-current-activity">${art('zmzg_zjm_icon_bihailiangxia')}<b>碧海凉夏</b></div></div></section>`;
}

function operationContent(p, id) {
  const o = operation(id),
    s = operationState(p, id),
    pool = operationPool(id),
    page = layouts?.[o.page];
  if (!page) return '<section class="screen"><p>载入原生界面…</p></section>';
  const height =
      typeof document === 'undefined'
        ? 1334
        : Math.max(
            1334,
            parseFloat(document.getElementById('game-root').style.height) / 1.44 || 1334,
          ),
    offset = (height - 1334) / 2;
  const layers = sourceLayers(page, height);
  let source = layers.back,
    wheel = layers.wheel,
    hub = '';
  let slots = '';
  if (o.mode === 'bihai') return bihaiScreen(page, height, s, pool);
  if (o.ui) {
    const ui = DATA.ui.TurnTabPageUIConfig.find((r) => r.ID === o.ui);
    const bg = NATIVE_ART[ui.BgIcon] || NATIVE_ART['zmzg_wdtm_bg01'];
    source = `${art(ui.BgIcon, 'op-full-bg') || `<img class="op-full-bg" src="${bg}" alt="">`}${art(ui.PointIcon, 'op-season-pointer')}`;
    wheel = `${art(ui.ItemBgIcon, 'op-season-wheel')}${art(ui.LunPanXinIcon, 'op-season-center')}`;
  }
  if (o.mode === 'egg') {
    const egg = eggLayers(page, height, id, s);
    source = egg.back;
    slots = egg.slots;
  } else if (o.mode === 'treasure' || o.mode === 'star') {
    wheel = '';
    slots = boardLayers(page, height, id, s, pool);
  } else if (o.mode === 'box') {
    slots = `<div class="op-box-show">${art('zmzg_mh_box')}<b>魔方宝藏</b><p>幸运值 ${s.luck}/200</p><div class="op-progress"><i style="width:${s.luck / 2}%"></i></div></div><div class="op-box-pool">${pool.map((r) => `<div>${rewardIcon(r)}<small>${esc(r.nameText)} ×${r.count}</small></div>`).join('')}</div>`;
  } else {
    const seasonal = o.ui ? seasonalPrizePoints(resolveNativeLayout(page, { height })) : [];
    const sourceNodes = resolveNativeLayout(page, { height }).filter((n) =>
      /^m_itemChildNode(?: \(\d+\))?$/.test(n.name),
    );
    slots = pool
      .map((r, i) => {
        let x, y;
        if (seasonal.length === pool.length) {
          ({ x, y } = seasonal[i]);
        } else if (sourceNodes.length === 12 && !o.ui) {
          const n = sourceNodes[i];
          x = n.cssMatrix[4] + (n.width * n.cssMatrix[0]) / 2;
          y = n.cssMatrix[5] + (n.height * n.cssMatrix[3]) / 2;
        } else {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / pool.length;
          x = 375 + 255 * Math.cos(a);
          y = 590 + offset + 255 * Math.sin(a);
        }
        return `<button class="op-wheel-prize ${s.last.at(-1)?.slot === r.slot ? 'won' : ''} ${o.ui && s.taken.includes(r.slot) ? 'collected' : ''}" style="left:${x}px;top:${y}px" data-op-preview="${i}" aria-label="${esc(r.nameText)}">${rewardIcon(r)}<span>${esc(r.nameText)}</span><b>×${r.count}</b></button>`;
      })
      .join('');
    hub = `<div class="op-wheel-hub">${art('zmzg_mh_icon_jd')}<strong>${s.luck}</strong><small>幸运值</small></div>`;
  }
  const buttons = o.ui
    ? `<div class="op-pointer-select"><span>指针数量</span><button data-op-pointer="-1" aria-label="减少指针" ${s.pointers === 1 ? 'disabled' : ''}>−</button><b>${s.pointers}</b><button data-op-pointer="1" aria-label="增加指针" ${s.pointers === 3 ? 'disabled' : ''}>＋</button></div><button data-op-draw="${s.pointers}">免费转动</button>`
    : o.mode === 'egg'
      ? `<button data-op-egg="free" ${s.claimReady || s.floor === 6 ? 'disabled' : ''}>免费抽取</button><button data-op-egg="protect" ${s.claimReady || s.floor === 6 ? 'disabled' : ''}>保护抽取</button>`
      : o.mode === 'treasure'
        ? `<div class="treasure-batch"><span>寻宝次数</span><button data-treasure-batch="-1" aria-label="减少寻宝次数" ${s.batch === 1 ? 'disabled' : ''}>−</button><b>${s.batch}</b><button data-treasure-batch="1" aria-label="增加寻宝次数" ${s.batch === 10 ? 'disabled' : ''}>＋</button></div><button data-op-draw="${s.batch}">免费寻${s.batch}次</button>`
        : o.mode === 'star'
          ? '<button data-op-draw="1">免费抽一次</button><button data-op-draw="7">免费连抽至月盘</button>'
          : `<button data-op-draw="1">免费抽一次</button><button data-op-draw="${o.mode === 'box' ? 5 : 10}">免费抽${o.mode === 'box' ? 5 : 10}次</button>`;
  const counter =
    o.mode === 'treasure'
      ? `第 ${s.layer}/20 层 · 第 ${s.circle}/${treasureRings(s.layer).length} 环 · 已寻宝 ${s.draws} 次`
      : o.mode === 'star'
        ? `第 ${s.reset + 1} 轮 · 已获月盘 ${s.big.length}/7 · 已抽 ${s.draws} 次`
        : (o.ui ? '第 ' + (s.round + 1) + ' 轮 · ' : '') +
          '已抽 ' +
          s.draws +
          ' 次' +
          (o.mode === 'box' ? ' · ' + (200 - s.luck) + '次内必得魔方核心' : '');
  const milestone =
    o.mode === 'treasure'
      ? `<div class="treasure-stage-header"><button class="treasure-stage-choice" data-treasure-select="${s.layer}" aria-label="选择本层通关奖励">${Number.isInteger(s.choices[s.layer]) && s.choices[s.layer] >= 0 && s.choices[s.layer] < 3 ? rewardIcon(pool[s.choices[s.layer]]) : '＋'}</button><b>第${s.layer}层通关奖励</b><button data-treasure-rewards="1">奖励总览${s.progress.length > s.boardClaimed.length ? ' •' : ''}</button></div>`
      : o.mode === 'star'
        ? '<button class="op-milestone" data-board-records="1">开奖记录</button>'
        : `<button class="op-milestone" data-op-milestone="1">累计奖励 ${s.draws}/${(s.claimed + 1) * 20}</button>`;
  return `<section class="screen operations-screen ${o.mode === 'egg' ? 'egg-mode' : o.mode === 'treasure' || o.mode === 'star' ? 'board-mode ' + o.mode + '-mode' : ''}" aria-label="${o.name}" data-operation-page="${id}"><div class="operation-stage" style="height:${height}px;--op-offset:${offset}px">${source}<div class="op-native-rotor">${wheel}${slots}</div>${o.mode === 'treasure' ? '<canvas class="treasure-player" aria-label="寻宝僵尸动画"></canvas>' : ''}${o.mode === 'treasure' ? `<button class="treasure-skip" data-treasure-skip="1" aria-pressed="${!!s.skipAnimation}"><i>${s.skipAnimation ? '✓' : ''}</i>跳过动画</button>` : ''}${o.mode === 'star' ? `<div class="star-transition-flare" aria-hidden="true"></div><button class="treasure-skip star-skip" data-star-skip="1" aria-pressed="${!!s.skipAnimation}"><i>${s.skipAnimation ? '✓' : ''}</i>跳过动画</button>` : ''}${hub}<div class="op-title">${o.name}<small>永久开放 · 免费不限次数</small></div><div class="op-counter">${counter}</div><div class="op-buttons">${buttons}</div>${o.mode === 'egg' ? `<button class="op-egg-claim" data-op-egg="claim" ${eggCanClaim(s) ? '' : 'disabled'}>第${s.floor}层奖励 · 四选一</button>` : ''}<button class="op-back" data-operation-close="1" aria-label="返回主页">${art('com_btn_fh')}<span>返回</span></button><button class="op-help" data-op-help="1" aria-label="活动规则">?</button>${milestone}<div class="op-current-activity">${art(o.id === 'treasure' ? 'zmzg_mrsl_icon_title' : o.icon)}<b>${o.name}</b></div><div class="op-source-note" hidden>${id === 'box' ? '客户端内置魔方奖池' : '本地常驻主题奖池，非线上当期概率'} · APK 界面素材</div></div></section>`;
}
export const operationRewardCards = (rows) =>
  `<div class="op-reward-cards">${rows.map((r) => `<div>${rewardIcon(r)}<b>${esc(r.nameText)}</b><span>×${r.count}</span>${r.description ? `<small>${esc(r.description)}</small>` : ''}</div>`).join('')}</div>`;

export function operationScreen(p, id) {
  return operationContent(p, id).replace(
    '<button class="op-back"',
    '<button class="op-items" data-activity-items="1" aria-label="活动道具和宝箱">道具</button><button class="op-back"',
  );
}
