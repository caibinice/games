# 参考客户端分析与还原进度（2026-10-24）

## 已验证的输入

- 用户指定页面：<https://www.k73.com/down/addj/587241.html>。
- 实际 APK：`com.ltzy.xnmkp`，versionName `1.10`，versionCode `10`。页面称“向牛马开炮”；这里记录该参考构建，不将其称为官方最新版本。
- 大小：409,834,498 bytes。
- MD5：`65d5979ab8f4d282a226ddbef2f7d400`，与页面标注一致。
- SHA256：`7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6`。
- ZIP 7,028 个成员全部通过 CRC 校验；早期 HTTP Range 的 7 个样本已与完整 APK 逐项 SHA256 对照一致。
- APK 未安装或执行，未连接其中的游戏账号、支付、SDK 或管理端地址。

原始样本、分析工具和完整导出位于 `E:\Documents\AI\codex\tmp\zombie-apk-20261024`，不进入静态发布目录。

## 工具和证据

- [REA](https://github.com/morluto/rea) 6.7.0 CLI + JADX headless MCP 0.7.1：恢复 manifest，识别 12,968 个 Java 类；没有将 JADX 结果当作 Unity 战斗逻辑。
- [UnityPy](https://github.com/K0lb3/UnityPy) 1.25.4：Unity **2021.3.30f1**、4,689 个未加密资源包；导出 295,045 份图像/音频/配置/对象树等分析产物，包括 9,023 个 Sprite、684 个 AudioClip。
- 初次导出列出的 17 个纹理错误，逐项确认都是 **0×0、无内置像素且无流数据**的运行时字体图集。工具已明确跳过它们；字体复核导出 errors=0、skipped=17，原始失败报告保留。
- [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) 6.7.46：metadata v29，生成类型声明、字段、RVA 和 DummyDll。DummyDll 的空方法不作为玩法实现证据。
- 实际 arm64 `unpack` 方法与 `PbReadBuf` 读数方法验证了网络字节序、固定数组长度、Q32.32 定点数。审核过的字段/方法 RVA 在 `tools/client-schemas.json`。
- `LevelWaveItemConfig::.ctor`，RVA `0x11BE0F0`：数量取整公式为 `MonsterNum * random(1-ratio, 1+ratio)`。网页保留同分布和独立种子，未声称复用了原生 TSRandom 序列。
- 表头第 5 个 32-bit 值保留为 unknown extra header word，不武断标记为 CRC。
- `client-ui-catalog.json` 列出 **540 个 UI prefab** 的对象名和序列化文案，供下一阶段逐页还原。

## 本次接入

### 关卡和活动

- `LevelBaseConfig.LevelType=1`：**259 普通关**；`LevelType=2`：**259 精英关**。两套关卡全部有实际波次，解除原来的 50 关存档与选关上限。
- 活动目录 **5,736** 份配置，其中 **5,716** 份有包内波次。另 20 份危局对弈配置（81041–81060）没有内置波次，保留常开补给入口，不伪造原始战斗表。
- 共导出 6,236 份战斗表（包括 2 份非用户入口的测试表），232,935 条记录。按关卡 ID 每 100 个分块成 **96 个 JSON 文件**；进入对应关卡时才加载，不把全部战斗表塞进入口脚本。
- 5,619 份表可直接使用客户端时间触发/固定怪物配置；617 份涉及随机库、对战、机关等特殊逻辑，明确标为 **网页规则适配**。常开不等于已经逐项还原原生特殊规则。
- 基地、征途和战役活动按钮均进入全天开放的活动目录，没有星期/日期轮换限制；免费补给不限次数。

### 图像和音频

- 88 组原生怪物序列动画：按 `FrameSpritePool` 中 PPtr 顺序保留待机、行走、攻击、死亡帧，合并成按战局加载的 WebP 图集。
- 14 种核心图标、名称、说明来自客户端配置；追加电极柱，旧 13 核心存档自动补齐。
- 客户端主界面/战斗/胜利/失败音乐及枪声、命中、升级音效转码为 MP3，保留来源 bundle 和 SHA256。
- 仍未完成三维首领模型/完整技能逻辑/原生绝对属性公式/所有子界面逐像素复现；当前绝对伤害、防线和若干技能仍使用网页适配，不将其称作完整 1:1。

### 畅玩控制台

- 无限金币、无限钻石、无限体力、全关解锁、防线无敌、千倍火力、直接通关本局。
- 开关按明确白名单存入本游戏的养成存档；无限货币在保存/界面更新时补满并显示 `∞`，不传递到企业业务。
- 活动一直开放；商城无限免费抽取和军团无限签到不依赖作弊开关。

### 军团

- 独立多人共享服务：免费创建、六位码加入、聊天、贡献排行、共享首领血量、无限次签到；每次签到金币 +10000、钻石 +100、贡献 +100。
- 团长可添加机器人，最多 128 位成员。机器人每 30 秒自动签到和攻击；网页每 10 秒同步共享状态。
- 游戏独立 256-bit 能力凭据，服务器只保存令牌 SHA256。凭据不放进邀请链接，不复用智能座舱操作令牌。
- 后台扩展限于 `enterprise-ai-cockpit` 的 `games/ZombieGuild*`；独立 JSON 存档、原子替换、写入失败回滚、损坏存档不阻止业务应用启动；没有企业数据库迁移。

## 验证与发布边界

- 全仓库 Vitest 1,330 项通过；新增全部普通/精英配置检查、后期关卡运行、活动数据完整性、存档迁移、作弊边界。
- APK/配置工具 Python 单元测试 6 项通过。
- 智能座舱 Maven 103 项测试通过，含军团持久化、无限签到、双玩家、机器人、团长权限、企业 API 鉴权边界；package 成功。
- 独立移动 Chromium 双浏览器 + 真实本地 WebFlux Controller/Service 联调通过：259 普通、259 精英、活动、无限资源、真人入团、连签、机器人、跨上下文聊天和首领共享、横屏边界、其他存档键保留。
- 单游戏静态发布继承其他游戏/共享 UI，逐文件哈希核对；后台单独原子发布，只重启现有 cockpit 服务。发布前检查其他游戏房间数为 0。

本文件记录阶段成果，不表示“所有原生玩法与 UI 完全一致”的总目标已经完成。

## 可复现入口

`tools/apk_intake.py` → `tools/export_unity.py` → `tools/decode_client_config.py` → `tools/build_client_pack.py` / `tools/import_client_audio.py` → `tools/build_campaign_pack.py`。

分析工具使用 E 盘独立环境，未修改全局 Codex 配置或全局 skill。

本轮修改前备份：`E:\Documents\AI\codex\backups\zombie-expanded-20261024`；更早的 APK 接入基线备份：`E:\Documents\AI\codex\backups\zombie-apk-baseline-20261024\zombie`。分块前资源保留在工作目录的 `campaign-individual-preserved`。

## 本轮最终发布记录

- 静态 release：`20261024040226-412fd86b70`，仅选择 zombie。
- 后台 release：`20261024035827-1003470-backend`；前端、环境、unit 与其他服务指纹保留。
- 最终服务端355项发布文件SHA256与gzip等价性通过；611个继承文件（其他8游戏331个、共享UI280个）SHA256通过。
- 前一发布全部355项公开HTTP哈希/MIME/MP3Range/404检查通过；最终3个差异文件额外公开HTTP哈希通过。
- 公开手机WebKit验证通过：旧API禁用时进入菜单、14核心、免费连抽、无限资源、活动和259关出击；军团服务ready=true，匿名/me为403，未向生产军团写测试记录。
- 静态回滚：`E:\Documents\AI\codex\backups\games-20261024-120226-852176\rollback.json`。
- 后台回滚备份：`/opt/enterprise-ai-cockpit/backups/20261024035827-1003470-backend`。


## 原生地图接入（2026-10-24，native-maps1）

- 从同一已核验 APK 解析 `ResDef.MapConfig` / `BattleCore.MapConfig`：79 条地图配置、6,257 条关卡映射；arm64 unpack 的 3 个背景路径与 4 个边界参数固定循环已核对，严格读取至文件末尾。
- 68 份实际存在的地图美术打包到 `public/assets/client-maps`。主线 259 普通 + 259 精英涉及的 62 份地图全部存在，按原 `LevelID → MapID → BackgroundPaths → prefab SpriteRenderer → Sprite` 关联，不按章节轮换配色。
- 101001 地图包含原 prefab 左右边缘贴图；按原位置、PPU、pivot 和排序预合成。大整数 PPtr 用字符串记录，避免 JS 数值精度丢失。导入工具 `tools/build_map_pack.py` 记录输入、prefab、输出哈希。
- 地图按战斗延迟加载，仅保持当前图像引用，等比例显示；参考包中 11 个仅有配置而缺少对应贴图的活动地图明确标记缺失，沿用截图回退，不宣称是原生地图。
- 本轮恢复基地/军团/征途已有的选中导航贴图；主模块导入失败时的“刷新重试”面板放在缩放游戏画布外，手机和桌面均在可视范围内。
- 地图美术来自客户端，但镜头、炮台截图、技能效果与部分首领仍为网页适配，不代表原生 3D 场景和完整 UI 已达 1:1。
- 修改前已校验备份：`E:\Documents\AI\codex\backups\zombie-native-maps-20261024-121958`（341 个文件哈希一致）。本轮不修改或重启军团/企业后台。


### native-maps1 验证与发布

- 全仓库 Vitest 1,336 项、配置/输入工具 Python 6 项、发布 Python 10 项通过；check、build、credential audit 通过。
- 移动 Chromium 与 WebKit 禁用较新 JS/Canvas API 后验证通过：第 1 / 2 / 259 普通与第 259 精英的原始 MapID、延迟加载、地图加载失败回退、导入模块失败可见重试；0 条未处理运行时错误。升级弹窗使用真实按钮处理，未强制穿透。
- 仅发布 zombie 静态版本 `20261024043214-412fd86b70`，未修改或重启后台。
- 服务端逐文件核验：426 个发布文件 SHA256 与 gzip 等价性通过；617 个继承物理文件及其他 8 个游戏目录定义保持不变。
- 静态回滚：`E:\Documents\AI\codex\backups\games-20261024-123214-546645\rollback.json`；前一静态版本 `/opt/games/releases/20261024040226-412fd86b70/www`。

- 公开域名移动 WebKit 已验证同一流程：4 个出击样例、地图/主模块故障注入、可见重试均通过；仅浏览器隔离存档，不向生产军团写测试记录。验收记录保存在 E 盘 `reports/native-map-validation.json`。

- 最终公开 HTTP 校验 426 个文件 SHA256 全部一致；JS MIME、MP3 Range、缺失资源 404、目录补斜线均通过。本轮自有两个浏览器验收会话和本地预览已关闭，其他已有会话保留。


## 技能前置图、原生配置与分支接入（2026-10-24，native-skills1）

### 新输入及核对

- 用户补充网友《向僵尸开炮技能前置条件大全》，原图 1078×4156，保留作者水印，图鉴中支持放大与滚动。公开衍生资源与哈希记录于 `assets/client-skills/provenance.json`，未将它当成新版 APK 的无条件权威。
- 严格解码：Build 1839 条、SkillBase 1184 条、BuildGroup 1521 条、技能属性库 2318 条、SubSkill 402 条、Buff 1777 条、BuffAttr 1799 条。原始浮点/FP结构的固定数组长度由 ARM64 unpack/ctor 验证。
- 整理 14 个核心的基础/最低冷却与持续时间、主线通用组的 172 个分支；保留前置、冲突、次数、权重、属性影响的原始 ID。
- `RandomBuildCmpt.CheckCondition` RVA `0x122D66C`：Type 2 是局内 Build 选择次数，Type 4 是持久核心等级，而不是局内技能等级。参考包函数仅分派 Type 1–10，11/12 落入 true；当前适配没有擅自把它们解释为 OR。Type 7 对应超武条件，网页尚无对应装备时为不满足。
- `FlyBullet.ProcessHitActor` 的实际命中计数加一后，以 `>` 判断穿透额度，因此干冰弹基础 Through=3 表示最多命中 4 个目标；并非无限贯穿。

### 真实接入的战斗部分

- 干冰弹、电磁穿刺共 32 个分支取代该两系旧的 1–5 级升级选项，按依赖、互斥、核心等级及重复上限进入随机池；升级按钮显示本分支次数和正确图标，禁用方案仍生效。
- 干冰弹使用源速度 8、基础穿透 3、轻微击退；只有选择急冻分支后才冻结 2 秒，基础技能不再假装成范围冰爆/长时间减速。分裂/大冰弹按技能规则选择实际新目标，目标不足不凭空补随机方向弹道；炮弹图像使用原材质对应的贴图。
- 干冰分支接入增伤、穿透、速度、连发、齐射、散射、冻结、冻伤及大冰弹。冻伤保留源 10 秒、每秒 tick、5 / 99 层上限。
- 电磁穿刺改为落点直击、延迟小范围溅射和 1 秒麻痹，取消旧连锁闪电伪实现；接入爆炸、扩张、周期减速矩阵、粒子、追加释放、追捕、核能倍率等分支效果。
- 冷却、弹道、延迟释放、矩阵与 DOT 均随游戏时钟暂停；原图与配置图鉴可从设置或核心详情进入，并反映本局已经选择的 Build。

### 明确保留的适配边界

- 只有上述两系的 32 个分支进入原生分支升级池；其他 12 系仍在迁移，图鉴用“配置参考”标识，不宣称 172 个分支都已实装。
- 伤害仍依托网页当前攻击基数与独立镜头/碰撞坐标，并不是完整客户端 BigNumber、TrueSync、所有装备/超武/抗性公式的逐指令移植。原生 FP 参数作为来源保留。
- 两系基础配置和多项分支行为已接入，但完整粒子渲染、所有 Buff 叠加/抗性、命中飞行减速、完整规则事件及其高级修饰仍需继续核对；不据此宣称技能或 UI 已全部达到 1:1。
- 修改前备份：`E:\Documents\AI\codex\backups\zombie-native-skills-20261024-124256`，414 个文件哈希校验一致。本轮只发布 zombie 静态资源，不改动或重启军团/企业后台。
### native-skills1 本地验收

- check、构建通过，单游戏构建 433 个文件；全仓库 Vitest 1,358 项通过。
- 最终移动 Chromium / WebKit 实测通过：旧 JS/Canvas API 缺省、核心详情入口、长图缩放滚动、前置及待接入标识、真实随机升级选择、本局 Build 状态回显、其他存档键保留；未处理运行时错误为 0。
- Chromium 真实升级选择 Build 205，WebKit 选择 Build 216；使用独立验收上下文，不向线上军团写入测试记录。
- 图鉴文字对比度和滚动后的关闭按钮经截图复核。证据：E 盘 reports/native-skills-{chrome,webkit}-final.log 与 skill-codex-*.png。

### native-skills1 验证与发布

- 发布流水线再次通过 check、全仓库 Vitest 1,358 项、发布 Python 10 项、credential audit；额外配置/输入工具 Python 6 项通过。
- 仅发布 zombie 静态版本 `20261024102743-412fd86b70`（`20261024-native-skills1`），未修改或重启军团/企业后台。
- 服务端全部 433 个发布文件 SHA256 与 gzip 等价性通过；其他 8 个游戏定义、617 个继承物理文件以及 nginx 路由配置指纹保持不变。
- 本次 16 个新增/变化文件的公开 HTTP SHA256 与 JS MIME 全部通过；另测 MP3 Range、缺失资源 404、目录补斜线通过。426 个基线文件已在 native-maps1 全量公开 HTTP 核验；本轮未重复下载未变化的大资源。
- 公开域名手机 WebKit 使用独立上下文，通过相同的原图/图鉴/真实升级流程：选择 Build 216，0 条未处理运行时错误，保留其他存档键；未向生产军团写测试记录。
- 汇总证据：`E:\Documents\AI\codex\tmp\zombie-apk-20261024\reports\native-skill-validation.json`；公开截图以 `public-skill-` 开头。
- 静态回滚：`E:\Documents\AI\codex\backups\games-20261024-182743-533810\rollback.json`；前一静态版本 `/opt/games/releases/20261024043214-412fd86b70/www`。
- 本轮为两系技能及图鉴的阶段交付，其他 12 系分支与更完整原生规则仍待后续迁移。

## APK 主来源校正（native-interface1）

详见 [APK_PRIMARY_CORRECTION.md](APK_PRIMARY_CORRECTION.md)。本轮修掉截图烘焙进度条，接入原生登录骨骼和独立真实进度条；宝石2023条配置、586条实际基础/条件词条、原生UI音效。复合宝石、活动完整规则、技能完整粒子和剩余截图底图明确保留为未完成项，不将配置导入等同玩法还原。

- 全仓库 Vitest 1,374项、配置工具Python 6项、check/build通过。
- 移动Chromium/WebKit已通过真实字节加载停留/恢复、骨骼动画连续帧变化、宝石图鉴/镶嵌/免费抽取、入口失败可见重试、其他存档键保留；同时旧技能图鉴/实际升级回归通过。
- 当前 APK 尚未在本机运行。官方MuMu安装器签名有效，安装确认已询问用户；网页骨骼验证和视频对照不冒充 APK 实机验证。

### native-interface2 最终验证与发布

- 最终静态 release：`20261024122631-412fd86b70`，仅 zombie；游戏版本 `20261024-native-interface2`。全仓库1,375项测试、发布Python10项、asset/input Python6项、check/build/credential audit均通过。
- 首次 native-interface1 的44个新增/变化文件公开HTTP哈希通过；最终修正版另11个差异文件哈希通过。最终服务端全部460项文件SHA256及gzip等价性通过；617个继承物理文件、其他8游戏定义和nginx路由指纹不变。
- Chrome、WebKit本地及公开域名手机WebKit验证：阻塞真实资源时保持中间进度（公开32%）、加载未完时角色骨骼已可动画、独立开始按钮、原生宝石属性/镶嵌/免费抽取、实际点击触发四种UI音效播放成功、HTTP失败及HTTP200损坏资源均有可见重试、旧存档保留；未处理运行时错误0。
- 必需资源使用no-cache重验证与字节长度检查，避免强读旧缓存后显示完成；骨骼在自身资源齐备后先播放，不等全部模块。首次有效点击同时解锁背景音乐。补齐火系持续伤害、状态时长和移动速度的基础宝石联动，属性页显示宝石暴击率。
- 旧`assets/original-ui/splash.webp`公开URL为404，源图已保存在本轮已验证备份。其余截图底图仍有遗留，未宣称所有页面或玩法已达1:1。
- 最终证据：`E:\Documents\AI\codex\tmp\zombie-apk-20261024\reports\native-interface-validation.json`；截图`public-native-*.png`仅为验收截图，不作为游戏素材。
- 回滚：`E:\Documents\AI\codex\backups\games-20261024-202631-927776\rollback.json`，前一release `/opt/games/releases/20261024115223-412fd86b70/www`；如需回到本轮之前，再使用 `E:\Documents\AI\codex\backups\games-20261024-195223-284863\rollback.json`。
- APK尚未实机运行；已备好官方网易有效签名MuMu安装器并询问用户安装确认。完整粒子、活动规则、复合宝石及剩余截图底图仍为明确待办。
