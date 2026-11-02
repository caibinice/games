# 逐层本地协议替身进度 · 2026-10-25

> 2026-10-26 后续进展：已接通创建、已有角色登录、主页面及第一关原生实战。最新证据与剩余边界见 `LOCAL_PROTOCOL_PROGRESS_20261026.md`；下文保留此前阶段记录。

## 已实测的结论

不是单改“登录成功”：**参考 APK 未重打包、未改 native 分支**，通过本地 HTTP/TCP 替身，已从 SDK 登录走到**原生创建角色页面**。

| 层 | 结果 | 直接证据 |
| --- | --- | --- |
| 版本检查 | 通过缓存的原响应加载 | `/ver/new_ver.php` 200，返回精确缓存字节 |
| SDK 身份 | 通过 | SDK 接受本地合成账号，回调 `OnSDKLoginSuccess` |
| 游戏账号认证 | 通过 | `AccountAuthMgr` 接受 UIN `900000001`，继续请求目录 |
| 区服目录 | 通过 | 原生入口和原生选服框显示“本地协议测试区” |
| 本地 TCP 账号登录 | 通过 | 原生 2001 请求已解码，2002 应答已被客户端接受 |
| 心跳 / 随机名字 | 通过 | 2009→2010 连续往返；2014→2015 后原生名字框显示“本地测试员” |
| 角色创建提交 / 角色登录 | 待实现 | 暂不返回创建成功；`CSRoleData` 尚未提供 |
| 主菜单、背包、宝石、技能、活动、战斗 | 未验收 | 不以创建角色页或登录成功替代玩法验收 |

实机证据：`E:\Documents\AI\codex\tmp\zombie-local-protocol-20261025\evidence\fixture-create-role-ready.png`。这是 APK 自己的页面与角色渲染，不是网页仿制截图。

## 样本和隔离

- 包名：`com.ltzy.xnmkp`；入口：`com.dmlt.unityplayer.DodUnityPlayerActivity`。
- 参考包是此前提供的第三方修改构建，显示客户端版本 `1.10.200.230`；本次结果仅针对该固定样本，不等同于官方最新客户端。
- 下载文件和模拟器已安装 `base.apk` 的 SHA256 均为 `7fe65a66a29e69ca7336f0dc42b7ea9ac68e84cf76ac21ca83c214eff99904b6`，没有重签/改包。
- 新建专用 MuMu 实例 1，创建标识 `1792933004438459`，ADB `127.0.0.1:16416`；主实例 0 保持停机。
- HTTP 替身 `127.0.0.1:53173`，TCP 替身 `127.0.0.1:53174`，只做本地应答，不向原后台转发。TLS CONNECT 明确返回 502，未安装代理证书。
- 仅第一次以只读 GET 获取版本响应用于固定缓存；账号认证、目录和 TCP 会话均用本地数据。未使用真实账号或验证码。
- root/Frida 路线未用于本次成功链路；实际方案只依赖测试实例代理和 `adb reverse`。

## 已核实的易错点

1. SDK 实际登录路径使用 **GET**，包括 `/login/check_login.php` 和 `/login/login_verify_mobile_passwd.php`，不是凭按钮外观猜 POST。
2. SDK `uin` 是字符串；native 游戏认证的 `uin` / `authtime` 是数值，`createtime` 又是字符串。按解析函数的实际字段类型构造。
3. `last_vist_worlds` 是字符串数组，如 `["1"]`；数值数组会触发 `Int64 → String` 转换异常。已修正并加测试。
4. 区服状态应为 **`open|run`**。native `convertWorldState` 按 `|` 拆分，`CanEnter` 同时要求 open 和 run 两个标志；单个 `run` 会提示未开服。未修改 `CanEnter`。
5. TCP 首包不是明文 JSON。实收首包 **230 字节**；外层魔数 `0x3245`，6 字节外头，其后为 16 字节对齐的 XXTEA 数据。内部包含 CRC32、序号及 `CSPkgHead`。
6. 解开首包后：内层魔数 `0x3243`，命令 **2001**，内层长度 **204**、版本 1、echo 1。CRC32 与实收包匹配；其中包含本地登录标识。
7. 2002 必须按 `UinInfo → ProtoResult → SvrTime → Reconnect → QuickLogin → SimpleEncKey → IsHaveRole → SvrOpenTime` 序列化。实测 70 字节外层应答后，客户端显示原生创建角色页。
8. 创建角色页还请求随机名和心跳；两者分别补充后，名字框和页面交互恢复，连接保持正常。

静态位置（同一 ARM64 样本）：

- `AccountAuthMgr.ParseAuthResult`：`0x138F25C`。
- `WorldDirMgr.ParseDirJson`：`0x14939C8`。
- `WorldDirMgr.convertWorldState`：`0x14949A8`。
- `WorldInfo.CanEnter`：`0x1492A5C`。
- `NetClient.EncTdrBuff`：`0x1764D44`；`FastXXTEA.DexxV2`：`0x128CB2C`。
- `CSActLoginRes.pack`：`0x181049C`；`CSPkgHead.pack`：`0x18EAF08`。

## 代码和测试

新增目录：`E:\codes\games\games\zombie\tools\local-protocol`。运行/停止方式见该目录 `README.md`。

- `fixture.mjs`：HTTP 各层独立启用，未接通层显式返回待实现。
- `native-codec.mjs`：帧、编码、CRC、账号登录及两个辅助命令。
- `server.mjs`：回环 HTTP 代理、回环 TCP、TCP 拆包、受限抓包和脱敏请求记录。
- 20 个新增协议测试通过；全量 **40 个文件、1395 个测试通过**。
- `npm run check` 通过，覆盖全部 9 款游戏检查和模块语法。
- `npm run audit:secrets` 通过，1644 个文件审计。

未改网页运行入口、共享服务、Nginx 或部署参数；本次没有线上发布，其他游戏保持原发布状态。APK 截图没有导入网页素材目录。

## 下一层的明确边界

接下来应先做 `CSRoleCreateReq/Res` 和角色存储，再做 `CSRoleLoginRes.CSRoleData`：角色基础信息、货币、关卡、技能、装备、宝石、背包及首登通知，逐项对照 native manager 的初始化和读取顺序。之后再验收主菜单四入口、活动和战斗。

当前没有把空 `CSRoleData` 当通用成功返回，也没有把账号层替身等同于完整游戏私服。

## 证据及回滚

工作证据根：`E:\Documents\AI\codex\tmp\zombie-local-protocol-20261025`。

- `evidence/requests.jsonl`：脱敏的 HTTP 字段名、命令 ID、字节长度、摘要。
- `evidence/role-1.bin`：首次 230 字节登录包，SHA256 `edd77407fb42f2c61d4a781f2a3be36b0643bb6ef48460941efccbf06f3f5305`。
- `evidence/role-1.decoded.bin`：该本地合成账号的解码结果，仅留本机。
- `evidence/native-*.txt`、`sdk-*.json`：只读静态解析证据。
- `evidence/runtime-final.log`：当前 APK 进程的原生日志。
- `evidence/validation.json`、`test-exit-codes.json`、测试日志：分层验证记录。
- 专用测试实例已停机，root 设置恢复为关闭，未使用的 Frida 临时文件已移除；其代理保留回环隔离，移除本次两个 reverse；主实例设置未改。
- MuMu 强更缓存原内容已恢复，SHA256 `708ad41c077588361ca815c70b6e81f81c074b58a8277c9aace78ce926f0d782`。
- 缓存备份：`E:\Documents\AI\codex\backups\zombie-local-protocol-20261025\updater_config.json`。

旧安装阶段记录见 `APK_RUNTIME_FINDINGS_20261025.md`；本文件是后续协议实测进展，覆盖其中“尚未接入本地认证”的旧状态描述。
