import { describe, it, expect } from 'vitest';
import * as Tank from '../games/tank/public/engine.mjs';
import * as Contra from '../games/contra/public/engine.mjs';
import * as Bubble from '../games/paopaotang/public/engine.mjs';
import * as Link from '../games/lianliankan/public/engine.mjs';
import { newDuel, pair, attack, remaining, stepDuel } from '../web/src/online/duel.mjs';
import { capture, hydrate, participants } from '../web/src/online/adapters.mjs';
const ticks = (engine, g, n, input = {}) => {
  for (let i = 0; i < n; i++) engine(g, 1000 / 60, input);
};
describe('Two player cooperative engines', () => {
  it('tank has two independent controls, spawns and shared terrain', () => {
    const g = Tank.newGame({ seed: 1, players: 2 });
    Tank.start(g);
    ticks(Tank.step, g, 180);
    expect(g.session.players).toHaveLength(2);
    let ps = g.session.scene.tanks.filter((t) => t.side === 'player');
    expect(ps).toHaveLength(2);
    const x = ps[0].x,
      y = ps[1].y;
    ticks(Tank.step, g, 18, { p1: {}, p2: { up: true, fire: true } });
    ps = g.session.scene.tanks.filter((t) => t.side === 'player');
    expect(ps[0].x).toBe(x);
    expect(ps[1].y).toBeLessThan(y);
    const f = JSON.parse(JSON.stringify(capture('tank', g))),
      restored = hydrate('tank', { engine: Tank }, f);
    expect(typeof restored.session.scene.map.forEachBrick).toBe('function');
    expect(JSON.stringify(f).length).toBeLessThan(96000);
    expect(participants('tank', restored)).toHaveLength(2);
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'contra level %i advances one shared clock with two independent players',
    (level) => {
      const g = Contra.newCoopGame({ seed: 5, level });
      Contra.start(g);
      const x = g.player.x,
        y = g.p2.player.y;
      ticks(Contra.stepCoop, g, 24, { p1: {}, p2: { right: true, fire: true, jump: true } });
      expect(g.clock).toBeCloseTo(400, 3);
      expect(g.player.x).toBe(x);
      expect(g.p2.player.x).toBeGreaterThan(x + 24);
      expect(g.p2.player.y).toBeLessThan(y);
      expect(g.bullets.some((b) => b.owner === 1)).toBe(true);
      const f = hydrate(
        'contra',
        { engine: Contra },
        JSON.parse(JSON.stringify(capture('contra', g))),
      );
      expect(f.stage).toBe(Contra.STAGES[level - 1]);
    },
  );
  it('contra losing one player keeps the partner alive; both out ends the round', () => {
    const g = Contra.newCoopGame({ seed: 2 });
    Contra.start(g);
    g.lives = 0;
    g.player.deadUntil = 1;
    ticks(Contra.stepCoop, g, 2);
    expect(g.player.out).toBe(true);
    expect(g.status).toBe('running');
    g.p2.lives = 0;
    g.p2.player.deadUntil = 1;
    ticks(Contra.stepCoop, g, 2);
    expect(g.status).toBe('lost');
  });
  it('bubble coop has two humans and guest bombs belong to p2', () => {
    const g = Bubble.newGame({ seed: 4, mode: 'duo', platform: 'pc' });
    Bubble.start(g);
    Bubble.step(g, 10, { p2: { bomb: true } });
    expect(g.players.filter((p) => p.team === 0)).toHaveLength(2);
    expect(g.bombs[0].owner).toBe('p2');
  });
});
describe('Link duel fair boards and item interference', () => {
  it('same initial board is a separate mutable copy and normal pair matching remains valid', () => {
    const g = newDuel(12);
    expect(g.players[0].board).toEqual(g.players[1].board);
    expect(g.players[0].board).not.toBe(g.players[1].board);
    const move = Link.findMove(g.players[0]);
    expect(pair(g, 0, move.a, move.b).ok).toBe(true);
    expect(remaining(g.players[0])).toBe(62);
    expect(remaining(g.players[1])).toBe(64);
  });
  it('freeze blocks matches for two seconds, then expires', () => {
    const g = newDuel(22),
      m = Link.findMove(g.players[1]);
    attack(g, 0, 1);
    expect(pair(g, 1, m.a, m.b).frozen).toBe(true);
    for (let i = 0; i < 21; i++) stepDuel(g, 100);
    expect(pair(g, 1, m.a, m.b).ok).toBe(true);
  });
  it('added tiles preserve even counts, solvability and the empty-board win rule', () => {
    const g = newDuel(41),
      p = g.players[1];
    for (let i = 0; i < 3; i++) {
      const m = Link.findMove(p);
      p.board[m.a] = p.board[m.b] = 0;
    }
    const before = remaining(p);
    attack(g, 0, 2);
    expect(remaining(p)).toBe(before + 4);
    for (let value = 1; value <= 12; value++)
      expect(p.board.filter((v) => v === value).length % 2).toBe(0);
    while (remaining(p)) {
      const m = Link.findMove(p);
      expect(m).toBeTruthy();
      p.board[m.a] = p.board[m.b] = 0;
    }
  });
  it('full board converts tile interference to mist, and attack cooldown caps chaining', () => {
    const g = newDuel(3);
    expect(attack(g, 0, 2)).toBe(true);
    expect(g.players[1].fogUntil).toBe(4000);
    expect(attack(g, 0, 1)).toBe(false);
  });
  it('first empty board wins immediately; timeout compares remaining tiles and ties', () => {
    const g = newDuel(2),
      p = g.players[0];
    p.board.fill(0);
    p.board[0] = p.board[1] = 5;
    expect(pair(g, 0, 0, 1).ok).toBe(true);
    expect(g.status).toBe('finished');
    expect(g.winner).toBe(0);
    const t = newDuel(7);
    t.clock = t.duration - 5;
    stepDuel(t, 10);
    expect(t.winner).toBe(-1);
  });
});
