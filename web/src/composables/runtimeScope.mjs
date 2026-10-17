// Compatibility boundary for proven Canvas games. Global listeners, observers,
// timers and animation callbacks belong to the Vue page and are released on exit.
export function createRuntimeScope(env = globalThis) {
  let disposed = false;
  const cleanups = [],
    frames = new Set(),
    timeouts = new Set(),
    intervals = new Set();
  const onDispose = (fn) => cleanups.push(fn);
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    onDispose(() => target.removeEventListener(type, fn, options));
  };
  const proxies = new WeakMap();
  const targetProxy = (target) => {
    if (proxies.has(target)) return proxies.get(target);
    const proxy = new Proxy(target, {
      get(t, key) {
        if (key === 'addEventListener') return (type, fn, options) => listen(t, type, fn, options);
        const value = Reflect.get(t, key, t);
        if (key === 'visualViewport' && value) return targetProxy(value);
        return typeof value === 'function' && !/^[A-Z]/.test(String(key)) ? value.bind(t) : value;
      },
      set(t, k, v) {
        return Reflect.set(t, k, v, t);
      },
      defineProperty(t, k, descriptor) {
        Object.defineProperty(t, k, { ...descriptor, configurable: true });
        onDispose(() => delete t[k]);
        return true;
      },
    });
    proxies.set(target, proxy);
    return proxy;
  };
  const doc = targetProxy(env.document),
    win = targetProxy(env.window || env);
  const requestAnimationFrame = (fn) => {
    if (disposed) return 0;
    let id = env.requestAnimationFrame((time) => {
      frames.delete(id);
      if (!disposed) fn(time);
    });
    frames.add(id);
    return id;
  };
  const cancelAnimationFrame = (id) => {
    env.cancelAnimationFrame(id);
    frames.delete(id);
  };
  const setTimeout = (fn, delay, ...args) => {
    let id = env.setTimeout(() => {
      timeouts.delete(id);
      if (!disposed) fn(...args);
    }, delay);
    timeouts.add(id);
    return id;
  };
  const clearTimeout = (id) => {
    env.clearTimeout(id);
    timeouts.delete(id);
  };
  const setInterval = (fn, delay, ...args) => {
    const id = env.setInterval(() => {
      if (!disposed) fn(...args);
    }, delay);
    intervals.add(id);
    return id;
  };
  const clearInterval = (id) => {
    env.clearInterval(id);
    intervals.delete(id);
  };
  class ResizeObserver extends env.ResizeObserver {
    constructor(cb) {
      super(cb);
      onDispose(() => this.disconnect());
    }
  }
  return {
    document: doc,
    window: win,
    requestAnimationFrame,
    cancelAnimationFrame,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    ResizeObserver,
    onDispose,
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const fn of cleanups.reverse())
        try {
          fn();
        } catch {}
      for (const id of frames) env.cancelAnimationFrame(id);
      for (const id of timeouts) env.clearTimeout(id);
      for (const id of intervals) env.clearInterval(id);
      frames.clear();
      timeouts.clear();
      intervals.clear();
    },
  };
}
