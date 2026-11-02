# 用户截图原版 UI 提取说明

日期：2026-10-23。原始素材由用户提供，本次仅在截图副本上使用 Pillow 裁切、WebP 压缩和透明蒙版；源 JPG 保持原状。未访问网络、客户端或凭证；未修改游戏 JS/CSS/HTML 和发布脚本。

## 源截图

源目录：`C:\Users\caibin\AppData\Local\UUYC\GameViewer\Download`。全部为 1080 × 2400。

| 源文件 | 内容 | 全屏参考输出 |
| --- | --- | --- |
| 1000070149.jpg | 开场宣传 | splash.webp |
| 1000070150.jpg | 商城 | screen-shop.webp |
| 1000070151.jpg | 战斗营地 | screen-campaign.webp |
| 1000070152.jpg | 核心 | screen-core.webp |
| 1000070153.jpg | 角色 | screen-character.webp |
| 1000070154.jpg | 实战 | 道路、炮台、技能12、电锯僵尸局部 |

## 使用约定

输出目录：`games/zombie/public/assets/original-ui/`。完整裁切坐标、尺寸、文件字节数、SHA256 与旧文字说明见同目录文档区的 `ORIGINAL_UI_MANIFEST.json`。坐标均为原图像素 `(x0,y0,x1,y1)`，右/下边界不含。

- `screen-*.webp`、`splash.webp` 是全屏参考底图，保留原 HUD、右上角微信胶囊、旧数据和原按钮图像。**真实数据、按钮点击和交互由主实现 DOM 重绘，整屏不作为假按钮。**
- `shop-tactical-banner.webp`、`shop-chest-banner.webp` 已去掉底部抽奖按钮条，仍保留原标题和旧保底数字 9 / 199；DOM 可直接覆盖旧数据区域。
- `skill-0..11.png`：172 × 172 透明圆形技能图，保留原绿色圆环，不含等级/通知红点；`skill-12.png`：78 × 78 战斗底部无人机圆图。
- `nav-{shop,character,core,battle,base,guild,journey}.png`：图标近景，矩形底仍带原导航底色，局部下缘少量旧文字。
- `nav-tile-*.png`：整格选中参考，206px 高；前四项来自各自选中页面，后3项保留未选中状态。
- `nav-*-off.png`：206px 高未选中整格，带中文标签。商城/角色/核心及后3项取自0151；战斗取自0150。可能保留截图原通知红点。
- `nav-highlight.png`：独立高亮底纹，按原截图干净像素采色重建黄橙渐变与青色顶边，不含图标/文字/红点。
- `equipment-{helmet,weapon,armor,pants,boots,gloves}.png`：6装备卡（另有0..5数字别名），含原21阶与127/128级文字；由主实现覆盖更新。
- `gem-rainbow.png`、`gem-red.png` 等为完整宝石卡，含部位标记、旧数量；`gem-*-art.png` 仅中心图案椭圆蒙版。
- `battle-road-tile.webp`：0154的 `(0,1160,1080,1400)` 干净道路段，**无静态僵尸/HUD**。`battle-road.webp` 将此段交替纵向镜像接合到1080 × 2000，路面及两侧碎石原生，重复纹理可见。
- `turret.webp`、`turret-front.webp`：原炮台底部区域，含旧能量/属性数值、小技能圆图；完整版还含生命条与角色。动态区需遮挡重绘。
- `zombie-chainsaw.png`：第二只电锯僵尸的手工多边形透明扣图；Pillow 未做逐像素智能分割，黑色轮廓局部有少量背景边色。`zombie-chainsaw-crop.png` 保留同区域原矩形供进一步处理。
- `resource-{diamond,gold,meat}.png`：顶部资源图标，带原加号与HUD深色底。

## 技能顺序

0 温压弹；1 干冰弹；2 高能射线；3 装甲车；4 制导激光；5 跃迁电子；6 冰爆发生器；7 电磁穿刺；8 旋风加农；9 空投轰炸；10 压缩气刃；11 燃油弹；12 无人机。

## 校验和回溯

全部输出已经 Pillow 解码并校验清单尺寸；技能/导航/装备/僵尸联系人图和干净道路经过目视复核。原素材版权沿用用户提供参考的原作品权利，不将截图声明为 CC0。

临时脚本、预览和完整清单副本：`E:\Documents\AI\codex\tmp\zombie-ui-20261023`。未修改原图；回滚只需停用/移除本次 `original-ui/` 输出与两份 `ORIGINAL_UI` 文档，不影响既有旧版人物和音乐。

输出合计：73 个文件，4,595,212 字节。
