import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../public/audio.mjs';
import { CUES, cueSamples } from '../public/sounds.mjs';
const all = [],
  contexts = [];
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.readyState = 4;
    all.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  removeAttribute() {
    this.removed = true;
  }
  load() {}
}
class Context {
  constructor() {
    this.currentTime = 0;
    this.state = 'suspended';
    this.sources = [];
    contexts.push(this);
  }
  createGain() {
    this.master = { gain: { value: 0 }, connect() {}, disconnect() {} };
    return this.master;
  }
  createBuffer(n, size, rate) {
    return { duration: size / rate, copyToChannel() {} };
  }
  createBufferSource() {
    const source = {
      connect() {},
      disconnect() {},
      start() {
        this.started = true;
      },
      stop() {
        this.stopped = true;
        this.onended?.();
      },
    };
    this.sources.push(source);
    return source;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  all.length = 0;
  contexts.length = 0;
});
function audio() {
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('AudioContext', Context);
  return createAudio();
}
describe('Short independent racing audio', () => {
  it('primes the BGM in the start gesture before asynchronous fullscreen preparation', () => {
    const a = audio();
    a.unlock({ primeMusic: true });
    expect(all[0].paused).toBe(false);
    a.setRunning(false);
    expect(all[0].paused).toBe(true);
    a.setRunning(true);
    expect(all[0].paused).toBe(false);
  });
  it('does not autoplay or allocate a context before the first gesture', () => {
    const a = audio();
    a.setRunning(true);
    expect(contexts).toHaveLength(0);
    expect(all[0].preload).toBe('none');
    expect(all[0].paused).toBe(true);
    a.unlock();
    expect(all[0].paused).toBe(false);
    expect(all[0].loop).toBe(true);
    expect(a.getState().effectsReady).toBe(3);
  });
  it('music and effects are independent and no old engine/brake media is loaded', () => {
    const a = audio();
    a.unlock();
    a.setRunning(true);
    a.setEnabled(false);
    expect(contexts[0].master.gain.value).toBe(0);
    expect(all[0].paused).toBe(false);
    a.setEnabled(true);
    a.setMusicEnabled(false);
    expect(contexts[0].state).toBe('running');
    expect(all[0].paused).toBe(true);
    expect(all).toHaveLength(1);
    expect(all[0].src).toMatch(/fever-stadium.mp3$/);
  });
  it('only plays pickup, nitro-on and jet, deduplicates repair and limits overlap', () => {
    const a = audio();
    a.unlock();
    a.setRunning(true);
    const c = contexts[0];
    for (const n of ['near', 'hit', 'land', 'coin', 'empty', 'won']) a.play(n);
    a.play('nitro', { enabled: false });
    expect(c.sources).toHaveLength(0);
    a.play('pickup');
    a.play('repair');
    a.play('nitro', { enabled: true });
    a.play('jet');
    expect(c.sources).toHaveLength(3);
    c.currentTime = 1;
    a.play('pickup');
    expect(c.sources).toHaveLength(3);
    a.setRunning(false);
    expect(c.sources.every((s) => s.stopped)).toBe(true);
    expect(a.getState().effectsPlaying).toBe(0);
  });
  it('pause preserves music position and disposal releases music, voices and context', () => {
    const a = audio();
    a.unlock();
    a.setRunning(true);
    all[0].currentTime = 12;
    a.setRunning(false);
    a.setRunning(true);
    expect(all[0].currentTime).toBe(12);
    a.play('jet');
    a.dispose();
    expect(all[0].paused && all[0].removed).toBe(true);
    expect(contexts[0].state).toBe('closed');
    a.unlock();
    a.setRunning(true);
    expect(all[0].paused).toBe(true);
  });
  it('keeps music-off preferences while allowing crisp effects', () => {
    const a = audio();
    a.setMusicEnabled(false);
    a.unlock();
    a.setRunning(true);
    a.play('jet');
    expect(all[0].paused).toBe(true);
    expect(contexts[0].sources).toHaveLength(1);
  });
  it.each(Object.keys(CUES))('%s cue is short, deterministic, bounded and click-free', (type) => {
    const samples = cueSamples(type);
    expect(samples).toEqual(cueSamples(type));
    expect(samples.length / 22050).toBeLessThan(0.241);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(0);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(0.6);
    expect(samples.some((v) => Math.abs(v) > 0.08)).toBe(true);
    expect(samples.slice(-100).every((v) => Math.abs(v) < 0.001)).toBe(true);
  });
});
