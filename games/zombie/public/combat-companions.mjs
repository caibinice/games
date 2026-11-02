import { NATIVE_MODELS } from './native-models.mjs';
export function createCompanionRenderer(stats) {
  let actor = null,
    core = null,
    disposed = false,
    lastShots = 0,
    lastCoreShots = 0;
  const canvas = document.createElement('canvas'),
    coreCanvas = document.createElement('canvas'),
    model = NATIVE_MODELS[stats?.mercenary?.modelId]?.battle,
    coreModel = NATIVE_MODELS[stats?.nativeCoreModel]?.battle;
  if (model)
    import('./assets/native-ui/player-runtime.mjs')
      .then((m) => m.mountNativePlayer(canvas, model, { width: 300, height: 400, auto: false }))
      .then((a) => {
        if (disposed) {
          a.dispose();
          return;
        }
        const s = a.actor;
        s.scale.set(1);
        const b = s.getLocalBounds(),
          scale = Math.min(240 / Math.max(1, b.width), 350 / Math.max(1, b.height));
        s.scale.set(scale);
        s.position.set(150 - (b.x + b.width / 2) * scale, 380 - (b.y + b.height) * scale);
        a.update(0);
        actor = a;
      })
      .catch((error) => console.warn('佣兵骨骼载入中断', error));
  if (coreModel)
    import('./assets/native-ui/player-runtime.mjs')
      .then((m) =>
        m.mountNativePlayer(coreCanvas, coreModel, { width: 320, height: 320, auto: false }),
      )
      .then((a) => {
        if (disposed) {
          a.dispose();
          return;
        }
        const s = a.actor;
        s.scale.set(1);
        const b = s.getLocalBounds(),
          scale = Math.min(270 / Math.max(1, b.width), 270 / Math.max(1, b.height));
        s.scale.set(scale);
        s.position.set(160 - (b.x + b.width / 2) * scale, 285 - (b.y + b.height) * scale);
        a.update(0);
        core = a;
      })
      .catch((error) => console.warn('幻形骨骼载入中断', error));
  function fireAnimation(a) {
    const fire = a.animations.find((n) => /skill1|attack|shoot/i.test(n)),
      idle = a.animations.find((n) => /idle/i.test(n));
    if (fire) {
      a.setAnimation(fire, false);
      if (idle) a.actor.state.addAnimation(0, idle, true, 0);
    }
  }
  return {
    draw(c, g, dt) {
      if (actor) {
        if (lastShots !== (g.mercenaryShots || 0)) {
          fireAnimation(actor);
          lastShots = g.mercenaryShots || 0;
        }
        actor.update(dt);
        c.drawImage(canvas, 22, 815, 150, 200);
      }
      if (core) {
        if (lastCoreShots !== (g.nativeCoreCasts || 0)) {
          fireAnimation(core);
          lastCoreShots = g.nativeCoreCasts || 0;
        }
        core.update(dt);
        c.drawImage(coreCanvas, 375, 850 + Math.sin(g.time * 2) * 6, 125, 125);
      }
    },
    dispose() {
      disposed = true;
      actor?.dispose();
      core?.dispose();
    },
  };
}
