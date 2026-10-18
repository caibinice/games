import { JET_DURATION, LANE_SPEED, LANES } from './engine.mjs';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Predict less than one fixed tick for 90/120 Hz screens, without altering collision state.
export function visualPose(g, remainder = 0) {
  const dt = g.status === 'running' ? clamp(remainder, 0, 1 / 60) : 0;
  const jet = Math.max(0, g.jet - dt);
  const t = 1 - jet / JET_DURATION;
  const turn = clamp((t - 0.16) / 0.67, 0, 1);
  return {
    distance: g.distance + g.speed * dt,
    x: g.x + clamp(LANES[g.lane] - g.x, -LANE_SPEED * dt, LANE_SPEED * dt),
    height: jet > 0 ? Math.sin(Math.PI * t) * 3.8 : 0,
    roll: jet > 0 ? turn * turn * (3 - 2 * turn) * Math.PI * 2 : 0,
  };
}

export function frameSize(width, height, previous) {
  const w = Math.max(1, Math.round(width)),
    h = Math.max(1, Math.round(height));
  return { width: w, height: h, changed: w !== previous.width || h !== previous.height };
}
