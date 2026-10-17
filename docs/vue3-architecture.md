# Vue 3 多游戏架构

## 日常修改的位置

- `web/src/main.mjs`：Vue Router 与 `/games/` 下的旧地址兼容、PC / 手机入口分流。
- `web/src/pages/`：大厅、经典游戏、3D 赛车等 Vue SFC。
- `web/src/components/`：悬浮摇杆、多指动作按钮、支持焦点循环的游戏弹窗。
- `web/src/composables/`：经典游戏会话、横屏全屏、旧引擎页面的生命周期适配。
- `games/<id>/public/`：纯引擎、渲染器、音频和素材。引擎不依赖 Vue，可独立单元测试。
- `web/entries.json`：已有入口 HTML 的标题、主题样式和元信息。

坦克 / 魂斗罗 / 赛车的界面、HUD、菜单和会话已经采用 Vue 响应式状态；Canvas / WebGL 每帧渲染仍由专用渲染器执行，避免把每颗子弹变成 Vue 节点。

拼豆 / 抓大鹅 / 连连看 / 泡泡堂的页面模板迁入 `pages/legacy/`，原成熟控制逻辑迁入 `web/src/legacy/`，由 Vue 页面加载并管理生命周期。这四款暂保留 DOM HUD 适配层，并非把其引擎全部重写成响应式数据；后续可逐个提取成原生 Vue 组件。没有 iframe，也没有在 Vue 页面内嵌旧 HTML 文档。

## 生命周期与存档

Vue 卸载时取消兼容控制层的全局监听、动画帧、计时器和 ResizeObserver，并释放原有 3D 场景 / 音频；经典游戏直接清理自己的会话。换页前自动暂停并保存。

六款原游戏的 Cookie / LocalStorage 名称及 v1 数据结构保持不变；坦克 / 魂斗罗的辅助局仍与普通局分开记分。赛车使用新的 `jet-r-racer:<pc|mobile>:v1`，不读取其他游戏的存档。

页面间采用普通链接整页进入，以隔离不同游戏的主题 CSS、资源相对路径和图形上下文。Vue Router 负责当前页面解析及同游戏布局切换，不依赖 Nginx history fallback；所有可分享地址都有真实 HTML 入口文件。

## 构建与发布

```powershell
npm ci
npm run build:frontend
npm run check
npm test
npm run build
npm run test:deploy
npm run audit:secrets
```

`scripts/build-frontend.mjs` 先运行 Vite，将 Vue 与 Three.js 依赖打包到 `site/ui/`。旧 `app.mjs` 成为加载器；兼容逻辑生成为各游戏的 `runtime.mjs`。这些产物提交到 Git，便于现有发布校验逐字节匹配。日常改 `web/src`，不要直接编辑生成后的加载器或 `site/ui`。

`web/build-manifest.json` 记录输入摘要与全部生成文件摘要；`npm run check` 会拒绝陈旧或手改产物。摘要统一换行以兼容 Windows / Linux。CI 继续运行原规则和发布隔离测试。

共享包只有内容哈希文件名，没有可被覆盖的固定共享 manifest。单游戏部署仅更新所选游戏加载器及新哈希文件；远程 release 继承未选游戏及其旧共享包，部署脚本继续验证继承文件字节不变。大厅与目录统一更新。当前旧版本 chunk 留在旧 release / 继承目录，避免在途页面和其他游戏加载旧哈希时遇到 404。

发布仍采用现有 Nginx 原子软链接切换；不增加端口、数据库或后台进程，不修改博客、停车系统等其他路由。

## 新增游戏

1. 新增平级 `games/<id>/game.json`、纯引擎、资源、检查与测试。
2. 添加 Vue 页面和 Router 注册；为 `web/entries.json` 增加实际 HTML 入口元信息。
3. 运行 frontend build、完整校验，再按既有发布手册选游戏上线。
4. 资源必须本地托管，保留来源与许可；运行目录仅包含可公开的浏览器资源。
