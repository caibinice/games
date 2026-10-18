import { CUES, cueSamples } from './sounds.mjs';
const BASE = '/games/racer/assets/audio/';
export function createAudio() {
  const music = new Audio(BASE + 'fever-stadium.mp3');
  music.loop = true;
  music.preload = 'none';
  music.volume = 0.34;
  const buffers = new Map(),
    playing = new Set(),
    lastPlayed = new Map();
  let enabled = true,
    musicEnabled = true,
    unlocked = false,
    running = false,
    disposed = false;
  let context, master;
  function stopEffects() {
    for (const source of playing) {
      try {
        source.stop();
      } catch {}
    }
    playing.clear();
  }
  function prepare() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (context || !Context) return;
    context = new Context({ latencyHint: 'interactive' });
    master = context.createGain();
    master.gain.value = 0.65;
    master.connect(context.destination);
    for (const type of Object.keys(CUES)) {
      const samples = cueSamples(type),
        buffer = context.createBuffer(1, samples.length, 22050);
      buffer.copyToChannel(samples, 0);
      buffers.set(type, buffer);
    }
  }
  function sync() {
    if (musicEnabled && running && unlocked && !disposed) music.play().catch(() => {});
    else music.pause();
    if (context) {
      const audible = enabled && running && unlocked && !disposed;
      master.gain.value = audible ? 0.65 : 0;
      if (audible && context.state !== 'running') context.resume().catch(() => {});
      if (!audible) stopEffects();
    }
  }
  return {
    unlock() {
      if (disposed) return;
      unlocked = true;
      prepare();
      const ready =
        context && context.state !== 'running'
          ? context.resume().catch(() => {})
          : Promise.resolve();
      sync();
      return ready;
    },
    setEnabled(v) {
      enabled = !!v;
      sync();
    },
    setRunning(v) {
      running = !!v;
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
        effectsPlaying: playing.size,
        effectsReady: buffers.size,
      };
    },
    play(name, event = {}) {
      if (!enabled || !running || disposed || !unlocked || !context) return;
      const type = name === 'repair' ? 'pickup' : name;
      if (!buffers.has(type) || (type === 'nitro' && event.enabled === false)) return;
      const now = context.currentTime;
      if (now - (lastPlayed.get(type) ?? -100) < 0.07 || playing.size >= 3) return;
      lastPlayed.set(type, now);
      const source = context.createBufferSource();
      source.buffer = buffers.get(type);
      source.connect(master);
      source.onended = () => {
        playing.delete(source);
        source.disconnect();
      };
      playing.add(source);
      source.start();
    },
    dispose() {
      disposed = true;
      stopEffects();
      music.pause();
      music.removeAttribute('src');
      music.load();
      master?.disconnect();
      context?.close().catch(() => {});
      buffers.clear();
      lastPlayed.clear();
    },
  };
}
