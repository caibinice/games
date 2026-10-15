// Upstream MIT tests; see ../public/assets/battle-city-license.html
import { describe, expect, it } from "vitest";
import { N_MAP } from "../src/vendor/engine/constants";
import { parseBrickBits, parseStage } from "../src/vendor/engine/map/parseStage";
import { stages } from "../src/vendor/stages";
describe("parseBrickBits", () => {
  it("\u5C55\u5F00 1 \u4F4D\u77ED\u683C\u5F0F\u5230 4 \u4E2A\u8C61\u9650", () => {
    expect(parseBrickBits("1")).toBe(61440);
    expect(parseBrickBits("2")).toBe(3840);
    expect(parseBrickBits("4")).toBe(240);
    expect(parseBrickBits("8")).toBe(15);
    expect(parseBrickBits("f")).toBe(65535);
  });
  it("\u4FDD\u7559 4 \u4F4D\u5B8C\u6574\u683C\u5F0F", () => {
    expect(parseBrickBits("ffff")).toBe(65535);
    expect(parseBrickBits("abcd")).toBe(43981);
  });
  it("\u975E\u6CD5 hex \u629B\u9519", () => {
    expect(() => parseBrickBits("abc")).toThrow();
  });
});
describe("parseStage", () => {
  it("\u5185\u7F6E 35 \u4E2A\u5173\u5361", () => {
    expect(stages).toHaveLength(35);
  });
  it("\u6240\u6709\u5173\u5361\u89E3\u6790\u65E0\u5F02\u5E38\uFF0C\u4E14\u8001\u9E70\u552F\u4E00\u5B58\u5728", () => {
    for (const raw of stages) {
      const parsed = parseStage(raw);
      expect(parsed.eagle, `stage ${raw.name} \u5E94\u6709\u8001\u9E70`).not.toBeNull();
      expect(parsed.bricks).toHaveLength(N_MAP.BRICK ** 2);
      expect(parsed.steels).toHaveLength(N_MAP.STEEL ** 2);
      expect(parsed.rivers).toHaveLength(N_MAP.RIVER ** 2);
    }
  });
  it("\u5730\u56FE\u51FA\u73B0\u4E24\u4E2A\u8001\u9E70\u65F6\u629B\u9519", () => {
    expect(
      () => parseStage({
        name: "bad",
        difficulty: 1,
        map: [
          "E  E  X  X  X  X  X  X  X  X  X  X  X  ",
          ...Array.from({ length: 12 }, () => "X  ".repeat(13))
        ],
        bots: ["20*basic"]
      })
    ).toThrow(/Eagle/);
  });
  it("stage-1 \u7684 bots \u4E3A 18 basic + 2 fast\uFF0C\u5408\u8BA1 20", () => {
    const s1 = stages.find((s) => String(s.name) === "1");
    const parsed = parseStage(s1);
    const total = parsed.bots.reduce((sum, g) => sum + g.count, 0);
    expect(total).toBe(20);
    expect(parsed.bots).toContainEqual({ tankLevel: "basic", count: 18 });
    expect(parsed.bots).toContainEqual({ tankLevel: "fast", count: 2 });
  });
  it("\u6BCF\u5173 bots \u5408\u8BA1\u4E3A 20", () => {
    for (const raw of stages) {
      const parsed = parseStage(raw);
      const total = parsed.bots.reduce((sum, g) => sum + g.count, 0);
      expect(total, `stage ${raw.name} bots \u5408\u8BA1`).toBe(20);
    }
  });
  it("\u6BCF\u7EC4\u6570\u91CF\u5FC5\u987B\u662F 0\u201399 \u7684\u6574\u6570", () => {
    const withBots = (bots) => ({ ...stages[0], bots });
    expect(() => parseStage(withBots(["99*basic", "0*fast"]))).not.toThrow();
    for (const bad of ["1e309*basic", "100*basic", "-1*basic", "1.5*basic"]) {
      expect(() => parseStage(withBots([bad])), bad).toThrow();
    }
  });
});
