async (page) => {
  const assert = (v, m) => {
      if (!v) throw Error(m);
    },
    errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/\/assets\/audio\//.test(r.url())) requests.push(r.url());
  });
  await page.setViewportSize({ width: 844, height: 390 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 3,
    mobile: true,
    screenOrientation: { type: 'landscapePrimary', angle: 90 },
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.addInitScript(() => {
    window.__frames = [];
    window.__samples = [];
    window.__cueDurations = [];
    window.__longFrames = [];
    let previous = 0,
      epoch = '';
    function frame(now) {
      const c = document.querySelector('#racer-canvas');
      if (c?.dataset.status === 'running') {
        if (epoch !== c.dataset.runEpoch) {
          previous = 0;
          epoch = c.dataset.runEpoch;
        }
        if (previous) {
          window.__frames.push(now - previous);
          if (now - previous > 100)
            window.__longFrames.push({
              gap: now - previous,
              distance: c.dataset.distance,
              epoch,
              dialog: document.querySelector('dialog')?.id,
            });
        }
        previous = now;
        window.__samples.push({ ...c.dataset });
      } else previous = 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    const Native = window.AudioContext || window.webkitAudioContext;
    if (Native)
      window.AudioContext = new Proxy(Native, {
        construct(T, args) {
          const c = Reflect.construct(T, args);
          const create = c.createBufferSource.bind(c);
          c.createBufferSource = () => {
            const s = create(),
              start = s.start.bind(s);
            s.start = (...a) => {
              window.__cueDurations.push(s.buffer.duration);
              return start(...a);
            };
            return s;
          };
          return c;
        },
      });
  });
  await page.reload();
  await page.locator('[data-action=start]:enabled').waitFor();
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () => Promise.reject(Error('QA'));
    screen.orientation.lock = () => Promise.reject(Error('QA'));
  });
  await page.locator('[data-action=levels]').click();
  await page.locator('button[data-level="1"]').click();
  await page.locator('[data-action=cheats]').click();
  await page.locator('[data-cheat=infiniteEnergy]').uncheck();
  await page.locator('[data-cheat=infiniteDurability]').uncheck();
  await page.getByRole('button', { name: '返回游戏', exact: true }).click();
  // Reset the prior assisted run after clearing preferences.
  await page.locator('[data-action=levels]').click();
  await page.locator('button[data-level="1"]').click();
  const state = () => page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  const dimensions = await page.locator('[data-lane=left]').boundingBox();
  assert(dimensions.width >= 95 && dimensions.height >= 89, 'larger direction hit targets');
  assert((await state()).prewarmed === 'true', 'GPU/materials warm before Start');
  await page.locator('[data-action=start]').click();
  await page.waitForFunction(
    () => document.querySelector('#racer-canvas').dataset.status === 'running',
  );
  const tap = async (selector, hold = 30) => {
    const b = await page.locator(selector).boundingBox();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }],
    });
    await page.waitForTimeout(hold);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await tap('[data-lane=right]', 200);
  const right = await state();
  assert(+right.lane === 2 && +right.x === 3.2, 'one touch held stays in one lane');
  await tap('[data-lane=left]');
  await page.waitForTimeout(100);
  const left = await state();
  assert(+left.lane === 1 && +left.x === 0, 'quick response returns one lane');
  await page.waitForFunction(() => window.__samples.some((s) => +s.hp < 6));
  await page.waitForTimeout(300);
  const damaged = await state();
  const minimumHp = await page.evaluate(() => Math.min(...window.__samples.map((s) => +s.hp)));
  assert(+damaged.hp > 0 && minimumHp < 6, 'real collisions reduce the six-point health');
  await page.locator('[data-action=cheats]').click();
  await page.locator('[data-cheat=infiniteEnergy]').check();
  await page.locator('[data-cheat=infiniteDurability]').check();
  await page.getByRole('button', { name: '返回游戏', exact: true }).click();
  await page.locator('[data-action=start]').click();
  await page.waitForFunction(
    () => document.querySelector('#racer-canvas').dataset.status === 'running',
  );
  await tap('[data-input=boost]');
  await tap('[data-input=jet]');
  await page.waitForTimeout(150);
  const firstJump = await state();
  await tap('[data-input=jet]');
  await page.waitForTimeout(100);
  const secondTap = await state();
  assert(
    +secondTap.cooldown < +firstJump.cooldown - 0.05,
    'air tap does not reset jump or cooldown',
  );
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(
      () => +document.querySelector('#racer-canvas').dataset.cooldown === 0,
    );
    await tap('[data-input=jet]');
    await page.waitForTimeout(250);
  }
  const assisted = await state();
  assert(+assisted.hp === 6 && +assisted.energy === 100, 'unlimited health and energy');
  await page.locator('[data-action=pause]').click();
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/racer-feel-20261018/qa/assist-wide.png',
    scale: 'css',
  });
  const stats = await page.evaluate(() => {
    const frames = window.__frames.filter((n) => n > 0).sort((a, b) => a - b),
      samples = window.__samples;
    return {
      frames: frames.length,
      median: frames[Math.floor(frames.length * 0.5)],
      p95: frames[Math.floor(frames.length * 0.95)],
      max: frames.at(-1),
      longFrames: frames.filter((n) => n > 100).length,
      allVisible: samples.every((s) => s.playerVisible === 'true'),
      resizes: [...new Set(samples.map((s) => s.resizeCount))],
      programs: [...new Set(samples.map((s) => s.programs))],
      geometries: [...new Set(samples.map((s) => s.geometries))],
      cueDurations: window.__cueDurations,
      longFrameDetails: window.__longFrames,
    };
  });
  assert(stats.allVisible, 'no vehicle blinking even during real hit invulnerability');
  assert(stats.resizes.length <= 2, 'no per-frame canvas resets');
  assert(
    stats.programs.length === 1 && stats.geometries.length === 1,
    'no first-encounter shader/geometry uploads',
  );
  assert(
    stats.cueDurations.length >= 5 && stats.cueDurations.every((n) => n <= 0.241),
    'only short responsive audio cues',
  );
  assert(
    !requests.some((u) => /\/(engine|skid|impact|land|thruster)\.ogg/.test(u)),
    'old noisy sounds not requested',
  );
  assert(
    +right.inputRenderMs < 100 && +left.inputRenderMs < 100,
    'input to render under 100ms in browser',
  );
  assert(!errors.length, 'page errors: ' + errors.join(';'));
  await page.reload();
  await page.locator('[data-action=start]:enabled').waitFor();
  const restored = await state();
  assert(
    restored.infiniteEnergy === 'true' && restored.infiniteDurability === 'true',
    'cheat preferences persisted',
  );
  await page.evaluate((r) => (window.__feelQA = r), {
    result: 'PASS',
    dimensions,
    right,
    left,
    damaged,
    minimumHp,
    assisted,
    stats,
    requests,
    restored,
    errors,
  });
};
