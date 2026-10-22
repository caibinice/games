export async function createOnlineAudio(id) {
  if (id === 'tank' || id === 'contra') {
    const m =
      id === 'tank'
        ? await import('../../../games/tank/public/audio.mjs')
        : await import('../../../games/contra/public/audio.mjs');
    const audio = m.createAudio();
    await audio.load();
    return audio;
  }
  let context,
    enabled = true,
    previous = 0;
  return {
    async unlock() {
      try {
        context ||= new AudioContext();
        await context.resume();
      } catch {}
    },
    setEnabled(value) {
      enabled = value;
    },
    setRunning() {},
    play(name) {
      if (!enabled || !context || context.state !== 'running' || performance.now() - previous < 60)
        return;
      previous = performance.now();
      const notes =
        name === 'burst'
          ? [220, 330, 440]
          : name === 'trap' || name === 'out'
            ? [330, 220]
            : [660, 880];
      for (let i = 0; i < notes.length; i++) {
        const o = context.createOscillator(),
          g = context.createGain(),
          at = context.currentTime + i * 0.04;
        o.type = 'sine';
        o.frequency.value = notes[i];
        g.gain.setValueAtTime(0.035, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.11);
        o.connect(g).connect(context.destination);
        o.start(at);
        o.stop(at + 0.12);
      }
    },
    dispose() {
      void context?.close();
    },
  };
}
