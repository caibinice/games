const BASE = '/games/racer/assets/audio/';
export function createAudio() {
  const engine = new Audio(BASE + 'engine.ogg');
  engine.loop = true;
  engine.volume = 0.22;
  const effects = new Map(),
    playing = new Set();
  let enabled = true,
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
    if (enabled && running && !disposed) engine.play().catch(() => {});
    else engine.pause();
  };
  return {
    unlock() {
      if (disposed) return;
      engine
        .play()
        .then(sync)
        .catch(() => {});
    },
    setEnabled(v) {
      enabled = v;
      sync();
    },
    setRunning(v) {
      running = v;
      sync();
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
      a.play().catch(() => playing.delete(a));
    },
    dispose() {
      disposed = true;
      engine.pause();
      engine.removeAttribute('src');
      engine.load();
      for (const a of playing) a.pause();
      playing.clear();
      effects.clear();
    },
  };
}
