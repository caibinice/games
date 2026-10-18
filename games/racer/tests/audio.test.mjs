import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../public/audio.mjs';
const all = [];
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.readyState = 4;
    this.removed = false;
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
  cloneNode() {
    return new FakeAudio(this.src);
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  all.length = 0;
});
function audio() {
  vi.stubGlobal('Audio', FakeAudio);
  return createAudio();
}
const music = () => all.find((a) => a.src.endsWith('fever-stadium.mp3'));
const engine = () => all.find((a) => a.src.endsWith('engine.ogg'));
describe('Independent racing music lifecycle', () => {
  it('does not autoplay or preload the BGM before a user gesture', () => {
    const a = audio();
    a.setRunning(true);
    expect(music().preload).toBe('none');
    expect(music().paused).toBe(true);
    a.unlock();
    expect(music().paused).toBe(false);
    expect(music().loop).toBe(true);
  });
  it('music and engine/effects switches are independent', () => {
    const a = audio();
    a.unlock();
    a.setRunning(true);
    a.setEnabled(false);
    expect(engine().paused).toBe(true);
    expect(music().paused).toBe(false);
    a.setEnabled(true);
    a.setMusicEnabled(false);
    expect(engine().paused).toBe(false);
    expect(music().paused).toBe(true);
    expect(a.getState().musicEnabled).toBe(false);
  });
  it('pause/resume preserves music position and disposal releases every source', () => {
    const a = audio();
    a.unlock();
    a.setRunning(true);
    music().currentTime = 12;
    a.setRunning(false);
    expect(music().paused).toBe(true);
    a.setRunning(true);
    expect(music().currentTime).toBe(12);
    a.play('jet');
    a.dispose();
    expect(all.every((a) => a.paused && a.removed)).toBe(true);
    a.setRunning(true);
    a.unlock();
    expect(music().paused).toBe(true);
  });
  it('keeps the saved music-off preference when starting', () => {
    const a = audio();
    a.setMusicEnabled(false);
    a.unlock();
    a.setRunning(true);
    expect(music().paused).toBe(true);
    expect(engine().paused).toBe(false);
  });
});
