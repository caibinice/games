# 抓大鹅 3D · 鹅鹅集市

在线入口 https://caibinice.com/games/goose/ ，纯静态手机 H5，竖屏优先，无游戏后端、广告或外部 CDN。

## 玩法参考与实现

参考 [KUNPO 官方游戏介绍](https://www.kunpo.cc/) 的三消定位、
[官方 App Store 介绍](https://apps.apple.com/cn/app/%E6%8A%93%E5%A4%A7%E9%B9%85/id6475341440) 的
3D 物品消除、限时清场、场景鹅收集及第一关热身；
[小米游戏中心玩法说明](https://game.xiaomi.com/game/62400785) 提供七格收集栏 / 三件相同自动消除的参考。
颠锅参考其 3D 堆叠与摇晃互动，而非平面卡片连线。

本实现使用自制 Three.js 立体模型和 Cannon-es 刚体世界：锅内重力、碰撞、遮挡、颠锅、
物品移出后重新掉落、真实 raycast 点击；不是以 2D 图片冒充 3D。
18 种模型在 public/models.mjs 中以几何体原创组合，含大白鹅、小黄鸭、胡萝卜、玉米、南瓜、
苹果、橘子、草莓、蘑菇、吐司、甜甜圈、杯子、瓶子、鱼、蛋、糖果、豌豆和香皂。
goose.svg 为自制矢量插画，仅作图标 / 收藏卡。未拷贝原版商业素材。
Three.js / Cannon-es 的版本、源文件及许可证随构建复制为本游戏自己的 vendor 目录。
同类模型合并材质几何并使用 InstancedMesh 批量渲染；108 件压力关卡实测 draw calls
由 1117 降至 75，仍保留每件物品独立的物理状态及遮挡 raycast。

技术参考：[Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、
[Raycaster](https://threejs.org/docs/pages/Raycaster.html)、[Cannon-es](https://pmndrs.github.io/cannon-es/)。

## 关卡和操作

- 60 关，8 个集市，12 至 108 件物品；每种数量始终是 3 的倍数，有且仅有 3 只大鹅。
- 第一关引导先找三个苹果，之后可自由抓鹅。第二关开始多层堆叠。
- 七格收集栏自动按种类归并，三个相同立即消除；第七件触发消除时不会误判满格。
- 点击露出的真实 3D 物品，或点击三格暂放区中的物品。拖动锅 / 点颠锅按钮可翻动物品。
- 设置里可开启手机 motion；iOS 按按钮请求权限。未开启时拖动 / 按钮始终可用。
- 撤回、移出三件、磁铁、满格继续和三分钟续时均免费。3 分钟起步，续时不限次数。
- 通关解锁下一关与对应主题鹅；收藏册展示 8 只主题鹅。
- 设置支持音效、自动全屏；顶部手动全屏，支持的设备锁竖屏；短屏以整页滚动，不截断工具。
- 切后台自动暂停，不扣时间。Cookie 在 `/games/goose` 下，和拼豆进度分离。
- compact v1 session 保存身份、库存、七格顺序、暂放区、时间与量化 3D 姿态，最大关卡低于 Cookie 4KB。
- 连点标题 5 次进入本机试玩跳关；不解锁正常关卡进度。换关前确认当前未完成局的替换。
- WebGL 创建失败或 context lost 时保留库存并明确切换“兼容画面”，仍可游玩。

## 维护

public/catalog.mjs：物品 / 主题 / 60 关；engine.mjs：独立库存规则及 Cookie；
models.mjs：自制模型；scene.mjs：3D / 物理 / 点击；app.mjs：手机 UI。
tests/engine.test.mjs 测试正常 / 满格 / 消除 / 道具 / 时间 / 全部 60 关可解 / 续局 / 异常存档。

从仓库根执行 `npm run check`、`npm test`、`npm run build`。
独立发布 `pwsh -File scripts/deploy.ps1 -Games goose`；一起发布 `-Games 'pindou,goose'`，
完整流程见 [共享发布手册](../../../docs/deployment.md)。

## 2026-10-11 验收

21 项规则测试覆盖全部 60 关、库存守恒、满格、第七件消除、道具、续时和 Cookie。
真实 WebGL 浏览器回归通过：新手点击、遮挡选取、三消、撤回、暂放 / 拿回、回大厅续局、
刷新续局、暂停、按钮 / 拖锅物理运动、手动全屏、通关 / 下一关 / 收藏、60 关目录、跳关边界和取消、
满格免费继续 / 磁铁、倒计时免费续时及 WebGL context loss 后保留进度的兼容模式。
320×568、375×667、390×844、430×932、1440×1000、844×390 六个视口无横向溢出，操作区可达；
JS 页面错误为 0，资源均来自本站。桌面浏览器模拟手机视口；真实手机的性能以设备实测为准。
