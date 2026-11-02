import { WIDTH, HEIGHT, WALL_Y, ENEMIES } from './engine.mjs';
const TAU = Math.PI * 2;
export const ICONS = {
  gun: 'M4 9h13v5H8v5H4V9Zm12 1h5v3h-5M10 14v4h4v-4',
  bomb: 'M15 6c1-4 4-4 5-2M12 7l2-3 3 2-2 3M18 15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  snow: 'm12 2 0 20M3.34 7l17.32 10M3.34 17 20.66 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-1-1-4m15 7-4 1 1 4M3 13l4 1-1 4m15-7-4-1 1-4',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l0-7Z',
  laser: 'm3 21 9-9m-4 0 4 4M12 2v5m5 0 3-3m-3 8h5M9 3 7 6m10 11 3 3',
  drone: 'M8 10h8v5H8zM4 6v4m16-4v4M1 6h6m10 0h6M8 11 4 8m12 3 4-3M9 15l-2 5m8-5 2 5',
  reload: 'M20 9a8 8 0 1 0 0 7M20 3v6h-6',
  power: 'm12 3 8 7-8 11L4 10l8-7Zm0 5v7',
  target:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v5m0 12v5M1 12h5m12 0h5',
  pierce: 'M3 12h17m-7-7 7 7-7 7M5 5v14',
  repair: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  pause: 'M8 4v16M16 4v16',
  play: 'm7 4 13 8-13 8V4Z',
  full: 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',
  music: 'M9 18V5l11-2v13M9 8l11-2M9 18c0 4-6 5-6 1s6-4 6-1Zm11-2c0 4-6 5-6 1s6-4 6-1Z',
  volume: 'm3 9 5 0 5-5v16l-5-5H3V9Zm14-2c4 3 4 7 0 10',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4m0 3v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  flag: 'M5 22V3m0 0h14l-3 5 3 5H5',
  close: 'm5 5 14 14M19 5 5 19',
  back: 'm14 5-7 7 7 7M7 12h14',
};
export function icon(id, size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[id] || ICONS.target}"/></svg>`;
}
const img = {};
for (const name of [
  'zombie_stand',
  'zombie_walk1',
  'zombie_walk2',
  'zombie_hurt',
  'zombie_attack',
  'soldier_stand',
  'soldier_back',
  'soldier_shoot',
]) {
  const i = new Image();
  i.src = new URL('./assets/characters/' + name + '.png', import.meta.url);
  img[name] = i;
}
const seeded = (n) => {
  const v = Math.sin(n * 127.1 + 74.7) * 43758.5453;
  return v - Math.floor(v);
};
function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function circle(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}
function stroke(c, points, color, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}
export function createRenderer(canvas) {
  const c = canvas.getContext('2d', { alpha: false }),
    dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  c.scale(dpr, dpr);
  const background = document.createElement('canvas');
  background.width = WIDTH;
  background.height = HEIGHT;
  let current = -1;
  function prepare(info) {
    if (current === info.chapter) return;
    current = info.chapter;
    const b = background.getContext('2d');
    b.fillStyle = info.theme.edge;
    b.fillRect(0, 0, 540, 800);
    // Perspective street, sidewalks, building rooftops, debris and faded markings.
    rect(b, 36, 0, 468, 650, info.theme.road);
    rect(b, 34, 0, 8, 650, '#536063');
    rect(b, 498, 0, 8, 650, '#536063');
    for (let y = 0; y < 650; y += 48) {
      rect(b, 34, y, 8, 2, '#202a2d');
      rect(b, 498, y, 8, 2, '#202a2d');
    }
    for (let y = -20; y < 640; y += 98) {
      rect(b, 265, y, 9, 42, '#b7b99029');
      rect(b, 152, y, 3, 42, '#b7b99014');
      rect(b, 386, y, 3, 42, '#b7b99014');
    }
    for (let i = 0; i < 90; i++) {
      const x = 48 + seeded(i) * 440,
        y = seeded(i + 115) * 640;
      b.fillStyle = i % 3 ? '#0000000e' : '#d4d8c10b';
      b.fillRect(x, y, seeded(i + 12) * 9 + 1, seeded(i + 3) * 3 + 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = seeded(i + 19) * 520,
        y = seeded(i + 99) * 620;
      stroke(
        b,
        [
          [x, y],
          [x + 9, y + 8],
          [x + 3, y + 19],
          [x + 18, y + 28],
        ],
        '#151d2455',
        1,
      );
    }
    // Silhouettes at either side of the approach.
    for (const x of [-27, 507]) {
      for (let y = 20; y < 620; y += 136) {
        rect(b, x, y, 55, 90, '#1a262b');
        rect(b, x + 3, y + 3, 49, 4, '#536165');
        for (let yy = 20; yy < 75; yy += 22) {
          rect(b, x + 9, y + yy, 10, 11, '#687c6b55');
          rect(b, x + 32, y + yy, 10, 11, '#c6ac5433');
        }
        rect(b, x + 43, y + 60, 13, 34, '#131f24');
      }
    }
    for (const [x, y, a] of [
      [80, 175, -0.18],
      [442, 380, 0.16],
    ]) {
      b.save();
      b.translate(x, y);
      b.rotate(a);
      rect(b, -20, -40, 40, 80, '#1d2b30');
      rect(b, -18, -34, 36, 65, '#4b6465');
      rect(b, -15, -20, 30, 17, '#a1b9b755');
      rect(b, -15, 9, 30, 17, '#15262e');
      rect(b, -25, -29, 6, 18, '#172126');
      rect(b, 19, 12, 6, 18, '#172126');
      rect(b, -12, -37, 9, 3, '#c9c38a');
      b.restore();
    }
    rect(b, 0, 645, 540, 155, '#1b272c');
    rect(b, 0, 645, 540, 5, '#a7b7a5');
    for (let x = -15; x < 550; x += 52) {
      b.save();
      b.translate(x, 654);
      b.transform(1, 0, -0.45, 1, 0, 0);
      rect(b, 0, 0, 25, 10, '#f6c16b');
      b.restore();
    }
    rect(b, 0, 668, 540, 6, '#0c171d');
    for (let x = 0; x < 540; x += 61) {
      rect(b, x + 2, 673, 57, 19, '#6b7972');
      rect(b, x + 5, 675, 51, 5, '#94a08a');
      rect(b, x + 2, 688, 57, 5, '#374c4a');
    }
    rect(b, 30, 744, 480, 2, '#3d514f');
    b.font = '10px monospace';
    b.fillStyle = '#71867e';
    b.fillText(
      'SECTOR ' + String(info.chapter + 1).padStart(2, '0') + '  /  KEEP THE LINE',
      164,
      778,
    );
  }
  function zombie(e, t) {
    c.save();
    c.translate(e.x, e.y);
    const scale = e.r / 17,
      bob = Math.sin(t * 8 + e.phase) * (e.freeze ? 0 : 2),
      w = 42 * scale,
      h = 58 * scale;
    c.globalAlpha = 0.28;
    circle(c, 0, 18 * scale, 20 * scale, '#000');
    c.globalAlpha = 1;
    const pose = e.flash
        ? 'hurt'
        : e.y > 620
          ? 'attack'
          : Math.sin(t * 8 + e.phase) > 0
            ? 'walk1'
            : 'walk2',
      image = img['zombie_' + pose];
    if (e.slow) {
      circle(c, 0, 10 * scale, 27 * scale, '#8decff25');
      stroke(
        c,
        [
          [-18 * scale, 20 * scale],
          [0, 24 * scale],
          [18 * scale, 20 * scale],
        ],
        '#a5f3ff',
        2,
      );
    }
    if (image?.complete && image.naturalWidth) {
      if (e.type === 'runner') c.filter = 'hue-rotate(310deg) saturate(.7)';
      if (e.type === 'spitter') c.filter = 'hue-rotate(20deg) saturate(1.6)';
      if (e.type === 'boss') c.filter = 'hue-rotate(325deg) saturate(.8)';
      c.drawImage(image, -w / 2, -h * 0.65 + bob, w, h);
      c.filter = 'none';
    } else {
      rect(c, -12 * scale, -8 * scale, 24 * scale, 27 * scale, e.color);
      circle(c, 0, -16 * scale, 14 * scale, e.color);
      rect(c, -18 * scale, 1, 8 * scale, 20 * scale, e.color);
      rect(c, 12 * scale, 1, 8 * scale, 20 * scale, e.color);
      circle(c, -5 * scale, -18 * scale, 2, '#ebeea0');
      circle(c, 5 * scale, -18 * scale, 2, '#ebeea0');
    }
    if (e.type === 'armor') {
      rect(c, -15 * scale, -15 * scale, 30 * scale, 20 * scale, '#374d60cc');
      stroke(
        c,
        [
          [-13 * scale, -8 * scale],
          [13 * scale, -8 * scale],
        ],
        '#a6bcc8',
        3,
      );
    }
    if (e.type === 'bomber') {
      circle(c, 0, 5 * scale, 10 * scale, '#e8a24d');
      c.fillStyle = '#652e24';
      c.font = `bold ${13 * scale}px sans-serif`;
      c.textAlign = 'center';
      c.fillText('!', 0, 10 * scale);
    }
    if (e.burn > 0)
      for (let k = 0; k < 3; k++)
        circle(c, (k - 1) * 8 * scale, 12 * scale - Math.sin(t * 18 + k) * 6, 4, '#ffb858a0');
    if (e.hp < e.maxHp || e.type === 'boss') {
      rect(c, -22 * scale, -h * 0.67 - 7, 44 * scale, 4, '#101a20');
      rect(
        c,
        -22 * scale,
        -h * 0.67 - 7,
        44 * scale * Math.max(0, e.hp / e.maxHp),
        4,
        e.type === 'boss' ? '#ff9b75' : '#bbd58e',
      );
    }
    c.restore();
  }
  function defender(x, y, scale, t, aim) {
    c.save();
    c.translate(x, y);
    circle(c, 0, 22 * scale, 22 * scale, '#080e1380');
    const image = img.soldier_back;
    if (image?.complete && image.naturalWidth)
      c.drawImage(image, -24 * scale, -37 * scale, 48 * scale, 66 * scale);
    else {
      rect(c, -15 * scale, -7 * scale, 30 * scale, 30 * scale, '#819381');
      circle(c, 0, -19 * scale, 15 * scale, '#9ba388');
    }
    c.translate(0, -10 * scale);
    const angle = Math.atan2((aim?.y || 0) - y, (aim?.x || 270) - x) + Math.PI / 2;
    c.rotate(Math.max(-0.75, Math.min(0.75, angle)));
    rect(c, -7 * scale, -37 * scale, 14 * scale, 40 * scale, '#1c2d33');
    rect(c, -4 * scale, -39 * scale, 8 * scale, 20 * scale, '#93a3a1');
    rect(c, -7 * scale, -13 * scale, 14 * scale, 6 * scale, '#e4b966');
    c.restore();
  }
  return {
    draw(g, { preview = false, time = 0 } = {}) {
      prepare(g.info);
      c.drawImage(background, 0, 0);
      const t = preview ? time : g.time;
      // Mist at the top edge keeps the threat readable without hiding silhouettes.
      const fog = c.createLinearGradient(0, 0, 0, 200);
      fog.addColorStop(0, '#0d171ce6');
      fog.addColorStop(1, '#0d171c00');
      c.fillStyle = fog;
      c.fillRect(0, 0, 540, 200);
      let enemies = g.enemies;
      if (preview)
        enemies = Array.from({ length: 18 }, (_, i) => ({
          id: i,
          type: i === 2 ? 'brute' : i === 7 ? 'armor' : 'walker',
          x: 70 + seeded(i + 12) * 400,
          y: 100 + seeded(i + 33) * 425,
          r: i === 2 ? 26 : 17,
          hp: 100,
          maxHp: 100,
          color: ENEMIES.walker.color,
          phase: i,
          flash: 0,
        }));
      for (const e of [...enemies].sort((a, b) => a.y - b.y)) zombie(e, t);
      defender(120, 720, 0.8, t, g.aim);
      defender(420, 720, 0.8, t, g.aim);
      defender(
        270,
        728,
        1.1,
        t,
        g.aim || enemies.reduce((a, b) => (!a || b.y > a.y ? b : a), null),
      );
      if (g.weapons.drone)
        for (const [i, x] of [
          [0, 140],
          [1, 400],
        ]) {
          const y = 584 + Math.sin(t * 3 + i) * 8;
          rect(c, x - 13, y - 4, 26, 9, '#9daeb1');
          stroke(
            c,
            [
              [x - 25, y - 8],
              [x + 25, y - 8],
            ],
            '#c6e5d2',
            2,
          );
          for (const dx of [-23, 23]) {
            circle(c, x + dx, y - 8, 9, '#d8ecc51a');
            stroke(
              c,
              [
                [x + dx - 11, y - 8],
                [x + dx + 11, y - 8],
              ],
              '#a9bdc5',
              1,
            );
          }
        }
      c.lineCap = 'round';
      for (const b of g.bullets) {
        stroke(
          c,
          [
            [b.x - b.vx * 0.027, b.y - b.vy * 0.027],
            [b.x, b.y],
          ],
          b.color,
          b.size,
        );
        circle(c, b.x, b.y, 2, '#fff6d1');
      }
      for (const f of g.effects) {
        const p = 1 - f.life / f.duration;
        c.save();
        c.globalAlpha = Math.max(0, 1 - p);
        if (['grenade', 'frost', 'airstrike', 'death', 'wallhit'].includes(f.type)) {
          const color = f.type === 'frost' ? '#a5efff' : f.type === 'death' ? '#a0b37e' : '#ffc071';
          const r = (f.r || 30) * (0.25 + p * 0.9);
          circle(c, f.x, f.y, r, color + (f.type === 'frost' ? '38' : '45'));
          c.strokeStyle = color;
          c.lineWidth = f.type === 'airstrike' ? 7 : 3;
          c.beginPath();
          c.arc(f.x, f.y, r, 0, TAU);
          c.stroke();
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU;
            stroke(
              c,
              [
                [f.x + Math.cos(a) * r * 0.6, f.y + Math.sin(a) * r * 0.6],
                [f.x + Math.cos(a) * r, f.y + Math.sin(a) * r],
              ],
              color,
              2,
            );
          }
        }
        if (f.type === 'muzzle') {
          circle(c, f.x, f.y, 10, '#ffe29c');
          circle(c, f.x, f.y - 9, 5, '#fff9d9');
        }
        if (f.type === 'spark') circle(c, f.x, f.y, 7 * (1 - p), f.color);
        if (f.type === 'text') {
          c.font = 'bold 18px monospace';
          c.textAlign = 'center';
          c.fillStyle = f.color;
          c.fillText(f.text, f.x, f.y - p * 30);
        }
        if (f.type === 'laser') {
          stroke(
            c,
            [
              [f.x, f.y],
              [f.tx, f.ty],
            ],
            '#ff728a55',
            f.r * 3,
          );
          stroke(
            c,
            [
              [f.x, f.y],
              [f.tx, f.ty],
            ],
            '#ffb7ca',
            f.r,
          );
          stroke(
            c,
            [
              [f.x, f.y],
              [f.tx, f.ty],
            ],
            '#fff',
            2,
          );
        }
        if (f.type === 'lightning') {
          for (let i = 1; i < f.path.length; i++) {
            const a = f.path[i - 1],
              b = f.path[i];
            stroke(
              c,
              [
                [a.x, a.y],
                [(a.x + b.x) / 2 + Math.sin(t * 80 + i) * 16, (a.y + b.y) / 2],
                [b.x, b.y],
              ],
              '#bce7ff',
              4,
            );
          }
        }
        c.restore();
      }
      if (g.aim && g.status === 'running') {
        const { x, y } = g.aim;
        c.strokeStyle = '#f8dd93';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x, y, 19, 0, TAU);
        c.stroke();
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          stroke(
            c,
            [
              [x + dx * 12, y + dy * 12],
              [x + dx * 26, y + dy * 26],
            ],
            '#f8dd93',
            1.5,
          );
      }
      if (!preview && g.combo >= 5) {
        c.fillStyle = '#f6d18a';
        c.font = 'italic bold 24px sans-serif';
        c.textAlign = 'right';
        c.fillText(g.combo + ' 连杀', 505, 570);
        c.textAlign = 'left';
      }
      const vignette = c.createRadialGradient(270, 380, 220, 270, 380, 470);
      vignette.addColorStop(0, '#030b1100');
      vignette.addColorStop(1, '#030b1170');
      c.fillStyle = vignette;
      c.fillRect(0, 0, 540, 800);
    },
  };
}
