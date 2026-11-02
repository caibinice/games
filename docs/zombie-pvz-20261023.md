# 两款僵尸主题游戏 · 2026-10-23 上线记录

> 本文记录首次发布；随后《向僵尸开炮》已更新为截图还原四菜单版本，当前发布及回滚见[改版记录](zombie-original-ui-20261023.md)。植物大战僵尸保持首次发布内容。

## 入口

| 游戏 | 地址 | 内容 |
| --- | --- | --- |
| 向僵尸开炮 · 最后防线 | <https://caibinice.com/games/zombie/> | 50 关、5 战区、6 武器、升级三选一、空袭、永久强化 |
| 植物大战僵尸 · 花园保卫战 | <https://caibinice.com/games/pvz/> | 50 关、13 植物、5 世界、阳光与冷却、啃食、割草机 |
| 游戏大厅 | <https://caibinice.com/games/> | 自动发现两款新游戏，与此前七款并列 |

两款都保留 `pc.html`、`mobile.html` 入口，支持全屏及原生全屏请求失败时的沉浸布局。最后防线以竖屏为主，花园保卫战以横屏为主，手机竖握时使用旋转布局及逆变换触控坐标。iOS 可添加到主屏幕使用独立窗口。

## 改动范围

- 新增 `games/zombie/`：元数据、独立运行代码 / 资源、59 项测试、玩法及素材出处。
- 新增 `games/pvz/`：元数据、独立运行代码 / 资源、63 项测试、正常玩家策略、玩法、素材 SHA256 清单和来源许可。
- `scripts/build.mjs`：仅增加 `.gif` 运行资源类型。
- `scripts/preview.mjs`、`deploy/nginx/games.conf`：仅增加 `image/gif` MIME。
- `tests/browser/zombie.mjs`、`tests/browser/pvz.mjs`：Playwright CLI 验收函数。
- `README.md`、`tests/browser/README.md` 与本记录：入口和维护说明。

没有修改其余七款游戏源码、元数据、存档协议、共享 Vue 源码或构建出的共享包。未安装新的项目依赖，未创建全站 service worker，未修改个人 Codex 配置或全局技能。源码留在当前工作区，本次未创建 Git 提交。

## 素材

- 最后防线：官方公开页面未发现可核实的独立精灵 / 音乐包；使用 Kenney CC0 人物与 HydroGene CC0 战斗曲，非原版提取素材。地图与特效由程序绘制。
- 花园保卫战：部分经典植物 / 僵尸 GIF 来自 `GeeeekExplorer/PVZ` 公开镜像，原作品权利、镜像仓库 GPL 与本项目原创部分分别记载；配乐为 Zane Little Music 的 CC0 花园曲，非原声。新增植物以 SVG 绘制。
- 花园音乐提供 MP3 兼容版本，原始 OGG 保留。无 CDN 运行依赖。
- 详细来源：[最后防线](../games/zombie/docs/ASSETS.md)、[花园保卫战](../games/pvz/docs/ASSETS.md)；[随游戏部署的许可说明](https://caibinice.com/games/pvz/assets/credits.html)。

## 验证

- `npm run check`：九款游戏规则检查与模块语法全部通过。
- `npm test`：31 个测试文件，**614 项测试全部通过**，含新增 122 项。
- 50 关最后防线逐关模拟通关，覆盖技能选择和空袭；50 关花园保卫战采用正常收阳光 / 种植 / 铲除 API 的玩家策略通关，无免费资源或跳关。
- Python 发布测试：10 项通过。
- 公网逐文件核验：最后防线发布包 57 个文件、花园保卫战发布包 72 个文件 SHA256 全部匹配；MP3 Range、模块 MIME、私有路径 404 与规范末尾斜杠通过。
- 公网浏览器验证：大厅显示九款游戏，两款新入口均正常初始化；植物 GIF 返回 `200 image/gif`，无运行错误。
- 凭据审计通过；发布包不含凭据、源码工具、测试目录。
- 最后防线真实浏览器完成第一关，验证 34 次击退、3 次升级、3 星 / 51 补给、下一关解锁；手机 390×844 无滚动，844×390 完整显示，原生全屏拒绝时正常回退，零运行 / 资源错误。
- 花园保卫战真实浏览器完成第一关，验证手动收阳光 +25、10 棵种植、3 星 / 下一关存档、暂停冻结；手机 390×844 旋转布局、帮助弹窗、844×390 横屏、CDP 真触摸事件种睡莲 / 豌豆及铲除通过，零运行 / 资源错误。
- 上述移动端验证为 Chromium 手机视口与触摸事件仿真；未将其写作实体 iPhone / Android 真机验收。

截图与验收中间文件：

- `E:\Documents\AI\codex\tmp\zombie-20261023\qa\`
- `E:\Documents\AI\codex\tmp\pvz-20261023\qa\`

## 发布隔离及回滚

使用原有单游戏增量发布，不运行“全游戏覆盖发布”：

1. 最后防线：`-Games zombie`，release `20261023115839-412fd86b70`，北京时间 19:58。
2. 花园保卫战：`-Games pvz`，release `20261023122520-412fd86b70`，北京时间 20:25。

第二次发布继承第一次 release。切换后再次读取服务器继承清单并运行 SHA256 验证，**594 个继承文件全部不变**，包括此前七款、最后防线和共享哈希包。游戏大厅 catalog 增加新游戏，Nginx 仅扩展 GIF 类型；博客与停车入口探测通过。

当前 release：`/opt/games/releases/20261023122520-412fd86b70/www`。

本机回滚记录（含服务器上一 release、路由备份与包信息）：

- 最后防线：`E:\Documents\AI\codex\backups\games-20261023-195839-189975\rollback.json`
- 花园保卫战：`E:\Documents\AI\codex\backups\games-20261023-202520-539338\rollback.json`

服务器备份：`/opt/games/backups/20261023122520-412fd86b70/`，其中 `inherited-sha256.txt` 是上述继承校验记录。

回滚沿用 [发布手册](deployment.md) 的软链接原子切换步骤；整包回退会回到上一次 release，只回退某一游戏则重建该游戏旧源码并单独发布。
