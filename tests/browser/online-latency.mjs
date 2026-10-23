async (page) => {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = new Proxy(Native, {
      construct(Target, args) {
        const socket = new Target(...args),
          send = socket.send.bind(socket);
        socket.send = (data) => {
          if (JSON.parse(data).type === 'input')
            setTimeout(() => socket.readyState === 1 && send(data), 180);
          else send(data);
        };
        Object.defineProperty(socket, 'onmessage', {
          set(handler) {
            socket.addEventListener('message', (event) => {
              if (JSON.parse(event.data).type === 'frame') setTimeout(() => handler(event), 180);
              else handler(event);
            });
          },
        });
        return socket;
      },
    });
  });
  const peer = await context.newPage();
  try {
    await page.goto(base + '/games/contra/online.html');
    await peer.goto(base + '/games/contra/online.html');
    // A flat base room isolates networking from combat/respawn during the sample.
    await page.locator('select').selectOption('2');
    await page.locator('[data-online=create]:enabled').click();
    const code = await page.locator('[data-online=room-code]').innerText();
    await peer.locator('[data-online=code]').fill(code);
    await peer.locator('[data-online=join]:enabled').click();
    await peer.locator('[data-online=ready]:enabled').click();
    await page.locator('[data-online=ready]:enabled').click();
    await page.locator('[data-online=start]:enabled').click();
    await peer.waitForFunction(
      () => +document.querySelector('#online-canvas')?.dataset.sequence > 4,
    );
    const hostStart = await page.locator('#online-canvas').evaluate((c) => +c.dataset.clock);
    await peer.evaluate(() => {
      window.__motion = { start: performance.now(), samples: [] };
      const sample = () => {
        const d = document.querySelector('#online-canvas')?.dataset;
        if (!d || !window.__motion) return;
        const p =
          document.querySelector('#online-canvas').__arcadeMotion ||
          JSON.parse(d.renderPlayers || d.players)[1];
        window.__motion.samples.push({
          t: performance.now() - window.__motion.start,
          x: p.x,
          y: p.y,
        });
        if (performance.now() - window.__motion.start < 1800) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await peer.keyboard.down('ArrowRight');
    await peer.waitForTimeout(700);
    await peer.keyboard.up('ArrowRight');
    await peer.waitForTimeout(1000);
    const result = await peer.evaluate(() => {
      const { samples } = window.__motion,
        x = samples[0].x;
      const first = samples.find((s) => s.x > x + 0.2);
      const moving = samples.filter((s) => s.t > 400 && s.t < 650);
      const changes = moving.slice(1).filter((s, i) => Math.abs(s.x - moving[i].x) > 0.05).length;
      return {
        injectedOneWayMs: 180,
        inputToVisibleMs: first?.t,
        visiblePositionChanges: changes,
        renderSamples: moving.length,
        samples,
      };
    });
    result.hostClockAdvanced =
      (await page.locator('#online-canvas').evaluate((c) => +c.dataset.clock)) - hostStart;
    const authoritativeX = await peer
      .locator('#online-canvas')
      .evaluate((c) => JSON.parse(c.dataset.players)[1].x);
    result.finalCorrectionError = Math.abs(authoritativeX - result.samples.at(-1).x);
    if (result.hostClockAdvanced < 1400)
      throw Error('Host simulation was throttled with rendering');
    if (result.finalCorrectionError > 3)
      throw Error('Prediction did not converge to authoritative state');
    await page.evaluate((r) => (window.__latencyQA = r), result);
    await peer.locator('[data-online=leave]').click();
    await page.locator('[data-online=leave]').click();
  } finally {
    await context.close();
  }
};
