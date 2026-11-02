# 浏览器验收片段

- `zombie-gun-combat.mjs`：本地预览中验证齐射与延迟连发组合、火/电/冰命中状态和实际子弹绘制，再进入手机战斗检查脚本错误；在已进入主页的独立测试会话运行。
- `zombie-seasonal-items.mjs`：390×844，验证十格季节转盘、三指针、奖励存档和源随机宝石道具使用；要求浏览器启动参数包含 `--mute-audio`。
- `zombie-egg-lottery.mjs`：390×844，验证普通扭蛋和龙舟祈愿的七层展示、每层四项、当前层滚动定位、选奖归零、待领奖禁止再抽及两活动独立存档；要求 `--mute-audio`。截图写入 E 盘专用工作目录。
- `zombie-board-lotteries.mjs`：静音独立会话，验证废墟寻宝原生四格起层、十次推进、阶段三选一与任务奖励、防重复领奖；验证寻星访月七星七月、自选保存、连抽触发月盘即停，以及 390×844、844×390、1366×768 的按钮可见性。

这些文件是 Playwright CLI 的 `run-code` 函数，不是 Vitest / Playwright Test 测试规范。使用独立会话、已构建的本地预览。先打开并检查对应页面快照，再执行：

```powershell
$code=(Get-Content E:/codes/games/tests/browser/racer-pc.mjs -Raw).TrimEnd().TrimEnd(';')
playwright-cli -s=games-check run-code $code
playwright-cli -s=games-check eval 'window.__qaResult'
```

- `classic-touch.mjs`：打开坦克或魂斗罗的手机版；自动测试竖屏虚拟旋转、CDP 多指移动 / 射击 / 跳跃、松手、横握、退出、刷新辅助存档。使用新建或暂停状态的验证局。
- `racer-pc.mjs`：1440×900，打开赛车 PC 页并等资源就绪；测试键盘变道、腾空侧滚、归零落地与全屏。
- `racer-mobile.mjs`：390×844，打开赛车手机页；主动拒绝原生全屏 API，测试窗口横屏、多指、选关弹窗与保存。
- `zombie.mjs`：预览端口 55437；四大菜单、免费连抽与入库、装备镶嵌、禁用方案、存档恢复、完整20波通关、暂停、50关选关、手机全屏与横握无裁切。
- `pvz.mjs`：预览端口 55438；手动收阳光、卡槽种植、完整通关、暂停、星级、跨游戏存档隔离、竖握旋转坐标、真触摸睡莲种植和铲除。

新版本 CLI 可直接加载函数文件（末尾不加分号）：`playwright-cli -s=pvz-qa run-code --filename tests/browser/pvz.mjs`。仅在独立验收会话运行；新脚本会使用本机测试存档夹具，不用于用户已有浏览会话。

截图当前写入本机专用工作目录 `E:/Documents/AI/codex/tmp/vue-racing-20261018/`。不要对用户实际浏览会话或线上已有存档运行，片段会启用辅助项、选择关卡并写入当前浏览器上下文的本地存档。

- `zombie-touch.mjs`：在 `zombie.mjs` 的测试存档后运行，以 CDP 真触摸事件测试免费连抽、三个通关宝箱、精英模式、两侧炮塔升级、倍速、拖动集火、暂停与全屏回退。
- `zombie-entry.mjs`：在独立移动会话运行；禁用较新JS/Canvas方法，测试触摸进入、四菜单、存档重载、装甲车fallback、入口异常重试、存储与音频被禁用；支持Chromium与WebKit，不在用户已有浏览会话运行。

- `zombie-expanded.mjs`：新增259普通/259精英、常驻活动、畅玩控制台、双浏览器独立身份、军团创建/加入、无限签到、机器人、共享聊天与首领；本地真实 WebFlux 验收服务通过路由映射到55439，不向生产军团写测试数据。截图写入 E:/Documents/AI/codex/tmp/zombie-apk-20261024/reports/。

- `zombie-native-maps.mjs`：Chrome / WebKit 旧 API 模拟；全部导航选中贴图、原生地图按需加载、1 / 2 / 259 普通与 259 精英的源 MapID、贴图网络失败回退、主模块导入失败后的手机/桌面可见重试。仅本地预览，不写生产军团数据。

- `zombie-native-skills.mjs`：原图缩放 / 滚动、核心详情进入图鉴、前置条件、待接入标识；固定游戏 RNG 种子但保留 WebKit 真实时间，选择真实随机升级分支并核对本局 Build 状态。Chrome 可加速时钟，WebKit 真实触摸运行；不写生产军团数据。

- `zombie-native-interface.mjs`：阻塞真实资源检查进度停留与恢复、Spine动画连续帧变化、独立开始按钮、原生宝石词条/镶嵌/免费抽取、加载失败可见重试和存档保留；Chrome / WebKit 均运行在独立手机会话。

- `zombie-gems-forms.mjs`：390×844，48 条幻形目录、实际开局技能、随机初始构筑、核心连升、复杂宝石领取/镶嵌及战斗状态。会重置独立验收会话的两个本地游戏存档键；不写军团服务。先打开向僵尸开炮手机版并检查快照，再用 `run-code --filename tests/browser/zombie-gems-forms.mjs` 执行。

- `zombie-procs.mjs`：独立手机会话验证 2,023 条可执行目录（含 2 条显式兼容补全）、来源差异提示、免费领取/镶嵌；用真实引擎/渲染器运行 19 颗宝石与 14 系技能的十秒视觉夹具，并检查三套新粒子贴图及网络错误。测试夹具不是正常关卡录像；不写军团服务。

- `zombie-native-forms-fusion.mjs`：仅本地预览；全屏幻形动态模型、装备/卸下/升星存档、390×844 底栏可见、枪械与核心合成公式、至尊宝石直接洗练及材料扣除、战斗升级中查看公式后返回选择。重置独立验收会话的存档，不调用军团服务。

### 寻宝原始骨骼和总览回归

`zombie-treasure-animation.mjs` 需要静音浏览器和本地预览：核对 `idle2`、跑动与落点、跳过动画、20 层滚动总览以及离页释放。与 `zombie-board-lotteries.mjs` 配合，覆盖选奖、批量上限、阶段/任务奖励和存档。证据写到 E 盘专用目录，测试不调用真实游戏后台。

### 原生材质与战斗回归

- `zombie-fx-material.mjs`：需要静音浏览器；验证主页预热 24 张特效贴图、制导橙色/射线蓝色的实际像素、旋风六次循环取帧。使用独立临时画布，截图后移除。
- `zombie-fx-engine.mjs`：真实网页引擎运行射线、制导、电子、旋风、电磁五类技能各六秒，核对技能事件和正伤害，再用实际事件渲染截图；这是引擎夹具，不是正常关卡或 APK 数值对比。
- `zombie-combat-refine.mjs`：`refine`、`combat` 两个阶段分别验证角色洗练入口、三次直接洗练与存档，以及正常关卡升级/命中/24 张源贴图。不调用军团服务；洗练阶段重置独立浏览器存档。
