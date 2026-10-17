async (page) => {
  const assert = (v, m) => {
    if (!v) throw Error(m);
  };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '开始疾驰 ↗' }).click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  const moved = await page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(moved.lane) === 2 && Number(moved.x) > 2, 'keyboard lane');
  await page.keyboard.down('Space');
  await page.waitForTimeout(740);
  const air = await page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(air.height) > 3.5 && Number(air.roll) > 2, 'jet rise/roll');
  await page.screenshot({ path: 'E:/Documents/AI/codex/tmp/vue-racing-20261018/racer-jet-pc.png' });
  await page.keyboard.up('Space');
  await page.waitForTimeout(1150);
  const landed = await page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(landed.height) === 0 && Number(landed.roll) === 0, 'landing');
  await page.locator('[data-action=pause]').click();
  await page.keyboard.press('KeyF');
  await page.locator('.play-full').waitFor();
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/vue-racing-20261018/racer-pc-full.png',
  });
  const full = await page.locator('.racer-shell').boundingBox();
  assert(full.width >= 1438 && full.height >= 898, 'PC fullscreen');
  await page.keyboard.press('Escape');
  await page.evaluate((result) => (window.__qaResult = result), {
    result: 'PASS',
    moved,
    air,
    landed,
    full,
    errors,
  });
  assert(!errors.length, 'runtime errors');
};
