import { NATIVE_MODELS } from './native-models.mjs';
import { GROWTH } from './native-progression.mjs';
let player = null,
  revision = 0;
export function clearNativeForm() {
  revision++;
  player?.dispose();
  player = null;
}
export async function renderNativeForm(root) {
  clearNativeForm();
  const canvas = root.querySelector('[data-native-form]');
  if (!canvas) return;
  const id = revision,
    skin = GROWTH.SkinBaseConfig.find((r) => r.SkinID === Number(canvas.dataset.nativeForm)),
    model = NATIVE_MODELS[skin?.ModelId?.[0]],
    base = model?.show || model?.battle;
  if (!base) return;
  try {
    const { mountNativePlayer } = await import('./assets/native-ui/player-runtime.mjs');
    if (id !== revision || !canvas.isConnected) return;
    const actor = await mountNativePlayer(canvas, base, {
      width: 1080,
      height: 800,
      animation: 'idle',
      scale: 1,
      y: 750,
    });
    if (id !== revision || !canvas.isConnected) {
      actor.dispose();
      return;
    }
    const spine = actor.actor;
    spine.scale.set(1);
    const b = spine.getLocalBounds(),
      scale = Math.min(650 / Math.max(1, b.width), 650 / Math.max(1, b.height));
    spine.scale.set(scale);
    spine.position.set(540 - (b.x + b.width / 2) * scale, 735 - (b.y + b.height) * scale);
    actor.update(0);
    player = actor;
    canvas.parentElement.dataset.loaded = 'true';
  } catch {
    canvas.dataset.animationFallback = 'true';
  }
}
