# 2026-10-11：独立多游戏仓库改造

## 结构与发布约定

`games/pindou`、`games/goose` 平级，分别维护运行代码、资源、测试、文档。
`site` 为自动目录大厅；`scripts` 为自动发现游戏的共享检查 / 构建 / 发布链。
浏览器 URL `/games/<id>/` 与 Cookie 路径稳定，拼豆原 100 关、40 图和存档协议保持不变。

默认发布所有登记游戏；`-Games goose` 单发；`-Games 'pindou,goose'` 同时发布。
发布只上传 dist，统一 `/opt/games` release 原子切换；单发复制旧整包、仅替换所选游戏，
其他游戏切换前核验所有文件 SHA-256。详见 [发布手册](deployment.md)。
博客仅同步公共路由镜像、单发拼豆兼容入口与文档，不放游戏源码。

## 第一阶段：已验证上线

- 提交：`4424b9e31c7cf895dddb80e256d7784d414ba769`。
- Release：`20261011012937-4424b9e31c`，北京时间 2026-10-11 09:29。
- 33 个拼豆运行文件迁移前后逐字节一致；150 份历史存档夹具保留。
- 首阶段 57 项 Node / 10 项 Python 测试通过，拼豆手机浏览器完整回归通过。
- 公网 37 个运行文件（拼豆 + 大厅）SHA-256 全部匹配；Nginx / 博客 / 停车检查通过。
- 旧 `/opt/pindou` 原样保留，没有删除或清空玩家进度。
- 改造前源码备份：`E:/Documents/AI/codex/backups/games-multi-20261011-092209/repository/`。
- 首阶段回滚记录：`E:/Documents/AI/codex/backups/games-20261011-092937-111076/rollback.json`。

## 第二阶段：抓大鹅 3D

新增 `games/goose`，60 关 / 8 集市 / 18 种自制几何模型。
Three.js 实际 3D 渲染、Cannon-es 物理堆叠 / 颠锅、遮挡 raycast、七格三消、免费道具 / 续时。
材质合并和实例渲染保持物品逐个点击及刚体状态；108 件关卡实测 75 draw calls。
原始库与许可证跟随构建，运行期间没有第三方 CDN 或后端。

本地 79 项 Node（拼豆 51 + 抓鹅 21 + 构建 / 目录 7）和 10 项 Python 门禁通过。
抓鹅真实浏览器六个视口、点击 / 存档 / 物理 / 暂停 / 全屏 / 道具 / 跳关 / 通关 /
超时续时 / context loss 回归通过，页面 JS 错误为 0。
完整玩法和素材来源见 [抓大鹅说明](../games/goose/docs/README.md)。

发布脚本为每次操作生成真实 release 及本机 rollback.json；服务器存放
`/opt/games/backups/<release>/`。以脚本结果和 `scripts/verify.py` 公网逐文件校验为发布验收。

## 第二阶段上线验收

- 游戏提交：`10961efcc356bc892c989b1e3d2fcbadf3f74ae5`，
  [GitHub CI 通过](https://github.com/caibinice/games/actions/runs/38103167665)。
- 全部游戏批量发布：`20261011015039-10961efcc3`，公网 50 个运行文件哈希全部匹配。
- 单独发布抓大鹅验证：`20261011015153-10961efcc3`，只打包 17 个运行文件（抓鹅 + 大厅），
  52 个拼豆运行 / gzip 文件从上一 release 继承并逐个重新核验不变。
- 单发后重新以全部构建进行公网校验：50 个文件 SHA-256 全部一致。
- 抓鹅线上 WebGL 浏览器回归通过，六种屏幕尺寸、60 关目录、3D 点击 / 物理 /
  存档恢复 / 道具 / 续时 / 通关 / context loss 均无 JS 页面错误。
- 拼豆线上完整回归通过：跨底色同色连选、起点底色优先、实线选中 / 虚线空槽、
  100 关 / 跳关边界、旧 v4 存档、原 50 关进度继续到 51 关均保留。
- Nginx 正常；除游戏块之外的全部服务器路由与改造前逐字一致。
  博客镜像另同步服务器早已存在的停车 KTX2 素材路由，完整镜像内容一致。
- 博客 TypeScript、12 项测试、55 页构建通过，无游戏运行文件打包进博客 dist。
- 博客文档 / 兼容入口提交 `92f98f2`，现有路由镜像补齐提交 `7e789db`。
- 当前 release：`/opt/games/releases/20261011015153-10961efcc3/www`。
- 批量发布回滚：`E:/Documents/AI/codex/backups/games-20261011-095039-930432/rollback.json`。
- 当前单发回滚：`E:/Documents/AI/codex/backups/games-20261011-095153-001094/rollback.json`。
- 本机详细浏览器 / 发布证据：`E:/Documents/AI/codex/tmp/games-multi-20261011-092209/`。

本节为上线后的文档记录；运行产物对应上述游戏提交，文档更新不改变游戏文件。
