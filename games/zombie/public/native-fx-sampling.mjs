import { NATIVE_FX_PROFILES } from './native-fx-profile-data.mjs';

const clamp = (v) => Math.max(0, Math.min(1, v));
export function gradientChannels(keys, t, step = false) {
  if (!keys?.length) return [];
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++)
    if (t <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i],
        p = step ? 0 : clamp((t - a[0]) / (b[0] - a[0] || 1));
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * p);
    }
  return keys.at(-1).slice(1);
}

// Source RGB ratios and alpha are retained. HDR energy is reported separately;
// Canvas additive compositing is not Unity HDR + bloom tone mapping.
export function sampleNativeSprite(name, age = null, phase = 0) {
  const p = NATIVE_FX_PROFILES[name];
  if (!p) return null;
  const lifetime = p.lifetime || 1,
    elapsed = Math.max(0, age ?? phase * lifetime),
    t = p.loop ? (elapsed / lifetime) % 1 : clamp(elapsed / lifetime);
  const color = p.startColor.map((v, i) => v * p.materialColor[i]);
  if (p.lineColor) {
    const rgb = gradientChannels(p.lineColor.rgb, 0.5, p.lineColor.mode === 1),
      a = gradientChannels(p.lineColor.alpha, 0.5, p.lineColor.mode === 1);
    for (let i = 0; i < 3; i++) color[i] *= rgb[i] ?? 1;
    color[3] *= a[0] ?? 1;
  }
  if (p.colorOverLife) {
    const rgb = gradientChannels(p.colorOverLife.rgb, t, p.colorOverLife.mode === 1),
      a = gradientChannels(p.colorOverLife.alpha, t, p.colorOverLife.mode === 1);
    for (let i = 0; i < 3; i++) color[i] *= rgb[i] ?? 1;
    color[3] *= a[0] ?? 1;
  }
  const peak = Math.max(...color.slice(0, 3), 1e-6),
    rgb = color.slice(0, 3).map((v) => clamp(v / Math.max(1, peak))),
    tiles = p.tiles || [1, 1],
    count = tiles[0] * tiles[1];
  const progress = p.fps ? (elapsed * p.fps) / count : (elapsed / lifetime) * (p.cycles || 1),
    position = p.loop ? progress % 1 : clamp(progress);
  return {
    rgb,
    alpha: clamp(color[3]),
    hdrPeak: peak,
    tiles,
    frame: Math.min(count - 1, Math.floor(position * count)),
    uOffset: (elapsed * (p.materialFloats?._USpeed || 0)) % 1,
  };
}
