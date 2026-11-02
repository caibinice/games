// Visual events never consume combat RNG or modify damage/skill state.
export function combatEffect(g, type, x, y, more = {}) {
  const duration = more.duration || 0.45,
    bornAt = more.bornAt ?? g.time ?? 0;
  if (more.visualKey) {
    const previous = g.effects.find((f) => f.visualKey === more.visualKey);
    if (previous) {
      Object.assign(previous, { type, x, y, ...more });
      previous.bornAt = bornAt;
      previous.life = Math.max(0.001, (more.until ?? bornAt + duration) - (g.time || 0));
      previous.duration = duration;
      return previous;
    }
  }
  const effect = {
    type,
    x,
    y,
    life: more.until === undefined ? duration : Math.max(0.001, more.until - (g.time || 0)),
    duration,
    bornAt,
    ...more,
  };
  g.effects.push(effect);
  if (g.effects.length > 160) {
    const index = g.effects.findIndex((f) => !f.visualKey);
    g.effects.splice(Math.max(0, index), 1);
  }
  return effect;
}

export function damageFeedback(g, enemy, amount, kind, critical = false) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  const now = g.time || 0;
  const previous =
    !critical &&
    g.effects.find(
      (f) =>
        f.type === 'damage-text' &&
        !f.critical &&
        f.enemyId === enemy.id &&
        f.kind === kind &&
        now - f.bornAt < 0.08,
    );
  if (previous) {
    previous.value += amount;
    return previous;
  }
  const sequence = (g.feedbackSequence = (g.feedbackSequence || 0) + 1);
  return combatEffect(
    g,
    'damage-text',
    enemy.x + ((sequence % 3) - 1) * 9,
    enemy.y - enemy.r * 0.8,
    {
      enemyId: enemy.id,
      kind,
      value: amount,
      critical,
      drift: (sequence % 2 ? 1 : -1) * 12,
      duration: critical ? 0.8 : 0.65,
    },
  );
}
