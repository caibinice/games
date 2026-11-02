import { CLIENT_SKILL_RULES as S } from './client-skill-data.mjs';
import { CLIENT_NATIVE_BUILDS as RAW } from './native-skill-extra.mjs';
import {
  BRANCH_FAMILIES,
  NATIVE_BUILD_CATALOG as C,
  buildCount,
  buildEligible,
} from './client-builds.mjs';
import { esc, skillIcon } from './screens.mjs';

const seconds = (n) => Number(n.toFixed(2)) + ' 秒';
const title = (id) => C[id]?.name || RAW[id]?.name || 'Build ' + id;
function condition(c) {
  if (c.Type === 2)
    return c.Param2 > 0 ? `${title(c.Param1)} ×${c.Param2}` : `${title(c.Param1)}（源配置数量为0）`;
  if (c.Type === 1) return `拥有宝石效果 ${c.Param1}`;
  if (c.Type === 3) return `枪械天赋 ≥${c.Param1}级`;
  if (c.Type === 4)
    return `${Object.values(S).find((s) => s.id === c.Param1)?.name || '核心 ' + c.Param1}核心 ≥${c.Param2}级`;
  if (c.Type === 7) return `枪械等级 ≥${c.Param2}`;
  if (c.Type === 11 || c.Type === 12)
    return `类型 ${c.Type}（${c.Param1}/${c.Param2}；本 APK 条件分支未处理）`;
  return `条件 ${c.Type}：${c.Param1}/${c.Param2}`;
}
export const isFusionRecipe = (b) =>
  !b.main &&
  b.requires.some((c) => c.Type === 2 && c.Param2 > 0) &&
  (b.add.length > 0 ||
    b.remove.length > 0 ||
    b.requires.filter((c) => c.Type === 2 && c.Param2 > 0).length > 1);
export const fusionFormula = (b) =>
  b.requires.filter((c) => c.Type === 2 && c.Param2 > 0).map(condition);
export function skillCodex(
  { skill = 'frost', source = 'native', zoom = 100, focus = null, mode = 'all' } = {},
  game = null,
) {
  const rule = skill === 'gun' ? { name: '枪械' } : S[skill] || S.frost,
    all = Object.values(C).filter((b) => b.skill === skill),
    branches = mode === 'fusion' ? all.filter(isFusionRecipe) : all,
    live = skill === 'gun' || BRANCH_FAMILIES.includes(skill);
  const tabs = [['gun', { name: '枪械' }], ...Object.entries(S)];
  return `<p class="dialog-sub">满足前置后，质变词条才会进入局内随机选项；前置不会作为材料被消耗。本页以当前 APK 配置为准，网友公式可能属于其他版本。</p><div class="codex-sources"><button data-tree-source="native" class="${source === 'native' ? 'selected' : ''}">APK 配置</button><button data-tree-source="community" class="${source === 'community' ? 'selected' : ''}">网友前置图</button></div>${
    source === 'community'
      ? `<div class="codex-zoom"><button data-tree-zoom="-25" aria-label="缩小升级图">−</button><b>${zoom}%</b><button data-tree-zoom="25" aria-label="放大升级图">＋</button></div><div class="codex-image-scroll"><img style="width:${(1000 * zoom) / 100}px" src="./assets/client-skills/community-prerequisites.jpg" alt="用户提供的网友技能升级前置图，含原作者水印"></div>`
      : `<div class="codex-tabs">${tabs.map(([id, s]) => `<button data-tree-skill="${id}" class="${id === skill ? 'selected' : ''}">${id === 'gun' ? '<img src="./assets/native-operations/images/icon_wuqi_AK47.webp" alt="">' : skillIcon(id)}${esc(s.name)}</button>`).join('')}</div><div class="codex-modes"><button data-tree-mode="all" class="${mode === 'all' ? 'selected' : ''}">全部分支</button><button data-tree-mode="fusion" class="${mode === 'fusion' ? 'selected' : ''}">合成 / 质变公式</button></div><section class="codex-summary"><b>${esc(rule.name)}</b><span>${skill === 'gun' ? '枪械天赋会影响可选词条' : `基础冷却 ${seconds(rule.cooldown)} · 最低冷却 ${seconds(rule.minCooldown)}`}</span><small>${branches.length} 个${mode === 'fusion' ? '合成 / 质变' : '配置'}分支 · ${live ? '已接入局内升级池' : '当前为配置图鉴，战斗分支继续接入中'}</small></section><div class="codex-builds">${
          branches
            .map((b) => {
              const count = game ? buildCount(game, b.id) : 0,
                eligible = game && live && buildEligible(game, b),
                formula = fusionFormula(b);
              return `<article class="codex-build ${live ? 'implemented' : 'reference'} ${focus === b.id ? 'focused' : ''}" data-codex-build="${b.id}"><button data-tree-build="${b.id}"><b>${esc(b.name)}</b><small>${live ? (game ? (count ? '本局已选 ×' + count : eligible ? '当前可出现' : '等待前置') : '局内分支') : '配置参考'} · 上限 ${b.limit} 次</small></button>${mode === 'fusion' ? `<div class="codex-formula"><strong>${formula.map(esc).join(' + ') || '满足源配置条件'}</strong><i>→</i><strong>${esc(b.name)}</strong></div>` : ''}<p>${esc(b.description)}</p><div><strong>前置</strong>${b.requires.length ? b.requires.map((c) => `<span>${esc(condition(c))}</span>`).join('') : '<span>无额外前置</span>'}</div>${b.conflicts.length ? `<div class="codex-conflict"><strong>互斥</strong>${b.conflicts.map((c) => `<span>${esc(condition(c))}</span>`).join('')}</div>` : ''}<small class="source-label">Build ${b.id} · 权重 ${b.weight} · 本包版本</small></article>`;
            })
            .join('') || '<p>此类别暂无已确认的合成分支。</p>'
        }</div>`
  }`;
}
