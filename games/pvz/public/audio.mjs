export function createAudio(profile) {
  let context,
    last = 0,
    active = false;
  const music = new Audio(new URL('./assets/audio/garden.mp3', import.meta.url));
  music.loop = true;
  music.volume = 0.4;
  music.preload = 'none';
  function unlock() {
    try {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      context.resume().catch(() => {});
    } catch {}
  }
  function setActive(v) {
    active = v;
    if (v && profile.music) music.play().catch(() => {});
    else music.pause();
  }
  function sound(type) {
    if (!active || !profile.sound) return;
    unlock();
    if (!context) return;
    const t = context.currentTime;
    if (type === 'shot' && t - last < 0.16) return;
    if (type === 'shot') last = t;
    const o = context.createOscillator(),
      a = context.createGain();
    o.connect(a);
    a.connect(context.destination);
    o.type = type === 'bite' ? 'sawtooth' : 'sine';
    const hz =
      { plant: 260, shot: 520, sun: 880, boom: 65, bite: 95, mower: 80, won: 660, lost: 120 }[
        type
      ] || 300;
    o.frequency.setValueAtTime(hz, t);
    o.frequency.exponentialRampToValueAtTime(hz * 0.6, t + 0.12);
    a.gain.setValueAtTime(type === 'bite' ? 0.015 : type === 'shot' ? 0.025 : 0.05, t);
    a.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.start(t);
    o.stop(t + 0.16);
  }
  return {
    unlock,
    setActive,
    sound,
    refresh: () => setActive(active),
    dispose() {
      music.pause();
      music.removeAttribute('src');
      context?.close();
    },
  };
}
