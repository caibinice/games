# 本机 Blender / Blender MCP

2026-10-18 安装完成，使用官方便携版与独立 Python 环境，未改系统 PATH、Codex 配置或全局技能。

| 项目 | 位置 / 版本 |
|---|---|
| Blender | `E:/Documents/AI/codex/apps/blender-4.5.14-windows-x64/blender.exe` |
| 版本 | Blender **4.5.14 LTS**，命令行验证通过 |
| 下载 | `https://download.blender.org/release/Blender4.5/blender-4.5.14-windows-x64.zip` |
| ZIP SHA256 | `b9533d2397ac1984db4466fb23a7a4649391cca93f6e84209f9bcc60d071c8b9`，与官方校验文件一致 |
| 签名 | Authenticode `Valid`，签名主体 Blender Foundation |
| MCP | `mcp-for-blender==2.1.9`，独立环境 `E:/Documents/AI/codex/apps/blender-mcp-venv` |
| Addon | `E:/Documents/AI/codex/apps/blender-mcp-2.1.9/addon.py` |
| Addon 来源 | `https://github.com/ahujasid/mcp-for-blender`，提交 `7a0373ec9199183cb460068c4f96aed9c579fb4f` |
| 启动脚本 | `E:/Documents/AI/codex/apps/blender-mcp-2.1.9/start.ps1` |
| 本机 Socket | `127.0.0.1:19876`，只监听回环地址 |
| 快捷方式 | 用户开始菜单 `Programs/Blender 4.5 LTS.lnk` |

## 使用

```powershell
# 隐藏窗口启动本任务式 Blender MCP，不读取 / 改写用户 Blender 偏好
pwsh -File E:/Documents/AI/codex/apps/blender-mcp-2.1.9/start.ps1

# MCP 客户端的 stdio command / args
E:/Documents/AI/codex/apps/blender-mcp-venv/Scripts/mcp-for-blender.exe --host 127.0.0.1 --port 19876
```

需要桌面交互时从开始菜单正常打开 Blender；MCP 启动器使用 factory-startup 和任务 addon，不覆盖用户配置。当前没有持久注册到 Codex MCP 配置。

本次通过 Python MCP ClientSession → stdio server → Blender addon，实际调用 `execute_blender_code`，生成 53 个原始对象并导出 `jet-r.glb`（277,744 字节），保存 `jet-r.blend`。模型 SHA256：`96bcd59af7cd64a0ea8b62457bfd16bbb503c27105857663fe0b83dc44f3544b`。制作完成后的隐藏 Blender 进程已关闭。

## 回滚与卸载

这些都是本次新建目录，没有覆盖既有软件；无系统服务或驱动。退出 Blender 后，检查绝对路径位于 `E:/Documents/AI/codex/apps/`，即可删除上述三个专用目录及本次开始菜单快捷方式。下载包、官方校验文件和 MCP 执行记录保留在 `E:/Documents/AI/codex/tmp/vue-racing-20261018/`，可用于重装核验。游戏工程中的 GLB / Blend 源文件独立保留。
