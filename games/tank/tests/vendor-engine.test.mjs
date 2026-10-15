// Upstream MIT tests; see ../public/assets/battle-city-license.html
import { describe, expect, it } from "vitest";
import Bullet, { resetBulletIds } from "../src/vendor/engine/entities/Bullet";
import ScorePopup from "../src/vendor/engine/entities/ScorePopup";
import Tank from "../src/vendor/engine/entities/Tank";
import TerrainMap from "../src/vendor/engine/map/TerrainMap";
import { expandBots } from "../src/vendor/engine/map/parseStage";
import {
  ceil8,
  floor8,
  getDirectionInfo,
  isPerpendicular,
  round8,
  testCollide
} from "../src/vendor/engine/physics/geometry";
import { canTankMove } from "../src/vendor/engine/physics/collision";
import { getBulletCollision, getMBR, spreadBullet } from "../src/vendor/engine/physics/bullet-collision";
import { buildSpots } from "../src/vendor/engine/ai/spots";
import { findPath } from "../src/vendor/engine/ai/pathfinding";
import PathFollower from "../src/vendor/engine/ai/path-follower";
import { getTankSpot, spotToTankPos } from "../src/vendor/engine/ai/spots";
import { getAIFireCount, getFireResist } from "../src/vendor/engine/ai/fire-estimate";
import { updateBullets } from "../src/vendor/engine/systems/bullet";
import { fireTank } from "../src/vendor/engine/systems/fire";
import { STEP_MS } from "../src/vendor/engine/Game";
import { applyInput, applyPlayerMove } from "../src/vendor/engine/systems/movement";
import { bulletInterval, bulletLimit, bulletPower, moveSpeed } from "../src/vendor/engine/values";
import { SNOW_SLIDE_LOCK, SNOW_SLIDE_START } from "../src/vendor/engine/constants";
function makeMap(overrides = {}) {
  const map = [];
  for (let row = 0; row < 13; row += 1) {
    const items = [];
    for (let col = 0; col < 13; col += 1) {
      items.push(overrides[`${row},${col}`] ?? "X");
    }
    map.push(items.join(" "));
  }
  const raw = { name: "t", difficulty: 1, map, bots: ["20*basic"] };
  return TerrainMap.fromRaw(raw);
}
describe("geometry", () => {
  it("round8 / floor8 / ceil8", () => {
    expect(round8(12)).toBe(16);
    expect(round8(11)).toBe(8);
    expect(floor8(12)).toBe(8);
    expect(ceil8(12)).toBe(16);
  });
  it("testCollide \u9608\u503C\uFF1A\u76F8\u63A5\u5728 -0.01 \u4E0B\u4E0D\u7B97\u78B0\u649E", () => {
    const a = { x: 0, y: 0, width: 16, height: 16 };
    const touching = { x: 16, y: 0, width: 16, height: 16 };
    expect(testCollide(a, touching, 0)).toBe(true);
    expect(testCollide(a, touching, -0.01)).toBe(false);
    expect(testCollide(a, { x: 8, y: 8, width: 4, height: 4 }, -0.01)).toBe(true);
  });
  it("isPerpendicular / getDirectionInfo", () => {
    expect(isPerpendicular("up", "left")).toBe(true);
    expect(isPerpendicular("up", "down")).toBe(false);
    expect(getDirectionInfo("up")).toEqual({ axis: "y", delta: -1 });
    expect(getDirectionInfo("right")).toEqual({ axis: "x", delta: 1 });
  });
});
describe("values\uFF08\u5766\u514B\u6570\u503C\u89C4\u683C\uFF09", () => {
  it("moveSpeed", () => {
    expect(moveSpeed(new Tank({ side: "player", x: 0, y: 0 }))).toBe(0.045);
    expect(moveSpeed(new Tank({ side: "bot", level: "fast", x: 0, y: 0 }))).toBe(0.06);
    expect(moveSpeed(new Tank({ side: "bot", level: "basic", x: 0, y: 0 }))).toBe(0.03);
  });
  it("bulletPower / bulletLimit / bulletInterval", () => {
    expect(bulletPower(new Tank({ side: "player", level: "armor", x: 0, y: 0 }))).toBe(3);
    expect(bulletPower(new Tank({ side: "bot", level: "power", x: 0, y: 0 }))).toBe(2);
    expect(bulletPower(new Tank({ side: "player", level: "basic", x: 0, y: 0 }))).toBe(1);
    expect(bulletLimit(new Tank({ side: "player", level: "power", x: 0, y: 0 }))).toBe(2);
    expect(bulletLimit(new Tank({ side: "bot", level: "power", x: 0, y: 0 }))).toBe(1);
    expect(bulletInterval(new Tank({ side: "player", level: "basic", x: 0, y: 0 }))).toBe(300);
    expect(bulletInterval(new Tank({ side: "player", level: "fast", x: 0, y: 0 }))).toBe(200);
  });
});
describe("canTankMove\uFF08\u5766\u514B\u78B0\u649E\uFF09", () => {
  it("\u7A7A\u5730\u53EF\u79FB\u52A8\uFF1B\u8D8A\u754C\u4E0D\u53EF\u79FB\u52A8", () => {
    const map = makeMap();
    const world = { map, tanks: [], restrictedAreas: [] };
    expect(canTankMove(world, new Tank({ side: "player", x: 32, y: 32 }))).toBe(true);
    expect(canTankMove(world, new Tank({ side: "player", x: -1, y: 32 }))).toBe(false);
    expect(canTankMove(world, new Tank({ side: "player", x: 193, y: 32 }))).toBe(false);
  });
  it("\u7816\u5757\u963B\u6321\uFF0C\u96EA\u5730\u53EF\u901A\u884C", () => {
    const brickMap = makeMap({ "2,2": "Bf" });
    const snowMap = makeMap({ "2,2": "S" });
    const tank = new Tank({ side: "player", x: 32, y: 32 });
    expect(canTankMove({ map: brickMap, tanks: [], restrictedAreas: [] }, tank)).toBe(false);
    expect(canTankMove({ map: snowMap, tanks: [], restrictedAreas: [] }, tank)).toBe(true);
  });
});
describe("movement\uFF08\u524D\u8FDB / \u8F6C\u5411\u5BF9\u9F50\uFF09", () => {
  it("\u524D\u8FDB\u6309 speed*delta \u79FB\u52A8\uFF1B\u8F6C\u5411\u540E\u9884\u7559\u5750\u6807\u5BF9\u9F50\u5230 8 \u7684\u500D\u6570", () => {
    const map = makeMap();
    const world = { map, tanks: [], restrictedAreas: [] };
    const tank = new Tank({ side: "player", direction: "up", x: 40, y: 100 });
    applyInput(world, tank, { type: "forward" }, 1e3 / 60);
    expect(tank.y).toBeCloseTo(100 - 0.045 * (1e3 / 60), 5);
    expect(tank.ry % 8).toBe(0);
  });
  it("\u88AB\u8FB9\u754C\u963B\u6321\u65F6\u56DE\u9000", () => {
    const map = makeMap();
    const tank = new Tank({ side: "player", direction: "left", x: 0, y: 32 });
    applyInput({ map, tanks: [], restrictedAreas: [] }, tank, { type: "forward" }, 1e3 / 60);
    expect(tank.x).toBe(0);
  });
  it("\u8F6C\u5411\u53EA\u6539\u53D8\u671D\u5411", () => {
    const map = makeMap();
    const tank = new Tank({ side: "player", direction: "up", x: 32, y: 32 });
    applyInput(
      { map, tanks: [], restrictedAreas: [] },
      tank,
      { type: "turn", direction: "right" },
      1e3 / 60
    );
    expect(tank.direction).toBe("right");
  });
});
describe("snow slide\uFF08\u51B0\u9762\u6ED1\u884C\uFF09", () => {
  const TICK = 1e3 / 60;
  const STEP = 0.045 * TICK;
  const FORWARD = { type: "forward" };
  const LOCK_TICKS = Math.ceil((SNOW_SLIDE_START - SNOW_SLIDE_LOCK) / STEP);
  function setup(overrides = {}, snow = true) {
    const cells = {};
    if (snow) {
      for (let row = 2; row <= 10; row += 1) {
        for (let col = 2; col <= 5; col += 1) cells[`${row},${col}`] = "S";
      }
    }
    const map = makeMap({ ...cells, ...overrides });
    const world = { map, tanks: [], restrictedAreas: [] };
    const sounds = [];
    const tank = new Tank({ side: "player", direction: "up", x: 32, y: 128 });
    const move = (input) => applyPlayerMove(world, tank, input, TICK, { play: (name) => sounds.push(name) });
    return { map, tank, sounds, move };
  }
  it("isSnowAt\uFF1A\u6309 16px \u683C\u5224\u5B9A\uFF0C\u8D8A\u754C\u4E3A false", () => {
    const map = makeMap({ "3,4": "S" });
    expect(map.isSnowAt(4 * 16, 3 * 16)).toBe(true);
    expect(map.isSnowAt(5 * 16 - 1, 4 * 16 - 1)).toBe(true);
    expect(map.isSnowAt(4 * 16 - 1, 3 * 16)).toBe(false);
    expect(map.isSnowAt(-1, 0)).toBe(false);
    expect(map.isSnowAt(13 * 16, 0)).toBe(false);
  });
  it("\u4EE5\u5766\u514B\u4E2D\u5FC3\u6240\u5728\u683C\u5224\u5B9A\u662F\u5426\u5728\u51B0\u4E0A", () => {
    const outside = setup({ "5,2": "S" }, false);
    outside.tank.y = 96 - 7;
    outside.move(FORWARD);
    expect(outside.tank.slide).toBe(0);
    const inside = setup({ "5,2": "S" }, false);
    inside.tank.y = 96 - 9;
    inside.move(FORWARD);
    expect(inside.tank.slide).toBe(SNOW_SLIDE_START);
  });
  it("\u51B0\u4E0A\u8D77\u6ED1\uFF1A\u6ED1\u884C\u91CF\u7F6E\u6EE1\u5E76\u64AD\u653E\u97F3\u6548\uFF0C\u672C tick \u6B63\u5E38\u524D\u8FDB", () => {
    const { tank, sounds, move } = setup();
    move(FORWARD);
    expect(tank.slide).toBe(SNOW_SLIDE_START);
    expect(sounds).toEqual(["snow_slide"]);
    expect(tank.y).toBeCloseTo(128 - STEP, 5);
  });
  it("\u9501\u5B9A\u671F\u5FFD\u7565\u65B9\u5411\u952E\uFF0C\u6CBF\u671D\u5411\u524D\u8FDB\uFF1B\u9501\u5B9A\u671F\u8FC7\u540E\u8F6C\u5411\u751F\u6548", () => {
    const { tank, move } = setup();
    move(FORWARD);
    for (let i = 0; i < LOCK_TICKS; i += 1) {
      move({ type: "turn", direction: "right" });
      expect(tank.direction).toBe("up");
    }
    expect(tank.y).toBeCloseTo(128 - (LOCK_TICKS + 1) * STEP, 5);
    expect(tank.slide).toBeLessThanOrEqual(SNOW_SLIDE_LOCK);
    move({ type: "turn", direction: "right" });
    expect(tank.direction).toBe("right");
  });
  it("\u70B9\u6309\u4E00\u6B21\uFF1A\u8D70 1 \u6B65\u540E\u6ED1\u6EE1\u6ED1\u884C\u91CF\u505C\u4E0B", () => {
    const { tank, move } = setup();
    move(FORWARD);
    for (let i = 0; i < 60; i += 1) move(null);
    expect(128 - tank.y).toBeCloseTo(STEP + SNOW_SLIDE_START, 5);
    expect(tank.slide).toBe(0);
  });
  it("\u89E3\u9501\u540E\u6309\u4F4F\u524D\u8FDB\uFF1A\u6B63\u5E38\u884C\u9A76\uFF0C\u6ED1\u884C\u91CF\u4E0D\u53D8\uFF0C\u5C65\u5E26\u8F6C\u52A8", () => {
    const { tank, move } = setup();
    for (let i = 0; i < LOCK_TICKS + 1; i += 1) move(FORWARD);
    const slide = tank.slide;
    const y = tank.y;
    move(FORWARD);
    expect(tank.slide).toBe(slide);
    expect(tank.y).toBeCloseTo(y - STEP, 5);
    expect(tank.moving).toBe(true);
  });
  it("\u89E3\u9501\u540E\u8F6C\u5411\u518D\u677E\u624B\uFF1A\u6CBF\u65B0\u671D\u5411\u6ED1\u884C\uFF0C\u8F6C\u5411\u65F6\u5750\u6807\u5BF9\u9F50\u5230 8 \u7684\u500D\u6570", () => {
    const { tank, move } = setup();
    for (let i = 0; i < LOCK_TICKS + 1; i += 1) move(FORWARD);
    move({ type: "turn", direction: "right" });
    expect(tank.y % 8).toBe(0);
    const x = tank.x;
    move(null);
    expect(tank.direction).toBe("right");
    expect(tank.x).toBeCloseTo(x + STEP, 5);
    expect(tank.moving).toBe(false);
  });
  it("\u6ED1\u884C\u649E\u5899\uFF1A\u4F4D\u7F6E\u4E0D\u53D8\uFF0C\u6ED1\u884C\u91CF\u7167\u6837\u9012\u51CF\u5230 0", () => {
    const { tank, move } = setup({ "7,2": "Bf" });
    move(FORWARD);
    expect(tank.y).toBe(128);
    for (let i = 0; i < Math.ceil(SNOW_SLIDE_START / STEP); i += 1) move(null);
    expect(tank.y).toBe(128);
    expect(tank.slide).toBe(0);
  });
  it("\u9501\u5B9A\u671F\u51B2\u51FA\u51B0\u9762\uFF1A\u7ACB\u5373\u6062\u590D\u64CD\u63A7\uFF0C\u5269\u4F59\u6ED1\u884C\u91CF\u4FDD\u7559\uFF1B\u56DE\u5230\u51B0\u9762\u540E\u91CD\u65B0\u9501\u5B9A", () => {
    const { tank, move } = setup({ "8,2": "S" }, false);
    tank.y = 125;
    move(FORWARD);
    while (tank.y + 8 >= 128) move(null);
    const slide = tank.slide;
    expect(slide).toBeGreaterThan(SNOW_SLIDE_LOCK);
    const y = tank.y;
    move(null);
    expect(tank.y).toBe(y);
    move({ type: "turn", direction: "right" });
    expect(tank.direction).toBe("right");
    expect(tank.slide).toBe(slide);
    tank.direction = "down";
    tank.y = 130;
    move({ type: "turn", direction: "left" });
    expect(tank.direction).toBe("down");
    expect(tank.y).toBeCloseTo(130 + STEP, 5);
  });
  it("\u5269\u4F59\u91CF\u4E0D\u8D85\u8FC7\u9501\u5B9A\u7EBF\u65F6\u56DE\u5230\u51B0\u9762\uFF1A\u6309\u952E\u6B63\u5E38\u884C\u9A76\u3001\u4E0D\u91CD\u65B0\u8D77\u6ED1\uFF0C\u677E\u624B\u6ED1\u5B8C\u5269\u4F59\u91CF", () => {
    const { tank, sounds, move } = setup();
    tank.slide = 5;
    move(FORWARD);
    expect(sounds).toEqual([]);
    expect(tank.slide).toBe(5);
    for (let i = 0; i < 20; i += 1) move(null);
    expect(tank.slide).toBe(0);
    expect(128 - tank.y).toBeCloseTo(STEP + 5, 5);
  });
  it("\u51B0\u4E0A\u88AB\u5B9A\u8EAB\uFF1A\u6309\u952E\u4E0D\u8D77\u6ED1\uFF0C\u5DF2\u6709\u6ED1\u884C\u91CF\u7167\u6837\u6ED1\u5B8C\uFF1B\u51B0\u9762\u5916\u5B9A\u8EAB\u4ECD\u53EF\u8F6C\u5411", () => {
    const frozen = setup();
    frozen.tank.frozenTimeout = 1e3;
    frozen.move(FORWARD);
    expect(frozen.tank.slide).toBe(0);
    expect(frozen.tank.y).toBe(128);
    frozen.tank.slide = 5;
    frozen.move(FORWARD);
    expect(frozen.tank.y).toBeCloseTo(128 - STEP, 5);
    const plain = setup({}, false);
    plain.tank.frozenTimeout = 1e3;
    plain.move({ type: "turn", direction: "left" });
    expect(plain.tank.direction).toBe("left");
  });
  it("\u666E\u901A\u5730\u9762\u4E0E applyInput \u7ED3\u679C\u4E00\u81F4\uFF0C\u4E0D\u64AD\u97F3\u6548", () => {
    const a = setup({}, false);
    const b = setup({}, false);
    const inputs = [
      FORWARD,
      FORWARD,
      { type: "turn", direction: "left" },
      FORWARD,
      null
    ];
    for (const input of inputs) {
      a.move(input);
      applyInput({ map: b.map, tanks: [], restrictedAreas: [] }, b.tank, input, TICK);
    }
    expect([a.tank.x, a.tank.y, a.tank.direction]).toEqual([b.tank.x, b.tank.y, b.tank.direction]);
    expect(a.sounds).toEqual([]);
    expect(a.tank.slide).toBe(0);
  });
});
describe("bullet \u78B0\u649E\uFF08MBR / \u5BF9\u649E\u6C42\u4EA4\uFF09", () => {
  it("getMBR \u53D6\u6700\u5C0F\u5305\u542B\u77E9\u5F62", () => {
    expect(
      getMBR({ x: 0, y: 0, width: 3, height: 3 }, { x: 10, y: 5, width: 3, height: 3 })
    ).toEqual({
      x: 0,
      y: 0,
      width: 13,
      height: 8
    });
  });
  it("spreadBullet \u6CBF\u5782\u76F4\u65B9\u5411\u6269\u5C55", () => {
    resetBulletIds();
    const up = new Bullet({
      side: "player",
      tankId: 1,
      direction: "up",
      speed: 0.12,
      power: 1,
      x: 10,
      y: 10
    });
    const r = spreadBullet(up);
    expect(r.width).toBeGreaterThan(3);
  });
  it("\u5E76\u6392\u540C\u5411\u98DE\u884C\u7684\u5B50\u5F39\u4E0D\u76F8\u649E", () => {
    resetBulletIds();
    const make = (x, speed) => {
      const b = new Bullet({
        side: "player",
        tankId: 1,
        direction: "up",
        speed,
        power: 1,
        x,
        y: 100
      });
      b.lastY = 102;
      return b;
    };
    expect(getBulletCollision(make(10, 0.12), make(12, 0.24), 17)).toBeNull();
  });
  it("\u5BF9\u5411\u98DE\u884C\u7684\u5B50\u5F39\u4F1A\u76F8\u649E", () => {
    resetBulletIds();
    const b1 = new Bullet({
      side: "player",
      tankId: 1,
      direction: "up",
      speed: 0.12,
      power: 1,
      x: 10,
      y: 10
    });
    b1.lastX = 10;
    b1.lastY = 16;
    const b2 = new Bullet({
      side: "bot",
      tankId: 2,
      direction: "down",
      speed: 0.12,
      power: 1,
      x: 10,
      y: 13
    });
    b2.lastX = 10;
    b2.lastY = 7;
    expect(getBulletCollision(b1, b2, 33)).not.toBeNull();
  });
});
describe("bullet \u547D\u4E2D\u5766\u514B", () => {
  function shootMate(helmetDuration) {
    const mate = new Tank({ side: "player", x: 96, y: 96, helmetDuration });
    const bullet = new Bullet({
      side: "player",
      tankId: -1,
      direction: "down",
      speed: 0.12,
      power: 1,
      x: 102,
      y: 90
    });
    const bullets = [bullet];
    const explosions = [];
    const hits = [];
    const audio = { play: () => {
    } };
    updateBullets(bullets, makeMap(), explosions, audio, 100, [mate], hits);
    return { hits, bullets, explosions };
  }
  it("\u961F\u53CB\u6234\u7740\u5934\u76D4\u65F6\u5B50\u5F39\u9759\u9ED8\u6D88\u5931\uFF0C\u4E0D\u7B97\u547D\u4E2D", () => {
    const { hits, bullets, explosions } = shootMate(1e3);
    expect(hits).toEqual([]);
    expect(bullets).toEqual([]);
    expect(explosions).toEqual([]);
  });
  it("\u961F\u53CB\u6CA1\u6234\u5934\u76D4\u65F6\u7B97\u547D\u4E2D", () => {
    expect(shootMate(0).hits).toHaveLength(1);
  });
  it("\u6765\u5F39\u5728\u70AE\u53E3\u88AB\u5BF9\u5C04\u62B5\u6D88\u540E\uFF0C\u540C\u4E00\u5E27\u91CC\u4E0D\u518D\u6253\u4E2D\u73A9\u5BB6", () => {
    const tank = new Tank({ side: "player", x: 80, y: 80, direction: "right" });
    const incoming = new Bullet({
      side: "bot",
      tankId: -1,
      direction: "left",
      speed: 0.24,
      power: 2,
      x: 98,
      y: 86
    });
    const bullets = [incoming];
    fireTank(tank, true, STEP_MS, bullets, { play: () => {
    } });
    const hits = [];
    updateBullets(bullets, makeMap(), [], { play: () => {
    } }, STEP_MS, [tank], hits);
    expect(bullets).toEqual([]);
    expect(hits).toEqual([]);
  });
});
describe("AI \u5BFB\u8DEF\uFF08BFS\uFF09", () => {
  it("\u7A7A\u5730\u53EF\u8FBE\uFF0C\u8DEF\u5F84\u9996\u5C3E\u6B63\u786E", () => {
    const spots = buildSpots(makeMap());
    const start = 5 * 26 + 5;
    const target = 8 * 26 + 10;
    const path = findPath(spots, start, target);
    expect(path).not.toBeNull();
    expect(path[0]).toBe(start);
    expect(path[path.length - 1]).toBe(target);
  });
  it("\u76EE\u6807\u4E0D\u53EF\u901A\u884C\u65F6\u8FD4\u56DE null", () => {
    const spots = buildSpots(makeMap());
    expect(findPath(spots, 5 * 26 + 5, 0)).toBeNull();
  });
});
describe("PathFollower", () => {
  const TICK = 1e3 / 60;
  it("\u6CBF\u8DEF\u5F84\u9010\u6BB5\u8F6C\u5411\u3001\u524D\u8FDB\uFF0C\u8D70\u5B8C\u8FD4\u56DE arrived \u5E76\u505C\u5728\u76EE\u6807 spot", () => {
    const map = makeMap();
    const world = { map, tanks: [], restrictedAreas: [] };
    const tank = new Tank({ side: "bot", direction: "down", x: 32, y: 32 });
    const target = 20 * 26 + 12;
    const follower = new PathFollower();
    expect(follower.begin(tank, findPath(buildSpots(map), getTankSpot(tank), target))).toBe(true);
    let status = "moving";
    for (let i = 0; i < 2e3 && status === "moving"; i += 1) {
      const result = follower.step(tank, TICK);
      applyInput(world, tank, result.move, TICK);
      status = result.status;
    }
    expect(status).toBe("arrived");
    expect({ x: tank.x, y: tank.y }).toEqual(spotToTankPos(target));
  });
  it("\u8FDE\u7EED 200ms \u6CA1\u6709\u4F4D\u79FB\u8FD4\u56DE blocked\uFF1B\u51BB\u7ED3\u671F\u95F4\u4E0D\u8BA1", () => {
    const map = makeMap();
    const tank = new Tank({ side: "player", direction: "up", x: 32, y: 32 });
    const path = findPath(buildSpots(map), getTankSpot(tank), 10 * 26 + 5);
    const follower = new PathFollower();
    follower.begin(tank, path);
    tank.frozenTimeout = 1e3;
    for (let i = 0; i < 30; i += 1) {
      expect(follower.step(tank, TICK).status).toBe("moving");
    }
    tank.frozenTimeout = 0;
    const statuses = [];
    for (let i = 0; i < 13; i += 1) statuses.push(follower.step(tank, TICK).status);
    expect(statuses.slice(0, 12).every((s) => s === "moving")).toBe(true);
    expect(statuses[12]).toBe("blocked");
  });
});
describe("fire-estimate", () => {
  it("getAIFireCount \u6309\u7816\u6570\u5206\u6863", () => {
    expect(
      getAIFireCount({ source: 0, target: 0, distance: 0, brickCount: 2, steelCount: 0 })
    ).toBe(1);
    expect(
      getAIFireCount({ source: 0, target: 0, distance: 0, brickCount: 4, steelCount: 0 })
    ).toBe(2);
    expect(
      getAIFireCount({ source: 0, target: 0, distance: 0, brickCount: 6, steelCount: 0 })
    ).toBe(2);
  });
  it("getFireResist\uFF1A\u94A2\u5757\u6743\u91CD\u4E3A 100", () => {
    expect(getFireResist({ source: 0, target: 0, distance: 0, brickCount: 1, steelCount: 1 })).toBe(
      101
    );
  });
});
describe("expandBots", () => {
  it("\u5C55\u5F00\u4E3A\u6309\u5E8F\u6392\u5217\u7684\u7B49\u7EA7\u961F\u5217", () => {
    expect(
      expandBots([
        { tankLevel: "basic", count: 2 },
        { tankLevel: "fast", count: 1 }
      ])
    ).toEqual(["basic", "basic", "fast"]);
  });
});
describe("ScorePopup", () => {
  it("\u5EF6\u65F6\u7ED3\u675F\u540E\u624D\u663E\u793A\uFF0C\u663E\u793A 48 \u5E27\u540E\u79FB\u9664", () => {
    const f = 1e3 / 60;
    const popup = new ScorePopup(100, 0, 0, 36 * f);
    popup.advance(35 * f);
    expect(popup.visible).toBe(false);
    popup.advance(2 * f);
    expect(popup.visible).toBe(true);
    popup.advance(46 * f);
    expect(popup.done).toBe(false);
    popup.advance(2 * f);
    expect(popup.done).toBe(true);
  });
});
