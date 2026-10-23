// Two snapshots are enough for a one-update interpolation buffer. Extrapolation
// is strictly capped, so a stalled connection does not run the battle by itself.
function actor(a, b, t) {
  if (
    !a ||
    a.deadUntil !== b.deadUntil ||
    a.out !== b.out ||
    a.alive !== b.alive ||
    Math.abs(a.x - b.x) > 48 ||
    Math.abs(a.y - b.y) > 80
  )
    return b;
  return { ...b, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
const identity = (e) => e.tankId ?? e.bulletId ?? e.id;
export class SnapshotPresentation {
  reset() {
    this.previous = this.latest = null;
    this.maps = {};
  }
  constructor(id) {
    this.id = id;
    this.reset();
  }
  receive(state, now) {
    this.previous = this.latest;
    this.latest = { state, at: now };
    this.maps = {};
    const old = this.previous?.state;
    if (!old || old.level !== state.level || old.room !== state.room) {
      this.previous = null;
      return;
    }
    const source = this.id === 'tank' ? old.session.scene : old;
    for (const key of [
      'tanks',
      'bullets',
      'enemyBullets',
      'enemies',
      'capsules',
      'pickups',
      'movingPlatforms',
    ])
      if (source?.[key]) this.maps[key] = new Map(source[key].map((e) => [identity(e), e]));
  }
  sample(now) {
    if (!this.latest) return null;
    const b = this.latest.state,
      a = this.previous?.state;
    const elapsed = Math.min(100, Math.max(0, now - this.latest.at));
    if (!a || !['tank', 'contra'].includes(this.id)) return b;
    const span = Math.max(1, b.clock - a.clock);
    const t = Math.min(1 + 50 / span, Math.max(0, (span + elapsed - 50) / span));
    const lists = (state) =>
      Object.fromEntries(
        Object.keys(this.maps)
          .filter((k) => state[k])
          .map((k) => [k, state[k].map((e) => actor(this.maps[k].get(identity(e)), e, t))]),
      );
    if (this.id === 'tank')
      return {
        ...b,
        clock: Math.max(0, b.clock + elapsed - 50),
        session: {
          ...b.session,
          scene: b.session.scene && { ...b.session.scene, ...lists(b.session.scene) },
        },
      };
    return {
      ...b,
      ...lists(b),
      clock: Math.max(0, b.clock + elapsed - 50),
      cameraX: a.cameraX + (b.cameraX - a.cameraX) * t,
      cameraY: a.cameraY + (b.cameraY - a.cameraY) * t,
      player: actor(a.player, b.player, t),
      boss: a.boss && b.boss ? actor(a.boss, b.boss, t) : b.boss,
      p2: { ...b.p2, player: actor(a.p2.player, b.p2.player, t) },
    };
  }
}
