# 3D 公路躲障 / 喷气翻转素材研究（2026-10-18）

## 可立即用的素材

根目录 `assets/`，原作者 **Kenney**。6 个原包的官方页面和随包 `License.txt` 都明确 **CC0-1.0**；下载 URL / 字节数 / SHA256 在 `asset-pack-sources.json`，16 个推荐文件逐件哈希在 `recommended-assets.json`。`packages/` 保留原 ZIP。

| 用途 | 文件（相对于 assets） |
|---|---|
| 玩家未来跑车 | `car-kit/Models/GLB format/race-future.glb`（173 KB，独立车身/四轮） |
| 交通车 | 同目录 `sedan.glb`、`suv.glb`、`truck.glb`、`delivery-flat.glb` |
| 路面/护栏/路牌 | `city-kit-roads/Models/GLB format/road-straight.glb`、`road-straight-barrier.glb`、`sign-highway.glb` |
| 城市远景 | `city-kit-commercial/Models/GLB format/low-detail-building-*.glb`，近景用 `building-*.glb` |
| 喷气 | `sci-fi-sounds/Audio/thrusterFire_000.ogg` 至 `004`、`spaceEngineSmall_000.ogg` |
| 碰撞 | `impact-sounds/Audio/impactMetal_medium_000.ogg` |
| 赛车引擎/轮胎 | `kenney-starter-racing-audio/engine.ogg`、`skid.ogg`、`impact.ogg` |

**GLB 依赖：** 官方 Car Kit / Road / Building GLB 内引用外部 `Textures/colormap.png`。每包要保留各自 `Models/GLB format/Textures/colormap.png`，三包同名贴图不是同一张，勿覆盖。车辆 Y 向上，前轮在正 Z 一侧，轮节点可单独转动。素材是无品牌低多边形跑车，不是官方 Tesla 模型。

官方包页：
- https://kenney.nl/assets/car-kit
- https://kenney.nl/assets/city-kit-roads
- https://kenney.nl/assets/city-kit-commercial
- https://kenney.nl/assets/racing-kit
- https://kenney.nl/assets/sci-fi-sounds
- https://kenney.nl/assets/impact-sounds

GitHub 原作者仓库：https://github.com/KenneyNL/Starter-Kit-Racing 。Godot 示例代码 MIT，模型和音效另列 CC0，轮胎滑行声作者 Landeplage 也明确 CC0。四个音频按提交 `2f2e5f2646dda89cb21d4e8539bab60c6e955dc8` 固定下载，详情 `assets/kenney-starter-racing-audio/sources.json`。

## 天天飞车参照

[腾讯官方入驻 TapTap 产品页](https://www.taptap.cn/app/7076/all-info) 将其定位为左右闪避、近距离超车的赛车手游，厂商腾讯。原官网 `ttfc.qq.com` 本轮未成功取得内容。没有把 QQ 飞车的漂移/圈速截图混作天天飞车。

可核验的原玩法：左右变道 + 跳跃、近车尾横移触发惊险超车、连续 Combo、金币、燃油/加油站、斜坡飞跃、跳上平板卡车。来源为[2013 年玩法介绍](https://games.sina.com.cn/xyz/n/2013-12-03/0825747714.shtml)及[2013 年试玩](https://news.17173.com/content/11152013/113744931.shtml)，后者是第三方试玩而非官方发布。

实图已保存 `references/ttfc-coast-gameplay.jpg`（1832×1030，来自360攻略 https://u.360.cn/ttfc/article/46293 ）。参考其低位追车视角、道路纵深、道路两侧丰富景物、蓝天海湾、易读大按钮。图片为研究参照，未声称可作为 CC0 游戏资源。17173 CDN 的三个旧图返回了同一个“图片不存在”占位图，已剔除，不充当实机图。

## 特斯拉喷气腾空侧滚的原来源与性质

匹配机制的原来源是 Tesla **2026-10-15 Roadster 原型演示**：
- 原直播：https://x.com/Tesla/status/2110788059008819215
- 官方 YouTube 原直播：https://www.youtube.com/watch?v=qt5p-_tE8d0
- 官方单独片段 The Kickflip：https://www.youtube.com/watch?v=r5vsHHPVhJg
- 官方单独片段 The Ramp：https://www.youtube.com/watch?v=7p5LxFdc-Qg
- Tesla 产品说明：https://www.tesla.com/en_GB/roadster

Tesla 当前产品说明列出 cold-gas thrusters（冷气体喷嘴）、向上加速和横向旋转，Rocket 与 Performance/Thrust 分开。官方公开视频展示的原型演示与“公路堵车随手飞走”的 AI 二创应分开；有明确 AI 声明的生成站例子为 https://www.flyster.net/ 。用户没有给具体视频，因此不把任何未看到的转发片段一概判成真或假。官方演示参照不是量产车公路能力的验证。

官方片段 ID 与标题在[同期 Road & Track 报道](https://www.roadandtrack.com/news/a74159440/tesla-roadster-flip-float-launch-control-0-60-mph-videos/)中分别嵌入；[Electrek 同期报道](https://electrek.co/2026/10/15/tesla-unveils-cyberfied-new-roadster-kickflip/)嵌入 Tesla 原直播。

游戏动作建议：短促白色高压气流（非火箭燃油橙色长火焰）→车身升高→绕行进轴侧滚一周→落地前回正→悬架压缩/尘雾，影子留在路面并随高度变淡；技能约1.2—1.8秒、冷却/能量限制。保留最近距离超车的主循环，跳跃用来翻越一排车辆，作为原创游戏化演绎，不伪称原游戏本来就有此特技。以上时间为游戏设计建议，不是实车性能测量。
