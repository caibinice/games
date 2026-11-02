import { fitGame } from './layout.mjs';
const base = './assets/client-interface/';
let host = null,
  dispose = null,
  ready = false,
  hidden = false,
  progress = 0,
  renderJob = null;
const fit = fitGame;
function mount() {
  if (host?.isConnected) return host;
  host = document.createElement('section');
  host.id = 'client-entry';
  host.className = 'client-entry';
  host.setAttribute('aria-label', '客户端登录画面');
  host.innerHTML = `<canvas class="login-actors" aria-hidden="true"></canvas><div class="entry-progress" role="progressbar" aria-label="资源加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><p class="entry-progress-label" role="status">正在加载客户端资源 0%</p><button class="native-start" data-action="enter" hidden>开始游戏</button><p class="entry-version">APK 美术与骨骼动画 · 网页畅玩版</p>`;
  document.getElementById('game-root').appendChild(host);
  fit();
  return host;
}
export function showEntry() {
  mount();
  hidden = false;
  host.hidden = false;
  ready = true;
  host.classList.add('ready');
  host.querySelector('.native-start').hidden = false;
  host.querySelector('.entry-progress').hidden = true;
  host.querySelector('.entry-progress-label').hidden = true;
}
export function hideEntry() {
  hidden = true;
  if (host) host.hidden = true;
  dispose?.();
  dispose = null;
}
export function entryProgress(value, label = '正在加载客户端资源') {
  mount();
  progress = Math.max(progress, Math.min(100, Math.floor(value)));
  const bar = host.querySelector('.entry-progress');
  bar.setAttribute('aria-valuenow', String(progress));
  bar.querySelector('i').style.width = progress + '%';
  host.querySelector('.entry-progress-label').textContent = label + ' ' + progress + '%';
}
function beginActors() {
  if (renderJob) return;
  renderJob = import('./assets/client-interface/login-runtime.mjs')
    .then(async (mod) => {
      if (hidden) return;
      dispose = await mod.mountLoginActors(host.querySelector('canvas'), base);
      if (hidden) {
        dispose?.();
        dispose = null;
      }
    })
    .catch((error) => {
      host.dataset.animationFallback = 'true';
      console.warn('登录动画回退为原生场景贴图', error);
    });
}
export async function loadNativeEntry() {
  mount();
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  const response = await fetch('./entry-resources.json', { cache: 'no-cache' });
  if (!response.ok) throw Error('加载清单读取失败');
  const list = await response.json();
  const total = list.reduce((n, f) => n + f.bytes, 0),
    received = new Map(),
    finished = new Set(),
    artFiles = [
      'login-runtime.mjs',
      'login-atlas.json',
      'login-skeleton.json',
      'login-actors.webp',
    ].map((n) => './assets/client-interface/' + n);
  let completed = 0;
  function update() {
    let bytes = 0;
    for (const n of received.values()) bytes += n;
    entryProgress(total ? (bytes / total) * 95 : 0);
  }
  // Count real decoded response bytes. A failed essential resource stops the
  // loader; no timers fabricate percentages and 100% is reserved for module init.
  let cursor = 0;
  async function worker() {
    while (cursor < list.length) {
      const f = list[cursor++],
        r = await fetch(f.path, { cache: 'no-cache' });
      if (!r.ok) throw Error('资源载入失败：' + f.path);
      if (r.body?.getReader) {
        const reader = r.body.getReader();
        let size = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) {
            if (size !== f.bytes) throw Error('资源校验失败，请刷新重试：' + f.path);
            break;
          }
          size += part.value.byteLength;
          received.set(f.path, Math.min(size, f.bytes));
          update();
        }
      } else {
        const bytes = await r.arrayBuffer();
        if (bytes.byteLength !== f.bytes) throw Error('资源校验失败，请刷新重试：' + f.path);
      }
      received.set(f.path, f.bytes);
      finished.add(f.path);
      if (artFiles.every((n) => finished.has(n))) beginActors();
      completed++;
      update();
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  beginActors();
  await renderJob;
  await renderJob;
  entryProgress(97, '正在初始化游戏');
  return { resources: completed, bytes: total };
}
export function entryInitialized() {
  entryProgress(100, '资源加载完成');
}
export function entryFailed() {
  hideEntry();
}
window.addEventListener('pagehide', () => {
  dispose?.();
  dispose = null;
  window.removeEventListener('resize', fit);
  window.visualViewport?.removeEventListener('resize', fit);
});
