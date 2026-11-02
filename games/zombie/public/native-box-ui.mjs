import { ensureNative, nativeGood, nativeGoodCount } from './native-progression.mjs';
import {
  nativeBoxOptions,
  nativeBoxCatalog,
  nativeBoxArt,
  BOX_BATCH_LIMIT,
} from './native-boxes.mjs';
import { NATIVE_ART } from './native-art-data.mjs';
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const icon = (r) => {
  const src = nativeBoxArt(r.IconName) || NATIVE_ART[r.IconName];
  return src
    ? `<img src="${esc(src)}" alt="">`
    : '<span class="native-box-placeholder" aria-label="包内未提供图标">箱</span>';
};
export function nativeChoiceBoxView(p, id, allocation = {}) {
  const good = nativeGood(id),
    owned = nativeGoodCount(p, id),
    options = nativeBoxOptions(id),
    used = Object.values(allocation).reduce((a, n) => a + n, 0),
    a = ensureNative(p);
  return `<div class="native-choice-box" data-box-id="${id}"><div class="native-choice-list">${options
    .map((r) => {
      const g = nativeGood(r.itemId),
        qty = allocation[r.index] || 0,
        active = g.Func?.FuncValue === 7 && a.skins[g.Func.ArrFuncParam[0]];
      return `<article class="native-choice-row ${qty ? 'selected' : ''}" data-choice-row="${r.index}"><div class="native-choice-icon">${icon(g)}</div><div class="native-choice-info"><b>${esc(r.nameText)}</b><span>×${r.count}</span>${active ? '<small>该外观已激活</small>' : ''}</div><div class="native-choice-quantity"><button data-choice-adjust="${r.index}" data-delta="-1" aria-label="减少${esc(r.nameText)}数量" ${qty ? '' : 'disabled'}></button><input aria-label="${esc(r.nameText)}数量" type="number" inputmode="numeric" min="0" max="${Math.min(owned, BOX_BATCH_LIMIT)}" value="${qty}" data-choice-quantity="${r.index}"><button data-choice-adjust="${r.index}" data-delta="1" aria-label="增加${esc(r.nameText)}数量" ${used >= Math.min(owned, BOX_BATCH_LIMIT) ? 'disabled' : ''}></button></div></article>`;
    })
    .join(
      '',
    )}</div><div class="native-choice-footer"><p class="native-choice-tip" role="status">已选择 ${used}/${owned}</p><button class="native-choice-confirm" data-choice-confirm="${id}" ${used ? '' : 'disabled'}>确定</button><small>每次最多使用${BOX_BATCH_LIMIT}个，未选择的不消耗</small></div><span class="native-choice-box-name" hidden>${esc(good.nameText)}</span></div>`;
}
export function nativeBoxSupplyView(p, kind = 'choice') {
  const rows = nativeBoxCatalog(kind);
  return `<p class="dialog-sub">畅玩补给 · 免费不限次。候选奖励读取 APK 配置，不与原服账户互通。</p><div class="native-box-tabs"><button data-box-catalog="choice" aria-pressed="${kind === 'choice'}">自选宝箱（19）</button><button data-box-catalog="random" aria-pressed="${kind === 'random'}">随机宝箱（162）</button></div><div class="native-box-catalog">${rows.map((r) => `<article><div>${icon(r)}</div><section><b>${esc(r.nameText)}</b><small>拥有 ${nativeGoodCount(p, r.ItemID)} · ${nativeBoxOptions(r.ItemID).length}项候选</small><button data-box-supply="${r.ItemID}">领取10个</button><button data-activity-item-use="${r.ItemID}" ${nativeGoodCount(p, r.ItemID) ? '' : 'disabled'}>${kind === 'choice' ? '选择奖励' : '开启'}</button></section></article>`).join('')}</div>`;
}
