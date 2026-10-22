import * as E from '../../../games/lianliankan/public/engine.mjs';
export const POWERS = {
  1: { icon: '❄', name: '冻结 2 秒' },
  2: { icon: '+4', name: '补牌干扰' },
  3: { icon: '☁', name: '迷雾 4 秒' },
};
export function newDuel(seed) {
  const board = E.generateBoard(8, 8, 12, seed).board;
  const players = [0, 1].map(() => ({
    ...E.newGame({ platform: 'mobile', mode: 'zen', seed }),
    cols: 8,
    rows: 8,
    board: [...board],
    status: 'running',
    removed: 0,
    frozenUntil: 0,
    fogUntil: 0,
    lastAttack: -5000,
    lastEffect: '',
    matched: 0,
  }));
  return {
    kind: 'duel',
    status: 'running',
    clock: 0,
    duration: 180000,
    seed: seed >>> 0,
    players,
    winner: null,
    eventId: 0,
    effect: null,
  };
}
function rng(g) {
  let v = (g.seed += 0x6d2b79f5);
  v = Math.imul(v ^ (v >>> 15), v | 1);
  v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
  g.seed >>>= 0;
  return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
}
export function remaining(p) {
  return p.board.filter(Boolean).length;
}
export function attack(g, slot, type) {
  const p = g.players[slot],
    target = g.players[1 - slot];
  if (!POWERS[type] || g.clock - p.lastAttack < 2500) return false;
  p.lastAttack = g.clock;
  let actual = type;
  if (type === 1) target.frozenUntil = Math.max(target.frozenUntil, g.clock + 2000);
  else if (type === 2) {
    const empty = target.board.flatMap((v, i) => (v ? [] : [i]));
    const pairs = Math.min(2, Math.floor(empty.length / 2));
    if (pairs) {
      const next = [...target.board];
      for (let i = 0; i < pairs; i++) {
        const value = 4 + Math.floor(rng(g) * 9);
        next[empty[i * 2]] = next[empty[i * 2 + 1]] = value;
      }
      const inventory = [];
      for (let value = 1; value <= 12; value++)
        for (let k = 0, n = next.filter((v) => v === value).length / 2; k < n; k++)
          inventory.push(value);
      target.board = E.arrangeBoard(next, 8, 8, inventory, () => rng(g)).board;
      target.removed = 64 - remaining(target);
    } else {
      target.fogUntil = g.clock + 4000;
      actual = 3;
    }
  } else target.fogUntil = g.clock + 4000;
  target.lastEffect = POWERS[actual].name;
  g.effect = { id: ++g.eventId, from: slot, to: 1 - slot, type: actual, at: g.clock };
  return true;
}
export function pair(g, slot, a, b) {
  if (g.status !== 'running' || ![0, 1].includes(slot)) return { ok: false };
  const p = g.players[slot];
  if (p.frozenUntil > g.clock) return { ok: false, frozen: true };
  p.elapsedMs = g.clock;
  p.status = 'running';
  p.removed = 64 - remaining(p);
  const type = p.board[a],
    result = E.matchPair(p, a, b);
  if (!result.ok) return result;
  p.matched++;
  if (!remaining(p)) {
    g.status = 'finished';
    g.winner = slot;
  } else {
    attack(g, slot, type);
    if (!E.findMove(p)) E.shuffleBoard(p, { automatic: true, seed: ++g.seed });
  }
  return result;
}
export function stepDuel(g, ms) {
  if (g.status !== 'running') return;
  g.clock += Math.max(0, Math.min(100, ms));
  if (g.clock >= g.duration) {
    const a = remaining(g.players[0]),
      b = remaining(g.players[1]);
    g.status = 'finished';
    g.winner = a === b ? -1 : a < b ? 0 : 1;
  }
}
