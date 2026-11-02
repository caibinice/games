// The loading bar measures actual essential resource responses, not screenshot art.
import { loadNativeEntry, entryInitialized, entryFailed } from './native-entry.mjs';
loadNativeEntry()
  .then(() => import('./original-app.mjs'))
  .then(entryInitialized)
  .catch((error) => {
    entryFailed();
    console.error('游戏模块加载失败', error);
    const page = document.getElementById('page');
    if (!page) return;
    // This path runs before original-app installs phone scaling. Use viewport
    // coordinates outside that canvas, so the retry remains visible on mobile.
    const box = document.createElement('section');
    box.className = 'module-entry-error';
    box.setAttribute('role', 'alert');
    const title = document.createElement('h3');
    title.textContent = '游戏加载中断';
    const message = document.createElement('p');
    message.textContent = '请刷新重试。已有进度和背包会保留。';
    const retry = document.createElement('button');
    retry.className = 'gold-button';
    retry.textContent = '刷新重试';
    retry.onclick = () => location.reload();
    box.appendChild(title);
    box.appendChild(message);
    box.appendChild(retry);
    while (page.firstChild) page.removeChild(page.firstChild);
    document.body.appendChild(box);
    retry.focus();
  });
