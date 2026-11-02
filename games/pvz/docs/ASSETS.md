# 植物防线素材出处与许可记录

核验日期：2026-10-23。

## 植物、僵尸与辅助图像

来源：[GeeeekExplorer/PVZ（植物大战僵尸 Qt 版）](https://github.com/GeeeekExplorer/PVZ)。这是公开的复刻项目素材镜像，不是 PopCap/EA 官方素材包。下载只访问该仓库公开文件，未访问或解包任何游戏客户端。

- 植物、僵尸与辅助图片呈现《植物大战僵尸》原版角色图像，相关原作品版权归 PopCap / Electronic Arts。
- 镜像仓库标注 GPL-3.0，原始许可副本保存在本目录 `SOURCE-GPL-3.0.md`。本记录区分仓库许可与原版美术权利：**不将仓库 GPL 标注扩展为原版美术的 CC0 或官方开放许可。**
- 所有选入图像均直接复制并重命名，没有二次切图、缩放、重压缩或重新着色。
- 下载接口：`https://raw.githubusercontent.com/GeeeekExplorer/PVZ/master/<原文件路径>`。
- 以下尺寸为 GIF 逻辑画布尺寸；普通、路障、铁桶僵尸带透明边距，人物在画布偏右处，全部朝左。

| 当前文件（相对 public） | 来源仓库原文件 | 画布尺寸 | 帧数 | 字节数 |
| --- | --- | --- | --- | --- |
| `assets/plants/peashooter.gif` | `images/Peashooter.gif` | 71 × 71 | 13 | 21890 |
| `assets/plants/sunflower.gif` | `images/SunFlower.gif` | 73 × 74 | 18 | 40613 |
| `assets/plants/wallnut.gif` | `images/WallNut.gif` | 65 × 73 | 16 | 20845 |
| `assets/plants/cherrybomb.gif` | `images/CherryBomb.gif` | 112 × 81 | 7 | 15888 |
| `assets/plants/snowpea.gif` | `images/SnowPea.gif` | 71 × 71 | 15 | 25893 |
| `assets/plants/repeater.gif` | `images/Repeater.gif` | 73 × 71 | 15 | 28318 |
| `assets/plants/potatomine.gif` | `images/PotatoMine.gif` | 75 × 55 | 8 | 12240 |
| `assets/zombies/zombie.gif` | `images/ZombieWalk1.gif` | 166 × 144 | 22 | 67046 |
| `assets/zombies/zombie-attack.gif` | `images/ZombieAttack.gif` | 166 × 144 | 21 | 59124 |
| `assets/zombies/zombie-die.gif` | `images/ZombieDie.gif` | 166 × 144 | 10 | 21531 |
| `assets/zombies/cone.gif` | `images/ConeZombieWalk.gif` | 166 × 144 | 21 | 73538 |
| `assets/zombies/cone-attack.gif` | `images/ConeZombieAttack.gif` | 166 × 144 | 11 | 40977 |
| `assets/zombies/bucket.gif` | `images/BucketZombieWalk.gif` | 166 × 144 | 15 | 50832 |
| `assets/zombies/bucket-attack.gif` | `images/BucketZombieAttack.gif` | 166 × 144 | 11 | 45861 |
| `assets/zombies/football.gif` | `images/FootballZombieWalk.gif` | 154 × 160 | 11 | 52016 |
| `assets/zombies/football-attack.gif` | `images/FootballZombieAttack.gif` | 154 × 160 | 10 | 47214 |
| `assets/effects/boom.gif` | `images/Boom.gif` | 213 × 196 | 13 | 53890 |
| `assets/effects/potato-boom.gif` | `images/PotatoMineBomb.gif` | 132 × 128 | 5 | 9267 |
| `assets/effects/sun.gif` | `images/Sun.gif` | 78 × 78 | 22 | 38803 |
| `assets/interface/lawnmower.png` | `images/LawnMower.png` | 70 × 57 | 1 | 4756 |

镜像仓库核验提交：[9b630090a5cb3eec736a4dd27dbca9ffaa30c27f](https://github.com/GeeeekExplorer/PVZ/tree/9b630090a5cb3eec736a4dd27dbca9ffaa30c27f)。

## 音乐：Flowerbed Fields [Loop]

- 作者：Zane Little Music。
- 来源：[OpenGameArt 作品页](https://opengameart.org/content/flowerbed-fields-loop)。
- 下载：[flowerbed_fields.ogg](https://opengameart.org/sites/default/files/flowerbed_fields.ogg)。
- 许可：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，作品页明确标注。
- 当前文件：`assets/audio/garden.ogg`，1,724,097 字节。原文件直接复制，轻快花园主题循环音乐。
- 该曲不是《植物大战僵尸》原声。未将原声音乐的在线可播放状态当作开放再分发声明。

## 验证与暂存

- 已实际解码 19 个 GIF 和 1 个 PNG，尺寸、帧数见上表。
- 选入 7 类植物、4 类僵尸及啃食/死亡动画、阳光/爆炸/割草机；Chomper 与 Squash 未选入本次镜像资源集。
- 当前资源合计 2,454,639 字节（约 2.34 MiB），低于 8 MB 预算。
- 图像均为透明背景。浏览器 DOM `<img>` 可直接播放 GIF；游戏的渲染方式由主实现决定。
- 下载清单、尺寸检查、来源页面和参考工程文件暂存于 `E:\Documents\AI\codex\tmp\pvz-assets-20261023`。
- 没有修改其他游戏的素材、源码或发布配置。

## 手机音频兼容派生文件

主实现使用 FFmpeg 7.1 / libmp3lame VBR q4 将上述 CC0 OGG 转为 audio/garden.mp3（1,657,688 字节），用于各端统一播放。原始 OGG 保留，音乐内容与作者、许可不变；新增文件 SHA256 已加入 asset-manifest.json。资源总量约 3.92 MiB。
