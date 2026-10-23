// Input timestamps are echoed by the host with its simulation clock. This maps
// each snapshot to the guest's own timeline without synchronizing device clocks.
// Replay only the local avatar; all shared-world outcomes remain authoritative.
const MAX_REPLAY = 1000,
  HISTORY = 2200;
export class ContraPrediction {
  constructor(engine) {
    this.engine = engine;
    this.reset();
  }
  reset() {
    this.state = null;
    this.history = [];
    this.command = {};
    this.pulses = {};
    this.offset = { x: 0, y: 0 };
    this.sounds = [];
  }
  pulse(action) {
    if (['jump', 'fire'].includes(action)) this.pulses[action] = true;
  }
  input(command, now) {
    this.command = { ...command };
    this.history.push({ at: now, command: this.command });
    while (this.history.length > 1 && this.history[1].at < now - HISTORY) this.history.shift();
    if (this.history.length > 128) this.history.splice(0, this.history.length - 128);
  }
  clone(g) {
    return {
      ...g,
      player: { ...g.player },
      p2: { ...g.p2, player: { ...g.p2.player }, checkpoint: { ...g.p2.checkpoint } },
      bullets: g.bullets.filter((b) => b.owner === 1).map((b) => ({ ...b, hitIds: [...b.hitIds] })),
      movingPlatforms: g.movingPlatforms.map((p) => ({ ...p })),
      events: [],
      nextId: -1000000,
    };
  }
  reconcile(g, ack, now) {
    const previous = this.state?.p2.player,
      next = this.clone(g);
    if (
      this.state &&
      (this.state.room !== g.room ||
        this.state.level !== g.level ||
        previous.deadUntil !== g.p2.player.deadUntil ||
        previous.out !== g.p2.player.out)
    ) {
      this.state = next;
      this.history = [{ at: now, command: this.command }];
      this.offset = { x: 0, y: 0 };
      return;
    }
    const valid = ack && Number.isFinite(ack.at) && Number.isFinite(ack.clock);
    if (
      !valid &&
      this.state &&
      this.history.some((h) => Object.values(h.command).some((v) => v === true)) &&
      !g.p2.player.deadUntil &&
      !g.p2.player.out &&
      this.state.room === g.room
    )
      return;
    const start = valid
      ? Math.max(now - MAX_REPLAY, Math.min(now, ack.at + g.clock - ack.clock))
      : now;
    let command = {},
      at = start;
    for (const item of this.history) if (item.at <= start) command = item.command;
    for (const item of this.history) {
      if (item.at <= start || item.at > now) continue;
      this.replay(next, item.at - at, command);
      at = item.at;
      command = item.command;
    }
    this.replay(next, now - at, command);
    this.state = next;
    // A death/respawn/room transition must snap rather than visually resurrecting
    // the old avatar. Small correction errors decay instead of producing jitter.
    const sameLife =
      previous &&
      !previous.out &&
      !next.p2.player.out &&
      previous.deadUntil === next.p2.player.deadUntil;
    const dx = previous ? previous.x + this.offset.x - next.p2.player.x : 0;
    const dy = previous ? previous.y + this.offset.y - next.p2.player.y : 0;
    this.offset =
      sameLife && Math.abs(dx) < 32 && Math.abs(dy) < 48 ? { x: dx, y: dy } : { x: 0, y: 0 };
  }
  replay(g, ms, command) {
    while (ms > 0.001) {
      const step = Math.min(1000 / 60, ms);
      this.engine.predictCoopPlayer(g, step, command);
      ms -= step;
    }
  }
  advance(ms) {
    if (!this.state) return;
    this.engine.predictCoopPlayer(this.state, ms, { ...this.command, ...this.pulses });
    this.pulses = {};
    for (const event of this.state.events) if (event.name === 'shot') this.sounds.push('shot');
    const decay = Math.exp(-Math.max(0, ms) / 65);
    this.offset.x *= decay;
    this.offset.y *= decay;
  }
  apply(view) {
    if (!this.state || !view?.p2) return view;
    // The latest authoritative death always wins over local speculative motion.
    if (view.p2.player.out || view.p2.player.deadUntil) return view;
    return {
      ...view,
      cameraX:
        view.kind === 'side'
          ? Math.max(view.cameraX, Math.min(this.state.p2.player.x - 100, view.stage.width - 256))
          : view.cameraX,
      cameraY:
        view.kind === 'vertical'
          ? Math.min(view.cameraY, Math.max(0, this.state.p2.player.y - 145))
          : view.cameraY,
      p2: {
        ...view.p2,
        player: {
          ...this.state.p2.player,
          x: this.state.p2.player.x + this.offset.x,
          y: this.state.p2.player.y + this.offset.y,
        },
      },
      bullets: [...view.bullets.filter((b) => b.owner !== 1), ...this.state.bullets],
    };
  }
  takeSounds() {
    return this.sounds.splice(0);
  }
}
