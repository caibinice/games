import {describe, it, expect} from 'vitest';
import {findPath, findMove, generateBoard, arrangeBoard, random, newGame, startGame, pauseGame,
  advanceTime, matchPair, shuffleBoard, useHint, extendTime, inventoryValid, serialize, restore,
  DIFFICULTIES, LEVEL_COUNT} from '../public/engine.mjs';

const fixture = (cols, rows, board) => ({cols, rows, board});
function verifyPath(game, a, b, path) {
  expect(path.length).toBeGreaterThanOrEqual(2);
  expect(path.length).toBeLessThanOrEqual(4);
  expect(path[0]).toEqual({x: a % game.cols, y: Math.floor(a / game.cols)});
  expect(path.at(-1)).toEqual({x: b % game.cols, y: Math.floor(b / game.cols)});
  for (let i = 1; i < path.length; i++) {
    const p = path[i - 1], q = path[i];
    expect(p.x === q.x || p.y === q.y).toBe(true);
    const dx = Math.sign(q.x - p.x), dy = Math.sign(q.y - p.y);
    for (let x = p.x, y = p.y; x !== q.x || y !== q.y; x += dx, y += dy) {
      expect(x >= -1 && x <= game.cols && y >= -1 && y <= game.rows).toBe(true);
      if (x >= 0 && x < game.cols && y >= 0 && y < game.rows) {
        const index = y * game.cols + x;
        if (index !== a && index !== b) expect(game.board[index]).toBe(0);
      }
    }
  }
}
// Independent oracle: enumerate all straight, L-shaped and Z/U-shaped
// connections. It does not use the engine's direction-state BFS.
function oracle(game, a, b) {
  if (a === b || !game.board[a] || game.board[a] !== game.board[b]) return false;
  const A = {x: a % game.cols, y: Math.floor(a / game.cols)}, B = {x: b % game.cols, y: Math.floor(b / game.cols)};
  const segment = (p, q) => {
    if (p.x !== q.x && p.y !== q.y) return false;
    const dx = Math.sign(q.x - p.x), dy = Math.sign(q.y - p.y);
    let x = p.x, y = p.y;
    while (true) {
      if (x >= 0 && x < game.cols && y >= 0 && y < game.rows) {
        const index = y * game.cols + x;
        if (index !== a && index !== b && game.board[index]) return false;
      }
      if (x === q.x && y === q.y) return true;
      x += dx; y += dy;
    }
  };
  const paths = [[A, B], [A, {x: A.x, y: B.y}, B], [A, {x: B.x, y: A.y}, B]];
  for (let x = -1; x <= game.cols; x++) paths.push([A, {x, y: A.y}, {x, y: B.y}, B]);
  for (let y = -1; y <= game.rows; y++) paths.push([A, {x: A.x, y}, {x: B.x, y}, B]);
  return paths.some(path => path.slice(1).every((q, i) => segment(path[i], q)));
}
describe('Classic connection rules', () => {
  it.each([
    [fixture(3, 2, [1, 0, 1, 2, 2, 2]), 0, 2, 2],
    [fixture(3, 3, [1, 0, 0, 2, 3, 0, 4, 5, 1]), 0, 8, 3],
    [fixture(3, 3, [1, 2, 1, 0, 0, 0, 3, 4, 5]), 0, 2, 4],
    [fixture(3, 3, [1, 2, 1, 3, 4, 5, 6, 7, 8]), 0, 2, 4],
    [fixture(3, 2, [1, 1, 2, 3, 4, 5]), 0, 1, 2],
  ])('connects a valid pair with zero, one or two turns', (game, a, b, count) => {
    const path = findPath(game, a, b);
    expect(path).not.toBeNull(); expect(path).toHaveLength(count); verifyPath(game, a, b, path);
  });
  it('rejects a corridor that requires three turns, even for identical tiles', () => {
    const game = fixture(5, 5, [2,2,2,2,2, 2,9,0,2,2, 2,2,0,0,2, 2,2,2,9,2, 2,2,2,2,2]);
    expect(findPath(game, 6, 18)).toBeNull();
  });
  it('rejects a tile paired with itself, different fruits, empties and invalid indices', () => {
    const game = fixture(2, 2, [1, 2, 0, 1]);
    for (const [a, b] of [[0,0], [0,1], [2,3], [-1,3], [0,4], [.5,3]]) expect(findPath(game, a, b)).toBeNull();
  });
  it('agrees with an independent segment oracle for 300 seeded small boards', () => {
    const rng = random(991);
    for (let n = 0; n < 300; n++) {
      const board = Array.from({length: 12}, () => Math.floor(rng() * 4));
      const game = fixture(4, 3, board);
      for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
        const path = findPath(game, a, b);
        expect(Boolean(path)).toBe(oracle(game, a, b));
        if (path) verifyPath(game, a, b, path);
      }
    }
  });
});
describe('Solvable independent PC / mobile boards', () => {
  it.each(Object.keys(DIFFICULTIES))('proves every generated %s board has a complete legal solution', difficulty => {
    for (const platform of ['pc', 'mobile']) for (let seed = 0; seed < 12; seed++) {
      const [cols, rows] = DIFFICULTIES[difficulty][platform];
      const {board, solution} = generateBoard(cols, rows, 16, seed);
      expect(board.every(v => v >= 1 && v <= 16)).toBe(true);
      for (const [a, b] of solution) {
        const game = fixture(cols, rows, board), path = findPath(game, a, b);
        expect(path).not.toBeNull(); verifyPath(game, a, b, path); board[a] = board[b] = 0;
      }
      expect(board.every(v => v === 0)).toBe(true);
    }
  });
  it('is deterministic by seed but different seeds produce different layouts', () => {
    expect(generateBoard(10, 8, 14, 92)).toEqual(generateBoard(10, 8, 14, 92));
    expect(generateBoard(10, 8, 14, 93).board).not.toEqual(generateBoard(10, 8, 14, 92).board);
  });
  it('reshuffles partial boards without moving holes or changing the paired inventory', () => {
    const generated = generateBoard(10, 8, 14, 19), game = fixture(10, 8, generated.board);
    for (const [a, b] of generated.solution.slice(0, 12)) game.board[a] = game.board[b] = 0;
    const before = [...game.board], counts = [...game.board].sort((a, b) => a - b);
    const pairs = [];
    for (let v = 1; v <= 16; v++) pairs.push(...Array(game.board.filter(value => value === v).length / 2).fill(v));
    const arranged = arrangeBoard(game.board, 10, 8, pairs, random(87));
    expect([...arranged.board].sort((a, b) => a - b)).toEqual(counts);
    expect(arranged.board.map((v, i) => v === 0 && before[i] === 0 || v > 0 && before[i] > 0).every(Boolean)).toBe(true);
    game.board = arranged.board;
    for (const [a, b] of arranged.solution) { expect(findPath(game, a, b)).not.toBeNull(); game.board[a] = game.board[b] = 0; }
  });
  it('validates configuration and has thirty progressively larger levels with scaled time', () => {
    for (const options of [{platform:'unknown'}, {difficulty:'unknown'}, {mode:'unknown'}, {level:0}, {level:31}]) expect(() => newGame(options)).toThrow();
    expect(LEVEL_COUNT).toBe(30);
    expect(newGame({level:30}).durationMs).toBeGreaterThan(newGame({level:1}).durationMs);
    expect(newGame({platform:'pc'}).board).toHaveLength(80);
    expect(newGame({platform:'mobile'}).board).toHaveLength(48);
    expect(() => generateBoard(3, 3, 12)).toThrow();
  });
});
describe('Round lifecycle, timer, tools and isolated saves', () => {
  it('does not count time before starting or while paused; zen has no deadline', () => {
    const game = newGame(), initial = game.remainingMs;
    advanceTime(game, 1000); expect(game.remainingMs).toBe(initial);
    startGame(game); advanceTime(game, 1000); expect(game.remainingMs).toBe(initial - 1000);
    pauseGame(game); advanceTime(game, 1000); expect(game.remainingMs).toBe(initial - 1000);
    startGame(game); advanceTime(game, Infinity); expect(game.remainingMs).toBe(initial - 1000);
    const zen = newGame({mode:'zen'}); startGame(zen); advanceTime(zen, 1e7);
    expect(zen.status).toBe('running'); expect(zen.elapsedMs).toBe(1e7); expect(zen.remainingMs).toBe(zen.durationMs);
  });
  it('matches once, awards capped combos, grants 2 seconds and preserves inventory', () => {
    const game = newGame({seed:12}); startGame(game); advanceTime(game, 6000);
    let move = findMove(game), result = matchPair(game, move.a, move.b);
    expect(result.ok).toBe(true); expect(result.points).toBe(100); expect(game.remainingMs).toBe(game.durationMs - 4000);
    expect(matchPair(game, move.a, move.b).ok).toBe(false); expect(inventoryValid(game)).toBe(true);
    for (let i = 0; i < 7; i++) {
      if (!findMove(game)) shuffleBoard(game, {automatic:true, seed:i});
      move = findMove(game); matchPair(game, move.a, move.b);
    }
    expect(game.combo).toBe(5);
    advanceTime(game, 5000); move = findMove(game); if (!move) { shuffleBoard(game, {automatic:true}); move=findMove(game); }
    expect(matchPair(game, move.a, move.b).combo).toBe(1);
    expect(inventoryValid(game)).toBe(true);
  });
  it('does not let paused/ready rounds be changed by tools or matches', () => {
    const game = newGame(), move = findMove(game), raw = serialize(game);
    expect(matchPair(game, move.a, move.b).ok).toBe(false);
    expect(useHint(game)).toBeNull(); expect(shuffleBoard(game)).toBe(false); expect(extendTime(game)).toBe(false);
    expect(serialize(game)).toBe(raw);
  });
  it('has three hints and shuffles; automatic deadlock recovery is free', () => {
    const game = newGame(); startGame(game);
    for (let i = 0; i < 3; i++) { expect(useHint(game)).not.toBeNull(); expect(shuffleBoard(game, {seed:i})).toBe(true); }
    expect(useHint(game)).toBeNull(); expect(shuffleBoard(game)).toBe(false);
    const before = [...game.board].sort((a, b) => a - b);
    expect(shuffleBoard(game, {automatic:true})).toBe(true);
    expect(game.shuffles).toBe(0); expect(game.autoShuffles).toBe(1);
    expect([...game.board].sort((a, b) => a - b)).toEqual(before); expect(findMove(game)).not.toBeNull();
  });
  it('expires, revives with 30 seconds at most twice, and disables extensions in zen', () => {
    const game = newGame(); startGame(game); advanceTime(game, game.durationMs + 1);
    expect(game.status).toBe('lost'); expect(game.remainingMs).toBe(0);
    expect(extendTime(game)).toBe(true); expect(game.status).toBe('running'); expect(game.remainingMs).toBe(30000);
    expect(extendTime(game)).toBe(true); expect(game.remainingMs).toBe(60000); expect(extendTime(game)).toBe(false);
    const zen = newGame({mode:'zen'}); startGame(zen); expect(extendTime(zen)).toBe(false);
  });
  it('wins only after clearing all pairs and prevents post-win scoring', () => {
    const game = newGame({platform:'mobile', difficulty:'easy', mode:'zen', seed:121}); startGame(game);
    while (game.board.some(Boolean)) {
      let move = findMove(game);
      if (!move) { shuffleBoard(game, {automatic:true}); move = findMove(game); }
      expect(matchPair(game, move.a, move.b).ok).toBe(true);
    }
    expect(game.status).toBe('won'); expect(game.removed).toBe(36); expect(inventoryValid(game)).toBe(true);
    const score = game.score; expect(matchPair(game, 0, 1).ok).toBe(false); expect(game.score).toBe(score);
    expect(restore(serialize(game), 'mobile')).not.toBeNull();
  });
  it('restores valid progress only for its own page and rejects corrupted saves', () => {
    const game = newGame({platform:'mobile', seed:28}); startGame(game);
    const move=findMove(game); matchPair(game, move.a, move.b); pauseGame(game);
    expect(restore(serialize(game), 'mobile')).toEqual(game); expect(restore(serialize(game), 'pc')).toBeNull();
    const corruptions = [g=>g.board.pop(), g=>g.board[0]=99, g=>g.board[0]=1.5, g=>g.removed++,
      g=>g.hints=4, g=>g.shuffles=-1, g=>g.remainingMs=Infinity, g=>g.cols=99, g=>g.status='won',
      g=>g.version=9, g=>g.platform='other', g=>g.level=31, g=>g.mode='other'];
    for (const change of corruptions) { const clone = structuredClone(game); change(clone); expect(restore(clone)).toBeNull(); }
    expect(restore('not json')).toBeNull();
  });
});
