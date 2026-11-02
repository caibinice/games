import { treasureView } from './operations-ui.mjs';

let current = null,
  revision = 0,
  ready = Promise.resolve(null);
export function clearNativeTreasure() {
  revision++;
  current?.player.dispose();
  current = null;
}

// The TreasureHuntPage prefab references this actor directly, not ModelConfig.
export function renderNativeTreasure(root, state) {
  clearNativeTreasure();
  const canvas = root.querySelector('.treasure-player');
  if (!canvas) return;
  const version = revision,
    height = parseFloat(root.querySelector('.operation-stage').style.height);
  ready = (async () => {
    try {
      const { mountNativePlayer } = await import('./assets/native-ui/player-runtime.mjs');
      if (version !== revision || !canvas.isConnected) return null;
      const view = treasureView(height, state),
        point =
          view.points.find((p) => p.id === state.history?.at(-1) && state.cells.includes(p.id)) ||
          view.points.find((p) => p.big) ||
          view.points[0];
      const player = await mountNativePlayer(
        canvas,
        './assets/native-operations/treasure-player/',
        { width: 750, height, animation: 'idle2', scale: 0.9, x: point.x, y: point.y },
      );
      if (version !== revision || !canvas.isConnected) {
        player.dispose();
        return null;
      }
      canvas.dataset.source = 'APK ui_009_zhadanxiaoren / TreasureHuntPage.m_goPlayer';
      canvas.dataset.cell = String(point.id);
      canvas.dataset.ready = 'true';
      return (current = { player, canvas, root, height, version, point });
    } catch (error) {
      canvas.dataset.animationFallback = 'true';
      console.warn('寻宝骨骼加载失败', error);
      return null;
    }
  })();
  return ready;
}

export async function animateTreasureDraw(rows, initial) {
  const c = await ready;
  if (!c || c.version !== revision || initial.skipAnimation) return false;
  const live = () => c.version === revision && c.canvas.isConnected;
  const tween = (duration, step) =>
    new Promise((resolve) => {
      let start;
      function frame(now) {
        if (!live()) {
          resolve(false);
          return;
        }
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        step(t);
        if (t < 1) requestAnimationFrame(frame);
        else resolve(true);
      }
      requestAnimationFrame(frame);
    });
  let board = { layer: initial.layer, circle: initial.circle, cells: [...initial.cells] },
    key = `${board.layer}:${board.circle}`;
  for (const reward of rows) {
    if (!live()) return false;
    const nextKey = `${reward.boardLayer}:${reward.boardCircle}`;
    if (nextKey !== key) {
      board = { layer: reward.boardLayer, circle: reward.boardCircle, cells: [] };
      key = nextKey;
    }
    const view = treasureView(c.height, board),
      rotor = c.root.querySelector('.op-native-rotor');
    rotor.innerHTML = view.html;
    let index = view.points.findIndex((p) => p.id === c.point.id);
    if (index < 0) {
      index = view.points.findIndex((p) => p.big);
      c.point = view.points[index < 0 ? 0 : index];
    }
    index = Math.max(0, index);
    c.player.actor.position.set(c.point.x, c.point.y);
    const target = view.points.findIndex((p) => p.id === reward.boardCell);
    if (target < 0) continue;
    const distance = (target - index + view.points.length) % view.points.length;
    // One circuit before landing, following the prefab's child order.
    const hops = view.points.length + distance;
    for (let i = 0; i < hops; i++) {
      const from = c.point,
        to = view.points[(index + 1) % view.points.length],
        dx = to.x - from.x,
        dy = to.y - from.y;
      c.player.setAnimation(Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 'run2' : 'run3') : 'run1');
      c.player.actor.scale.x = (dx < 0 ? -1 : 1) * 0.9;
      if (
        !(await tween(rows.length > 1 ? 45 : 90, (t) => {
          c.player.actor.position.set(from.x + dx * t, from.y + dy * t);
        }))
      )
        return false;
      c.point = to;
      index = (index + 1) % view.points.length;
      c.canvas.dataset.cell = String(to.id);
    }
    c.player.actor.scale.x = 0.9;
    c.player.setAnimation('skill1', false);
    if (!(await tween(rows.length > 1 ? 100 : 380, () => {}))) return false;
    board.cells.push(reward.boardCell);
    rotor
      .querySelector(`[data-treasure-cell="${reward.boardCell}"]`)
      ?.classList.add('board-collected');
  }
  if (live()) {
    c.player.setAnimation('idle2');
    c.canvas.dataset.drawComplete = 'true';
  }
  return true;
}
