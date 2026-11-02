import { NATIVE_MODELS } from './native-models.mjs';
import { GROWTH, ensureNative } from './native-progression.mjs';
let player = null,
  revision = 0;
export function clearNativeHome() {
  revision++;
  player?.dispose();
  player = null;
}
export async function renderNativeHome(root, meta) {
  clearNativeHome();
  const canvas = root.querySelector('[data-native-player]');
  if (!canvas) return;
  const id = revision;
  try {
    const { mountNativePlayer } = await import('./assets/native-ui/player-runtime.mjs');
    if (id !== revision || !canvas.isConnected) return;
    const type = canvas.dataset.nativePlayer === 'core' ? 2 : 1,
      skin = GROWTH.SkinBaseConfig.find((r) => r.SkinID === ensureNative(meta).skinSlots[type]),
      model = NATIVE_MODELS[skin?.ModelId?.[0]],
      base =
        model?.show ||
        model?.battle ||
        (type === 2 ? './assets/native-scenes/core/' : './assets/native-scenes/');
    const actor = await mountNativePlayer(canvas, base, {
      width: 1080,
      height: 1000,
      animation: 'idle',
      scale: 1,
      y: 900,
    });
    if (id !== revision || !canvas.isConnected) actor.dispose();
    else {
      const spine = actor.actor;
      spine.scale.set(1);
      const b = spine.getLocalBounds(),
        scale = Math.min(
          500 / Math.max(1, b.width),
          (canvas.dataset.nativePlayer === 'core' ? 550 : 760) / Math.max(1, b.height),
        );
      spine.scale.set(scale);
      spine.position.set(
        (canvas.dataset.nativePlayer === 'core' ? 570 : 450) - (b.x + b.width / 2) * scale,
        950 - (b.y + b.height) * scale,
      );
      actor.update(0);
      player = actor;
    }
  } catch (error) {
    canvas.dataset.animationFallback = 'true';
    console.warn('角色动画加载中断', error);
  }
}
