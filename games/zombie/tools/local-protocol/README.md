# 原生 APK 的逐层本地协议替身

## 当前用途

本目录现在也是安卓自建服的 Node 后台源码，通过独立的 HTTPS/WSS 路径提供账号、存档、战斗结算、养成和活动接口，不随静态网页发布。当前状态、验证边界和回滚见 [2026-11-02 可玩性修复记录](../../docs/ANDROID_PLAYABILITY_20261102.md)；打包、APK 准备与部署工具在 `../android-server/`。凭据、角色文件和日志留在外部工作目录，测试使用独立假账号。

下面保留最初本地对照阶段的操作记录，完成状态和“仅本机”描述不代表当前正式后台。

---

这是**独立本机对照工具**，不属于网页游戏运行时，也不进入线上发布目录。

当前已用参考 APK 实测：版本响应 → SDK 身份 → 游戏认证 → 区服目录 → TCP 账号登录 → 创建并保存角色 → 原生主页面 → 第一关战斗、自动射击、弹药消耗和升级选卡。**装备/宝石/活动完整状态、全部菜单资源、战斗结算和其余关卡仍待实现。**

## 文件

- `fixture.mjs`：HTTP 层，所有身份均为本地合成数据。
- `native-codec.mjs`：外层帧、XXTEA、CRC32、内层 CSPkg、账号/心跳/随机名应答。
- `role-session.mjs`、`role-schema.mjs`：本地角色、按原字段类型序列化、首登查询、第一关入场通知。
- `server.mjs`：仅监听 `127.0.0.1` 的 HTTP 代理与 TCP 会话端点。
- 单元测试：`games/zombie/tests/local-protocol.test.mjs`、`native-codec.test.mjs`。

APK 的运行时密钥从本机导出的 PlatformInfo 读取；源码、日志和命令行均不包含密钥值。参考 APK SHA256：`7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6`。

## 本机复现

使用专用 MuMu **实例 1**（创建标识 `1792933004438459`），ADB 为 `127.0.0.1:16416`；不要把下面的实例端口套到其他实例。先启动此实例，再运行：

```powershell
Set-Location E:\codes\games
$work = 'E:\Documents\AI\codex\tmp\zombie-role-protocol-20261026'
$apkWork = 'E:\Documents\AI\codex\tmp\zombie-apk-20261024'
node games/zombie/tools/local-protocol/server.mjs `
  --port 53173 `
  --log "$work\evidence\requests.jsonl" `
  --version 'E:\Documents\AI\codex\tmp\zombie-local-protocol-20261025\evidence\version-response.body' `
  --sdk-path /login/login_verify_passwd.php `
  --sdk-path /login/login_verify_mobile_passwd.php `
  --sdk-path /login/check_login.php `
  --game-auth --directory --tcp-port 53174 `
  --role-capture-dir "$work\evidence" `
  --native-account `
  --platform-info "$apkWork\export-all-v1\text\PlatformInfo-f4130d7052-1382940089467135438.bytes" `
  --role-state "$work\role-state.json"
```

保持进程运行，在另一 PowerShell 7 终端连接**该测试实例**：

```powershell
$adb = 'E:\Programs\MuMuPlayer12\shell\adb.exe'
& $adb connect 127.0.0.1:16416
& $adb -s 127.0.0.1:16416 reverse tcp:53173 tcp:53173
& $adb -s 127.0.0.1:16416 reverse tcp:53174 tcp:53174
& $adb -s 127.0.0.1:16416 shell settings put global http_proxy 127.0.0.1:53173
& $adb -s 127.0.0.1:16416 shell am start -n com.ltzy.xnmkp/com.dmlt.unityplayer.DodUnityPlayerActivity
```

测试实例已缓存 `fixture-local` 合成身份。SDK 显示游客提示时选择“游客登录”，进入“本地协议测试区”后点击开始。没有本地角色时先创建“本地测试员”；已有本地角色文件时自动登录该角色。角色与本地账号固定绑定，不使用真实账号、验证码或第三方注册入口。

本工具没有外部转发逻辑；未知 HTTP 路由和 TLS CONNECT 返回 502。未实现的二进制命令只记录 ID，不伪造通用成功。`--role-state` 显式启用最小角色和第一关对照；省略时保留上一阶段的无角色模式。

本地余额、属性和进度是对照数据，不代表原版初始账号平衡。装备组暂不发送：把空装备 ID 伪装成已开启状态会触发原生升级检查异常。主界面底栏未完整显示，日志存在原包图集依赖错误，详见本次记录。

## 停止与隔离

先停止测试 APK，再移除这两个 reverse，最后停止 Node 和测试实例：

```powershell
& $adb -s 127.0.0.1:16416 shell am force-stop com.ltzy.xnmkp
& $adb -s 127.0.0.1:16416 reverse --remove tcp:53173
& $adb -s 127.0.0.1:16416 reverse --remove tcp:53174
# 在服务终端按 Ctrl+C。
& 'E:\Programs\MuMuPlayer12\shell\MuMuManager.exe' control -v 1 shutdown
```

测试实例保留指向回环地址的代理作为停机隔离；后续启动前先运行替身服务并恢复 reverse。主实例 0 未改代理、未启动。MuMu 的强更缓存只在本次启动窗口内临时调整，原始内容已恢复，备份为 `E:\Documents\AI\codex\backups\zombie-local-protocol-20261025\updater_config.json`。

## 协议边界

| 命令 | 当前行为 |
| --- | --- |
| 2001 → 2002 | 仅接受合成 UIN `900000001` 和本地登录标识，按本地持久化状态返回角色是否存在 |
| 2009 → 2010 | 回显心跳时间，返回回环地址 |
| 2014 → 2015 | 返回固定本地随机名，用于验证创建角色页面 |
| 2003 → 2004 / 2005 → 2006 | 创建、保存并登录合成角色，提供已实测的最小角色数据 |
| 2048、13001 等首登查询 | 按各自原结构返回设备比例确认、空好友列表等，不套通用成功包 |
| 4251 → 4252 + 4253 | 第一关 `1001` 的开始确认和原生入场通知；仅限此对照关卡 |
| 4254、其他关卡和活动命令 | 仍待实现，未当作完整通关/活动成功 |

HTTP 请求证据只记录字段名，不记录密码、token 或设备标识值。二进制诊断证据只留本机，不进 `public/` 或发布包。所有安卓截图都是实机诊断证据，不作为网页贴图素材。

最新实测与复刻依据见 `games/zombie/docs/LOCAL_PROTOCOL_PROGRESS_20261026.md`；前一阶段保留在 `LOCAL_PROTOCOL_PROGRESS_20261025.md`。
