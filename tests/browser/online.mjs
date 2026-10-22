async (page) => {
  const assert = (value, text) => {
    if (!value) throw Error(text);
  };
  const base = new URL(page.url()).origin,
    results = [],
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const browser = page.context().browser();
  const peerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await peerContext.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = new Proxy(Native, {
      construct(Target, args) {
        const s = new Target(...args);
        window.__qaSocket = s;
        return s;
      },
    });
  });
  const peer = await peerContext.newPage();
  peer.on('pageerror', (e) => errors.push(e.message));
  const state = (p) =>
    p
      .locator('#online-canvas')
      .evaluate((c) => ({ ...c.dataset, players: JSON.parse(c.dataset.players) }));
  const board = (p, slot) =>
    p
      .locator(`[data-board="${slot}"] > button`)
      .evaluateAll((bs) => bs.map((b) => +b.dataset.fruit));
  async function linkMove(p, slot, desired) {
    await p.waitForFunction(
      (s) => !document.querySelector(`[data-board="${s}"]`).classList.contains('frozen'),
      slot,
    );
    const move = await p.evaluate(
      async ({ slot, desired }) => {
        const E = await import('/games/lianliankan/engine.mjs'),
          b = [...document.querySelectorAll(`[data-board="${slot}"] > button`)].map(
            (x) => +x.dataset.fruit,
          ),
          g = { board: b, cols: 8, rows: 8 };
        if (desired) {
          const indices = b.flatMap((v, i) => (v === desired ? [i] : []));
          for (let i = 0; i < indices.length; i++)
            for (let j = i + 1; j < indices.length; j++)
              if (E.findPath(g, indices[i], indices[j]))
                return { a: indices[i], b: indices[j], type: desired };
        }
        const m = E.findMove(g);
        return m ? { a: m.a, b: m.b, type: b[m.a] } : null;
      },
      { slot, desired },
    );
    assert(move, 'available link pair');
    const root = p.locator(`[data-board="${slot}"]`);
    await root.locator('> button').nth(move.a).click();
    await root.locator('> button').nth(move.b).click();
    await p.waitForFunction(
      ({ slot, a }) =>
        +document.querySelector(`[data-board="${slot}"] > button[data-cell="${a}"]`).dataset
          .fruit === 0,
      { slot, a: move.a },
    );
    return move;
  }
  try {
    for (const id of ['tank', 'contra', 'paopaotang', 'lianliankan']) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${base}/games/${id}/online.html`);
      await peer.goto(`${base}/games/${id}/online.html`);
      await page.locator('[data-online=name]').fill('主机测试');
      await peer.locator('[data-online=name]').fill('远端2P');
      await page.locator('[data-online=create]:enabled').waitFor();
      await page.locator('[data-online=create]').click();
      const code = await page.locator('[data-online=room-code]').innerText();
      await peer.locator('[data-online=code]').fill(code);
      await peer.locator('[data-online=join]:enabled').click();
      await peer.locator('[data-online=ready]:enabled').waitFor();
      await peer.locator('[data-online=ready]').click();
      await page.locator('[data-online=ready]').click();
      await page.locator('[data-online=start]:enabled').waitFor();
      await page.locator('[data-online=start]').click();
      const result = { id, code };
      if (id !== 'lianliankan') {
        await page.waitForFunction(
          () =>
            +document.querySelector('#online-canvas')?.dataset.clock >
            (document.title.includes('坦克') ? 3500 : 500),
        );
        await peer.waitForFunction(
          () => +document.querySelector('#online-canvas')?.dataset.sequence > 2,
        );
        const before = await state(page);
        await peer.keyboard.down(id === 'tank' ? 'ArrowUp' : 'ArrowRight');
        await page.waitForTimeout(400);
        await peer.keyboard.up(id === 'tank' ? 'ArrowUp' : 'ArrowRight');
        await page.waitForTimeout(150);
        const after = await state(page),
          mirrored = await state(peer);
        const a = before.players[1],
          b = after.players[1];
        assert(a && b, 'two players exist in ' + id);
        assert(id === 'tank' ? b.y < a.y : b.x > a.x, 'remote 2P movement in ' + id);
        assert(Math.abs(+after.clock - +mirrored.clock) < 200, 'bounded snapshot delay ' + id);
        assert(
          Math.abs(after.players[1].x - mirrored.players[1].x) < 5 &&
            Math.abs(after.players[1].y - mirrored.players[1].y) < 5,
          'mirrored remote player ' + id,
        );
        await peer.keyboard.press('KeyJ');
        await page.waitForTimeout(180);
        result.before = before;
        result.after = after;
        result.mirrored = mirrored;
        if (id === 'contra') {
          const y = (await state(page)).players[1].y;
          await peer.keyboard.down('Space');
          await page.waitForTimeout(130);
          await peer.keyboard.up('Space');
          const jumping = await state(page);
          assert(jumping.players[1].y < y, 'remote 2P jump');
          result.jumping = jumping;
        }
        await page.locator('[data-online=pause]').click();
        await peer.locator('[data-online=ready]').waitFor();
        const paused = await state(page);
        await page.waitForTimeout(200);
        assert((await state(page)).clock === paused.clock, 'shared pause ' + id);
        await peer.locator('[data-online=ready]').click();
        await page.locator('[data-online=ready]').click();
        await page.locator('[data-online=start]:enabled').click();
        await page.waitForFunction(
          () => document.querySelector('#online-canvas').dataset.roomPhase === 'running',
        );
        assert((await state(page)).round === paused.round, 'resume preserves round');
        if (id === 'tank') {
          await peer.evaluate(() => window.__qaSocket.close());
          await page.locator('[data-online=ready]').waitFor();
          await peer.waitForFunction(
            () => document.querySelector('[data-online=ready]')?.disabled === false,
          );
          await peer.locator('[data-online=ready]').click();
          await page.locator('[data-online=start]:enabled').click();
          await page.waitForFunction(
            () => document.querySelector('#online-canvas').dataset.roomPhase === 'running',
          );
          result.reconnect = 'PASS';
        }
        await page.screenshot({
          path: `E:/Documents/AI/codex/tmp/games-online-20261023/qa/${id}-online.png`,
          fullPage: true,
        });
      } else {
        await page.locator('[data-board="0"]').waitFor();
        await peer.locator('[data-board="1"]').waitFor();
        assert(
          JSON.stringify(await board(page, 0)) === JSON.stringify(await board(peer, 1)),
          'fair starting boards',
        );
        await linkMove(peer, 1);
        await linkMove(peer, 1);
        let frozen = false,
          added = false;
        for (let i = 0; i < 18 && !frozen; i++) {
          const m = await linkMove(page, 0, 1);
          if (m.type === 1) {
            await peer.waitForFunction(() =>
              document.querySelector('[data-board="1"]').classList.contains('frozen'),
            );
            frozen = true;
          }
        }
        assert(frozen, 'real freeze attack');
        await peer.waitForFunction(
          () => !document.querySelector('[data-board="1"]').classList.contains('frozen'),
        );
        await page.waitForTimeout(650);
        const remainingBefore = (await board(peer, 1)).filter(Boolean).length;
        for (let i = 0; i < 18 && !added; i++) {
          const m = await linkMove(page, 0, 2);
          if (m.type === 2) {
            await peer.waitForFunction(
              (n) =>
                [...document.querySelectorAll('[data-board="1"] > button')].filter(
                  (b) => +b.dataset.fruit > 0,
                ).length > n,
              remainingBefore,
            );
            added = true;
          }
        }
        assert(added, 'real added-pair attack');
        await page.waitForTimeout(100);
        assert(
          JSON.stringify(await board(page, 1)) === JSON.stringify(await board(peer, 1)),
          'opponent board synchronization',
        );
        result.freeze = 'PASS';
        result.added = 'PASS';
        result.remainingBefore = remainingBefore;
        result.remainingAfter = (await board(peer, 1)).filter(Boolean).length;
        await page.screenshot({
          path: 'E:/Documents/AI/codex/tmp/games-online-20261023/qa/lianliankan-online.png',
          fullPage: true,
        });
      }
      results.push(result);
      await peer.locator('[data-online=leave]').click();
      await page.locator('[data-online=leave]').click();
      await page.evaluate((r) => (window.__onlineQA = r), { result: 'RUNNING', results, errors });
    }
    // Matchmaking is verified independently of private room codes.
    await page.goto(base + '/games/tank/online.html');
    await peer.goto(base + '/games/tank/online.html');
    await page.locator('[data-online=match]:enabled').click();
    await page.locator('[data-online=ready]:enabled').waitFor();
    await peer.locator('[data-online=match]:enabled').click();
    await peer.locator('[data-online=ready]:enabled').waitFor();
    assert(
      (await page.locator('[data-online=room-code]').innerText()) ===
        (await peer.locator('[data-online=room-code]').innerText()),
      'public matchmaking',
    );
    await peer.locator('[data-online=leave]').click();
    await page.locator('[data-online=leave]').click();
    assert(!errors.length, errors.join(';'));
    await page.evaluate((r) => (window.__onlineQA = r), {
      result: 'PASS',
      results,
      matchmaking: 'PASS',
      errors,
    });
  } finally {
    await peerContext.close();
  }
};
