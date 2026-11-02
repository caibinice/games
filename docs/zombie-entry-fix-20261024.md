# 向僵尸开炮 · 手机封面入口修复

## 问题与复现

用户报告手机停在封面，点击“开始游戏”未进入菜单。旧版入口能加载，但首次菜单渲染会执行`marquee()`里的`p.history.at(-1)`。

在独立浏览器会话禁用`Array.prototype.at`后，线上旧版复现结果：

```json
{"before":1,"after":1,"menu":0,"errors":["p.history.at is not a function"],"entered":true}
```

含义：点击前后封面按钮仍存在，底部菜单为0；菜单渲染抛错，页面保留旧封面。旧流程还在渲染成功前保存`entered=true`，可能导致后续重载也在菜单初始化时失败。

这是已复现的兼容性缺陷；未读取用户手机实际异常堆栈，具体iOS版本待用户确认。Apple明确在[Safari 15.4发行说明](https://developer.apple.com/documentation/safari-release-notes/safari-15_4-release-notes)中新增`Array.prototype.at`等方法；仅修改浏览器User-Agent不等于旧WebKit兼容验证。

## 修复范围

- `games/zombie/public/screens.mjs`：末项读取使用传统数组索引；HTML转义改用单次正则`replace`，保留转义完整性，去除`replaceAll`依赖。
- `games/zombie/public/original-app.mjs`：移除键盘/焦点处理中的`.at()`；入口先成功渲染再保存进入标记。渲染异常时保留原存档、显示错误说明、“重试进入”和“刷新页面”，初始化异常也回到可重试封面。
- `games/zombie/public/original-render.mjs`：旧Canvas缺少`roundRect`时使用`rect`绘制装甲车，不中断战斗帧。
- `games/zombie/public/audio.mjs`：用普通条件初始化音频上下文，去除`??=`。
- `games/zombie/public/ui.css`：增加`100vh`回退和入口错误面板。
- 三个HTML入口增加样式/模块版本参数，元数据版本`20261023-3`。
- 新增`games/zombie/tests/compat.test.mjs`（4项）与`tests/browser/zombie-entry.mjs`。

不更改关卡、抽奖、付费规则或存档格式，不清除玩家进度，不修改其他游戏源码或共享Vue源码。

## 验证

- 全仓检查通过，33个测试文件、744项测试通过。
- Chromium旧能力模拟：移除Array/String `.at()`、`replaceAll`、Canvas `roundRect`后，封面进入、四菜单、已有存档重载、装甲车实际fallback绘制通过。
- WebKit移动模式相同能力模拟与真实tap事件通过；这是桌面WebKit移动仿真，不是实体iPhone验收。
- 注入一次菜单渲染异常：显示错误与重试入口，不写入进入成功标记，点击重试恢复。
- 禁用本地存储与Web Audio：仍可进入菜单，不阻塞本次游玩。
- Chromium完整战斗浏览器回归通过：第1关20波、126次击退、8次三选一、胜利结算一次；免费连抽、背包、强化、镶嵌、禁用方案、存档重载、暂停、全屏和横屏回归通过，零运行错误。
- 公网WebKit移动模式通过：禁用`.at()`等新方法后，触摸进入、四菜单切换、免费连抽10次、重载与进入实战均正常，零未处理异常；Chromium公网抽奖、大厅、植物大战僵尸初始化也通过。
- 公网137个运行文件SHA256全部匹配；模块MIME、MP3 Range、私有路径404、规范尾斜杠通过。

## 备份与发布

修复前9个文件逐一SHA256核验的源码备份：`E:\Documents\AI\codex\backups\zombie-entry-20261023\`。

复现脚本、WebKit运行时和截图：`E:\Documents\AI\codex\tmp\zombie-entry-20261023\`。WebKit运行时仅用于本机验收，不加入游戏发布包或项目依赖。

沿用单游戏发布：`pwsh -NoLogo -NoProfile -File scripts/deploy.ps1 -Games zombie -SkipInstall`；发布包继承其他游戏并逐文件校验后原子切换。

- 发布时间：2026-10-24北京时间07:09；release `20261023230919-412fd86b70`（ID使用UTC）。
- 远端当前目录：`/opt/games/releases/20261023230919-412fd86b70/www`。
- 发布后重新校验611个继承文件SHA256全部不变：其余八款游戏331个，共享UI哈希包280个，包括植物大战僵尸48个。
- 本机部署回滚记录：`E:\Documents\AI\codex\backups\games-20261024-070919-900220\rollback.json`。
- 服务器备份：`/opt/games/backups/20261023230919-412fd86b70/`。
- 上一release：`20261023133412-412fd86b70`。按现有发布手册原子切回即可回退；本轮未创建Git提交。
- 用户刷新入口：<https://caibinice.com/games/zombie/?v=20261023-3>。不要求清除浏览器站点数据，已有进度与背包继续使用。
