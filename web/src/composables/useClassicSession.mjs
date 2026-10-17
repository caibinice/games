import { shallowRef, shallowReactive, ref, onMounted, onBeforeUnmount, markRaw } from 'vue';
const loadModules = (id) =>
  id === 'tank'
    ? Promise.all([
        import('../../../games/tank/public/engine.mjs'),
        import('../../../games/tank/public/renderer.mjs'),
        import('../../../games/tank/public/audio.mjs'),
      ])
    : Promise.all([
        import('../../../games/contra/public/engine.mjs'),
        import('../../../games/contra/public/renderer.mjs'),
        import('../../../games/contra/public/audio.mjs'),
      ]);
export function useClassicSession(id, platform, canvas) {
  const engine = shallowRef(),
    game = shallowRef(),
    dialog = ref(''),
    notice = ref('');
  let renderer,
    assets,
    audio,
    frame,
    last = performance.now(),
    accumulator = 0,
    lastSave = 0,
    lastHUD = '',
    timer,
    pending,
    resumeCheats = false,
    disposed = false;
  const state = shallowReactive({
    status: 'ready',
    level: 1,
    title: id === 'tank' ? '坦克大战' : '魂斗罗',
    count: id === 'tank' ? 35 : 8,
    score: 0,
    lives: 3,
    weapon: '',
    objective: '准备出发',
    phase: 'enter',
    name: 'STAGE 01',
    description: '',
    loaded: false,
    sound: true,
    assisted: false,
    cheats: {},
    records: {},
    best: 0,
    progress: 0,
    mode: 'classic',
    error: '',
  });
  const held = new Map(),
    touches = new Map(),
    taps = new Set();
  let stored = {},
    records = {},
    best = 0,
    assistedRecords = {},
    assistedBest = 0,
    key;
  function toast(text) {
    notice.value = text;
    clearTimeout(timer);
    timer = setTimeout(() => (notice.value = ''), 2200);
  }
  function book() {
    return engine.value.isAssisted(game.value) ? assistedRecords : records;
  }
  function score() {
    if (engine.value.isAssisted(game.value))
      assistedBest = Math.max(assistedBest, game.value.score);
    else best = Math.max(best, game.value.score);
  }
  function clear() {
    held.clear();
    touches.clear();
    taps.clear();
  }
  function command() {
    const order = [...held.values(), ...touches.values(), ...taps],
      active = new Set(order);
    return {
      ...Object.fromEntries(
        ['left', 'right', 'up', 'down', 'fire', 'jump'].map((k) => [k, active.has(k)]),
      ),
      order,
    };
  }
  function save() {
    if (!game.value) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          game: engine.value.serialize(game.value),
          records,
          best,
          assistedRecords,
          assistedBest,
          sound: state.sound,
        }),
      );
    } catch {}
    lastSave = performance.now();
  }
  function sync(force = false) {
    if (!game.value) return;
    const g = game.value,
      e = engine.value,
      s = e.summary(g),
      info = e.levelInfo(g.level),
      telemetry = e.view(g),
      c = canvas.value;
    Object.assign(c.dataset, {
      playerX: telemetry.x,
      playerY: telemetry.y,
      projectiles: telemetry.projectiles,
      clock: g.clock,
      level: g.level,
      status: g.status,
      score: g.score,
      lives: g.lives,
      assisted: String(e.isAssisted(g)),
      cheats: JSON.stringify(g.cheats),
    });
    const signature = JSON.stringify([
      g.status,
      g.level,
      g.score,
      g.lives,
      s,
      g.assisted,
      g.cheats,
      state.sound,
      state.loaded,
    ]);
    if (!force && signature === lastHUD) return;
    lastHUD = signature;
    Object.assign(state, {
      status: g.status,
      level: g.level,
      score: g.score,
      lives: g.cheats.infiniteLives ? '∞' : g.lives,
      weapon: s.weapon,
      objective: (e.isAssisted(g) ? '辅助局 · ' : '') + s.objective,
      phase: s.phase,
      name: info.name,
      description: info.description,
      assisted: e.isAssisted(g),
      cheats: { ...g.cheats },
      records: { ...book() },
      best: e.isAssisted(g) ? assistedBest : best,
      progress: Object.values(book()).filter(Boolean).length,
      mode: g.mode,
    });
    audio?.setScene?.(g.level, s.phase);
  }
  function events() {
    for (const ev of game.value.events || []) {
      if (ev.type === 'sound') audio?.play(ev.name);
      if (ev.type === 'levelclear') book()[ev.level] = true;
      if (ev.type === 'level') toast(`进入第 ${ev.level} 关`);
      if (['won', 'lost'].includes(ev.type)) {
        if (ev.type === 'won') book()[game.value.level] = true;
        score();
        clear();
        audio?.setRunning(false);
        sync(true);
        save();
      }
    }
    score();
  }
  function advance(now) {
    const elapsed = Math.min(100, Math.max(0, now - last));
    last = now;
    if (game.value?.status === 'running') {
      accumulator += elapsed;
      while (accumulator >= 1000 / 60 && game.value.status === 'running') {
        engine.value.step(game.value, 1000 / 60, command());
        taps.clear();
        events();
        accumulator -= 1000 / 60;
      }
    }
  }
  function loop(now) {
    if (disposed) return;
    advance(now);
    if (state.loaded) renderer.draw(canvas.value, game.value, assets);
    sync();
    if (game.value?.status === 'running' && now - lastSave > 4000) save();
    frame = requestAnimationFrame(loop);
  }
  async function begin() {
    if (!state.loaded || !['ready', 'paused'].includes(game.value.status)) return;
    clear();
    await audio.unlock();
    if (disposed) return;
    engine.value.start(game.value);
    last = performance.now();
    accumulator = 0;
    audio.setRunning(true);
    sync(true);
    save();
    canvas.value.focus({ preventScroll: true });
  }
  function pause() {
    if (game.value?.status === 'running') {
      engine.value.pause(game.value);
      clear();
      audio?.setRunning(false);
      sync(true);
      save();
    }
  }
  function togglePause() {
    if (game.value?.status === 'paused') void begin();
    else pause();
  }
  function fresh(level = game.value.level, mode = game.value.mode, carry) {
    clear();
    game.value = markRaw(
      engine.value.newGame({
        platform,
        level,
        mode,
        carry,
        cheats: game.value.cheats,
        assisted: carry?.assisted,
      }),
    );
    last = performance.now();
    accumulator = 0;
    sync(true);
    save();
  }
  function requestFresh(level = game.value.level, mode = game.value.mode) {
    if (['running', 'paused'].includes(game.value.status)) {
      pause();
      pending = () => fresh(level, mode);
      dialog.value = 'confirm';
    } else fresh(level, mode);
  }
  function open(name) {
    if (!game.value) return;
    resumeCheats = name === 'cheats' && game.value.status === 'running';
    pause();
    dialog.value = name;
  }
  function close() {
    const resume = resumeCheats;
    resumeCheats = false;
    dialog.value = '';
    if (resume && game.value.status === 'paused') void begin();
  }
  function selectLevel(n) {
    dialog.value = '';
    if (n !== game.value.level) requestFresh(n);
  }
  function cheat(key, value) {
    engine.value.setCheat(game.value, key, value);
    sync(true);
    save();
  }
  function resetCheats() {
    for (const o of engine.value.CHEAT_OPTIONS) engine.value.setCheat(game.value, o.key, false);
    sync(true);
    save();
  }
  function spawn() {
    game.value.events = [];
    const name = engine.value.spawnRandomPowerUp?.(game.value);
    if (name) {
      events();
      game.value.events = [];
      sync(true);
      save();
      toast(
        '已生成：' +
          {
            tank: '坦克加命',
            star: '星星升级',
            grenade: '手雷',
            timer: '时钟',
            helmet: '头盔',
            shovel: '铁锹',
          }[name],
      );
    } else toast('坦克出生、战斗进行中时可生成道具');
  }
  function sound() {
    state.sound = !state.sound;
    audio?.setEnabled(state.sound);
    if (state.sound) void audio?.unlock();
    sync(true);
    save();
  }
  function touch(action, pressed) {
    if (game.value?.status !== 'running') return;
    if (pressed) {
      touches.set(action, action);
      taps.add(action);
      void audio.unlock();
    } else touches.delete(action);
  }
  function stick(directions) {
    for (const name of ['left', 'right', 'up', 'down']) touch(name, !!directions[name]);
  }
  const directions = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyW: 'up',
    KeyS: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyJ: 'fire',
    KeyZ: 'fire',
    KeyK: 'jump',
    KeyX: 'jump',
    Space: id === 'tank' ? 'fire' : 'jump',
  };
  function keydown(ev) {
    if (
      dialog.value ||
      ev.ctrlKey ||
      ev.altKey ||
      ev.metaKey ||
      /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)
    )
      return;
    if (ev.code === 'KeyC') {
      ev.preventDefault();
      if (!ev.repeat) open('cheats');
      return;
    }
    if (['KeyP'].includes(ev.code)) {
      ev.preventDefault();
      if (!ev.repeat) togglePause();
      return;
    }
    if (ev.code === 'Enter' && ['ready', 'paused'].includes(state.status)) {
      ev.preventDefault();
      if (!ev.repeat) void begin();
      return;
    }
    const action = directions[ev.code];
    if (action && game.value?.status === 'running') {
      ev.preventDefault();
      if (!ev.repeat) {
        advance(performance.now());
        held.set(ev.code, action);
        taps.add(action);
      }
    }
  }
  const keyup = (ev) => held.delete(ev.code),
    leave = () => {
      pause();
      clear();
      save();
    },
    visibility = () => {
      if (document.hidden) leave();
      last = performance.now();
    };
  onMounted(async () => {
    try {
      const [e, r, a] = await loadModules(id);
      if (disposed) return;
      engine.value = markRaw(e);
      state.count = e.LEVEL_COUNT;
      state.title = e.TITLE;
      renderer = r;
      audio = a.createAudio();
      key = `${e.STORAGE}:${platform}:v1`;
      try {
        stored = JSON.parse(localStorage.getItem(key) || '{}') || {};
      } catch {}
      records = stored.records && typeof stored.records === 'object' ? stored.records : {};
      assistedRecords =
        stored.assistedRecords && typeof stored.assistedRecords === 'object'
          ? stored.assistedRecords
          : {};
      best = Number.isFinite(stored.best) ? Math.max(0, stored.best) : 0;
      assistedBest = Number.isFinite(stored.assistedBest) ? Math.max(0, stored.assistedBest) : 0;
      game.value = markRaw(e.restore(stored.game, platform) || e.newGame({ platform }));
      if (game.value.status === 'running') e.pause(game.value);
      state.sound = stored.sound !== false;
      audio.setEnabled(state.sound);
      canvas.value.width = e.WIDTH;
      canvas.value.height = e.HEIGHT;
      document.addEventListener('keydown', keydown);
      document.addEventListener('keyup', keyup);
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('blur', leave);
      window.addEventListener('pagehide', leave);
      sync(true);
      save();
      const loaded = await Promise.all([r.loadAssets(), audio.load()]);
      if (disposed) return;
      assets = loaded[0];
      state.loaded = true;
      sync(true);
      frame = requestAnimationFrame(loop);
    } catch (error) {
      state.error = error.message;
      console.error(error);
    }
  });
  onBeforeUnmount(() => {
    disposed = true;
    leave();
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    audio?.dispose?.();
    audio?.setRunning(false);
    document.removeEventListener('keydown', keydown);
    document.removeEventListener('keyup', keyup);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', leave);
    window.removeEventListener('pagehide', leave);
  });
  return {
    engine,
    game,
    state,
    dialog,
    notice,
    begin,
    pause,
    togglePause,
    requestFresh,
    open,
    close,
    selectLevel,
    cheat,
    resetCheats,
    spawn,
    sound,
    touch,
    stick,
    toast,
    retry: () => fresh(),
    next: () => {
      const g = game.value;
      if (g.status === 'won' && g.level < engine.value.LEVEL_COUNT)
        fresh(g.level + 1, g.mode, {
          lives: g.lives,
          score: g.score,
          weapon: engine.value.summary(g).weapon,
          assisted: engine.value.isAssisted(g),
        });
    },
    confirm: () => {
      dialog.value = '';
      pending?.();
      pending = null;
    },
  };
}
