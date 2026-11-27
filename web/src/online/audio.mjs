import { playWaterBurst } from '../../../games/paopaotang/public/burst-audio.mjs';
import { playLinkMatch } from '../../../games/lianliankan/public/match-fx.mjs';

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
    previous = new Map();
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
    play(name, combo) {
      if (
        ![
          'match',
          'burst',
          'plant',
          'trap',
          'out',
          'pickup',
          'rescue',
          'shield',
          'win',
          'lose',
        ].includes(name)
      )
        return;
      if (
        !enabled ||
        !context ||
        context.state !== 'running' ||
        performance.now() - (previous.get(name) ?? -Infinity) < 75
      )
        return;
      previous.set(name, performance.now());
      if (name === 'burst') return playWaterBurst(context);
      if (name === 'match') return playLinkMatch(context, combo);
      const notes =
        name === 'plant' ? [290, 410] : name === 'trap' || name === 'out' ? [330, 220] : [660, 880];
      for (let i = 0; i < notes.length; i++) {
        const o = context.createOscillator(),
          g = context.createGain(),
          at = context.currentTime + i * 0.04;
        o.type = 'sine';
        o.frequency.value = notes[i];
        g.gain.setValueAtTime(name === 'plant' ? 0.02 : 0.035, at);
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
