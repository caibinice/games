// Native TurnTabNewYearPage has eleven boundary markers, enclosing ten prizes.
export function seasonalPrizePoints(nodes) {
  const center = nodes.find((n) => n.name === 'm_tfTurnCentre'),
    markers = nodes.filter((n) => /^BoxItem(?: \(\d+\))?$/.test(n.name));
  if (!center || markers.length !== 11) return [];
  const point = (n) => ({
    x: n.cssMatrix[4] + (n.width * n.cssMatrix[0]) / 2,
    y: n.cssMatrix[5] + (n.height * n.cssMatrix[3]) / 2,
  });
  const c = point(center),
    m = markers.map(point),
    radius = Math.hypot(m[0].x - c.x, m[0].y - c.y);
  return m.slice(0, -1).map((p, i) => {
    let a = Math.atan2(p.y - c.y, p.x - c.x),
      b = Math.atan2(m[i + 1].y - c.y, m[i + 1].x - c.x);
    while (b < a) b += 2 * Math.PI;
    const angle = (a + b) / 2;
    return { x: c.x + Math.cos(angle) * radius, y: c.y + Math.sin(angle) * radius };
  });
}
export function seasonalTurn(state, pool, pick, grant) {
  const remaining = pool.filter((r) => !state.taken.includes(r.slot)),
    won = pick(remaining),
    out = [];
  const give = (r) => {
    const reward = grant(r);
    if (reward) out.push(reward);
    state.taken.push(r.slot);
  };
  give(won);
  // The native page states that collecting all limited prizes grants the rest.
  if (won.slot === 1 || state.taken.length === pool.length) {
    for (const r of pool) if (!state.taken.includes(r.slot)) give(r);
    state.round++;
    state.taken = [];
  }
  return { won, rewards: out };
}
