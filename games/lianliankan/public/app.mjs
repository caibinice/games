import {newGame, startGame, pauseGame, advanceTime, matchPair, findMove, shuffleBoard,
  useHint, extendTime, serialize, restore, DIFFICULTIES, LEVEL_COUNT, chapterName, levelSpec} from './engine.mjs';
import {FRUITS, fruitSVG} from './fruits.mjs';
import {icon} from './icons.mjs';
import {setupFullscreen} from './fullscreen.mjs';

const $ = id => document.getElementById(id);
const platform = document.body.dataset.platform;
const STORAGE_KEY = `fish-lianliankan:${platform}:v1`;
const pad = n => String(n).padStart(2, '0');
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* Local-only storage is optional. */ }
const records = saved.records && typeof saved.records === 'object' && !Array.isArray(saved.records) ? saved.records : {};
let bestScore = Number.isFinite(saved.bestScore) && saved.bestScore >= 0 ? saved.bestScore : 0;
let sound = saved.sound !== false;
let game = restore(saved.game, platform) || newGame({platform});
if (game.status === 'running') pauseGame(game);
let selection = null, hintPair = [], busy = false, round = 0;
let lastTick = performance.now(), lastSave = 0, toastTimeout, hintTimeout, animationTimeout;
let pendingAction = null, resumeAfterDialog = false, audioContext;

document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
if ($('fruit-bouquet')) $('fruit-bouquet').innerHTML = fruitSVG(1) + fruitSVG(7) + fruitSVG(6);
$('rule-illustration').innerHTML = fruitSVG(7) + fruitSVG(7);
setupFullscreen({button:$('fullscreen-button'),icon,notice:toast,onChange:()=>{
  fitImmersiveBoard();
  if(game.status==='running')($('board').querySelector('.tile.selected:not(:disabled)')||$('board').querySelector('.tile:not(:disabled)'))?.focus({preventScroll:true});
}});
function fitImmersiveBoard(){
  const frame=$('board-frame');
  if(!document.body.classList.contains('immersive')){frame.style.removeProperty('--immersive-board-width');return;}
  const card=frame.closest('.board-card'),style=getComputedStyle(frame),gap=parseFloat(getComputedStyle($('board')).columnGap)||0;
  const horizontal=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+2;
  const vertical=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+2;
  const available=card.clientHeight-card.querySelector('.board-heading').offsetHeight-card.querySelector('.board-footer').offsetHeight-card.querySelector('.harvest-track').offsetHeight;
  const ratio=game.cols/game.rows;
  const gridWidth=Math.min(card.clientWidth-32-horizontal,(available-vertical-gap*(1/ratio-1))*ratio);
  frame.style.setProperty('--immersive-board-width',`${Math.max(120,gridWidth+horizontal)}px`);
}
if($('fullscreen-button'))new ResizeObserver(fitImmersiveBoard).observe($('board-frame').closest('.board-card'));

function recordKey() { return `${game.difficulty}:${game.mode}`; }
function currentRecord() {
  const value = records[recordKey()] || {};
  const unlocked = Number.isInteger(value.unlocked) ? Math.min(LEVEL_COUNT, Math.max(1, value.unlocked)) : 1;
  const stars = value.stars && typeof value.stars === 'object' ? value.stars : {};
  return {unlocked, stars};
}
function starsForRound() {
  const seconds = game.elapsedMs / 1000;
  return seconds <= game.board.length * 1.4 ? 3 : seconds <= game.board.length * 2.8 ? 2 : 1;
}
function rememberWin() {
  if (game.status !== 'won') return;
  const record = currentRecord();
  record.unlocked = Math.max(record.unlocked, Math.min(LEVEL_COUNT, game.level + 1));
  record.stars[game.level] = Math.max(Math.min(3, Number(record.stars[game.level]) || 0), starsForRound());
  records[recordKey()] = record;
  bestScore = Math.max(bestScore, game.score);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({game: serialize(game), records, bestScore, sound})); }
  catch { /* Gameplay also works in private mode with storage disabled. */ }
  lastSave = performance.now();
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 2400);
}
function playSound(kind) {
  if (!sound) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'match' ? [659.25, 880] : kind === 'wrong' ? [220] : [440];
    notes.forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      const time = audioContext.currentTime + i * .085;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(.045, time + .015);
      gain.gain.exponentialRampToValueAtTime(.001, time + .17);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(time); oscillator.stop(time + .18);
    });
  } catch { /* Sound is not needed for the puzzle. */ }
}
function renderSound() {
  const button = $('sound-button');
  button.innerHTML = icon(sound ? 'sound' : 'mute');
  button.setAttribute('aria-label', sound ? '关闭音效' : '开启音效');
  button.setAttribute('aria-pressed', String(sound));
}
function roundFruitKinds() { return game.version === 1 ? Math.min(16, DIFFICULTIES[game.difficulty].fruits + Math.floor((game.level - 1) / 10)) : levelSpec(game.level, platform, game.difficulty).fruits; }
function renderSettings() {
  document.querySelectorAll('[data-difficulty]').forEach(b => {
    b.classList.toggle('active', b.dataset.difficulty === game.difficulty);
    b.setAttribute('aria-pressed', String(b.dataset.difficulty === game.difficulty));
  });
  document.querySelectorAll('[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === game.mode);
    b.setAttribute('aria-pressed', String(b.dataset.mode === game.mode));
  });
  if ($('difficulty-select')) $('difficulty-select').value = game.difficulty;
  if ($('level-tag')) $('level-tag').textContent = `LEVEL ${pad(game.level)}`;
  if ($('chapter')) $('chapter').textContent = `${chapterName(game.level)} · ${game.cols}×${game.rows}`;
  if ($('mobile-level')) $('mobile-level').textContent = `第 ${pad(game.level)} 关 · ${game.cols}×${game.rows} · ${roundFruitKinds()} 种`;
  if ($('level-progress')) $('level-progress').textContent = `${pad(currentRecord().unlocked)} / 30`;
  renderSound();
}
function renderBoard() {
  const focusIndex = document.activeElement?.classList.contains('tile') ? Number(document.activeElement.dataset.index) : null;
  $('board').style.setProperty('--cols', game.cols);
  $('board-frame').style.setProperty('--board-ratio', game.cols / game.rows);
  $('board').setAttribute('aria-label', `${game.cols} 列 ${game.rows} 行水果棋盘`);
  $('board').replaceChildren(...game.board.map((value, i) => {
    const tile = document.createElement('button');
    tile.className = `tile${!value ? ' empty' : ''}${selection === i ? ' selected' : ''}${hintPair.includes(i) ? ' hinted' : ''}`;
    tile.dataset.index = i;
    tile.disabled = !value || game.status !== 'running' || busy;
    tile.setAttribute('aria-pressed', String(selection === i));
    if (value) {
      tile.setAttribute('aria-label', `${FRUITS[value - 1].name}，第 ${Math.floor(i / game.cols) + 1} 行第 ${i % game.cols + 1} 列`);
      tile.style.setProperty('--fruit-tint', FRUITS[value - 1].color);
      tile.innerHTML = fruitSVG(value);
    } else { tile.setAttribute('aria-hidden', 'true'); tile.tabIndex = -1; }
    return tile;
  }));
  if (focusIndex !== null && game.status === 'running') {
    const tiles = [...$('board').children];
    (tiles[focusIndex]?.disabled ? tiles.find(t => !t.disabled) : tiles[focusIndex])?.focus({preventScroll: true});
  }
}
function renderStats() {
  $('score').textContent = game.score.toLocaleString('zh-CN');
  $('remaining').innerHTML = `${game.board.length - game.removed}<small> 颗</small>`;
  $('best-score').textContent = Math.max(bestScore, game.score).toLocaleString('zh-CN');
  const seconds = Math.ceil((game.mode === 'zen' ? game.elapsedMs : game.remainingMs) / 1000);
  $('timer').textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  $('timer-label').textContent = game.mode === 'zen' ? '自在时光' : '剩余时间';
  if ($('timer-note')) $('timer-note').textContent = game.mode === 'zen' ? '不赶时间，慢慢找' : '每次配对 +2 秒';
  document.querySelector('.timer-stat').classList.toggle('warning', game.mode === 'timed' && game.remainingMs <= 30000 && game.status === 'running');
  $('combo').textContent = game.combo > 1 ? `${game.combo} 连击 · 甜蜜加分！` : platform === 'mobile' ? '把好心情，一对对连起来' : '从第一对开始';
  if ($('matched-label')) $('matched-label').textContent = `已配对 ${game.removed / 2} / ${game.board.length / 2}`;
  const completion = Math.round(game.removed / game.board.length * 100);
  $('completion-label').textContent = `${completion}%${platform === 'pc' ? ' 收获' : ''}`;
  $('harvest-fill').style.width = `${completion}%`;
  for (const [name, value] of [['hint', game.hints], ['shuffle', game.shuffles], ['extend', game.extensions]]) {
    $(`${name}-count`).textContent = value;
    $(`${name}-button`).disabled = !value || busy || (name === 'extend' ? game.mode !== 'timed' || !['running', 'lost'].includes(game.status) : game.status !== 'running');
  }
  const pause = $('pause-button');
  pause.innerHTML = icon(game.status === 'paused' ? 'play' : 'pause');
  pause.setAttribute('aria-label', game.status === 'paused' ? '继续游戏' : '暂停游戏');
  pause.disabled = !['running', 'paused'].includes(game.status) || busy;
}
function renderOverlay() {
  const overlay = $('board-overlay'), content = $('overlay-content');
  overlay.hidden = game.status === 'running';
  if (overlay.hidden) return;
  const fruit = `<div class="overlay-fruit">${fruitSVG(game.status === 'won' ? 7 : game.status === 'lost' ? 6 : 1)}</div>`;
  if (game.status === 'ready') {
    content.innerHTML = `${fruit}<span class="eyebrow">WELCOME TO YOUR LITTLE ORCHARD</span><h2>让快乐，一对对发生。</h2><p>相同水果 · 最多两次转弯<br>${DIFFICULTIES[game.difficulty].name}难度 · ${game.cols}×${game.rows} · ${roundFruitKinds()} 种水果<br>${game.board.length} 颗水果 · ${game.mode === 'zen' ? '自在慢玩' : '计时挑战'}</p><button class="primary-button" data-action="start">开始收获 ${icon('arrow')}</button><span class="overlay-footnote">点击开始后${game.mode === 'zen' ? '，慢慢玩就好。' : '才计时，不用着急。'}</span>`;
  } else if (game.status === 'paused') {
    content.innerHTML = `${fruit}<span class="eyebrow">TAKE A LITTLE BREATH</span><h2>歇一会儿，甜还在。</h2><p>游戏已暂停，时间也停在这里。<br>准备好了，就接着找吧。</p><button class="primary-button" data-action="start">继续游戏 ${icon('play')}</button><button class="overlay-text-button" data-action="restart">重新开始这一关</button>`;
  } else if (game.status === 'won') {
    const stars = starsForRound();
    content.innerHTML = `${fruit}<span class="eyebrow">A LITTLE HARVEST OF HAPPINESS</span><h2>${game.level === LEVEL_COUNT ? '整座果园，都是你的！' : '好心情，收获满满！'}</h2><div class="result-stars" aria-label="${stars} 星">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><strong class="result-score">${game.score.toLocaleString('zh-CN')}</strong><p>第 ${pad(game.level)} 关完成 · 用时 ${Math.floor(game.elapsedMs / 60000)} 分 ${Math.floor(game.elapsedMs / 1000) % 60} 秒</p><button class="primary-button" data-action="${game.level === LEVEL_COUNT ? 'levels' : 'next'}">${game.level === LEVEL_COUNT ? '看看我的小果园' : '再收获一关'} ${icon('arrow')}</button><button class="overlay-text-button" data-action="restart">再玩一次</button>`;
  } else {
    content.innerHTML = `${fruit}<span class="eyebrow">GOOD THINGS TAKE A LITTLE TIME</span><h2>好心情，值得再等等。</h2><p>时间到了，已经配对 ${game.removed / 2} 组。<br>${game.extensions ? '再给自己 30 秒，接着收获。' : '换个心情，再来一局吧。'}</p><button class="primary-button" data-action="${game.extensions ? 'extend' : 'restart'}">${game.extensions ? `加时 30 秒 · 剩余 ${game.extensions} 次` : '再试一次'}</button>${game.extensions ? '<button class="overlay-text-button" data-action="restart">重新开始</button>' : '<button class="overlay-text-button" data-action="zen">试试自在慢玩</button>'}`;
  }
}
function render() { renderSettings(); renderBoard(); renderStats(); renderOverlay(); fitImmersiveBoard(); }
function clearEffects() {
  clearTimeout(hintTimeout); clearTimeout(animationTimeout);
  $('connection').replaceChildren();
  hintPair = []; selection = null; busy = false;
}
function freshGame(options = {}) {
  round++; clearEffects();
  game = newGame({platform, difficulty: game.difficulty, mode: game.mode, level: game.level, ...options});
  $('board-message').textContent = platform === 'mobile' ? '相同水果，最多转弯 2 次' : '找找看，谁和谁是一对？';
  lastTick = performance.now();
  render(); save();
}
function syncClock() {
  const now = performance.now(), previous = game.status;
  advanceTime(game, now - lastTick); lastTick = now;
  if (previous !== game.status) { clearEffects(); render(); save(); }
}
function start() {
  if (!['ready', 'paused'].includes(game.status)) return;
  startGame(game); lastTick = performance.now();
  if (!findMove(game)) shuffleBoard(game, {automatic: true});
  render(); save(); playSound('select');
}
function togglePause() {
  if (busy) return;
  syncClock();
  if (game.status === 'running') { pauseGame(game); clearEffects(); render(); save(); }
  else if (game.status === 'paused') start();
}
function drawPath(path) {
  const frame = $('board-frame').getBoundingClientRect(), grid = $('board').getBoundingClientRect();
  const cell = $('board').firstElementChild.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle($('board')).columnGap) || 0;
  const points = path.map(({x, y}) => ({
    x: x === -1 ? (grid.left - frame.left) / 2 : x === game.cols ? frame.width - (frame.right - grid.right) / 2 : grid.left - frame.left + cell.width / 2 + x * (cell.width + gap),
    y: y === -1 ? (grid.top - frame.top) / 2 : y === game.rows ? frame.height - (frame.bottom - grid.bottom) / 2 : grid.top - frame.top + cell.height / 2 + y * (cell.height + gap),
  }));
  $('connection').setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
  $('connection').innerHTML = `<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}"/>${points.filter((_, i) => !i || i === points.length - 1).map(p => `<circle cx="${p.x}" cy="${p.y}" r="3"/>`).join('')}`;
}
function ensureMove() {
  if (game.status === 'running' && !findMove(game)) {
    shuffleBoard(game, {automatic: true});
    toast('暂时没有可连的水果，已免费重新排列');
    $('board-message').textContent = '新朋友已就位，继续收获吧';
  }
}
function selectTile(index) {
  syncClock();
  if (game.status !== 'running' || busy || !game.board[index]) return;
  if (selection === index) { selection = null; renderBoard(); return; }
  if (selection === null) { selection = index; renderBoard(); playSound('select'); return; }
  const first = selection;
  const result = matchPair(game, first, index);
  if (!result.ok) {
    selection = index;
    renderBoard(); renderStats();
    $('board').children[first]?.classList.add('wrong');
    $('board').children[index]?.classList.add('wrong');
    $('board-message').textContent = '试试另一对，连线最多转弯两次';
    playSound('wrong'); save();
    return;
  }
  selection = null; hintPair = []; clearTimeout(hintTimeout); busy = true;
  const token = round;
  drawPath(result.path);
  $('board').children[first].classList.add('matched');
  $('board').children[index].classList.add('matched');
  [...$('board').children].forEach(t => { t.disabled = true; t.classList.remove('selected', 'hinted'); });
  $('board-message').textContent = result.combo > 1 ? `${result.combo} 连击！甜蜜 +${result.points} 分` : `找到一对，快乐 +${result.points} 分`;
  bestScore = Math.max(bestScore, game.score);
  rememberWin(); renderStats(); save(); playSound(game.status === 'won' ? 'win' : 'match');
  animationTimeout = setTimeout(() => {
    if (round !== token) return;
    busy = false; $('connection').replaceChildren();
    ensureMove(); render(); save();
    if (game.status === 'won') $('overlay-content').querySelector('button')?.focus({preventScroll: true});
  }, 280);
}
function hint() {
  syncClock(); if (busy) return;
  ensureMove();
  const move = useHint(game);
  if (!move) return;
  selection = null; hintPair = [move.a, move.b];
  renderBoard(); renderStats(); save(); playSound('select');
  toast('亮起来的两颗水果，是一对哦');
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => { hintPair = []; if (!busy) renderBoard(); }, 2200);
}
function shuffle() {
  syncClock(); if (busy || !shuffleBoard(game)) return;
  clearEffects(); render(); save(); playSound('select');
  toast('换个位置，换个好心情');
}
function extend() {
  syncClock(); if (busy || !extendTime(game)) return;
  lastTick = performance.now(); render(); save(); playSound('select'); toast('多了 30 秒，慢慢找');
}
function openDialog(id) {
  syncClock();
  resumeAfterDialog = game.status === 'running';
  if (resumeAfterDialog) { pauseGame(game); clearEffects(); render(); save(); }
  $(id).showModal();
}
function requestFresh(options = {}) {
  if (busy) return;
  if (['running', 'paused'].includes(game.status)) {
    pendingAction = () => freshGame(options);
    $('confirm-message').textContent = '本局将重新开始；已解锁关卡、星星和最高分会保留。';
    openDialog('confirm-dialog');
  } else freshGame(options);
}
function levels() {
  const record = currentRecord();
  $('level-grid').replaceChildren(...Array.from({length: LEVEL_COUNT}, (_, i) => {
    const level = i + 1, button = document.createElement('button');
    button.dataset.level = level; button.disabled = level > record.unlocked;
    button.className = level === game.level ? 'current' : '';
    const spec = levelSpec(level, platform, game.difficulty);
    const stars = Math.min(3, Math.max(0, Number(record.stars[level]) || 0));
    button.innerHTML = `${pad(level)}<span class="level-detail">${spec.cols}×${spec.rows} · ${spec.fruits}种</span><small>${stars ? '★'.repeat(stars) : level > record.unlocked ? '· · ·' : 'START'}</small>`;
    button.setAttribute('aria-label', `第 ${level} 关，${chapterName(level)}，${spec.cols} 列 ${spec.rows} 行，${spec.fruits} 种水果，${level > record.unlocked ? '尚未解锁' : stars ? `${stars} 星` : '待收获'}`);
    return button;
  }));
  openDialog('levels-dialog');
}
const actions = {
  start, pause: togglePause, hint, shuffle, extend, levels,
  restart: () => requestFresh(),
  next: () => { if (game.status === 'won' && game.level < LEVEL_COUNT) freshGame({level: game.level + 1}); },
  zen: () => requestFresh({mode: 'zen', level: 1}),
  sound: () => { sound = !sound; renderSound(); save(); if (sound) playSound('select'); },
  help: () => openDialog('help-dialog'),
  confirm: () => { resumeAfterDialog = false; $('confirm-dialog').close(); pendingAction?.(); pendingAction = null; },
};
document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { $(close.dataset.close).close(); return; }
  const action = event.target.closest('[data-action]');
  if (action && !action.disabled) { actions[action.dataset.action]?.(); return; }
  const tile = event.target.closest('.tile');
  if (tile && !tile.disabled) { selectTile(Number(tile.dataset.index)); return; }
  const difficulty = event.target.closest('[data-difficulty]');
  if (difficulty && difficulty.dataset.difficulty !== game.difficulty) { requestFresh({difficulty: difficulty.dataset.difficulty, level: 1}); return; }
  const mode = event.target.closest('[data-mode]');
  if (mode && mode.dataset.mode !== game.mode) { requestFresh({mode: mode.dataset.mode, level: 1}); return; }
  const level = event.target.closest('[data-level]');
  if (level && !level.disabled) {
    const number = Number(level.dataset.level);
    if (number > currentRecord().unlocked) return;
    // Opening the picker paused this game. A fresh level supersedes the saved round.
    const wasRunning = resumeAfterDialog;
    resumeAfterDialog = false; $('levels-dialog').close();
    if (number === game.level) { if (wasRunning) start(); return; }
    if (game.status === 'paused' && game.removed) requestFresh({level: number});
    else freshGame({level: number});
  }
});
$('difficulty-select')?.addEventListener('change', event => {
  const difficulty = event.target.value;
  if (difficulty !== game.difficulty) requestFresh({difficulty, level: 1});
  event.target.value = game.difficulty;
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (resumeAfterDialog && game.status === 'paused' && !document.querySelector('dialog[open]')) {
      resumeAfterDialog = false; start();
    }
    if (!document.querySelector('dialog[open]')) resumeAfterDialog = false;
  });
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey ||
      /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  const tile = event.target.closest('.tile');
  if (tile && game.status === 'running' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const delta = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -game.cols, ArrowDown: game.cols}[event.key];
    let index = Number(tile.dataset.index) + delta;
    while (index >= 0 && index < game.board.length && !game.board[index]) index += delta;
    if (index >= 0 && index < game.board.length) $('board').children[index].focus({preventScroll: true});
    return;
  }
  if (event.code === 'Space' && (tile || !event.target.closest('button,a'))) {
    event.preventDefault(); if (game.status === 'ready') start(); else togglePause();
  }
  if (event.key.toLowerCase() === 'h') hint();
  if (event.key.toLowerCase() === 's') shuffle();
});
function pauseForLeave() {
  syncClock();
  if (game.status === 'running') { pauseGame(game); clearEffects(); render(); }
  save();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForLeave(); else lastTick = performance.now(); });
window.addEventListener('pagehide', pauseForLeave);
window.addEventListener('resize', () => { if (busy) $('connection').replaceChildren(); fitImmersiveBoard(); });
setInterval(() => {
  syncClock(); renderStats();
  if (game.status === 'running' && performance.now() - lastSave > 5000) save();
}, 250);
rememberWin(); render(); save();
