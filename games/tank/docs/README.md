# 坦克大战 · 35 关单人战役

入口 `/games/tank/` 自动分流；`pc.html` 和 `mobile.html` 可手动切换。只含单人模式。

- 35 个经典地图；每关 20 辆敌军，普通 / 高速 / 火力 / 装甲类型。
- 砖墙分块破坏、钢墙、河流、草丛遮挡、雪地滑行；老鹰被击中即失败。
- 星星升级、坦克加命、头盔、手雷、时钟、铁锹；出生保护、红色携带道具敌军、结算后连续下一关。
- WASD / 方向键移动，J / Z / 空格开火，P 暂停，F 全屏。最近按下方向优先，方向和开火可同时按住。
- 手机双指同时移动 / 开火；PC 原生全屏和无全屏 API 时的窗口内沉浸模式。
- PC / 手机独立存储 `fish-tank:pc:v1`、`fish-tank:mobile:v1`。保存最高分、完成记录和**当前关卡检查点**；刷新后从本关重新开始，不保存完整战场实体。

## 作弊 / 辅助（2026-10-16）

战场上方点「作弊」，或按 C。PC、手机、原生全屏 / 沉浸布局均可访问；打开时暂停，关闭后若原本在战斗则自动继续。
默认全部关闭，不改变经典规则。

- **无限坦克**：敌弹击毁坦克时返还一辆储备坦克，正常重生；老鹰仍会被摧毁，因此仍需守城。关闭后按当前有限生命继续。
- **超级连发**：按住开火约每 75ms 请求一发，最多同时 8 发玩家子弹；敌方射速与上限不变。
- **随机道具**：可手动立即生成，或开启战斗中每 8 秒自动生成；从六种经典道具随机选择，优先放在身边 20–56px 范围内可停留空地，无空位时放脚下。场上最多保留 6 个，走过去正常拾取。
- 选项随关卡检查点保留。`assisted` 为本局粘性标记，曾启用辅助或生成道具便单独记录最高分 / 完成关卡（`assistedBest` / `assistedRecords`），即使随后关闭也不混入经典成绩；关闭全部并重开后恢复经典计分。旧 v1 存档按原关卡恢复，辅助全关。

本地对上游新增了可选 `infiniteLives`、`rapidFire` 两个小扩展，未启用时维持原引擎路径；其余逻辑在本站适配层。

## 源码与素材

引擎、35 关布局、原生 Canvas 精灵绘制函数及 12 个 OGG 音效来源：
[feichao93/battle-city](https://github.com/feichao93/battle-city)，固定提交 `86c41c8c3c49cd27255bcf63167091d1061801fa`。
仅取无框架引擎、输入、地图、像素绘制和音效，未接入其 React / Pixi / 联机界面。
上游 MIT 许可完整保留于 `upstream-LICENSE.txt` 和运行页 `public/assets/battle-city-license.html`；原作名称及原作相关权利另行说明。

`src/engine.ts` / `src/renderer.ts` 为本站适配，`src/vendor/` 保持上游结构。
不依赖其他游戏源码、运行库 CDN、ROM 或模拟器。

```powershell
node games/tank/tools/build.mjs       # 修改 TS 后重新生成 public/engine.mjs / renderer.mjs
npm run check
npm test -- games/tank/tests
npm run build -- --games tank
```

`tools/browser-smoke.mjs` 通过 playwright-cli 的 run-code 在独立会话运行，覆盖键盘、暂停、关卡检查点、全屏、第 35 关、手机双指触控和屏宽适配。
上游引擎 / 输入 / 会话回归与本站单人适配回归共同覆盖 35 关。
