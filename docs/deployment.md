# Games 独立构建、发布与回滚

## 仓库和入口

| 项目 | 固定值 |
|---|---|
| GitHub | https://github.com/caibinice/games |
| 分支 / 本机 | `main` / `E:/codes/games`（新机器可换父目录） |
| 游戏源码 | `public/games/pindou/` |
| 构建运行目录 | `dist/games/pindou/` |
| 构建清单 | `dist/release-manifest.json`，每个运行文件的 SHA-256 |
| 公网 | https://caibinice.com/games/pindou/ |
| Nginx route | `/games/pindou/`，无尾斜杠入口 301 |
| 服务器 release | `/opt/pindou/releases/<UTC时间>-<Git提交>/www/` |
| 当前软链接 | `/opt/pindou/www` → release 的 `www` |
| 实际静态文件 | `/opt/pindou/www/games/pindou/` |
| 共享 Nginx 片段 | `/etc/nginx/snippets/ai-platform-routes.conf` |
| 游戏 Nginx 模板 | `deploy/nginx/pindou.conf` |

游戏独立于博客 release。保留原 `/opt/pindou` 映射而不改 URL，旧 Cookie、收藏和当前画板仍可使用；迁移仓库不重开关卡。

## 新机器准备

```powershell
Set-Location E:\codes
git clone https://github.com/caibinice/games.git games
Set-Location games
npm ci
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item credentials\config.example.ini credentials\config.ini
```

填写本机 `credentials/config.ini`：

- `[github] token`：本仓库 GitHub 提交 / 推送认证；可配置代理和公开提交身份。
- `[remote.ssh] host/port/user/password/root_password`：上传到现有 Nginx 服务器，发布过程使用现有 root 提权方式。
- 实际配置被 Git 忽略，只提交 `config.example.ini` 和说明；远程包只包含构建 `dist`，没有凭据。
- 不读取 ai-blog 或量化项目的凭据，不需要它们的 `.venv`、Node 依赖或源码。
- 可用 `GAMES_CREDENTIALS_FILE` 指定本机配置路径；仅需复制这一份私有文件即可换机。
- SSH 首次连接保存 host key 到忽略的 `.deploy/known_hosts`；本机迁移已复制原服务器的已知 host key。

运行游戏和公网校验均不需要 token；只有 GitHub 推送 / SSH 发布读取对应段。

## 校验、构建和打包

```powershell
npm run check
npm test
npm run build
npm run audit:secrets
& .\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
& .\.venv\Scripts\python.exe scripts\deploy.py --dry-run
```

- 检查 100 关 / 40 图目录、模块语法、库存与 Cookie。
- 生产构建只从 `public/` 写入 `dist/`，生成 gzip、运行文件 SHA-256 清单。
- `--dry-run` 校验清单、源码 / 构建一致、gzip 内容和包目录，仅离线打包，不读取凭据或连接 SSH。
- 拒绝过期构建、篡改清单、路径穿越、软链接、未声明文件或夹带凭据。
- 本机临时包默认在 `E:/Documents/AI/codex/tmp/games-pindou-release-*/`，备份在 `E:/Documents/AI/codex/backups/games-pindou-*/`。非 Windows 默认在用户 `~/.local/state/games`；可通过 `GAMES_WORK_ROOT` 指定。

## 独立发布

```powershell
# 自动 npm ci → check → test → build → audit → 发布测试 → SSH
pwsh -NoLogo -NoProfile -File scripts\deploy.ps1

# 已装依赖时跳过 npm ci
pwsh -File scripts\deploy.ps1 -SkipInstall

# 全部本地门禁，不连接生产
pwsh -File scripts\deploy.ps1 -BuildOnly
```

也可以在完成上面的检查 / 构建后执行：

```powershell
& .\.venv\Scripts\python.exe scripts\deploy.py --game pindou
& .\.venv\Scripts\python.exe scripts\verify.py
```

发布只上传 tar.gz 构建包和 Nginx 片段；服务器提取到独立 release，再原子切换 `www`。先保存原软链接 / Nginx 配置；共享路由 SHA-256 如果在上传期间变化则停止，避免覆盖并行项目发布。执行 `nginx -t`、reload、全部运行文件 HTTP / MIME、404、博客和停车路由自检。任一发布阶段失败会恢复上版游戏及路由；不重启 Java 服务、数据库或其它项目。

`verify.py` 独立从公网比对全部 33 个运行文件的 SHA-256，验证 MJS MIME、缺失文件 404、无尾斜杠跳转。

## 博客如何配合

博客 `deploy/nginx/ai-platform-routes.conf` 继续保留 `begin-pindou-static-game` 片段；`deploy/nginx/pindou.conf` 为同一映射镜像。游戏发布可同步**已有**兄弟博客的这一片段并先备份，不改其它项目路由；兄弟博客不存在时仍可独立发布。可用 `--blog-root` 指定镜像位置。

博客的全量部署 / Nginx 更新会使用共享片段，所以不要删除该映射。博客静态构建不再包含游戏代码，游戏始终由 `/opt/pindou/www` 处理。

博客旧命令 `scripts/remote/deploy_pindou.py` 仅为兼容跳转，调用兄弟 games 的发布入口；正式维护及发布请在本仓库执行。

## GitHub 提交与推送

```powershell
& .\.venv\Scripts\python.exe scripts\github-push.py --validate-only
& .\.venv\Scripts\python.exe scripts\github-push.py `
  --message 'feat: update pindou' `
  --files public/games/pindou tests docs/pindou.md

# 已有明确确认的本地提交
& .\.venv\Scripts\python.exe scripts\github-push.py --push-only
```

默认使用公开 noreply 作者身份。认证仅通过 Git 子进程环境 header，不写进 remote URL 或 `.git/config`；提交前校验 main / origin、远端同步、暂存状态和凭据排除，先处理远端领先或未推送提交，不 force push。

博客共享推送助手也支持 `-Project games`，该项目从新仓库 `credentials/config.ini` 读取，不再借用博客 token。

## 回滚

每次发布写入本机 `rollback.json` 与服务器 `/opt/pindou/backups/<release>/`，后者含 `previous-release.txt` 和 `ai-platform-routes.before.conf`。

读取这次发布的 previous 路径，确认其属于 `/opt/pindou/releases/` 并存在后：

```bash
# 在服务器 root shell；将 RELEASE、PREVIOUS 替换为已核对的记录
backup=/opt/pindou/backups/RELEASE
previous=PREVIOUS
test -d "$previous"
cp "$backup/ai-platform-routes.before.conf" /etc/nginx/snippets/ai-platform-routes.conf
ln -sfn "$previous" /opt/pindou/www.rollback
mv -Tf /opt/pindou/www.rollback /opt/pindou/www
nginx -t && systemctl reload nginx
curl -fsS https://caibinice.com/games/pindou/ >/dev/null
```

存在后续其它项目路由改动时，只替换游戏软链接，或从备份中提取游戏片段合并，保留之后新增的共享路由；不要用较旧的完整配置覆盖其它项目新增段。回滚不会修改玩家浏览器 Cookie。
