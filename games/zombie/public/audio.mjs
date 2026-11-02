// Verified client music/action sounds, transcoded locally to Safari-compatible MP3.
export function createAudio(profile) {
  let active = false,
    home = false,
    lastShot = 0,
    disposed = false;
  const base = './assets/client-v1/',
    media = (name) => {
      const a = new Audio(new URL(base + name + '.mp3', import.meta.url));
      a.preload = 'none';
      return a;
    };
  const battle = media('battle'),
    menu = media('home'),
    effects = {},
    uiEffects = {};
  battle.loop = menu.loop = true;
  battle.volume = 0.28;
  menu.volume = 0.24;
  function play(a) {
    if (!disposed) a.play().catch(() => {});
  }
  function refresh() {
    if (active && profile.music) play(battle);
    else battle.pause();
    if (home && !active && profile.music) play(menu);
    else menu.pause();
  }
  function sound(kind) {
    if (!profile.sound || (!active && !['won', 'lost'].includes(kind))) return;
    const now = Date.now();
    if (kind === 'shot' && now - lastShot < 25) return;
    if (kind === 'shot') lastShot = now;
    if (!['shot', 'boom', 'wallhit', 'upgrade', 'won', 'lost'].includes(kind)) return;
    if (!effects[kind])
      effects[kind] = Array.from({ length: kind === 'shot' ? 4 : 2 }, () => {
        const a = media(kind);
        a.volume = kind === 'shot' ? 0.18 : kind === 'boom' ? 0.28 : 0.5;
        return a;
      });
    const pool = effects[kind],
      a = pool.find((a) => a.paused) || pool[0];
    try {
      a.currentTime = 0;
    } catch {}
    play(a);
  }
  function ui(kind = 'click') {
    if (disposed || !profile.sound) return;
    if (!['click', 'close', 'page', 'reward', 'refine'].includes(kind)) kind = 'click';
    if (!uiEffects[kind])
      uiEffects[kind] = Array.from({ length: 2 }, () => {
        const a = new Audio(new URL('./assets/client-interface/' + kind + '.mp3', import.meta.url));
        a.preload = 'none';
        a.volume = 0.4;
        return a;
      });
    const a = uiEffects[kind].find((a) => a.paused) || uiEffects[kind][0];
    try {
      a.currentTime = 0;
    } catch {}
    play(a);
  }
  return {
    ui,
    unlock: refresh,
    setActive(value) {
      active = value;
      refresh();
    },
    setHome(value) {
      home = value;
      refresh();
    },
    sound,
    refresh,
    pause() {
      active = home = false;
      refresh();
      for (const pool of Object.values(effects)) for (const a of pool) a.pause();
    },
    dispose() {
      disposed = true;
      for (const a of [
        battle,
        menu,
        ...Object.values(effects).flat(),
        ...Object.values(uiEffects).flat(),
      ]) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      }
    },
  };
}
