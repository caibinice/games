// APK particle textures, sampled by their exported UV grids. The original
// Unity shader/particle simulation is adapted to Canvas, not a video backdrop.
import { sampleNativeSprite } from './native-fx-sampling.mjs';
const tinted = new Map();
const textures = {},
  grid = {
    'grenade-explosion': [4, 4],
    'grenade-projectile': [4, 4],
    'grenade-ring': [2, 2],
    'wind-wave': [4, 4],
    'vortex-body': [4, 3],
    'lightning-bolt': [4, 4],
    'drone-hit': [4, 4],
    'airdrop-explosion': [4, 4],
    'fuel-burn': [4, 4],
  };
const FX_NAMES = [
  'grenade-explosion',
  'grenade-projectile',
  'grenade-ring',
  'wind-wave',
  'vortex-body',
  'vortex-light',
  'vortex-ring',
  'lightning-bolt',
  'lightning-ring',
  'drone-hit',
  'airdrop-explosion',
  'fuel-burn',
  'electric-light',
  'electric-ring',
  'electric-line',
  'iceblast-crystal',
  'iceblast-hit',
  'iceblast-ring',
  'laser-glow',
  'laser-line',
  'guided-line',
  'electron-chain',
  'wind-blade',
  'guided-beam',
];
let preloadJob;
export function preloadNativeFx() {
  return (preloadJob ??= Promise.all(
    FX_NAMES.map(
      (name) =>
        new Promise((resolve) => {
          texture(name);
          const i = textures[name];
          if (i.complete) return resolve(!!i.naturalWidth);
          const done = () => resolve(!!i.naturalWidth);
          i.addEventListener('load', done, { once: true });
          i.addEventListener('error', done, { once: true });
        }),
    ),
  ).then((a) => ({ loaded: a.filter(Boolean).length, total: a.length })));
}
export const projectileAge = (b, time) => Math.max(0, time - (b.nativeBornAt ?? b.bornAt ?? time));
function impact(c, f, x, y, phase) {
  const r = (f.r || 10) * (1 + phase),
    a = f.angle || 0;
  c.save();
  c.translate(x, y);
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = 2;
  c.strokeStyle = f.color || '#ffe7a0';
  for (let i = 0; i < 6; i++) {
    const angle = a + (i - 2.5) * 0.65;
    c.beginPath();
    c.moveTo(Math.cos(angle) * r * 0.2, Math.sin(angle) * r * 0.2);
    c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    c.stroke();
  }
  c.restore();
  if (f.element === 4 || f.kind === 'frost')
    sprite(c, 'iceblast-hit', x, y, r * 2.3, r * 2.3, phase);
  else if (f.element === 2) sprite(c, 'electric-ring', x, y, r * 2.5, r * 1.5, phase);
  else if (f.element === 3) sprite(c, 'fuel-burn', x, y, r * 1.8, r * 2, phase);
  return true;
}
function texture(name) {
  if (!textures[name]) {
    const i = new Image();
    i.src = new URL('./assets/native-fx/' + name + '.webp', import.meta.url);
    textures[name] = i;
  }
  const i = textures[name];
  return i.complete && i.naturalWidth ? i : null;
}
function tintedImage(name, im, sample) {
  if (!sample) return im;
  const values = sample.rgb.map((v) => (Math.round(v * 31) * 255) / 31),
    key = values.map(Math.round).join(',');
  let cache = tinted.get(name);
  if (!cache) {
    const canvas = document.createElement('canvas');
    canvas.width = im.naturalWidth;
    canvas.height = im.naturalHeight;
    cache = { canvas, context: canvas.getContext('2d'), key: '' };
    tinted.set(name, cache);
  }
  if (cache.key !== key) {
    const t = cache.context;
    t.clearRect(0, 0, cache.canvas.width, cache.canvas.height);
    t.globalCompositeOperation = 'source-over';
    t.drawImage(im, 0, 0);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = `rgb(${key})`;
    t.fillRect(0, 0, cache.canvas.width, cache.canvas.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(im, 0, 0);
    t.globalCompositeOperation = 'source-over';
    cache.key = key;
  }
  return cache.canvas;
}
function sprite(c, name, x, y, w, h, phase = 0, angle = 0, add = true, age = null) {
  const im = texture(name);
  if (!im) return false;
  const sample = sampleNativeSprite(name, age, phase),
    [cols, rows] = sample?.tiles || grid[name] || [1, 1],
    frame =
      sample?.frame ??
      Math.min(cols * rows - 1, Math.floor(Math.max(0, Math.min(0.999, phase)) * cols * rows)),
    sw = im.naturalWidth / cols,
    sh = im.naturalHeight / rows;
  c.save();
  if (add) c.globalCompositeOperation = 'lighter';
  c.globalAlpha *= sample?.alpha ?? 1;
  c.translate(x, y);
  c.rotate(angle);
  c.drawImage(
    tintedImage(name, im, sample),
    (frame % cols) * sw,
    Math.floor(frame / cols) * sh,
    sw,
    sh,
    -w / 2,
    -h / 2,
    w,
    h,
  );
  c.restore();
  return true;
}
function guidedBeam(c, from, to, width, age) {
  const name = 'guided-beam',
    im = texture(name);
  if (!im) return false;
  const sample = sampleNativeSprite(name, age),
    dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.hypot(dx, dy);
  if (length < 0.01) return true;
  const image = tintedImage(name, im, sample),
    shift = sample.uOffset * length;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha *= sample.alpha;
  c.translate((from.x + to.x) / 2, (from.y + to.y) / 2);
  c.rotate(Math.atan2(dy, dx));
  c.beginPath();
  c.rect(-length / 2, -width / 2, length, width);
  c.clip();
  for (const offset of [-length, 0, length])
    c.drawImage(image, -length / 2 + shift + offset, -width / 2, length, width);
  c.restore();
  return true;
}
function beam(c, name, from, to, width) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  return sprite(
    c,
    name,
    (from.x + to.x) / 2,
    (from.y + to.y) / 2,
    width,
    Math.hypot(dx, dy),
    0,
    Math.atan2(dy, dx) - Math.PI / 2,
  );
}
function gunBullet(c, b, P, time) {
  const angle = Math.atan2(P(b.y + b.vy) - P(b.y), b.vx) + Math.PI / 2,
    element = b.nativeElement || 6,
    age = projectileAge(b, time);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = b.color;
  c.lineWidth = Math.max(1.5, b.size * 0.55);
  c.shadowColor = b.color;
  c.shadowBlur = element === 6 ? 3 : 9;
  c.beginPath();
  c.moveTo(b.x - b.vx * 0.024, P(b.y - b.vy * 0.024));
  c.lineTo(b.x, P(b.y));
  c.stroke();
  c.restore();
  if (element === 3) sprite(c, 'fuel-burn', b.x, P(b.y), 15, 38, (age * 6) % 1, angle);
  if (element === 2) sprite(c, 'electric-light', b.x, P(b.y), 17, 45, (age * 7) % 1, angle);
  if (element === 4) sprite(c, 'iceblast-crystal', b.x, P(b.y), 14, 30, (age * 5) % 1, angle);
  return true;
}
export function drawNativeBullet(c, b, P, time) {
  if (b.nativeGun) return gunBullet(c, b, P, time);
  if (b.nativeElectrified)
    sprite(
      c,
      'electric-light',
      b.x,
      P(b.y),
      22,
      50,
      time % 1,
      Math.atan2(b.vy, b.vx) + Math.PI / 2,
    );
  if (b.nativeProc?.fx?.includes('ganbingzidan'))
    return sprite(
      c,
      'iceblast-crystal',
      b.x,
      P(b.y),
      22,
      45,
      time % 1,
      Math.atan2(b.vy, b.vx) + Math.PI / 2,
    );
  if (b.nativeProc?.fx?.includes('yasuoqiren'))
    return sprite(
      c,
      'wind-wave',
      b.x,
      P(b.y),
      65,
      60,
      time % 1,
      Math.atan2(b.vy, b.vx) + Math.PI / 2,
    );
  if (b.kind === 'grenade')
    return sprite(
      c,
      'grenade-projectile',
      b.x,
      P(b.y),
      35,
      60,
      time % 1,
      Math.atan2(b.vy, b.vx) + Math.PI / 2,
    );
  if (b.kind === 'wind')
    return sprite(
      c,
      'wind-wave',
      b.x,
      P(b.y),
      75 + 2 * b.size,
      70,
      time % 1,
      Math.atan2(b.vy, b.vx) + Math.PI / 2,
    );
  if (b.kind === 'vehicle') {
    c.save();
    c.translate(b.x, P(b.y));
    c.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    c.fillStyle = '#4d5544';
    c.strokeStyle = '#c3b36a';
    c.lineWidth = 4;
    c.fillRect(-28, -45, 56, 90);
    c.strokeRect(-28, -45, 56, 90);
    c.fillStyle = '#252e2a';
    c.fillRect(-22, -35, 44, 25);
    c.fillStyle = '#859171';
    c.fillRect(-4, -70, 8, 40);
    c.restore();
    return true;
  }
  return false;
}
export function drawNativeEffect(c, f, P, time) {
  const phase = 1 - f.life / f.duration,
    x = f.x,
    y = P(f.y),
    r = Math.max(15, f.r || 40),
    age = Math.max(0, f.bornAt === undefined ? phase * f.duration : time - f.bornAt);
  if (f.type === 'hit-impact') return impact(c, f, x, y, phase);
  if (f.type === 'muzzle') {
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan2(Math.sin(f.angle || 0) * 1.28, Math.cos(f.angle || 0)));
    c.fillStyle = f.color || '#ffe7ab';
    c.globalCompositeOperation = 'lighter';
    c.beginPath();
    c.moveTo(0, -3);
    c.lineTo(18 * (1 - phase), 0);
    c.lineTo(0, 3);
    c.fill();
    c.restore();
    return true;
  }
  if (f.type === 'frost-launch') return sprite(c, 'iceblast-hit', x, y, 35, 60, phase);
  if (f.type === 'frost') return sprite(c, 'iceblast-hit', x, y, r * 2, r * 2, phase);
  if (f.type === 'magnet-splash') {
    sprite(c, 'lightning-ring', x, y, r * 2.6, r * 1.6, phase);
    return sprite(c, 'electric-light', x, y, r * 0.8, r * 1.7, phase);
  }
  if (f.type === 'magnet-matrix') {
    sprite(c, 'electric-ring', x, y, r * 2.2, r * 1.5, (time * 2) % 1);
    return sprite(c, 'lightning-ring', x, y, r * 2.4, r * 1.7, phase);
  }
  if (f.type === 'gun-impact') {
    if (f.element === 2) {
      sprite(c, 'electric-ring', x, y, r * 2.5, r * 1.6, phase);
      return sprite(c, 'electric-light', x, y, r * 1.2, r * 2, phase);
    }
    if (f.element === 4) return sprite(c, 'iceblast-hit', x, y, r * 2, r * 2, phase);
    return sprite(c, 'grenade-explosion', x, y, r * 2.3, r * 2.3, phase);
  }
  if (f.type === 'drone-explosion') return sprite(c, 'drone-hit', x, y, r * 2.4, r * 2.4, phase);
  if (f.type === 'electron-field') {
    sprite(c, 'electric-ring', x, y, r * 2, r * 1.5, (time * 2) % 1);
    return sprite(c, 'electric-light', x, y, r * 1.2, r * 1.8, (time * 2) % 1);
  }
  if (f.type === 'unlimited-fire') return sprite(c, 'laser-glow', x, y, r * 2, r * 1.5, phase);
  if (f.type === 'electric' && f.points) {
    for (let i = 0; i < f.points.length; i++) {
      const p = f.points[i];
      sprite(c, 'electric-light', p.x, P(p.y), 35, 80, phase);
      sprite(c, 'electric-ring', p.x, P(p.y), 60, 36, phase);
      if (i)
        beam(
          c,
          'electric-line',
          { x: f.points[i - 1].x, y: P(f.points[i - 1].y) },
          { x: p.x, y: P(p.y) },
          14,
        );
    }
    return true;
  }
  if (f.type === 'airdrop') return sprite(c, 'airdrop-explosion', x, y, r * 2.5, r * 2.5, phase);
  if (f.type === 'fuel') return sprite(c, 'fuel-burn', x, y, r * 2.2, r * 1.8, (time * 1.5) % 1);
  if (f.type === 'burn-zone')
    return sprite(c, 'grenade-ring', x, y, r * 2, r * 1.2, (time * 1.7) % 1);
  if (f.type === 'wall-shield') {
    sprite(c, 'iceblast-ring', x, y, r * 2, r * 0.36, phase);
    return true;
  }
  if (['grenade', 'airdrop', 'fuel'].includes(f.type))
    return sprite(c, 'grenade-explosion', x, y, r * 2.3, r * 2.3, phase);
  if (f.type === 'iceblast') {
    sprite(c, 'iceblast-ring', x, y, r * 2.6, r * 1.6, phase, time * 0.1);
    sprite(c, 'iceblast-hit', x, y, r * 1.4, r * 1.4, phase);
    for (let i = 0; i < 5; i++)
      sprite(
        c,
        'iceblast-crystal',
        x + Math.cos(i * 1.25) * r * 0.5,
        y + Math.sin(i * 1.25) * r * 0.35,
        35,
        75,
        phase,
        i * 0.4,
      );
    return true;
  }
  if (f.type === 'vortex') {
    sprite(c, 'vortex-ring', x, y, r * 2, r * 0.75, phase, age * 0.4, true, age);
    sprite(c, 'vortex-light', x, y, r * 1.7, r * 2.4, phase, -age * 0.3, true, age);
    return sprite(c, 'vortex-body', x, y, r * 2, r * 3, phase, 0, true, age);
  }
  if (f.type === 'guided')
    return guidedBeam(c, { x, y }, { x: f.tx, y: P(f.ty) }, Math.max(3, (f.r || 5) * 1.6), age);
  if (f.type === 'laser')
    return beam(c, 'laser-line', { x, y }, { x: f.tx, y: P(f.ty) }, Math.max(5, (f.r || 5) * 4));
  if (f.type === 'magnet-strike') {
    sprite(c, 'lightning-bolt', x, y - 70, 90, 200, phase, 0, true, age);
    return sprite(c, 'lightning-ring', x, y, r * 5, r * 3, phase);
  }
  if (f.type === 'electron' && f.path) {
    grid['electron-chain'] = [1, 6];
    let drawn = false;
    for (let i = 1; i < f.path.length; i++) {
      const a = f.path[i - 1],
        b = f.path[i],
        dx = b.x - a.x,
        dy = P(b.y) - P(a.y);
      drawn =
        sprite(
          c,
          'electron-chain',
          (a.x + b.x) / 2,
          (P(a.y) + P(b.y)) / 2,
          Math.hypot(dx, dy),
          18,
          (age * 2) % 1,
          Math.atan2(dy, dx),
          true,
          age,
        ) || drawn;
    }
    return drawn;
  }
  if (f.type === 'wind') return sprite(c, 'wind-blade', x, y, r * 1.8, r * 0.8, phase);
  return false;
}
