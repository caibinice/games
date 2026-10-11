# 拼就完了 · 毛球小镇

## 交付

- 纯静态手机 H5，没有游戏后端、广告 SDK 或第三方运行时请求。
- 入口：https://caibinice.com/games/pindou/；无尾斜杠地址自动跳转。
- 两条归位路线：选中画板错色豆后，直接点击同色底色的空格归位；没有合适空格时先暂存，再选暂存豆归位。支持连取、多颗与部分放入，正确豆锁定；直接归位也支持撤销和库存校验。
- 连取仅匹配豆色：选中上下左右相邻且豆色相同的错色豆，跨背景底色也可连选；正确豆、空槽、留白和不相邻区域不连选，数量不限。直接归位优先搬最初点选豆子所在底色下的选中豆（不是目标凹槽的颜色），再按原顺序搬其它底色下的豆；这个优先底色保持到本组放完。暂存、归位都没有单次颗数限制；暂存按真实剩余空位收下，归位仅填点击处连通的同色空区。未放完的选择保留，可继续点击其它同色空区或暂存空格。
- 暂存豆在每次移动、道具、撤销、扩行和刷新恢复后自动向前排齐，相同颜色连续归并。扩行时保留选中豆的身份，兼容旧 Cookie 中交错的颜色。
- 100 关、40 种独立单主体像素图，10 个章节。第 1～40 关图案不重复，第 41～80 关按相同顺序使用第二套配色，第 81～100 关使用第三套配色的前 20 种图案；每种图案出现 2～3 次。新增大棒棒糖、水杯、照相机、冰淇淋、蛋糕、火箭、热气球、帆船、伞、蘑菇、乌龟、狐狸、熊猫、猫头鹰、恐龙、小象、火车、书包等。第一关仍为 10×12、120 格、20 颗错色豆的七步教学；之后包围尺寸 16×18 至 20×22，100% 按当前可用宽高完整呈现。普通图案 3～8 色，配色都明亮；模板移除单格碎点，大块同色区域优先。
- 不规则轮廓：94 关只显示主体轮廓，6 关（第一关及沙发、小屋）保留矩形。图形外不绘制豆子，也没有可操作空槽或矩形边框；只沿整片图形绘制一条连续外轮廓。保留一圈上下左右连通的同底色外沿，初始豆块按背景区 BFS 排列；预览、图鉴、通关、导出、库存与完成度统一按有效格计算。当前有效格数 120～440。
- 两行、每行 12 个暂存格起步；每次直接免费加一行，无领取次数限制。新增行（包括空行）自动切到末行，立即显示。暂存盒随屏高显示 1～3 行，通过「上一行 / 下一行」访问全部空间，显示当前行范围和总行数；没有独立滚动条，也不推动整页滚动。翻页只是显示窗口，不减少真实容量、不限制一次暂存的颗数；同色归并和选中豆身份保持。
- 初始倒计时 180 秒；时间结束保留画板与暂存盒，点击弹窗免费再加 180 秒，不限次数；游戏中也可点击时钟提前追加。
- 磁铁归位 10 颗，整理刷把暂存豆放回同色空孔；道具旁“＋”直接免费补充。撤销保留后续扩容。
- Cookie 保存关卡收藏、当前画板、暂存豆、行数、计时及设置。颜色库存校验过滤损坏状态；当前状态和收藏分别压缩存储，Cookie 路径限定为 /games/pindou。
- 操作时计时，设置/图鉴/预览弹窗及隐藏页面暂停。刷新后从首页继续未完成的一关。
- 设置新增独立的「录屏背景音乐」，从长录屏分离抑制操作音后作 42 秒循环，与原点击音效分别控制。开始 / 继续后播放，弹窗 / 后台暂停，首页安静；刷新保留偏好，旧静音设置保持静音。来源、处理及验收见 [音乐记录](../../../docs/music-20261011.md)。
- 隐藏跳关：在首页或游戏画面，2.5 秒内连续点击顶部「拼就完了」5 次，打开「管理员 · 自由跳关」。可输入 1～100，或按章节点任意缩略图；不验证密码，不需要后端。跳关本身不标记通关、不虚增收藏。切换未完成的画板前确认，取消保留状态；点击当前关继续原画板。刷新后继续跳入的关卡，普通图鉴继续按真实通关进度解锁。
- 完整图案预览只展示当前简单像素拼豆画，以及实际使用的 3～8 种颜色。原有十幅生成插画保留为淡化装饰背景，不再决定目标格子。
- 当前仍用带 artKey 与轮廓标记 q 的 v4 Cookie。冻结原 50 关 simple-v1 图库：旧 v3 / v4 原样接续，画板、暂存、行数、时间、步数、道具、原图与配色全部保留。新开 / 重开才采用 simple-v2 的 100 关目录；第一关 kitten-guide-v1 不变。旧 v3 继续保存为 v4/q=0，轮廓为 q=1，外部格子以 x 保存并校验。更早 v1 / v2 的 2～50 关仍先验证旧库存再重开同关新图，保留行数与道具。收藏及设置 Cookie 不清空，原已完成 50 关可继续第 51 关。
- 单颗/同色连取切换，100%～320% 缩放，双指捏合和拖动，桌面滚轮与方向键；完整图案预览、可选颜色编号、通关收藏及 PNG 导出。
- 颜色辨识：参考原截图与视频的伪 3D 样式，目标底板颜色在豆子周围连续显示。空槽用更深的上缘内阴影与下缘亮边表现凹陷；所有豆子均用圆角方形、斜面高光、加厚底面与投影表现凸起，两者尺寸一致。豆色与底色一致即已归位。没有圆孔或额外纹饰；选中豆使用与暂存盒一致的蓝色实线框；仅匹配空槽使用白衬蓝虚线提示。暂存豆使用与画板同一个 Canvas 凸豆绘制器，取出 / 暂存 / 直接归位附带成组弧线飞豆。默认 100% 按可用宽高居中完整呈现，画板手势只缩放 / 拖动画板，不缩放或滚动整个页面。
- 整色完成：某颜色的所有目标格都正确填满时，该颜色整片同步轻闪一轮（720ms），随后在原凸豆斜面上保留一条静态斜向炫光。凸起高度、底影、斜面及背景颜色完全不变，不压成平面，也不持续循环动画。只有局部归位的颜色没有这条炫光。直接归位、暂存归位、磁铁与整理刷一致触发；撤销去掉炫光，再次完成可以重新闪光。刷新时直接恢复炫光，不重复庆祝；减少动态设置保留静态炫光与文字提示，跳过闪光。最后一色在通关画作上继续轻闪，收藏立即保存，不等待动画。
- 历史配色调整（2026-10-05）：深紫、深绿与深蓝曾替换为明亮配色，当前选中豆为实线、匹配空槽为虚线；存档按上述 v4 规则兼容。
- 开始按钮首次用户手势触发自动全屏，可在设置关闭；右上角手动切换全屏，支持时调用竖屏锁定。浏览器未开启原生全屏时使用沉浸式竖屏布局。动态视口高度适配地址栏和全屏切换，游戏固定一屏、无页面上下滚动；横屏保留窄竖屏布局，短屏收紧辅助文字与工具。设置 / 图鉴弹窗仍可滚动。
- 大块爽感：矩形沿蛇形路径、轮廓按背景区 BFS 排列，以一至两批大色块打乱；挑选初始排列时降低孤立错色豆的评分，尤其避开碎边。默认非教学关最大连取组为 33～150 颗；轮廓外沿最大连取组至少 20 颗，每关孤立错色边豆至多 1 颗。普通图案单格颜色碎点少于 2%，至少两色各有 12 格以上的大色区。归位短暂高亮并显示数量；减少动态模式保留静态炫光和文字提示。

## 2026-10-11 录屏优化

保留全部 100 关、取放规则及存档协议，仅升级立体绘制、成组飞豆、动态视口与暂存行显示。
52 项拼豆测试通过，含 150 份真实旧 v3/v4 存档、全部 100 关库存 / 轮廓及连续归位；
18 行、216 个暂存格逐一可访问，刷新后容量保留，新增空行立即可见。
完整手机尺寸 / 全屏 / 触屏模拟结果见 [录屏优化记录](../../../docs/video-optimization-20261011.md)。
下方日期章节为历史验收，旧版整页滚动与两行暂存上限不代表当前行为。

## 目录

- 游戏源码及全部资源：`E:/codes/games/games/pindou/public/`
- 核心引擎：`E:/codes/games/games/pindou/public/engine.mjs`
- 关卡画作：`E:/codes/games/games/pindou/public/artworks.mjs`
- 当前单物体像素图：`E:/codes/games/games/pindou/public/patterns.mjs`
- 不规则有效格、连续边缘及外轮廓：`E:/codes/games/games/pindou/public/shapes.mjs`
- 凹槽 / 凸豆 Canvas 渲染：`E:/codes/games/games/pindou/public/beads.mjs`
- 冻结的 50 关 simple-v1 图库 / v3、v4 原样接续：`E:/codes/games/games/pindou/public/previous-simple-artworks.mjs`
- v2 旧版插画库存 / 存档迁移：`E:/codes/games/games/pindou/public/previous-artworks.mjs`
- 历史插画数值格 / 背景元数据：`E:/codes/games/games/pindou/public/artwork-data.mjs`
- 旧画作库存 / 存档迁移：`E:/codes/games/games/pindou/public/legacy-artworks.mjs`
- 隐藏入口及关卡编号校验：`E:/codes/games/games/pindou/public/admin.mjs`
- 十幅画素材与最终提示词：`E:/codes/games/games/pindou/public/assets/scenes/manifest.json`
- 历史插画 WebP / 格子转换（不生成当前简单图）：`E:/codes/games/games/pindou/tools/generate-artworks.py`
- 前端交互：`E:/codes/games/games/pindou/public/app.mjs`
- 新手引导阶段：`E:/codes/games/games/pindou/public/guide.mjs`
- 可读性与新手界面样式：`E:/codes/games/games/pindou/public/readability.css`
- 规则测试：`E:/codes/games/games/pindou/tests/pindou.test.mjs`
- 本地预览：`E:/codes/games/scripts/preview.mjs`
- 独立部署：`E:/codes/games/scripts/deploy.py`
- 专用 Nginx 路由：`E:/codes/games/deploy/nginx/pindou.conf`
- 共享路由同步保留对应片段：`E:/codes/ai-blog/deploy/nginx/ai-platform-routes.conf`

## 开发与发布

本游戏于 2026-10-09 迁入独立仓库 [caibinice/games](https://github.com/caibinice/games)，现有游戏代码 / 100 关 / Cookie 均保持不变。

```powershell
Set-Location E:/codes/games
npm ci
npm run check
npm test
npm run build
npm run audit:secrets
npm run dev
# http://127.0.0.1:4176/games/pindou/
pwsh -File scripts/deploy.ps1
```

独立凭据、构建包、Nginx 映射、换机与回滚见 [部署手册](deployment.md)，迁移记录见 [migration.md](migration.md)。

以下迭代记录中的原博客路径、旧发布命令、备份及 release 为历史归档；当前维护以新仓库部署手册为准。共享 Nginx route 仍镜像在博客，源码及构建不再由博客管理。

## 跨底色连选、起点优先与 100 关图库（2026-10-09）

- 移除连选的背景底色限制，保持相邻、同豆色、仅错色豆及不限数量；直接归位使用起点底色优先的稳定分组，剩余选择可持续放进其它空区。单颗模式、暂存自动归并、无限扩行与免费道具不变。
- 40 种独立图案按 40 关一轮排列，第二、第三轮是真正改变 RGB 配色，不只改名称。按用户指定总量提供 100 关，第三轮到第 20 种；每图最多三关。保持最多 20 列的大格子，增加 19 种物件 / 动物及较丰富的色区。
- 冻结修改前全部 50 关的目标图与配色，使用旧引擎生成 150 份含暂存、扩行、计时与道具的真实 v3 / v4 存档作为测试夹具。逐项原样接续并再次保存通过；重开使用新图，第一关教学保持原状。
- 本地全量 61 项测试（51 游戏 + 10 博客）、TypeScript 与生产构建通过。所有 100 关普通取放、工具完整通关；四种种子库存检查、轮廓闭合 / 连续边缘、40 种图案唯一性、轮次换色、颜色亮度、碎点占比、起点优先 / 剩余 / 撤销 / 错点不改状态，以及 100 个收藏记录的 Cookie 容量通过。
- 手机浏览器验证跨底色三颗连选的实线框、起点底色优先两颗后继续放剩余一颗、另一个起点改变优先序、单颗 / 帮助、10 章 100 张缩略图、管理员 100 / 101 校验与取消、棒棒糖 / 水杯 / 相机预览、40→41 / 80→81 换轮、旧 v4 原图接续 / 重开、50→51 / 99→100 / 第 100 关返回首页及原 50 收藏继续解锁，页面错误 0。
- 七步教学、两条归位路线、一次暂存 70 颗、36+34 按空位分批、无内层滚动条、静态炫光、撤销、工具、免费续时 / 超时、暂停、Cookie、全屏与六种屏幕尺寸回归通过。缓存版本 20261009-1。
- 修改前源码备份：`E:/Documents/AI/codex/backups/pindou-100-20261009-132343/`；图库预览、浏览器截图与回归结果：`E:/Documents/AI/codex/tmp/pindou-100-20261009-132343/`。

- 北京时间 2026-10-09 13:39 发布 release `20261009053915`；公网 HTTPS 重复执行新连选 / 优先归位 / 100 关图库、旧 v4 接续、完整七步教学 / 六屏 / 全屏、无限暂存 / 无内层滚动及静态炫光回归，全通过，页面错误 0。全部 33 个源码 / 构建 / 公网资源 SHA-256 一致；MJS MIME、缺失资源 404 与尾斜杠跳转通过。Nginx 语法 / 服务、博客 / 停车健康检查通过，共享路由哈希仍为 `c2b3565dd358c75dfc89ec746a1c86513b8d5c7c160b1d6ca6bdec5f460f36a3`。
- 发布回滚：`E:/Documents/AI/codex/backups/pindou-20261009-133915/rollback.json`；服务器快照：`/opt/pindou/backups/20261009053915/`；上一版：`20261007111718`。

## 移除单次暂存两行上限（2026-10-07 晚）

- 移除引擎 MAX_STORE_COUNT / 24 颗上限，单次暂存数量改为「选中豆数量」与「暂存盒真实剩余空位」的较小值。扩至六行后，70 颗连选可一次收进；不足时只填满空位，剩余豆保持选中，加行后继续放。
- 保留两行起步、每行 12 格、免费无限加行、同色自动归并、无独立滚动条、同底色连取与直接归位。Cookie 版本 / artKey / 轮廓标记均不变，已有画板和暂存进度原样继续。
- 修改 engine.mjs、app.mjs、index.html（缓存版本 20261007-2），同步提示与玩法说明，更新 tests/pindou.test.mjs 及本文。全量 57 项测试通过（47 游戏 + 10 博客），TypeScript 与生产构建通过，32 个构建资源与源码 SHA-256 一致。
- 本地手机浏览器验证一次暂存 70 颗、36 空位先收 36 颗 / 扩行再收剩余 34 颗、撤销整次操作、同色排齐、刷新恢复、320px / 390px 暂存行全展开、没有独立滚动条及新帮助文本，页面错误 0。
- 修改前备份：`E:/Documents/AI/codex/backups/pindou-store-unlimited-20261007-191154/`（32 个游戏文件逐一核对）；测试与截图：`E:/Documents/AI/codex/tmp/pindou-store-unlimited-20261007-191154/`。下述历史记录中的 24 颗限制已由本次变更移除。
- 北京时间 19:17 发布 release `20261007111718`，线上重复验证一次收 70 颗、36+34 颗按空位分批、撤销、扩行、自动归并、v4 存档接续和手机布局，全部通过，页面错误 0；32 个公网文件 SHA-256 与源码一致，模块 MIME、缺失资源 404 与入口尾斜杠跳转通过。Nginx 语法 / 服务及博客、停车站点健康检查通过，共享路由哈希未变。
- 发布回滚：`E:/Documents/AI/codex/backups/pindou-20261007-191718/`；服务器快照：`/opt/pindou/backups/20261007111718/`；上一版：`20261007054050`。

## 静态炫光、同底色连取与不规则轮廓（2026-10-07）

- 取消上一版压合态：完成色与未完成色使用相同的凸起几何、底部阴影、斜面和目标底板；完成色仅增加静态斜向反光，720ms 整色轻闪后稳定显示，不持续刷新动画。
- 连取同时判断豆色与背景色，并保留上下左右邻接规则、不限选择数量、暂存每次 24 颗与剩余连续归位。实线选中豆、虚线匹配空槽及同色归并不变。
- 新增 shapes.mjs：40 关采用不规则有效格，连续外沿统一底色、轮廓只描边一次；图形外留白不参与点击、道具、完成度和胜利统计。首关教学及 9 个普通关卡保留矩形。所有 40 个轮廓均验证为单闭合轮廓、外沿底色四邻接连通，无独立单格边框。
- v4 存档通过 q 区分矩形 / 轮廓，不变更原 artKey。使用修改前真实旧引擎生成的 50 份 v3 存档逐项比对：画板、暂存、空间、剩余时间、操作数和道具完全一致，原关卡不重开；新开 / 重开才进入轮廓图。
- 全量 55 项测试通过（45 项游戏、10 项博客），TypeScript 检查及生产构建通过。包含矩形和新轮廓全部 50 关普通取放通关、轮廓道具与撤销、空白区拒绝操作、四种随机种子库存、有效格完成度、v4 保存 / 恢复及旧 v3 接续。
- 浏览器验证：70 格整色轻闪与静态炫光、凸豆保持、没有循环动画、仅完整颜色反光、直接 / 暂存 / 道具归位、撤销 / 再完成、静默恢复、减少动态和通关画作；不同背景的相邻同色豆只选中当前区，框仍为实线；轮廓外无画板底色、阴影、矩形边框或可点击格子。完整七步教学、普通通关、隐藏跳关 / 取消、v3 继续与重开进入轮廓均通过，页面错误 0。20 种图形浏览器总览已逐张查看。
- 暂存 2～10 行全部实际展开、无独立滚动条、新行自动显示、最末格可暂存，24 颗 / 次和剩余选择保持。320×568、375×667、390×844、430×932、844×390、1440×1000 及手动全屏通过，100% 画板不因暂存扩容变小。
- 修改前源码 / 测试 / 文档 / 部署脚本备份：`E:/Documents/AI/codex/backups/pindou-gloss-shape-20261007-132448/`（31 个游戏文件逐一哈希核对）；测试脚本、真实 v3 样本、20 图总览与截图：`E:/Documents/AI/codex/tmp/pindou-gloss-shape-20261007-132448/`。缓存版本为 20261007-1。
- 北京时间 2026-10-07 13:40 发布 release `20261007054050`；线上重复验证炫光 / 全色轻闪、同底色连取、轮廓与留白、旧 v3 接续、重开、隐藏跳关、暂存扩行、七步教学、工具 / 撤销 / 暂停 / Cookie / 续时 / 六屏及全屏，全部通过，页面错误 0。32 个构建与公网资源 SHA-256 均与源码一致，MJS MIME、缺失资源 404 与尾斜杠跳转通过。
- 发布回滚：`E:/Documents/AI/codex/backups/pindou-20261007-134050/`；服务器快照：`/opt/pindou/backups/20261007054050/`；上一版：`20261006153355`。Nginx 检查与博客 / 停车路由健康检查通过；共享 Nginx 片段 SHA-256 保持 `c2b3565dd358c75dfc89ec746a1c86513b8d5c7c160b1d6ca6bdec5f460f36a3`，其它站点配置未改变。

## 整色完成与暂存扩行修复（2026-10-06 23:33）

- 对原始录屏按秒抽取 15 帧，参考已完成粉色区域的浅斜面 / 浅阴影压合表现。整色完成状态从目标与画板实时计算，不新增存档字段、不更换图案 / artKey，不影响当前 v3 关卡接续。
- 修复两处扩行限制：删除按占用量隐藏空行的渲染逻辑；移除暂存盒 105px 固定高度与独立滚动区。全屏游戏区域也移除 950px 高度上限。添加行后通过整页滚动露出新行；暂存豆仍自动归并，单次暂存仍最多 24 颗，剩余选择保持。
- 游戏修改：`E:/codes/games/games/pindou/public/engine.mjs`、`E:/codes/games/games/pindou/public/beads.mjs`、`E:/codes/games/games/pindou/public/app.mjs`、`E:/codes/games/games/pindou/public/style.css`、`E:/codes/games/games/pindou/public/readability.css`、`E:/codes/games/games/pindou/public/index.html`（缓存版本 20261006-3）；测试及本文同步更新。
- 全量 46 项测试通过，其中 36 项游戏测试；TypeScript 与生产构建通过，31 个构建游戏资源与源码哈希一致。浏览器专项验证整片 70 格同色同步闪光、完成后低浮雕样式、直接 / 暂存 / 道具归位、同时完成两色、脉冲中继续选择、撤销与再次完成、Cookie 静默恢复、减少动态模式及通关画作最后一色闪光；页面错误 0。
- 暂存盒从 2 行逐次扩至 10 行，24～120 个实际格子全部渲染。390px 手机上暂存区从 2 行高度逐行增长到 277px，格子区域 scrollTop 始终为 0、overflow 为 visible，100% 画板宽高保持不变。最末格实际接受暂存豆，并保持 24 颗上限与自动排齐。刷新后所有空白扩行保留。
- 320×568、375×667、390×844、430×932、844×390、1440×1000 与手动全屏通过；无横向溢出，通过整页滚动可访问所有格子、工具及页脚，新增行自动进入可见区域。
- 修改前 31 个游戏文件逐一哈希校验备份：`E:/Documents/AI/codex/backups/pindou-colors-tray-20261006-231306/`；参考视频抽帧、浏览器脚本、截图及诊断：`E:/Documents/AI/codex/tmp/pindou-colors-tray-20261006-231306/`。
- 公网 HTTPS 重复执行整色完成、扩行、实线 / 虚线选中框、完整七步教学、普通通关、工具 / 撤销 / 暂停 / Cookie / 超时续时 / 六屏 / 全屏、大组连续归位及新图 / 隐藏跳关 / v2 迁移专项，全部通过，页面错误 0。31 个公网静态文件 SHA-256 与源码一致，MJS MIME、缺失资源 404 及标准尾斜杠地址跳转通过。
- 新 release：`20261006153355`；发布回滚：`E:/Documents/AI/codex/backups/pindou-20261006-233355/`；服务器快照：`/opt/pindou/backups/20261006153355/`；上一版：`20261005231722`。Nginx 检查与博客 / 停车路由健康检查通过，共享 Nginx 片段 SHA-256 仍为 `c2b3565dd358c75dfc89ec746a1c86513b8d5c7c160b1d6ca6bdec5f460f36a3`，未改变其它站点配置。

## 选中框修复（2026-10-06 07:17）

- 原因：Canvas 绘制将已选中的错色豆与可归位空槽共用同一套虚线提示。现在按占用状态分开：画板选中豆用与暂存盒一致的 #224f87 蓝色实线框；只有匹配所选颜色的空槽保留白衬蓝虚线。未选中或颜色不匹配的空槽保持原凹槽样式。
- 游戏源码只修改 `E:/codes/games/games/pindou/public/beads.mjs` 和 `E:/codes/games/games/pindou/public/index.html`（缓存版本 20261006-2）；引擎、图案、Cookie 版本 / artKey 均未变，已有未完成关卡原样接续。测试与本文同步更新。
- 全量 40 项测试通过（30 项游戏测试），新增实际 drawBead 描边命令检查；TypeScript 和生产构建通过。浏览器 390×844 / 320×568 验证，实际 Canvas 检测到 7 个实线选中豆、7 个虚线目标空槽；暂存选中框确认为 solid / rgb(34, 79, 135)。直接归位、暂存归位、库存及刷新恢复通过；公网 HTTPS 重复验证通过，页面错误 0。
- 31 个公网静态文件 SHA-256 与源码一致，模块 MIME、缺失资源 404 和标准尾斜杠跳转通过。Nginx 配置检查及既有博客 / 停车系统健康检查通过。
- 修改前源码备份：`E:/Documents/AI/codex/backups/pindou-selection-20261006-071316/`；截图 / 浏览器脚本 / 资源比对：`E:/Documents/AI/codex/tmp/pindou-selection-20261006-071316/`。
- 新 release：`20261005231722`；发布回滚：`E:/Documents/AI/codex/backups/pindou-20261006-071722/`；服务器快照：`/opt/pindou/backups/20261005231722/`；上一版：`20261005224953`。

## 大格子与简单像素图修订（2026-10-06）

依据用户提供的原版截图和本地录屏对照，减少密度、简化构图，并统一空槽 / 凸豆风格。这次像素图直接用整数格绘制，不是将复杂插画缩小或只更换配色。

| 章节 | 原规格 | 新规格 | 新格数 |
| --- | --- | --- | --- |
| 轻巧开拼（非教学关） | 20×22 | 16×18 | 288 |
| 缤纷小物 | 22×24 | 17×19 | 323 |
| 暖暖午后 | 24×26 | 18×20 | 360 |
| 小镇收藏 | 26×28 | 19×21 | 399 |
| 快乐满格 | 28×30 | 20×22 | 440 |

第一关维持 10×12 教学猫咪，旧教学存档原样接续。第 2～21 关依次是：奶糖蝴蝶、软软桃子、草莓甜心、西瓜一片、双份樱桃、甜梨小胖、苹果红了、菠萝假日、柠檬汽水、香蕉弯弯、小橘眨眼、小狗吐舌、奶油兔兔、小鸭游呀、泡泡小鱼、软软沙发、床头小灯、一杯暖茶、郁金香开、糖果小屋；随后按此顺序轮换。主体使用 2～5 色，加上纯色背景共 3～6 色。

- 空槽与凸豆采用相同 78% 圆角方形足迹；凹槽内阴影、下缘亮边和凸豆斜面 / 底面阴影相互协调。已归位豆也保持凸起，不再变成平铺整格。留出四周 11% 目标底色，豆色和底色都可辨识；没有中心圆孔。
- 错色豆大批沿蛇形路径排布，初期较少切分、后期增加分区，而非每 3～9 颗杂色打散；保留不限数量连选、暂存每次 24 颗及跨空区连续归位。整片归位增加 360ms 高亮和数量反馈，减少动态设置下停止动画。
- 全量 38 项测试通过，其中 28 项游戏测试；包含 20 图颜色归一化后结构仍不同、尺寸 / 色数 / 大组约束、凹凸几何、两代旧 Cookie 迁移和原有全部取放规则。TypeScript 与生产构建通过；31 个构建静态文件与源码 SHA-256 一致。博客已有的循环分块提示保持原状。
- 使用改动前备份中的旧引擎生成 50 份真实 v2 关卡存档（含已占用暂存盒、扩行与道具），全部恢复通过：第一关原样保留，49 个换图关卡保持关号 / 行数 / 道具，给回 180 秒；v3 再次保存 / 恢复通过。
- 浏览器完整回归：七步教学、第一关普通通关、下一关、工具、撤销、预览暂停、Cookie 刷新、超时 / 无限续时、手动全屏；320×568、375×667、390×844、430×932、1440×1000、844×390 无横向溢出。100% 画板按宽度完整呈现。
- 大组专项通过：50 颗全选、24+24+2 暂存、35 颗暂存豆跨空区连续归位及重排高亮；另外用真实连通区域验证一次填满 50 个同色凹槽、整片数量反馈、撤销与减少动态模式。隐藏跳关确认 / 取消 / 同关继续、普通图鉴锁定、无虚假收藏与旧存档迁移均通过。
- 改动前完整源码 / 测试 / 部署脚本 / 文档备份：`E:/Documents/AI/codex/backups/pindou-simple-20261006-062732/`，28 个原游戏文件哈希逐一校验。
- 本地参考视频抽帧、图案总览、浏览器脚本与截图：`E:/Documents/AI/codex/tmp/pindou-simple-20261006-062732/`。
- 线上 release：`20261005224953`，北京时间 2026-10-06 06:49 发布；Nginx 配置检查、所有新模块 / 资源 HTTP 自检、博客及停车站点健康检查通过。
- 发布回滚：`E:/Documents/AI/codex/backups/pindou-20261006-064953/`；服务器快照：`/opt/pindou/backups/20261005224953/`；上一版 release：`20261005010026`。
- 公网 HTTPS 重复执行新图 / 隐藏跳关 / v2 迁移 / 50 连通空槽整片归位、连续大组专项及完整新手 / 工具 / 六屏回归，全部通过，测试页面错误为 0。全部 31 个静态文件 SHA-256 与本地一致，模块 MIME、缺失资源 404 和入口尾斜杠跳转通过。

## 连选与配色修复验证（2026-10-05）

- 全量 32 项测试通过，其中 22 项游戏规则测试。新增 50 颗连选、六行暂存仍按 24+24+2 分次、满盒/少空位保留选择、多个分离空区连续归位、35 颗暂存豆重排后的选择索引、错点保留状态、50 个连续空格一次填满，以及所有配色相对亮度大于 0.24。
- TypeScript 与生产构建通过；保留博客已有的循环分块提示。50 个旧关卡的目标图案及未完成 Cookie 逐一恢复比对通过。
- 手机尺寸浏览器验证：实际连选 50 颗，暂存分 24+24+2，画板直接连续点击多处空区，暂存盒 35 颗连续归位且保持剩余高亮，撤销、自动归并、刷新库存与帮助说明通过。100% 下检查 390×844 和 320×568 的空格虚线。
- 改动前源码备份：`E:/Documents/AI/codex/backups/pindou-continuous-20261005-001557/`。
- 测试脚本、截图与诊断：`E:/Documents/AI/codex/tmp/pindou-continuous-20261005/`。
- 完整浏览器回归覆盖七步引导、下一关、免费道具/续时、刷新、超时、全屏和六种尺寸；公网重复执行本次大组连选及跨区域连续归位，页面错误为 0。
- 线上 release：`20261004163138`，北京时间 2026-10-05 00:31 发布；Nginx 配置、自检与既有站点健康检查通过。回滚到上一版 `20261004154052` 的记录在 `E:/Documents/AI/codex/backups/pindou-20261005-003138/`，服务器快照：`/opt/pindou/backups/20261004163138/`。
- 全部 14 个公网静态资源 SHA-256 与本地一致，模块 MIME 正确，缺失资源返回 404，入口无尾斜杠时跳转到标准地址。

## 上次修复验证（2026-10-04）

- 全量 Vitest 24 项通过，其中 14 项游戏测试新增画板直接归位、部分放入、错误目标不改状态、撤销库存守恒、暂存排齐及选中索引重映射、旧 Cookie 散色恢复、七步实际教学和单颗/道具分支。
- TypeScript 检查与生产构建通过；构建仍有博客已有的 vendor-vue / vendor-misc 循环分块提示。
- 浏览器实际操作通过：七步引导、刷新接续引导、画板直接归位、暂存豆归位、撤销后引导定位、设置/玩法/重玩入口、第一关普通操作通关、第 2 关保持复杂度、混色暂存即时归并、续时/道具/全屏/刷新恢复。
- 320×568、375×667、390×844、430×932、1440×1000、844×390 六种尺寸验证无横向溢出，默认画板按宽度铺满；空间不足可上下滚动。截图及浏览器回归脚本在 `E:/Documents/AI/codex/tmp/pindou-update-20261004/`。
- 改动前源码备份：`E:/Documents/AI/codex/backups/pindou-update-20261004-225525/`。
- 旧版未完成的第一关画板因尺寸变更会重新开始；其它关卡画板与已收藏的进度保持兼容。
- 49 个旧版关卡目标图案和旧 Cookie 状态逐一比对通过；直接归位保持库存，旧散色暂存自动归并。
- 公网 HTTPS 重复执行完整交互回归、新手重玩/跳过、50 关图鉴、最后一关默认显示、真实触摸捏合和滚动后的弹窗定位，全部通过，页面错误为 0。
- 新版 release：`20261004154052`，北京时间 2026-10-04 23:40 发布。Nginx 检查通过，全部 14 个公网资源 SHA-256 与本地一致，模块 MIME、尾斜杠跳转、缺失资源 404 验证通过；博客与停车系统原路由健康。
- 发布回滚备份：`E:/Documents/AI/codex/backups/pindou-20261004-234052/`；服务器：`/opt/pindou/backups/20261004154052/`。上一版 release：`20261004143110`。

## 首次版本验证（2026-10-04）

- 全量 Vitest：18 项通过，其中 8 项游戏规则测试涵盖 50 关图案唯一性、复杂度、普通取放全部通关、工具全部通关、库存守恒、满盒、撤销、扩容、无限续时及 Cookie 校验。
- Vue/TypeScript 检查通过；完整博客生产构建通过，游戏静态文件被保留。
- Playwright 实际界面操作：取豆/暂存/同色归位、扩行、免费领取/使用道具、撤销、续时、弹窗暂停、刷新恢复、到期弹窗续时、通关解锁下一关、手动全屏、50 关图鉴通过。
- 双指触摸事件验证捏合缩放通过；验证 320×568、375×667、390×844、430×932、1440×1000、844×390 的布局，没有横向溢出；短屏采用可滚动画板布局。
- 诊断脚本和截图：`E:/Documents/AI/codex/tmp/pindou-20261004/`。界面控制台当前页面 0 个错误、0 个警告。
- 线上 release：`20261004143110`，北京时间 2026-10-04 22:31 发布；Nginx 配置与公网 301/200、ES module MIME、全部资源、缺失资源 404 验证通过。
- 公网 HTTPS 浏览器重复执行完整交互回归通过；另验证第 50 关、50 个完整收藏记录保存、最后一关返回首页和 800×1000 PNG 实际下载。
- 本次线上备份：`E:/Documents/AI/codex/backups/pindou-20261004-223110/`；服务器：`/opt/pindou/backups/20261004143110/`。
- 关卡长度以实际操作量保证，未宣称真人实测固定通关时长；免费道具可主动缩短操作时间。

## 生成图片来源与最终提示词

使用内置 ImageGen 工具，未调用 API/CLI。下列首版三张原图经格式压缩为本地 WebP（每幅约 150–170KB），继续用于新手与小镇装饰，所有游戏内资源均随静态站点托管。当前关卡为原创代码像素图，不直接复制截图画作。下面记录的生成插画保留为淡化装饰背景；复杂图案数值格仅用于旧存档信息及历史记录。

### meadow.webp

最终保存：`E:/codes/games/games/pindou/public/assets/meadow.webp`

Use case: illustration-story. Asset type: polished mobile portrait puzzle-game background and collectible artwork. Primary request: an adorable fluffy cream kitten and small caramel puppy sitting together on a gingham picnic blanket in a blooming meadow, little daisies, butterflies and a distant cottage. Refined hand-painted cartoon storybook illustration, soft gouache texture, rounded appealing shapes, gentle light, mint sage, butter yellow, warm peach and ivory palette. Composition: vertical 2:3 portrait; characters concentrated in lower half, airy pale sky and tiny drifting flowers in upper half, beautifully detailed but calm, harmonious negative space in middle for a game board overlay. No text, no logo, no UI, no border, no watermark.

### cottage.webp

最终保存：`E:/codes/games/games/pindou/public/assets/cottage.webp`

Use case: stylized-concept. Asset type: cartoon artwork for a delightful portrait mobile bead puzzle. Primary request: a chubby orange-and-cream kitten napping with a tiny white puppy on a cushion by the window of a pastel cottage, a blue teacup and potted flowers, sunny countryside through the window. Style: refined 2D children's storybook game illustration, soft rounded cartoon animals, big simple color areas, expressive small faces, subtle paper grain, clean shapes not photorealistic. Portrait 2:3 framing. Warm cream, peach, muted terracotta, mint and sky blue; inviting afternoon sunlight. One complete scene, no panels, no UI, no writing or logos.

### lake.webp

最终保存：`E:/codes/games/games/pindou/public/assets/lake.webp`

Use case: illustration-story. Asset type: a whimsical mobile puzzle game's portrait background. Primary request: an exquisite cute cartoon landscape of a tiny mint-roof cottage on a floating grassy island in a calm blue lake, golden sunset, rounded peach clouds, pink flowering trees, a little wooden bridge, tiny ducks. Pure 2D animated-storybook aesthetic, beautifully painted, simplified charming shapes, cozy fantasy, visible soft gouache brushwork, no photography. Vertical 2:3 full scene with an airy luminous sky in the upper half, landscape in the lower half. Color palette cream, peach, mint, dusty pink, lavender and blue. No text, no logo, no UI, no watermark.


## 十幅新画与隐藏跳关（2026-10-05，历史版本）

此前关卡主要复用猫咪/小狗轮廓、局部装饰和配色。本次采用内置 ImageGen 分别生成十张原创插画，不是将同一图片换色。第 2～11 关首次按下列顺序使用，第 12 关回到毛线小猫，之后每十关轮换。第一关保留原新手教学。

| 首次关卡 | 画作 | 最终保存文件 |
| --- | --- | --- |
| 2 | 毛线小猫 | E:/codes/games/games/pindou/public/assets/scenes/yarn-kitten.webp |
| 3 | 气球小柴 | E:/codes/games/games/pindou/public/assets/scenes/balloon-corgi.webp |
| 4 | 蘑菇小屋 | E:/codes/games/games/pindou/public/assets/scenes/mushroom-cottage.webp |
| 5 | 鱼缸小猫 | E:/codes/games/games/pindou/public/assets/scenes/fishbowl-kitten.webp |
| 6 | 山间湖泊 | E:/codes/games/games/pindou/public/assets/scenes/mountain-lake.webp |
| 7 | 野餐小狗 | E:/codes/games/games/pindou/public/assets/scenes/puppy-picnic.webp |
| 8 | 月亮小猫 | E:/codes/games/games/pindou/public/assets/scenes/moon-kitten.webp |
| 9 | 花田风车 | E:/codes/games/games/pindou/public/assets/scenes/flower-windmill.webp |
| 10 | 小狗扬帆 | E:/codes/games/games/pindou/public/assets/scenes/puppy-sailboat.webp |
| 11 | 彩虹瀑布 | E:/codes/games/games/pindou/public/assets/scenes/rainbow-waterfall.webp |

- 生成方式：内置 ImageGen，每个场景独立提示词与调用，未使用 CLI/API。完整最终提示词、文件名和 SHA-256 存在 `E:/codes/games/games/pindou/public/assets/scenes/manifest.json`。
- 原图保留于内置工具的 generated_images 目录；最终项目资源为约 49～111KB 的 WebP，十张总计约 840KB。仅当前背景 / 预览图片按需加载。
- 数值格子直接取样每幅生成插画，而不是另用相同猫咪模板。BOX 区域采样后映射到统一明亮十色；所有交互豆色相对亮度大于 0.24，图片内深色像素不会成为深色豆。
- 五种规格预计算为静态数字数组，不需要后端、运行时图像解析或第三方请求。在安装 Pillow 的 Python 下执行 `scripts/generate-pindou-artworks.py` 可从已保存 WebP 重新构建数据。
- 普通取放自动解题的规则测试覆盖全部 50 关，非新手关操作数 244～669 次；这是规则脚本操作量，不是固定真人通关时间。
- 全量 35 项测试通过，其中 25 项游戏测试：十图结构差异（颜色标签归一化后仍不同）、五规格映射、WebP 哈希、背景与目标一致、十关轮换、旧画库存逐关迁移、隐藏五击计数及跳关编号校验。TypeScript 和生产构建通过，保留博客既有的循环分块提示。
- 手机浏览器验证：首页五击、第 50 关直接进入、编号越界校验、切换确认 / 取消、同关保留、无虚假收藏、普通图鉴锁定、跳关刷新续玩、十张原画加载及双预览、场景背景轮换、旧存档迁移及道具 / 收藏保留。
- 原有功能回归通过：七步新手、直接 / 暂存两路线、50 颗全选、24+24+2 暂存、35 颗暂存豆分区连续归位、重排剩余高亮、撤销、道具、无限续时、超时、全屏、六种屏幕尺寸。当前测试页面脚本错误 0。
- 改动前源码备份：`E:/Documents/AI/codex/backups/pindou-artworks-20261005-083059/`。
- 浏览器脚本、截图、生成来源记录：`E:/Documents/AI/codex/tmp/pindou-artworks-20261005/`。
- 线上 release：`20261005010026`，北京时间 2026-10-05 09:00 发布；Nginx 配置检查、全部新图片/模块 HTTP 自检与既有博客 / 停车系统健康检查通过。
- 发布回滚记录：`E:/Documents/AI/codex/backups/pindou-20261005-090026/`；服务器快照：`/opt/pindou/backups/20261005010026/`。上一版 release 为 `20261004163138`。
- 公网 HTTPS 再次执行十图加载 / 轮换、隐藏入口、跳关确认 / 取消 / 刷新、新手入口及键盘五击、旧存档迁移和大组连续归位，全部通过，测试页面脚本错误 0。
- 全部 28 个公网静态文件 SHA-256 与本地一致；mjs / JSON / WebP MIME 正确，缺失资源 404 和标准尾斜杠跳转通过。
