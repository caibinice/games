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
  assert(
    await page.evaluate(() => !document.fullscreenElement),
    'must exercise window-only fallback',
  );
  const points = await page.evaluate(() => {
    const z = document.querySelector('[data-joystick]'),
      r = z.getBoundingClientRect();
    const point = (x, y) => ({ x: r.right - y, y: r.top + x });
    const b = document.querySelector('[data-input=jet]').getBoundingClientRect();
    return {
      base: point(85, z.clientHeight - 85),
      move: point(130, z.clientHeight - 85),
      jet: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const f = (p, id) => ({ ...p, id, radiusX: 8, radiusY: 8, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [f(points.base, 1)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [f(points.move, 1)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [f(points.move, 1), f(points.jet, 2)],
  });
  await page.waitForTimeout(650);
  const air = await page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(air.lane) === 2 && Number(air.height) > 3, 'two-finger steering/jet');
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/vue-racing-20261018/racer-mobile-jet.png',
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(1200);
  const landed = await page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(landed.height) === 0, 'mobile landing');
  await page.locator('[data-action=pause]').click();
  await page.locator('.race-secondary').click();
  assert((await page.locator('.racer-levels [data-level]').count()) === 30, '30 levels');
  const modal = await page.locator('dialog').boundingBox();
  assert(
    modal.x >= 0 && modal.y >= 0 && modal.x + modal.width <= 392 && modal.y + modal.height <= 846,
    'rotated modal bounds',
  );
  await page.locator('[data-level="30"]').click();
  await page.waitForTimeout(150);
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/vue-racing-20261018/racer-mobile-night.png',
  });
  await page.keyboard.press('Escape');
  assert((await page.locator('.play-full').count()) === 0, 'window fallback exit');
  await page.reload();
  await page.getByRole('button', { name: '开始疾驰 ↗' }).waitFor();
  const restored = await page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(restored.level) === 30, 'racer storage');
  await page.evaluate((result) => (window.__qaResult = result), {
    result: 'PASS',
    bounds,
    air,
    landed,
    modal,
    restored,
    errors,
  });
  assert(errors.length === 0, 'page errors');
};
