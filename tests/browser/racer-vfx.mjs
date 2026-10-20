async (page) => {
  const assert = (v, m) => {
      if (!v) throw Error(m);
    },
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = () => page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  await page.locator('[data-action=start]:enabled').waitFor();
  assert((await page.locator('[data-pickup-icon]').count()) >= 5, 'five distinct legend icons');
  await page.locator('[data-action=cheats]').click();
  await page.locator('[data-cheat=infiniteEnergy]').uncheck();
  await page.locator('[data-cheat=infiniteDurability]').check();
  await page.getByRole('button', { name: '返回游戏', exact: true }).click();
  await page.locator('[data-action=levels]').click();
  await page.locator('button[data-level="1"]').click();
  await page.locator('[data-action=start]').click();
  await page.waitForFunction(
    () => document.querySelector('#racer-canvas').dataset.status === 'running',
  );
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const jump = await state();
  assert(
    +jump.energy >= 80 && +jump.energy < 83,
    '20 percent jump energy with normal regeneration',
  );
  assert(+jump.cooldown > 2 && +jump.cooldown <= 2.5, '2.5 second cooldown preserved');
  await page.waitForTimeout(1750);
  await page.keyboard.press('Shift');
  await page.waitForTimeout(700);
  const boost = await state();
  assert(
    +boost.exhaustParticles > 10 && +boost.exhaustParticles <= +boost.exhaustBudget,
    'active bounded particle plume',
  );
  const firstX = +boost.renderX;
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(120);
  const steer = await state();
  assert(+steer.renderX > firstX, 'steering remains responsive with particles');
  assert(
    steer.programs === boost.programs && steer.geometries === boost.geometries,
    'no runtime shader or geometry growth',
  );
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/racer-vfx-20261020/qa/game-nitro.png',
    scale: 'css',
  });
  await page.keyboard.press('Shift');
  await page.waitForTimeout(500);
  const stopped = await state();
  assert(+stopped.exhaustParticles === 0, 'plume expires promptly after nitro off');
  await page.locator('[data-action=pause]').click();
  assert(!errors.length, errors.join(';'));
  await page.evaluate((r) => (window.__vfxQA = r), {
    result: 'PASS',
    jump,
    boost,
    steer,
    stopped,
    errors,
  });
};
