# 本机凭据

将 `config.example.ini` 复制为 `config.ini` 后填写 GitHub token 与 SSH 连接。
`config.ini` 被 `.gitignore` 排除，仅保存在本机；只提交模板和本说明。

- GitHub：用于 `scripts/github-push.py` 提交 / 推送本仓库。
- SSH：用于 `scripts/deploy.py` 上传构建包、切换静态 release、检查 Nginx。
- 游戏运行不读取凭据，没有后端 token；构建目录及服务器静态目录不含本目录。
- 可用 `GAMES_CREDENTIALS_FILE` 指定另一份本机 INI；脚本不依赖 ai-blog 或量化仓库。
- 新机器只需另行安全复制 `config.ini`，其余内容可从 GitHub 克隆重建。

`npm run audit:secrets` 校验源码、构建及 Git 文件清单；真实 token 不写入 remote URL、Git 配置、Markdown 或日志。
