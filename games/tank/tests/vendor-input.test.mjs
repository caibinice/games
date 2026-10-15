// Upstream MIT tests; see ../public/assets/battle-city-license.html
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
beforeEach(()=>{
  vi.stubGlobal('document',new EventTarget());vi.stubGlobal('window',new EventTarget());
  vi.stubGlobal('KeyboardEvent',class extends Event {constructor(type,options={}){super(type,{cancelable:true});this.code=options.code;}});
});
afterEach(()=>vi.unstubAllGlobals());
import InputManager from "../src/vendor/input/InputManager";
import { PLAYER1_CONTROL, PLAYER2_CONTROL } from "../src/vendor/input/bindings";
const key = (type, code) => document.dispatchEvent(new KeyboardEvent(type, { code }));
describe("InputManager", () => {
  it("releaseAll \u540E\u4ECD\u6309\u7740\u7684\u952E\u5728\u677E\u5F00\u524D\u4E0D\u751F\u6548\uFF0C\u81EA\u52A8\u91CD\u590D\u7684 keydown \u4E5F\u5FFD\u7565", () => {
    const input = new InputManager();
    input.attach();
    key("keydown", PLAYER1_CONTROL.fire);
    key("keydown", PLAYER1_CONTROL.up);
    expect(input.consumeFire(PLAYER1_CONTROL)).toBe(true);
    input.releaseAll();
    expect(input.consumeFire(PLAYER1_CONTROL)).toBe(false);
    expect(input.lastPressed([PLAYER1_CONTROL.up])).toBeNull();
    key("keydown", PLAYER1_CONTROL.fire);
    expect(input.consumeFire(PLAYER1_CONTROL)).toBe(false);
    key("keyup", PLAYER1_CONTROL.fire);
    key("keydown", PLAYER1_CONTROL.fire);
    expect(input.consumeFire(PLAYER1_CONTROL)).toBe(true);
    input.detach();
  });
  it("touched\uFF1A\u81EA\u4E0A\u4E2A tick \u8D77\u6309\u8FC7\u8BE5\u73A9\u5BB6\u7684\u7ED1\u5B9A\u952E\uFF1B\u5176\u4ED6\u73A9\u5BB6\u7684\u952E\u3001Esc \u4E0D\u7B97\uFF1BendTick \u540E\u6E05\u7A7A", () => {
    const input = new InputManager();
    input.attach();
    key("keydown", "Escape");
    key("keydown", PLAYER2_CONTROL.up);
    expect(input.touched(PLAYER1_CONTROL)).toBe(false);
    key("keydown", PLAYER1_CONTROL.left);
    key("keyup", PLAYER1_CONTROL.left);
    expect(input.touched(PLAYER1_CONTROL)).toBe(true);
    input.endTick();
    expect(input.touched(PLAYER1_CONTROL)).toBe(false);
    input.detach();
  });
  it("releaseAll \u540E\u4ECD\u6309\u7740\u7684\u952E\uFF1A\u81EA\u52A8\u91CD\u590D\u7684 keydown \u7B97 touched\uFF0Cheld \u4E3A true\uFF0C\u4F46\u4E0D\u7B97\u6309\u4E0B", () => {
    const input = new InputManager();
    input.attach();
    key("keydown", PLAYER1_CONTROL.up);
    input.releaseAll();
    expect(input.touched(PLAYER1_CONTROL)).toBe(false);
    expect(input.held(PLAYER1_CONTROL)).toBe(true);
    key("keydown", PLAYER1_CONTROL.up);
    expect(input.touched(PLAYER1_CONTROL)).toBe(true);
    expect(input.isDown(PLAYER1_CONTROL.up)).toBe(false);
    key("keyup", PLAYER1_CONTROL.up);
    expect(input.held(PLAYER1_CONTROL)).toBe(false);
    input.detach();
  });
  it("\u4E24\u540D\u73A9\u5BB6\u7ED1\u5B9A\u4E86\u540C\u4E00\u4E2A\u952E\uFF1A\u6309\u4E0B\u7B97\u4E24\u4EBA\u90FD\u6709\u8F93\u5165", () => {
    const input = new InputManager();
    input.attach();
    const p2 = { ...PLAYER2_CONTROL, fire: PLAYER1_CONTROL.fire };
    key("keydown", PLAYER1_CONTROL.fire);
    expect(input.touched(PLAYER1_CONTROL)).toBe(true);
    expect(input.touched(p2)).toBe(true);
    input.detach();
  });
  it("\u7A97\u53E3\u5931\u7126\u65F6\u6E05\u7A7A\u8F93\u5165\uFF0C\u5305\u62EC releaseAll \u4E4B\u540E\u8FD8\u6CA1\u677E\u5F00\u7684\u952E", () => {
    const input = new InputManager();
    input.attach();
    key("keydown", PLAYER1_CONTROL.up);
    key("keydown", PLAYER1_CONTROL.fire);
    input.releaseAll();
    key("keydown", PLAYER1_CONTROL.left);
    window.dispatchEvent(new Event("blur"));
    expect(input.held(PLAYER1_CONTROL)).toBe(false);
    expect(input.consumeFire(PLAYER1_CONTROL)).toBe(false);
    input.detach();
  });
  it("\u6309\u5B9E\u9645\u952E\u4F4D\u62E6\u622A\u6D4F\u89C8\u5668\u9ED8\u8BA4\u884C\u4E3A\uFF1A\u5F00\u706B\u6539\u6210\u7A7A\u683C\u540E\u7A7A\u683C\u4E5F\u62E6\u622A", () => {
    const control = { ...PLAYER1_CONTROL, fire: "Space" };
    const input = new InputManager([control]);
    input.attach();
    const press = (code) => {
      const event = new KeyboardEvent("keydown", { code, cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press("Space")).toBe(true);
    expect(press("ArrowUp")).toBe(true);
    expect(press("KeyJ")).toBe(false);
    input.detach();
  });
});
