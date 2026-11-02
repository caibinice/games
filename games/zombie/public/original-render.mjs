import { NATIVE_MODELS } from './native-models.mjs';
import { createCompanionRenderer } from './combat-companions.mjs';
import { NATIVE_ART } from './native-art-data.mjs';
import { drawNativeBullet, drawNativeEffect, preloadNativeFx } from './native-fx.mjs';
import { createClientActors } from './client-render.mjs';
import { clientMonster } from './client-campaign.mjs';
import { createClientMaps } from './client-maps.mjs';
const ASSET = './assets/native-ui/';
const loaded = {};
for (const name of ['CQYT.webp', 'zmzg_zjm_button_ico_zb.webp', 'weapon-default.webp']) {
  const i = new Image();
  i.src = new URL(ASSET + name, import.meta.url);
  loaded[name] = i;
}
const P = (y) => 40 + y * 1.28,
  TAU = Math.PI * 2;
let frostImage;
function drawFrost(c, b) {
  if (!frostImage) {
    frostImage = new Image();
    frostImage.src = new URL('./assets/client-skills/frost-projectile.webp', import.meta.url);
  }
  if (!frostImage.complete || !frostImage.naturalWidth) return false;
  const w = b.variant === 'giant' ? 76 : b.variant === 'shard' ? 25 : 47;
  c.save();
  c.translate(b.x, P(b.y));
  c.rotate(Math.atan2(b.vy * 1.28, b.vx) + Math.PI);
  c.drawImage(frostImage, -w / 2, -w / 4, w, w / 2);
  c.restore();
  return true;
}
const circle = (c, x, y, r, color) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
};
function line(c, points, color, width) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}
export function createOriginalRenderer(canvas, stats = {}) {
  const c = canvas.getContext('2d', { alpha: false }),
    dpr = Math.min(2, devicePixelRatio || 1),
    native = createClientActors(c),
    maps = createClientMaps(c),
    companion = createCompanionRenderer(stats);
  let stage = null,
    actor = null,
    disposed = false,
    lastTime = 0,
    lastShots = null;
  preloadNativeFx().then((r) => {
    canvas.dataset.nativeFxLoaded = r.loaded;
    canvas.dataset.nativeFxTotal = r.total;
  });
  const actorCanvas = document.createElement('canvas');
  import('./assets/native-ui/player-runtime.mjs')
    .then((m) =>
      m.mountNativePlayer(
        actorCanvas,
        NATIVE_MODELS[stats.nativePlayerModel]?.battle || './assets/native-ui/',
        { width: 540, height: 500, x: 270, y: 430, scale: 1.6, auto: false },
      ),
    )
    .then((a) => {
      if (disposed) a.dispose();
      else {
        if (stats.nativePlayerModel) {
          const s = a.actor;
          s.scale.set(1);
          const b = s.getLocalBounds(),
            scale = Math.min(400 / Math.max(1, b.width), 450 / Math.max(1, b.height));
          s.scale.set(scale);
          s.position.set(270 - (b.x + b.width / 2) * scale, 490 - (b.y + b.height) * scale);
          a.update(0);
        }
        actor = a;
      }
    })
    .catch((error) => console.warn('战斗角色动画加载中断', error));
  canvas.width = 540 * dpr;
  canvas.height = 1200 * dpr;
  c.scale(dpr, dpr);
  return {
    dispose() {
      disposed = true;
      actor?.dispose();
      companion.dispose();
    },
    draw(g) {
      if (stage !== g.client) {
        stage = g.client;
        maps.select(stage);
        if (stage) native.preload(stage.waves.map((w) => clientMonster(w.MonsterID).frameModel));
      }
      const nativeMap = maps.draw();
      canvas.dataset.mapId = maps.mapId || '';
      canvas.dataset.mapSource = nativeMap ? 'client' : 'fallback';
      if (!nativeMap) {
        c.fillStyle = '#454b46';
        c.fillRect(0, 0, 540, 1200);
      }
      for (const s of g.specials) {
        if (s.type === 'vehicle') {
          const y = P(s.y);
          c.save();
          c.translate(s.x, y);
          c.fillStyle = '#4b5762';
          c.strokeStyle = '#2e2c2f';
          c.lineWidth = 4;
          c.beginPath();
          if (typeof c.roundRect === 'function') c.roundRect(-29, -44, 58, 88, 8);
          else c.rect(-29, -44, 58, 88);
          c.fill();
          c.stroke();
          c.fillStyle = '#a4aeb1';
          c.fillRect(-24, -27, 48, 37);
          c.fillStyle = '#3c4251';
          c.fillRect(-19, -23, 38, 19);
          c.fillStyle = '#252c31';
          for (const x of [-35, 28]) for (const yy of [-28, 22]) c.fillRect(x, yy, 10, 20);
          line(
            c,
            [
              { x: 0, y: 0 },
              { x: 0, y: -60 },
            ],
            '#737b7b',
            9,
          );
          c.restore();
        }
      }
      const zImage = loaded['zmzg_zjm_button_ico_zb.webp'];
      for (const e of [...g.enemies].sort((a, b) => a.y - b.y)) {
        const y = P(e.y),
          scale = e.r / 17,
          w = 86 * scale,
          h = 83 * scale,
          bob = Math.sin(g.time * 7 + e.phase) * (e.freeze ? 0 : 2);
        c.save();
        c.translate(e.x, y + bob);
        c.globalAlpha = 0.23;
        c.fillStyle = '#261d24';
        c.beginPath();
        c.ellipse(0, h * 0.4, 30 * scale, 10 * scale, 0, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
        if (e.flash)
          c.filter =
            (e.freeze > 0 ? 'sepia(.6) hue-rotate(150deg) saturate(1.7) ' : '') + 'brightness(1.8)';
        else if (e.freeze > 0 || e.slow > 0)
          c.filter = 'sepia(.6) hue-rotate(150deg) saturate(1.7)';
        else if (e.type === 'runner') c.filter = 'hue-rotate(35deg)';
        else if (e.type === 'bomber') c.filter = 'hue-rotate(275deg)';
        else if (e.type === 'boss') c.filter = 'sepia(.25) saturate(1.3)';
        const original = !!e.frameModel && native.draw(e, g.time);
        if (!original) {
          if (zImage.complete && zImage.naturalWidth) c.drawImage(zImage, -w / 2, -h * 0.67, w, h);
          else circle(c, 0, -8, 23 * scale, e.color);
        }
        c.filter = 'none';
        if (e.type === 'armor' && !original) {
          c.fillStyle = '#354857aa';
          c.fillRect(-17 * scale, -22 * scale, 34 * scale, 24 * scale);
          line(
            c,
            [
              { x: -16 * scale, y: -13 * scale },
              { x: 16 * scale, y: -13 * scale },
            ],
            '#a3bcc8',
            3,
          );
        }
        if (e.paralysis > 0) {
          c.strokeStyle = '#c9a7ff';
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(0, 0, 33 * scale, 13 * scale, Math.sin(g.time * 17) * 0.4, 0, TAU);
          c.stroke();
        }
        if (e.nativeWoundUntil > g.time) {
          c.font = 'bold 11px sans-serif';
          c.textAlign = 'center';
          c.fillStyle = '#ff9baf';
          c.fillText('重伤', 0, -53 * scale);
        }
        if (e.groundedUntil > g.time) {
          c.font = 'bold 11px sans-serif';
          c.textAlign = 'center';
          c.fillStyle = '#ccb6ff';
          c.fillText('紊乱', 0, -66 * scale);
        }
        if (e.frostbiteStacks > 0) {
          c.font = 'bold 12px sans-serif';
          c.textAlign = 'center';
          c.fillStyle = '#9af2ff';
          c.fillText('冻伤×' + e.frostbiteStacks, 0, -45 * scale);
        }
        if (e.burn > 0)
          for (let i = 0; i < 4; i++)
            circle(
              c,
              (i - 1.5) * 12 * scale,
              18 * scale - Math.sin(g.time * 15 + i) * 9,
              4,
              '#ffb027b0',
            );
        if (e.hp < e.maxHp || e.type === 'boss') {
          c.fillStyle = '#181714';
          c.fillRect(-28 * scale, -h * 0.7 - 8, 56 * scale, 4);
          c.fillStyle = e.type === 'boss' ? '#ff7f39' : '#a8dc42';
          c.fillRect(-28 * scale, -h * 0.7 - 8, 56 * scale * Math.max(0, e.hp / e.maxHp), 4);
        }
        c.restore();
      }
      c.lineCap = 'round';
      for (const b of g.bullets) {
        if (drawNativeBullet(c, b, P, g.time)) continue;
        if (b.nativeSkill && b.kind === 'frost' && drawFrost(c, b)) continue;
        line(
          c,
          [
            { x: b.x - b.vx * 0.027, y: P(b.y - b.vy * 0.027) },
            { x: b.x, y: P(b.y) },
          ],
          b.color,
          b.size,
        );
        circle(c, b.x, P(b.y), 2, '#fff8cf');
      }
      for (const f of g.effects) {
        const p = 1 - f.life / f.duration,
          y = P(f.y);
        c.save();
        c.globalAlpha = Math.min(1, 1 - p + 0.1);
        if (drawNativeEffect(c, f, P, g.time)) {
          c.restore();
          continue;
        }
        if (f.type === 'death' && f.frameModel) {
          c.translate(f.x, y);
          native.draw(f, g.time, { death: true, progress: p });
          c.restore();
          continue;
        }
        if (f.type === 'magnet-strike') {
          const color = f.nuclear ? '#fff1a9' : '#cdb8ff';
          line(
            c,
            [
              { x: f.x - 4, y: -20 },
              { x: f.x + 9, y: y * 0.45 },
              { x: f.x - 9, y: y * 0.55 },
              { x: f.x, y },
            ],
            color,
            f.nuclear ? 8 : 4,
          );
          circle(c, f.x, y, f.r * (0.5 + p), color + '88');
        }
        if (f.type === 'magnet-splash' || f.type === 'magnet-matrix') {
          const r = f.r * (0.65 + p * 0.35);
          circle(c, f.x, y, r, '#b9a0ff30');
          c.strokeStyle = '#c0a5ff';
          c.lineWidth = 2;
          c.beginPath();
          c.ellipse(f.x, y, r, r * 0.7, 0, 0, TAU);
          c.stroke();
          if (f.type === 'magnet-matrix')
            for (let i = -1; i <= 1; i++)
              line(
                c,
                [
                  { x: f.x - r, y: y + i * r * 0.28 },
                  { x: f.x + r, y: y + i * r * 0.28 },
                ],
                '#d1baff88',
                1,
              );
        }
        if (
          [
            'grenade',
            'airdrop',
            'frost',
            'iceblast',
            'fuel',
            'death',
            'wallhit',
            'airstrike',
          ].includes(f.type)
        ) {
          const cold = ['frost', 'iceblast'].includes(f.type),
            color = cold ? '#8deeff' : f.type === 'death' ? '#bd9f6e' : '#ffb641',
            r = (f.r || 30) * (0.15 + p * 0.8);
          circle(c, f.x, y, r, cold ? '#6bd7ff35' : '#ff9c293a');
          c.strokeStyle = color;
          c.lineWidth = cold ? 3 : 4;
          c.beginPath();
          c.arc(f.x, y, r, 0, TAU);
          c.stroke();
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * TAU;
            line(
              c,
              [
                { x: f.x + Math.cos(a) * r * 0.65, y: y + Math.sin(a) * r * 0.65 },
                { x: f.x + Math.cos(a) * r, y: y + Math.sin(a) * r },
              ],
              color,
              2,
            );
          }
        }
        if (['laser', 'guided'].includes(f.type)) {
          const to = { x: f.tx, y: P(f.ty) };
          line(c, [{ x: f.x, y }, to], f.type === 'guided' ? '#53f8ff65' : '#b3edff55', f.r * 4);
          line(c, [{ x: f.x, y }, to], '#e2ffff', f.r);
          line(c, [{ x: f.x, y }, to], '#fff', 2);
        }
        if (['lightning', 'electron'].includes(f.type))
          for (let i = 1; i < f.path.length; i++) {
            const a = f.path[i - 1],
              b = f.path[i];
            line(
              c,
              [
                { x: a.x, y: P(a.y) },
                { x: (a.x + b.x) / 2 + Math.sin(g.time * 90 + i) * 12, y: P((a.y + b.y) / 2) },
                { x: b.x, y: P(b.y) },
              ],
              f.type === 'electron' ? '#ffe075' : '#71dbff',
              3,
            );
          }
        if (f.type === 'electric' && f.points) {
          for (let i = 0; i < f.points.length; i++) {
            const q = f.points[i];
            circle(c, q.x, P(q.y), 10, '#e7d9ff');
            line(
              c,
              [
                { x: q.x, y: P(q.y) },
                { x: q.x, y: P(q.y) - 35 },
              ],
              '#ad89ff',
              6,
            );
            if (i)
              line(
                c,
                [
                  { x: f.points[i - 1].x, y: P(q.y) },
                  { x: q.x, y: P(q.y) },
                ],
                '#ccabff',
                3,
              );
          }
        }
        if (f.type === 'drone') {
          c.translate(f.x, y);
          c.rotate(g.time * 8);
          line(
            c,
            [
              { x: -24, y: 0 },
              { x: 24, y: 0 },
            ],
            '#d9ef9a',
            5,
          );
          line(
            c,
            [
              { x: 0, y: -24 },
              { x: 0, y: 24 },
            ],
            '#d9ef9a',
            5,
          );
          circle(c, 0, 0, 8, '#68734f');
        }
        if (f.type === 'vortex') {
          c.translate(f.x, y);
          c.rotate(g.time * 6);
          for (let k = 0; k < 4; k++) {
            c.strokeStyle = '#8cffe8a0';
            c.lineWidth = 6;
            c.beginPath();
            c.arc(0, 0, ((f.r || 80) * (k + 1)) / 4, k, k + 3.7);
            c.stroke();
          }
        }
        if (f.type === 'wind') {
          c.strokeStyle = '#aaffef';
          c.lineWidth = 6;
          for (let k = 0; k < 3; k++) {
            c.beginPath();
            c.ellipse(f.x, y + (k - 1) * 25, 230 * (0.2 + p), 24, 0, Math.PI, TAU);
            c.stroke();
          }
        }
        if (f.type === 'damage-text') {
          const value = Math.round(f.value),
            text = value >= 1000000 ? Math.round(value / 10000) + '万' : String(value),
            scale = f.critical ? 1 + Math.max(0, 1 - p * 5) * 0.35 : 1;
          c.save();
          c.translate(f.x + (f.drift || 0) * p, y - p * 48);
          c.scale(scale, scale);
          c.font = (f.critical ? 'italic bold 23px' : 'bold 18px') + ' sans-serif';
          c.textAlign = 'center';
          c.lineWidth = 3;
          c.strokeStyle = '#29222d';
          c.fillStyle = f.critical ? '#ffdc59' : '#fff9e8';
          c.strokeText(text, 0, 0);
          c.fillText(text, 0, 0);
          c.restore();
        }
        if (f.type === 'muzzle') circle(c, f.x, y, 7, '#fff2ab');
        if (f.type === 'spark') circle(c, f.x, y, 5 * (1 - p), f.color);
        if (f.type === 'text') {
          c.font = 'bold 16px sans-serif';
          c.textAlign = 'center';
          c.fillStyle = f.color;
          c.fillText(f.text, f.x, y - p * 35);
        }
        c.restore();
      }
      const wall = loaded['CQYT.webp'];
      if (wall.complete && wall.naturalWidth) c.drawImage(wall, 0, P(650) - 8, 540, 180);
      companion.draw(c, g, Math.max(0, Math.min(0.05, g.time - lastTime)));
      if (actor) {
        const dt = Math.max(0, Math.min(0.05, g.time - lastTime));
        const shotMarker = g.nativeLastRoundAt ?? g.magazine?.shots;
        if (shotMarker !== lastShots) {
          const anim = actor.animations.find((n) => /skill1_1|attack|shoot|fire/i.test(n));
          if (anim) actor.setAnimation(anim, false);
          lastShots = shotMarker;
        }
        actor.update(dt);
        c.drawImage(actorCanvas, 0, 0, 540, 500, 110, 740, 320, 300);
        lastTime = g.time;
      }
      const gunPath = NATIVE_ART[stats.nativeGun?.DisPlayIconName];
      if (gunPath && !loaded[gunPath]) {
        const im = new Image();
        im.src = new URL(gunPath, import.meta.url);
        loaded[gunPath] = im;
      }
      const weapon = loaded[gunPath] || loaded['weapon-default.webp'];
      if (weapon.complete && weapon.naturalWidth) c.drawImage(weapon, 273, 910, 21, 76);
      if (g.aim) {
        c.strokeStyle = '#fff7b0';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(g.aim.x, P(g.aim.y), 19, 0, TAU);
        c.stroke();
        line(
          c,
          [
            { x: g.aim.x - 28, y: P(g.aim.y) },
            { x: g.aim.x + 28, y: P(g.aim.y) },
          ],
          '#fff7b0',
          1,
        );
      }
      if (g.combo >= 6) {
        c.textAlign = 'center';
        c.fillStyle = '#ffdd67';
        c.font = 'italic bold 22px sans-serif';
        c.strokeStyle = '#7c3a13';
        c.lineWidth = 3;
        c.strokeText(g.combo + ' 连击', 435, 730);
        c.fillText(g.combo + ' 连击', 435, 730);
      }
    },
  };
}
