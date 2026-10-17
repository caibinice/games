import { describe, it, expect } from 'vitest';
import { createRuntimeScope } from '../web/src/composables/runtimeScope.mjs';
function fake() {
  let next = 0;
  const jobs = new Map(),
    target = new EventTarget();
  class RO {
    disconnect() {
      this.disconnected = true;
    }
  }
  return {
    document: target,
    window: new EventTarget(),
    ResizeObserver: RO,
    jobs,
    requestAnimationFrame(fn) {
      const n = ++next;
      jobs.set(n, fn);
      return n;
    },
    cancelAnimationFrame(n) {
      jobs.delete(n);
    },
    setTimeout(fn) {
      const n = ++next;
      jobs.set(n, fn);
      return n;
    },
    clearTimeout(n) {
      jobs.delete(n);
    },
    setInterval(fn) {
      const n = ++next;
      jobs.set(n, fn);
      return n;
    },
    clearInterval(n) {
      jobs.delete(n);
    },
  };
}
describe('Vue legacy lifecycle boundary', () => {
  it('removes listeners, observers, globals, frames and timers on unmount', () => {
    const env = fake(),
      scope = createRuntimeScope(env);
    let count = 0;
    scope.document.addEventListener('ping', () => count++);
    scope.window.addEventListener('ping', () => count++);
    scope.requestAnimationFrame(() => count++);
    scope.setTimeout(() => count++);
    scope.setInterval(() => count++);
    const observer = new scope.ResizeObserver(() => {});
    Object.defineProperty(scope.window, 'gameAudio', { value: {} });
    env.document.dispatchEvent(new Event('ping'));
    expect(count).toBe(1);
    scope.dispose();
    env.document.dispatchEvent(new Event('ping'));
    env.window.dispatchEvent(new Event('ping'));
    expect(count).toBe(1);
    expect(env.jobs.size).toBe(0);
    expect(observer.disconnected).toBe(true);
    expect(env.window.gameAudio).toBeUndefined();
    scope.dispose();
    expect(scope.disposed).toBe(true);
  });
  it('suppresses stale async callbacks after unmount even when already queued', () => {
    const env = fake(),
      scope = createRuntimeScope(env);
    let count = 0;
    scope.setTimeout(() => count++);
    scope.requestAnimationFrame(() => count++);
    const callbacks = [...env.jobs.values()];
    scope.dispose();
    for (const fn of callbacks) fn(1);
    expect(count).toBe(0);
  });
  it('also cleans visual viewport listeners and runs all cleanups when one throws', () => {
    const env = fake();
    env.window.visualViewport = new EventTarget();
    const scope = createRuntimeScope(env);
    let count = 0;
    scope.window.visualViewport.addEventListener('resize', () => count++);
    scope.onDispose(() => count++);
    scope.onDispose(() => {
      throw Error('cleanup');
    });
    scope.dispose();
    env.window.visualViewport.dispatchEvent(new Event('resize'));
    expect(count).toBe(1);
  });
});
