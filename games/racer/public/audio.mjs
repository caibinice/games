const BASE = '/games/racer/assets/audio/';
export function createAudio() {
  const engine = new Audio(BASE + 'engine.ogg');
  engine.loop = true;
  engine.volume = 0.18;
  const music = new Audio(BASE + 'fever-stadium.mp3');
  music.loop = true;
  music.preload = 'none';
  music.volume = 0.34;
  const effects = new Map(),
    playing = new Set();
  let enabled = true,
    musicEnabled = true,
    unlocked = false,
    running = false,
    disposed = false;
  for (const [name, file] of Object.entries({
    jet: 'thruster.ogg',
    hit: 'impact.ogg',
    land: 'land.ogg',
    near: 'skid.ogg',
  })) {
    const a = new Audio(BASE + file);
    a.preload = 'auto';
    effects.set(name, a);
  }
  const sync = () => {
    if (enabled && running && unlocked && !disposed) engine.play().catch(() => {});
    else engine.pause();
    if (musicEnabled && running && unlocked && !disposed) music.play().catch(() => {});
    else music.pause();
  };
  return {
    unlock() {
      if (disposed) return;
      unlocked = true;
      sync();
    },
    setEnabled(v) {
      enabled = v;
      sync();
    },
    setRunning(v) {
      running = v;
      sync();
    },
    setMusicEnabled(v) {
      musicEnabled = !!v;
      sync();
    },
    getState() {
      return {
        musicEnabled,
        musicPlaying: !music.paused,
        musicTime: music.currentTime,
        musicReady: music.readyState,
      };
    },
    update(speed) {
      engine.playbackRate = Math.min(2, 0.7 + speed / 55);
    },
    play(name) {
      if (!enabled || disposed) return;
      const source = effects.get(name);
      if (!source || playing.size >= 6) return;
      const a = source.cloneNode();
      a.volume = name === 'jet' ? 0.55 : 0.35;
      playing.add(a);
      a.onended = () => playing.delete(a);
      a.onerror = () => playing.delete(a);
      a.play().catch(() => playing.delete(a));
    },
    dispose() {
      disposed = true;
      for (const a of [engine, music, ...playing, ...effects.values()]) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      }
      playing.clear();
      effects.clear();
    },
  };
}
