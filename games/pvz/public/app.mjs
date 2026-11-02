import {
  createGame,
  start,
  step,
  togglePause,
  plant,
  shovel,
  collectAt,
  plantInfo,
  cellAt,
  PLANTS,
  CHAPTERS,
  WIDTH,
  HEIGHT,
} from './engine.mjs';
import { defaultProfile, parseProfile, recordWin, SAVE_KEY } from './profile.mjs';
import { createRenderer } from './render.mjs';
import { plantIcon } from './art.mjs';
import { createAudio } from './audio.mjs';
const $ = (id) => document.getElementById(id);
let profile = defaultProfile();
try {
  profile = parseProfile(localStorage.getItem(SAVE_KEY));
} catch {}
let g = makeGame(),
  selected = null,
  lastStatus = '',
  lastHud = 0,
  previous = 0,
  raf,
  ended = false,
  modalType = '',
  resumeOnClose = false,
  toastTimer,
  announceTimer,
  tab = 0;
const canvas = $('garden'),
  renderer = createRenderer(canvas, $('entity-layer')),
  audio = createAudio(profile),
  modal = $('modal');
function makeGame() {
  return createGame({ level: profile.selected, autoCollect: profile.autoCollect });
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch {
    toast('浏览器存档未写入，本局仍可继续');
  }
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2000);
}
function announce(text, sub = 'THE ZOMBIES ARE COMING!') {
  clearTimeout(announceTimer);
  $('announcement').innerHTML = text + '<small>' + sub + '</small>';
  $('announcement').classList.add('visible');
  announceTimer = setTimeout(() => $('announcement').classList.remove('visible'), 2400);
}
function refreshMenu() {
  $('selected-label').textContent = String(profile.selected).padStart(2, '0');
  $('level-label').textContent = String(profile.selected).padStart(2, '0') + ' / 50';
  $('chapter-label').textContent =
    '0' +
    (Math.floor((profile.selected - 1) / 10) + 1) +
    ' / ' +
    CHAPTERS[Math.floor((profile.selected - 1) / 10)].sub;
  $('music').classList.toggle('off', !profile.music);
  $('music').setAttribute('aria-pressed', String(profile.music));
  $('auto-sun').setAttribute('aria-pressed', String(profile.autoCollect));
}
function prepareBoard() {
  const available = PLANTS.filter((p) => p.unlock <= g.info.level);
  $('seed-bank').innerHTML = available
    .map(
      (p, i) =>
        `<button class="seed" data-seed="${p.id}" title="${p.name} · ${p.cost}阳光 · ${p.desc}" aria-label="${p.name}，${p.cost}阳光"><span>${p.name}</span>${plantIcon(p.id)}<b>${p.cost}</b><em></em></button>`,
    )
    .join('');
  $('garden-cells').style.gridTemplateRows = `repeat(${g.info.rows},1fr)`;
  $('garden-cells').innerHTML = Array.from(
    { length: g.info.rows * 9 },
    (_, i) =>
      `<button class="cell" role="gridcell" data-row="${Math.floor(i / 9)}" data-col="${i % 9}" aria-label="第${Math.floor(i / 9) + 1}行第${(i % 9) + 1}列种植"></button>`,
  ).join('');
}
function refreshHud() {
  canvas.dataset.status = g.status;
  canvas.dataset.level = g.info.level;
  canvas.dataset.sun = g.sun;
  canvas.dataset.plants = g.plants.length;
  canvas.dataset.kills = g.kills;
  canvas.dataset.rows = g.info.rows;
  canvas.dataset.spawned = g.spawned;
  $('sun-value').textContent = g.sun;
  for (const b of $('seed-bank').children) {
    const p = plantInfo(b.dataset.seed),
      cd = g.cooldowns[p.id];
    b.classList.toggle('selected', selected === p.id);
    b.classList.toggle('cooling', cd > 0.05);
    b.classList.toggle('unaffordable', g.sun < p.cost);
    b.style.setProperty('--cool', Math.min(100, (cd / p.cooldown) * 100) + '%');
    b.querySelector('em').textContent = cd > 0.05 ? Math.ceil(cd) + 's' : '';
    b.setAttribute('aria-pressed', String(selected === p.id));
  }
  $('shovel').classList.toggle('active', selected === 'shovel');
  $('selection-label').textContent =
    selected === 'shovel'
      ? '铲子已拿起 · 点一下移除植物'
      : selected
        ? plantInfo(selected).name + ' · ' + plantInfo(selected).cost + ' 阳光 · 点击格子种植'
        : '选一张植物卡，再点草坪种植';
  const pct = (g.spawned / g.info.count) * 100;
  $('wave-fill').style.width = pct + '%';
  $('wave-label').textContent = g.spawned
    ? `第 ${g.rank} / ${g.info.waves} 波 · 击退 ${g.kills}`
    : `准备种植 · ${Math.max(0, Math.ceil(g.spawnClock))}s`;
}
function showModal(type, html, { pause = true } = {}) {
  const resume = resumeOnClose || (pause && g.status === 'running');
  if (modal.open) modal.close();
  if (pause && g.status === 'running') togglePause(g);
  resumeOnClose = resume;
  modalType = type;
  $('modal-body').innerHTML = html;
  modal.showModal();
  audio.setActive(false);
}
function closeModal() {
  modal.close();
  modalType = '';
  if (resumeOnClose && g.status === 'paused') togglePause(g);
  resumeOnClose = false;
  audio.setActive(g.status === 'running');
}
const closeButton = () => '<button class="modal-close" data-close aria-label="关闭">×</button>';
function goHome() {
  closeModal();
  g = makeGame();
  selected = null;
  lastStatus = '';
  refreshMenu();
  prepareBoard();
  $('announcement').classList.remove('visible');
}
function begin() {
  closeModal();
  g = makeGame();
  selected = null;
  lastStatus = '';
  prepareBoard();
  start(g);
  audio.unlock();
  audio.setActive(true);
  announce('准备，安放，植物！', 'READY, SET, PLANT!');
  if (g.info.theme.pool) toast('水道种植前先放睡莲');
  if (g.info.theme.roof) toast('屋顶前三列已备好花盆');
}
function openPause() {
  if (modal.open || !['running', 'paused'].includes(g.status)) return;
  showModal(
    'pause',
    `${closeButton()}<span class="eyebrow">A LITTLE GARDEN BREAK</span><h2>花园休息一下。</h2><p class="modal-sub">阳光、种子冷却和僵尸都已暂停，回来再继续守护小院。</p><div class="modal-actions"><button class="primary" data-resume>继续守护</button><button class="secondary" data-home>返回花园</button></div>`,
  );
}
function levelModal(chapter = tab) {
  tab = chapter;
  showModal(
    'levels',
    `${closeButton()}<span class="eyebrow">ADVENTURE / 50 LEVELS</span><h2>下一站，哪片花园？</h2><p class="modal-sub">按顺序解锁 50 关。新的植物会随冒险加入，每十关迎战巨人僵尸。</p><div class="chapter-tabs">${CHAPTERS.map((c, i) => `<button data-tab="${i}" class="${i === tab ? 'active' : ''}">${c.name}</button>`).join('')}</div><div class="level-grid">${Array.from(
      { length: 10 },
      (_, i) => {
        const n = tab * 10 + i + 1;
        return `<button class="level-button ${n === profile.selected ? 'current' : ''}" data-level="${n}" ${n > profile.unlocked ? 'disabled' : ''}><b>${Math.floor((n - 1) / 10) + 1}-${((n - 1) % 10) + 1}</b><small>${profile.stars[n] ? '★'.repeat(profile.stars[n]) : n > profile.unlocked ? '未解锁' : '待冒险'}</small></button>`;
      },
    ).join('')}</div>`,
  );
}
function result() {
  const won = g.status === 'won';
  if (won) {
    recordWin(profile, g);
    save();
    refreshMenu();
  }
  const left = g.mowers.filter((m) => m.status === 'ready').length;
  showModal(
    'result',
    `<span class="eyebrow">${won ? 'YOUR LAWN IS SAFE' : 'THEY GOT INTO THE HOUSE'}</span><h2>${won ? (g.info.level === 50 ? '整个花园，都守住啦！' : '今天的小院，平安无事。') : '僵尸溜进屋里了！'}</h2><p class="modal-sub">${won ? (g.info.level === 50 ? '50 关冒险全部完成。谢谢你，了不起的园丁。' : '给植物浇点水，下一片花园也需要你。') : '早点种下向日葵，补齐每条防线，坚果和一次性植物也很关键。'}</p><div class="result-stars">${won ? '★'.repeat(profile.stars[g.info.level]) + '☆'.repeat(3 - profile.stars[g.info.level]) : '☁'}</div><div class="result-stats"><div><b>${g.kills}</b><small>击退僵尸</small></div><div><b>${left} / ${g.info.rows}</b><small>保留割草机</small></div><div><b>${Math.floor(g.time / 60)}:${String(Math.floor(g.time % 60)).padStart(2, '0')}</b><small>守护时间</small></div></div><div class="modal-actions"><button class="primary" data-next>${won && g.info.level < 50 ? '继续冒险 →' : '再来一次'}</button><button class="secondary" data-home>返回花园</button></div>`,
    { pause: false },
  );
}
function chooseSeed(id) {
  if (g.status !== 'running') return;
  if (id === 'shovel') {
    selected = selected === 'shovel' ? null : 'shovel';
    refreshHud();
    return;
  }
  const p = plantInfo(id);
  if (!p) return;
  if (g.cooldowns[id] > 0.05) {
    toast(p.name + '冷却中');
    return;
  }
  if (g.sun < p.cost) {
    toast('阳光不足，先收集阳光');
    return;
  }
  selected = selected === id ? null : id;
  refreshHud();
}
function point(e) {
  const r = canvas.getBoundingClientRect(),
    rotated = matchMedia('(orientation:portrait) and (max-width:700px)').matches;
  return rotated
    ? { x: ((e.clientY - r.top) / r.height) * WIDTH, y: ((r.right - e.clientX) / r.width) * HEIGHT }
    : { x: ((e.clientX - r.left) / r.width) * WIDTH, y: ((e.clientY - r.top) / r.height) * HEIGHT };
}
function useCell(row, col) {
  if (!selected) {
    toast('先选一张植物卡');
    return;
  }
  if (selected === 'shovel') {
    if (shovel(g, row, col)) audio.sound('plant');
    selected = null;
  } else {
    const result = plant(g, selected, row, col);
    if (!result.ok) {
      toast(result.reason);
      return;
    }
    audio.sound('plant');
    selected = null;
  }
  refreshHud();
}
$('board').addEventListener('click', (e) => {
  if (g.status !== 'running' || e.target.closest('.seed-ui')) return;
  const p = point(e);
  if (e.detail !== 0 && collectAt(g, p.x, p.y)) {
    audio.sound('sun');
    refreshHud();
    return;
  }
  const b = e.target.closest('[data-row]');
  if (b) {
    useCell(Number(b.dataset.row), Number(b.dataset.col));
    return;
  }
  const cell = cellAt(g, p.x, p.y);
  if (cell) useCell(cell.row, cell.col);
});
$('board').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  selected = null;
  refreshHud();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.seed) chooseSeed(b.dataset.seed);
  if (b.hasAttribute('data-close') || b.hasAttribute('data-resume')) closeModal();
  if (b.hasAttribute('data-home')) goHome();
  if (b.hasAttribute('data-next')) {
    profile.selected = g.status === 'won' && g.info.level < 50 ? g.info.level + 1 : g.info.level;
    save();
    refreshMenu();
    begin();
  }
  if (b.dataset.tab !== undefined) levelModal(Number(b.dataset.tab));
  if (b.dataset.level) {
    profile.selected = Number(b.dataset.level);
    save();
    goHome();
  }
});
$('start').onclick = begin;
$('shovel').onclick = () => chooseSeed('shovel');
$('pause').onclick = openPause;
$('levels').onclick = () => levelModal(Math.floor((profile.selected - 1) / 10));
$('home-levels').onclick = () => levelModal(Math.floor((profile.selected - 1) / 10));
$('auto-sun').onclick = () => {
  profile.autoCollect = !profile.autoCollect;
  g.autoCollect = profile.autoCollect;
  save();
  refreshMenu();
  toast(profile.autoCollect ? '已开启自动收集阳光' : '已切换手动收集阳光');
};
$('music').onclick = () => {
  profile.music = !profile.music;
  save();
  refreshMenu();
  audio.unlock();
  audio.refresh();
};
$('help').onclick = () =>
  showModal(
    'help',
    `${closeButton()}<span class="eyebrow">THE GARDENER'S HANDBOOK</span><h2>把草坪种成一道防线。</h2><div class="help-copy"><p><strong>先攒阳光：</strong>点击阳光收集，或打开顶部「自动收集」。向日葵每 12 秒产出 25 阳光；夜晚天降阳光更少，要靠自己的花。</p><p><strong>再种植物：</strong>选择顶部种子卡，点草坪格子种植。卡片显示价格和冷却，阳光不足会变灰。植物在这一行自动攻击。坚果挡路、寒冰减速，樱桃和地雷负责爆发。</p><p><strong>泳池 / 屋顶：</strong>泳池为 6 行，两条水道先放睡莲再种植物。屋顶先放花盆，前三列开局已备好。小喷菇白天睡觉，夜晚射击。</p><p><strong>最后保险：</strong>每行只有一台割草机。触发后清扫一整行；之后再被突破就会失败。铲子移除植物和底座，不返还阳光。</p><p><strong>操作：</strong>电脑鼠标、1–9 选卡、S 铲子、Esc 取消 / 暂停、P 暂停、F 全屏。手机可横握，竖握使用旋转横屏布局；全屏入口在右上角。关卡、星级和设置自动保存于本机。</p></div><details><summary>植物图鉴</summary><div class="plant-guide">${PLANTS.map((p) => `<div class="guide-row">${plantIcon(p.id)}<div><b>${p.name} · ☀ ${p.cost}</b><small>第${p.unlock}关解锁 · ${p.desc}</small></div></div>`).join('')}</div></details>`,
  );
$('credits').onclick = () =>
  showModal(
    'credits',
    `${closeButton()}<span class="eyebrow">CREDITS & SOURCES</span><h2>关于这片小院</h2><div class="help-copy"><p>本项目是《植物大战僵尸》玩法的独立网页复刻。50关逻辑、场景、响应式界面和额外植物插画为本项目实现，不连接原作账号。</p><p>原版角色图像版权归 PopCap / Electronic Arts，图片来自公开项目 <a href="https://github.com/GeeeekExplorer/PVZ" target="_blank" rel="noopener">GeeeekExplorer/PVZ</a> 的素材镜像；<a href="./assets/credits.html" target="_blank" rel="noopener">来源与许可原文</a>随游戏一同保留。未把镜像的代码许可当作官方美术开放声明。</p><p>音乐：Zane Little Music / <a href="https://opengameart.org/content/flowerbed-fields-loop" target="_blank" rel="noopener">Flowerbed Fields</a>，CC0，为花园主题配乐而非原作音乐。无广告、无内购、无体力限制。</p></div>`,
  );
async function fullscreen() {
  const on = !document.body.classList.contains('is-full');
  document.body.classList.toggle('is-full', on);
  try {
    if (on && !document.fullscreenElement)
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    else if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    if (on) toast('已进入沉浸布局；也可添加到主屏幕');
  }
  if (on && screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
}
$('fullscreen').onclick = fullscreen;
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('is-full');
});
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') fullscreen();
  if (e.code === 'KeyS') chooseSeed('shovel');
  if (/^Digit[1-9]$/.test(e.code))
    chooseSeed(PLANTS.filter((p) => p.unlock <= g.info.level)[Number(e.code.at(-1)) - 1]?.id);
  if (e.code === 'KeyP') {
    if (modalType === 'pause') closeModal();
    else openPause();
  }
  if (e.code === 'Escape' && !modal.open) {
    if (selected) {
      selected = null;
      refreshHud();
    } else openPause();
  }
});
modal.addEventListener('cancel', (e) => {
  e.preventDefault();
  if (modalType !== 'result') closeModal();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.setActive(false);
    if (g.status === 'running') openPause();
  } else audio.setActive(g.status === 'running');
});
window.addEventListener('blur', () => {
  if (g.status === 'running') openPause();
});
function frame(now) {
  if (ended) return;
  const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
  previous = now;
  step(g, dt);
  for (const ev of g.events.splice(0)) {
    if (['shot', 'sun', 'boom', 'bite', 'mower', 'won', 'lost'].includes(ev.type))
      audio.sound(ev.type);
    if (ev.type === 'wave' && ev.wave === g.info.waves) announce('一大波僵尸正在接近！');
    if (ev.type === 'boss') announce('巨人僵尸来了！', 'FINAL WAVE');
  }
  if (g.status !== lastStatus) {
    lastStatus = g.status;
    const ready = g.status === 'ready';
    $('home').hidden = !ready;
    $('seed-ui').hidden = ready;
    $('battle-footer').hidden = ready;
    $('garden-cells').hidden = ready;
    audio.setActive(g.status === 'running');
    if (['won', 'lost'].includes(g.status)) result();
    refreshHud();
  }
  renderer.draw(g, { preview: g.status === 'ready', time: now / 1000 });
  if (now - lastHud > 80) {
    refreshHud();
    lastHud = now;
  }
  raf = requestAnimationFrame(frame);
}
refreshMenu();
prepareBoard();
raf = requestAnimationFrame(frame);
window.addEventListener('pagehide', () => {
  ended = true;
  cancelAnimationFrame(raf);
  clearTimeout(toastTimer);
  clearTimeout(announceTimer);
  renderer.dispose();
  audio.dispose();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
