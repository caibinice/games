# 坦克大战 / 魂斗罗：单人双端复刻

日期：2026-10-15。范围为新增 `games/tank`、`games/contra`、README 及本文；未修改其他四款游戏源码或共享发布 / Nginx 规则。

## 交付范围

- 坦克大战：35 关经典布局、20 辆敌军、四类敌车、六种道具、可破坏地形、守卫老鹰、连续关卡结算，单人 3 命。
- 魂斗罗：8 个经典区域，横向 / 瀑布纵向 / 基地纵深三种推进，八向射击、五种枪、R / B 道具、卧倒、长短跳、水域、断桥、机关、关底 Boss，3 命或 30 命练习。
- 两款均有 PC / 手机独立页面、全屏和回退沉浸布局、切窗暂停、本地记录、真实多点触控；资源全部同源托管，不依赖外站运行。
- 坦克为关卡检查点存档；魂斗罗为完整战场续玩，暂停 / 重开 / 选关语义明确。

## 原版资源与实现边界

坦克使用 MIT 上游 [feichao93/battle-city](https://github.com/feichao93/battle-city) 的引擎、原生像素绘制、35 关数据与音效，固定提交和完整许可随仓库保留。
魂斗罗使用 [NES Maps](https://nesmaps.com/maps/Contra/Contra.html) 八关背景、[nes-contra-us](https://github.com/vermiceli/nes-contra-us/tree/main/docs/sprite_library/contra_sprites) 原精灵、[VGMPF](https://www.vgmpf.com/Wiki/index.php/Contra_(NES)) 七轨 NES 原声、GitHub 公开音效；逐文件 URL / SHA-256 随仓库保存。186 精灵图集的可见像素逐一复核，原背景 / 音轨字节保持原样。

魂斗罗战斗引擎为本仓库实现，首关几何采用原图参考数据；后七关的落脚地形由背景边缘标注，敌军和部分 Boss / 机关为适配实现。不是 ROM 模拟器，也不是逐指令 / 逐帧复原。原作媒体与开源适配代码的来源和许可分别说明。

## 验证

- `npm test`：18 个测试文件、358 项通过，包含原四款游戏 216 项回归。
- 新增坦克上游回归与本站适配用例，覆盖输入、碰撞、破墙、道具、AI、计分、结算、35 关单人生存和关卡检查点。
- 魂斗罗覆盖八关 / 三模式、基于实际跳跃参数的地形路径、移动石台、八向射击、武器弹数上限、普通弹单目标 / 激光穿透、拾取、断桥 / 游泳、核心房间、八关 Boss、死亡 / 重生、确定性、存档和七轨音乐完整性。
- Playwright 本地实际页面回归：坦克首关 / 第 35 关、35 格选关、方向 + 开火、关卡检查点、全屏、手机双指；魂斗罗全八关射击、实际开火击破 Boss、续关、长短跳、暂停 / 精确存档、全屏及 API 拒绝回退、手机短按和三指跑跳射。两款页面错误为 0。
- 手机 320 / 390 / 430px 和 844×390 横屏无横向溢出，控制区完整可见；1366×900 全屏画面放大，四张双端截图目视核验。
- Chromium 实际解码全部 27 个音频文件成功，包括 7 轨分关 NES 音乐；未仅检查文件扩展名。
- 八关各连续模拟 30 秒，480 次运行中存档恢复往返通过；另外目视检查基地纵深、瀑布和异形巢穴场景。
- 凭据审计、Python 发布 / 回滚 10 项回归通过；选定构建为 69 个文件及 gzip。诊断和截图仅留 `E:\Documents\AI\codex\tmp\classic-games-20261015`。

## 发布

- 功能提交 `ae65bd628de2baa0c9033418bcc44eb8b4227eec`，通过本机 `127.0.0.1:20808` 代理推送 `origin/main`。
- 原子 release：`/opt/games/releases/20261015063607-ae65bd628d/www`；只替换 `tank` / `contra`，共享大厅自动增加入口。未修改 ai-blog 部署镜像。
- `scripts/verify.py`：69 个公网运行文件 SHA-256 全匹配，JS MIME 正常、MP3 Range 正常、缺失资源与源码 / 凭据目录 404、目录斜线跳转正常。
- 公网 Playwright 完整回归再次通过：坦克键盘 / 第 35 关 / 全屏 / 双指触控，魂斗罗八关渲染射击 / 实际 Boss 击破 / 续关 / 精确存档 / 全屏回退 / 三指触控，页面错误均为 0。
- 发布前后，拼豆 / 抓大鹅 / 连连看 / 泡泡小镇共 **129 个文件（含 gzip）逐字节一致**；共享 Nginx 路由 SHA-256 一致，`nginx -t` 通过。
- `/`、`/blog/`、`/smartParking/`、`/games/`、原四款游戏入口、新两款双端页面全部 HTTP 200。
- 本地回滚：`E:\Documents\AI\codex\backups\games-20261015-143607-892062\rollback.json`；发布归档 SHA-256 已复核。
- 远端备份：`/opt/games/backups/20261015063607-ae65bd628d`；上一 release：`/opt/games/releases/20261015053807-df0fc76330/www`。
- 正式入口：[坦克大战](https://caibinice.com/games/tank/) / [魂斗罗](https://caibinice.com/games/contra/)，分别有 PC 和手机页面。
