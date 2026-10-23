<script setup>
import { ref, shallowRef, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { createOnlineAudio } from '../online/audio.mjs';
import { RoomClient } from '../online/client.mjs';
import * as A from '../online/adapters.mjs';
import { ContraPrediction } from '../online/prediction.mjs';
import { SnapshotPresentation } from '../online/presentation.mjs';
import { pair, POWERS, remaining } from '../online/duel.mjs';
import { fruitSVG, FRUITS } from '../../../games/lianliankan/public/fruits.mjs';
import TouchStick from '../components/TouchStick.vue';
import TouchAction from '../components/TouchAction.vue';
import { useLandscapeFullscreen } from '../composables/useLandscapeFullscreen.mjs';
const props = defineProps({ id: String });
const titles = { tank: '坦克大战', contra: '魂斗罗', paopaotang: '泡泡堂', lianliankan: '连连看' };
const route = useRoute(),
  mobile = matchMedia('(pointer:coarse)').matches || innerWidth < 760;
const full = useLandscapeFullscreen(mobile),
  canvas = ref(),
  modules = shallowRef(),
  game = shallowRef(),
  room = ref(null);
const name = ref(
  localStorage.getItem('arcade-online-name') || '玩家' + Math.floor(Math.random() * 900 + 100),
);
const code = ref(
    String(route.query.room || '')
      .replace(/\D/g, '')
      .slice(0, 6),
  ),
  level = ref(1),
  slot = ref(0);
const connection = ref('offline'),
  latency = ref(null),
  busy = ref(false),
  error = ref(''),
  loaded = ref(false),
  selected = ref(-1),
  message = ref(''),
  revision = ref(0);
let audio,
  client,
  raf,
  last = 0,
  lastSim = 0,
  ticker = null,
  accumulator = 0,
  sentAt = 0,
  receivedAt = 0,
  seq = 0,
  seenSeq = -1,
  seenEffect = 0,
  finished = false,
  lastInput = '',
  world = null,
  predictor = null,
  inputSeq = 0,
  hudAt = 0,
  diagnosticsAt = 0,
  inputAcks = [null, null],
  toastTimer,
  disposed = false;
const presentation = new SnapshotPresentation(props.id);
const held = new Set(),
  order = [],
  inputs = [{}, {}],
  pulses = [{}, {}],
  inputAt = [0, 0];
const sound = ref(localStorage.getItem('arcade-online-sound') !== 'false'),
  netSounds = [];
function toggleSound() {
  sound.value = !sound.value;
  audio?.setEnabled(sound.value);
  void audio?.unlock();
  localStorage.setItem('arcade-online-sound', String(sound.value));
}
const me = computed(() => room.value?.members.find((p) => p.slot === slot.value));
const connected = computed(() => connection.value === 'connected');
const running = computed(
  () =>
    connected.value &&
    room.value?.phase === 'running' &&
    room.value.members.length === 2 &&
    room.value.members.every((p) => p.connected),
);
const participants = computed(() => {
  revision.value;
  return A.participants(props.id, game.value);
});
const own = computed(() => {
  revision.value;
  return game.value?.players?.[slot.value];
});
const opponent = computed(() => {
  revision.value;
  return game.value?.players?.[1 - slot.value];
});
const frozen = computed(() => own.value && own.value.frozenUntil > game.value.clock);
const time = computed(() => {
  revision.value;
  return Math.max(
    0,
    Math.ceil(((game.value?.duration || 180000) - (game.value?.clock || 0)) / 1000),
  );
});
const maxLevel = computed(() => (props.id === 'tank' ? 35 : props.id === 'contra' ? 8 : 30));
const statusText = computed(
  () =>
    ({
      offline: '尚未加入',
      connecting: '连接中…',
      connected: latency.value == null ? '连接正常' : latency.value + ' ms',
      disconnected: '连接中断，正在重连',
      error: '连接异常',
    })[connection.value],
);
const outcome = computed(() => {
  revision.value;
  const g = game.value;
  if (!g) return '';
  if (props.id === 'lianliankan' && g.status === 'finished')
    return g.winner === -1
      ? '势均力敌 · 平局'
      : g.winner === slot.value
        ? '你赢了！'
        : '对方率先完成';
  if (g.status === 'won') return '双人任务完成！';
  if (g.status === 'lost') return '合作挑战结束';
  return '';
});
function toast(text) {
  message.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (message.value = ''), 2600);
}
async function enter(action) {
  if (busy.value || !loaded.value) return;
  busy.value = true;
  error.value = '';
  try {
    localStorage.setItem('arcade-online-name', name.value);
    client = new RoomClient(network, (state, ms) => {
      connection.value = state;
      if (ms != null) latency.value = ms;
      if (state === 'disconnected') clearInput();
    });
    const ticket = await client.enter({
      action,
      game: props.id,
      name: name.value,
      code: code.value,
      level: level.value,
    });
    room.value = ticket.room;
    slot.value = ticket.slot;
    code.value = room.value.code;
  } catch (e) {
    error.value = e.message;
    client?.close();
    connection.value = 'offline';
  } finally {
    busy.value = false;
  }
}
function network(m) {
  if (disposed) return;
  if (m.type === 'welcome') {
    room.value = m.room;
    slot.value = m.slot;
  }
  if (m.type === 'room') {
    audio?.setRunning(m.room.phase === 'running');
    room.value = m.room;
    if (m.room.phase !== 'running') clearInput();
    if (m.room.phase !== 'running') {
      ticker?.postMessage(false);
      predictor?.reset();
      presentation.reset();
      inputAcks = [null, null];
      diagnosticsAt = 0;
      diagnose(performance.now());
    }
  }
  if (m.type === 'closed') {
    toast(m.message);
    leave(false);
  }
  if (m.type === 'error') {
    error.value = m.message;
    if (!connected.value) {
      client?.close();
      room.value = null;
      connection.value = 'offline';
    }
  }
  if (m.type === 'start') {
    room.value = m.room;
    audio?.setScene?.(m.room.level, 'field');
    audio?.setRunning(true);
    world = A.createGame(props.id, modules.value, m.room);
    game.value = world;
    selected.value = -1;
    last = performance.now();
    lastSim = last;
    ticker?.postMessage(true);
    accumulator = 0;
    sentAt = 0;
    receivedAt = performance.now();
    seq = 0;
    seenSeq = -1;
    seenEffect = 0;
    finished = false;
    inputSeq = 0;
    inputAcks = [null, null];
    presentation.reset();
    clearInput();
    predictor =
      props.id === 'contra' && slot.value === 1 ? new ContraPrediction(modules.value.engine) : null;
    predictor?.reconcile(world, null, performance.now());
    revision.value++;
  }
  if (m.type === 'resume') {
    audio?.setRunning(true);
    room.value = m.room;
    last = performance.now();
    lastSim = last;
    receivedAt = last;
    ticker?.postMessage(true);
    accumulator = 0;
    clearInput();
    predictor?.reconcile(world, null, performance.now());
  }
  if (m.type === 'input' && slot.value === 0 && [0, 1].includes(m.slot)) {
    const incoming = cleanCommand(m.input);
    for (const d of ['left', 'right', 'up', 'down'])
      if (incoming[d] && !inputs[m.slot][d]) pulses[m.slot].movement = incoming.direction || d;
    for (const key of ['fire', 'jump', 'bomb', 'needle'])
      if (m.input[key] === true && !inputs[m.slot][key]) pulses[m.slot][key] = true;
    inputs[m.slot] = incoming;
    inputAt[m.slot] = performance.now();
    if (Number.isFinite(m.input.at) && Number.isSafeInteger(m.input.seq))
      inputAcks[m.slot] = { seq: m.input.seq, at: m.input.at, clock: world?.clock || 0 };
  }
  if (
    m.type === 'action' &&
    slot.value === 0 &&
    props.id === 'lianliankan' &&
    m.action?.kind === 'pair'
  )
    playPair(m.slot, m.action.a, m.action.b);
  if (m.type === 'frame' && slot.value === 1 && m.round === room.value?.round && m.seq > seenSeq) {
    if (props.id === 'contra' && m.state.netVersion !== 2) predictor = null;
    for (const [index, sound] of (m.state.netSounds || []).entries()) {
      if (m.state.soundSlots?.[index] === 1 && predictor) continue;
      audio?.play(sound);
    }
    seenSeq = m.seq;
    const previous = own.value?.board;
    world = A.hydrate(props.id, modules.value, m.state);
    receivedAt = performance.now();
    presentation.receive(world, receivedAt);
    predictor?.reconcile(world, m.state.inputAcks?.[1], receivedAt);
    if (props.id === 'lianliankan') game.value = world;
    showEffect();
    if (selected.value >= 0 && previous?.[selected.value] !== own.value?.board[selected.value])
      selected.value = -1;
    if (props.id === 'lianliankan') revision.value++;
  }
}
function cleanCommand(c = {}) {
  return {
    ...Object.fromEntries(
      ['left', 'right', 'up', 'down', 'fire', 'jump', 'bomb', 'needle'].map((k) => [
        k,
        c[k] === true,
      ]),
    ),
    order: Array.isArray(c.order)
      ? c.order.filter((k) => ['left', 'right', 'up', 'down', 'fire'].includes(k)).slice(-5)
      : [],
    direction: ['left', 'right', 'up', 'down'].includes(c.direction) ? c.direction : null,
  };
}
function command() {
  const result = Object.fromEntries([...held].map((k) => [k, true]));
  result.order = [...order];
  result.direction = [...order].reverse().find((k) => ['left', 'right', 'up', 'down'].includes(k));
  if (props.id === 'paopaotang') {
    result.bomb = held.has('fire');
    result.needle = held.has('jump');
  }
  return cleanCommand(result);
}
function publishInput(force = false) {
  const c = command(),
    signature = JSON.stringify(c),
    now = performance.now();
  if (!force && signature === lastInput && now - (inputAt[slot.value] || 0) < 350) return;
  if (signature !== lastInput) predictor?.input(c, now);
  inputs[slot.value] = c;
  if (
    slot.value === 1 &&
    !client?.send({ type: 'input', input: { ...c, seq: ++inputSeq, at: now } })
  )
    return;
  lastInput = signature;
  inputAt[slot.value] = now;
}
function control(action, down) {
  if (!running.value) return;
  if (held.has(action) === down) return;
  if (down) {
    if (['left', 'right', 'up', 'down'].includes(action)) pulses[slot.value].movement = action;
    predictor?.pulse(action);
    pulses[slot.value][action] = true;
    if (props.id === 'paopaotang')
      pulses[slot.value][action === 'fire' ? 'bomb' : action === 'jump' ? 'needle' : action] = true;
    held.add(action);
    if (!order.includes(action)) order.push(action);
  } else {
    held.delete(action);
    const i = order.indexOf(action);
    if (i >= 0) order.splice(i, 1);
  }
  publishInput(true);
}
function stick(directions) {
  for (const d of ['left', 'right', 'up', 'down']) control(d, !!directions[d]);
}
function clearInput() {
  held.clear();
  order.length = 0;
  inputs[0] = {};
  inputs[1] = {};
  pulses[0] = {};
  pulses[1] = {};
  lastInput = '';
  predictor?.input({}, performance.now());
  if (slot.value === 1)
    client?.send({ type: 'input', input: { at: performance.now(), seq: ++inputSeq } });
}
function keyboard(e) {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.altKey || e.metaKey) return;
  const action = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    KeyJ: 'fire',
    KeyZ: 'fire',
    Space: props.id === 'tank' || props.id === 'paopaotang' ? 'fire' : 'jump',
    KeyK: 'jump',
    KeyX: 'jump',
  }[e.code];
  if (action) {
    e.preventDefault();
    if (!e.repeat) control(action, e.type === 'keydown');
  }
  if (e.type === 'keydown' && e.code === 'KeyF' && !e.repeat) {
    e.preventDefault();
    void full.toggle();
  }
}
function playPair(player, a, b) {
  if (!running.value || !world || !Number.isInteger(a) || !Number.isInteger(b)) return;
  const result = pair(world, player, a, b);
  revision.value++;
  if (result.ok) {
    audio?.play('match');
    netSounds.push('match');
    sentAt = 0;
    showEffect();
  }
}
function showEffect() {
  const effect = world?.effect;
  if (!effect || effect.id === seenEffect) return;
  seenEffect = effect.id;
  if (effect.to === slot.value) selected.value = -1;
  toast((effect.from === slot.value ? '已发动：' : '受到：') + POWERS[effect.type].name);
}
function choose(index) {
  if (!running.value || outcome.value || frozen.value || !own.value.board[index]) return;
  if (selected.value < 0) {
    selected.value = index;
    return;
  }
  const a = selected.value;
  selected.value = -1;
  if (a === index) return;
  if (slot.value === 0) playPair(0, a, index);
  else client.send({ type: 'action', action: { kind: 'pair', a, b: index } });
}
function simulate(now) {
  const dt = Math.max(0, Math.min(250, now - (lastSim || now)));
  lastSim = now;
  if (running.value && world) {
    publishInput();
    if (slot.value === 0) {
      if (now - inputAt[1] > 1200) inputs[1] = {};
      accumulator += dt;
      while (accumulator >= 1000 / 60 && world.status === 'running') {
        A.advance(
          props.id,
          modules.value,
          world,
          1000 / 60,
          inputs.map((c, i) => A.tickCommand(c, pulses[i])),
        );
        for (const ev of world.events || []) {
          const name = ev.type === 'sound' ? ev.name : ev.type;
          audio?.play(name);
          if (netSounds.length < 16)
            netSounds.push(ev.slot == null ? name : { name, slot: ev.slot });
        }
        pulses[0] = {};
        pulses[1] = {};
        accumulator -= 1000 / 60;
      }
      if (now - sentAt >= (props.id === 'lianliankan' ? 100 : 50) && client.canSendFrame()) {
        client.send({
          type: 'frame',
          round: room.value.round,
          seq: ++seq,
          state: {
            ...A.capture(props.id, world),
            netVersion: 2,
            inputAcks,
            soundSlots: netSounds.map((s) => (typeof s === 'object' ? s.slot : -1)),
            netSounds: netSounds.splice(0).map((s) => (typeof s === 'object' ? s.name : s)),
          },
        });
        const interval = props.id === 'lianliankan' ? 100 : 50;
        sentAt = now - ((now - sentAt) % interval);
        if (['won', 'lost', 'finished'].includes(world.status) && !finished) {
          finished = true;
          client.send({ type: 'finish' });
        }
      }
    }
  }
  diagnose(now);
}
function frame(now) {
  if (disposed) return;
  const dt = Math.max(0, Math.min(100, now - (last || now)));
  last = now;
  if (!ticker) simulate(now);
  if (running.value && slot.value === 1 && predictor && now - receivedAt < 500) {
    predictor.advance(dt);
    for (const name of predictor.takeSounds()) audio?.play(name);
  }
  if (world && modules.value) {
    if (now - hudAt >= 100 || game.value?.status !== world.status) {
      game.value = world;
      revision.value++;
      hudAt = now;
    }
    let view = slot.value === 1 && running.value ? presentation.sample(now) || world : world;
    if (slot.value === 1 && running.value && predictor) view = predictor.apply(view);
    A.draw(
      props.id,
      modules.value,
      canvas.value,
      view,
      slot.value === 1 && running.value ? Math.min(80, now - receivedAt) : 0,
    );
    // Lightweight diagnostic of the pose actually painted, without per-frame DOM writes.
    if (canvas.value && props.id === 'contra') canvas.value.__arcadeMotion = view.p2.player;
  }
  raf = requestAnimationFrame(frame);
}
function diagnose(now) {
  if (canvas.value && world && now - diagnosticsAt >= 33) {
    diagnosticsAt = now;
    const g = world,
      ps =
        props.id === 'tank'
          ? g.session.scene?.tanks.filter((t) => t.side === 'player')
          : props.id === 'contra'
            ? [g.player, g.p2.player]
            : g.players;
    Object.assign(canvas.value.dataset, {
      game: props.id,
      slot: slot.value,
      status: g.status,
      roomPhase: room.value?.phase,
      clock: g.clock,
      round: room.value?.round,
      players: JSON.stringify(
        ps?.map((p) => ({ x: p.x, y: p.y, status: p.status, out: p.out })) || [],
      ),
      sequence: slot.value === 0 ? seq : seenSeq,
      netcode: predictor ? 'prediction-replay' : 'interpolation',
    });
  }
}
function ready() {
  void audio?.unlock();
  if (mobile && props.id !== 'lianliankan') void full.enter();
  error.value = '';
  client?.send({ type: 'ready', ready: !me.value?.ready });
}
async function begin() {
  void audio?.unlock();
  if (mobile) void full.enter();
  client?.send({ type: room.value.phase === 'paused' && game.value ? 'resume' : 'start' });
}
function pause() {
  client?.send({ type: 'pause' });
  if (room.value)
    room.value = {
      ...room.value,
      phase: 'paused',
      members: room.value.members.map((p) => ({ ...p, ready: false })),
    };
  ticker?.postMessage(false);
  predictor?.reset();
  presentation.reset();
  clearInput();
  diagnosticsAt = 0;
  diagnose(performance.now());
}
function leave(notify = true) {
  if (notify) client?.close();
  else {
    if (client) {
      client.closed = true;
      client.close();
    }
  }
  client = null;
  audio?.setRunning(false);
  room.value = null;
  game.value = null;
  world = null;
  ticker?.postMessage(false);
  predictor?.reset();
  predictor = null;
  presentation.reset();
  connection.value = 'offline';
  clearInput();
  void full.exit();
}
async function share() {
  const u = new URL(location.href);
  u.search = '';
  u.searchParams.set('room', room.value.code);
  try {
    await navigator.clipboard.writeText(u.href);
    toast('邀请链接已复制，发给朋友即可加入');
  } catch {
    toast('房间号 ' + room.value.code + '，可直接告诉朋友');
  }
}
onMounted(async () => {
  document.addEventListener('keydown', keyboard);
  document.addEventListener('keyup', keyboard);
  window.addEventListener('blur', clearInput);
  try {
    ticker = new Worker(new URL('../online/clock-worker.mjs', import.meta.url), { type: 'module' });
    ticker.onmessage = () => {
      if (!disposed) simulate(performance.now());
    };
    ticker.onerror = () => {
      ticker?.terminate();
      ticker = null;
      lastSim = performance.now();
    };
  } catch {
    ticker = null;
  }
  try {
    modules.value = await A.loadGame(props.id);
    try {
      audio = await createOnlineAudio(props.id);
      audio.setEnabled(sound.value);
    } catch {}
    loaded.value = true;
  } catch {
    error.value = '游戏资源载入失败，请刷新重试';
  }
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  disposed = true;
  audio?.dispose();
  client?.close();
  cancelAnimationFrame(raf);
  ticker?.terminate();
  clearTimeout(toastTimer);
  document.removeEventListener('keydown', keyboard);
  document.removeEventListener('keyup', keyboard);
  window.removeEventListener('blur', clearInput);
});
</script>

<template>
  <main
    class="online-shell"
    :class="{
      'online-full': full.active.value,
      'online-rotated': full.rotated.value,
      'is-duel': id === 'lianliankan',
    }"
    :style="{
      '--online-width': full.viewport.value.width + 'px',
      '--online-height': full.viewport.value.height + 'px',
    }"
  >
    <header class="online-top">
      <a :href="'/games/' + id + '/'" class="online-brand"
        ><b>↗</b><span>{{ titles[id] }}<small>ONLINE ARCADE / 双人联机</small></span></a
      >
      <nav>
        <button data-online="sound" @click="toggleSound">音效{{ sound ? '开' : '关' }}</button>
        <a :href="'/games/' + id + '/'">返回单机</a
        ><button v-if="room" data-online="fullscreen" @click="full.toggle">
          {{ full.active.value ? '退出全屏' : '横屏全屏' }}</button
        ><button v-if="room" data-online="leave" @click="leave">离开房间</button>
      </nav>
    </header>
    <section v-if="!room" class="online-lobby">
      <div class="online-intro">
        <span class="online-kicker">SAME SCREEN. DIFFERENT PLACES.</span>
        <h1>这一局，<br /><em>一起玩。</em></h1>
        <p>
          {{
            id === 'lianliankan'
              ? '同一副棋盘，一人一边。抢先消除，发动道具，给对面一点小麻烦。'
              : '和朋友并肩闯关，或匹配一位新队友。电脑与手机也能一起玩。'
          }}
        </p>
        <div class="online-tags">
          <span>2 PLAYERS</span><span>跨端联机</span
          ><span>{{ id === 'lianliankan' ? '道具对战' : '双人合作' }}</span>
        </div>
      </div>
      <div class="online-connect">
        <div class="online-form-head"><span>01 / JOIN THE GAME</span><b>开始联机</b></div>
        <label
          >你的昵称<input v-model="name" maxlength="16" data-online="name" autocomplete="nickname"
        /></label>
        <label v-if="id !== 'lianliankan'"
          >起始关卡<select v-model.number="level" data-online="level">
            <option v-for="n in maxLevel" :key="n" :value="n">第 {{ n }} 关</option>
          </select></label
        >
        <button
          class="online-primary"
          data-online="match"
          :disabled="busy || !loaded"
          @click="enter('match')"
        >
          {{ !loaded ? '资源准备中…' : '快速匹配 ↗' }}
        </button>
        <button
          class="online-secondary"
          data-online="create"
          :disabled="busy || !loaded"
          @click="enter('create')"
        >
          创建好友房间
        </button>
        <div class="online-join">
          <input
            v-model="code"
            data-online="code"
            inputmode="numeric"
            maxlength="6"
            placeholder="6 位房间号"
            aria-label="房间号"
          /><button
            data-online="join"
            :disabled="busy || !loaded || code.length !== 6"
            @click="enter('join')"
          >
            加入 →
          </button>
        </div>
        <p class="online-error" role="alert">{{ error }}</p>
        <small>无需登录 · 房间最多两人 · 普通单机进度保持独立</small>
      </div>
    </section>
    <template v-else>
      <section class="online-room-head">
        <div>
          <span class="online-kicker">{{
            room.mode === 'match' ? 'MATCHMAKING' : 'FRIEND ROOM'
          }}</span>
          <h2>
            房间 <b data-online="room-code">{{ room.code }}</b
            ><small
              >你是 {{ slot + 1 }}P{{ slot === 0 ? ' / 房主' : ''
              }}{{ id !== 'lianliankan' ? ' · 起点第 ' + room.level + ' 关' : '' }}</small
            >
          </h2>
        </div>
        <div class="online-room-tools">
          <span class="online-network" :class="{ good: connected }">● {{ statusText }}</span
          ><button data-online="share" @click="share">复制邀请</button
          ><button v-if="running" data-online="pause" @click="pause">共同暂停</button>
        </div>
      </section>
      <section class="online-members">
        <div v-for="i in [0, 1]" :key="i" class="online-member" :class="{ own: i === slot }">
          <b>{{ i + 1 }}P</b
          ><span
            >{{ room.members.find((p) => p.slot === i)?.name || '等待玩家加入…'
            }}<small>{{
              !room.members.find((p) => p.slot === i)
                ? '分享房间号，或等待匹配'
                : !room.members.find((p) => p.slot === i).connected
                  ? '暂时离线'
                  : room.members.find((p) => p.slot === i).ready
                    ? '已准备'
                    : '尚未准备'
            }}</small></span
          ><strong v-if="participants[i]"
            >{{ participants[i].value }}<small>{{ participants[i].detail }}</small></strong
          >
        </div>
      </section>
      <div v-if="!running || outcome" class="online-wait" data-online="waiting">
        <h2>
          {{
            outcome ||
            (room.phase === 'paused'
              ? '战斗已暂停'
              : room.members.length < 2
                ? '正在等待另一位玩家'
                : '两位玩家就绪后开始')
          }}
        </h2>
        <p>
          {{
            room.phase === 'paused'
              ? '重新连接并准备后，由房主继续；战场进度保留。'
              : id === 'lianliankan'
                ? '每局 3 分钟，同盘竞速。消除特殊水果可发动干扰。'
                : '1P 和 2P 使用各自设备的同一套按键，一起挑战原有关卡。'
          }}
        </p>
        <div>
          <button
            v-if="
              slot === 0 && game?.status === 'won' && room.level < maxLevel && id !== 'lianliankan'
            "
            class="online-primary"
            data-online="next"
            :disabled="!room.members.every((p) => p.connected && p.ready)"
            @click="client?.send({ type: 'next' })"
          >
            下一关 →
          </button>
          <button
            class="online-secondary"
            data-online="ready"
            :disabled="!connected"
            @click="ready"
          >
            {{ me?.ready ? '取消准备' : '我已准备' }}</button
          ><button
            v-if="slot === 0"
            class="online-primary"
            data-online="start"
            :disabled="
              room.members.length !== 2 ||
              !room.members.every((p) => p.connected && p.ready) ||
              !connected
            "
            @click="begin"
          >
            {{
              room.phase === 'paused' && game
                ? '继续这一局 →'
                : outcome
                  ? '再来一局 →'
                  : '开始双人游戏 →'
            }}
          </button>
        </div>
      </div>
      <section v-if="game" class="online-battle" :class="{ muted: !running || outcome }">
        <template v-if="id === 'lianliankan'">
          <div class="duel-heading">
            <span>同盘对战 · 先清空获胜</span
            ><b data-online="timer"
              >{{ Math.floor(time / 60) }}:{{ String(time % 60).padStart(2, '0') }}</b
            ><span>❄ 冻结 / +4 补牌 / ☁ 迷雾</span>
          </div>
          <div class="duel-boards">
            <div
              v-for="side in [slot, 1 - slot]"
              :key="side"
              class="duel-side"
              :class="{ opponent: side !== slot, fogged: game.players[side].fogUntil > game.clock }"
            >
              <div class="duel-name">
                <b>{{ side === slot ? '你的棋盘' : '对方棋盘' }}</b
                ><span>{{ remaining(game.players[side]) }} 张待消除</span>
              </div>
              <div
                class="duel-grid"
                :data-board="side"
                :class="{ frozen: game.players[side].frozenUntil > game.clock }"
              >
                <button
                  v-for="(value, index) in game.players[side].board"
                  :key="index"
                  :data-cell="index"
                  :data-fruit="value"
                  :disabled="side !== slot || !value || !running || frozen || !!outcome"
                  :aria-label="
                    value
                      ? FRUITS[value - 1].name + (POWERS[value] ? ' · ' + POWERS[value].name : '')
                      : '空格'
                  "
                  :class="{
                    empty: !value,
                    selected: side === slot && index === selected,
                    power: !!POWERS[value],
                  }"
                  :style="{ '--fruit-bg': value ? FRUITS[value - 1].color : 'transparent' }"
                  @click="choose(index)"
                >
                  <span v-if="value" v-html="fruitSVG(value)"></span
                  ><small v-if="POWERS[value]">{{ POWERS[value].icon }}</small>
                </button>
                <div v-if="game.players[side].frozenUntil > game.clock" class="duel-freeze">
                  ❄ {{ ((game.players[side].frozenUntil - game.clock) / 1000).toFixed(1) }} s
                </div>
              </div>
              <small class="duel-effect">{{
                game.players[side].fogUntil > game.clock
                  ? '☁ 迷雾干扰中'
                  : game.players[side].frozenUntil > game.clock
                    ? '❄ 暂时冻结'
                    : side === slot
                      ? '点击两个相同水果，最多两次转弯'
                      : '对手的实时棋盘'
              }}</small>
            </div>
          </div>
        </template>
        <template v-else
          ><div
            class="online-canvas-wrap"
            :class="id"
            :style="id === 'paopaotang' ? { '--arena-ratio': game.cols / game.rows } : {}"
          >
            <canvas
              ref="canvas"
              id="online-canvas"
              tabindex="0"
              :width="256"
              :height="id === 'tank' ? 240 : 224"
              :aria-label="titles[id] + '双人战场'"
            ></canvas>
          </div>
          <p class="online-controls-help">
            {{
              id === 'paopaotang'
                ? 'WASD / 方向键移动 · J / Space 放水泡 · K / X 使用针'
                : id === 'tank'
                  ? 'WASD / 方向键移动 · J / Space 开火'
                  : 'WASD / 方向键移动瞄准 · J 开火 · K / Space 跳跃'
            }}<br />双方都使用这套按键，分别控制自己的角色。房主保持游戏页面在前台。
          </p></template
        >
      </section>
      <p v-if="error" class="online-error" role="alert">{{ error }}</p>
      <template v-if="mobile && game && id !== 'lianliankan'"
        ><TouchStick
          :rotated="full.rotated.value"
          :four-way="id !== 'contra'"
          :disabled="!running || !!outcome"
          @change="stick" /><TouchAction
          action="fire"
          :label="id === 'paopaotang' ? '水泡' : '开火'"
          :disabled="!running || !!outcome"
          @change="control('fire', $event)" /><TouchAction
          v-if="id !== 'tank'"
          action="jump"
          :label="id === 'paopaotang' ? '使用针' : '跳跃'"
          small
          :disabled="!running || !!outcome"
          @change="control('jump', $event)"
      /></template>
    </template>
    <div v-if="message" class="online-toast" role="status">{{ message }}</div>
    <footer class="online-footer">
      <span>FISH'S PLAYGROUND / REALTIME CO-OP</span><a href="/games/">返回游戏大厅 ↗</a>
    </footer>
  </main>
</template>

<style>
.online-shell {
  min-height: 100dvh;
  background: radial-gradient(ellipse at 10% 0%, #24484566, transparent 50%), #0c171d;
  color: #eaf5ef;
  font-family: system-ui, sans-serif;
  padding: 0 max(24px, calc((100vw - 1260px) / 2));
  box-sizing: border-box;
}
.online-shell * {
  box-sizing: border-box;
}
.online-shell a {
  color: inherit;
  text-decoration: none;
}
.online-shell button,
.online-shell input,
.online-shell select {
  font: inherit;
}
.online-shell button {
  cursor: pointer;
  border: 1px solid #76938b70;
  background: #1d343b;
  color: #eaf5ef;
  border-radius: 10px;
  padding: 10px 17px;
  touch-action: manipulation;
}
.online-shell button:disabled {
  opacity: 0.42;
  cursor: default;
}
.online-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 94px;
  border-bottom: 1px solid #7b9b8f26;
  gap: 20px;
}
.online-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 750;
}
.online-brand > b {
  display: grid;
  place-items: center;
  background: #b5e8c6;
  color: #152c26;
  width: 43px;
  height: 43px;
  border-radius: 13px;
  font-size: 30px;
}
.online-brand small {
  display: block;
  font: 10px/2 monospace;
  letter-spacing: 1.4px;
  color: #9caea7;
}
.online-top nav {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
}
.online-top nav > a {
  opacity: 0.65;
}
.online-kicker,
.online-form-head > span {
  font: 11px/2 monospace;
  letter-spacing: 2px;
  color: #92b8ac;
}
.online-lobby {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 12%;
  align-items: center;
  min-height: calc(100dvh - 165px);
  padding: 50px 0 70px;
}
.online-intro h1 {
  font-size: clamp(48px, 6vw, 86px);
  line-height: 1.15;
  letter-spacing: -4px;
  margin: 28px 0;
}
.online-intro em {
  font-style: normal;
  color: #b5e8c6;
}
.online-intro p {
  font-size: 15px;
  line-height: 2;
  color: #a6b9b1;
  max-width: 400px;
}
.online-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 35px;
}
.online-tags span {
  font: 10px/1 monospace;
  letter-spacing: 1px;
  border: 1px solid #698b7d70;
  padding: 10px 13px;
  border-radius: 20px;
  color: #b9d6c9;
}
.online-connect {
  background: linear-gradient(140deg, #25413c8a, #17292d);
  border: 1px solid #728b7e50;
  border-radius: 22px;
  padding: 32px;
  box-shadow: 0 18px 60px #0002;
  display: grid;
  gap: 13px;
}
.online-form-head {
  margin-bottom: 12px;
}
.online-form-head > b {
  display: block;
  font-size: 25px;
  margin-top: 6px;
}
.online-connect label {
  font-size: 12px;
  color: #b4c8bc;
  display: grid;
  gap: 8px;
}
.online-shell input,
.online-shell select {
  width: 100%;
  border: 1px solid #728b7e55;
  background: #0d2023;
  color: #e6f1e9;
  padding: 12px;
  border-radius: 9px;
  min-width: 0;
}
.online-shell .online-primary {
  background: #b5e8c6;
  color: #18342a;
  border-color: #b5e8c6;
  font-weight: 750;
}
.online-shell .online-secondary {
  background: #2c4544;
  color: #d3e8dc;
}
.online-join {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: 5px;
}
.online-connect > small {
  font-size: 10px;
  color: #8ca79b;
  line-height: 1.8;
}
.online-error {
  color: #ffb6a4;
  font-size: 12px;
  line-height: 1.8;
  min-height: 1px;
  margin: 0;
}
.online-room-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
  gap: 14px;
}
.online-room-head h2 {
  margin: 6px 0;
  font-weight: 400;
  font-size: 20px;
}
.online-room-head h2 > b {
  font-family: monospace;
  font-size: 30px;
  letter-spacing: 4px;
  margin-left: 5px;
  color: #d5efcf;
}
.online-room-head h2 small {
  display: inline-block;
  margin-left: 18px;
  font-size: 11px;
  color: #9ab2a5;
}
.online-room-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
}
.online-room-tools button {
  font-size: 11px;
}
.online-network {
  color: #ffb495;
}
.online-network.good {
  color: #a9dbc1;
}
.online-members {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 24px 0;
}
.online-member {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 15px 20px;
  border: 1px solid #6a8b7c50;
  border-radius: 12px;
  background: #14292f;
}
.online-member.own {
  border-color: #9dc7ad80;
}
.online-member > b {
  font: 23px/1 monospace;
  color: #cce4b3;
}
.online-member:nth-child(2) > b {
  color: #8ce2e9;
}
.online-member > span {
  font-size: 14px;
  flex: 1;
}
.online-member small {
  display: block;
  font-size: 10px;
  color: #93aaa0;
  margin-top: 5px;
}
.online-member > strong {
  font-size: 13px;
  text-align: right;
}
.online-wait {
  text-align: center;
  padding: 30px 16px;
  background: #1c3337a8;
  border: 1px solid #8fab9350;
  border-radius: 15px;
  margin: 20px 0;
}
.online-wait h2 {
  font-size: 23px;
  margin: 0 0 12px;
}
.online-wait p {
  font-size: 12px;
  color: #a5bdb0;
  margin-bottom: 23px;
}
.online-wait button {
  margin: 0 6px;
}
.online-battle {
  padding: 12px 0;
}
.online-battle.muted {
  opacity: 0.65;
  pointer-events: none;
}
.online-canvas-wrap {
  margin: auto;
  max-width: 720px;
  display: flex;
  justify-content: center;
}
.online-canvas-wrap canvas {
  display: block;
  width: auto;
  max-width: 100%;
  height: min(600px, calc(100dvh - 365px));
  image-rendering: pixelated;
  border: 7px solid #405b56;
  box-shadow: 0 14px 70px #0007;
  outline: none;
}
.online-canvas-wrap.paopaotang {
  max-width: 800px;
}
.online-canvas-wrap.paopaotang canvas {
  width: min(100%, calc((100dvh - 365px) * var(--arena-ratio, 1.18)));
  height: auto;
  image-rendering: auto;
}
.online-controls-help {
  text-align: center;
  font-size: 11px;
  line-height: 1.9;
  color: #8ea69a;
  margin: 16px 0 32px;
}
.online-footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #7b9b8f26;
  padding: 22px 0;
  font: 10px/1.6 monospace;
  color: #809e90;
  gap: 15px;
}
.online-toast {
  position: fixed;
  z-index: 350;
  left: 50%;
  bottom: 30px;
  transform: translateX(-50%);
  background: #d5efd8;
  color: #173a2c;
  padding: 12px 22px;
  border-radius: 10px;
  font-size: 13px;
  box-shadow: 0 8px 35px #0006;
}
.duel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #9fc2ae;
  margin-bottom: 15px;
}
.duel-heading > b {
  font: 34px/1 monospace;
  color: #def4d1;
}
.duel-boards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 35px;
}
.duel-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
}
.duel-name > span {
  color: #9fb5a7;
  font-size: 11px;
}
.duel-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 5px;
  position: relative;
  padding: 12px;
  background: #162d32;
  border: 1px solid #66846c60;
  border-radius: 13px;
}
.online-shell .duel-grid > button {
  padding: 0;
  aspect-ratio: 1;
  border: 1px solid #fff4;
  background: var(--fruit-bg);
  border-radius: 8px;
  position: relative;
  opacity: 1;
  transition:
    transform 0.12s,
    box-shadow 0.12s;
}
.duel-grid > button > span {
  display: block;
  padding: 3px;
}
.duel-grid svg {
  width: 100%;
  height: 100%;
  display: block;
}
.online-shell .duel-grid > button.empty {
  background: #0d202430;
  border-color: transparent;
}
.online-shell .duel-grid > button.selected {
  box-shadow:
    0 0 0 3px #f6dd87,
    inset 0 0 12px #fbe7a4;
  transform: scale(0.94);
}
.duel-grid button small {
  position: absolute;
  top: -3px;
  right: -3px;
  background: #2d5865;
  color: white;
  border: 1px solid #e7fbdd;
  border-radius: 6px;
  padding: 1px 3px;
  font: 10px/1.3 system-ui;
}
.duel-grid.frozen {
  box-shadow: inset 0 0 60px #67c7e866;
  outline: 2px solid #9de9ee;
}
.duel-freeze {
  position: absolute;
  inset: 0;
  background: #7ac7e64a;
  display: grid;
  place-content: center;
  color: #fff;
  font-size: 36px;
  pointer-events: none;
  border-radius: 13px;
  text-shadow: 0 2px 12px #19627c;
}
.fogged .duel-grid > button > span {
  filter: blur(3px);
  opacity: 0.6;
}
.duel-effect {
  display: block;
  min-height: 30px;
  padding: 10px;
  font-size: 11px;
  color: #9fcdb7;
}
.online-full {
  position: fixed;
  inset: 0;
  width: var(--online-width);
  height: var(--online-height);
  overflow: auto;
  z-index: 180;
  padding: 7px 18px;
  min-height: 0;
}
.online-full.online-rotated {
  inset: auto;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
}
.online-full .online-top {
  min-height: 40px;
}
.online-full .online-brand {
  font-size: 14px;
}
.online-full .online-brand > b {
  width: 28px;
  height: 28px;
  font-size: 20px;
}
.online-full .online-brand small,
.online-full .online-footer,
.online-full .online-controls-help {
  display: none;
}
.online-full .online-room-head {
  margin-top: 7px;
}
.online-full .online-room-head h2 {
  font-size: 12px;
  margin: 0;
}
.online-full .online-room-head h2 > b {
  font-size: 19px;
}
.online-full .online-kicker {
  display: none;
}
.online-full .online-room-tools button,
.online-full .online-top button {
  padding: 4px 8px;
  font-size: 10px;
}
.online-full .online-members {
  margin: 8px 0;
  gap: 10px;
}
.online-full .online-member {
  padding: 5px 12px;
  gap: 8px;
}
.online-full .online-member > b {
  font-size: 16px;
}
.online-full .online-member small {
  display: none;
}
.online-full .online-member > span,
.online-full .online-member > strong {
  font-size: 11px;
}
.online-full .online-battle {
  padding: 0;
}
.online-full .online-canvas-wrap canvas {
  width: auto;
  height: calc(var(--online-height) - 125px);
  max-width: calc(var(--online-width) - 230px);
}
.online-full .online-canvas-wrap.paopaotang canvas {
  width: min(
    calc(var(--online-width) - 240px),
    calc((var(--online-height) - 125px) * var(--arena-ratio, 1.18))
  );
  height: auto;
}
.online-full .floating-stick-zone {
  position: absolute;
}
.online-shell .floating-action {
  border-radius: 50%;
  padding: 0;
  background: radial-gradient(circle at 30% 20%, #94b5c888, #1c314c99);
  border: 3px solid #d0f1ff80;
}
.online-shell .floating-action.pressed {
  background: #c8efffc4;
  color: #102434;
  transform: scale(0.96);
}
.online-shell .floating-action.small {
  border-radius: 50%;
  background: radial-gradient(circle at 20% 20%, #74956d88, #263d3b99);
}
.online-full .floating-action {
  position: absolute;
}
.online-full .online-wait {
  position: absolute;
  z-index: 190;
  left: 25%;
  right: 25%;
  top: 110px;
  padding: 16px;
  box-shadow: 0 10px 50px #0008;
  background: #173139f5;
}
.online-full .online-wait h2 {
  font-size: 17px;
}
.online-full .online-wait p {
  font-size: 10px;
}
.online-full.is-duel .duel-grid {
  max-width: calc(var(--online-height) - 170px);
  margin: auto;
  padding: 5px;
  gap: 3px;
}
.online-full.is-duel .duel-heading {
  margin: 3px 0 5px;
  font-size: 10px;
}
.online-full.is-duel .duel-heading > b {
  font-size: 23px;
}
.online-full.is-duel .duel-name {
  margin-bottom: 5px;
}
.online-full.is-duel .duel-effect {
  font-size: 9px;
  padding: 4px;
}
.online-full.is-duel .duel-boards {
  gap: 20px;
  max-width: 800px;
  margin: auto;
}
@media (max-width: 760px) {
  .online-brand small {
    display: none;
  }
  .online-brand > b {
    width: 32px;
    height: 32px;
    font-size: 24px;
  }
  .online-top nav {
    flex-shrink: 0;
    white-space: nowrap;
  }
  .online-top nav button {
    font-size: 10px;
    white-space: nowrap;
  }

  .online-shell {
    padding: 0 17px;
  }
  .online-top {
    min-height: 78px;
    gap: 8px;
  }
  .online-brand {
    font-size: 16px;
    gap: 8px;
  }
  .online-brand small {
    font-size: 8px;
    letter-spacing: 0.5px;
  }
  .online-top nav {
    gap: 6px;
    font-size: 10px;
  }
  .online-top nav button {
    padding: 7px 6px;
  }
  .online-lobby {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 28px 0 40px;
  }
  .online-intro h1 {
    font-size: 46px;
    letter-spacing: -2px;
    margin: 14px 0;
  }
  .online-intro h1 > br {
    display: none;
  }
  .online-intro p {
    font-size: 12px;
    margin: 0;
  }
  .online-tags {
    margin-top: 17px;
  }
  .online-connect {
    padding: 23px;
  }
  .online-room-head {
    flex-wrap: wrap;
    margin-top: 18px;
  }
  .online-room-head h2 small {
    margin-left: 10px;
  }
  .online-room-tools {
    gap: 9px;
  }
  .online-members {
    gap: 9px;
    margin: 15px 0;
  }
  .online-member {
    padding: 12px 9px;
    gap: 7px;
  }
  .online-member > span {
    font-size: 12px;
  }
  .online-member > strong {
    font-size: 11px;
  }
  .online-member > b {
    font-size: 19px;
  }
  .online-wait {
    padding: 22px 12px;
  }
  .online-wait h2 {
    font-size: 18px;
  }
  .online-wait p {
    line-height: 1.8;
  }
  .duel-boards {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .duel-side.opponent {
    max-width: 220px;
    margin: auto;
    width: 100%;
  }
  .duel-side.opponent .duel-grid {
    padding: 6px;
    gap: 3px;
  }
  .duel-side.opponent .duel-grid > button small {
    display: none;
  }
  .duel-heading {
    font-size: 10px;
    gap: 8px;
  }
  .duel-heading > b {
    font-size: 26px;
  }
  .online-canvas-wrap canvas {
    width: 100%;
  }
  .online-controls-help {
    padding-bottom: 135px;
  }
  .online-full .duel-boards {
    grid-template-columns: 1fr 1fr;
  }
  .online-full .duel-side.opponent {
    max-width: none;
  }
  .online-full .online-room-head {
    flex-wrap: nowrap;
  }
  .online-full .online-top {
    min-height: 35px;
  }
  .online-full .online-brand small {
    display: none;
  }
  .online-full .online-brand > b {
    display: none;
  }
  .online-full .online-wait {
    left: 18%;
    right: 18%;
  }
}
</style>
