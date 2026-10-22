async (page) => {
  const assert = (v, m) => {
      if (!v) throw Error(m);
    },
    base = new URL(page.url()).origin,
    results = [],
    errors = [];
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(Error('QA orientation fallback'));
    if (screen.orientation)
      screen.orientation.lock = () => Promise.reject(Error('QA orientation fallback'));
  });
  const phone = await context.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  page.on('pageerror', (e) => errors.push(e.message));
  const state = (p) =>
    p
      .locator('#online-canvas')
      .evaluate((c) => ({ ...c.dataset, players: JSON.parse(c.dataset.players) }));
  try {
    for (const id of ['tank', 'contra', 'paopaotang', 'lianliankan']) {
      await page.goto(base + `/games/${id}/online.html`);
      await phone.goto(base + `/games/${id}/online.html`);
      await page.locator('[data-online=create]:enabled').click();
      const code = await page.locator('[data-online=room-code]').innerText();
      await phone.locator('[data-online=code]').fill(code);
      await phone.locator('[data-online=join]:enabled').tap();
      await phone.locator('[data-online=ready]:enabled').waitFor();
      await phone.locator('[data-online=ready]').tap();
      await page.locator('[data-online=ready]').click();
      await page.locator('[data-online=start]:enabled').click();
      const result = { id, code };
      if (id !== 'lianliankan') {
        await phone.locator('.online-full.online-rotated').waitFor();
        await page.waitForFunction(
          () => +document.querySelector('#online-canvas')?.dataset.clock > 3500,
        );
        const before = await state(page),
          pad = await phone.locator('.floating-stick').boundingBox(),
          fire = await phone.locator('[data-input=fire]').boundingBox();
        assert(pad && fire && fire.width >= 80 && fire.height >= 80, 'large mobile controls');
        const cdp = await context.newCDPSession(phone),
          x = pad.x + pad.width / 2,
          y = pad.y + pad.height / 2;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: x + (id === 'tank' ? 55 : 0), y: y + (id === 'tank' ? 0 : 55), id: 1 },
          ],
        });
        await phone.waitForTimeout(350);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await phone.locator('[data-input=fire]').tap();
        await page.waitForTimeout(150);
        const after = await state(page);
        assert(
          id === 'tank'
            ? after.players[1].y < before.players[1].y
            : after.players[1].x > before.players[1].x,
          'phone joystick controls remote 2P ' + id,
        );
        if (id === 'contra') {
          const old = after.players[1].y;
          await phone.locator('[data-input=jump]').tap();
          await page.waitForTimeout(130);
          assert((await state(page)).players[1].y < old, 'phone jump');
        }
        result.before = before;
        result.after = after;
        result.pad = pad;
        result.fire = fire;
      } else {
        await phone.locator('[data-board="1"]').waitFor();
        const tile = await phone.locator('[data-board="1"] > button').first().boundingBox();
        assert(tile.width >= 30, 'portrait duel tile size');
        const move = await phone.evaluate(async () => {
          const E = await import('/games/lianliankan/engine.mjs');
          const board = [...document.querySelectorAll('[data-board="1"] > button')].map(
            (b) => +b.dataset.fruit,
          );
          return E.findMove({ board, cols: 8, rows: 8 });
        });
        await phone.locator('[data-board="1"] > button').nth(move.a).tap();
        await phone.locator('[data-board="1"] > button').nth(move.b).tap();
        await phone.waitForFunction(
          (a) =>
            +document.querySelector(`[data-board="1"] > button[data-cell="${a}"]`).dataset.fruit ===
            0,
          move.a,
        );
        result.tile = tile;
        result.touchMatch = 'PASS';
      }
      await phone.screenshot({
        path: `E:/Documents/AI/codex/tmp/games-online-20261023/qa/${id}-mobile-online.png`,
        fullPage: true,
      });
      results.push(result);
      await phone.locator('[data-online=leave]').tap();
      await page.locator('[data-online=leave]').click();
    }
    assert(!errors.length, errors.join(';'));
    await page.evaluate((r) => (window.__onlineMobileQA = r), { result: 'PASS', results, errors });
  } finally {
    await context.close();
  }
};
