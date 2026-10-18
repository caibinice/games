async (page) => {
  const assert = (v, m) => {
      if (!v) throw Error(m);
    },
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const plan = await page.evaluate(async () => {
    const E = await import('/games/racer/engine.mjs');
    const g = E.newGame({ level: 1 });
    while (g.spawnAt < 1800) E.spawnPattern(g);
    const items = g.objects.filter((o) => E.ITEMS[o.type]);
    return g.route.map((r) => {
      const extent =
        2.1 + Math.max(...g.objects.filter((o) => o.row === r.z).map((o) => o.length)) / 2;
      const next = g.route[g.route.indexOf(r) + 1];
      const pickup = items.find((o) => o.z > r.z && (!next || o.z < next.z));
      return { ...r, release: Math.max(r.z + extent + 0.5, pickup ? pickup.z + 3 : 0) };
    });
  });
  await page.locator('[data-action=levels]').click();
  await page.locator('button[data-level="1"]').click();
  await page.locator('[data-action=start]').click();
  const state = () => page.locator('#racer-canvas').evaluate((c) => ({ ...c.dataset }));
  const seen = {},
    turns = [];
  let target = 0,
    ghostAt = null;
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    let s = await state();
    assert(s.status === 'running', 'race ended before pickups ' + JSON.stringify(s));
    if (+s.reverse > 0 && !seen.reverse) {
      seen.reverse = s;
      await page.screenshot({
        path: 'E:/Documents/AI/codex/tmp/racer-upgrade-20261018/qa/reverse.png',
      });
    }
    if (+s.fullSpeed > 0 && !seen.fullSpeed) {
      await page.keyboard.press('Shift');
      await page.waitForTimeout(20);
      seen.fullSpeed = await state();
      assert(+seen.fullSpeed.boost === 1 && +seen.fullSpeed.fullSpeed > 0, 'forced nitro lock');
    }
    if (+s.ghost > 0 && !seen.ghost) {
      seen.ghost = s;
      ghostAt = +s.distance;
      const upcoming = plan.find((r) => r.z > ghostAt + 8);
      seen.ghostTarget = upcoming;
    }
    if (ghostAt !== null) {
      if (+s.distance > ghostAt + 85) {
        seen.afterGhost = await state();
        assert(+seen.afterGhost.hp === +seen.ghost.hp, 'ghost ignored obstacles');
        assert(+seen.afterGhost.ghostOpacity < 0.5, 'transparent model');
        await page.screenshot({
          path: 'E:/Documents/AI/codex/tmp/racer-upgrade-20261018/qa/ghost.png',
        });
        break;
      }
    } else while (target < plan.length - 1 && +s.distance > plan[target].release) target++;
    const desired = ghostAt === null ? plan[target].lane : (seen.ghostTarget.lane + 1) % 3;
    if (+s.lane !== desired) {
      const delta = Math.sign(desired - +s.lane);
      const press = delta * (+s.reverse > 0 ? -1 : 1) > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.press(press);
      const next = await state();
      turns.push({
        distance: +s.distance,
        reverse: +s.reverse,
        press,
        from: +s.lane,
        to: +next.lane,
      });
    }
    await page.waitForTimeout(35);
  }
  await page.locator('[data-action=pause]').click();
  assert(
    seen.reverse && seen.fullSpeed && seen.ghost && seen.afterGhost,
    'all real pickups reached',
  );
  assert(
    turns.some(
      (t) =>
        t.reverse > 0 &&
        ((t.press === 'ArrowLeft' && t.to > t.from) || (t.press === 'ArrowRight' && t.to < t.from)),
    ),
    'reverse input verified',
  );
  assert(+seen.fullSpeed.energy >= 99, 'free nitro');
  assert(!errors.length, 'page errors');
  await page.evaluate((r) => (window.__pickupQA = r), { result: 'PASS', seen, turns, errors });
};
