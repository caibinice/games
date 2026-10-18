<script setup>
import { ref, shallowReactive, computed, onMounted, onBeforeUnmount } from 'vue';
import * as E from '../../../games/racer/public/engine.mjs';
import { createAudio } from '../../../games/racer/public/audio.mjs';
import { useLandscapeFullscreen } from '../composables/useLandscapeFullscreen.mjs';
import RacerControls from '../components/RacerControls.vue';
import GameModal from '../components/GameModal.vue';
const props = defineProps({ platform: String }),
  mobile = props.platform === 'mobile',
  canvas = ref(),
  full = useLandscapeFullscreen(mobile),
  dialog = ref(''),
  notice = ref('');
const key = E.STORAGE + ':' + props.platform + ':v1';
let stored = {};
try {
  stored = JSON.parse(localStorage.getItem(key) || '{}') || {};
} catch {}
let game = E.restore(stored.game, stored.cheats) || E.newGame({ cheats: stored.cheats }),
  scene,
  audio,
  frame,
  last = 0,
  accumulator = 0,
  hudAt = 0,
  toastTimer,
  pendingInputAt = 0,
  inputSequence = 0,
  runEpoch = 0,
  startRequest = 0,
  disposed = false;
const pendingFx = [];
const records = ref(
    Object.fromEntries(
      Object.entries(
        stored.records && typeof stored.records === 'object' ? stored.records : {},
      ).filter(([id, done]) => Number.isInteger(+id) && +id >= 1 && +id <= 30 && done === true),
    ),
  ),
  best = ref(Number.isFinite(stored.best) ? Math.max(0, stored.best) : 0),
  assistedBest = ref(Number.isFinite(stored.assistedBest) ? Math.max(0, stored.assistedBest) : 0);
const state = shallowReactive({
  status: 'ready',
  level: game.level,
  mode: game.mode,
  loaded: false,
  starting: false,
  error: '',
  speed: 0,
  score: 0,
  distance: 0,
  energy: 100,
  hp: E.MAX_HP,
  repairCoins: 0,
  cheats: { ...game.cheats },
  assisted: game.assisted,
  jet: 0,
  cooldown: 0,
  combo: 0,
  coins: 0,
  nitro: false,
  boost: 0,
  effects: { reverse: 0, fullSpeed: 0, ghost: 0 },
  section: '',
  color: ['#5bb9c8', '#ef764f', '#d9e2e4'].includes(stored.color) ? stored.color : '#5bb9c8',
  sound: stored.sound !== false,
  music: stored.music !== false,
});
const info = computed(() => E.levelInfo(state.level)),
  progress = computed(() => Math.min(100, (state.distance / info.value.distance) * 100));
const activeEffects = computed(() =>
  ['reverse', 'fullSpeed', 'ghost'].filter((k) => state.effects[k] > 0),
);
const style = computed(() => ({
  '--play-width': full.viewport.value.width + 'px',
  '--play-height': full.viewport.value.height + 'px',
}));
const badge = computed(() =>
  state.cooldown > 0
    ? '喷气 CD ' + state.cooldown.toFixed(1) + 's'
    : state.energy < 35
      ? '喷气能量不足'
      : '喷气已就绪 · Space',
);
function clear() {
  pendingFx.length = 0;
}
function save() {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        game: E.serialize(game),
        records: records.value,
        best: best.value,
        assistedBest: assistedBest.value,
        cheats: state.cheats,
        color: state.color,
        sound: state.sound,
        music: state.music,
      }),
    );
  } catch {}
}
function sync() {
  Object.assign(state, {
    status: game.status,
    level: game.level,
    mode: game.mode,
    speed: game.status === 'ready' ? 0 : Math.round(game.speed * 3.6),
    score: E.totalScore(game),
    distance: Math.floor(game.distance),
    energy: game.energy,
    hp: game.hp,
    repairCoins: game.repairCoins,
    cheats: { ...game.cheats },
    assisted: game.assisted,
    jet: game.jet,
    cooldown: game.cooldown,
    combo: game.combo,
    coins: game.coins,
    nitro: game.nitroEnabled,
    boost: game.boost,
    effects: { ...game.effects },
    section: game.segments.find((s) => s.end >= game.distance)?.name || info.value.routeName,
  });
  if (canvas.value)
    Object.assign(canvas.value.dataset, {
      status: game.status,
      level: game.level,
      x: game.x,
      lane: game.lane,
      height: game.height,
      roll: game.roll,
      distance: game.distance,
      hp: game.hp,
      infiniteEnergy: String(game.cheats.infiniteEnergy),
      infiniteDurability: String(game.cheats.infiniteDurability),
      assisted: String(game.assisted),
      cooldown: game.cooldown,
      energy: game.energy,
      nitro: String(game.nitroEnabled),
      boost: game.boost,
      reverse: game.effects.reverse,
      fullSpeed: game.effects.fullSpeed,
      ghost: game.effects.ghost,
      music: String(state.music),
      musicPlaying: String(audio?.getState().musicPlaying || false),
      musicTime: audio?.getState().musicTime || 0,
    });
}
function toast(text) {
  notice.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (notice.value = ''), 1500);
}
function events() {
  const received = game.events;
  game.events = [];
  pendingFx.push(...received);
  for (const e of received) {
    audio?.play(e.type, e);
    if (e.type === 'jet') toast('冷气喷流 · 腾空侧滚');
    if (e.type === 'clear' && !mobile)
      toast((e.ghost ? '隐身穿越 +' : '空中翻越 +') + (150 + game.combo * 15));
    if (e.type === 'near' && !mobile) toast('惊险擦过 +80');
    if (e.type === 'hit') toast('车身受损 · 小心变道');
    if (e.type === 'repair') toast('耐久恢复 +' + e.amount);
    if (e.type === 'pickup')
      toast(
        E.ITEMS[e.item].name +
          ' · ' +
          (E.ITEMS[e.item].duration
            ? E.ITEMS[e.item].duration + '秒'
            : E.ITEMS[e.item].description),
      );
    if (e.type === 'effectEnd') toast(E.ITEMS[e.item].name + '结束');
    if (e.type === 'nitro') toast(e.enabled ? '氮气已开启 · 再点关闭' : '氮气已关闭');
    if (e.type === 'empty') toast('能量耗尽，氮气已自动关闭');
    if (['won', 'lost'].includes(e.type)) {
      if (game.assisted) assistedBest.value = Math.max(assistedBest.value, E.totalScore(game));
      else {
        best.value = Math.max(best.value, E.totalScore(game));
        if (e.type === 'won') records.value = { ...records.value, [game.level]: true };
      }
      audio?.setRunning(false);
      clear();
      sync();
      save();
    }
  }
}
function loop(now) {
  if (disposed) return;
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (game.status === 'running') {
    accumulator += dt;
    while (accumulator >= 1 / 60 && game.status === 'running') {
      E.step(game, 1 / 60);
      events();
      accumulator -= 1 / 60;
    }
  }
  game.events = pendingFx.splice(0);
  scene?.update(game, now, accumulator);
  if (pendingInputAt && canvas.value) {
    canvas.value.dataset.inputRenderMs = Math.max(0, performance.now() - pendingInputAt);
    canvas.value.dataset.inputSequence = ++inputSequence;
    pendingInputAt = 0;
  }
  if (now - hudAt > 60) {
    sync();
    hudAt = now;
  }
  frame = requestAnimationFrame(loop);
}
async function start() {
  if (!state.loaded || state.starting || game.status === 'running') return;
  const request = ++startRequest;
  state.starting = true;
  try {
    // Settle fullscreen, audio hardware and the resized GPU buffer before the race clock starts.
    const fullscreenReady = mobile ? full.enter() : Promise.resolve();
    await Promise.all([fullscreenReady, audio.unlock()]);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    if (disposed || request !== startRequest || dialog.value) return;
    clear();
    E.start(game);
    canvas.value.dataset.runEpoch = ++runEpoch;
    audio.setRunning(true);
    last = performance.now();
    accumulator = 0;
    sync();
    save();
    canvas.value.focus({ preventScroll: true });
  } finally {
    state.starting = false;
  }
}
function pause() {
  startRequest++;
  E.pause(game);
  audio?.setRunning(false);
  clear();
  sync();
  save();
}
function togglePause() {
  if (game.status === 'paused') start();
  else pause();
}
function fresh(level = game.level, mode = game.mode) {
  pause();
  game = E.newGame({ level, mode, seed: Date.now(), cheats: state.cheats });
  sync();
  save();
}
function open(name) {
  pause();
  dialog.value = name;
}
function chooseLevel(n) {
  fresh(n, 'campaign');
  dialog.value = '';
}
function cheat(name, checked) {
  E.setCheats(game, { ...state.cheats, [name]: checked });
  sync();
  save();
}
function contextLost(e) {
  e.preventDefault();
  pause();
  state.loaded = false;
  state.error = '图形正在恢复，游戏已暂停';
}
function contextRestored() {
  state.loaded = true;
  state.error = '';
  toast('画面已恢复，点击继续');
}
function lane(delta, stamp = performance.now()) {
  if (game.status !== 'running') return;
  if (E.changeLane(game, delta)) pendingInputAt = stamp;
  sync();
}
function jet() {
  if (game.status !== 'running') return;
  const reason = E.jetBlockReason(game);
  if (reason) {
    toast(
      reason === 'energy'
        ? '喷气需要 35% 能量'
        : reason === 'airborne'
          ? '腾空中 · 落地后再起跳'
          : '喷气冷却还剩 ' + game.cooldown.toFixed(1) + ' 秒',
    );
    return;
  }
  E.activateJet(game);
  events();
  sync();
}
function boost() {
  if (game.status !== 'running') return;
  const result = E.toggleBoost(game);
  if (result === 'locked')
    toast('全速道具锁定 ' + game.effects.fullSpeed.toFixed(1) + ' 秒 · 免费加速');
  else if (result === 'energy') toast('能量不足，稍后再开启氮气');
  events();
  sync();
}
function color(c) {
  state.color = c;
  scene?.setColor(c);
  save();
}
function sound() {
  state.sound = !state.sound;
  audio?.setEnabled(state.sound);
  if (state.sound) audio?.unlock();
  save();
}
function music() {
  state.music = !state.music;
  audio?.unlock();
  audio?.setMusicEnabled(state.music);
  toast(state.music ? '♫ Fever Stadium · EUROBEAT / 165 BPM' : '背景音乐已关闭');
  save();
  sync();
}
const keys = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jet',
  ShiftLeft: 'boost',
  ShiftRight: 'boost',
};
function keydown(e) {
  if (
    dialog.value ||
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
  )
    return;
  if (e.repeat) return;
  if (e.target.tagName === 'BUTTON' && ['Space', 'Enter'].includes(e.code)) return;
  if (keys[e.code]) {
    e.preventDefault();
    const action = keys[e.code];
    if (action === 'left' || action === 'right') lane(action === 'left' ? -1 : 1);
    else if (action === 'jet') jet();
    else boost();
  }
  if (e.code === 'Enter') start();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyF') {
    e.preventDefault();
    void full.toggle();
  }
  if (e.code === 'Escape') {
    if (full.active.value) void full.exit();
    else pause();
  }
}
function keyup() {}
function visibility() {
  if (document.hidden) pause();
}
onMounted(async () => {
  document.addEventListener('keydown', keydown);
  document.addEventListener('keyup', keyup);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', pause);
  window.addEventListener('pagehide', pause);
  try {
    const m = await import('../../../games/racer/public/scene.mjs');
    if (disposed) return;
    const result = await m.createScene(canvas.value, { mobile });
    if (disposed) {
      result.dispose();
      return;
    }
    scene = result;
    scene.setColor(state.color);
    audio = createAudio();
    audio.setEnabled(state.sound);
    audio.setMusicEnabled(state.music);
    state.loaded = true;
    sync();
    last = performance.now();
    frame = requestAnimationFrame(loop);
  } catch (e) {
    state.error = '3D 场景载入失败：' + e.message;
    console.error(e);
  }
});
onBeforeUnmount(() => {
  disposed = true;
  pause();
  cancelAnimationFrame(frame);
  clearTimeout(toastTimer);
  audio?.dispose();
  scene?.dispose();
  document.removeEventListener('keydown', keydown);
  document.removeEventListener('keyup', keyup);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('blur', pause);
  window.removeEventListener('pagehide', pause);
});
</script>
<template>
  <main
    class="racer-shell"
    :class="{
      'play-full': full.active.value,
      'virtual-landscape': full.rotated.value,
      'is-mobile': mobile,
      compact: mobile && full.viewport.value.width < 700,
    }"
    :style="style"
  >
    <header class="racer-header">
      <a href="/games/" class="racer-brand"
        ><span class="brand-slash">//</span> JET<span> / </span>R <small>喷气飞车 3D</small></a
      >
      <nav>
        <span class="edition">SINGLE PLAYER / VOL. 01</span
        ><a :href="mobile ? './pc.html' : './mobile.html'">{{ mobile ? '电脑版' : '手机版' }} ↗</a
        ><button aria-label="音效开关" @click="sound">
          {{ state.sound ? '音效开' : '音效关' }}</button
        ><button aria-label="背景音乐开关" :aria-pressed="state.music" @click="music">
          {{ state.music ? '音乐开' : '音乐关' }}</button
        ><button @click="open('help')">操作指南</button>
      </nav>
    </header>
    <section class="racer-title">
      <div>
        <span class="racer-kicker">THE ROAD IS ONLY THE BEGINNING</span>
        <h1>地面之上，<em>还有自由。</em></h1>
      </div>
      <p>穿越车流，掠过六种天际。<br />用一次喷气侧滚，越过眼前的极限。</p>
    </section>
    <div class="racer-workspace">
      <section class="race-viewport" aria-label="3D 赛车游戏">
        <canvas
          ref="canvas"
          id="racer-canvas"
          tabindex="0"
          aria-label="喷气飞车 3D 赛道"
          @webglcontextlost="contextLost"
          @webglcontextrestored="contextRestored"
        ></canvas>
        <div class="race-vignette"></div>
        <div class="race-top-hud">
          <div class="track-info">
            <span>ROUTE {{ String(state.level).padStart(2, '0') }} / 30</span
            ><strong>{{ info.name }}</strong
            ><small class="track-section">{{ state.section || info.routeName }}</small>
            <div class="track-progress"><i :style="{ width: progress + '%' }"></i></div>
          </div>
          <div class="race-score">
            <small>SCORE</small><strong>{{ String(state.score).padStart(6, '0') }}</strong
            ><span v-if="state.combo > 1">COMBO × {{ state.combo }}</span>
          </div>
          <div class="race-tools">
            <button
              data-action="music"
              aria-label="赛道背景音乐开关"
              :aria-pressed="state.music"
              @click="music"
            >
              ♫{{ state.music ? '开' : '关' }}
            </button>
            <button
              data-action="cheats"
              aria-label="作弊与辅助"
              :aria-pressed="state.assisted"
              @click="open('cheats')"
            >
              作弊
            </button>
            <button data-action="levels" aria-label="选择关卡" @click="open('levels')">关卡</button
            ><button id="fullscreen-button" :aria-pressed="full.active.value" @click="full.toggle">
              {{ full.active.value ? '退出' : mobile ? '横屏全屏' : '⛶ 全屏' }}</button
            ><button data-action="pause" @click="togglePause">
              {{ state.status === 'paused' ? '继续' : '暂停' }}
            </button>
          </div>
        </div>
        <div class="durability-hud" :class="{ assisted: state.assisted }">
          <span
            >耐久 <b>{{ state.cheats.infiniteDurability ? '∞' : state.hp + ' / ' + E.MAX_HP }}</b>
            <em v-if="state.assisted">辅助模式</em></span
          >
          <div
            role="progressbar"
            aria-label="车辆耐久度"
            :aria-valuenow="state.hp"
            :aria-valuemax="E.MAX_HP"
            aria-valuemin="0"
          >
            <i
              v-for="n in E.MAX_HP"
              :key="n"
              class="hp-cell"
              :class="{ filled: n <= state.hp }"
            ></i>
          </div>
          <small>{{
            state.cheats.infiniteDurability
              ? '无限耐久已开启'
              : '金币修复 ' + state.repairCoins + ' / ' + E.COINS_PER_REPAIR
          }}</small>
        </div>
        <div class="race-effects" aria-label="当前道具效果">
          <span
            v-for="effect in activeEffects"
            :key="effect"
            :data-effect="effect"
            :style="{ '--effect-color': E.ITEMS[effect].color }"
            ><b>{{ E.ITEMS[effect].icon }}</b
            >{{ E.ITEMS[effect].name }}
            <strong>{{ state.effects[effect].toFixed(1) }}s</strong></span
          >
        </div>
        <div class="race-bottom-hud">
          <div class="speedometer">
            <strong>{{ state.speed }}</strong
            ><span>KM/H</span>
          </div>
          <div class="jet-meter">
            <span :class="{ ready: state.cooldown <= 0 && state.energy >= 35 }"
              >{{ badge }}
              <b>{{
                state.cooldown > 0
                  ? state.cooldown.toFixed(1) + 's'
                  : Math.floor(state.energy) + '%'
              }}</b></span
            >
            <div><i :style="{ width: state.energy + '%' }"></i></div>
            <small
              >{{
                state.mode === 'endless'
                  ? '无尽旅途'
                  : state.distance + ' / ' + info.distance + ' m'
              }}
              · {{ state.coins }} COINS</small
            >
          </div>
        </div>
        <Transition name="race-toast"
          ><div v-if="notice" class="race-notice" role="status">{{ notice }}</div></Transition
        >
        <div v-if="state.status !== 'running'" class="race-overlay">
          <div class="race-menu">
            <span class="racer-kicker">{{
              state.status === 'won'
                ? 'ROUTE COMPLETE'
                : state.status === 'lost'
                  ? 'ONE MORE RUN'
                  : state.status === 'paused'
                    ? 'TAKE A BREATH'
                    : 'COLD GAS / HOT LAP'
            }}</span>
            <h2>
              {{
                state.status === 'won'
                  ? '漂亮，完成穿越。'
                  : state.status === 'lost'
                    ? '下一次，再快一点。'
                    : state.status === 'paused'
                      ? '旅途暂停。'
                      : '让速度，离开地面。'
              }}
            </h2>
            <p v-if="state.error" role="alert">{{ state.error }}</p>
            <p v-else>
              {{
                state.status === 'won'
                  ? '得分 ' + state.score + ' · 剩余耐久 ' + state.hp + ' / ' + E.MAX_HP
                  : state.status === 'lost'
                    ? '得分 ' + state.score + ' · 行驶 ' + state.distance + ' m'
                    : mobile
                      ? '左 / 右点一次换一格 · 氮气点按开关 · 喷气按钮显示冷却'
                      : 'A / D 点按变道 · Space 喷气侧滚 · Shift 切换氮气'
              }}
            </p>
            <div class="race-menu-actions">
              <button
                v-if="['ready', 'paused'].includes(state.status)"
                class="race-primary"
                data-action="start"
                :disabled="!state.loaded || state.starting"
                @click="start"
              >
                {{
                  state.starting
                    ? '正在进入赛道…'
                    : !state.loaded
                      ? '正在准备赛道…'
                      : state.status === 'paused'
                        ? '继续疾驰'
                        : '开始疾驰'
                }}
                <span>↗</span></button
              ><button
                v-else-if="state.status === 'won' && state.level < 30"
                class="race-primary"
                data-action="next"
                @click="fresh(state.level + 1)"
              >
                下一关 ↗</button
              ><button v-else class="race-primary" data-action="retry" @click="fresh()">
                再来一局 ↗</button
              ><button class="race-secondary" @click="open('levels')">选择路线</button>
            </div>
            <small>六格耐久 · 每 5 金币修复 1 格 · 喷气冷却 2.5 秒</small>
          </div>
        </div>
      </section>
      <aside class="racer-garage">
        <div class="garage-number">01 <span>/ YOUR MACHINE</span></div>
        <h2>GT / R <small>PARKING COLLECTION</small></h2>
        <p class="car-spec">停车项目同款车型 · 双端 LOD<br />冷气推进 / 360° 空中侧滚</p>
        <div class="color-options" aria-label="车身颜色">
          <button
            v-for="c in ['#5bb9c8', '#ef764f', '#d9e2e4']"
            :key="c"
            :aria-label="'车身颜色 ' + c"
            :aria-pressed="state.color === c"
            :class="{ selected: state.color === c }"
            :style="{ background: c }"
            @click="color(c)"
          ></button
          ><span>PAINT / 车漆</span>
        </div>
        <div class="garage-stat">
          <span>{{ state.assisted ? '辅助最高分' : '个人最高分' }}</span
          ><strong>{{ (state.assisted ? assistedBest : best).toLocaleString() }}</strong>
        </div>
        <div class="garage-stat">
          <span>已完成路线</span
          ><strong>{{ Object.values(records).filter(Boolean).length }} <small>/ 30</small></strong>
        </div>
        <button
          class="endless-button"
          :class="{ selected: state.mode === 'endless' }"
          @click="fresh(state.level, state.mode === 'endless' ? 'campaign' : 'endless')"
        >
          {{ state.mode === 'endless' ? '切回关卡模式' : '无尽公路模式' }} <span>∞</span>
        </button>
        <p class="garage-note">
          默认六格耐久，每 5 金币修复 1 格，维修道具修复 2 格。喷气冷却 2.5 秒，空中点击不会连跳。
        </p>
        <p class="garage-note">
          ♫ FEVER STADIUM · 165 BPM EUROBEAT<br />音乐与音效可分别开关，全屏内也可切换音乐。
        </p>
        <div class="item-legend">
          <span v-for="(item, type) in E.ITEMS" :key="type" :style="{ '--item-color': item.color }"
            ><b>{{ item.icon }}</b
            >{{ item.name
            }}<small>{{
              item.duration ? item.duration + 's' : type === 'energy' ? '+32%' : '+2 HP'
            }}</small></span
          >
        </div>
      </aside>
    </div>
    <footer class="racer-footer">
      <span>INSPIRED BY THE ARCADE. BUILT FOR THE OPEN ROAD.</span
      ><a href="./assets/credits.html">设计与素材来源 ↗</a><a href="/games/">返回游乐场</a>
    </footer>
    <RacerControls
      v-if="mobile"
      :disabled="state.status !== 'running'"
      :cooldown="state.cooldown"
      :energy="state.energy"
      :airborne="state.jet > 0"
      :nitro="state.nitro"
      :forced="state.effects.fullSpeed"
      :reverse="state.effects.reverse"
      @lane="lane"
      @jet="jet"
      @boost="boost"
    />
    <GameModal
      v-if="dialog"
      :id="dialog + '-dialog'"
      :title="
        dialog === 'levels'
          ? '选择一段旅程'
          : dialog === 'cheats'
            ? '作弊与辅助'
            : '喷气飞车 · 驾驶指南'
      "
      @close="dialog = ''"
    >
      <template v-if="dialog === 'levels'"
        ><p>草原、雪山、森林、城市、郊区、熔岩，30 段难度接近、车阵组合不同的公路。</p>
        <div class="racer-levels">
          <button
            v-for="n in 30"
            :key="n"
            :data-level="n"
            :class="{ selected: n === state.level, completed: records[n] }"
            @click="chooseLevel(n)"
          >
            <small>{{ E.levelInfo(n).name }}</small
            >{{ String(n).padStart(2, '0') }} <span>{{ records[n] ? '✓' : '↗' }}</span>
          </button>
        </div></template
      >
      <template v-else-if="dialog === 'cheats'">
        <p>设置自动保存。开启过辅助的本局单独记录分数，不计入普通通关与最高分。</p>
        <div class="cheat-options">
          <label class="cheat-option"
            ><input
              type="checkbox"
              data-cheat="infiniteEnergy"
              :checked="state.cheats.infiniteEnergy"
              @change="cheat('infiniteEnergy', $event.target.checked)"
            />
            <span
              ><strong>无限喷气 / 氮气</strong
              ><small>能量始终 100%。喷气仍保留 2.5 秒冷却，空中点击不重置跳跃。</small></span
            ></label
          >
          <label class="cheat-option"
            ><input
              type="checkbox"
              data-cheat="infiniteDurability"
              :checked="state.cheats.infiniteDurability"
              @change="cheat('infiniteDurability', $event.target.checked)"
            />
            <span
              ><strong>无限耐久</strong
              ><small>始终六格耐久，碰撞不扣血、不减速，关闭后恢复普通碰撞。</small></span
            ></label
          >
        </div>
        <div class="dialog-actions"><button @click="dialog = ''">返回游戏</button></div>
      </template>
      <template v-else
        ><p>默认 6 格耐久；每 5 枚金币修复 1 格，维修道具修复 2 格，最多 6 格。</p>
        <p>
          <strong>变道：</strong>键盘 A / D 或 ← / →，手机点击左 /
          右按钮。每次点按只换一条车道，不再拖动摇杆。
        </p>
        <p>
          <strong>喷气侧滚：</strong>Space / 右下大按钮。消耗 35% 能量，先上升、完成 360°
          侧滚、自动扶正落地；小车与矮障碍可翻越，限高门从地面穿过，长挂车请左右绕行。按钮显示 2.5
          秒冷却，空中不连跳；冷却 / 缺能量时点击会说明原因。
        </p>
        <p>
          <strong>氮气：</strong>点按 Shift /
          小按钮开启，再点关闭，开启后持续耗能。全速道具生效期间免耗能并锁定加速，结束后自动恢复普通速度。
        </p>
        <div class="help-items">
          <p v-for="(item, type) in E.ITEMS" :key="type">
            <strong>{{ item.icon }} {{ item.name }}：</strong>{{ item.description }}
          </p>
        </div>
        <p>
          F 全屏，P
          暂停。手机开始后自动横屏；浏览器方向锁未开放时，页面会直接旋转布局。切到后台自动暂停。
        </p>
        <p>
          <strong>背景乐：</strong>Fever Stadium · MintoDog，165 BPM Eurobeat；点击开始后播放，暂停
          / 后台静音。音乐与音效独立保存开关。
        </p></template
      >
    </GameModal>
  </main>
</template>
