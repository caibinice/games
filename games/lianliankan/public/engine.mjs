// Classic tile-link rules. One empty ring around the board is playable;
// a connection may cross empty cells with at most two right-angle turns.
export const LEVEL_COUNT = 30;
export const FRUIT_COUNT = 16;
export const DIFFICULTIES = {
  easy: {name: '悠闲', pc: [10, 6], mobile: [6, 6], seconds: 240, fruits: 10},
  normal: {name: '经典', pc: [10, 8], mobile: [6, 8], seconds: 180, fruits: 14},
  hard: {name: '挑战', pc: [12, 8], mobile: [6, 10], seconds: 150, fruits: 16},
};
export const CHAPTERS = ['阳光果园', '蜜桃午后', '青柠小径', '樱桃集市', '热带假日', '丰收派对'];
export const chapterName = level => CHAPTERS[Math.min(5, Math.floor((level - 1) / 5))];
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export function random(seed = Date.now()) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled(values, rng) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function compressPath(points) {
  return points.filter((p, i) => !i || i === points.length - 1 ||
    (points[i - 1].x !== points[i + 1].x && points[i - 1].y !== points[i + 1].y));
}
export function findPath({board, cols, rows}, a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || a < 0 || b < 0 ||
      a >= board.length || b >= board.length || !board[a] || board[a] !== board[b]) return null;
  const start = {x: a % cols, y: Math.floor(a / cols)};
  const end = {x: b % cols, y: Math.floor(b / cols)};
  const clear = (x, y) => x >= -1 && x <= cols && y >= -1 && y <= rows &&
    ((x === end.x && y === end.y) || x === -1 || x === cols || y === -1 || y === rows || !board[y * cols + x]);
  const queue = [{...start, dir: -1, turns: 0, parent: -1}];
  const visited = new Map();
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    for (let dir = 0; dir < 4; dir++) {
      if (node.dir >= 0 && dir === (node.dir + 2) % 4) continue;
      const turns = node.turns + (node.dir < 0 || node.dir === dir ? 0 : 1);
      if (turns > 2) continue;
      const [dx, dy] = DIRECTIONS[dir], x = node.x + dx, y = node.y + dy;
      if (!clear(x, y)) continue;
      if (x === end.x && y === end.y) {
        const points = [{x, y}];
        for (let i = head; i >= 0; i = queue[i].parent) points.push({x: queue[i].x, y: queue[i].y});
        return compressPath(points.reverse());
      }
      const key = `${x},${y},${dir}`;
      if ((visited.get(key) ?? 3) <= turns) continue;
      visited.set(key, turns);
      queue.push({x, y, dir, turns, parent: head});
    }
  }
  return null;
}
export function findMove(game) {
  const groups = new Map();
  game.board.forEach((v, i) => { if (v) { if (!groups.has(v)) groups.set(v, []); groups.get(v).push(i); } });
  for (const indices of groups.values()) {
    for (let i = 0; i < indices.length; i++) for (let j = i + 1; j < indices.length; j++) {
      const path = findPath(game, indices[i], indices[j]);
      if (path) return {a: indices[i], b: indices[j], path};
    }
  }
  return null;
}
// Remove geometrically connectable pairs from an occupied skeleton first,
// then assign equal fruit to each pair. Replaying that removal order proves
// solvability, including after shuffling a partially cleared board.
export function arrangeBoard(board, cols, rows, pairValues, rng = random()) {
  const geometry = {board: board.map(v => v ? 1 : 0), cols, rows};
  let positions = geometry.board.flatMap((v, i) => v ? [i] : []);
  if (positions.length !== pairValues.length * 2) throw Error('Pair inventory mismatch');
  const solution = [];
  while (positions.length) {
    let pair = null;
    for (let attempt = 0; attempt < 50; attempt++) {
      const i = Math.floor(rng() * positions.length);
      let j = Math.floor(rng() * (positions.length - 1));
      if (j >= i) j++;
      if (findPath(geometry, positions[i], positions[j])) { pair = [positions[i], positions[j]]; break; }
    }
    if (!pair) { const move = findMove(geometry); if (move) pair = [move.a, move.b]; }
    if (!pair) throw Error('Occupied skeleton has no connection');
    solution.push(pair);
    pair.forEach(i => { geometry.board[i] = 0; });
    positions = positions.filter(i => geometry.board[i]);
  }
  const values = shuffled(pairValues, rng), arranged = Array(board.length).fill(0);
  solution.forEach(([a, b], i) => { arranged[a] = arranged[b] = values[i]; });
  return {board: arranged, solution};
}
export function generateBoard(cols, rows, fruits, seed = Date.now()) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || rows < 2 || cols * rows % 2 ||
      !Number.isInteger(fruits) || fruits < 1 || fruits > FRUIT_COUNT) throw Error('Invalid board dimensions');
  const pairs = Array.from({length: cols * rows / 2}, (_, i) => i % fruits + 1);
  return arrangeBoard(Array(cols * rows).fill(1), cols, rows, pairs, random(seed));
}
export function newGame({platform = 'pc', difficulty = 'normal', level = 1, mode = 'timed', seed = Date.now()} = {}) {
  if (!['pc', 'mobile'].includes(platform) || !DIFFICULTIES[difficulty] || !['timed', 'zen'].includes(mode) ||
      !Number.isInteger(level) || level < 1 || level > LEVEL_COUNT) throw Error('Invalid game options');
  const spec = DIFFICULTIES[difficulty], [cols, rows] = spec[platform];
  const durationMs = Math.max(90, spec.seconds - (level - 1) * 2) * 1000;
  return {version: 1, platform, difficulty, level, mode, cols, rows,
    board: generateBoard(cols, rows, Math.min(FRUIT_COUNT, spec.fruits + Math.floor((level - 1) / 10)), seed).board,
    status: 'ready', score: 0, removed: 0, combo: 0, lastMatchAt: 0, elapsedMs: 0,
    remainingMs: durationMs, durationMs, hints: 3, shuffles: 3, extensions: 2, autoShuffles: 0};
}
export function startGame(game) { if (['ready', 'paused'].includes(game.status)) game.status = 'running'; }
export function pauseGame(game) { if (game.status === 'running') game.status = 'paused'; }
export function advanceTime(game, milliseconds) {
  if (game.status !== 'running' || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
  game.elapsedMs += milliseconds;
  if (game.mode === 'timed') {
    game.remainingMs = Math.max(0, game.remainingMs - milliseconds);
    if (!game.remainingMs) game.status = 'lost';
  }
}
export function matchPair(game, a, b) {
  if (game.status !== 'running') return {ok: false};
  const path = findPath(game, a, b);
  if (!path) { game.combo = 0; return {ok: false}; }
  game.combo = game.combo > 0 && game.elapsedMs - game.lastMatchAt <= 4000 ? Math.min(5, game.combo + 1) : 1;
  game.lastMatchAt = game.elapsedMs;
  const points = 100 + (game.combo - 1) * 25;
  game.score += points;
  game.board[a] = game.board[b] = 0;
  game.removed += 2;
  if (game.mode === 'timed') game.remainingMs = Math.min(game.durationMs, game.remainingMs + 2000);
  if (game.removed === game.board.length) game.status = 'won';
  return {ok: true, path, points, combo: game.combo};
}
function pairInventory(board) {
  const counts = new Map();
  for (const value of board) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].flatMap(([value, count]) => {
    if (count % 2) throw Error('Unpaired inventory');
    return Array(count / 2).fill(value);
  });
}
export function shuffleBoard(game, {automatic = false, seed = Date.now()} = {}) {
  if (game.status !== 'running' || !game.board.some(Boolean) || (!automatic && !game.shuffles)) return false;
  game.board = arrangeBoard(game.board, game.cols, game.rows, pairInventory(game.board), random(seed)).board;
  game.combo = 0;
  if (automatic) game.autoShuffles++; else game.shuffles--;
  return true;
}
export function useHint(game) {
  if (game.status !== 'running' || !game.hints) return null;
  const move = findMove(game);
  if (move) game.hints--;
  return move;
}
export function extendTime(game) {
  if (game.mode !== 'timed' || !['running', 'lost'].includes(game.status) || !game.extensions) return false;
  game.extensions--;
  game.remainingMs += 30000;
  if (game.status === 'lost') game.status = 'running';
  return true;
}
export function inventoryValid(game) {
  if (!Array.isArray(game.board) || game.board.length !== game.cols * game.rows ||
      game.board.some(v => !Number.isInteger(v) || v < 0 || v > FRUIT_COUNT)) return false;
  try { pairInventory(game.board); return game.removed === game.board.filter(v => v === 0).length; } catch { return false; }
}
export const serialize = game => JSON.stringify(game);
export function restore(raw, platform) {
  try {
    const game = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
    const spec = DIFFICULTIES[game.difficulty];
    if (!spec || !['pc', 'mobile'].includes(game.platform) || (platform && game.platform !== platform) ||
        game.version !== 1 || !['timed', 'zen'].includes(game.mode) ||
        !Number.isInteger(game.level) || game.level < 1 || game.level > LEVEL_COUNT ||
        !['ready', 'running', 'paused', 'won', 'lost'].includes(game.status) ||
        game.cols !== spec[game.platform][0] || game.rows !== spec[game.platform][1] || !inventoryValid(game)) return null;
    for (const key of ['score', 'removed', 'combo', 'lastMatchAt', 'elapsedMs', 'remainingMs', 'durationMs', 'hints', 'shuffles', 'extensions', 'autoShuffles']) {
      if (!Number.isFinite(game[key]) || game[key] < 0 || game[key] > 1e9) return null;
    }
    if (!Number.isInteger(game.hints) || game.hints > 3 || !Number.isInteger(game.shuffles) || game.shuffles > 3 ||
        !Number.isInteger(game.extensions) || game.extensions > 2 || game.combo > 5 || game.durationMs === 0 ||
        ((game.status === 'won') !== (game.removed === game.board.length)) ||
        (['running', 'paused'].includes(game.status) && game.mode === 'timed' && game.remainingMs === 0)) return null;
    return game;
  } catch { return null; }
}
