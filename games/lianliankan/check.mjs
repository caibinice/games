import {newGame, inventoryValid, generateBoard, findPath, restore, serialize, DIFFICULTIES, LEVEL_COUNT} from './public/engine.mjs';
import {FRUITS} from './public/fruits.mjs';
export function check() {
  if (FRUITS.length !== 16 || LEVEL_COUNT !== 30) throw Error('Fruit Link catalogue mismatch');
  for (const platform of ['pc', 'mobile']) for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const game = newGame({platform, difficulty, level, seed: 100 + level});
      if (!inventoryValid(game) || !restore(serialize(game), platform)) throw Error('Invalid Fruit Link inventory');
    }
    const [cols, rows] = DIFFICULTIES[difficulty][platform];
    const {board, solution} = generateBoard(cols, rows, 16, 82);
    for (const [a, b] of solution) { if (!findPath({board, cols, rows}, a, b)) throw Error('Unsolvable board'); board[a] = board[b] = 0; }
  }
}
