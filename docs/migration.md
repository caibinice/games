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

发布验收与 release / 回滚信息将在完成独立发布后补记在此。
