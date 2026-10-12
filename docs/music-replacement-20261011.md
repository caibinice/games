# 两款游戏的干净中速配乐 · 2026-10-11

> 后续：拼豆仍使用此配乐。抓鹅已按玩家提供的新录屏替换为首页 / 游戏两条原声，见 [2026-10-12 场景与音乐记录](goose-scenes-20261012.md)。

## 问题与修复

玩家反馈上一版抓鹅有奇怪消音、音量偏小，拼豆音乐明显失真。旧录屏本身是单声道，主要问题不是左右声道反相：REPET-SIM 谱域分离同时削弱了部分乐器与瞬态，后续播放增益 0.55 又压低了音量。[旧分离记录](music-20261011.md)仅留作历史，不再用于发布。

本次直接替换两条音轨，不再分离、去噪、压缩、门控或 ducking：

| 游戏 | 配乐 / 原作者 | 原始速度 | 循环 | 文件 |
| --- | --- | --- | --- | --- |
| 拼豆 | [Carefree — Kevin MacLeod](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037) | 96 BPM | 40.000 秒 / 16 小节 | 801,602 B |
| 抓大鹅 | [Life of Riley — Kevin MacLeod](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400054) | 102 BPM | 37.647 秒 / 16 小节 | 754,587 B |

两首都是尤克里里、吉他、钟琴及打击乐编配的欢快中速配乐；《Carefree》另有马林巴。速度与乐器来自作者的[官方曲库元数据](https://incompetech.com/music/royalty-free/pieces.json)，不是音频算法猜测。这是替代配乐，不声称是两款原版游戏的音乐。

## 来源、许可与署名

- 来源：[Incompetech 官方曲库](https://incompetech.com/music/royalty-free/music.html)。下载为作者提供的 44,100 Hz / 双声道 / 256 kbps MP3：
  - <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3>
  - <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Life%20of%20Riley.mp3>
- [作者许可页面](https://incompetech.com/music/royalty-free/licenses/)的 Creative Commons 署名生成器列明 **CC BY 4.0**。每款游戏的设置弹窗都可见曲名、Kevin MacLeod、源曲链接、[CC BY 4.0 链接](https://creativecommons.org/licenses/by/4.0/)，以及「节选、循环与音量调整」。MP3 的 ID3 元数据也保存作者及许可。
- 音频依旧由各自 `/games/<id>/assets/audio/music-loop.mp3` 自托管。运行时没有向音乐站点请求文件；只有玩家主动点击署名链接才打开外站。

| 音轨 | 原下载 SHA-256 | 发布 MP3 SHA-256 |
| --- | --- | --- |
| Carefree / 拼豆 | `8433b770a630d9b1594fd484442c677907ece899a4d149954cd2e74fd733e311` | `8ce201c167123793882d5da8135a253f0fd2338e6e2ea40a74975f830b6db4ab` |
| Life of Riley / 抓鹅 | `1916f05cd1860949f9241e17966d334c39852b531329e4a05802720bb154c564` | `ac8a07022f5b0251ce3390317bc69168a0a3a2c41e2fab0f04ef15f0acd1756f` |

## 音频处理与播放

1. 保留原始立体声及速度。拼豆节选从 40.0 秒起，抓鹅从 37.6470588235294 秒起；各取 16 个 4/4 小节，额外读取 80ms 用于同节拍相位的余弦交叉接缝，不每轮淡出到静音。
2. 循环 PCM 在前 250ms 内寻找双声道共同低幅值点做环形移位；不改变时长或乐句，减少编码后首尾的跳变。
3. 响度测量仅用于计算一次固定增益，目标 -18 LUFS，源 PCM true peak 上限 -2 dBTP；**没有逐帧自动增益**。抓鹅固定 +0.04 dB，拼豆固定 +1.75 dB。
4. 导出 44,100 Hz、160 kbps 立体声 MP3，保留 Xing/LAME gapless 元数据。成品测量：抓鹅 -18.43 LUFS / -4.80 dBTP；拼豆 -18.44 LUFS / -3.79 dBTP。无削波。
5. 播放器固定增益从 0.55 提高到 **0.80**，成品进入游戏后的平均 RMS 分别约 -22.24 / -22.77 dBFS，比旧版本约高 5.4 / 6.4 dB；音效仍由独立开关控制。没有因点击、三消或拼豆操作压低配乐的逻辑。
6. 保留解码一次、PCM 循环、首次触摸解锁、首页安静、弹窗 / 后台暂停、恢复原播放位置及 Cookie 偏好兼容。两个入口和音频 URL 都升级至 **20261011-5**，避免浏览器继续播放缓存的旧文件。

构建 / CI / 服务器不依赖 FFmpeg 或音频处理库。离线重制仅需 Python 标准库与 FFmpeg，脚本为 `scripts/prepare-clean-music.py`；旧 `scripts/prepare-music.py` 已标记为停用的录屏实验。

```powershell
Set-Location E:\codes\games
$ffmpeg = 'PATH_TO_FFMPEG_7_1.exe'
$work = 'E:\Documents\AI\codex\tmp\clean-music-preparation'
# 将上述两个官方源文件下载至 $work 后：
& .\.venv\Scripts\python.exe scripts/prepare-clean-music.py --ffmpeg $ffmpeg `
  --source "$work\Carefree.mp3" --work "$work\pindou" --start 40 --bpm 96 `
  --title Carefree --output games/pindou/public/assets/audio/music-loop.mp3
& .\.venv\Scripts\python.exe scripts/prepare-clean-music.py --ffmpeg $ffmpeg `
  --source "$work\Life of Riley.mp3" --work "$work\goose" --start 37.6470588235294 --bpm 102 `
  --title 'Life of Riley' --output games/goose/public/assets/audio/music-loop.mp3
```

## 验证与回滚

- 125 项 JS 测试通过，包括 31 项音乐测试：原来的状态机 / 错误重试测试，新增双声道 MPEG 检查、设置署名及入口 / 音频共同缓存版本检查。10 项 Python 发布测试通过。
- 两条新轨与未编码清洁 PCM 的波形相关性 0.9972 / 0.9986；50ms 能量窗的编码增益变化 P01～P99 仅 0.24 / 0.21 dB，未引入额外的消音抽吸。
- 双声道相关性为正（0.63 / 0.37），单声道合并没有反相抵消；循环首尾跳变分别 0.00935 / 0.00307，低于正常音频样本差分 P99，全部 50ms 窗有有效信号。
- 全量构建依旧 55 个运行时文件，独立游戏目录不变；源下载、完整曲库元数据、处理中间文件和脚本不发布。
- Chromium 393×873 / DPR3 真实触屏模拟：两款游戏均等待一整轮，播放位置回到约 0.51 秒；同一个 source 连续循环、只取一次音频，输出 Analyser RMS 有效，默认增益 0.80。首页不播放；设置暂停、独立开关、旧静音偏好、刷新续局、visibility / pagehide / pageshow 事件夹具均通过。
- HTTP 404、解码失败、加载过程中开弹窗、重试与设备缺少 Web Audio 的回归通过；迟到的音轨不会在弹窗突然播放，操作仍有效。新玩家同一触摸解锁默认音乐及自动全屏，教学介绍保持安静，教学开始后才播放。
- 两款游戏的实际胜利 → 下一关、超时 → 免费续时音乐状态通过；真实 3D 拾取 / 重开确认、拼豆连选 / 暂存、手动全屏及无页面上下滚动通过。所有检查页面 JS 错误 0，设置中可见署名与许可。

本地来源、测量与浏览器日志：`E:/Documents/AI/codex/tmp/games-clean-music-20261011-184522/`。
改动前 HEAD 99 个文件已逐字节核验，完整备份：`E:/Documents/AI/codex/backups/games-clean-music-20261011-184522/games-head.zip`；同目录保存 Nginx 修改前路由。发布继续使用[原子批量发布手册](deployment.md)，不改博客、Nginx 映射、关卡和存档格式。

验证属于音频信号检查与 Chromium 手机模拟；真人听感以玩家试听反馈为准。

## 已发布

- 运行时代码 `cae6f46aa51b60a2eed90c6e67b74acc0eaf1472`，[GitHub CI 成功](https://github.com/caibinice/games/actions/runs/38133712175)。后续本记录补写是文档提交，不改变运行时。
- 两个入口资源版本 **20261011-5**；[抓大鹅](https://caibinice.com/games/goose/) / [拼豆](https://caibinice.com/games/pindou/) / [大厅](https://caibinice.com/games/)。刷新入口即可更新，无需清 Cookie 或重开关卡；原来关闭音乐的玩家可在设置中单独打开「背景音乐」。
- 批量原子发布 `20261011105629-cae6f46aa5`（UTC 10:56 / 北京时间 18:56）；`/opt/games/www` → `/opt/games/releases/20261011105629-cae6f46aa5/www`。
- 旧 release `/opt/games/releases/20261011101946-4380fa5b81/www` 保留；服务器备份 `/opt/games/backups/20261011105629-cae6f46aa5/`，本机回滚记录 `E:/Documents/AI/codex/backups/games-20261011-185629-816370/rollback.json`。
- 公网及服务器 SFTP 55 / 55 文件 SHA-256 匹配；音频 `audio/mpeg`、字节 Range 206、JS MIME、私有 / 缺失资源 404、入口尾斜杠均通过。原始下载及中间 PCM 未发布。
- 公网重新执行完整手机触屏音乐回归：抓鹅一轮后位置 0.524 秒，拼豆 0.509 秒，source 均不重建；输出信号有效，独立开关、存档、暂停 / 恢复和全屏无滚动通过，页面 JS 错误 0。
- Nginx `-t` 成功且服务 active。路由与发布前逐字节相同，SHA-256 `ebe1d28d0610e9d18e2d5eb1576ed350f783829aa7249e8a097f023760dbd45f`；博客配置镜像未变，`E:/codes/ai-blog` 仍为 `7e789db` 且工作区干净。
- 验收日志：本地处理目录内的 `quality-gates.log`、`audio-validation.json`、`music-browser-qa.log`、`music-failure-qa.log`、`music-endflow-qa.log`、`mobile-touch-qa.log`、`deploy.log`、`verify-public.log`、`public-music-qa.log`、`remote-after.log`。
