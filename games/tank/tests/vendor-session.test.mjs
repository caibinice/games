import './dom-fixture.mjs';
// Upstream MIT tests; see ../public/assets/battle-city-license.html
import { describe, expect, it } from "vitest";
import { STEP_MS } from "../src/vendor/engine/Game";
import { botSpawnInterval, frame, SNOW_SLIDE_START } from "../src/vendor/engine/constants";
import { PLAYER1_CONTROL } from "../src/vendor/input/bindings";
import { killAllBots, makeStage, P1, P2, runUntilPlaying, runUntilSpawned, setup } from "./vendor-helpers.mjs";
describe("GameSession", () => {
  it("\u5165\u573A\u5E55\u5E03\uFF1A\u5408\u62E2\u540E\u8F7D\u5165\u5730\u56FE\u5E76\u64AD\u653E stage_start\uFF0C\u5C55\u5F00\u540E\u5F00\u6218", () => {
    const { session, sounds, run } = setup([makeStage("1")]);
    expect(session.phase).toBe("enter");
    expect(session.scene).toBeNull();
    run(250);
    expect(session.curtain).toBeGreaterThan(0.4);
    expect(session.curtain).toBeLessThan(1);
    expect(session.scene).toBeNull();
    run(600);
    expect(session.curtain).toBe(1);
    expect(session.scene).not.toBeNull();
    expect(sounds).toContain("stage_start");
    expect(session.scene.tanks).toHaveLength(0);
    runUntilPlaying(session, run);
    expect(session.curtain).toBe(0);
    expect(session.hudVisible).toBe(true);
    expect(session.players[0].lives).toBe(2);
  });
  it("\u8FC7\u5173\uFF1A\u5EF6\u65F6 4s \u2192 \u7ED3\u7B97 \u2192 \u4E0B\u4E00\u5173\uFF0C\u5B58\u6D3B\u5766\u514B\u7B49\u7EA7\u4E0E\u5206\u6570\u8DE8\u5173\u4FDD\u7559\u4E14\u4E0D\u6263\u547D", () => {
    const { session, run } = setup([makeStage("1"), makeStage("2")]);
    runUntilPlaying(session, run);
    runUntilSpawned(session, run);
    const player = session.scene.tanks.find((t) => t.side === "player");
    player.level = "power";
    session.players[0].score = 1200;
    killAllBots(session);
    run(3900);
    expect(session.phase).toBe("playing");
    run(200);
    expect(session.phase).toBe("statistics");
    expect(session.hudVisible).toBe(false);
    while (session.phase === "statistics") run(STEP_MS);
    expect(session.phase).toBe("enter");
    expect(session.stageIndex).toBe(1);
    expect(session.players[0].reservedTankLevel).toBe("power");
    runUntilPlaying(session, run);
    runUntilSpawned(session, run);
    const next = session.scene.tanks.find((t) => t.side === "player");
    expect(next.level).toBe("power");
    expect(session.players[0].lives).toBe(2);
    expect(session.players[0].score).toBe(1200);
    expect(session.players[0].reservedTankLevel).toBeNull();
  });
  it("\u901A\u5173\uFF1A\u6700\u540E\u4E00\u5173\u7ED3\u7B97\u5B8C\u76F4\u63A5\u8FDB\u5165 ended\uFF0C\u4E0D\u64AD GAME OVER", () => {
    const { session, sounds, run } = setup([makeStage("1")]);
    runUntilPlaying(session, run);
    runUntilSpawned(session, run);
    killAllBots(session);
    run(4100);
    while (session.phase === "statistics") run(STEP_MS);
    expect(session.phase).toBe("ended");
    expect(session.cleared).toBe(true);
    expect(sounds).not.toContain("game_over");
  });
  it("\u8001\u9E70\u88AB\u6BC1\uFF1A\u4E0D\u8FDB\u7ED3\u7B97\uFF0C\u76F4\u63A5\u64AD\u653E GAME OVER\uFF0C\u7ED3\u675F\u540E\u8FDB\u5165 ended", () => {
    const { session, sounds, run } = setup([makeStage("1")]);
    runUntilPlaying(session, run);
    session.scene.map.eagleBroken = true;
    run(STEP_MS);
    expect(session.phase).toBe("gameover");
    expect(sounds).toContain("game_over");
    expect(session.statistics).toBeNull();
    run(1e3);
    expect(session.gameoverProgress).toBeCloseTo(0.5, 1);
    run(3900);
    expect(session.phase).toBe("gameover");
    run(200);
    expect(session.phase).toBe("ended");
  });
  it("\u7ED3\u7B97\uFF1A\u6309\u7B49\u7EA7\u9010\u884C\u9012\u589E\u51FB\u6740\u6570\uFF0C\u6700\u540E\u663E\u793A TOTAL", () => {
    const { session, sounds, run } = setup([makeStage("1")]);
    runUntilPlaying(session, run);
    runUntilSpawned(session, run);
    session.scene.killInfo[0].fast = 3;
    killAllBots(session);
    run(4e3 + STEP_MS);
    expect(session.phase).toBe("statistics");
    const view = session.statistics;
    expect(view.counts[0].basic).toBe(-1);
    run(760);
    expect(view.counts[0].basic).toBe(0);
    expect(view.counts[0].fast).toBe(-1);
    run(400);
    expect(view.counts[0].fast).toBe(-1);
    while (view.counts[0].fast === -1) run(STEP_MS);
    expect(view.counts[0].fast).toBe(1);
    run(160);
    expect(view.counts[0].fast).toBe(2);
    run(160);
    expect(view.counts[0].fast).toBe(3);
    expect(view.showTotal).toBe(false);
    while (!view.showTotal) run(STEP_MS);
    expect(view.counts[0]).toEqual({ basic: 0, fast: 3, power: 0, armor: 0 });
    expect(sounds.filter((s) => s === "statistics_1")).toHaveLength(7);
  });
  it("\u51FA\u751F\uFF1A\u95EA\u70C1\u64AD\u5B8C\u5766\u514B\u624D\u8FDB\u5165\u6218\u573A\uFF0C\u73A9\u5BB6\u5E26\u5934\u76D4\uFF1Bbot \u5F00\u5C40\u7ACB\u5373\u51FA\u751F", () => {
    const { session, run } = setup([makeStage("1", ["3*basic"])]);
    runUntilPlaying(session, run);
    const scene = session.scene;
    run(STEP_MS);
    expect(scene.tanks).toHaveLength(0);
    expect(scene.flickers).toHaveLength(2);
    expect(scene.remainingBotCount).toBe(2);
    run(580);
    expect(scene.tanks).toHaveLength(0);
    run(50);
    const player = scene.tanks.find((t) => t.side === "player");
    expect(player.helmetDuration).toBeGreaterThan(0);
    expect(scene.tanks.some((t) => t.side === "bot")).toBe(false);
    run(320);
    expect(scene.tanks.filter((t) => t.side === "bot")).toHaveLength(1);
  });
  it("bot \u51FA\u751F\uFF1A\u6309\u95F4\u9694\u8F6E\u6D41\u4F7F\u7528 \u4E2D \u2192 \u53F3 \u2192 \u5DE6 \u51FA\u751F\u70B9\uFF0C\u540C\u5C4F\u6700\u591A 4 \u8F86", () => {
    const { session, run } = setup([makeStage("1", ["6*basic"])]);
    runUntilPlaying(session, run);
    const scene = session.scene;
    const spawnXs = [];
    const seen = /* @__PURE__ */ new Set();
    const runAndRecord = (ms) => {
      for (let t = 0; t < ms; t += STEP_MS) {
        run(STEP_MS);
        scene.bullets.length = 0;
        for (const f of scene.flickers) {
          if (f.tank.side === "bot" && !seen.has(f.id)) {
            seen.add(f.id);
            spawnXs.push(f.x);
          }
        }
      }
    };
    runAndRecord(3e3);
    expect(spawnXs).toEqual([96]);
    runAndRecord(200);
    expect(spawnXs).toEqual([96, 192]);
    runAndRecord(3100);
    expect(spawnXs).toEqual([96, 192, 0]);
    runAndRecord(1e4);
    expect(spawnXs).toEqual([96, 192, 0, 96]);
    expect(scene.remainingBotCount).toBe(2);
  });
  it("bot \u51FA\u751F\u95F4\u9694\uFF1A190 \u2212 4 \xD7 \u5173\u5361\u53F7\u5E27\uFF0C\u53CC\u4EBA\u51CF 20\uFF0C\u7B2C 35 \u5173\u4E4B\u540E\u4E0D\u518D\u7F29\u77ED", () => {
    expect(botSpawnInterval(1, false)).toBeCloseTo(frame(186));
    expect(botSpawnInterval(1, true)).toBeCloseTo(frame(166));
    expect(botSpawnInterval(35, false)).toBeCloseTo(frame(50));
    expect(botSpawnInterval(50, false)).toBeCloseTo(frame(50));
  });
  it("\u6700\u540E\u4E00\u6761\u547D\u6B63\u5728\u51FA\u751F\u65F6\u4E0D\u5224\u8D1F", () => {
    const { session, run } = setup([makeStage("1")]);
    session.players[0].lives = 1;
    runUntilPlaying(session, run);
    expect(session.players[0].lives).toBe(0);
    run(300);
    expect(session.scene.status).toBe("playing");
  });
  it("\u53CC\u4EBA\uFF1A\u6CA1\u547D\u7684\u73A9\u5BB6\u6309\u5F00\u706B\u952E\u5411\u961F\u53CB\u501F\u547D", () => {
    const { session, run, input } = setup([makeStage("1")], [P1, P2]);
    runUntilPlaying(session, run);
    runUntilSpawned(session, run);
    const scene = session.scene;
    session.players[0].lives = 0;
    scene["killPlayer"](scene["players"][0]);
    run(1e3);
    expect(scene["players"][0].flicker).toBeNull();
    expect(scene.status).toBe("playing");
    expect(scene.canBorrowLife).toEqual([true, false]);
    input.attach();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: PLAYER1_CONTROL.fire }));
    run(STEP_MS);
    document.dispatchEvent(new KeyboardEvent("keyup", { code: PLAYER1_CONTROL.fire }));
    input.detach();
    expect(session.players[1].lives).toBe(1);
    expect(session.players[0].lives).toBe(0);
    expect(scene["players"][0].flicker).not.toBeNull();
    expect(scene.canBorrowLife).toEqual([false, false]);
  });
  it("\u51B0\u9762\u6ED1\u884C\uFF1AP1 \u5728\u96EA\u5730\u4E0A\u70B9\u6309\u4E00\u6B21\u65B9\u5411\u952E\uFF0C\u677E\u5F00\u540E\u7EE7\u7EED\u6ED1\u884C", () => {
    const snow = { "9,4": "S", "10,4": "S", "11,4": "S", "12,4": "S" };
    const { session, sounds, run, input } = setup([makeStage("1", ["1*basic"], snow)]);
    runUntilPlaying(session, run);
    runUntilSpawned(session, run);
    const tank = session.scene.tanks.find((t) => t.side === "player");
    const y = tank.y;
    input.attach();
    document.dispatchEvent(new KeyboardEvent("keydown", { code: PLAYER1_CONTROL.up }));
    run(STEP_MS);
    document.dispatchEvent(new KeyboardEvent("keyup", { code: PLAYER1_CONTROL.up }));
    input.detach();
    expect(sounds).toContain("snow_slide");
    run(1e3);
    expect(y - tank.y).toBeCloseTo(0.75 + SNOW_SLIDE_START, 1);
  });
});
