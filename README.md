# Games · Fish 的游乐场

一个仓库，多个彼此独立的 PC / 手机 H5 游戏。纯静态部署到 Nginx `/games/`，不随博客构建。

## 平级游戏目录

```text
games/
  pindou/
    game.json       名称、路径、版本、资源依赖
    public/         只属于本游戏的运行源码与素材
    tests/          本游戏测试与存档夹具
    tools/          本游戏素材处理工具
    docs/           本游戏玩法与历史
  goose/            独立 3D 抓大鹅，public / tests / docs
  lianliankan/      果趣连连看，PC / 手机双页面，独立 engine / tests / docs
  paopaotang/       泡泡小镇，水泡 AI 闯关 / PC 本地双人协作 / 手机触控
  <new-game>/       相同结构，平级扩展
site/               /games/ 游戏大厅
scripts/            共享检查、构建、发布、验证工具
tests/              共享构建/发布测试
credentials/        本机私有配置 + 可提交的模板
dist/games/         构建产物，按游戏分目录
```

- [拼豆](https://caibinice.com/games/pindou/)：100 关 / 40 图，原存档保持兼容。
- [抓大鹅 3D](https://caibinice.com/games/goose/)：60 关 / 8 个集市 / 34 种自制模型，深箱堆叠、3D 七格三消与物理颠锅。
- [果趣连连看](https://caibinice.com/games/lianliankan/)：30 关 / 16 种水果，逐章扩大棋盘与种类，经典两折连线；[电脑版](https://caibinice.com/games/lianliankan/pc.html) / [手机版](https://caibinice.com/games/lianliankan/mobile.html)。
- [泡泡堂 · 泡泡小镇](https://caibinice.com/games/paopaotang/)：30 关 / 6 个主题，逐步扩大地图与丰富道具，水泡、连锁和救援，AI 闯关与 PC 本地双人协作；[电脑版](https://caibinice.com/games/paopaotang/pc.html) / [手机版](https://caibinice.com/games/paopaotang/mobile.html)。
- [游戏大厅](https://caibinice.com/games/)：自动按各游戏 `game.json` 生成列表。

## 开发与构建

Node.js 22+、Python 3.11+、PowerShell 7。

```powershell
Set-Location E:\codes\games
npm ci
npm run dev                         # 先构建，再预览 http://127.0.0.1:4176/games/
npm run check
npm test
npm run build                       # 默认全部游戏
npm run build -- --games pindou      # 只构建一个
npm run audit:secrets
```

## 发布

首次配置 `.venv` / `requirements.txt`，填写被忽略的 `credentials/config.ini`，见 [详细手册](docs/deployment.md)。

```powershell
pwsh -File scripts/deploy.ps1 -BuildOnly
pwsh -File scripts/deploy.ps1                # 全部游戏，一次原子切换
pwsh -File scripts/deploy.ps1 -Games pindou   # 单独更新，保留其他游戏
pwsh -File scripts/deploy.ps1 -Games lianliankan -SkipInstall # 只发布连连看
pwsh -File scripts/deploy.ps1 -Games paopaotang -SkipInstall  # 只发布泡泡小镇
# 多个游戏用逗号字符串：-Games 'pindou,goose'
& .\.venv\Scripts\python.exe scripts/verify.py
```

发布只打包验证过的 dist。统一 release 在 `/opt/games/releases/<UTC时间>-<Git提交>/www`，
`/opt/games/www` 原子软链接提供 `/games/`。单独发布先继承现有 release，只替换选中的游戏；
批量发布整体切换。旧 `/opt/pindou` 保留供迁移回滚，不再写入新版本。
真实凭据、环境、测试和依赖目录不上传；第三方运行库在构建时复制并保留许可证，浏览器不依赖 CDN。

- [多游戏发布 / 回滚 / 新增游戏](docs/deployment.md)
- [拼豆规则与历史](games/pindou/docs/README.md)
- [抓大鹅玩法、素材与维护](games/goose/docs/README.md)
- [连连看玩法、双端存档与维护](games/lianliankan/docs/README.md)
- [泡泡小镇玩法、控制与维护](games/paopaotang/docs/README.md)
- [泡泡小镇双端提交与上线验收](docs/paopaotang-20261013.md)
- [30 关递进、大地图与机器人手感调整](docs/game-progression-20261015.md)
- [两款 PC 全屏与泡泡手感优化](docs/pc-immersive-latency-20261013.md)
- [连连看 PC / 手机独立上线验收](docs/lianliankan-20261013.md)
- [本机凭据](credentials/README.md)
- [此前独立仓库迁移](docs/migration.md)
- [多游戏改造与抓大鹅上线验收](docs/multi-game-migration.md)
- [三段录屏优化与一屏沉浸布局验收](docs/video-optimization-20261011.md)
- [抓大鹅大轮廓、实物材质与深堆翻锅优化](docs/goose-realism-20261011.md)

GitHub CI 离线运行检查、各游戏测试及发布测试，使用本仓库独立配置，不依赖博客或其他项目。
