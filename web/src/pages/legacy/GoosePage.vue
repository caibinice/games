<script setup>
import {useLegacyGame} from "../../composables/useLegacyGame.mjs";
useLegacyGame("goose");
</script>
<template>
<div id="app"><header><a class="round" href="/games/" aria-label="返回游戏大厅">‹</a><button id="brand" class="brand" aria-label="抓大鹅 鹅鹅集市"><img src="./assets/goose.svg" alt=""><span>抓大鹅<small>GOOSE MARKET</small></span></button><button id="full-btn" class="round" aria-label="全屏">⛶</button></header>
<div class="topline"><span id="chapter">鹅鹅集市</span><div class="top-controls"><button id="music-btn" aria-label="播放背景音乐" aria-pressed="false">♫</button><button id="settings-btn" aria-label="打开设置">⚙</button></div></div>
<section id="home-copy"><span class="eyebrow">WELCOME TO THE LITTLE MARKET</span><h1>锅里有惊喜，<br>还有一只<span>大白鹅。</span></h1><p>找三个一样的，把鹅鹅带回家。</p></section>
<section id="play-hud" hidden><div><span class="pill" id="level-name"></span><span id="remaining-count"></span></div><div class="timerline"><span id="time">03:00</span><div class="time-track"><i id="time-fill"></i></div><button id="time-add" aria-label="免费加三分钟">＋3分钟</button><button id="pause-btn" aria-label="暂停">Ⅱ</button></div></section>
<section class="bowl-card"><div class="board-top"><span id="bowl-label">TODAY'S LITTLE JOY</span><span id="render-badge">3D 实物</span></div><div id="stage"></div><div id="board-notice" aria-live="polite">鹅鹅正在摆摊…</div><div class="board-bottom"><span id="board-tip">每三件相同的物品，消除一组</span><button id="shake-btn" hidden>↝ 颠一颠</button></div></section>
<section id="home-actions"><button id="start-btn" class="primary">开锅，抓鹅！ <span>→</span></button><div class="home-links"><button id="levels-btn">挑选集市</button><button id="collection-btn">我的鹅鹅 <span id="collection-count">0 / 8</span></button><button id="help-btn">怎么玩？</button></div><p id="home-music-hint" class="quiet">轻触画面，听一听集市的音乐 ♫</p><p class="quiet">不看广告，放心玩 · 进度自动保存在本机</p></section>
<section id="play-bottom" hidden><div class="tray-card"><div class="tray-title"><strong>我的收集栏</strong><span id="tray-count">0 / 7</span><button id="undo-btn" aria-label="撤回一步">↶ 撤回</button><small>三个相同，自动消除</small></div><div id="tray" class="slots"></div><div id="reserve-line" class="reserve-line"><span>暂放区</span><div id="reserve"></div><span id="reserve-help">移出后，点击拿回来</span></div></div><div class="tools"><button id="out-btn"><b>↗</b><span>移出</span><small>免费</small></button><button id="magnet-btn"><b>🧲</b><span>凑齐</span><small>免费</small></button><button id="shuffle-btn"><b>✣</b><span>打乱</span><small>免费</small></button></div><p class="quiet" id="guide-note">点击物品收集 · 拖动锅或点按钮颠锅</p><div class="play-links"><button id="play-help">玩法说明</button><button id="home-btn">保存 · 回集市</button></div></section>
<footer>一点眼力，一点好运，一锅小快乐。<span>FISH'S PLAYGROUND</span></footer><div id="toast" role="status" hidden></div>
<dialog id="dialog"><button id="dialog-close" aria-label="关闭弹窗">×</button><h2 id="dialog-title"></h2><div id="dialog-content"></div></dialog></div>
</template>
