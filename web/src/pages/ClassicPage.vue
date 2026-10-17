<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useClassicSession } from '../composables/useClassicSession.mjs';
import { useLandscapeFullscreen } from '../composables/useLandscapeFullscreen.mjs';
import TouchStick from '../components/TouchStick.vue';
import TouchAction from '../components/TouchAction.vue';
import GameModal from '../components/GameModal.vue';
const props = defineProps({ id: String, platform: String });
const canvas = ref(),
  mobile = props.platform === 'mobile',
  tank = props.id === 'tank';
const session = useClassicSession(props.id, props.platform, canvas);
const { state, engine, dialog, notice } = session;
const full = useLandscapeFullscreen(mobile);
const style = computed(() => {
  const { width: w, height: h } = full.viewport.value;
  const ratio = tank ? 256 / 240 : 256 / 224;
  return {
    '--ratio': ratio,
    '--play-width': w + 'px',
    '--play-height': h + 'px',
    '--field-width': Math.floor(Math.min(h - 46, (w - (mobile ? 230 : 32)) / ratio) * ratio) + 'px',
  };
});
async function start() {
  if (mobile) void full.enter();
  await session.begin();
}
function keyboard(e) {
  if (
    dialog.value ||
    e.ctrlKey ||
    e.altKey ||
    e.metaKey ||
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
  )
    return;
  if (e.code === 'KeyF') {
    e.preventDefault();
    if (!e.repeat) void full.toggle();
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    if (full.active.value) void full.exit();
    else session.pause();
  }
}
onMounted(() => document.addEventListener('keydown', keyboard));
onBeforeUnmount(() => document.removeEventListener('keydown', keyboard));
const modalTitle = computed(
  () =>
    ({
      levels: '选择作战区域',
      cheats: '作弊 / 辅助设置',
      help: '操作备忘',
      confirm: '重新部署？',
    })[dialog.value],
);
</script>
<template>
  <div
    class="classic-shell"
    :class="{ 'play-full': full.active.value, 'virtual-landscape': full.rotated.value }"
    :style="style"
  >
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="/games/"
          ><img src="./assets/icon.svg" alt="" /><span
            ><strong>{{ state.title }}</strong
            ><small>{{ tank ? 'BATTLE CITY' : 'CONTRA' }} · VUE EDITION</small></span
          ></a
        >
        <nav class="nav">
          <a :href="mobile ? './pc.html' : './mobile.html'">{{ mobile ? '电脑版' : '手机版' }} ↗</a
          ><button
            id="sound-button"
            data-action="sound"
            :aria-pressed="state.sound"
            aria-label="切换音效"
            @click="session.sound"
          >
            音效 {{ state.sound ? '开' : '关' }}</button
          ><button data-action="help" @click="session.open('help')">说明</button>
        </nav>
      </header>
      <section class="heading">
        <div>
          <span class="eyebrow">CARTRIDGE COLLECTION / {{ state.count }} STAGES</span>
          <h1>{{ tank ? '保护老鹰，守住每一寸阵地。' : '并肩记忆，一个人的勇敢。' }}</h1>
          <p>单人战役 · 经典像素 · 悬浮双区触控 · 本地自动存档</p>
        </div>
        <div class="best">
          {{ state.assisted ? '辅助局最高分' : '个人最高分'
          }}<strong id="best">{{ state.best }}</strong>
        </div>
      </section>
      <main class="layout">
        <section class="screen-panel" :aria-label="state.title + '游戏'">
          <div class="statusbar">
            <span id="map-name">{{ state.name }}</span>
            <div class="tools">
              <button data-action="levels" @click="session.open('levels')">关卡</button
              ><button data-action="cheats" @click="session.open('cheats')">作弊</button
              ><button
                id="fullscreen-button"
                :aria-pressed="full.active.value"
                aria-label="全屏游玩"
                @click="full.toggle"
              >
                {{ full.active.value ? '退出全屏' : mobile ? '横屏全屏' : '⛶ 全屏' }}</button
              ><button id="pause-button" data-action="pause" @click="session.togglePause">
                {{ state.status === 'paused' ? '继续' : '暂停' }}</button
              ><button data-action="restart" @click="session.requestFresh()">重开</button>
            </div>
          </div>
          <div class="cabinet" id="cabinet">
            <canvas
              ref="canvas"
              id="game-canvas"
              width="256"
              :height="tank ? 240 : 224"
              tabindex="0"
              :aria-label="state.title + '单人战场'"
            ></canvas>
            <div v-if="state.status !== 'running'" class="overlay" id="overlay">
              <div id="overlay-content" class="overlay-content">
                <span class="eyebrow">{{
                  state.status === 'paused'
                    ? 'PAUSED'
                    : state.status === 'won'
                      ? 'STAGE CLEAR'
                      : state.status === 'lost'
                        ? 'GAME OVER'
                        : '1 PLAYER / READY'
                }}</span>
                <h1>
                  {{
                    state.status === 'paused'
                      ? '稍作休整'
                      : state.status === 'won'
                        ? '任务完成'
                        : state.status === 'lost'
                          ? '再战一局'
                          : state.title
                  }}
                </h1>
                <p v-if="state.error">{{ state.error }}</p>
                <p v-else>
                  {{ state.description }}<br />{{
                    state.assisted ? '辅助模式已开启 · 独立记录' : '经典单人战役 · 已自动保存进度'
                  }}
                </p>
                <button
                  v-if="['ready', 'paused'].includes(state.status)"
                  class="primary"
                  data-action="start"
                  :disabled="!state.loaded"
                  @click="start"
                >
                  {{
                    !state.loaded
                      ? '资源载入中…'
                      : state.status === 'paused'
                        ? '继续战斗'
                        : '开始战斗'
                  }}</button
                ><button
                  v-else-if="state.status === 'won' && state.level < state.count"
                  class="primary"
                  data-action="next"
                  @click="session.next"
                >
                  下一关 →</button
                ><button v-else class="primary" data-action="retry" @click="session.retry">
                  重新出发</button
                ><small>{{
                  mobile
                    ? '开始后自动进入横屏布局；左侧摇杆移动，右侧按钮可同时按住。'
                    : tank
                      ? 'WASD 移动 · J / Space 开火 · F 全屏 · C 作弊'
                      : 'WASD 移动 / 瞄准 · J 开火 · K / Space 跳跃 · F 全屏'
                }}</small>
              </div>
            </div>
          </div>
          <div class="readout">
            <div>
              <span>1P SCORE</span
              ><strong id="score">{{ String(state.score).padStart(6, '0') }}</strong>
            </div>
            <div>
              <span>REST / 剩余生命</span><strong id="lives">{{ state.lives }}</strong>
            </div>
            <div>
              <span>STAGE</span
              ><strong id="stage"
                >{{ String(state.level).padStart(2, '0') }} / {{ state.count }}</strong
              >
            </div>
            <div>
              <span>WEAPON</span><strong id="weapon">{{ state.weapon }}</strong>
            </div>
          </div>
          <div class="mission">
            <span id="objective">{{ state.objective }}</span
            ><span id="load-status" role="status">{{
              state.loaded ? '资源就绪' : '资源载入中'
            }}</span>
          </div>
        </section>
        <aside class="sidebar">
          <section class="panel">
            <h2>单人战役 <small>1 PLAYER</small></h2>
            <p>
              {{
                tank
                  ? '35 关经典布局，四种敌军、六种道具。每关歼灭 20 辆敌军，保护基地。'
                  : '8 大区域，横版推进、基地突入与纵向攀登。灵活移动，摧毁关底首领。'
              }}
            </p>
            <button class="level-button" data-action="levels" @click="session.open('levels')">
              选择关卡 ↗</button
            ><label for="mode-select">作战模式</label
            ><select
              id="mode-select"
              aria-label="选择作战模式"
              :value="state.mode"
              @change="session.requestFresh(state.level, $event.target.value)"
            >
              <option v-for="mode in engine?.MODES || []" :key="mode[0]" :value="mode[0]">
                {{ mode[1] }}
              </option>
            </select>
            <p class="mini-status" id="progress">
              {{ state.progress }} / {{ state.count }} 已完成{{ state.assisted ? ' · 辅助局' : '' }}
            </p>
          </section>
          <section class="panel">
            <h2>操作备忘</h2>
            <div class="keyrow"><span>移动 / 瞄准</span><b>WASD / ↑↓←→</b></div>
            <div class="keyrow"><span>持续开火</span><b>J / Z</b></div>
            <div v-if="!tank" class="keyrow"><span>跳跃</span><b>K / Space</b></div>
            <div class="keyrow"><span>暂停 / 全屏</span><b>P / F</b></div>
            <p class="note">切换窗口自动暂停；手机版采用悬浮摇杆，可同时移动、开火和跳跃。</p>
          </section>
        </aside>
      </main>
      <footer class="footer">
        <span>FISH'S PLAYGROUND · VUE 3</span><a href="./assets/credits.html">素材来源</a
        ><a href="/games/">返回大厅 ↗</a>
      </footer>
    </div>
    <template v-if="mobile"
      ><TouchStick
        :rotated="full.rotated.value"
        :four-way="tank"
        :disabled="state.status !== 'running'"
        @change="session.stick" /><TouchAction
        action="fire"
        label="开火"
        :disabled="state.status !== 'running'"
        @change="session.touch('fire', $event)" /><TouchAction
        v-if="!tank"
        action="jump"
        label="跳跃"
        small
        :disabled="state.status !== 'running'"
        @change="session.touch('jump', $event)"
    /></template>
    <div v-if="notice" id="toast" class="toast" role="status">{{ notice }}</div>
    <GameModal v-if="dialog" :id="dialog + '-dialog'" :title="modalTitle" @close="session.close">
      <template v-if="dialog === 'levels'"
        ><p>
          {{ state.count }} 关均可选择，{{
            state.assisted ? '辅助局' : '普通局'
          }}完成记录保存在本机。
        </p>
        <div id="level-grid" class="level-grid">
          <button
            v-for="n in state.count"
            :key="n"
            :data-level="n"
            :class="{ selected: n === state.level, completed: state.records[n] }"
            @click="session.selectLevel(n)"
          >
            {{ String(n).padStart(2, '0') }} {{ state.records[n] ? '✓' : '' }}
          </button>
        </div></template
      >
      <template v-else-if="dialog === 'cheats'"
        ><p>辅助记录与普通记录独立；本局曾启用辅助后，仍计入辅助局。</p>
        <div id="cheat-options" class="cheat-options">
          <label
            v-for="option in engine?.CHEAT_OPTIONS || []"
            :key="option.key"
            class="cheat-option"
            ><input
              type="checkbox"
              :data-cheat="option.key"
              :checked="state.cheats[option.key]"
              @change="session.cheat(option.key, $event.target.checked)"
            /><span
              ><strong>{{ option.name || option.label }}</strong
              ><small>{{ option.description }}</small></span
            ></label
          >
        </div>
        <button v-if="tank" data-action="spawn-powerup" class="level-button" @click="session.spawn">
          随机生成一个道具
        </button>
        <div class="dialog-actions">
          <button data-action="reset-cheats" @click="session.resetCheats">关闭全部辅助</button
          ><button class="primary" data-close="cheats-dialog" @click="session.close">
            返回战斗
          </button>
        </div></template
      >
      <template v-else-if="dialog === 'confirm'"
        ><p>当前战斗将重新开始，已完成关卡与最高分保留。</p>
        <div class="dialog-actions">
          <button @click="session.close">保留本局</button
          ><button class="primary" data-action="confirm" @click="session.confirm">重新部署</button>
        </div></template
      >
      <template v-else
        ><p>
          {{
            tank
              ? '守住老鹰基地；星星升级火力，手雷清场，头盔提供短暂无敌。'
              : '移动躲避敌人，持续开火，跳过障碍。基地关卡中向上瞄准目标。'
          }}
        </p>
        <p>
          手机：左侧任意位置按下并拖动摇杆，右侧开火{{
            tank ? '' : '与跳跃'
          }}可多指同时操作。点击“横屏全屏”进入沉浸模式，竖握手机也会自动旋转画面。
        </p>
        <p>
          键盘：WASD / 方向键移动，J 开火{{ tank ? '，Space 开火' : '，K / Space 跳跃' }}；P 暂停，F
          全屏，C 辅助设置。
        </p>
        <button class="primary" @click="session.close">准备好了</button></template
      >
    </GameModal>
  </div>
</template>
<style>
.classic-shell {
  position: relative;
  min-height: 100dvh;
}
.classic-shell .cabinet {
  --full-width: var(--field-width);
}
.classic-shell .mobile-only {
  display: none;
}
.classic-shell .level-grid button.selected {
  border-color: var(--accent);
}
.classic-shell .level-grid button.completed {
  color: var(--accent);
}
.classic-shell.play-full {
  min-height: 0 !important;
  position: fixed !important;
  inset: 0;
  width: var(--play-width);
  height: var(--play-height);
  z-index: 100;
  background: #080b0d;
  overflow: hidden;
}
.classic-shell.play-full.virtual-landscape {
  inset: auto;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center;
}
body.immersive .classic-shell.play-full .shell {
  width: 100%;
  height: 100%;
  max-width: none;
  padding: 6px 12px !important;
}
.classic-shell.play-full .topbar,
.classic-shell.play-full .heading,
.classic-shell.play-full .sidebar,
.classic-shell.play-full .readout,
.classic-shell.play-full .mission,
.classic-shell.play-full .footer {
  display: none !important;
}
.classic-shell.play-full .layout {
  display: block;
  margin: 0 !important;
}
.classic-shell.play-full .statusbar {
  height: 30px;
  margin: 0 0 3px;
  font-size: 10px;
}
.classic-shell.play-full .statusbar button {
  padding: 4px 9px;
  font-size: 10px;
}
.classic-shell.play-full .cabinet {
  width: var(--field-width) !important;
  max-width: none !important;
  border-width: 3px;
  margin: 0 auto !important;
  box-shadow: 0 0 45px #45636120;
}
.classic-shell.play-full .overlay-content {
  padding: 10px 16px !important;
}
.classic-shell.play-full .overlay h1 {
  font-size: clamp(24px, 5vh, 40px) !important;
  margin: 8px 0;
}
.classic-shell.play-full .overlay p {
  font-size: 10px;
  line-height: 1.7;
}
.classic-shell.play-full .overlay small {
  margin-top: 10px;
}
.classic-shell.play-full .toast {
  position: absolute;
  bottom: 15px;
}
.classic-shell:not(.play-full) > .game-modal-backdrop {
  position: fixed;
}
.classic-shell.play-full .floating-stick-zone {
  position: absolute !important;
}
.classic-shell.play-full .floating-action {
  bottom: 30px !important;
}
body[data-platform='mobile'] .classic-shell:not(.play-full) {
  padding-bottom: 180px;
}
body[data-platform='mobile'] .classic-shell:not(.play-full) .cabinet {
  max-width: min(100%, calc((100dvh - 260px) * var(--ratio)));
}
body.immersive {
  overflow: hidden;
  overscroll-behavior: none;
}
</style>
