async (page) => {
  const base = new URL(page.url()).origin;
  const delay = Number(new URL(page.url()).searchParams.get('qaDelay') ?? 180);
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((delay) => {
    const Native = window.WebSocket;
    window.WebSocket = new Proxy(Native, {
      construct(Target, args) {
        const socket = new Target(...args),
          send = socket.send.bind(socket);
        socket.addEventListener('message', (e) => {
          const m = JSON.parse(e.data);
          if (m.type === 'frame')
            window.__netDiagnostic = {
              at: performance.now(),
              clock: m.state.clock,
              ack: m.state.inputAcks?.[1],
              player: m.state.p2.player,
            };
        });
        socket.send = (data) => {
          if (JSON.parse(data).type === 'input' && delay > 0)
            setTimeout(() => socket.readyState === 1 && send(data), delay);
          else send(data);
        };
        Object.defineProperty(socket, 'onmessage', {
          set(handler) {
            socket.addEventListener('message', (event) => {
              if (JSON.parse(event.data).type === 'frame' && delay > 0)
                setTimeout(() => handler(event), delay);
              else handler(event);
            });
          },
        });
        return socket;
      },
    });
  }, delay);
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
    await peer.bringToFront();
    await peer.evaluate(() => {
      const canvas = document.querySelector('#online-canvas');
      window.__motion = {
        start: performance.now(),
        initialX: canvas.__arcadeMotion?.x ?? JSON.parse(canvas.dataset.players)[1].x,
        samples: [],
      };
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
      const { samples, initialX: x } = window.__motion;
      const first = samples.find((s) => s.x > x + 0.2);
      const moving = samples.filter((s) => s.t > 400 && s.t < 650);
      const changes = moving.slice(1).filter((s, i) => Math.abs(s.x - moving[i].x) > 0.05).length;
      const canvas = document.querySelector('#online-canvas');
      return {
        inputToVisibleMs: first?.t,
        visiblePositionChanges: changes,
        renderSamples: moving.length,
        samples,
        finalCorrectionError: Math.abs(
          JSON.parse(canvas.dataset.players)[1].x - canvas.__arcadeMotion.x,
        ),
      };
    });
    result.injectedOneWayMs = delay;
    result.hostClockAdvanced =
      (await page.locator('#online-canvas').evaluate((c) => +c.dataset.clock)) - hostStart;
    result.diagnostic = await peer.evaluate(() => ({
      now: performance.now(),
      net: window.__netDiagnostic,
      render: document.querySelector('#online-canvas').__arcadeMotion,
      visibility: document.visibilityState,
    }));
    await page.evaluate((r) => (window.__latencyQA = r), result);
    if (result.hostClockAdvanced < 1400)
      throw Error('Host simulation was throttled with rendering');
    if (result.finalCorrectionError > 3)
      throw Error('Prediction did not converge to authoritative state');
    await peer.locator('[data-online=leave]').click();
    await page.locator('[data-online=leave]').click();
  } finally {
    await context.close();
  }
};
