# 2026-10-24 来源更新

当前运行版已接入用户指定 APK 的68份地图、图标、88组序列动画与音乐/音效，均按原作品素材记录，不标为 CC0。输入包哈希、导出工具、逐包清单与当前还原范围见 [APK_ANALYSIS.md](APK_ANALYSIS.md) 和 public/assets/client-v1、client-campaign、client-maps、client-skills 中的 provenance.json。

技能图鉴另保留用户补充的网友前置条件图（含原作者水印），以及客户端干冰弹贴图；出处和逐文件哈希记录在 client-skills/provenance.json。

以下为早期备用素材/截图版的历史记录；“未从客户端提取”“当前音乐非原声”等旧版描述不再代表本次运行版。

---

# 僵尸防线素材出处

核验日期：2026-10-23。下列早期备用人物与音乐采用公开许可素材，均非《向僵尸开炮》原版素材。用户追加的原版截图提取 UI 见文末独立记录。

## 原版来源检索

已检查《向僵尸开炮》[官网](https://xjskp.scgame.com.cn/)。页面公开了客户端入口、角色及技能宣传展示，未发现单独提供且声明可再分发的精灵或音乐资源包。本项目未从客户端提取资源，未将宣传图标注为游戏内原版素材。

## 人物：Kenney Platformer Characters

- 作者：Kenney Vleugels（Kenney.nl）。
- 来源页面：[Platformer Characters](https://kenney.nl/assets/platformer-characters)。
- 下载包：[kenney_platformer-characters.zip](https://kenney.nl/media/pages/assets/platformer-characters/b85f388c42-1677693768/kenney_platformer-characters.zip)。
- 许可：[Creative Commons Zero / CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。包内 `License.txt` 确认个人、商业项目均可使用，署名非强制。
- 所有 PNG 均为原文件原像素复制，仅按渲染接口重命名。尺寸均为 **80 × 110**，透明 RGBA，正面/侧前视卡通人物。

| 当前文件（相对 public） | 压缩包内原文件 | 用途 |
| --- | --- | --- |
| `assets/characters/zombie_stand.png` | `PNG/Zombie/Poses/zombie_stand.png` | 僵尸静止 |
| `assets/characters/zombie_walk1.png` | `PNG/Zombie/Poses/zombie_walk1.png` | 行走帧 1 |
| `assets/characters/zombie_walk2.png` | `PNG/Zombie/Poses/zombie_walk2.png` | 行走帧 2 |
| `assets/characters/zombie_hurt.png` | `PNG/Zombie/Poses/zombie_hurt.png` | 受击 |
| `assets/characters/zombie_attack.png` | `PNG/Zombie/Poses/zombie_action1.png` | 近战动作姿势 |
| `assets/characters/soldier_stand.png` | `PNG/Soldier/Poses/soldier_stand.png` | 士兵静止 |
| `assets/characters/soldier_back.png` | `PNG/Soldier/Poses/soldier_back.png` | 士兵朝向战场 |
| `assets/characters/soldier_shoot.png` | `PNG/Soldier/Poses/soldier_action1.png` | 射击姿势基底（武器由程序绘制） |

## 背景音乐：JRPG Epic Rock Battle Theme #1

- 作者：HydroGene。
- 来源页面：[JRPG Epic Rock Battle Theme #1 / OpenGameArt](https://opengameart.org/content/jrpg-epic-rock-battle-theme-1)。
- 直接下载：[jrpg_battle_loop.mp3](https://opengameart.org/sites/default/files/jrpg_battle_loop.mp3)。
- 许可：[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，作者页面明确标注 CC0。
- 当前文件：`assets/audio/battle.mp3`，原文件直接复制并重命名，2,893,343 字节，作者提供的无缝循环版本。

## 技术验证

- 8 张 PNG 经图像解码检查，尺寸均为 80 × 110。
- 仅部署游戏使用的 8 张 PNG 和 1 首 MP3，合计约 2.80 MiB；未将原始 ZIP、网页快照或候选素材放入发布目录。
- 下载包与检索中间文件保存在 `E:\Documents\AI\codex\tmp\zombie-assets-20261023`。
- 游戏标识图形和程序绘制背景/技能特效由项目实现；不属于以上第三方人物或音乐包。


## 用户提供的原版截图 UI

新增 `public/assets/original-ui/` 资源，由用户提供的6张1080×2400截图裁切而来；该批图像沿用原作品权利，不标为CC0。详见 [ORIGINAL_UI.md](ORIGINAL_UI.md) 和 [ORIGINAL_UI_MANIFEST.json](ORIGINAL_UI_MANIFEST.json)。真实动态数值与交互由游戏DOM重绘，完整截图仅作为视觉参考底图。


## 原生登录及宝石 UI（native-interface1）

`assets/client-interface/` 来源为已核验 APK，而非用户截图。登录采用独立 BG、Spine 3.8.99 骨骼/atlas/贴图、进度条填充及开始按钮，未烘焙动态进度；宝石七品质原生图标、UI点击/关闭/翻页/奖励/洗练音效也有输入哈希。完整2,023条配置与合成数量严格解码，586条基础/条件属性实际接入，其他复合触发只作明确标识的参考。见新目录 provenance.json。骨骼播放器自托管、固定 Pixi 7.4.3 / pixi-spine 3.8 runtime 4.0.6，保留许可，不依赖运行时 CDN。旧 screenshot splash 已移出发布树并保留在本轮备份；其余旧切片尚未全部替换。
