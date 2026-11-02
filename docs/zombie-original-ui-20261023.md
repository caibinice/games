# 向僵尸开炮 · 原图UI与四大菜单改版

> 后续手机封面入口兼容修复见[2026-10-24记录](zombie-entry-fix-20261024.md)。本文保留本轮改版发布历史。

## 交付范围

基于用户提供的`C:\Users\caibin\AppData\Local\UUYC\GameViewer\Download`下6张原版截图，使用原图场景、角色、装备、技能与导航切片，重建1080×2400竖屏界面，等比适配电脑与手机H5。开放底部前四项：商城、角色、核心、战斗；后三项仅保留导航外观与范围提示。

- 商城：三卡池无限免费抽取、单抽/5连/10连、真实道具入库、保底、免费重复补给；没有支付、广告或抽奖次数上限。
- 角色：六装备强化/升阶/替换、宝石镶嵌/卸下/锁定/筛选/三合一、背包材料、时装和佣兵属性。
- 核心：13技能、卡牌升级、5套方案、最多6技能禁用、开局支援选择、幻形属性；养成数值参与实战。
- 战斗：50关×20波、普通/精英、真实炮击与13类支援技能、三选一、空袭、炮塔能量升级、倍速、伤害统计、耐久条件宝箱、巡逻补给。

本轮是按参考图重建的可玩网页版本，不宣称原作完整源码或逐帧1:1。只有6张截图：敌人采用一只电锯僵尸切片的动态/配色变体，道路使用干净原图纹理，部分数字遮盖、弹窗、技能特效、动画和后续关卡地图由程序实现；枪械、先锋、机甲子入口为已实现能力说明，尚非原作完整子系统。音乐沿用已核实的CC0战斗曲，未标为原声。

## 修改文件

- `games/zombie/public/`：新入口、控制器`original-app.mjs`、界面`screens.mjs`/`ui.css`、养成`progression.mjs`、内容`content.mjs`、扩展战斗`engine.mjs`和原图渲染`original-render.mjs`。
- `games/zombie/public/assets/original-ui/`：73个原截图资源，约4.38MiB；坐标与SHA256清单在`games/zombie/docs/ORIGINAL_UI_MANIFEST.json`，用户原图未修改。
- `games/zombie/game.json`、`manifest.webmanifest`、素材/玩法说明、公开`assets/credits.html`。
- `games/zombie/tests/progression.test.mjs`：新增126项；原59项保留，共185项本游戏单元测试。
- `tests/browser/zombie.mjs`及`zombie-touch.mjs`：Playwright CLI独立浏览器验收。
- 根README、浏览器说明与本记录。

保留`fish-zombie-v1`旧战役进度；新增`fish-zombie-meta-v1`保存养成，不写其他游戏存档，不注册service worker，不修改共享Vue源码。原版`style.css`和`render.mjs`保留参考，新入口不加载。

## 验证

- `npm run check`：九款规则检查与模块语法通过。
- `npm test`：32个文件、**740项全部通过**；包括50关新版20波战役初始装备正常策略通关、全部13技能有效伤害、3000次免费抽奖零货币消耗、保底、背包持久化、宝石/装备/升级/禁用方案。
- 凭据审计通过；不新增项目依赖。
- 真实浏览器DOM流程完成第一关：20波、126次击退、8次三选一、3星、51旧补给币，奖励仅结算一次。
- 免费连抽、真实入库、强化/镶嵌/合成、禁用六项上限、独立方案、重载恢复、50关锁定、暂停冻结均通过；零运行或资源错误。
- 1440×1000电脑、390×844手机、844×390横屏验证；手机无文档滚动，横屏完整显示竖向战场。
- Chromium CDP触摸事件验证：连抽、三宝箱、精英、两侧炮塔升级、倍速、拖动集火、暂停、原生全屏失败的沉浸回退；非实体手机验收。

浏览器截图和测试中间文件：`E:\Documents\AI\codex\tmp\zombie-ui-20261023\qa\`。

## 发布与回滚

单游戏发布命令：`pwsh -NoLogo -NoProfile -File scripts/deploy.ps1 -Games zombie -SkipInstall`。沿用`https://caibinice.com/games/zombie/`，大厅自动更新游戏描述，不新建独立站点。发布器继承上一release并校验未选中游戏文件，切换软链前保留回滚记录。

源码改版前的完整备份（25个源文件逐一哈希验证）：`E:\Documents\AI\codex\backups\zombie-original-ui-20261023\zombie`；旧浏览器验收脚本同目录`zombie-browser.mjs`。

### 已发布

- Release：`20261023133412-412fd86b70`，北京时间21:34；当前根`/opt/games/releases/20261023133412-412fd86b70/www`。
- 发布门禁：740项JS测试、10项Python发布测试、凭据审计、构建、Nginx检查与既有博客/停车入口探测全部通过。
- 公网核验：137个运行文件SHA256全部匹配；JS MIME、MP3 MIME/Range、缺失/私有路径404、规范尾斜杠通过。
- 原子发布期间校验611个继承文件保持不变：其余八款331个文件，共享哈希包280个文件；包括植物大战僵尸48个文件。大厅catalog仅更新本款名称、描述与版本。
- 公网浏览器四菜单与免费5连抽通过；大厅入口、植物大战僵尸初始化均正常，零运行错误。
- 本机远端回滚记录：`E:\Documents\AI\codex\backups\games-20261023-213412-422036\rollback.json`。
- 服务器备份：`/opt/games/backups/20261023133412-412fd86b70/`，含原路由、上一release与`inherited-sha256.txt`。

整体回滚按现有发布手册将软链切回上一release`20261023122520-412fd86b70`；若只回退此游戏，则以本轮源码备份重建并单独发布。源码未创建Git提交。
