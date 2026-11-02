# 安卓原生云端接入记录（2026-10-31）

## 当前状态

自建后台已运行在服务器，独立 APK 已通过公网 HTTPS/WSS 连接它。测试时关闭了系统代理、移除了 ADB reverse，并停止电脑上的本地协议后台；原生客户端实际完成建角、战斗、退出、主页、宝石镶嵌和重登存档。

这是可安装的云端联调版，不是全功能完成版。iQOO 11／Android 16 仍待真机安装验收；全关卡、完整奖励、多人和部分运营协议继续按清单补齐。

## 服务与路由

| 项目 | 当前配置 |
| --- | --- |
| 独立服务 | `zombie-native.service`，账号 `zombie-native` |
| 活跃代码 | `/opt/zombie-native/staging/20261031-wss3`，由 `current` 指向 |
| HTTP 后台 | `127.0.0.1:53175`，启用前已检查空闲 |
| 原生协议内部端口 | `127.0.0.1:55074`，不向公网开放 |
| Nginx 路径 | `/native-zombie/`，包含安装专用前缀与 `/socket` WebSocket 入口 |
| 手机实际使用端口 | HTTPS/WSS `443`，不需要额外放行安全组 |
| APK 下载路径 | `/native-zombie-install/`，随机文件名、关闭目录列表和访问日志 |
| 私有配置 | `/opt/zombie-native/private/`，角色状态在 `/opt/zombie-native/state/` |
| 运行限制 | 独立内存上限 `384M`、32 个任务；请求日志按日或 8MB 轮转，保留 7 份 |

已核对 ai-blog 的共享路由方式，只在 `/etc/nginx/snippets/ai-platform-routes.conf` 新增独立标记区块，并同步 `E:\codes\ai-blog\deploy\nginx\ai-platform-routes.conf`。未重新发布博客或网页游戏，也未重启其他应用服务；Nginx 使用配置检查后平滑 reload。

最初尝试原生 TCP 公网端口时，云端入站连接超时。随后接入 APK 已内置的 WebSocket 实现，后台将二进制帧转入内部原生协议服务；当前已收回公网 TCP 监听。先前关于手动放行 `55074` 的询问已不再需要处理。

## APK 修改

- 独立包名 `com.cbai.xnmkp`，名称“僵尸自建服”，不覆盖原包。
- 版本、SDK、认证、目录和说明页均指向自建服务；平台协议密钥保持不变。
- 移除参考包的第三方 Application 启动注入、重复推广弹窗和悬浮入口；去掉可选客服启动调用。
- 首要登录按钮调用客户端原有 `guestLogin`，不再让用户填写手机号和密码。保留原生协议勾选与游客确认流程。
- 使用自建说明页，保留原生可点击协议文本依赖，已修复首次修改时发现的 `setSpan` 冷启动崩溃。
- ARM64 `GameClientImp.Create` 的传输选择分支在 `0x1155DB4` 由 `68 01 00 34` 改为 `1F 20 03 D5`，选用包内现成 `ClientWebSocket`。没有改造战斗渲染逻辑，也不是 WebView 网页包装。
- 原始 APK 保持不变；云端包通过 v1/v2/v3 签名校验并实际安装。当前 WebSocket 传输修改针对 ARM64，32 位 Android 未验收。

服务端 WebSocket 使用固定版本 `ws 8.18.3`，下载包 SHA-512 与 npm 发布元数据一致，MIT 许可随代码保留。不开启压缩，限制消息大小、连接数和排队字节；原生短期登录凭据校验仍然生效。[ws 项目文档](https://github.com/websockets/ws)

## 已验证

- [x] 无系统代理、无 ADB reverse、无电脑后台的 APK 公网连接。
- [x] HTTPS SDK 初始化、游戏认证、区服目录，以及 WSS 原生 `2001/2002` 登录。
- [x] 云端新建角色、第一关实际枪械战斗、升级选卡、暂停和退出。
- [x] 完整六栏主页、原生地图和装备宝石页面。
- [x] 原生宝石镶嵌 `4200`，响应及装备/背包通知，关闭重开后镶嵌状态保留。
- [x] 云端角色文件落盘；重新登录识别已有角色。
- [x] 本轮最终原生崩溃日志为空；云端日志未出现非法协议包。
- [x] zombie 测试 43 文件、1,207 项通过；APK 准备脚本 7 项测试通过。
- [x] Nginx 配置检查通过；七个已有页面在发布前后及 WSS 更新后均为 200，内容 SHA-256 一致。
- [x] APK 云端文件 SHA-256 及 HTTPS Range 下载校验通过。

七个页面：博客首页、游戏大厅、zombie、pvz、smartCockpit、quant、crossBorderTrend。这是本轮改动的服务回归范围，不等同于这些应用所有功能的回归。

## 剩余工作

1. iQOO 11／Android 16 真机安装、启动、后台切换、移动网络和更新安装。当前只在 MuMu Android 12、ARM64 环境实际运行过。
2. 后台当前仍是单个个人角色，不是多账号/多人服务器。模拟器与手机登录同一自建区会读取同一份角色。
3. 第一关之外的战斗入口、解锁进度、胜利奖励和完整结算；本轮实测的是主动退出，不是完整胜利结算。
4. 各抽奖家族、养成、军团及其他功能继续核对；协议单测和既有本地实现不替代云端逐页实测。
5. `/notice/get_policy.php` 尚未补齐原生字段，当前客户端可继续；`11810` 已识别为 `CSReportMobileParameter` 设备上报，不把它当成缺少游戏登录响应。
6. 原生库 4KB 对齐及 arm64 目录内两份 ELF32 库的真机兼容检查。当前没有宣布 Android 16 全部页面均无缺陷。

## 交付与回滚

- 手机包：`E:\Documents\AI\codex\tmp\zombie-native-cloud-20261031\native-cloud-wss-v2-signed.apk`，409,826,308 字节。
- SHA-256：`0713e3f2b4879eb6fd60f5bd1920cbe975c12c042bbf449f89ec02c78d22e4f3`。
- 下载地址保存在上述目录的私有 `private/download-wss-proof.json`，未写入公开源码清单。首次打开选择游客登录，再勾选协议并开始游戏。
- 签名身份仍在 `E:\Documents\AI\codex\backups\zombie-android-signing-20261031`，后续更新复用，不随 APK 发布私钥。
- 证据目录：`E:\Documents\AI\codex\tmp\zombie-native-cloud-20261031`。重点看 `native-final-proof.txt`、`other-services-final-proof.json`、`cloud-gem-relogin.png` 和 `wss-upgrade-proof.json`。
- 云端 WSS 升级备份：`/opt/zombie-native/backups/20261031-wss3`。首次接入前的共享路由备份在 `/opt/zombie-native/backups/20261031-cloud2/routes.conf`。
- 如需完全撤下此后台，先停用 `zombie-native.service`，恢复首次接入前的共享路由，再执行 `nginx -t` 和 reload；保留私有配置、签名身份和角色状态，不删除其他应用目录。

网页复刻目标继续暂停，线上 `20261030-native-fx12` 和本地未发布宝箱批次不受本轮影响。
