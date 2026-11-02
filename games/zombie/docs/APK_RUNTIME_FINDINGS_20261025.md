# APK 实际运行与后台依赖核对（2026-10-25）

## 结果边界

- **安装完成**：MuMu 12 `4.1.4.3475`，Android 12 实例启动成功，ARM64 转译可用。
- **APK 已执行**：包名 `com.ltzy.xnmkp`、版本 `1.10`；原生 Unity 登录动画、开始按钮及账号 SDK 已显示。
- **尚未进入实战**：这份修改版要求第三方账号，关闭提示框或显示动画不等于登录成功。后台离线适配尚未完成。
- 未提交个人账号、密码或验证码，未创建远端测试账号；未改动线上网页、军团后台或其他游戏。

## 安装来源与验证

外层官方在线安装器仅约6 MB；本机在执行它之前触发安装控制事件26。静态解包后核验了内层网易程序签名，并在其中找到官方离线入口：

`https://adl.netease.com/d/g/a11/c/offline_installer_64/js`

该入口提供网易 CDN 的 MuMu 12 完整包：

- 大小：656,324,536 字节。
- SHA256：`08c5825c146e104c84b227c49e564e7b5cde89a8dfb12222550b0f1e95f626bf`。
- 原始包 Authenticode：Valid；签名者 NetEase (Hangzhou) Network Co., Ltd。
- 普通完整包安装仍触发事件26；7-Zip 的标准 NSIS 解析也未还原定制载荷。

参照用户引用的“安装软件”任务，使用现有安装 Skill 的临时 NSIS 启动兼容流程，让厂商安装逻辑完成文件、虚拟化驱动、快捷方式和卸载登记。没有停止终端安全服务或改写其策略。原安装包完整保留，临时启动副本在验证后清理。

最终位置：

- 主程序、Android 磁盘：`E:\Programs\MuMuPlayer12`。
- 厂商系统运行时/驱动：`C:\Program Files\MuMuVMMVbox`；这是安装器固定的系统依赖，不是把整台虚拟机放回 C 盘。
- 卸载入口：`E:\Programs\MuMuPlayer12\uninstall.exe`。
- 桌面和开始菜单：MuMu模拟器12。
- MuMuVMMDrv：Running；主程序、管理程序、驱动签名均为 Valid。
- ADB 16384 与服务端5037只监听 `127.0.0.1`。

## 实际启动观察

1. `adb install` 返回 Success，入口为 `com.dmlt.unityplayer.DodUnityPlayerActivity`。
2. Unity 日志报告 `2021.3.30f1`、IL2CPP、`arm64-v8a`，不是只把 APK 文件放入模拟器。
3. 显示的客户端版本为 `1.10.200.230`；登录画面包含骨骼角色与粒子、独立开始按钮、协议复选框。
4. 修改版另外弹出第三方“注册游戏账号”说明和账号 SDK 界面。关闭该说明会露出 SDK 登录框；关闭 SDK 后仅返回游戏登录页，并提示用户取消登录。
5. 点击原生开始按钮会再次走 SDK 登录。当前没有证据表明仅关闭弹窗就能进入战役。

截图只作诊断证据，不导入网页素材目录。Windows 窗口截图接口出现 FrameArrived 超时，本次采用模拟器 ADB 的安卓帧和 Unity 日志交叉验证。

## 后台不是一个开关

> 后续进展：已新增并实测逐层本地协议替身，走到原生创建角色页，账号应答/心跳/随机名均通过；完整角色数据与战斗仍待实现。详见 `LOCAL_PROTOCOL_PROGRESS_20261025.md`。以下保留安装阶段调查记录。

| 层次 | 已有证据 | 处理方向 |
| --- | --- | --- |
| 版本/资源检查 | 实际日志出现 `ver/new_ver.php`，之后已加载原生登录画面 | 先保留原响应结构；当前不是卡住主因 |
| Android SDK 身份 | DodAccountLoginFragment 的登录/游客分支与 DodUserManager 的回调 | 本地身份替身需要生成客户端所需的用户对象，而不只是隐藏 UI |
| 游戏账号认证 | PlatformInfo 中 `dodsdk.AuthPath` 指向 `auth/auth_sdk/auth.php`；LoginSys 另有 OnAuthSuccess/OnAuthFailed | 在独立本地测试端点还原返回字段和失败处理 |
| 区服目录 | PlatformInfo 的 `DirPath` 为 `dir/new_dir.php`；WorldDirMgr 保存区服与角色信息 | 提供本地区服和可连接的本地会话，空目录只代表尚无可用区服 |
| 角色会话与状态 | CSRoleLoginRes 包含 UinInfo、Result、LastLogoutTime、IsMiniGameActOn、CSRoleData | 按原协议初始化角色/背包/技能/关卡等后续状态，再核对首次进入事件 |

原始 `assets/Config.bytes` 写着 `dev_android` 与另一版本地址，但实际执行日志使用 `dodsdk` 和不同的版本检查地址。**编辑这一个 JSON 后，仍需验证实际认证链是否已改向本地。**

JADX 还确认 SDK 确实包含 `mGuestLogin` 分支，调用 `DodUserManager.guestLogin()`，继续委托 `mWebApi.guestLogin()`。实际 `WebApiImpl.guestLogin()` 构造 `DodCoreConfig.URL + "login/login_guest.php"`，携带 `appid` 并调用 `request()`；所以显示游客按钮也不等于脱网运行。具体响应、认证关联和角色状态仍需继续核对。

## 适配顺序与验收

建议顺序：本地 SDK 身份 → 本地认证响应 → 本地区服 → 原生角色会话/初始状态 → 原生战斗。保持原 APK 作为对照，实验只在副本或独立调试实例中进行。

验收必须分开记录：登录完成、主菜单四入口、宝石/装备实际属性、技能选卡与技能效果、各活动特殊玩法。登录页出现或函数返回成功均不替代这些验收。

## 证据与回滚

证据根目录：`E:\Documents\AI\codex\tmp\mumu-install-20261025`。

- `installation-validation.json`：实际安装、驱动、签名、安卓启动和 APK 到达阶段。
- `vendor-logs\`：厂商安装日志副本。
- `apk-runtime.log`：本次 Unity/Android 日志；仅本机诊断使用。
- `apk-main-entry.png`、`apk-entry-agreed.png`、`apk-start-waited.png`：实际安卓帧。
- `sdk-login-onclick.json`、`sdk-guest-login.json`、`sdk-guest-webapi-impl.json`：基于同一 APK 哈希的静态证据，不冒充运行结果。

修改前文档备份：`E:\Documents\AI\codex\backups\mumu-install-20261025`。安装回滚使用厂商卸载入口，不手动删除仍被驱动占用的系统目录。
