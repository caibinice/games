# 魂斗罗 · 8 关单人战役

入口 `/games/contra/` 自动分流；`pc.html` 和 `mobile.html` 独立页面。仅单人，不含双人和联网。

| 关卡 | 区域 | 推进方式 | NES 音乐 |
|---|---|---|---|
| 1 | 丛林 | 横向，水域、断桥 | Jungle |
| 2 | 基地一 | 击破核心后按上进入下一房间 | Bases / Base Boss |
| 3 | 瀑布 | 纵向攀登，移动石台 | Waterfall |
| 4 | 基地二 | 纵深房间和多核心 | Bases / Base Boss |
| 5 | 雪原 | 横向，悬浮要塞 | Snow Field |
| 6 | 能源区 | 横向，喷火机关、装甲巨人 | Energy Zone |
| 7 | 机库 | 横向，压砸机关、防御门 | Jungle |
| 8 | 异形巢穴 | 横向，异形和心脏 | Alien's Lair |

## 操作与战斗

- WASD / 方向键移动或瞄准，J / Z 开火，K / X / 空格跳跃，地面按下卧射；跳起可斜下射。基地始终向纵深开火。
- N 步枪、M 机枪、S 五向散弹、L 激光、F 火焰；R 提速、B 临时护盾。击落胶囊后拾取。
- 经典 3 命 / 30 命练习；PC 侧栏或手机关卡菜单选择。全八关开放选关，完成记录单独保留。
- 一击失命、短暂死亡动画后从最近安全落脚点重生，武器回 N，附短暂无敌；分数达到 3 万后及后续十万档奖励生命。
- 每关须击破 Boss，不以走到终点代替战斗；Boss 爆炸后确认下一关，分数 / 剩余生命 / 武器延续。
- P 暂停，F 原生全屏 / 窗口内沉浸；切窗自动暂停。手机方向 / 跳跃 / 开火支持真实三点同时触控。
- 原生 256×224 像素画面，无平滑缩放。90 px/s 移动、60Hz 模拟、跳跃缓冲 / 土狼时间 / 短跳截断。
- `fish-contra:pc:v1` / `fish-contra:mobile:v1` 独立保存精确对局、武器、敌弹、房间、Boss、完成记录和最高分；刷新后暂停续玩。

## 作弊 / 辅助（2026-10-16）

战场上方「作弊」或 C 打开，菜单中暂停战斗；关闭后若原本在运行则自动继续。默认四项全部关闭，按需组合：

- **无限生命**：受击 / 坠落仍播放死亡并从安全点重生、武器回 N，但不扣命；不再因生命耗尽而结束。已结束的对局需重开。
- **空中连跳**：每次松开再按跳跃可在空中重新起跳，长按只跳一次。侧向、纵向和基地关均生效，顶部有边界，避免跳出地图和存档范围。
- **慢速高亮敌弹**：已有和新发射敌弹均降至原速 55%，黄色外框 / 白色内芯放大显示；玩家移动、己方射速、敌弹碰撞范围保持不变。
- **无敌护盾**：免疫敌弹、接触伤害和机关；坠落仍重生。与无限生命组合后，坠落也不消耗生命。

选项随完整存档保存、重开 / 选关 / 下一关保留，PC / 手机互不覆盖。辅助局最高分与完成记录单列 `assistedBest` / `assistedRecords`；使用过辅助的本局一直标为 `assisted`，关掉开关也不混入经典成绩，关闭全部并重开后恢复经典记录。旧 v1 对局、武器、敌弹、房间和经典成绩均保留，辅助默认关闭。

新增 `tests/cheats.test.mjs` 与 `tools/cheats-smoke.mjs`（同时测试两款独立游戏），覆盖真实击杀 / 重生、重复空中跳跃、敌弹减速、菜单暂停 / 自动恢复、存档兼容、计分隔离、全屏和手机触控。

## 素材与还原范围

- 八张原版背景：[NES Maps / Rick N. Bruns](https://nesmaps.com/maps/Contra/Contra.html)。保存原文件，运行时裁切去掉图注。
- 186 个原版精灵：[vermiceli/nes-contra-us](https://github.com/vermiceli/nes-contra-us/tree/main/docs/sprite_library/contra_sprites)，固定提交 `687d651c021fd7020f10d05b970ccb62663c94bd`。装入单图集时逐可见像素验证。
- 首关平台 / 水域 / 断桥事实数据：[IvanAmamiya/contra-nes-css](https://github.com/IvanAmamiya/contra-nes-css)。后续地形从原图边缘标注，补充瀑布移动石台。
- 七轨 NES 原声录音：[VGMPF Contra (NES)](https://www.vgmpf.com/Wiki/index.php/Contra_(NES))，TheAlmightyGuru 录音，Scott Worley 提取；保存未修改 OGG，按关卡切曲，仅当前曲目由浏览器加载。
- 音效：[GitHubLXHan/contra](https://github.com/GitHubLXHan/contra) 和 [mbudhathoki200/CONTRA-GAME](https://github.com/mbudhathoki200/CONTRA-GAME)。
- 每个媒体文件原 URL、SHA-256、尺寸 / 时长见 `asset-sources.json`、`bgm-sources.json`；精灵动作见 `animations.json`。原媒体权利归原权利人，未将其标为 MIT 或公有领域。

这是独立实现的网页复刻，**不是原程序模拟，也不承诺逐帧一致**。原版背景、角色和关卡音乐直接使用已记录来源的公开文件；武器、核心、碰撞、敌军、机关和 Boss 为新引擎，后七关敌军配置、部分机关 / Boss 造型及数值为适配实现。未打包 ROM / NSF / 模拟器。

## 开发

```powershell
node games/contra/tools/build.mjs      # 修改 src 后生成无外部依赖 public/engine.mjs
npm run check
npm test -- games/contra/tests
npm run build -- --games contra
```

图集装箱：`tools/pack-sprites.ps1 -SourceDirectory <原始精灵目录>`；地形标注：`tools/build-geometry.ps1`。工具只生成本站图集和碰撞数据，不修改原背景。
`tools/browser-smoke.mjs` 通过 playwright-cli run-code 检查八关渲染、实际键盘 / Boss 射击、下一关、保存续玩、全屏回退、三点真实触控和屏宽适配。
