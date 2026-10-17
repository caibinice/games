async (page) => {
  const assert = (v, m) => {
    if (!v) throw Error(m);
  };
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await page.locator('body').getAttribute('data-game');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.locator('#load-status').filter({ hasText: '资源就绪' }).waitFor({ state: 'attached' });
  if ((await page.locator('#game-canvas').getAttribute('data-status')) === 'running')
    await page.locator('[data-action=pause]').click();
  if (await page.locator('[data-action=retry]').count())
    await page.locator('[data-action=retry]').click();
  await page.locator('[data-action=cheats]').click();
  await page.locator('[data-cheat=infiniteLives]').check();
  if (id === 'contra') {
    await page.locator('[data-cheat=invincible]').check();
    await page.locator('[data-cheat=airJump]').check();
  } else await page.locator('[data-cheat=rapidFire]').check();
  await page.locator('[data-close=cheats-dialog]').last().click();
  await page.locator('[data-action=start]').click();
  await page.locator('.play-full.virtual-landscape').waitFor({ state: 'attached' });
  const bounds = await page.locator('.classic-shell').boundingBox();
  assert(
    Math.abs(bounds.x) < 2 && Math.abs(bounds.y) < 2 && bounds.width <= 392 && bounds.height <= 846,
    'rotated layout cropped',
  );
  await page.waitForTimeout(id === 'tank' ? 1700 : 100);
  const before = await page.locator('#game-canvas').evaluate((c) => ({ ...c.dataset }));
  const points = await page.evaluate(() => {
    const zone = document.querySelector('[data-joystick]'),
      r = zone.getBoundingClientRect();
    const rotated = document.querySelector('.virtual-landscape') !== null;
    const point = (x, y) =>
      rotated ? { x: r.right - y, y: r.top + x } : { x: r.left + x, y: r.top + y };
    const base = point(90, zone.clientHeight - 85),
      move = point(132, zone.clientHeight - 85);
    const center = (sel) => {
      const b = document.querySelector(sel).getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    return {
      base,
      move,
      fire: center('[data-input=fire]'),
      jump: document.querySelector('[data-input=jump]') ? center('[data-input=jump]') : null,
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const finger = (p, id) => ({ ...p, id, radiusX: 8, radiusY: 8, force: 1 });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger(points.base, 1)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [finger(points.move, 1)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger(points.move, 1), finger(points.fire, 2)],
  });
  await page.waitForTimeout(400);
  const moved = await page.locator('#game-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(Number(moved.playerX) > Number(before.playerX), 'joystick did not move right');
  assert(Number(moved.projectiles) > 0, 'simultaneous fire failed');
  let jumped = null;
  if (points.jump) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [finger(points.move, 1), finger(points.fire, 2), finger(points.jump, 3)],
    });
    await page.waitForTimeout(100);
    jumped = await page.locator('#game-canvas').evaluate((c) => ({ ...c.dataset }));
    assert(Number(jumped.playerY) < Number(moved.playerY), 'third-finger jump failed');
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  assert(
    (await page.locator('.floating-action.pressed,.floating-stick.pressed').count()) === 0,
    'stuck touch UI',
  );
  await page.locator('[data-action=pause]').click();
  await page.screenshot({
    path: 'E:/Documents/AI/codex/tmp/vue-racing-20261018/' + id + '-mobile-touch.png',
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);
  assert((await page.locator('.virtual-landscape').count()) === 0, 'wide screen should not rotate');
  const wide = await page.locator('.classic-shell').boundingBox();
  assert(wide.width <= 846 && wide.height <= 392, 'wide layout cropped');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert((await page.locator('.play-full').count()) === 0, 'exit fullscreen failed');
  await page.reload();
  await page.locator('#load-status').filter({ hasText: '资源就绪' }).waitFor({ state: 'attached' });
  const restored = await page.locator('#game-canvas').evaluate((c) => ({ ...c.dataset }));
  assert(JSON.parse(restored.cheats).infiniteLives === true, 'v1 cheats not preserved');
  console.log(
    JSON.stringify({ result: 'PASS', id, bounds, wide, before, moved, jumped, restored, errors }),
  );
  assert(errors.length === 0, 'page error');
};
