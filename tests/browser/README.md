# 浏览器验收片段

这三个文件是 Playwright CLI 的 `run-code` 函数，不是 Vitest / Playwright Test 测试规范。使用独立会话、已构建的本地预览。先打开并检查对应页面快照，再执行：

```powershell
$code=(Get-Content E:/codes/games/tests/browser/racer-pc.mjs -Raw).TrimEnd().TrimEnd(';')
playwright-cli -s=games-check run-code $code
playwright-cli -s=games-check eval 'window.__qaResult'
```

- `classic-touch.mjs`：打开坦克或魂斗罗的手机版；自动测试竖屏虚拟旋转、CDP 多指移动 / 射击 / 跳跃、松手、横握、退出、刷新辅助存档。使用新建或暂停状态的验证局。
- `racer-pc.mjs`：1440×900，打开赛车 PC 页并等资源就绪；测试键盘变道、腾空侧滚、归零落地与全屏。
- `racer-mobile.mjs`：390×844，打开赛车手机页；主动拒绝原生全屏 API，测试窗口横屏、多指、选关弹窗与保存。

截图当前写入本机专用工作目录 `E:/Documents/AI/codex/tmp/vue-racing-20261018/`。不要对用户实际浏览会话或线上已有存档运行，片段会启用辅助项、选择关卡并写入当前浏览器上下文的本地存档。
