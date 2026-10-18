async (page) => {
  const assert = (v, m) => {
      if (!v) throw Error(m);
    },
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () =>
      Promise.reject(new Error('QA: fullscreen unavailable'));
  });
  await page.getByRole('button', { name: '开始疾驰 ↗' }).click();
  await page.locator('.play-full.virtual-landscape').waitFor();
  const bounds = await page.locator('.racer-shell').boundingBox();
  assert(
    bounds.x >= -1 && bounds.y >= -1 && bounds.width <= 392 && bounds.height <= 846,
    'fallback rotated crop',
  );
  assert(await page.evaluate(() => !document.fullscreenElement), 'window-only fallback');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const point = async (selector) => {
    const b = await page.locator(selector).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1, radiusX: 8, radiusY: 8, force: 1 };
  };
  const tap = async (selector, hold = 35) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [await point(selector)],
    });
    await page.waitForTimeout(hold);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const state = () => page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  await tap('[data-lane=right]', 250);
  const held = await state();
  assert(+held.lane === 2, 'holding right changes only one lane');
  await tap('[data-lane=left]');
  assert(+(await state()).lane === 1, 'one left click changes one lane');
  await tap('[data-input=boost]');
  await page.waitForTimeout(150);
  const boosting = await state();
  assert(boosting.nitro === 'true' && +boosting.boost > 0, 'nitro stays on after release');
  await tap('[data-input=boost]');
  assert((await state()).nitro === 'false', 'second click turns nitro off');
  await tap('[data-input=jet]');
  await page.waitForFunction(() => +document.querySelector('#racer-canvas').dataset.height > 3);
  const air = await state();
  assert(+air.height > 3 && +air.cooldown > 4, 'touch jet rise and cooldown');
  assert(
    /\d\.\d+s/.test(await page.locator('[data-jet-countdown]').innerText()),
    'visible numeric cooldown',
  );
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/racer-upgrade-20261018/qa/mobile-jet.png',
  });
  await page.waitForFunction(() => +document.querySelector('#racer-canvas').dataset.height === 0);
  const landed = await state();
  assert(+landed.height === 0 && +landed.cooldown > 2, 'landed while cooldown remains');
  await tap('[data-input=jet]');
  await page.getByRole('status').filter({ hasText: '喷气冷却还剩' }).waitFor();
  assert(
    /冷却还剩/.test(await page.locator('.race-notice').innerText()),
    'repeat jet explains cooldown',
  );
  await page.locator('[data-action=pause]').click();
  const paused = await state();
  assert(paused.musicPlaying === 'false', 'pause stops background music');
  await page.waitForTimeout(200);
  assert((await state()).distance === paused.distance, 'pause freezes race');
  await page.getByRole('button', { name: '选择关卡', exact: true }).click();
  assert((await page.locator('.racer-levels [data-level]').count()) === 30, '30 levels');
  const modal = await page.locator('dialog').boundingBox();
  assert(
    modal.x >= 0 && modal.y >= 0 && modal.x + modal.width <= 392 && modal.y + modal.height <= 846,
    'rotated modal bounds',
  );
  await page.locator('[data-level="6"]').click();
  await page.waitForTimeout(200);
  const lava = await state();
  assert(lava.theme === 'lava' && lava.model === 'parking-mobile', 'mobile LOD and lava theme');
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/racer-upgrade-20261018/qa/mobile-lava.png',
  });
  await page.keyboard.press('Escape');
  assert((await page.locator('.play-full').count()) === 0, 'window fallback exit');
  await page.reload();
  await page.getByRole('button', { name: '开始疾驰 ↗' }).waitFor();
  const restored = await state();
  assert(+restored.level === 6, 'racer storage');
  assert(!errors.length, 'page errors: ' + errors.join('; '));
  await page.evaluate((result) => (window.__qaResult = result), {
    result: 'PASS',
    bounds,
    held,
    boosting,
    air,
    landed,
    modal,
    lava,
    restored,
    errors,
  });
};
