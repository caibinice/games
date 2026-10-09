# caibinice / games

独立手机 Web H5 游戏仓库。游戏源码、素材、关卡、测试和构建发布都在这里维护，不再放进 ai-blog 的静态目录。

## 拼就完了 · 毛球小镇

- 在线地址：[https://caibinice.com/games/pindou/](https://caibinice.com/games/pindou/)
- 纯静态、竖屏、无广告，无游戏后端；Cookie 保存关卡及当前画板。
- 100 关、40 种像素图；相邻同色错放豆跨底色连取，归位优先搬起点底色下的豆。
- 两行暂存起步、免费加行，按空位一次暂存，无单次两行上限；3 分钟倒计时免费无限续时。
- 保留新手教学、全屏、不规则轮廓、凹槽 / 凸豆、整色静态炫光和旧 v3/v4 存档。

## 本地开发

Node.js 22+、Python 3.11+、Git；Windows 发布入口使用 PowerShell 7。

```powershell
git clone https://github.com/caibinice/games.git E:\codes\games
Set-Location E:\codes\games
npm ci
npm run dev
# http://127.0.0.1:4176/games/pindou/
```

```powershell
npm run check
npm test
npm run build
npm run audit:secrets
npm run preview   # 与生产相同的 dist 目录
```

## 一次配置，独立发布

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item credentials\config.example.ini credentials\config.ini
# 在本机 config.ini 填写 GitHub / SSH；真实文件已忽略
pwsh -File scripts\deploy.ps1 -BuildOnly
pwsh -File scripts\deploy.ps1
& .\.venv\Scripts\python.exe scripts\verify.py
```

发布链：检查与测试 → 构建 `dist/games/pindou/` → 打包 `dist` 为 tar.gz → SSH 上传 → 原子切换 `/opt/pindou/www` → Nginx / HTTP 自检。服务器不克隆源码，也不安装 Node；不会上传 `credentials`、测试、发布脚本或 npm 依赖。

Nginx 保持映射 `/games/pindou/` → `/opt/pindou/www/games/pindou/`，浏览器地址、Cookie 路径和已有玩家存档都不变。博客只保留共享 Nginx 路由镜像及运维说明，统一发布博客不会覆盖游戏。

## 文件与手册

```text
public/games/pindou/    游戏运行源码、40 种图案与全部素材
tests/                 游戏、构建及发布测试，真实旧存档夹具
scripts/build.mjs      只复制 / 校验公开运行文件，生成 gzip 与 manifest
scripts/deploy.py      只部署构建产物，失败自动回滚
scripts/remote_client.py 独立 SSH 客户端，不依赖兄弟项目
scripts/github-push.py 本仓库 GitHub 推送，认证仅作用于子进程
deploy/nginx/pindou.conf Nginx 映射片段
credentials/config.ini 本机 GitHub / SSH，忽略且不上传
dist/                  本机构建产物，忽略且可重建
```

- [部署、凭据、目录和回滚手册](docs/deployment.md)
- [游戏规则与历史迭代记录](docs/pindou.md)
- [迁移记录](docs/migration.md)
- [本机凭据说明](credentials/README.md)

只提交明确列出的文件，推送方式见部署手册。GitHub Actions 执行离线检查 / 构建测试，不需要生产凭据，也不会自动连接生产服务器。
