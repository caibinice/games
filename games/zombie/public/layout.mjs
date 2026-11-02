export function fitGame() {
  const v = window.visualViewport,
    w = Math.min(innerWidth, v?.width || innerWidth),
    h = Math.min(innerHeight, v?.height || innerHeight),
    height = Math.max(1920, Math.min(2400, (h / w) * 1080)),
    scale = Math.min(w / 1080, h / height),
    shell = document.getElementById('phone-shell'),
    root = document.getElementById('game-root');
  if (!shell || !root) return;
  shell.style.width = 1080 * scale + 'px';
  shell.style.height = height * scale + 'px';
  shell.style.left = (v?.offsetLeft || 0) + w / 2 + 'px';
  shell.style.top = (v?.offsetTop || 0) + h / 2 + 'px';
  root.style.height = height + 'px';
  root.style.setProperty('--game-h', height + 'px');
  root.style.transform = `scale(${scale})`;
}
