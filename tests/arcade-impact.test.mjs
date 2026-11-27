import { expect, it } from 'vitest';
import * as Contra from '../games/contra/public/engine.mjs';
import * as Bubble from '../games/paopaotang/public/engine.mjs';
import * as Link from '../games/lianliankan/public/engine.mjs';
import * as Tank from '../games/tank/public/engine.mjs';
import Explosion from '../games/tank/src/vendor/engine/entities/Explosion.ts';
import { capture } from '../web/src/online/adapters.mjs';
import { newDuel, pair } from '../web/src/online/duel.mjs';

it('sends a finite directional spark for a real Contra hit, not a cosmetic damage event', () => {
  const g = Contra.newCoopGame({ level: 2, seed: 10 });
  expect(capture('contra', g).impacts).toBeUndefined();
  Contra.start(g);
  for (let i = 0; i < 60 && !g.impacts.length; i++)
    Contra.stepCoop(g, 16, { p2: { fire: false }, p1: { fire: true } });
  expect(g.cores[0].hp).toBe(g.cores[0].maxHP - 1);
  expect(g.events).toContainEqual({ type: 'sound', name: 'impact' });
  const hit = g.impacts[0];
  expect(hit).toMatchObject({ x: 128, heavy: true, bornAt: g.clock });
  expect(hit.angle).toBeCloseTo(Math.PI / 2);
  expect(capture('contra', g).impacts[0].angle).toBeCloseTo(Math.PI / 2, 2);
  expect(JSON.parse(Contra.serialize(g)).impacts).toBeUndefined();
  g.bullets = []; // Isolate this impact from later projectiles.
  for (let i = 0; i < 17; i++) Contra.stepCoop(g, 16);
  expect(g.impacts).toHaveLength(0);
});

it('includes only genuinely destroyed crates and preserves the water damage window', () => {
  const g = Bubble.newGame({ seed: 9 });
  g.board = g.board.map((v) => (v === Bubble.CRATE ? Bubble.EMPTY : v));
  const target = Bubble.indexOf(g, 2, 1);
  g.board[target] = Bubble.CRATE;
  Bubble.start(g);
  Bubble.applyInput(g, 'p1', { bomb: true });
  for (let i = 0; i < Bubble.FUSE_MS / 10; i++) Bubble.step(g, 10, {}, { ai: false });
  const wave = g.blasts[0];
  expect(wave.broken).toEqual([target]);
  expect(wave.cells).toContain(target);
  expect(g.board[target]).toBe(Bubble.EMPTY);
  expect(wave.damageUntil - wave.bornAt).toBe(220);
  expect(wave.expiresAt - wave.bornAt).toBe(360);
  expect(capture('paopaotang', g).blasts[0].broken).toEqual([target]);
});

it('keeps exactly the latest confirmed path per Link Duel player and ignores failed pairs', () => {
  const g = newDuel(12);
  expect(g.lastMatches).toEqual([null, null]);
  const m = Link.findMove(g.players[0]),
    fruit = g.players[0].board[m.a];
  expect(pair(g, 0, m.a, m.a).ok).toBe(false);
  expect(g.lastMatches).toEqual([null, null]);
  const result = pair(g, 0, m.a, m.b);
  expect(result.ok).toBe(true);
  expect(capture('lianliankan', g).lastMatches).toEqual([
    { id: 1, path: result.path, points: result.points, combo: result.combo, fruit },
    null,
  ]);
});

it('exports tank explosion age and type without changing its animation lifetime', () => {
  const g = Tank.newGame({ seed: 1 });
  Tank.start(g);
  for (let i = 0; i < 180; i++) Tank.step(g, 1000 / 60);
  const hit = new Explosion({ x: 64, y: 70 }, 'big');
  hit.advance(52);
  g.session.scene.explosions.push(hit);
  expect(capture('tank', g).session.scene.explosions.at(-1)).toEqual({
    cx: 64,
    cy: 70,
    kind: 'big',
    age: 52,
    shapeValue: hit.shape(),
  });
  expect(hit.done).toBe(false);
});
