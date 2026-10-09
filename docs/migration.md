# 2026-10-09：拼豆从 ai-blog 迁移为独立 Games 仓库

- 目标仓库：https://github.com/caibinice/games ，本机 `E:/codes/games`。
- 源码迁移：全部 33 个游戏运行文件（含素材）、51 项游戏规则测试、150 份真实旧存档夹具、规则 / 历史说明、Nginx 片段及历史素材转换工具。
- 游戏代码和素材保持逐文件 SHA-256 一致；仅变更开发 / 测试 / 构建 / 发布的归属，不修改关卡与 Cookie 协议。
- 新增独立 `package.json` / lockfile、构建及预压缩、manifest 校验、发布脚本、SSH 客户端、本机 credentials 配置、推送助手、离线 CI 和回滚手册。
- 发布由原“在博客读源文件打包”改为“在 games 构建 dist，再打包 dist，部署到原 Nginx 映射”。不需要兄弟项目的 Python / 凭据 / 源码。
- 游戏仍在 https://caibinice.com/games/pindou/ ，路径 `/opt/pindou/www/games/pindou/`，100 关和已有进度保持不变。
- 博客删除重复游戏源码、测试与素材工具；只保留共享 route / 模板、旧发布入口的薄兼容层与维护手册。文章及其它未提交工作保持原状。
- 实际 GitHub token / SSH 仅在忽略的 `E:/codes/games/credentials/config.ini`；仓库只提交模板与说明，构建包不包含任何凭据。
- 修改前备份：`E:/Documents/AI/codex/backups/games-repo-migration-20261009-220038/`；记录 / 检查中间文件：`E:/Documents/AI/codex/tmp/games-repo-migration-20261009-220038/`。

## 实际发布与验收

- Games 首次代码提交：`3b16180dc5d79b9c71ea13c7a7e8839a9b34a1d7`，
  [GitHub CI](https://github.com/caibinice/games/actions/runs/37943898047) 成功。
- 博客只提交路由 / 兼容入口 / 手册：`71e500c02b0f2798a31a422729ef4eca52823dd1`，未混入文章修改。
- 新 release：`20261009142427-3b16180dc5`，北京时间 2026-10-09 22:24。
  运行代码来自上述 Games 提交；本记录是发布之后的文档补记。
- 执行 Games `scripts/deploy.ps1 -SkipInstall` 完整门禁及独立 SSH 发布：
  55 项 Node 测试、8 项部署测试、100 关 / 40 图目录检查、构建、凭据审计全部通过。
- 33 个文件在迁移前源码、E 盘备份、Games 工作树、Git blob 与公网逐字节 / SHA-256 一致。
  Git 仅保存凭据说明和模板；真实配置、Python 环境、dist 和 host key 未提交。
- 本地构建及公网各完成三组真实手机浏览器回归：新手引导 / 工具 / Cookie / 无限续时 / 全屏、
  100 关 / 40 图 / 隐藏跳关 / 起点底色优先放置 / 旧存档、暂存扩容 / 70 颗一次存放 / 无独立滚动条。
  六种窗口尺寸验证，页面脚本错误均为 0；结果与截图在上述中间文件目录的 `public/`。
- 清除博客游戏源码、测试及旧预览 / 素材工具后，博客 TypeScript、12 项测试及 55 页构建通过，
  博客 dist 中没有拼豆目录。
- Nginx `nginx -t`、reload、active、游戏全部文件 / MJS MIME / 缺失 404 / 无斜杠跳转、
  博客及停车路由全部通过。公共 Nginx 片段 SHA-256 未改变：
  `c2b3565dd358c75dfc89ec746a1c86513b8d5c7c160b1d6ca6bdec5f460f36a3`。

## 本次回滚记录

- 原游戏路径：`/opt/pindou/releases/20261009053915/www`。
- 当前路径：`/opt/pindou/releases/20261009142427-3b16180dc5/www`。
- 服务器备份：`/opt/pindou/backups/20261009142427-3b16180dc5/`。
- 本机记录：`E:/Documents/AI/codex/backups/games-pindou-20261009-222427-698186/rollback.json`。
- 上传包 SHA-256：`22513ef68b644c98275137868de22183a8148ae1cdafd638c7f5f42194fcce18`。

游戏回滚按 [部署手册](deployment.md) 切换旧软链接；不修改玩家 Cookie。
仓库迁移回滚时可从完整迁移备份恢复博客源码 / 工具，Nginx URL 无需更换。

### CI 字节比较修正

文档补记后的云端复验曾在素材深层对象比较中触发默认 5 秒超时。
构建测试改用 Node 原生 `Buffer.equals` 逐字节验证，仍检查全部文件和 gzip 内容，
仅去除测试断言对百万级数字属性的递归遍历；运行文件及已发布 release 无需变更。
