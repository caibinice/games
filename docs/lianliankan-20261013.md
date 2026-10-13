# 果趣连连看双端上线记录

上线日期：2026-10-13（Asia/Shanghai）。

## 交付

- 自动入口：https://caibinice.com/games/lianliankan/
- PC 页面：https://caibinice.com/games/lianliankan/pc.html
- 手机页面：https://caibinice.com/games/lianliankan/mobile.html
- 源码：`games/lianliankan/`，9 个独立运行文件，无第三方依赖。
- 30 关、16 种原创 SVG 水果、3 档难度；计时与自在模式、提示、洗牌、加时、连击和本地进度。
- 两端独立页面、棋盘和存档；大厅由已有自动目录机制新增入口。

## 验证

- `npm run check`、159 项 Vitest 测试、10 项 Python 发布测试、凭据审计通过。
- 300 张小棋盘与独立路径枚举算法交叉核验；72 张生成棋盘逐对验证可解。
- 浏览器实测 PC 与手机整局通关、道具、暂停、取消重开、关卡解锁、刷新续玩、时间到期后加时。
- 手机视口 320×658、375×812、390×844、430×932、768×1024 均无横向溢出；PC 1366×900 道具在首屏可见。
- 公网 PC 和真实触控仿真手机均完成配对，无页面脚本错误。
- 公网 13 个发布运行文件 SHA-256 全部匹配，模块 MIME、gzip、404、规范尾斜杠通过。

## 不影响其他游戏

仅构建、发布 `lianliankan`，包内没有拼豆或抓大鹅资源。
沿用旧 release，仅增加新游戏目录并更新大厅目录；发布前后两个旧游戏的 **87 个文件（含 gzip）哈希全部一致**。
Nginx 路由片段字节级不变；未修改博客项目镜像、其他游戏源码、资源或存档。
大厅、拼豆、抓大鹅、博客首页、停车页面上线后均返回 HTTP 200。

## 发布与回滚

- 当前 release：`/opt/games/releases/20261013034934-422241a2e7/www`
- 上一 release：`/opt/games/releases/20261012081554-f0fc89378e/www`
- 本机回滚记录：`E:/Documents/AI/codex/backups/games-20261013-114934-252364/rollback.json`
- 服务端回滚记录：`/opt/games/backups/20261013034934-422241a2e7/`
- 校验基线、验证 JSON 和页面截图：`E:/Documents/AI/codex/tmp/lianliankan-20261013-112736/`

按共享发布手册核对上一 release 后原子切回即可；旧 release 未清理。
运行源码、自动测试与验收记录随连连看功能提交；提交后核验远端 `main` 与本机 HEAD 一致。
