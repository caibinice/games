import { CLIENT_VISUALS } from './client-data.mjs';
import { EXTRA_VISUALS } from './client-expanded.mjs';
const VISUALS = { ...CLIENT_VISUALS, ...EXTRA_VISUALS };

// Each battle owns its image set; leaving a battle releases unused atlases.
// Animation order is taken from the native FrameSpritePool PPtr arrays.
export function createClientActors(context) {
  const images = new Map(),
    sizes = new Map();
  function load(key) {
    const visual = VISUALS[key];
    if (!visual) return null;
    if (!images.has(key)) {
      const image = new Image();
      image.src = new URL(visual.file, import.meta.url);
      images.set(key, image);
      sizes.set(key, Math.max(...visual.frames.map((f) => Math.max(f[2], f[3]))));
    }
    return images.get(key);
  }
  function draw(actor, time, { death = false, progress = 0 } = {}) {
    const visual = VISUALS[actor.frameModel],
      image = load(actor.frameModel);
    if (!visual || !image?.complete || !image.naturalWidth) return false;
    const anim = death
      ? 'Death'
      : actor.freeze > 0 || actor.paralysis > 0
        ? 'Idle'
        : actor.y >= 650 - actor.r
          ? 'Skill1'
          : 'Run';
    const frames = visual.animations[anim]?.length
      ? visual.animations[anim]
      : Object.values(visual.animations).find((a) => a.length);
    if (!frames?.length) return false;
    const index = death
      ? Math.min(frames.length - 1, Math.floor(progress * frames.length))
      : actor.freeze > 0 || actor.paralysis > 0
        ? 0
        : Math.floor(time * 12 + (actor.phase || 0) * 2) % frames.length;
    const f = visual.frames[frames[index]],
      scale = (100 * (actor.r / 17)) / sizes.get(actor.frameModel),
      w = f[2] * scale,
      h = f[3] * scale;
    context.drawImage(image, f[0], f[1], f[2], f[3], -w / 2, -h * 0.75, w, h);
    return true;
  }
  return {
    draw,
    preload(keys) {
      for (const key of new Set(keys)) load(key);
    },
  };
}
