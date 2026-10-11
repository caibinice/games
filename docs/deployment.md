# 多游戏构建、发布、扩展与回滚

仓库 https://github.com/caibinice/games ，默认 main。本机 `E:/codes/games`。

最新双游戏交互 / 视口 / 存档验证见 [2026-10-11 录屏优化记录](video-optimization-20261011.md)。
双游戏背景音乐来源、分离处理、独立开关与验收见 [2026-10-11 音乐记录](music-20261011.md)。
本次仍使用下述批量构建及原子发布流程，URL、Cookie 路径与 Nginx 映射不变。

## 目录与地址

每个游戏平级放在 `games/<id>/`：`game.json`、`public/`、`tests/`、`tools/`、`docs/`。
公共工具自动发现游戏，不需要在构建脚本硬编码游戏名。
构建输出 `dist/games/<id>/`，URL `https://caibinice.com/games/<id>/`。
游戏大厅 `https://caibinice.com/games/`，各游戏 Cookie 按自己 URL 分隔，拼豆仍使用原协议。

服务器统一使用 `/opt/games/releases/<UTC时间>-<Git提交>/www/`，
`/opt/games/www` 指向当前 release，Nginx `root /opt/games/www` 托管 `/games/`。
公共配置 `/etc/nginx/snippets/ai-platform-routes.conf` 的 `begin-games-static-app`。
模板 `deploy/nginx/games.conf`，博客保留同一镜像，后续博客部署仍能正确映射全部游戏。
以前 `begin-pindou-static-game` 自动迁移为公共片段；旧 `/opt/pindou` release 原样保留。

## 换机

```powershell
git clone https://github.com/caibinice/games.git E:\codes\games
Set-Location E:\codes\games
npm ci
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item credentials/config.example.ini credentials/config.ini
```

填写 `[github] token/proxy` 与 `[remote.ssh]`。本机配置已忽略，GitHub 只保留模板。
仅推送 / 发布读取对应凭据，不借用兄弟项目。`GAMES_CREDENTIALS_FILE` 可指定本机配置。
已知 SSH host key 在忽略的 `.deploy/known_hosts`；临时包 / 备份默认 E:/Documents/AI/codex 的 tmp / backups。

## 构建、单发、批量发

```powershell
npm run check
npm test
npm run build                         # 全部游戏
npm run build -- --games pindou        # 单游戏
npm run build -- --games pindou,goose  # 逗号选择多个已登记的游戏
npm run audit:secrets
& .\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'
& .\.venv\Scripts\python.exe scripts/deploy.py --games all --dry-run
```

manifest v2 包含游戏列表及每个文件的 SHA-256。部署拒绝过期构建、非法路径、软链接、
未知文件、篡改 / 错误 gzip、凭据以及构建选择与发布选择不一致。

```powershell
pwsh -File scripts/deploy.ps1 -BuildOnly    # 所有质量门禁，不连服务器
pwsh -File scripts/deploy.ps1              # 默认全部游戏
pwsh -File scripts/deploy.ps1 -Games pindou
pwsh -File scripts/deploy.ps1 -Games 'pindou,goose'
# -SkipInstall 只跳过 npm ci；-Game 为 -Games 的兼容别名
& .\.venv\Scripts\python.exe scripts/verify.py
```

单独发布继承当前完整 release，仅删除并替换**选中的游戏**，其他游戏逐文件哈希核验不变。
大厅列表来自本仓库完整目录，新增游戏请先完成实现测试再发布。
批量发布先在新目录准备所有产物，然后一次切换 www，不出现逐个游戏发布一半的状态。
SSH 启用发布锁及公共路由哈希并发保护，切换后验证全部发布文件、MIME、404、博客 / 停车。
错误触发旧链接 / 配置恢复。不改其他项目服务，不清理玩家 Cookie。

公网 `verify.py` 以本次 dist 为准，并发核验全部文件哈希和游戏 URL、模块 MIME、私有路径 404。
单独发布留下的其他游戏还会在远程切换前进行继承文件哈希检查。

## 新增游戏

1. 创建 `games/<id>/public/index.html`、`app.mjs` 和本游戏资源，id 使用小写字母 / 数字 / 横线。
2. 创建 game.json，含 id、name、description、color、symbol、version、facts、vendors；所有 URL 采用 `/games/<id>/`。
3. 添加 check.mjs 的 `export function check()`、独立 `tests/*.test.mjs`、docs/README.md；不引入其他游戏代码。
4. 资源放 public，工具 / 原稿留在 tools 或 docs。支持的固定运行库为 three、cannon-es，版本锁定在根 package-lock。
5. 运行共享门禁、手机浏览器回归；默认全发或用 `-Games <id>`。

## 提交

```powershell
& .\.venv\Scripts\python.exe scripts/github-push.py --validate-only
& .\.venv\Scripts\python.exe scripts/github-push.py --message 'feat: update game' --files games/<id> docs
```

认证只注入 Git 子进程，不保存到 remote URL 或 Git 配置。显式列文件，拒绝混入已有暂存 / 未推送提交。
博客兼容入口 `scripts/remote/deploy_pindou.py` 应显式转发 `-Games pindou`。

## 回滚

每次写入本机 rollback.json，服务器 `/opt/games/backups/<release>/` 保存 previous-release.txt 与公共片段。
核对 PREVIOUS 属于 `/opt/games/releases/` 且存在后，在服务器 root shell：

```bash
backup=/opt/games/backups/RELEASE
previous=PREVIOUS
test -d "$previous"
ln -sfn "$previous" /opt/games/www.rollback
mv -Tf /opt/games/www.rollback /opt/games/www
nginx -t && systemctl reload nginx
```

发生路由改动时按备份恢复 / 合并游戏片段，保留后来其他项目的新路由。
第一次从旧拼豆迁移的回滚只需恢复旧公共配置，重新启用 `/opt/pindou/www`；旧资源从未删除。
这是整包回滚，单独回退某游戏可按其旧提交重新构建该游戏再单发，其他游戏保留。

抓大鹅的大轮廓 / 实物材质 / 深堆翻锅采用单独发布，记录见
[2026-10-11 模型和物理优化](goose-realism-20261011.md)；不需要重新发布拼豆。
