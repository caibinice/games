import {
  WIDTH,
  HEIGHT,
  LAWN_X,
  LAWN_Y,
  CELL_W,
  LAWN_H,
  COLS,
  rowY,
  colX,
  PLANTS,
} from './engine.mjs';
import { plantImage } from './art.mjs';
const circle = (c, x, y, r, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
const rect = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};
const rand = (n) => {
  const k = Math.sin(n * 39.7) * 43758.5453;
  return k - Math.floor(k);
};
export function createRenderer(canvas, layer) {
  const c = canvas.getContext('2d', { alpha: false }),
    dpr = Math.min(devicePixelRatio || 1, 2),
    background = document.createElement('canvas');
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  c.scale(dpr, dpr);
  background.width = WIDTH;
  background.height = HEIGHT;
  let theme = -1;
  const nodes = new Map();
  function prepare(g) {
    if (theme === g.info.chapter) return;
    theme = g.info.chapter;
    const b = background.getContext('2d'),
      t = g.info.theme;
    b.fillStyle = t.sky;
    b.fillRect(0, 0, WIDTH, HEIGHT);
    // Garden hedge, picket fence, paving and the little house at the left edge.
    rect(b, 0, 122, 1080, 518, t.night ? '#314e42' : '#c9bb83');
    for (let i = 0; i < 33; i++) {
      circle(b, i * 36, 117 + rand(i) * 8, 26, t.night ? '#284c40' : '#577f3e');
      circle(b, i * 36 + 8, 108 + rand(i + 77) * 8, 18, t.night ? '#355d48' : '#6e994b');
    }
    rect(b, 130, 135, 830, 20, t.night ? '#546b5d' : '#d9d5aa');
    for (let x = 132; x < 975; x += 28) {
      rect(b, x, 124, 15, 39, t.night ? '#8d9a7c' : '#ece4bd');
      b.fillStyle = t.night ? '#8d9a7c' : '#ece4bd';
      b.beginPath();
      b.moveTo(x, 124);
      b.lineTo(x + 7, 113);
      b.lineTo(x + 15, 124);
      b.fill();
    }
    rect(b, 128, 136, 850, 6, t.night ? '#637c67' : '#bcb992');
    rect(b, 0, 143, 109, 450, t.night ? '#717663' : '#cfc1a1');
    rect(b, 0, 150, 84, 425, t.night ? '#565f54' : '#e6d4b0');
    rect(b, 12, 218, 64, 91, t.night ? '#272e3d' : '#7c9b9c');
    rect(b, 17, 223, 54, 81, t.night ? '#d6b968' : '#abd0c3');
    rect(b, 40, 223, 6, 81, '#eee0ad');
    rect(b, 17, 260, 54, 6, '#eee0ad');
    for (let y = 154; y < 580; y += 23) rect(b, 0, y, 82, 2, t.night ? '#3f514b' : '#b4a184');
    rect(b, 3, 442, 70, 125, t.night ? '#584d42' : '#9d7953');
    rect(b, 11, 452, 52, 108, t.night ? '#4b443d' : '#bc9060');
    circle(b, 55, 508, 4, '#e5c572');
    // Individual checkerboard squares are deliberately not perfectly flat.
    const h = LAWN_H / g.info.rows;
    for (let row = 0; row < g.info.rows; row++)
      for (let col = 0; col < COLS; col++) {
        const x = LAWN_X + col * CELL_W,
          y = LAWN_Y + row * h,
          water = t.pool && (row === 2 || row === 3);
        rect(
          b,
          x,
          y,
          CELL_W,
          h,
          water ? (t.night ? '#356f7d' : '#66b6c5') : t.grass[(row + col) % 2],
        );
        if (water) {
          for (let k = 0; k < 3; k++) {
            b.strokeStyle = '#c1edeb33';
            b.lineWidth = 2;
            b.beginPath();
            b.ellipse(
              x + 12 + k * 23,
              y + h * 0.45 + rand(col + row + k) * 18,
              12,
              3,
              0,
              0,
              Math.PI * 2,
            );
            b.stroke();
          }
        } else if (t.roof) {
          rect(b, x, y, CELL_W, 3, '#e2a07c66');
          rect(b, x + CELL_W - 3, y, 3, h, '#7e52434d');
          b.strokeStyle = '#7c514647';
          b.beginPath();
          b.arc(x + 44, y + h / 2, 30, 0, Math.PI);
          b.stroke();
        } else
          for (let k = 0; k < 8; k++) {
            const xx = x + rand(k + col * 7 + row) * CELL_W,
              yy = y + rand(k * 4 + row * 5 + col) * h;
            b.strokeStyle = t.night ? '#b3d79316' : '#436c3030';
            b.lineWidth = 1;
            b.beginPath();
            b.moveTo(xx, yy);
            b.lineTo(xx - 2, yy - 5);
            b.lineTo(xx + 1, yy - 2);
            b.lineTo(xx + 4, yy - 6);
            b.stroke();
          }
      }
    rect(b, 140, LAWN_Y, 8, LAWN_H, t.night ? '#6b8065' : '#d2d39a');
    rect(b, 944, LAWN_Y, 10, LAWN_H, t.night ? '#476250' : '#b2c58b');
    for (let row = 0; row < g.info.rows; row++)
      rect(b, 100, LAWN_Y + row * h + 5, 38, h - 10, t.night ? '#73766b' : '#d9cfaf');
    rect(b, 145, 588, 811, 10, t.night ? '#435846' : '#5d873d');
    for (let i = 0; i < 65; i++)
      circle(b, 148 + i * 12.5, 593 + rand(i + 110) * 9, 5, t.night ? '#5c7652' : '#8caa51');
    for (let i = 0; i < 7; i++) {
      const x = 985 + rand(i) * 70,
        y = 175 + i * 58;
      circle(b, x, y, 17, t.night ? '#526456' : '#7b9257');
      circle(b, x - 10, y + 4, 12, t.night ? '#5d7156' : '#99ac6c');
    }
  }
  function sprite(
    key,
    src,
    x,
    y,
    w,
    h,
    { type = '', hp = 1, ratio = 1, extra = '', opacity = 1 } = {},
  ) {
    let n = nodes.get(key);
    if (!n) {
      n = document.createElement('div');
      n.className = 'entity ' + type;
      n.innerHTML =
        '<img draggable="false" alt=""><span class="entity-hp"><i></i></span><span class="entity-extra"></span>';
      layer.appendChild(n);
      nodes.set(key, n);
    }
    const i = n.firstChild;
    if (i.getAttribute('src') !== src) i.src = src;
    n.style.left = (x / WIDTH) * 100 + '%';
    n.style.top = (y / HEIGHT) * 100 + '%';
    n.style.width = (w / WIDTH) * 100 + '%';
    n.style.height = (h / HEIGHT) * 100 + '%';
    n.style.opacity = opacity;
    n.style.zIndex = String(Math.floor(y));
    n.className = 'entity ' + type;
    n.querySelector('.entity-hp').style.visibility = hp < 1 ? 'visible' : 'hidden';
    n.querySelector('.entity-hp i').style.width = Math.max(0, hp) * 100 + '%';
    n.querySelector('.entity-extra').textContent = extra;
    return n;
  }
  return {
    draw(g, { preview = false, time = 0 } = {}) {
      prepare(g);
      c.drawImage(background, 0, 0);
      const active = new Set();
      let plants = g.plants,
        zombies = g.zombies,
        bases = g.bases;
      if (preview) {
        plants = Array.from({ length: 13 }, (_, i) => ({
          id: 'p' + i,
          kind:
            i < 5
              ? 'sunflower'
              : i < 10
                ? 'peashooter'
                : i === 10
                  ? 'wallnut'
                  : i === 11
                    ? 'snowpea'
                    : 'repeater',
          x: colX(i < 5 ? 0 : i < 10 ? 2 : 4),
          y: rowY(g, i % g.info.rows),
          row: i % g.info.rows,
          col: i < 5 ? 0 : 2,
          hp: 1,
          maxHp: 1,
          age: 22,
          digest: 0,
        }));
        zombies = Array.from({ length: 4 }, (_, i) => ({
          id: 'z' + i,
          kind: i === 1 ? 'cone' : i === 2 ? 'bucket' : 'zombie',
          x: 840 + rand(i) * 125,
          y: rowY(g, i % g.info.rows),
          hp: 1,
          maxHp: 1,
          eating: false,
        }));
        bases = [];
      }
      for (const b of bases) {
        const key = 'base' + b.id;
        active.add(key);
        sprite(key, plantImage(b.kind), b.x, b.y + 31, 82, 70, {
          hp: b.hp / b.maxHp,
          type: 'base',
        });
      }
      for (const p of plants) {
        const key = 'plant' + p.id;
        active.add(key);
        const sleeping = p.kind === 'puffshroom' && !g.info.theme.night;
        const n = sprite(
          key,
          plantImage(p.kind),
          p.x,
          p.y + 30,
          p.kind === 'cherrybomb' ? 100 : 76,
          p.kind === 'cherrybomb' ? 80 : 76,
          {
            hp: p.hp / p.maxHp,
            type: 'plant ' + (p.flash ? 'hurt' : ''),
            extra: sleeping
              ? 'Zzz'
              : p.kind === 'potatomine' && p.age < 10
                ? '准备中'
                : p.kind === 'chomper' && p.digest > 0
                  ? '消化中'
                  : '',
          },
        );
        n.style.filter = sleeping ? 'saturate(.4) brightness(.7)' : '';
      }
      for (const z of zombies) {
        const key = 'zombie' + z.id;
        active.add(key);
        const kind = ['newspaper', 'gargantuar'].includes(z.kind) ? 'zombie' : z.kind,
          scale = z.kind === 'gargantuar' ? 1.45 : 1;
        const src = new URL(
          './assets/zombies/' + kind + (z.eating ? '-attack' : '') + '.gif',
          import.meta.url,
        ).href;
        const offset = kind === 'football' ? 3 : ['cone', 'bucket'].includes(kind) ? 27 : 17;
        const n = sprite(key, src, z.x - offset * scale, z.y + 35, 128 * scale, 112 * scale, {
          hp: z.hp / z.maxHp,
          type: 'zombie ' + (z.slow ? 'frozen ' : '') + (z.flash ? 'hurt' : ''),
          extra: z.kind === 'newspaper' ? '▤' : z.kind === 'gargantuar' ? '巨人' : '',
        });
        if (z.kind === 'gargantuar') n.style.filter = 'sepia(.25) saturate(.8)';
      }
      for (const m of g.mowers)
        if (m.status !== 'used') {
          const key = 'mower' + m.row;
          active.add(key);
          sprite(
            key,
            new URL('./assets/interface/lawnmower.png', import.meta.url).href,
            m.x,
            rowY(g, m.row) + 27,
            64,
            52,
            { type: 'mower' },
          );
        }
      for (const s of g.suns) {
        const key = 'sun' + s.id;
        active.add(key);
        const n = sprite(
          key,
          new URL('./assets/effects/sun.gif', import.meta.url).href,
          s.x,
          s.y + 31,
          65,
          65,
          { type: 'sun', opacity: s.age > 11 ? 0.55 : 1 },
        );
        n.style.zIndex = '1000';
      }
      for (const [key, n] of nodes)
        if (!active.has(key)) {
          n.remove();
          nodes.delete(key);
        }
      for (const b of g.bullets) {
        const color =
          b.kind === 'ice'
            ? '#9ce6fa'
            : b.kind === 'spore'
              ? '#d3a4e4'
              : b.kind === 'cabbage'
                ? '#b1d770'
                : '#b2dc5c';
        let y = b.y;
        if (b.kind === 'cabbage') y -= Math.sin(Math.min(1, (b.x - b.origin) / 500) * Math.PI) * 75;
        circle(c, b.x + 2, y + 2, b.kind === 'cabbage' ? 12 : 8, '#33583766');
        circle(c, b.x, y, b.kind === 'cabbage' ? 11 : 7, color);
        circle(c, b.x - 2, y - 2, 2, '#ffffcd');
      }
      for (const f of g.effects) {
        const p = 1 - f.life / f.duration;
        c.save();
        c.globalAlpha = 1 - p;
        if (f.type === 'explosion') {
          circle(c, f.x, f.y, f.r * p, '#ffdf6655');
          circle(c, f.x, f.y, f.r * p * 0.6, '#ffae5477');
          c.strokeStyle = '#fff3b7';
          c.lineWidth = 5;
          c.beginPath();
          c.arc(f.x, f.y, f.r * p, 0, Math.PI * 2);
          c.stroke();
          c.fillStyle = '#694d32';
          c.textAlign = 'center';
          c.font = 'bold 44px serif';
          c.fillText('砰！', f.x, f.y - 10);
        }
        if (f.type === 'death') {
          for (let k = 0; k < 5; k++)
            circle(c, f.x + (k - 2) * p * 21, f.y + Math.sin(k) * p * 30, 6 * (1 - p), '#897e62');
        }
        if (f.type === 'squash') {
          c.fillStyle = '#dae498';
          c.textAlign = 'center';
          c.font = 'bold 28px sans-serif';
          c.fillText('压扁！', f.x, f.y - p * 30);
        }
        c.restore();
      }
      if (g.info.chapter === 3) {
        const mist = c.createLinearGradient(730, 0, 1080, 0);
        mist.addColorStop(0, '#b0c4c900');
        mist.addColorStop(1, '#9eb8bdba');
        c.fillStyle = mist;
        c.fillRect(730, 130, 350, 470);
      }
      if (g.info.theme.night) {
        c.fillStyle = '#14293915';
        c.fillRect(140, 150, 810, 440);
      }
    },
    dispose() {
      for (const n of nodes.values()) n.remove();
      nodes.clear();
    },
  };
}
